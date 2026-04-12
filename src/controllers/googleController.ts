import { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { analyzeWithAI } from '../services/aiService';
import Analysis from '../models/Analysis';

const SCOPES = [
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

function getOAuth2Client() {
  console.log('DEBUG: Redirect URI being used:', process.env.GOOGLE_REDIRECT_URI);
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function getAuthUrl(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function handleCallback(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    await User.findByIdAndUpdate(req.user!.userId, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry: tokens.expiry_date,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getAuthenticatedClient(userId: string) {
  const user = await User.findById(userId);
  if (!user || !user.googleAccessToken) {
    throw new Error('Google account not connected');
  }

  const client = getOAuth2Client();

  client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry,
  });

  // Handle token refresh
  client.on('tokens', async (tokens) => {
    const update: any = {};
    if (tokens.access_token) update.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) update.googleRefreshToken = tokens.refresh_token;
    if (tokens.expiry_date) update.googleTokenExpiry = tokens.expiry_date;
    
    await User.findByIdAndUpdate(userId, update);
  });

  return client;
}

export async function listForms(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = await getAuthenticatedClient(req.user!.userId);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.form'",
      fields: 'files(id, name, webViewLink, iconLink)',
    });

    res.json({ forms: response.data.files });
  } catch (err) {
    next(err);
  }
}

export async function analyzeForm(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { formId, customPrompt } = req.body;
    if (!formId) {
      res.status(400).json({ error: 'Form ID is required' });
      return;
    }

    const auth = await getAuthenticatedClient(req.user!.userId);
    const forms = google.forms({ version: 'v1', auth });

    // 1. Get Form Metadata (to get question titles)
    const formMetadata = await forms.forms.get({ formId });
    const questions: Record<string, string> = {};
    
    formMetadata.data.items?.forEach((item) => {
      if (item.questionItem) {
        questions[item.questionItem.question?.questionId || ''] = item.title || 'Untitled Question';
      }
    });

    // 2. Get Form Responses
    const responsesData = await forms.forms.responses.list({ formId });
    const rawResponses = responsesData.data.responses || [];

    if (rawResponses.length === 0) {
      res.status(400).json({ error: 'This form has no responses yet.' });
      return;
    }

    // 3. Format responses into CSV-like structure for AI
    const formattedData = rawResponses.map((resp) => {
      const row: Record<string, any> = {
        'Response ID': resp.responseId,
        'Submitted At': resp.createTime,
      };

      Object.entries(resp.answers || {}).forEach(([qId, answer]) => {
        const questionTitle = questions[qId] || 'Unknown Question';
        // Extracting answer value
        const values = answer.textAnswers?.answers?.map(a => a.value).join(', ');
        row[questionTitle] = values || '';
      });

      return row;
    });

    // 4. Run AI Analysis
    const result = await analyzeWithAI(formattedData, customPrompt);

    // 5. Save Analysis
    const analysis = await Analysis.create({
      userId: req.user!.userId,
      formId,
      source: 'google_form',
      summary: result.summary,
      detailedReport: result.detailedReport,
      responsesTable: result.responsesTable,
    });

    // Increment analysis count
    await User.findByIdAndUpdate(req.user!.userId, {
      $inc: { analysisCount: 1 },
    });

    res.status(201).json({ analysis });
  } catch (err) {
    next(err);
  }
}

export async function disconnectGoogle(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await User.findByIdAndUpdate(req.user!.userId, {
      $unset: {
        googleAccessToken: 1,
        googleRefreshToken: 1,
        googleTokenExpiry: 1,
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  console.log('DEBUG: Webhook triggered for User:', req.params.userId, 'Form:', req.params.formId);
  try {
    const userId = req.params.userId as string;
    const formId = req.params.formId as string;
    const secret = req.query.secret as string;

    if (!userId || !formId || !secret) {
      console.log('DEBUG: Webhook failed - missing parameters');
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    const user = await User.findById(userId);
    if (!user || user.webhookSecret !== secret) {
      console.log('DEBUG: Webhook failed - invalid secret or user. User secret:', user?.webhookSecret, 'Provided secret:', secret);
      res.status(403).json({ error: 'Invalid webhook secret or user' });
      return;
    }

    console.log('DEBUG: Webhook secret verified. Fetching form data...');
    const auth = await getAuthenticatedClient(userId);
    const forms = google.forms({ version: 'v1', auth });

    const formMetadata = await forms.forms.get({ formId });
    const questions: Record<string, string> = {};
    formMetadata.data.items?.forEach((item: any) => {
      if (item.questionItem) {
        questions[item.questionItem.question?.questionId || ''] = item.title || 'Untitled Question';
      }
    });

    const responsesData = await forms.forms.responses.list({ formId });
    const rawResponses = responsesData.data.responses || [];

    if (rawResponses.length === 0) {
      console.log('DEBUG: Webhook failed - no responses found');
      res.status(400).json({ error: 'No responses' });
      return;
    }

    console.log(`DEBUG: Found ${rawResponses.length} responses. Running AI analysis...`);
    const formattedData = rawResponses.map((resp: any) => {
      const row: Record<string, any> = {
        'Response ID': resp.responseId,
        'Submitted At': resp.createTime,
      };
      Object.entries(resp.answers || {}).forEach(([qId, answer]: [string, any]) => {
        const questionTitle = questions[qId] || 'Unknown Question';
        const values = answer.textAnswers?.answers?.map((a: any) => a.value).join(', ');
        row[questionTitle] = values || '';
      });
      return row;
    });

    const result = await analyzeWithAI(formattedData);
    console.log('DEBUG: AI analysis completed. Saving to database...');

    await Analysis.create({
      userId: user._id,
      formId,
      source: 'google_form',
      summary: result.summary,
      detailedReport: result.detailedReport,
      responsesTable: result.responsesTable,
    });

    await User.findByIdAndUpdate(userId, {
      $inc: { analysisCount: 1 },
    });

    console.log('DEBUG: Webhook successful! Analysis saved.');
    res.json({ success: true, message: 'Instant analysis completed' });
  } catch (err) {
    console.error('DEBUG: Webhook Exception:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
