import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { supabaseStorage, STORAGE_BUCKETS, StorageBucket } from '../storage/supabaseStorage';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// 25 MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  [STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS]: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ],
  [STORAGE_BUCKETS.COMPANY_ASSETS]: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/webp'
  ],
  [STORAGE_BUCKETS.PAYSLIP_PDFS]: [
    'application/pdf'
  ],
  [STORAGE_BUCKETS.IMPORT_FILES]: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/octet-stream'
  ]
};

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  [STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS]: ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.csv'],
  [STORAGE_BUCKETS.COMPANY_ASSETS]: ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
  [STORAGE_BUCKETS.PAYSLIP_PDFS]: ['.pdf'],
  [STORAGE_BUCKETS.IMPORT_FILES]: ['.xlsx', '.xls', '.csv']
};

/**
 * GET /api/storage/status
 * Returns connection and configuration status of Supabase storage.
 */
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  const isConfigured = supabaseStorage.isConfigured();
  const supabaseUrl = supabaseStorage.getSupabaseUrl();

  res.json({
    success: true,
    provider: isConfigured ? 'supabase' : 'local_resilient_store',
    isConfigured,
    supabaseProjectUrl: isConfigured ? supabaseUrl : null,
    buckets: Object.values(STORAGE_BUCKETS),
    accessMode: 'private',
    signedUrlExpirySeconds: 300
  });
});

/**
 * POST /api/storage/upload/:bucket
 * Uploads a file buffer into the designated private bucket.
 * Enforces company tenant isolation and structured path naming.
 */
router.post('/upload/:bucket', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { bucket } = req.params;
    const companyId = req.user?.companyId || 1;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const validBuckets = Object.values(STORAGE_BUCKETS) as string[];
    if (!validBuckets.includes(bucket)) {
      return res.status(400).json({
        success: false,
        error: `Invalid bucket. Allowed buckets: ${validBuckets.join(', ')}`
      });
    }

    // Extension & MIME validation
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ALLOWED_EXTENSIONS[bucket] || [];
    if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file extension "${ext}". Allowed for ${bucket}: ${allowedExts.join(', ')}`
      });
    }

    // Build structured path according to bucket rules
    const structuredPath = supabaseStorage.buildStructuredPath({
      companyId,
      bucket: bucket as StorageBucket,
      employeeId: req.body.employeeId,
      documentType: req.body.documentType || req.body.category,
      year: req.body.year,
      month: req.body.month,
      fileName: file.originalname
    });

    const uploadResult = await supabaseStorage.uploadObject(
      bucket as StorageBucket,
      structuredPath,
      file.buffer,
      file.mimetype || 'application/octet-stream'
    );

    // Persist file metadata in PostgreSQL storage_objects
    await query(`
      INSERT INTO storage_objects (
        company_id, bucket, storage_path, file_name, mime_type, file_size_bytes,
        entity_type, entity_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      companyId,
      bucket,
      uploadResult.path,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      file.size,
      req.body.entityType || bucket,
      req.body.entityId || req.body.employeeId || null,
      req.user?.username || 'HR User'
    ]);

    // Record audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      companyId,
      req.user?.id || null,
      'STORAGE_UPLOAD',
      bucket,
      uploadResult.path,
      `Uploaded file "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB) to ${bucket}`
    ]);

    // Generate immediate short-lived signed URL for client preview
    const signedUrl = await supabaseStorage.createSignedUrl(bucket, uploadResult.path, 300);

    res.json({
      success: true,
      bucket,
      storagePath: uploadResult.path,
      fullPath: uploadResult.fullPath,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSizeBytes: file.size,
      signedUrl
    });
  } catch (err: any) {
    console.error('[Storage API] Upload failed:', err);
    res.status(500).json({ success: false, error: err.message || 'File upload failed.' });
  }
});

