import { Request, Response, NextFunction } from 'express';

export interface GoogleAuthRequest extends Request {
  googleAccessToken?: string;
  spreadsheetId?: string;
  driveRootFolderId?: string;
  googleEmail?: string;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

export function attachOptionalGoogleContext(
  req: GoogleAuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (token) {
    req.googleAccessToken = token;
  }

  const headerSheetId = req.headers['x-spreadsheet-id'];
  const sheetIdCandidate =
    typeof headerSheetId === 'string' && headerSheetId.trim()
      ? headerSheetId.trim()
      : typeof req.query?.spreadsheetId === 'string' && req.query.spreadsheetId.trim()
        ? req.query.spreadsheetId.trim()
        : typeof req.body?.spreadsheetId === 'string' && req.body.spreadsheetId.trim()
          ? req.body.spreadsheetId.trim()
          : undefined;
  if (sheetIdCandidate) {
    req.spreadsheetId = sheetIdCandidate;
  }

  const headerFolderId = req.headers['x-drive-folder-id'];
  const folderIdCandidate =
    typeof headerFolderId === 'string' && headerFolderId.trim()
      ? headerFolderId.trim()
      : typeof req.query?.driveRootFolderId === 'string' && req.query.driveRootFolderId.trim()
        ? req.query.driveRootFolderId.trim()
        : typeof req.body?.driveRootFolderId === 'string' && req.body.driveRootFolderId.trim()
          ? req.body.driveRootFolderId.trim()
          : undefined;
  if (folderIdCandidate) {
    req.driveRootFolderId = folderIdCandidate;
  }

  const headerEmail = req.headers['x-google-email'];
  if (typeof headerEmail === 'string' && headerEmail.trim()) {
    req.googleEmail = headerEmail.trim();
  }

  next();
}

export function requireGoogleAccessToken(
  req: GoogleAuthRequest,
  res: Response,
  next: NextFunction
): void {
  attachOptionalGoogleContext(req, res, () => {
    if (!req.googleAccessToken) {
      res.status(401).json({
        success: false,
        code: 'GOOGLE_AUTH_REQUIRED',
        error:
          'Google Sign-In is required or your OAuth session expired. Please sign in with Google to continue — your local edits are preserved.',
      });
      return;
    }
    next();
  });
}
