import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import {
  requireGoogleAccessToken,
  GoogleAuthRequest,
  extractBearerToken,
} from '../middleware/googleAuth';

const router = Router();

export const GOOGLE_OAUTH_SCOPES = {
  identity: ['openid', 'email', 'profile'],
  drive: 'https://www.googleapis.com/auth/drive.file',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
  gmail: 'https://www.googleapis.com/auth/gmail.send',
} as const;

export interface RequestedScopeDetail {
  scope: string;
  key: 'identity' | 'drive' | 'sheets' | 'gmail';
  label: string;
  reason: string;
  verificationNote: string;
  optional: boolean;
  granted: boolean;
}

export function getPublicGoogleClientId(): string {
  return String(
    process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
  ).trim();
}

export function buildGoogleOAuthScopes(options?: {
  includeGmail?: boolean;
  gmailOnly?: boolean;
}): string[] {
  const scopes = new Set<string>(GOOGLE_OAUTH_SCOPES.identity);
  if (options?.gmailOnly) {
    scopes.add(GOOGLE_OAUTH_SCOPES.gmail);
    return Array.from(scopes);
  }
  scopes.add(GOOGLE_OAUTH_SCOPES.drive);
  scopes.add(GOOGLE_OAUTH_SCOPES.sheets);
  if (options?.includeGmail) {
    scopes.add(GOOGLE_OAUTH_SCOPES.gmail);
  }
  return Array.from(scopes);
}

export function buildRequestedScopeMetadata(grantedScopes: string[]): RequestedScopeDetail[] {
  const lower = grantedScopes.map((s) => s.toLowerCase());
  const has = (kw: string) => lower.some((s) => s.includes(kw));

  return [
    {
      scope: 'openid email profile',
      key: 'identity',
      label: 'Google Profile & Email Identity',
      reason: 'Displays your signed-in HR Google account name, email address, and profile photo inside Employee Database Studio.',
      verificationNote: 'Standard OpenID Connect identity scopes via Google Identity Services.',
      optional: false,
      granted: has('email') || has('openid') || has('userinfo.email') || lower.length > 0,
    },
    {
      scope: GOOGLE_OAUTH_SCOPES.drive,
      key: 'drive',
      label: 'Private App & Selected Drive Folders (drive.file)',
      reason: 'Stores employee documents, payslip PDFs, company logos, and backups strictly in the HR-linked or app-created Drive folder.',
      verificationNote: 'Non-sensitive per-file Drive scope; never reads unrelated personal Drive files.',
      optional: false,
      granted: has('drive.file') || has('https://www.googleapis.com/auth/drive'),
    },
    {
      scope: GOOGLE_OAUTH_SCOPES.sheets,
      key: 'sheets',
      label: 'Google Sheets Structured HR Database (spreadsheets)',
      reason: 'Reads and updates the 10 structured HR worksheets inside your connected Employee Database Studio spreadsheet.',
      verificationNote: 'Sensitive Google Sheets scope; consent granted explicitly by the HR user in Google Identity Services.',
      optional: false,
      granted: has('spreadsheets'),
    },
    {
      scope: GOOGLE_OAUTH_SCOPES.gmail,
      key: 'gmail',
      label: 'HR Gmail Dispatch (gmail.send — Incremental Opt-in)',
      reason: 'Allows HR to send individual employee payslip emails from their own Gmail mailbox as an alternative to Company SMTP.',
      verificationNote: 'Requested incrementally only when HR enables Gmail payslip delivery. Company SMTP works independently without this scope.',
      optional: true,
      granted: has('gmail.send') || has('https://mail.google.com'),
    },
  ];
}

// GET /api/google/config - Public Google Identity Services Client ID & scope metadata (NEVER returns secrets)
router.get('/config', (_req: Request, res: Response) => {
  const clientId = getPublicGoogleClientId();
  res.json({
    success: true,
    configured: Boolean(clientId),
    clientId: clientId || null,
    authModel: 'client_gis_in_memory',
    defaultScopes: buildGoogleOAuthScopes(),
    optionalGmailScope: GOOGLE_OAUTH_SCOPES.gmail,
    requestedScopesMetadata: buildRequestedScopeMetadata([]),
  });
});

