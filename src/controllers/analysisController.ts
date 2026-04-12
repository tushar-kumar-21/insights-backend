import { Response, NextFunction } from 'express';
import Analysis from '../models/Analysis';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { analyzeWithAI, modifyAnalysisWithAI } from '../services/aiService';
import { generateAnalysisPDF } from '../utils/pdfGenerator';

const FREE_ANALYSIS_LIMIT = 3;

export async function modifyAnalysis(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customPrompt } = req.body;

    if (!customPrompt) {
      res.status(400).json({ error: 'Custom prompt is required.' });
      return;
    }

    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    }).populate('uploadId', 'originalName rowCount columnNames');

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }

    if (!analysis.detailedReport || !analysis.responsesTable) {
       res.status(400).json({ error: 'Cannot modify legacy analyses without detailed reports.' });
       return;
    }

    const existingAnalysis = {
      summary: analysis.summary,
      detailedReport: analysis.detailedReport,
      responsesTable: analysis.responsesTable,
    };

    const result = await modifyAnalysisWithAI(existingAnalysis, customPrompt);

    analysis.summary = result.summary;
    analysis.detailedReport = result.detailedReport;
    analysis.responsesTable = result.responsesTable;
    await analysis.save();

    res.status(200).json({ analysis });
  } catch (err) {
    next(err);
  }
}

export async function analyzeData(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { uploadId, data, customPrompt } = req.body;

    if (!uploadId || !data || !Array.isArray(data) || data.length === 0) {
      res.status(400).json({ error: 'Upload ID and data are required.' });
      return;
    }

    /* Check plan limits
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.plan === 'free' && user.analysisCount >= FREE_ANALYSIS_LIMIT) {
      res.status(403).json({
        error: `Free plan is limited to ${FREE_ANALYSIS_LIMIT} analyses. Upgrade to Pro for unlimited analyses.`,
      });
      return;
    }
    */

    // Call AI service
    const result = await analyzeWithAI(data, customPrompt);

    // Save analysis
    const analysis = await Analysis.create({
      userId: req.user!.userId,
      uploadId,
      source: 'upload',
      ...result,
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

export async function getAnalyses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const analyses = await Analysis.find({ userId: req.user!.userId })
      .populate('uploadId', 'originalName rowCount columnNames')
      .sort({ createdAt: -1 });

    res.json({ analyses });
  } catch (err) {
    next(err);
  }
}

export async function getAnalysis(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    }).populate('uploadId', 'originalName rowCount columnNames');

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }

    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

export async function exportAnalysisPDF(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    }).populate('uploadId', 'originalName rowCount');

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }

    const user = await User.findById(req.user!.userId);
    /*
    if (!user || user.plan !== 'pro') {
      res.status(403).json({ error: 'PDF export is a Pro feature.' });
      return;
    }
    */

    generateAnalysisPDF(res, analysis, (analysis.uploadId as any).originalName);
  } catch (err) {
    next(err);
  }
}
