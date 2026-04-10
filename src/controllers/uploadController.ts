import { Response, NextFunction } from 'express';
import fs from 'fs';
import csvParser from 'csv-parser';
import Upload from '../models/Upload';
import { AuthRequest } from '../middleware/auth';

export async function uploadCsv(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const results: Record<string, unknown>[] = [];
    const columns: string[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(req.file!.path)
        .pipe(csvParser())
        .on('headers', (headers: string[]) => {
          columns.push(...headers);
        })
        .on('data', (data: Record<string, unknown>) => {
          results.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const upload = await Upload.create({
      userId: req.user!.userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      rowCount: results.length,
      columnNames: columns,
    });

    // Clean up uploaded file after parsing
    fs.unlink(req.file.path, () => {});

    res.status(201).json({
      upload: {
        _id: upload._id,
        originalName: upload.originalName,
        rowCount: upload.rowCount,
        columnNames: upload.columnNames,
      },
      data: results,
      columns,
    });
  } catch (err) {
    // Clean up file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(err);
  }
}

export async function getUploads(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const uploads = await Upload.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .select('-filename');

    res.json({ uploads });
  } catch (err) {
    next(err);
  }
}
