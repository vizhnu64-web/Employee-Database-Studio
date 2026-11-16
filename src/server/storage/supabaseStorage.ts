import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKETS = {
  EMPLOYEE_DOCUMENTS: 'employee-documents',
  COMPANY_ASSETS: 'company-assets',
  PAYSLIP_PDFS: 'payslip-pdfs',
  IMPORT_FILES: 'import-files'
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export interface StorageConfigurationStatus {
  configured: boolean;
  supabaseUrl: string | null;
  error: string | null;
}

export class StorageServiceError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'StorageServiceError';
    this.statusCode = statusCode;
  }
}

function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private isClientInitialized = false;
  private configuredUrl = '';
  private configError: string | null = null;
  private lastEnvSignature: string | null = null;
  private readonly hasCustomClient: boolean;

  constructor(customClient?: SupabaseClient | null, customUrl?: string) {
    if (customClient !== undefined) {
      this.hasCustomClient = true;
      this.client = customClient;
      this.isClientInitialized = Boolean(customClient);
      this.configuredUrl = sanitizeEnvValue(customUrl);
      this.configError = customClient
        ? null
        : 'Supabase Storage service is unavailable. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.';
    } else {
      this.hasCustomClient = false;
      // Defer client initialization until first storage operation or configuration check (zero work/I/O on import)
    }
  }

  private readEnvConfig(): {
    supabaseUrl: string;
    supabaseKey: string;
    signature: string;
    configError: string | null;
  } {
    const supabaseUrl = sanitizeEnvValue(process.env.SUPABASE_URL);
    const supabaseKey =
      sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
      sanitizeEnvValue(process.env.SUPABASE_SECRET_KEY) ||
      sanitizeEnvValue(process.env.SUPABASE_ANON_KEY);

    const signature = `${supabaseUrl}::${supabaseKey}`;

    if (!supabaseUrl) {
      return {
        supabaseUrl: '',
        supabaseKey,
        signature,
        configError: 'Supabase Storage is unavailable: SUPABASE_URL environment variable is missing.'
      };
    }

    if (supabaseUrl.includes('your-project')) {
      return {
        supabaseUrl: '',
        supabaseKey,
        signature,
        configError: 'Supabase Storage is unavailable: SUPABASE_URL is set to a placeholder value.'
      };
    }

    try {
      const parsed = new URL(supabaseUrl);
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
        return {
          supabaseUrl: '',
          supabaseKey,
          signature,
          configError: 'Supabase Storage is unavailable: SUPABASE_URL must be a valid HTTP or HTTPS URL.'
        };
      }
    } catch {
      return {
        supabaseUrl: '',
        supabaseKey,
        signature,
        configError: 'Supabase Storage is unavailable: SUPABASE_URL is not a valid HTTP or HTTPS URL.'
      };
    }

    if (!supabaseKey) {
      return {
        supabaseUrl,
        supabaseKey: '',
        signature,
        configError:
          'Supabase Storage is unavailable: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY / SUPABASE_ANON_KEY) environment variable is missing.'
      };
    }

    return {
      supabaseUrl,
      supabaseKey,
      signature,
      configError: null
    };
  }

  /**
   * Initializes the Supabase Storage SDK client purely in memory.
   * Never performs filesystem writes or directory creation (safe for read-only Vercel serverless /var/task).
   */
  public initClient(): void {
    if (this.hasCustomClient) {
      return;
    }

    const { supabaseUrl, supabaseKey, signature, configError } = this.readEnvConfig();
    this.lastEnvSignature = signature;

    if (configError) {
      this.client = null;
      this.configuredUrl = '';
      this.isClientInitialized = false;
      this.configError = configError;
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      this.configuredUrl = supabaseUrl;
      this.isClientInitialized = true;
      this.configError = null;
    } catch (err: any) {
      const reason = err?.message || 'Unknown error';
      console.warn('[Supabase Storage] Failed to initialize client:', reason);
      this.client = null;
      this.configuredUrl = '';
      this.isClientInitialized = false;
      this.configError = `Supabase Storage initialization failed: ${reason}`;
    }
  }

  /**
   * Verifies SUPABASE_URL and credentials are present and valid.
   * Automatically refreshes initialization if environment variables changed after module import (e.g. dotenv.config).
   */
  public verifyConfiguration(): StorageConfigurationStatus {
    if (this.hasCustomClient) {
      return {
        configured: this.isClientInitialized && this.client !== null,
        supabaseUrl: this.configuredUrl || null,
        error: this.configError
      };
    }

    const { signature } = this.readEnvConfig();
    if (signature !== this.lastEnvSignature) {
      this.initClient();
    }

    return {
      configured: this.isClientInitialized && this.client !== null,
      supabaseUrl: this.configuredUrl || null,
      error: this.configError
    };
  }

  public isConfigured(): boolean {
    return this.verifyConfiguration().configured;
  }

  public getSupabaseUrl(): string {
    const status = this.verifyConfiguration();
    return status.supabaseUrl || sanitizeEnvValue(process.env.SUPABASE_URL);
  }

  private ensureClient(): SupabaseClient {
    const status = this.verifyConfiguration();
    if (!status.configured || !this.client) {
      throw new StorageServiceError(
        status.error ||
          'Supabase Storage service is unavailable. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        503
      );
    }
    return this.client;
  }

  /**
   * Sanitizes paths purely in memory to prevent directory traversal and remove leading/trailing slashes.
   */
  public sanitizeStoragePath(rawPath: string): string {
    const normalized = String(rawPath || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(p => p && p !== '.' && p !== '..');
    return parts.join('/');
  }

  private resolveValidatedTarget(bucket: StorageBucket | string, storagePath: string): {
    bucket: string;
    safePath: string;
  } {
    const cleanBucket = String(bucket || '').trim();
    const safePath = this.sanitizeStoragePath(storagePath);
    if (!cleanBucket || !safePath) {
      throw new StorageServiceError('Invalid storage bucket or object path.', 400);
    }
    return { bucket: cleanBucket, safePath };
  }

  /**
   * Builds standardized path:
   * Employee Docs: company_id/employee_id/document_type/unique_filename
   * Company Assets: company_id/assets/asset_type/unique_filename
   * Payslip PDFs: company_id/payslips/year/month/employee_id/unique_filename
   * Import Files: company_id/imports/year/month/unique_filename
   */
  public buildStructuredPath(params: {
    companyId: number | string;
    bucket: StorageBucket | string;
    employeeId?: string;
    documentType?: string;
    year?: number | string;
    month?: string;
    fileName: string;
  }): string {
    const cleanFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const uniqueFileName = `${uniqueSuffix}_${cleanFileName}`;

    switch (params.bucket) {
      case STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS: {
        const emp = (params.employeeId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docType = (params.documentType || 'records').replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${params.companyId}/${emp}/${docType}/${uniqueFileName}`;
      }
      case STORAGE_BUCKETS.COMPANY_ASSETS: {
        const assetType = (params.documentType || 'branding').replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${params.companyId}/assets/${assetType}/${uniqueFileName}`;
      }
      case STORAGE_BUCKETS.PAYSLIP_PDFS: {
        const y = params.year || new Date().getFullYear();
        const m = params.month || 'default';
        const emp = (params.employeeId || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${params.companyId}/payslips/${y}/${m}/${emp}/${uniqueFileName}`;
      }
      case STORAGE_BUCKETS.IMPORT_FILES: {
        const y = params.year || new Date().getFullYear();
        const m = params.month || 'default';
        return `${params.companyId}/imports/${y}/${m}/${uniqueFileName}`;
      }
      default:
        return `${params.companyId}/misc/${uniqueFileName}`;
    }
  }

  /**
   * Uploads file buffer directly to private Supabase Storage bucket via SDK.
   */
  public async uploadObject(
    bucket: StorageBucket | string,
    storagePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ path: string; fullPath: string }> {
    const client = this.ensureClient();
    const { bucket: cleanBucket, safePath } = this.resolveValidatedTarget(bucket, storagePath);

    try {
      const { data, error } = await client.storage
        .from(cleanBucket)
        .upload(safePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error(`[Supabase Storage] Upload error to bucket "${cleanBucket}" at "${safePath}":`, error.message);
        throw new StorageServiceError(`Supabase Storage upload failed: ${error.message}`, 502);
      }

      return {
        path: safePath,
        fullPath: data?.fullPath || `${cleanBucket}/${safePath}`
      };
    } catch (err: any) {
      if (err instanceof StorageServiceError) throw err;
      console.error(`[Supabase Storage] Unexpected upload error to bucket "${cleanBucket}":`, err?.message || err);
      throw new StorageServiceError(
        `Supabase Storage upload failed: ${err?.message || 'Unexpected storage error'}`,
        502
      );
    }
  }

  /**
   * Generates a short-lived signed URL (default 300 seconds / 5 mins) for private bucket download.
   */
  public async createSignedUrl(
    bucket: StorageBucket | string,
    storagePath: string,
    expiresInSeconds: number = 300
  ): Promise<string> {
    const client = this.ensureClient();
    const { bucket: cleanBucket, safePath } = this.resolveValidatedTarget(bucket, storagePath);

    try {
      const { data, error } = await client.storage
        .from(cleanBucket)
        .createSignedUrl(safePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new StorageServiceError(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`, 502);
      }

      return data.signedUrl;
    } catch (err: any) {
      if (err instanceof StorageServiceError) throw err;
      throw new StorageServiceError(
        `Failed to generate signed URL: ${err?.message || 'Unexpected storage error'}`,
        502
      );
    }
  }

  /**
   * Downloads an object as a Buffer from Supabase Storage.
   */
  public async downloadObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const client = this.ensureClient();
    const { bucket: cleanBucket, safePath } = this.resolveValidatedTarget(bucket, storagePath);

    try {
      const { data, error } = await client.storage
        .from(cleanBucket)
        .download(safePath);

      if (error || !data) {
        throw new StorageServiceError(
          `Failed to download object from Supabase: ${error?.message || 'File not found'}`,
          404
        );
      }

      const arrayBuffer = await data.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: data.type || 'application/octet-stream'
      };
    } catch (err: any) {
      if (err instanceof StorageServiceError) throw err;
      throw new StorageServiceError(
        `Failed to download object from Supabase: ${err?.message || 'Unexpected storage error'}`,
        502
      );
    }
  }

  /**
   * Deletes an object from Supabase Storage.
   */
  public async deleteObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<boolean> {
    const client = this.ensureClient();
    const { bucket: cleanBucket, safePath } = this.resolveValidatedTarget(bucket, storagePath);

    try {
      const { error } = await client.storage
        .from(cleanBucket)
        .remove([safePath]);

      if (error) {
        console.warn(`[Supabase Storage] Delete error in "${cleanBucket}" for "${safePath}":`, error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      if (err instanceof StorageServiceError) throw err;
      console.warn(`[Supabase Storage] Unexpected delete error in "${cleanBucket}":`, err?.message || err);
      throw new StorageServiceError(
        `Failed to delete object from Supabase: ${err?.message || 'Unexpected storage error'}`,
        502
      );
    }
  }
}

export const supabaseStorage = new SupabaseStorageService();
