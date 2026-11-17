import {
  getAccessToken,
  getWorkspaceLinks,
  markGoogleSessionExpired,
} from './googleAuthClient';

export interface WorkspaceUser {
  id: number;
  companyId: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'hr' | 'payroll' | 'readonly';
}

class ApiClient {
  private unauthorizedListeners = new Set<() => void>();

  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  private notifyUnauthorized() {
    markGoogleSessionExpired();
    this.unauthorizedListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore listener errors
      }
    });
  }

  getDefaultServerUrl(): string {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/api`;
    }
    return 'http://localhost:3000/api';
  }

  getServerUrl(): string {
    const defaultUrl = this.getDefaultServerUrl();
    if (typeof localStorage === 'undefined') return defaultUrl;

    const configured = localStorage.getItem('peopledesk_server_url');
    if (configured && configured.trim()) {
      const clean = configured.trim().replace(/\/+$/, '');
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
        if (clean.startsWith('http://') && !clean.includes('localhost') && !clean.includes('127.0.0.1')) {
          return defaultUrl;
        }
      }
      return clean;
    }
    return defaultUrl;
  }

  resetServerUrl(): string {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('peopledesk_server_url');
      localStorage.removeItem('peopledesk_server_ip');
      localStorage.removeItem('peopledesk_server_port');
    }
    return this.getDefaultServerUrl();
  }

  setServerUrl(url: string) {
    const clean = url.trim().replace(/\/+$/, '');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('peopledesk_server_url', clean);
    }
  }

  // Strictly returns the short-lived in-memory Google OAuth access token.
  // Never reads from localStorage, sessionStorage, or IndexedDB.
  getToken(): string | null {
    return getAccessToken();
  }

  getWorkspaceHeaders(includeContentType = false): Record<string, string> {
    const headers: Record<string, string> = includeContentType
      ? { 'Content-Type': 'application/json' }
      : {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const links = getWorkspaceLinks();
    if (links.spreadsheetId) {
      headers['X-Spreadsheet-Id'] = links.spreadsheetId;
    }
    if (links.driveRootFolderId) {
      headers['X-Drive-Folder-Id'] = links.driveRootFolderId;
    }
    return headers;
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const baseUrl = this.getServerUrl();
    const defaultUrl = this.getDefaultServerUrl();
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: Record<string, string> = {
      ...this.getWorkspaceHeaders(!isFormData),
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && data?.code === 'GOOGLE_TOKEN_EXPIRED') {
          this.notifyUnauthorized();
        }

        const errorMsg = data.error || `Server error (${response.status})`;
        const err = new Error(errorMsg);
        (err as any).status = response.status;
        (err as any).code = data?.code;
        throw err;
      }
      return data;
    } catch (err: any) {
      const isNetworkFail =
        err.name === 'TypeError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError');

      if (isNetworkFail && baseUrl !== defaultUrl) {
        try {
          const fallbackRes = await fetch(`${defaultUrl}${endpoint}`, {
            ...options,
            headers,
          });
          const fallbackData = await fallbackRes.json().catch(() => ({}));
          if (fallbackRes.ok) {
            this.resetServerUrl();
            return fallbackData;
          }
        } catch {
          // Proceed to network error below
        }
      }

      if (isNetworkFail) {
        const networkErr = new Error(
          `Cannot connect to Employee Database Studio server at "${baseUrl}". Please verify the server is running.`
        );
        (networkErr as any).isNetworkError = true;
        (networkErr as any).configuredUrl = baseUrl;
        (networkErr as any).defaultUrl = defaultUrl;
        throw networkErr;
      }
      throw err;
    }
  }

  async getHealth(): Promise<any> {
    return await this.request('/health');
  }

  async getSettings(): Promise<any> {
    return await this.request('/settings');
  }

  async saveSettings(settings: any): Promise<any> {
    return await this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getLayoutSettings(): Promise<any> {
    return await this.request('/settings/layout');
  }

  async saveLayoutSettings(layoutSettings: any): Promise<any> {
    return await this.request('/settings/layout', {
      method: 'PUT',
      body: JSON.stringify({ layoutSettings }),
    });
  }

  async getEmployees(): Promise<any> {
    const res = await this.request('/employees');
    return res.employees || [];
  }

  async saveEmployee(employee: any): Promise<any> {
    return await this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
  }

  async deleteEmployee(id: string): Promise<any> {
    return await this.request(`/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
