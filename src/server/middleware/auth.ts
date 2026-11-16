import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEV_ONLY_JWT_SECRET = 'peopledesk_studio_local_dev_only_jwt_secret_key';

export class AuthConfigError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'AuthConfigError';
    this.statusCode = statusCode;
  }
}

export function isProductionRuntime(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new AuthConfigError(
      'Authentication service is not configured: JWT_SECRET environment variable is required in production.',
      503
    );
  }

  return DEV_ONLY_JWT_SECRET;
}

// Preserved for non-production unit tests importing JWT_SECRET directly
export const JWT_SECRET = process.env.JWT_SECRET?.trim() || (isProductionRuntime() ? '' : DEV_ONLY_JWT_SECRET);

export interface AuthRequest extends Request {
  user?: {
    id: number;
    companyId: number;
    username: string;
    role: string;
    fullName?: string;
    email?: string;
    employeeId?: string | null;
    mustChangePassword?: boolean;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err: any) {
    return res.status(err.statusCode || 503).json({
      success: false,
      error: err.message || 'Authentication service is not configured.'
    });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required.' });
  }

  jwt.verify(token, secret, (err, user: any) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid authentication token.' });
    }
    req.user = user;
    next();
  });
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }
    // Super Admin has universal administrative access
    if (userRole === 'super_admin') {
      return next();
    }
    // Direct match
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    // Company Admin alias
    if (allowedRoles.includes('admin') && (userRole === 'admin' || userRole === 'super_admin')) {
      return next();
    }
    // HR hierarchy match
    if (allowedRoles.includes('hr') && ['hr', 'hr_manager', 'hr_executive', 'admin', 'super_admin'].includes(userRole)) {
      return next();
    }
    // Payroll hierarchy match
    if (allowedRoles.includes('payroll') && ['payroll', 'payroll_manager', 'payroll_executive', 'admin', 'super_admin'].includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Insufficient permissions. Role "${userRole}" cannot perform this action.`
    });
  };
}
