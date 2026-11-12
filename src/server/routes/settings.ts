import { Router } from 'express';
import { query } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const result = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Company settings not found.' });
    }

    const row = result.rows[0];
    let brandColors = undefined;
    if (row.brand_colors_json) {
      try {
        brandColors = typeof row.brand_colors_json === 'string'
          ? JSON.parse(row.brand_colors_json)
          : row.brand_colors_json;
      } catch {}
    }

    const settings = {
      companyName: row.company_name,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      cityStateZip: row.city_state_zip,
      phone: row.phone,
      email: row.email,
      website: row.website,
      taxRegistrationNumber: row.tax_registration_number,
      currencySymbol: row.currency_symbol,
      currencyName: row.currency_name,
      showCurrencySymbol: row.show_currency_symbol,
      logoDataUrl: row.logo_data_url,
      signatureDataUrl: row.signature_data_url,
      authorizedSignatoryName: row.authorized_signatory_name,
      authorizedSignatoryTitle: row.authorized_signatory_title,
      payslipNote: row.payslip_note,
      themeColor: row.theme_color || '#1e3a8a',
      secondaryColor: row.secondary_color || '#475569',
      accentColor: row.accent_color || '#d97706',
      brandColors: brandColors
    };

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const s = req.body;
    const brandColorsJson = s.brandColors ? JSON.stringify(s.brandColors) : null;

    await query(`
      UPDATE companies SET
        company_name = $1, address_line1 = $2, address_line2 = $3, city_state_zip = $4,
        phone = $5, email = $6, website = $7, tax_registration_number = $8,
        currency_symbol = $9, currency_name = $10, show_currency_symbol = $11,
        logo_data_url = $12, signature_data_url = $13, authorized_signatory_name = $14,
        authorized_signatory_title = $15, payslip_note = $16, theme_color = $17,
        secondary_color = $18, accent_color = $19, brand_colors_json = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
    `, [
      s.companyName, s.addressLine1, s.addressLine2, s.cityStateZip,
      s.phone, s.email, s.website, s.taxRegistrationNumber,
      s.currencySymbol, s.currencyName, s.showCurrencySymbol ?? true,
      s.logoDataUrl, s.signatureDataUrl, s.authorizedSignatoryName,
      s.authorizedSignatoryTitle, s.payslipNote, s.themeColor,
      s.secondaryColor || '#475569', s.accentColor || '#d97706', brandColorsJson,
      companyId
    ]);

    res.json({ success: true, message: 'Settings updated successfully.', settings: s });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/logo - Upload company logo to company-assets bucket
import multer from 'multer';
import { supabaseStorage, STORAGE_BUCKETS } from '../storage/supabaseStorage';

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Allowed: PNG, JPG, JPEG, SVG, WebP.'));
    }
  }
});

router.post('/logo', authenticateToken, logoUpload.single('logo'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId || 1;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No logo image file provided.' });
    }

    const storagePath = supabaseStorage.buildStructuredPath({
      companyId,
      bucket: STORAGE_BUCKETS.COMPANY_ASSETS,
      documentType: 'branding',
      fileName: file.originalname
    });

    const uploadRes = await supabaseStorage.uploadObject(
      STORAGE_BUCKETS.COMPANY_ASSETS,
      storagePath,
      file.buffer,
      file.mimetype
    );

    // Generate signed URL (valid for 7 days / 604800s for persistent UI display)
    const signedUrl = await supabaseStorage.createSignedUrl(
      STORAGE_BUCKETS.COMPANY_ASSETS,
      uploadRes.path,
      604800
    );

    // Update company logo in database
    await query(`
      UPDATE companies
      SET logo_data_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [signedUrl, companyId]);

    // Record in storage_objects
    await query(`
      INSERT INTO storage_objects (
        company_id, bucket, storage_path, file_name, mime_type, file_size_bytes,
        entity_type, entity_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      companyId,
      STORAGE_BUCKETS.COMPANY_ASSETS,
      uploadRes.path,
      file.originalname,
      file.mimetype,
      file.buffer.length,
      'company_logo',
      String(companyId),
      req.user?.username || 'Admin'
    ]);

    res.json({
      success: true,
      logoUrl: signedUrl,
      storagePath: uploadRes.path,
      fileName: file.originalname
    });
  } catch (err: any) {
    console.error('[Logo Upload Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload logo.' });
  }
});

export default router;
