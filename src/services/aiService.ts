import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

export interface AnalysisResult {
  summary: string;
  detailedReport: string;
  responsesTable: string;
}

export async function modifyAnalysisWithAI(
  existingAnalysis: AnalysisResult,
  customPrompt: string
): Promise<AnalysisResult> {
  const prompt = `You are an expert Google Forms Response Analyst and Professional Report Writer.

I have an existing analysis report based on Google Forms responses. I need you to modify it according to the following new instructions.

EXISTING REPORT SUMMARY:
${existingAnalysis.summary}

EXISTING DETAILED REPORT:
${existingAnalysis.detailedReport}

EXISTING RESPONSES TABLE:
${existingAnalysis.responsesTable}

USER CUSTOM MODIFICATION INSTRUCTIONS:
${customPrompt}

Please strictly follow the above instructions to update and modify the existing analysis.

────────────────────────────
1. SUMMARIZED LIST OF ALL RESPONSES (responsesTable)
────────────────────────────
- Create a professionally formatted Markdown TABLE.
- Modify the existing table if requested, otherwise keep it as is.

────────────────────────────
2. DETAILED ANALYTICAL REPORT (detailedReport)
────────────────────────────
- Create a comprehensive, professional Markdown report.
- Apply the user's custom instructions to update the tone, focus, or structure of the report.

Output MUST be valid JSON with this exact structure:
{
  "summary": "A short 1-2 sentence summary of the report to be used in a sidebar history list.",
  "detailedReport": "The COMPLETE professional markdown report containing the Detailed Analytical Report.",
  "responsesTable": "The beautifully formatted markdown TABLE listing EVERY individual response as requested."
}

Requirements:
- Ensure strictly valid JSON without any markdown formatting wrappers outside the JSON block.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  if (!content) {
    throw new Error('No response from AI service');
  }

  let parsedResult: AnalysisResult;
  try {
    parsedResult = JSON.parse(content);
  } catch (err) {
    throw new Error('AI returned invalid JSON');
  }

  // Validate structure
  if (!parsedResult.summary || !parsedResult.detailedReport || !parsedResult.responsesTable) {
    throw new Error('AI returned incomplete analysis structure');
  }

  return parsedResult;
}

export async function analyzeWithAI(
  data: Record<string, unknown>[],
  customPrompt?: string
): Promise<AnalysisResult> {
  // Format data into readable text for AI
  const sampleSize = Math.min(data.length, 100);
  const sample = data.slice(0, sampleSize);
  const columns = Object.keys(data[0] || {});

  const formattedData = sample
    .map((row, i) => {
      const entries = Object.entries(row)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      return `Response ${i + 1}: ${entries}`;
    })
    .join('\n');

  const prompt = `You are a Senior Hiring Strategist and Data Analyst. Your goal is to deeply analyze datasets (primarily applicant data) and generate a high-impact hiring intelligence report.

I have uploaded/submitted a CSV file containing responses.

CSV DATA:
Columns: ${columns.join(', ')}
${formattedData}

${customPrompt ? `USER CUSTOM INSTRUCTIONS:
${customPrompt}

IMPORTANT: If these custom instructions request a different type of analysis or focus, prioritize them. However, always strive to maintain the depth, metrics, and professional structure defined in the steps below where applicable.` : ''}

Please analyze the CSV and create a professional, well-structured output following these steps:

-------------------------------------
STEP 1: Data Preparation
- Clean missing/null values intelligently.
- Normalize numeric values and standardize relevant units (e.g., salary, experience).
- Extract individual skills/key attributes into a structured format.

-------------------------------------
STEP 2: Derive Advanced Metrics
Calculate relevant metrics for each record (e.g., for hiring: Salary Hike %, Skill Strength Score, Hireability Score (0-100), Risk Score).
Apply similar analytical rigor to non-hiring data if applicable.

-------------------------------------
STEP 3: Intelligent Segmentation
Segment the entries into meaningful categories (e.g., Top Performers, Budget Efficient, Fast Joiners, High Potential, Risky Candidates).

-------------------------------------
STEP 4: Deep Insights (IMPORTANT)
Generate insights uncovering correlations, patterns, and anomalies (e.g., skill vs. salary correlation, experience vs. expectation, common traits of top performers).

-------------------------------------
STEP 5: Recommendations
Suggest an ideal strategy based on the analysis.
- Identify Top 5 entries (with reasons).
- Identify "Hidden Gems" or undervalued entries.
- Identify entries to avoid/be cautious of (with reasoning).

-------------------------------------
STEP 6: Output Format (MUST FOLLOW THIS)

The "detailedReport" in the JSON output must follow this structure:
1. Executive Summary (short, impactful)
2. Key Insights (bullet points)
3. Metrics Summary (averages, percentages, etc.)
4. Segmentation Summary
5. Top Candidates/Entries (table with reasoning)
6. Hidden Gems
7. Risky/Cautionary Entries
8. Final Strategy Recommendation

────────────────────────────
1. SUMMARIZED LIST OF ALL RESPONSES (responsesTable)
────────────────────────────
- Create a professionally formatted Markdown TABLE.
- Columns should be: "Response #", "Summary of Entry", "Notable/Standout Info".
- Summarize EVERY individual response clearly and concisely.

Output MUST be valid JSON with this exact structure:
{
  "summary": "A short 1-2 sentence summary of the report to be used in a sidebar history list.",
  "detailedReport": "The COMPLETE professional markdown report following the 8-point structure defined in Step 6.",
  "responsesTable": "The beautifully formatted markdown TABLE listing EVERY individual response."
}

Requirements:
- Ensure strictly valid JSON without any markdown formatting wrappers outside the JSON block.
- Do NOT just list data — analyze deeply.
- Provide reasoning for every conclusion.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  if (!content) {
    throw new Error('No response from AI service');
  }

  let parsedResult: AnalysisResult;
  try {
    parsedResult = JSON.parse(content);
  } catch (err) {
    throw new Error('AI returned invalid JSON');
  }

  // Validate structure
  if (!parsedResult.summary || !parsedResult.detailedReport || !parsedResult.responsesTable) {
    throw new Error('AI returned incomplete analysis structure');
  }

  return parsedResult;
}
