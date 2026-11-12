import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabaseStorage, STORAGE_BUCKETS } from '../storage/supabaseStorage';

const router = Router();

// In-memory multer storage with 25MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images (PNG, JPG), Word (DOC, DOCX), Excel (XLSX, CSV).'));
    }
  }
});

// GET /api/documents/:employeeId - List all documents for an employee
router.get('/:employeeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId } = req.params;

    const result = await query(
      'SELECT * FROM employee_documents WHERE company_id = $1 AND employee_id = $2 ORDER BY uploaded_at DESC',
      [companyId, employeeId]
    );

    const documents = result.rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      category: row.category,
      title: row.title,
      fileName: row.file_name,
      bucket: row.bucket || STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      storagePath: row.storage_path,
      fileSize: Number(row.file_size_bytes),
      mimeType: row.mime_type,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at
    }));

    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/documents/upload - Upload employee document to Supabase Storage
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId, category, title } = req.body;
    const file = req.file;

    if (!file || !employeeId || !category || !title) {
      return res.status(400).json({ success: false, error: 'Missing required document fields or file.' });
    }

    const docId = 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const mimeType = file.mimetype || 'application/octet-stream';

    // Structured storage path: company_id/employee_id/document_type/unique_filename
    const storagePath = supabaseStorage.buildStructuredPath({
      companyId,
      bucket: STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      employeeId,
      documentType: category,
      fileName: file.originalname
    });

    const uploadRes = await supabaseStorage.uploadObject(
      STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      storagePath,
      file.buffer,
      mimeType
    );

    // Save document record in PostgreSQL
    await query(`
      INSERT INTO employee_documents (
        id, company_id, employee_id, category, title, file_name,
        storage_path, file_size_bytes, bucket, mime_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      docId,
      companyId,
      employeeId,
      category,
      title,
      file.originalname,
      uploadRes.path,
      file.buffer.length,
      STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      mimeType,
      req.user?.username || 'HR Administrator'
    ]);

    // Also register in storage_objects tracking
    await query(`
      INSERT INTO storage_objects (
        company_id, bucket, storage_path, file_name, mime_type, file_size_bytes,
        entity_type, entity_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      companyId,
      STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      uploadRes.path,
      file.originalname,
      mimeType,
      file.buffer.length,
      'employee_document',
      employeeId,
      req.user?.username || 'HR Administrator'
    ]);

    // Generate short-lived signed URL for immediate view/preview
    const signedUrl = await supabaseStorage.createSignedUrl(
      STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
      uploadRes.path,
      300
    );

    res.json({
      success: true,
      document: {
        id: docId,
        employeeId,
        category,
        title,
        fileName: file.originalname,
        fileSize: file.buffer.length,
        bucket: STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
        storagePath: uploadRes.path,
        mimeType,
        signedUrl
      }
    });
  } catch (err: any) {
    console.error('[Document Upload Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload document.' });
  }
});

// GET /api/documents/preview/:id - Get temporary signed URL for preview
router.get('/preview/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM employee_documents WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const bucket = doc.bucket || STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS;

    const signedUrl = await supabaseStorage.createSignedUrl(bucket, doc.storage_path, 300);

    res.json({
      success: true,
      id: doc.id,
      title: doc.title,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      signedUrl,
      expiresInSeconds: 300
    });
  } catch (err: any) {
    console.error('[Document Preview Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Could not generate preview link.' });
  }
});

// GET /api/documents/download/:id - Securely stream or download document
router.get('/download/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM employee_documents WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const bucket = doc.bucket || STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS;

    const { buffer, mimeType } = await supabaseStorage.downloadObject(bucket, doc.storage_path);

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[Document Download Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to download document.' });
  }
});

// DELETE /api/documents/:id - Delete document from Supabase Storage and database
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM employee_documents WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const bucket = doc.bucket || STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS;

    await supabaseStorage.deleteObject(bucket, doc.storage_path);

    await query('DELETE FROM employee_documents WHERE id = $1 AND company_id = $2', [id, companyId]);
    await query('DELETE FROM storage_objects WHERE bucket = $1 AND storage_path = $2', [bucket, doc.storage_path]);

    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      companyId,
      req.user?.id || null,
      'DOCUMENT_DELETE',
      'employee_document',
      id,
      `Deleted employee document "${doc.title}" (${doc.file_name})`
    ]);

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err: any) {
    console.error('[Document Delete Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete document.' });
  }
});

export default router;
