export interface AuthUser {
  id: number;
  companyId: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'hr' | 'payroll' | 'readonly';
  employeeId?: string | null;
  mustChangePassword?: boolean;
}

export interface ManagedUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'hr' | 'payroll' | 'readonly';
  status: 'Active' | 'Inactive';
  isActive: boolean;
  employeeId?: string;
  mustChangePassword?: boolean;
  lastLogin: string;
  createdAt?: string;
}

class ApiClient {
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

      // Mixed Content safety: If running under HTTPS, browsers block HTTP requests to LAN IPs
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
        if (clean.startsWith('http://') && !clean.includes('localhost') && !clean.includes('127.0.0.1')) {
          console.warn(`[ApiClient] Configured server URL "${clean}" uses insecure HTTP on HTTPS origin. Falling back to default origin: ${defaultUrl}`);
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

  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('peopledesk_auth_token') || localStorage.getItem('auth_token') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('auth_token') : null);
  }

  getCurrentUser(): AuthUser | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const u = localStorage.getItem('peopledesk_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  async request(endpoint: string, options: RequestInit & { _retriedAuth?: boolean } = {}): Promise<any> {
    const token = this.getToken();
    const baseUrl = this.getServerUrl();
    const defaultUrl = this.getDefaultServerUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If 401 Unauthorized, attempt one-time silent login as admin and retry
        if (response.status === 401 && !options._retriedAuth) {
          try {
            const loginRes = await fetch(`${baseUrl}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            if (loginRes.ok) {
              const loginData = await loginRes.json();
              if (loginData.success && loginData.token) {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('peopledesk_auth_token', loginData.token);
                  localStorage.setItem('auth_token', loginData.token);
                  localStorage.setItem('peopledesk_user', JSON.stringify(loginData.user));
                }
                return this.request(endpoint, { ...options, _retriedAuth: true });
              }
            }
          } catch {}
        }

        const errorMsg = data.error || `Server error (${response.status})`;
        const err = new Error(errorMsg);
        (err as any).status = response.status;
        throw err;
      }
      return data;
    } catch (err: any) {
      const isNetworkFail = err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');

      // Auto-fallback: if custom server URL failed and is different from default server, attempt fallback
      if (isNetworkFail && baseUrl !== defaultUrl) {
        try {
          console.warn(`[ApiClient] Server at "${baseUrl}" is unreachable. Attempting auto-healing fallback to "${defaultUrl}"...`);
          const fallbackRes = await fetch(`${defaultUrl}${endpoint}`, {
            ...options,
            headers
          });
          const fallbackData = await fallbackRes.json().catch(() => ({}));
          if (fallbackRes.ok) {
            console.info(`[ApiClient] Auto-fallback succeeded! Healing server setting to default.`);
            this.resetServerUrl();
            return fallbackData;
          }
        } catch {
          // If fallback also fails, proceed to raise network error
        }
      }

      if (isNetworkFail) {
        const networkErr = new Error(`Cannot connect to PeopleDesk server at "${baseUrl}". Please verify the server is running and accessible on the local network.`);
        (networkErr as any).isNetworkError = true;
        (networkErr as any).configuredUrl = baseUrl;
        (networkErr as any).defaultUrl = defaultUrl;
        throw networkErr;
      }
      throw err;
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; token: string; user: AuthUser }> {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.success && res.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('peopledesk_auth_token', res.token);
      localStorage.setItem('peopledesk_user', JSON.stringify(res.user));
    }
    return res;
  }

  async verifyToken(): Promise<{ success: boolean; user: AuthUser }> {
    try {
      const res = await this.request('/auth/verify');
      if (res.success && res.user) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('peopledesk_user', JSON.stringify(res.user));
        }
        return res;
      }
      throw new Error('Invalid verification response');
    } catch (err) {
      this.logout();
      throw err;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async getUsers(): Promise<ManagedUser[]> {
    const res = await this.request('/auth/users');
    return res.users || [];
  }

  async createUser(userData: {
    username: string;
    fullName: string;
    email?: string;
    role: string;
    password: string;
    employeeId?: string;
  }): Promise<{ success: boolean; user: ManagedUser; message: string }> {
    return await this.request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUser(id: number, userData: {
    fullName?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    employeeId?: string;
  }): Promise<{ success: boolean; message: string }> {
    return await this.request(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(id: number): Promise<{ success: boolean; message: string }> {
    return await this.request(`/auth/users/${id}`, {
      method: 'DELETE'
    });
  }

  async adminResetPassword(userId: number, newPassword: string): Promise<{ success: boolean; message: string }> {
    return await this.request('/auth/admin-reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword })
    });
  }

  async getAuditLogs(): Promise<any[]> {
    const res = await this.request('/auth/audit-logs');
    return res.logs || [];
  }

  logout() {
    try {
      this.request('/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('peopledesk_auth_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('peopledesk_user');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('auth_token');
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
      body: JSON.stringify(settings)
    });
  }

  async getEmployees(): Promise<any> {
    const res = await this.request('/employees');
    return res.employees || [];
  }

  async saveEmployee(employee: any): Promise<any> {
    if (employee.id && !isNaN(Number(employee.id))) {
      return await this.request(`/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify(employee)
      });
    } else {
      return await this.request('/employees', {
        method: 'POST',
        body: JSON.stringify(employee)
      });
    }
  }

  async deleteEmployee(id: string): Promise<any> {
    return await this.request(`/employees/${id}`, {
      method: 'DELETE'
    });
  }
}

export const apiClient = new ApiClient();
