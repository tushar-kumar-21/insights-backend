import PDFDocument from 'pdfkit';
import { Response } from 'express';

export function generateAnalysisPDF(
  res: Response,
  analysis: any, // Mongoose document of type IAnalysis
  filename: string
): void {
  const doc = new PDFDocument({ margin: 50 });

  // Stream to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Premium-Report-${filename.replace(/\s+/g, '_')}.pdf`
  );

  doc.pipe(res);

  // Header
  doc
    .fontSize(24)
    .fillColor('#3b82f6')
    .text('Analysis Report', { align: 'center' });
  doc
    .fontSize(12)
    .fillColor('#6b7280')
    .text('AI Form Insights', { align: 'center' });
  doc.moveDown(2);

  // Title
  doc
    .fontSize(18)
    .fillColor('#111827')
    .text(`Report: ${analysis.uploadId.originalName}`, { underline: true });
  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .text(`Generated on: ${new Date(analysis.createdAt).toLocaleString()}`);
  doc
    .fontSize(10)
    .text(`Responses Analyzed: ${analysis.uploadId.rowCount}`);
  doc.moveDown(2);

  // Render simple raw markdown text for now, as formatting requires a full HTML/Markdown to PDF parser
  const reportText = analysis.markdownReport 
    ? analysis.markdownReport 
    : `${analysis.detailedReport || ""}\n\n---\n\n${analysis.responsesTable || ""}`;

  doc.fontSize(10).fillColor('#374151').text(reportText || "Report data missing", {
    align: 'left',
    lineGap: 2,
  });

  // Footer
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#9ca3af')
      .text(
        `Page ${i + 1} of ${range.count} - Report`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
  }

  doc.end();
}
