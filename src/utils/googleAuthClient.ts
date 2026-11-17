// Client-side Google Identity Services (GIS) OAuth & In-Memory Token Store
// SECURITY CONTRACT:
// - OAuth access tokens and Google ID tokens live STRICTLY in JS module memory.
// - Tokens are NEVER written to localStorage, sessionStorage, IndexedDB, cookies, or logs.
// - Non-secret workspace links (spreadsheetId, driveRootFolderId) may be stored in localStorage.

export const GOOGLE_BASE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

export const GOOGLE_GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture: string | null;
  sub: string | null;
}

export interface GoogleSessionState {
  isConnected: boolean;
  expired: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  scopes: string[];
  profile: GoogleUserProfile | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
}

export interface WorkspaceLinks {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string | null;
  driveRootFolderId: string | null;
  driveFolderUrl: string | null;
  folderName: string | null;
}

export interface GoogleClientConfig {
  configured: boolean;
  clientId: string | null;
  authModel: 'client_gis_in_memory';
  defaultScopes: string[];
  optionalGmailScope: string;
  requestedScopesMetadata: Array<{
    scope: string;
    key: 'identity' | 'drive' | 'sheets' | 'gmail';
    label: string;
    reason: string;
    verificationNote: string;
    optional: boolean;
    granted: boolean;
  }>;
}

const WORKSPACE_LINKS_KEY = 'eds_workspace_links';

const INITIAL_SESSION: GoogleSessionState = {
  isConnected: false,
  expired: false,
  accessToken: null,
  expiresAt: null,
  scopes: [],
  profile: null,
  connectedAt: null,
  lastVerifiedAt: null,
};

let memorySession: GoogleSessionState = { ...INITIAL_SESSION };
let gisLoadPromise: Promise<void> | null = null;
const listeners = new Set<(state: GoogleSessionState) => void>();
const linkListeners = new Set<(links: WorkspaceLinks) => void>();

function notifySession() {
  const snapshot = getGoogleSession();
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // Ignore subscriber errors
    }
  });
}