// POST /api/google/verify-session - Validate an in-memory GIS OAuth access token & optional Google ID token
router.post('/verify-session', async (req: Request, res: Response) => {
  try {
    const bearer = extractBearerToken(req);
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';

    if (!bearer && !idToken) {
      return res.status(401).json({
        success: false,
        error: 'Provide a Bearer Google OAuth access token or Google ID token to verify session.',
      });
    }

    const configuredClientId = getPublicGoogleClientId();
    let verifiedProfile: { email: string; name: string; picture: string | null; sub: string | null } | null = null;
    let grantedScopes: string[] = [];
    let expiresIn: number | null = null;

    if (idToken) {
      const idRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      const idInfo: any = await idRes.json();
      if (!idRes.ok || !idInfo.email) {
        return res.status(401).json({
          success: false,
          error: idInfo?.error_description || 'Invalid or expired Google ID token.',
        });
      }
      if (configuredClientId && idInfo.aud && idInfo.aud !== configuredClientId) {
        return res.status(401).json({
          success: false,
          error: 'Google ID token audience does not match this application Client ID.',
        });
      }
      verifiedProfile = {
        email: String(idInfo.email),
        name: String(idInfo.name || idInfo.email.split('@')[0]),
        picture: idInfo.picture ? String(idInfo.picture) : null,
        sub: idInfo.sub ? String(idInfo.sub) : null,
      };
    }

    if (bearer) {
      const [tokenInfoRes, userInfoRes] = await Promise.all([
        fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(bearer)}`),
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${bearer}` },
        }),
      ]);

      const tokenInfo: any = await tokenInfoRes.json().catch(() => ({}));
      if (!tokenInfoRes.ok || tokenInfo.error) {
        return res.status(401).json({
          success: false,
          code: 'GOOGLE_TOKEN_EXPIRED',
          error: tokenInfo?.error_description || 'Google OAuth access token is invalid or expired.',
        });
      }

      if (configuredClientId && tokenInfo.aud && tokenInfo.aud !== configuredClientId) {
        return res.status(401).json({
          success: false,
          error: 'Google OAuth token audience does not match configured Client ID.',
        });
      }

      grantedScopes = String(tokenInfo.scope || '')
        .split(/[\s,]+/)
        .filter(Boolean);
      expiresIn = tokenInfo.expires_in ? Number(tokenInfo.expires_in) : null;

      if (userInfoRes.ok) {
        const ui: any = await userInfoRes.json();
        if (ui?.email) {
          verifiedProfile = {
            email: String(ui.email),
            name: String(ui.name || verifiedProfile?.name || ui.email.split('@')[0]),
            picture: ui.picture ? String(ui.picture) : verifiedProfile?.picture || null,
            sub: ui.sub ? String(ui.sub) : verifiedProfile?.sub || null,
          };
        }
      }
    }

    const requestedScopesMetadata = buildRequestedScopeMetadata(grantedScopes);
    res.json({
      success: true,
      profile: verifiedProfile,
      scopes: grantedScopes,
      expiresIn,
      requestedScopesMetadata,
      permissionSummary: {
        identity: requestedScopesMetadata.find((s) => s.key === 'identity')?.granted ?? Boolean(verifiedProfile),
        drive: requestedScopesMetadata.find((s) => s.key === 'drive')?.granted ?? false,
        sheets: requestedScopesMetadata.find((s) => s.key === 'sheets')?.granted ?? false,
        gmail: requestedScopesMetadata.find((s) => s.key === 'gmail')?.granted ?? false,
      },
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to verify Google session.',
    });
  }
});

// POST /api/google/test - Verify live Google API connectivity using client-supplied Bearer access token
router.post('/test', requireGoogleAccessToken, async (req: GoogleAuthRequest, res: Response) => {
  try {
    const scopeCheck = String(req.body?.scopeCheck || 'all').toLowerCase();
    const token = req.googleAccessToken!;

    const [tokenInfoRes, driveAbout] = await Promise.all([
      fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`),
      (async () => {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });
        const drive = google.drive({ version: 'v3', auth });
        return drive.about.get({ fields: 'user(emailAddress,displayName,photoLink)' });
      })(),
    ]);

    const tokenInfo: any = await tokenInfoRes.json().catch(() => ({}));
    const granted = String(tokenInfo.scope || '').toLowerCase();
    const driveReady = granted.includes('drive');
    const sheetsReady = granted.includes('spreadsheets');
    const gmailReady = granted.includes('gmail.send') || granted.includes('mail.google');

    if (scopeCheck === 'gmail' && !gmailReady) {
      return res.status(403).json({
        success: false,
        error: 'Google account is connected, but Gmail Send permission (gmail.send) has not been granted yet. Enable Gmail Permission incrementally first.',
      });
    }
    if (scopeCheck === 'sheets' && !sheetsReady) {
      return res.status(403).json({
        success: false,
        error: 'Google Sheets permission (spreadsheets) has not been granted. Please Reconnect Google Workspace permissions.',
      });
    }

    const email = driveAbout.data.user?.emailAddress || tokenInfo.email || '';
    res.json({
      success: true,
      message: `Verified live Google API connectivity for ${email || 'signed-in user'}.`,
      email,
      displayName: driveAbout.data.user?.displayName || null,
      picture: driveAbout.data.user?.photoLink || null,
      identityReady: true,
      driveReady,
      sheetsReady,
      gmailReady,
      scopes: String(tokenInfo.scope || '').split(/[\s,]+/).filter(Boolean),
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err?.code || err?.response?.status || err?.statusCode || 500;
    res.status(status).json({
      success: false,
      error:
        status === 401
          ? 'Google OAuth access token expired or revoked. Please sign in with Google again.'
          : err?.message || 'Google API verification failed.',
    });
  }
});

// POST /api/google/revoke - Revoke a Bearer OAuth access token cleanly on Disconnect
router.post('/revoke', async (req: Request, res: Response) => {
  const token = extractBearerToken(req) || (typeof req.body?.token === 'string' ? req.body.token.trim() : '');
  if (token) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    }).catch(() => {});
  }
  res.json({
    success: true,
    message: 'Google OAuth session cleared from application memory and token revocation requested.',
  });
});

export default router;
