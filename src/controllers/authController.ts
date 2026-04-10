import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });
}

export async function signup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (password.length < 6) {
      res
        .status(400)
        .json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Email already registered.' });
      return;
    }

    const user = await User.create({ email, password, name: name || '' });
    const token = generateToken(user._id.toString(), user.email);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        analysisCount: user.analysisCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user._id.toString(), user.email);

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        analysisCount: user.analysisCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        analysisCount: user.analysisCount,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      },
    });
  } catch (err) {
    next(err);
  }
}
