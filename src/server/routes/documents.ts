import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireGoogleAccessToken, GoogleAuthRequest } from '../middleware/googleAuth';
import {
  uploadFileToDrive,
  downloadFileFromDrive,
  deleteFileFromDrive,
  listDriveFolderFiles,
  createGoogleDriveClient,
} from '../services/googleDrive';

const router = Router();
router.use(requireGoogleAccessToken);

function resolveFolderId(req: GoogleAuthRequest): string | null {
  const f = String(
    req.driveRootFolderId || req.body?.driveRootFolderId || req.query?.driveRootFolderId || ''
  ).trim();
  return f || null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images (PNG, JPG), Word (DOC, DOCX), Excel (XLSX, CSV).'));
    }
  },
});

function parseDocDescription(desc: string | undefined, fileName: string) {
  if (desc) {
    try {
      const parsed = JSON.parse(desc);
      if (parsed && typeof parsed === 'object') {
        return {
          title: parsed.title || fileName,
          category: parsed.category || 'General',
          employeeId: parsed.employeeId || '',
        };
      }
    } catch {}
  }
  const idx = fileName.indexOf('_');
  if (idx > 0) {
    return {
      title: fileName.slice(idx + 1),
      category: fileName.slice(0, idx),
      employeeId: '',
    };
  }
  return { title: fileName, category: 'General', employeeId: '' };
}

// GET /api/documents/:employeeId - List employee documents directly from Google Drive folder
router.get('/:employeeId', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const token = req.googleAccessToken!;
    const { employeeId } = req.params;
    const { drive } = createGoogleDriveClient(token, resolveFolderId(req));
    const list = await listDriveFolderFiles(token, resolveFolderId(req), 'employee-documents', employeeId);

    const enriched = await Promise.all(
      list.files.map(async (f) => {
        let description = '';
        try {
          const meta = await drive.files.get({ fileId: f.id, fields: 'description' });
          description = meta.data.description || '';
        } catch {}
        const parsed = parseDocDescription(description, f.name);
        return {
          id: f.id,
          driveFileId: f.id,
          employeeId,
          category: parsed.category,
          title: parsed.title,
          fileName: f.name,
          bucket: 'google-drive',
          storagePath: `drive:${f.id}`,
          fileSize: Number(f.size || 0),
          mimeType: f.mimeType,
          uploadedBy: 'HR Workspace',
          uploadedAt: f.modifiedTime || new Date().toISOString(),
        };
      })
    );

    res.json({ success: true, documents: enriched, rootFolderId: list.rootFolderId });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// POST /api/documents/upload - Upload employee document directly to Google Drive
router.post('/upload', upload.single('file'), async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { employeeId, category, title } = req.body || {};
    const file = req.file;
    if (!file || !employeeId || !category || !title) {
      return res.status(400).json({ success: false, error: 'Missing required document fields or file.' });
    }

    const mimeType = file.mimetype || 'application/octet-stream';
    const driveRes = await uploadFileToDrive({
      accessToken: req.googleAccessToken!,
      rootFolderId: resolveFolderId(req),
      category: 'employee-documents',
      fileName: `${category}_${file.originalname}`,
      mimeType,
      buffer: file.buffer,
      employeeId: String(employeeId),
      description: JSON.stringify({ title, category, employeeId }),
    });

    res.json({
      success: true,
      document: {
        id: driveRes.fileId,
        employeeId,
        category,
        title,
        fileName: driveRes.fileName,
        fileSize: driveRes.sizeBytes,
        bucket: 'google-drive',
        storagePath: `drive:${driveRes.fileId}`,
        driveFileId: driveRes.fileId,
        rootFolderId: driveRes.rootFolderId,
        mimeType,
        signedUrl: `/api/documents/download/${encodeURIComponent(driveRes.fileId)}`,
      },
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to upload document to Google Drive.',
    });
  }
});

// GET /api/documents/preview/:id
router.get('/preview/:id', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { drive } = createGoogleDriveClient(req.googleAccessToken!);
    const meta = await drive.files.get({ fileId: id, fields: 'id, name, mimeType, description' });
    const parsed = parseDocDescription(meta.data.description || undefined, meta.data.name || id);
    res.json({
      success: true,
      id,
      title: parsed.title,
      fileName: meta.data.name || id,
      mimeType: meta.data.mimeType || 'application/octet-stream',
      signedUrl: `/api/documents/download/${encodeURIComponent(id)}`,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Could not retrieve document preview metadata.',
    });
  }
});

// GET /api/documents/download/:id
router.get('/download/:id', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { buffer, mimeType, fileName } = await downloadFileFromDrive(req.googleAccessToken!, id);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to download document from Google Drive.',
    });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: GoogleAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await deleteFileFromDrive(req.googleAccessToken!, id);
    res.json({ success: true, message: 'Document deleted from Google Drive.' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed to delete document from Google Drive.',
    });
  }
});

export default router;
