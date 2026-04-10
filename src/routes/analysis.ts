import { Router } from 'express';
import {
  analyzeData,
  getAnalyses,
  getAnalysis,
  exportAnalysisPDF,
  modifyAnalysis,
} from '../controllers/analysisController';
import authMiddleware from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, analyzeData);
router.get('/', authMiddleware, getAnalyses);
router.get('/:id', authMiddleware, getAnalysis);
router.put('/:id', authMiddleware, modifyAnalysis);
router.get('/:id/export', authMiddleware, exportAnalysisPDF);

export default router;
