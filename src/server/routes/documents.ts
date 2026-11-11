import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

function getServerDocsDir() {
  const base = process.env.UPLOADS_DIR || path.join(process.cwd(), 'server_storage');
  const dir = path.join(base, 'employee_documents');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images, Word, Excel, CSV.'));
    }
  }
});

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
      fileSize: Number(row.file_size_bytes),
      uploadedAt: row.uploaded_at
    }));

    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { employeeId, category, title } = req.body;
    const file = req.file;

    if (!file || !employeeId || !category || !title) {
      return res.status(400).json({ success: false, error: 'Missing required document fields or file.' });
    }

    const docsDir = getServerDocsDir();
    const docId = 'doc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const safeExt = path.extname(file.originalname).toLowerCase();
    const storedFilename = `${employeeId}_${docId}${safeExt}`;
    const storagePath = path.join(docsDir, storedFilename);

    fs.writeFileSync(storagePath, file.buffer);

    await query(`
      INSERT INTO employee_documents (id, company_id, employee_id, category, title, file_name, storage_path, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [docId, companyId, employeeId, category, title, file.originalname, storagePath, file.buffer.length]);

    res.json({
      success: true,
      document: {
        id: docId,
        employeeId,
        category,
        title,
        fileName: file.originalname,
        fileSize: file.buffer.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;

    const result = await query('SELECT * FROM employee_documents WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = result.rows[0];
    if (!fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ success: false, error: 'File missing from server storage.' });
    }

    res.download(doc.storage_path, doc.file_name);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const { id } = req.params;

    const result = await query('SELECT * FROM employee_documents WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = result.rows[0];
    if (fs.existsSync(doc.storage_path)) {
      fs.unlinkSync(doc.storage_path);
    }

    await query('DELETE FROM employee_documents WHERE id = $1 AND company_id = $2', [id, companyId]);

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
