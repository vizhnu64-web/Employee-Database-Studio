import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';

export const STORAGE_BUCKETS = {
  EMPLOYEE_DOCUMENTS: 'employee-documents',
  COMPANY_ASSETS: 'company-assets',
  PAYSLIP_PDFS: 'payslip-pdfs',
  IMPORT_FILES: 'import-files'
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export class StorageServiceError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'StorageServiceError';
    this.statusCode = statusCode;
  }
}

export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private isClientInitialized = false;
  private configuredUrl = '';

  constructor(customClient?: SupabaseClient | null, customUrl?: string) {
    if (customClient !== undefined) {
      this.client = customClient;
      this.isClientInitialized = Boolean(customClient);
      this.configuredUrl = customUrl || '';
    } else {
      this.initClient();
    }
  }

  /**
   * Initializes Supabase Storage client purely in memory.
   * Never performs filesystem writes during module import or initialization.
   */
  public initClient() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
    // Keep existing key architecture: prefer service-role key on backend, fallback to anon key if provided
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim() || '';

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
      try {
        this.client = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        this.configuredUrl = supabaseUrl;
        this.isClientInitialized = true;
      } catch (err: any) {
        console.warn('[Supabase Storage] Failed to initialize client:', err?.message || 'Unknown error');
        this.client = null;
        this.configuredUrl = '';
        this.isClientInitialized = false;
      }
    } else {
      this.client = null;
      this.configuredUrl = '';
      this.isClientInitialized = false;
    }
  }

  public isConfigured(): boolean {
    return this.isClientInitialized && this.client !== null;
  }

  public getSupabaseUrl(): string {
    return this.configuredUrl || process.env.SUPABASE_URL?.trim() || '';
  }

  private ensureClient(): SupabaseClient {
    if (!this.isClientInitialized || !this.client) {
      throw new StorageServiceError(
        'Supabase Storage service is unavailable. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        503
      );
    }
    return this.client;
  }

  /**
   * Sanitizes paths to prevent directory traversal and remove leading/trailing slashes.
   */
  public sanitizeStoragePath(rawPath: string): string {
    const normalized = path.normalize(rawPath).replace(/\\/g, '/');
    const parts = normalized.split('/').filter(p => p && p !== '.' && p !== '..');
    return parts.join('/');
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
   * Uploads file buffer to private Supabase Storage bucket.
   */
  public async uploadObject(
    bucket: StorageBucket | string,
    storagePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ path: string; fullPath: string }> {
    const client = this.ensureClient();
    const safePath = this.sanitizeStoragePath(storagePath);

    const { data, error } = await client.storage
      .from(bucket)
      .upload(safePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`[Supabase Storage] Upload error to bucket "${bucket}" at "${safePath}":`, error.message);
      throw new StorageServiceError(`Supabase Storage upload failed: ${error.message}`, 502);
    }

    return {
      path: safePath,
      fullPath: data?.fullPath || `${bucket}/${safePath}`
    };
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
    const safePath = this.sanitizeStoragePath(storagePath);

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(safePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new StorageServiceError(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`, 502);
    }

    return data.signedUrl;
  }

  /**
   * Downloads an object as a Buffer from Supabase Storage.
   */
  public async downloadObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const client = this.ensureClient();
    const safePath = this.sanitizeStoragePath(storagePath);

    const { data, error } = await client.storage
      .from(bucket)
      .download(safePath);

    if (error || !data) {
      throw new StorageServiceError(`Failed to download object from Supabase: ${error?.message || 'File not found'}`, 404);
    }

    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: data.type || 'application/octet-stream'
    };
  }

  /**
   * Deletes an object from Supabase Storage.
   */
  public async deleteObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<boolean> {
    const client = this.ensureClient();
    const safePath = this.sanitizeStoragePath(storagePath);

    const { error } = await client.storage
      .from(bucket)
      .remove([safePath]);

    if (error) {
      console.warn(`[Supabase Storage] Delete error in "${bucket}" for "${safePath}":`, error.message);
      return false;
    }
    return true;
  }
}

export const supabaseStorage = new SupabaseStorageService();
