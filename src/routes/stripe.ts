import { Router } from 'express';
import express from 'express';
import {
  createCheckout,
  webhook,
  getSubscription,
  createPortal,
} from '../controllers/stripeController';
import authMiddleware from '../middleware/auth';

const router = Router();

// Webhook must use raw body parser (not JSON)
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

// Protected routes
router.post('/create-checkout', authMiddleware, createCheckout);
router.get('/subscription', authMiddleware, getSubscription);
router.post('/portal', authMiddleware, createPortal);

export default router;
