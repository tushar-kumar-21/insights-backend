import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-lite-preview',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

export interface AnalysisResult {
  summary: string;
  detailedReport: string;
  responsesTable: string;
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

  const prompt = `You are an expert Google Forms Response Analyst and Professional Report Writer.

I have uploaded/submitted a CSV file containing all the Google Forms responses.

CSV DATA:
Columns: ${columns.join(', ')}
${formattedData}

${customPrompt ? `USER CUSTOM INSTRUCTIONS:
${customPrompt}

Please strictly follow the above instructions while analyzing the data.` : ''}

Please analyze the complete CSV and create a professional, well-structured output.

────────────────────────────
1. SUMMARIZED LIST OF ALL RESPONSES (responsesTable)
────────────────────────────
- Create a professionally formatted Markdown TABLE.
- Columns should be: "Response #", "Summary of Answer", "Notable/Standout Info".
- Summarize EVERY individual response clearly and concisely in the table.
- Do not copy raw CSV text. Make it human-friendly and easy to read.

────────────────────────────
2. DETAILED ANALYTICAL REPORT (detailedReport)
────────────────────────────
Create a comprehensive, professional Markdown report with the following sub-sections:

• Overview
  - Total number of responses
  - Date range of responses (if timestamp column exists)
  - Any demographic summary (age, gender, location, etc. if available)

• Key Insights & Trends
  - Major patterns and common themes across all responses
  - Most frequent answers for each question

• Question-wise Summary
  - Summarize responses for every question clearly (use tables where helpful)

• Notable Findings
  - Outliers, unique opinions, or surprising answers
  - Any correlations you notice between questions

• Actionable Recommendations
  - Practical suggestions based on the data (what the results imply and what should be done next)

Use proper markdown formatting (headings, bullet points, tables, bold text) to make everything clean and professional. 
Keep the language clear, objective, and easy to understand. 

Output MUST be valid JSON with this exact structure:
{
  "summary": "A short 1-2 sentence summary of the report to be used in a sidebar history list.",
  "detailedReport": "The COMPLETE professional markdown report containing the Detailed Analytical Report (Overview, Key Insights, etc) with proper markdown formatting.",
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