function notifyLinks() {
  const snapshot = getWorkspaceLinks();
  linkListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeGoogleSession(listener: (state: GoogleSessionState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeWorkspaceLinks(listener: (links: WorkspaceLinks) => void): () => void {
  linkListeners.add(listener);
  return () => linkListeners.delete(listener);
}

export function getGoogleSession(): GoogleSessionState {
  if (
    memorySession.isConnected &&
    memorySession.expiresAt !== null &&
    Date.now() >= memorySession.expiresAt - 15000
  ) {
    // Access token has expired in memory; preserve profile for clear reconnect prompt without clearing edits
    return {
      ...memorySession,
      isConnected: false,
      expired: true,
      accessToken: null,
    };
  }
  return { ...memorySession, scopes: [...memorySession.scopes] };
}

export function getAccessToken(): string | null {
  const state = getGoogleSession();
  if (!state.isConnected || !state.accessToken) {
    if (state.expired && memorySession.isConnected) {
      markGoogleSessionExpired();
    }
    return null;
  }
  return state.accessToken;
}

export function markGoogleSessionExpired(): void {
  if (!memorySession.isConnected && !memorySession.accessToken && memorySession.expired) {
    return;
  }
  memorySession = {
    ...memorySession,
    isConnected: false,
    expired: Boolean(memorySession.profile || memorySession.connectedAt),
    accessToken: null,
  };
  notifySession();
}

export function hasGoogleScope(keyword: string): boolean {
  const session = getGoogleSession();
  if (!session.isConnected) return false;
  return session.scopes.some((s) => s.toLowerCase().includes(keyword.toLowerCase()));
}

export function getWorkspaceLinks(): WorkspaceLinks {
  const empty: WorkspaceLinks = {
    spreadsheetId: null,
    spreadsheetUrl: null,
    spreadsheetTitle: null,
    driveRootFolderId: null,
    driveFolderUrl: null,
    folderName: null,
  };
  if (typeof localStorage === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(WORKSPACE_LINKS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      spreadsheetId: parsed?.spreadsheetId ? String(parsed.spreadsheetId) : null,
      spreadsheetUrl: parsed?.spreadsheetUrl ? String(parsed.spreadsheetUrl) : null,
      spreadsheetTitle: parsed?.spreadsheetTitle ? String(parsed.spreadsheetTitle) : null,
      driveRootFolderId: parsed?.driveRootFolderId ? String(parsed.driveRootFolderId) : null,
      driveFolderUrl: parsed?.driveFolderUrl ? String(parsed.driveFolderUrl) : null,
      folderName: parsed?.folderName ? String(parsed.folderName) : null,
    };
  } catch {
    return empty;
  }
}

export function setWorkspaceLinks(patch: Partial<WorkspaceLinks>): WorkspaceLinks {
  const next: WorkspaceLinks = {
    ...getWorkspaceLinks(),
    ...patch,
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WORKSPACE_LINKS_KEY, JSON.stringify(next));
  }
  notifyLinks();
  return next;
}

export function clearWorkspaceLinks(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(WORKSPACE_LINKS_KEY);
  }
  notifyLinks();
}

export function buildGisScopeList(options?: {
  includeGmail?: boolean;
  existingScopes?: string[];
}): string {
  const set = new Set<string>(GOOGLE_BASE_SCOPES);
  if (Array.isArray(options?.existingScopes)) {
    options.existingScopes.forEach((s) => {
      if (s && s.trim()) set.add(s.trim());
    });
  }
  if (options?.includeGmail) {
    set.add(GOOGLE_GMAIL_SCOPE);
  }
  return Array.from(set).join(' ');
}

export async function fetchGoogleClientConfig(apiBaseUrl = '/api'): Promise<GoogleClientConfig> {
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  const viteClientId =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
      ? String((import.meta as any).env.VITE_GOOGLE_CLIENT_ID).trim()
      : '';

  try {
    const res = await fetch(`${cleanBase}/google/config`);
    if (res.ok) {
      const data = await res.json();
      const resolvedId = data?.clientId || viteClientId || null;
      return {
        configured: Boolean(resolvedId),
        clientId: resolvedId,
        authModel: 'client_gis_in_memory',
        defaultScopes: Array.isArray(data?.defaultScopes)
          ? data.defaultScopes
          : [...GOOGLE_BASE_SCOPES],
        optionalGmailScope: data?.optionalGmailScope || GOOGLE_GMAIL_SCOPE,
        requestedScopesMetadata: Array.isArray(data?.requestedScopesMetadata)
          ? data.requestedScopesMetadata
          : [],
      };
    }
  } catch {
    // Fall back cleanly to Vite env variable if server config fetch fails
  }

  return {
    configured: Boolean(viteClientId),
    clientId: viteClientId || null,
    authModel: 'client_gis_in_memory',
    defaultScopes: [...GOOGLE_BASE_SCOPES],
    optionalGmailScope: GOOGLE_GMAIL_SCOPE,
    requestedScopesMetadata: [],
  };
}

export async function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Google Identity Services requires a browser environment.');
  }
  const win = window as any;
  if (win.google?.accounts?.oauth2) {
    return;
  }
  if (gisLoadPromise) {
    return gisLoadPromise;
  }

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Identity Services client script.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
      } else {
        gisLoadPromise = null;
        reject(new Error('Google Identity Services loaded, but oauth2 API is unavailable.'));
      }
    };
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Network error loading Google Identity Services (https://accounts.google.com/gsi/client).'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function verifyAndActivateToken(
  accessToken: string,
  expiresInSeconds: number,
  fallbackScopes: string[],
  apiBaseUrl = '/api'
): Promise<GoogleSessionState> {
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  const nowMs = Date.now();
  const expiresAt = nowMs + Math.max(60, expiresInSeconds || 3600) * 1000;

  let profile: GoogleUserProfile | null = memorySession.profile;
  let scopes = [...fallbackScopes];
  let verifiedAt = new Date(nowMs).toISOString();

  const verifyRes = await fetch(`${cleanBase}/google/verify-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyData?.success) {
    throw new Error(verifyData?.error || 'Failed to verify Google OAuth session.');
  }

  if (verifyData.profile?.email) {
    profile = {
      email: String(verifyData.profile.email),
      name: String(verifyData.profile.name || verifyData.profile.email.split('@')[0]),
      picture: verifyData.profile.picture ? String(verifyData.profile.picture) : null,
      sub: verifyData.profile.sub ? String(verifyData.profile.sub) : null,
    };
  }
  if (Array.isArray(verifyData.scopes) && verifyData.scopes.length > 0) {
    scopes = verifyData.scopes;
  }
  if (verifyData.verifiedAt) {
    verifiedAt = String(verifyData.verifiedAt);
  }

  memorySession = {
    isConnected: true,
    expired: false,
    accessToken,
    expiresAt: verifyData.expiresIn ? nowMs + Number(verifyData.expiresIn) * 1000 : expiresAt,
    scopes,
    profile,
    connectedAt: memorySession.connectedAt || verifiedAt,
    lastVerifiedAt: verifiedAt,
  };
  notifySession();
  return getGoogleSession();
}

export async function signInWithGoogle(options?: {
  includeGmail?: boolean;
  prompt?: '' | 'consent' | 'select_account';
  apiBaseUrl?: string;
}): Promise<GoogleSessionState> {
  const apiBase = options?.apiBaseUrl || '/api';
  const cfg = await fetchGoogleClientConfig(apiBase);
  if (!cfg.configured || !cfg.clientId) {
    throw new Error(
      'Google Sign-In requires VITE_GOOGLE_CLIENT_ID (or GOOGLE_CLIENT_ID) to be configured.'
    );
  }

  await loadGisScript();
  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2?.initTokenClient) {
    throw new Error('Google Identity Services OAuth2 client is not ready.');
  }

  const requestedScope = buildGisScopeList({
    includeGmail: Boolean(options?.includeGmail),
    existingScopes: memorySession.scopes,
  });

  return await new Promise<GoogleSessionState>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: requestedScope,
      include_granted_scopes: true,
      prompt: options?.prompt ?? 'select_account',
      callback: async (resp: any) => {
        if (!resp || resp.error) {
          reject(
            new Error(
              resp?.error_description ||
                (resp?.error === 'access_denied'
                  ? 'Google permission was cancelled or denied by the user.'
                  : resp?.error || 'Google authorization failed.')
            )
          );
          return;
        }
        try {
          const grantedList = String(resp.scope || requestedScope)
            .split(/[\s,]+/)
            .filter(Boolean);
          const session = await verifyAndActivateToken(
            resp.access_token,
            Number(resp.expires_in || 3600),
            grantedList,
            apiBase
          );
          resolve(session);
        } catch (err) {
          reject(err);
        }
      },
      error_callback: (err: any) => {
        reject(
          new Error(
            err?.message ||
              'Google Sign-In popup could not open or was closed before completing authorization.'
          )
        );
      },
    });

    tokenClient.requestAccessToken({
      prompt: options?.prompt ?? (memorySession.isConnected ? 'consent' : 'select_account'),
    });
  });
}

export async function requestGmailConsent(apiBaseUrl = '/api'): Promise<GoogleSessionState> {
  return await signInWithGoogle({
    includeGmail: true,
    prompt: 'consent',
    apiBaseUrl,
  });
}

export async function signOutGoogle(apiBaseUrl = '/api'): Promise<void> {
  const token = memorySession.accessToken;
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');

  if (token) {
    try {
      await fetch(`${cleanBase}/google/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
    } catch {
      // Best-effort revocation
    }

    try {
      const oauth2 = (window as any).google?.accounts?.oauth2;
      if (oauth2?.revoke) {
        oauth2.revoke(token, () => {});
      }
    } catch {
      // Ignore GIS revoke errors
    }
  }

  memorySession = { ...INITIAL_SESSION };
  notifySession();
}
