import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/peopledesk_studio';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  // Silent fallback to file-backed database if Postgres is not running
});

// Resilient local file-backed database for standalone/offline LAN operation
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'peopledesk_lan_db.json');

interface LocalDatabaseSchema {
  companies: any[];
  users: any[];
  directory_employees: any[];
  attendance_records: any[];
  payroll_batches: any[];
  generated_history: any[];
  employee_documents: any[];
  audit_logs: any[];
  licenses: any[];
  employee_salary_structures: any[];
  salary_revisions: any[];
  shifts: any[];
  shift_assignments: any[];
  raw_punches: any[];
  attendance_summaries: any[];
  holiday_calendar: any[];
  weekly_off_policies: any[];
  extra_work_records: any[];
  attendance_approvals: any[];
  payslip_revisions: any[];
  login_sessions: any[];
  company_smtp_settings: any[];
  storage_objects: any[];
  import_files_history: any[];
}

function getInitialDB(): LocalDatabaseSchema {
  return {
    companies: [],
    users: [],
    directory_employees: [],
    attendance_records: [],
    payroll_batches: [],
    generated_history: [],
    employee_documents: [],
    audit_logs: [],
    licenses: [],
    employee_salary_structures: [],
    salary_revisions: [],
    shifts: [],
    shift_assignments: [],
    raw_punches: [],
    attendance_summaries: [],
    holiday_calendar: [],
    weekly_off_policies: [],
    extra_work_records: [],
    attendance_approvals: [],
    payslip_revisions: [],
    login_sessions: [],
    company_smtp_settings: [],
    storage_objects: [],
    import_files_history: []
  };
}

function loadLocalDB(): LocalDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...getInitialDB(), ...parsed };
    }
  } catch (err) {
    console.warn('[Employee Database Studio DB] Error reading file DB, initializing empty structure:', err);
  }
  const initial = getInitialDB();
  saveLocalDB(initial);
  return initial;
}

function saveLocalDB(data: LocalDatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Employee Database Studio DB] Error saving local DB:', err);
  }
}

let isPgHealthy = false;
let pgChecked = false;

async function checkPgHealth(): Promise<boolean> {
  if (pgChecked && !isPgHealthy) return false;
  try {
    const client = await pool.connect();
    client.release();
    isPgHealthy = true;
    pgChecked = true;
    return true;
  } catch (e) {
    isPgHealthy = false;
    pgChecked = true;
    return false;
  }
}

