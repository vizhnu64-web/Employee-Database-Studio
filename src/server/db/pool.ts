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
    licenses: []
  };
}

function loadLocalDB(): LocalDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[PeopleDesk DB] Error reading file DB, initializing empty structure:', err);
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
    console.error('[PeopleDesk DB] Error saving local DB:', err);
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

  return { rows: [], rowCount: 0 };
}
