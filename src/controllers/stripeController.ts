import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import {
  createCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
} from '../services/stripeService';

export async function createCheckout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Create Stripe customer if not exists
    if (!user.stripeCustomerId) {
      const customer = await createCustomer(user.email);
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await createCheckoutSession(
      user.stripeCustomerId,
      process.env.STRIPE_PRICE_PRO as string,
      `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      `${frontendUrl}/dashboard`
    );

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

export async function webhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const event = constructWebhookEvent(req.body as Buffer, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { customer: string; subscription: string };
        await User.findOneAndUpdate(
          { stripeCustomerId: session.customer },
          {
            plan: 'pro',
            stripeSubscriptionId: session.subscription,
          }
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as { customer: string };
        await User.findOneAndUpdate(
          { stripeCustomerId: subscription.customer },
          {
            plan: 'free',
            stripeSubscriptionId: undefined,
          }
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

export async function getSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select(
      'plan stripeSubscriptionId analysisCount'
    );
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      plan: user.plan,
      subscriptionId: user.stripeSubscriptionId,
      analysisCount: user.analysisCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function createPortal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user || !user.stripeCustomerId) {
      res.status(400).json({ error: 'No subscription found.' });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await createPortalSession(
      user.stripeCustomerId,
      `${frontendUrl}/dashboard`
    );

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}