export async function query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const hasPg = await checkPgHealth();
  if (hasPg) {
    try {
      const res = await pool.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount || 0 };
    } catch (err) {
      console.warn('[PostgreSQL Query Error, falling back to local store]:', err);
    }
  }

  // File-backed Local & LAN Database Engine
  const db = loadLocalDB();
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  // Handle SELECT * FROM companies
  if (upper.startsWith('SELECT') && upper.includes('FROM COMPANIES')) {
    let rows = db.companies || [];
    if (upper.includes('WHERE ID = $1')) {
      const id = Number(params[0]);
      rows = rows.filter(c => c.id === id);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle UPDATE companies
  if (upper.startsWith('UPDATE COMPANIES')) {
    const id = params[params.length - 1] ? Number(params[params.length - 1]) : 1;
    let comp = (db.companies || []).find(c => c.id === id);
    if (!comp && db.companies && db.companies.length > 0) {
      comp = db.companies[0];
    }
    if (comp) {
      if (params.length >= 17) {
        comp.company_name = params[0];
        comp.address_line1 = params[1];
        comp.address_line2 = params[2];
        comp.city_state_zip = params[3];
        comp.phone = params[4];
        comp.email = params[5];
        comp.website = params[6];
        comp.tax_registration_number = params[7];
        comp.currency_symbol = params[8];
        comp.currency_name = params[9];
        comp.show_currency_symbol = params[10];
        comp.logo_data_url = params[11];
        comp.signature_data_url = params[12];
        comp.authorized_signatory_name = params[13];
        comp.authorized_signatory_title = params[14];
        comp.payslip_note = params[15];
        comp.theme_color = params[16];
        if (params.length > 18) {
          comp.secondary_color = params[17];
          comp.accent_color = params[18];
          comp.brand_colors_json = params[19];
        }
      }
      comp.updated_at = new Date().toISOString();
      saveLocalDB(db);
      return { rows: [comp], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // Handle INSERT INTO companies
  if (upper.startsWith('INSERT INTO COMPANIES')) {
    const newId = (db.companies.length > 0 ? Math.max(...db.companies.map(c => c.id || 0)) : 0) + 1;
    const newComp = {
      id: newId,
      company_name: params[0] || 'Apex Enterprise Solutions Inc.',
      address_line1: params[1] || '450 Innovation Parkway, Suite 800',
      city_state_zip: params[2] || 'San Francisco, CA 94107',
      currency_symbol: params[3] || '$',
      currency_name: params[4] || 'USD',
      authorized_signatory_name: params[5] || 'Eleanor Vance',
      authorized_signatory_title: params[6] || 'Director of Human Resources',
      theme_color: '#1e3a8a',
      secondary_color: '#475569',
      accent_color: '#d97706',
      updated_at: new Date().toISOString()
    };
    db.companies.push(newComp);
    saveLocalDB(db);
    return { rows: [newComp], rowCount: 1 };
  }

  // Handle SELECT * FROM users
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
    let rows = db.users || [];
    if (upper.includes('WHERE USERNAME = $1 AND IS_ACTIVE = TRUE')) {
      const u = params[0]?.toLowerCase();
      rows = rows.filter(r => r.username.toLowerCase() === u && r.is_active === true);
    } else if (upper.includes('WHERE USERNAME = $1')) {
      const u = params[0]?.toLowerCase();
      rows = rows.filter(r => r.username.toLowerCase() === u);
    } else if (upper.includes('WHERE ID = $1')) {
      const id = Number(params[0]);
      rows = rows.filter(r => r.id === id);
    } else if (upper.includes('WHERE COMPANY_ID = $1')) {
      const cId = Number(params[0]);
      rows = rows.filter(r => r.company_id === cId);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle INSERT INTO users
  if (upper.startsWith('INSERT INTO USERS')) {
    const newId = (db.users.length > 0 ? Math.max(...db.users.map(u => u.id || 0)) : 0) + 1;
    const newUser = {
      id: newId,
      company_id: params[0] || 1,
      username: params[1]?.toLowerCase(),
      password_hash: params[2],
      full_name: params[3],
      role: params[4] || 'hr',
      email: params[5] || '',
      is_active: params[6] !== undefined ? params[6] : true,
      employee_id: params[7] || null,
      must_change_password: params[8] || false,
      last_login_at: null,
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    saveLocalDB(db);
    return { rows: [newUser], rowCount: 1 };
  }

  // Handle UPDATE users
  if (upper.startsWith('UPDATE USERS')) {
    if (upper.includes('SET LAST_LOGIN_AT')) {
      const id = Number(params[0]);
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.last_login_at = new Date().toISOString();
        saveLocalDB(db);
        return { rows: [user], rowCount: 1 };
      }
    } else if (upper.includes('SET FULL_NAME = $1')) {
      // UPDATE users SET full_name = $1, email = $2, role = $3, is_active = $4, employee_id = $5 WHERE id = $6
      const id = Number(params[5]);
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.full_name = params[0];
        user.email = params[1];
        user.role = params[2];
        user.is_active = params[3];
        user.employee_id = params[4];
        saveLocalDB(db);
        return { rows: [user], rowCount: 1 };
      }
    } else if (upper.includes('SET PASSWORD_HASH = $1')) {
      // UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3
      const id = Number(params[2]);
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.password_hash = params[0];
        user.must_change_password = params[1];
        saveLocalDB(db);
        return { rows: [user], rowCount: 1 };
      }
    } else if (upper.includes('SET IS_ACTIVE = $1')) {
      // UPDATE users SET is_active = $1 WHERE id = $2
      const id = Number(params[1]);
      const user = db.users.find(u => u.id === id);
      if (user) {
        user.is_active = params[0];
        saveLocalDB(db);
        return { rows: [user], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // Handle DELETE FROM users
  if (upper.startsWith('DELETE FROM USERS')) {
    const id = Number(params[0]);
    const initialLen = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    saveLocalDB(db);
    return { rows: [], rowCount: initialLen - db.users.length };
  }

  // Handle audit_logs
  if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
    const newLog = {
      id: db.audit_logs.length + 1,
      company_id: params[0] || 1,
      user_id: params[1] || null,
      action: params[2] || '',
      entity_type: params[3] || '',
      entity_id: params[4] || '',
      details: params[5] || '',
      ip_address: params[6] || '127.0.0.1',
      timestamp: new Date().toISOString()
    };
    db.audit_logs.unshift(newLog);
    if (db.audit_logs.length > 500) db.audit_logs.pop();
    saveLocalDB(db);
    return { rows: [newLog], rowCount: 1 };
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM AUDIT_LOGS')) {
    return { rows: db.audit_logs.slice(0, 100), rowCount: db.audit_logs.length };
  }

  // Handle directory_employees
  if (upper.startsWith('SELECT') && upper.includes('FROM DIRECTORY_EMPLOYEES')) {
    return { rows: db.directory_employees || [], rowCount: (db.directory_employees || []).length };
  }

  // Handle licenses
  if (upper.startsWith('SELECT') && upper.includes('FROM LICENSES')) {
    return { rows: db.licenses || [], rowCount: (db.licenses || []).length };
  }

  // Handle company_smtp_settings
  if (upper.includes('COMPANY_SMTP_SETTINGS')) {
    if (!db.company_smtp_settings) db.company_smtp_settings = [];

    if (upper.startsWith('SELECT')) {
      const companyId = params[0] !== undefined ? Number(params[0]) : 1;
      const rows = db.company_smtp_settings.filter((s: any) => Number(s.company_id) === companyId);
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT') || upper.startsWith('UPDATE')) {
      let companyId = 1;
      if (upper.startsWith('UPDATE')) {
        companyId = Number(params[params.length - 1]) || 1;
      } else {
        companyId = Number(params[0]) || 1;
      }

      let record = db.company_smtp_settings.find((s: any) => Number(s.company_id) === companyId);
      if (!record) {
        record = { id: db.company_smtp_settings.length + 1, company_id: companyId, created_at: new Date().toISOString() };
        db.company_smtp_settings.push(record);
      }

      if (upper.startsWith('UPDATE') && upper.includes('SET IS_VERIFIED')) {
        if (params.length === 1) {
          // UPDATE company_smtp_settings SET is_verified = TRUE... WHERE company_id = $1
          record.is_verified = true;
          record.last_verified_at = new Date().toISOString();
          record.last_error = null;
        } else if (params.length === 2) {
          // UPDATE company_smtp_settings SET is_verified = FALSE, last_error = $1 WHERE company_id = $2
          record.is_verified = false;
          record.last_error = params[0];
        } else {
          // UPDATE company_smtp_settings SET is_verified = $1, last_verified_at = $2, last_error = $3 WHERE company_id = $4
          record.is_verified = Boolean(params[0]);
          record.last_verified_at = params[1] || new Date().toISOString();
          record.last_error = params[2] || null;
        }
      } else if (params.length >= 7) {
        record.smtp_host = params[1];
        record.smtp_port = Number(params[2]) || 587;
        record.smtp_user = params[3];
        if (params[4]) {
          record.smtp_pass = params[4];
        }
        record.sender_email = params[5];
        record.sender_name = params[6];
        if (params.length > 7 && params[7] !== undefined) {
          record.is_verified = Boolean(params[7]);
        }
      }
      record.updated_at = new Date().toISOString();
      saveLocalDB(db);
      return { rows: [record], rowCount: 1 };
    }
  }

  // Handle employee_documents
  if (upper.includes('EMPLOYEE_DOCUMENTS')) {
    if (!db.employee_documents) db.employee_documents = [];

    if (upper.startsWith('SELECT')) {
      let rows = [...db.employee_documents];
      if (upper.includes('WHERE ID = $1')) {
        const id = String(params[0]);
        rows = rows.filter(d => String(d.id) === id);
      } else if (upper.includes('WHERE COMPANY_ID = $1 AND EMPLOYEE_ID = $2')) {
        const compId = Number(params[0]);
        const empId = String(params[1]);
        rows = rows.filter(d => (d.company_id === undefined || Number(d.company_id) === compId) && String(d.employee_id) === empId);
      } else if (upper.includes('WHERE COMPANY_ID = $1')) {
        const compId = Number(params[0]);
        rows = rows.filter(d => d.company_id === undefined || Number(d.company_id) === compId);
      }
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO EMPLOYEE_DOCUMENTS')) {
      const docId = params[0] || ('doc_' + Date.now().toString(36));
      const newDoc = {
        id: docId,
        company_id: Number(params[1]) || 1,
        employee_id: String(params[2]),
        category: String(params[3]),
        title: String(params[4]),
        file_name: String(params[5]),
        storage_path: String(params[6]),
        file_size_bytes: Number(params[7]) || 0,
        bucket: params[8] || 'employee-documents',
        mime_type: params[9] || 'application/octet-stream',
        uploaded_by: params[10] || 'System',
        uploaded_at: new Date().toISOString()
      };
      // Upsert
      db.employee_documents = db.employee_documents.filter(d => String(d.id) !== String(docId));
      db.employee_documents.unshift(newDoc);
      saveLocalDB(db);
      return { rows: [newDoc], rowCount: 1 };
    }

    if (upper.startsWith('DELETE FROM EMPLOYEE_DOCUMENTS')) {
      const docId = String(params[0]);
      const initialCount = db.employee_documents.length;
      db.employee_documents = db.employee_documents.filter(d => String(d.id) !== docId);
      saveLocalDB(db);
      return { rows: [], rowCount: initialCount - db.employee_documents.length };
    }
  }

  // Handle storage_objects
  if (upper.includes('STORAGE_OBJECTS')) {
    if (!db.storage_objects) db.storage_objects = [];

    if (upper.startsWith('SELECT')) {
      let rows = [...db.storage_objects];
      if (upper.includes('WHERE BUCKET = $1 AND STORAGE_PATH = $2')) {
        const bucket = String(params[0]);
        const path = String(params[1]);
        rows = rows.filter(s => s.bucket === bucket && s.storage_path === path);
      } else if (upper.includes('WHERE COMPANY_ID = $1')) {
        const compId = Number(params[0]);
        rows = rows.filter(s => s.company_id === undefined || Number(s.company_id) === compId);
      }
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO STORAGE_OBJECTS')) {
      const newObj = {
        id: db.storage_objects.length + 1,
        company_id: Number(params[0]) || 1,
        bucket: String(params[1]),
        storage_path: String(params[2]),
        file_name: String(params[3]),
        mime_type: String(params[4] || 'application/octet-stream'),
        file_size_bytes: Number(params[5] || 0),
        entity_type: params[6] || null,
        entity_id: params[7] || null,
        uploaded_by: params[8] || 'HR Administrator',
        created_at: new Date().toISOString()
      };
      // Upsert by bucket + storage_path
      db.storage_objects = db.storage_objects.filter(s => !(s.bucket === newObj.bucket && s.storage_path === newObj.storage_path));
      db.storage_objects.unshift(newObj);
      saveLocalDB(db);
      return { rows: [newObj], rowCount: 1 };
    }

    if (upper.startsWith('DELETE FROM STORAGE_OBJECTS')) {
      if (upper.includes('WHERE BUCKET = $1 AND STORAGE_PATH = $2')) {
        const bucket = String(params[0]);
        const path = String(params[1]);
        const initialCount = db.storage_objects.length;
        db.storage_objects = db.storage_objects.filter(s => !(s.bucket === bucket && s.storage_path === path));
        saveLocalDB(db);
        return { rows: [], rowCount: initialCount - db.storage_objects.length };
      }
    }
  }

  // Handle generated_history
  if (upper.includes('GENERATED_HISTORY')) {
    if (!db.generated_history) db.generated_history = [];

    if (upper.startsWith('SELECT')) {
      let rows = [...db.generated_history];
      if (upper.includes('WHERE ID = $1')) {
        const id = String(params[0]);
        rows = rows.filter(g => String(g.id) === id);
      } else if (upper.includes('WHERE COMPANY_ID = $1')) {
        const compId = Number(params[0]);
        rows = rows.filter(g => g.company_id === undefined || Number(g.company_id) === compId);
      }
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO GENERATED_HISTORY')) {
      const histId = params[0] || ('hist_' + Date.now().toString(36));
      const newHist = {
        id: histId,
        company_id: Number(params[1]) || 1,
        employee_id: String(params[2]),
        employee_name: String(params[3]),
        department: String(params[4] || ''),
        designation: String(params[5] || ''),
        month: String(params[6]),
        year: Number(params[7]),
        gross_earnings: Number(params[8] || 0),
        total_deductions: Number(params[9] || 0),
        net_salary: Number(params[10] || 0),
        bucket: String(params[11] || 'payslip-pdfs'),
        storage_path: String(params[12] || ''),
        file_name: String(params[13] || ''),
        file_size_bytes: Number(params[14] || 0),
        generated_at: new Date().toISOString()
      };
      db.generated_history = db.generated_history.filter(g => String(g.id) !== String(histId));
      db.generated_history.unshift(newHist);
      saveLocalDB(db);
      return { rows: [newHist], rowCount: 1 };
    }
  }

  // Handle import_files_history
  if (upper.includes('IMPORT_FILES_HISTORY')) {
    if (!db.import_files_history) db.import_files_history = [];

    if (upper.startsWith('SELECT')) {
      let rows = [...db.import_files_history];
      if (upper.includes('WHERE COMPANY_ID = $1')) {
        const compId = Number(params[0]);
        rows = rows.filter(i => i.company_id === undefined || Number(i.company_id) === compId);
      }
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith('INSERT INTO IMPORT_FILES_HISTORY')) {
      const newImp = {
        id: db.import_files_history.length + 1,
        company_id: Number(params[0]) || 1,
        file_name: String(params[1]),
        bucket: String(params[2] || 'import-files'),
        storage_path: String(params[3]),
        file_size_bytes: Number(params[4] || 0),
        record_count: Number(params[5] || 0),
        period_month: String(params[6] || ''),
        period_year: Number(params[7] || new Date().getFullYear()),
        uploaded_by: String(params[8] || 'HR Administrator'),
        uploaded_at: new Date().toISOString()
      };
      db.import_files_history.unshift(newImp);
      saveLocalDB(db);
      return { rows: [newImp], rowCount: 1 };
    }
  }

  // Generic cloud tables query simulation for fallback mode
  const dynamicTables = [
    'employee_salary_structures',
    'salary_revisions',
    'shifts',
    'shift_assignments',
    'raw_punches',
    'attendance_summaries',
    'holiday_calendar',
    'weekly_off_policies',
    'extra_work_records',
    'attendance_approvals',
    'payslip_revisions',
    'login_sessions',
    'payroll_batches'
  ];

  for (const tbl of dynamicTables) {
    const tblUpper = tbl.toUpperCase();
    if (upper.startsWith('SELECT') && upper.includes(`FROM ${tblUpper}`)) {
      let rows: any[] = (db as any)[tbl] || [];
      if (upper.includes('WHERE EMPLOYEE_ID = $1')) {
        const empId = String(params[0]).toLowerCase();
        rows = rows.filter((r: any) => String(r.employee_id || r.employeeId || '').toLowerCase() === empId);
      }
      return { rows, rowCount: rows.length };
    }

    if (upper.startsWith(`INSERT INTO ${tblUpper}`)) {
      if (!(db as any)[tbl]) (db as any)[tbl] = [];
      const newRec: any = { id: ((db as any)[tbl].length + 1), created_at: new Date().toISOString() };
      // Map params loosely if available
      params.forEach((val, idx) => {
        newRec[`param_${idx}`] = val;
      });
      (db as any)[tbl].unshift(newRec);
      saveLocalDB(db);
      return { rows: [newRec], rowCount: 1 };
    }

    if (upper.startsWith(`DELETE FROM ${tblUpper}`)) {
      if ((db as any)[tbl]) {
        (db as any)[tbl] = [];
        saveLocalDB(db);
      }
      return { rows: [], rowCount: 1 };
    }
  }

  return { rows: [], rowCount: 0 };
}