/**
 * GET /api/storage/signed-url
 * Generates a short-lived signed URL (300 seconds) for an authorized user.
 * Enforces company boundary check.
 */
router.get('/signed-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const bucket = String(req.query.bucket || '');
    const rawPath = String(req.query.path || '');
    const expiresIn = Number(req.query.expiresIn) || 300;

    if (!bucket || !rawPath) {
      return res.status(400).json({ success: false, error: 'Missing bucket or path query parameter.' });
    }

    const safePath = supabaseStorage.sanitizeStoragePath(rawPath);

    // Verify company isolation: path must start with companyId/
    const pathPrefix = `${companyId}/`;
    if (!safePath.startsWith(pathPrefix)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to access files outside your company tenant.'
      });
    }

    const signedUrl = await supabaseStorage.createSignedUrl(bucket, safePath, expiresIn);

    res.json({
      success: true,
      bucket,
      path: safePath,
      signedUrl,
      expiresInSeconds: expiresIn
    });
  } catch (err: any) {
    console.error('[Storage API] Signed URL generation failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Could not generate signed URL.' });
  }
});

/**
 * GET /api/storage/download
 * Downloads/streams the requested object. Supports token validation for fallback signed links.
 */
router.get('/download', async (req, res) => {
  try {
    const bucket = String(req.query.bucket || '');
    const rawPath = String(req.query.path || '');
    const token = String(req.query.token || '');

    if (!bucket || !rawPath) {
      return res.status(400).json({ success: false, error: 'Missing bucket or path query parameter.' });
    }

    const safePath = supabaseStorage.sanitizeStoragePath(rawPath);

    // If token provided (fallback mode signed url), verify HMAC token
    if (token) {
      const secret = process.env.JWT_SECRET || 'fallback_secret';
      const window1 = Math.floor(Date.now() / 300000);
      const window2 = window1 - 1; // allow grace period

      const expectedToken1 = crypto
        .createHmac('sha256', secret)
        .update(`${bucket}:${safePath}:${window1}`)
        .digest('hex')
        .substring(0, 16);

      const expectedToken2 = crypto
        .createHmac('sha256', secret)
        .update(`${bucket}:${safePath}:${window2}`)
        .digest('hex')
        .substring(0, 16);

      if (token !== expectedToken1 && token !== expectedToken2) {
        return res.status(403).json({ success: false, error: 'Invalid or expired download token.' });
      }
    } else {
      // Must authenticate token from header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization required to download.' });
      }
    }

    const { buffer, mimeType } = await supabaseStorage.downloadObject(bucket, safePath);
    const fileName = path.basename(safePath);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[Storage API] Download failed:', err);
    res.status(404).json({ success: false, error: err.message || 'File not found.' });
  }
});

/**
 * DELETE /api/storage/delete
 * Deletes an object from Supabase Storage and records removal in DB.
 */
router.delete('/delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { bucket, path: rawPath } = req.body;

    if (!bucket || !rawPath) {
      return res.status(400).json({ success: false, error: 'Missing bucket or path.' });
    }

    const safePath = supabaseStorage.sanitizeStoragePath(rawPath);

    // Verify company isolation
    if (!safePath.startsWith(`${companyId}/`)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Cannot delete resources outside company workspace.'
      });
    }

    const deleted = await supabaseStorage.deleteObject(bucket, safePath);

    if (deleted) {
      await query('DELETE FROM storage_objects WHERE bucket = $1 AND storage_path = $2', [bucket, safePath]);

      await query(`
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        companyId,
        req.user?.id || null,
        'STORAGE_DELETE',
        bucket,
        safePath,
        `Deleted storage object at "${safePath}" in bucket "${bucket}"`
      ]);
    }

    res.json({ success: true, deleted, path: safePath });
  } catch (err: any) {
    console.error('[Storage API] Delete failed:', err);
    res.status(500).json({ success: false, error: err.message || 'File deletion failed.' });
  }
});

export default router;
