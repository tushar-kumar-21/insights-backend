import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadCsv, getUploads } from '../controllers/uploadController';
import authMiddleware from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  },
});

const router = Router();

router.post('/', authMiddleware, upload.single('file'), uploadCsv);
router.get('/', authMiddleware, getUploads);

export default router;
