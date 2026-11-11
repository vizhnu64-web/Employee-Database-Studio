import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'peopledesk_studio_secure_jwt_secret_key_3829104';

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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user: any) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid authentication token.' });
    }
    req.user = user;
    next();
  });
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Role "${req.user?.role || 'anonymous'}" cannot perform this action.`
      });
    }
    next();
  };
}

export { JWT_SECRET };
