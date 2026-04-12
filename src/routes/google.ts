import { Router } from 'express';
import {
  getAuthUrl,
  handleCallback,
  listForms,
  analyzeForm,
  disconnectGoogle,
  handleWebhook,
} from '../controllers/googleController';
import authMiddleware from '../middleware/auth';

const router = Router();

router.get('/auth-url', authMiddleware, getAuthUrl);
router.post('/callback', authMiddleware, handleCallback);
router.get('/forms', authMiddleware, listForms);
router.post('/analyze', authMiddleware, analyzeForm);
router.post('/disconnect', authMiddleware, disconnectGoogle);
router.post('/webhook/:userId/:formId', handleWebhook);

export default router;
