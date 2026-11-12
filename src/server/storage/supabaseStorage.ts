import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const STORAGE_BUCKETS = {
  EMPLOYEE_DOCUMENTS: 'employee-documents',
  COMPANY_ASSETS: 'company-assets',
  PAYSLIP_PDFS: 'payslip-pdfs',
  IMPORT_FILES: 'import-files'
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

const FALLBACK_DIR = path.resolve(process.cwd(), 'data', 'storage_fallback');

class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private isClientInitialized = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    // Prefer service role key for administrative backend access; fallback to anon key if provided
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
      try {
        this.client = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        this.isClientInitialized = true;
        console.log('[Supabase Storage] Initialized client for:', supabaseUrl);
      } catch (err: any) {
        console.warn('[Supabase Storage] Failed to initialize client:', err.message);
        this.client = null;
        this.isClientInitialized = false;
      }
    } else {
      this.client = null;
      this.isClientInitialized = false;
    }

    // Ensure fallback directory exists
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
  }

  public isConfigured(): boolean {
    return this.isClientInitialized && this.client !== null;
  }

  public getSupabaseUrl(): string {
    return process.env.SUPABASE_URL || '';
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
   * Uploads file buffer to Supabase Storage bucket.
   * Keeps bucket private and preserves isolation.
   */
  public async uploadObject(
    bucket: StorageBucket | string,
    storagePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ path: string; fullPath: string }> {
    const safePath = this.sanitizeStoragePath(storagePath);

    if (this.isConfigured() && this.client) {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(safePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error(`[Supabase Storage] Upload error to bucket "${bucket}" at "${safePath}":`, error.message);
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }

      return {
        path: safePath,
        fullPath: data?.fullPath || `${bucket}/${safePath}`
      };
    }

    // Local resilient storage fallback
    const targetFile = path.join(FALLBACK_DIR, bucket, safePath);
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, buffer);

    return {
      path: safePath,
      fullPath: `${bucket}/${safePath}`
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
    const safePath = this.sanitizeStoragePath(storagePath);

    if (this.isConfigured() && this.client) {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(safePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
      }

      return data.signedUrl;
    }

    // Fallback: generates signed API URL pointing to the applet's secure tokenized download endpoint
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'fallback_secret')
      .update(`${bucket}:${safePath}:${Math.floor(Date.now() / (expiresInSeconds * 1000))}`)
      .digest('hex')
      .substring(0, 16);

    return `/api/storage/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(safePath)}&token=${token}`;
  }

  /**
   * Downloads an object as a Buffer.
   */
  public async downloadObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const safePath = this.sanitizeStoragePath(storagePath);

    if (this.isConfigured() && this.client) {
      const { data, error } = await this.client.storage
        .from(bucket)
        .download(safePath);

      if (error || !data) {
        throw new Error(`Failed to download object from Supabase: ${error?.message || 'File not found'}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: data.type || 'application/octet-stream'
      };
    }

    // Fallback
    const targetFile = path.join(FALLBACK_DIR, bucket, safePath);
    if (!fs.existsSync(targetFile)) {
      throw new Error(`File does not exist in storage: ${safePath}`);
    }

    const buffer = fs.readFileSync(targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv'
    };

    return {
      buffer,
      mimeType: mimeMap[ext] || 'application/octet-stream'
    };
  }

  /**
   * Deletes an object from Supabase Storage.
   */
  public async deleteObject(
    bucket: StorageBucket | string,
    storagePath: string
  ): Promise<boolean> {
    const safePath = this.sanitizeStoragePath(storagePath);

    if (this.isConfigured() && this.client) {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([safePath]);

      if (error) {
        console.warn(`[Supabase Storage] Delete error in "${bucket}" for "${safePath}":`, error.message);
        return false;
      }
      return true;
    }

    // Fallback
    const targetFile = path.join(FALLBACK_DIR, bucket, safePath);
    if (fs.existsSync(targetFile)) {
      try {
        fs.unlinkSync(targetFile);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}

export const supabaseStorage = new SupabaseStorageService();
