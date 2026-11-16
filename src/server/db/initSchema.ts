import bcrypt from 'bcrypt';
import { query, getPool, resolvePostgresConnection, isProductionRuntime } from './pool';

const SCHEMA_LOCK_KEY = 8842102;
const INITIAL_SCHEMA_VERSION = '001_initial_schema.sql';

const INITIAL_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city_state_zip VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    tax_registration_number VARCHAR(100),
    currency_symbol VARCHAR(10) DEFAULT '$',
    currency_name VARCHAR(50) DEFAULT 'USD',
    show_currency_symbol BOOLEAN DEFAULT TRUE,
    logo_data_url TEXT,
    signature_data_url TEXT,
    authorized_signatory_name VARCHAR(255),
    authorized_signatory_title VARCHAR(255),
    payslip_note TEXT,
    theme_color VARCHAR(50) DEFAULT '#1e3a8a',
    secondary_color VARCHAR(50) DEFAULT '#475569',
    accent_color VARCHAR(50) DEFAULT '#d97706',
    brand_colors_json JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50) DEFAULT '#475569';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS accent_color VARCHAR(50) DEFAULT '#d97706';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_colors_json JSONB;

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'hr',
    is_active BOOLEAN DEFAULT TRUE,
    employee_id VARCHAR(100),
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS directory_employees (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(100),
    joining_date VARCHAR(50),
    employment_status VARCHAR(50) DEFAULT 'Active',
    confirmation_date VARCHAR(50),
    resignation_date VARCHAR(50),
    resignation_reason TEXT,
    bank_account VARCHAR(100),
    pan VARCHAR(50),
    uan VARCHAR(50),
    esi_number VARCHAR(50),
    basic NUMERIC(12,2) DEFAULT 0,
    hra NUMERIC(12,2) DEFAULT 0,
    conveyance NUMERIC(12,2) DEFAULT 0,
    medical_allowance NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    other_allowances NUMERIC(12,2) DEFAULT 0,
    pf NUMERIC(12,2) DEFAULT 0,
    esi NUMERIC(12,2) DEFAULT 0,
    professional_tax NUMERIC(12,2) DEFAULT 0,
    tds NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_employee UNIQUE (company_id, employee_id)
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    record_date VARCHAR(50) NOT NULL,
    check_in VARCHAR(20),
    check_out VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Present',
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    source VARCHAR(50) DEFAULT 'Manual',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    license_key VARCHAR(255) UNIQUE NOT NULL,
    machine_fingerprint VARCHAR(255),
    max_clients INT DEFAULT 10,
    is_activated BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employee_salary_structures (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    salary_type VARCHAR(50) DEFAULT 'Fixed Monthly',
    monthly_ctc NUMERIC(12,2) NOT NULL DEFAULT 0,
    annual_ctc NUMERIC(14,2) DEFAULT 0,
    effective_date VARCHAR(50) NOT NULL,
    payment_frequency VARCHAR(50) DEFAULT 'Monthly',
    payroll_group VARCHAR(100) DEFAULT 'Standard',
    calculation_basis VARCHAR(100) DEFAULT '30 Days',
    basic NUMERIC(12,2) DEFAULT 0,
    hra NUMERIC(12,2) DEFAULT 0,
    conveyance NUMERIC(12,2) DEFAULT 0,
    medical_allowance NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    other_allowances NUMERIC(12,2) DEFAULT 0,
    additional_earnings NUMERIC(12,2) DEFAULT 0,
    custom_earnings JSONB DEFAULT '[]'::jsonb,
    employer_pf NUMERIC(12,2) DEFAULT 0,
    employer_esi NUMERIC(12,2) DEFAULT 0,
    other_employer_contributions NUMERIC(12,2) DEFAULT 0,
    employee_pf NUMERIC(12,2) DEFAULT 0,
    employee_esi NUMERIC(12,2) DEFAULT 0,
    professional_tax NUMERIC(12,2) DEFAULT 0,
    tds NUMERIC(12,2) DEFAULT 0,
    loan_deduction NUMERIC(12,2) DEFAULT 0,
    advance_deduction NUMERIC(12,2) DEFAULT 0,
    late_deduction NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    applicable_shift_id INT,
    lop_calculation_method VARCHAR(50) DEFAULT 'Calendar Days',
    paid_leave_eligibility BOOLEAN DEFAULT TRUE,
    half_day_policy VARCHAR(50) DEFAULT '0.5 Day LOP',
    late_deduction_policy VARCHAR(50) DEFAULT 'Standard',
    total_earnings NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_emp_active_salary UNIQUE (company_id, employee_id, effective_date)
  );

  CREATE TABLE IF NOT EXISTS salary_revisions (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    effective_date VARCHAR(50) NOT NULL,
    previous_ctc NUMERIC(12,2),
    new_ctc NUMERIC(12,2),
    previous_structure JSONB,
    new_structure JSONB,
    changed_by VARCHAR(100),
    reason TEXT,
    approval_status VARCHAR(50) DEFAULT 'Approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    shift_name VARCHAR(100) NOT NULL,
    shift_code VARCHAR(50) NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    break_start VARCHAR(20),
    break_end VARCHAR(20),
    lunch_start VARCHAR(20),
    lunch_end VARCHAR(20),
    scheduled_hours NUMERIC(4,2) DEFAULT 9.0,
    net_working_hours NUMERIC(4,2) DEFAULT 8.0,
    grace_period_mins INT DEFAULT 15,
    late_threshold_mins INT DEFAULT 30,
    early_departure_mins INT DEFAULT 30,
    min_hours_full_day NUMERIC(4,2) DEFAULT 7.5,
    min_hours_half_day NUMERIC(4,2) DEFAULT 4.0,
    is_overnight BOOLEAN DEFAULT FALSE,
    applicable_departments TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shift_assignments (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    shift_id INT REFERENCES shifts(id) ON DELETE CASCADE,
    effective_from VARCHAR(50) NOT NULL,
    CONSTRAINT unique_emp_shift UNIQUE (company_id, employee_id, effective_from)
  );

  CREATE TABLE IF NOT EXISTS raw_punches (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    device_id VARCHAR(50),
    employee_id VARCHAR(100) NOT NULL,
    punch_time TIMESTAMP NOT NULL,
    punch_type VARCHAR(20) DEFAULT 'CheckIn',
    source VARCHAR(50) DEFAULT 'Biometric',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance_summaries (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    date VARCHAR(50) NOT NULL,
    check_in VARCHAR(20),
    check_out VARCHAR(20),
    total_time_hours NUMERIC(5,2) DEFAULT 0,
    break_duration_hours NUMERIC(4,2) DEFAULT 0,
    lunch_duration_hours NUMERIC(4,2) DEFAULT 0,
    net_working_hours NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Present',
    late_minutes INT DEFAULT 0,
    early_departure_minutes INT DEFAULT 0,
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    is_lop BOOLEAN DEFAULT FALSE,
    lop_days NUMERIC(3,1) DEFAULT 0,
    approval_status VARCHAR(50) DEFAULT 'Approved',
    remarks TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_emp_attendance_date UNIQUE (company_id, employee_id, date)
  );

  CREATE TABLE IF NOT EXISTS holiday_calendar (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    year INT NOT NULL,
    date VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'Public Holiday',
    is_paid BOOLEAN DEFAULT TRUE,
    branch_scope VARCHAR(100) DEFAULT 'All',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS weekly_off_policies (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    policy_name VARCHAR(100) NOT NULL,
    days_off TEXT[] DEFAULT ARRAY['Sunday'],
    alternate_saturday_rule VARCHAR(50) DEFAULT 'None',
    applicable_departments TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS extra_work_records (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    work_date VARCHAR(50) NOT NULL,
    work_type VARCHAR(50) DEFAULT 'Sunday Work',
    hours NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending',
    compensation VARCHAR(50) DEFAULT 'Compensatory Off',
    reason TEXT,
    proof_filename VARCHAR(255),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance_approvals (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    date_or_period VARCHAR(50) NOT NULL,
    requested_change TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payslip_revisions (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    payslip_id VARCHAR(150) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    month VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    original_data JSONB NOT NULL,
    revised_data JSONB NOT NULL,
    adjustment_earnings JSONB DEFAULT '[]'::jsonb,
    adjustment_deductions JSONB DEFAULT '[]'::jsonb,
    reason TEXT NOT NULL,
    edited_by VARCHAR(100) NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'Draft',
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS login_sessions (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(100),
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS company_smtp_settings (
    id SERIAL PRIMARY KEY,
    company_id INT UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    smtp_host VARCHAR(255),
    smtp_port INT DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_pass TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    last_verified_at TIMESTAMP,
    last_error TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employee_documents (
    id VARCHAR(100) PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    bucket VARCHAR(100) DEFAULT 'employee-documents',
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS storage_objects (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    bucket VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT DEFAULT 0,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    uploaded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_bucket_path UNIQUE (bucket, storage_path)
  );

  CREATE TABLE IF NOT EXISTS generated_history (
    id VARCHAR(100) PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    month VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    gross_earnings NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    bucket VARCHAR(100) DEFAULT 'payslip-pdfs',
    storage_path TEXT,
    file_name VARCHAR(255),
    file_size_bytes BIGINT DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS import_files_history (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    bucket VARCHAR(100) DEFAULT 'import-files',
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    record_count INT DEFAULT 0,
    period_month VARCHAR(50),
    period_year INT,
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_employees_company ON directory_employees(company_id);
  CREATE INDEX IF NOT EXISTS idx_documents_company_emp ON employee_documents(company_id, employee_id);
  CREATE INDEX IF NOT EXISTS idx_storage_objects_company ON storage_objects(company_id, bucket);
  CREATE INDEX IF NOT EXISTS idx_generated_history_company ON generated_history(company_id, year, month);
  CREATE INDEX IF NOT EXISTS idx_attendance_records_company_date ON attendance_records(company_id, record_date);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_company_ts ON audit_logs(company_id, timestamp DESC);
`;

async function initializePostgreSQLSchema() {
  const pool = getPool('runtime');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const applied = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [INITIAL_SCHEMA_VERSION]
    );

    if (applied.rows.length === 0) {
      await client.query(INITIAL_SCHEMA_SQL);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [INITIAL_SCHEMA_VERSION]
      );
      console.log(`[Employee Database Studio DB] Applied schema migration: ${INITIAL_SCHEMA_VERSION}`);
    } else {
      // Non-destructive column check on companies even if migration version already exists
      await client.query(`
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50) DEFAULT '#475569';
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS accent_color VARCHAR(50) DEFAULT '#d97706';
        ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_colors_json JSONB;
      `);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  const { connectionString } = resolvePostgresConnection('runtime');
  const isProd = isProductionRuntime();

  if (connectionString) {
    await initializePostgreSQLSchema();
  } else if (isProd) {
    throw new Error('PostgreSQL connection is required in production. Set DATABASE_URL or POSTGRES_URL.');
  }

  // Ensure default company workspace exists (preserves existing data)
  const compRes = await query('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
  let companyId = 1;
  if (compRes.rows.length === 0) {
    const insertComp = await query(`
      INSERT INTO companies (company_name, address_line1, city_state_zip, currency_symbol, currency_name, authorized_signatory_name, authorized_signatory_title)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'Apex Enterprise Solutions Inc.',
      '450 Innovation Parkway, Suite 800',
      'San Francisco, CA 94107',
      '$',
      'USD',
      'Eleanor Vance',
      'Director of Human Resources'
    ]);
    companyId = insertComp.rows[0]?.id || 1;
  } else {
    companyId = compRes.rows[0].id;
  }

  // Ensure initial administrator exists without overwriting existing passwords or seeding insecure defaults in production
  const configuredAdminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const adminRes = await query('SELECT id, password_hash, last_login_at, must_change_password FROM users WHERE username = $1', ['admin']);

  if (adminRes.rows.length === 0) {
    if (isProd) {
      if (configuredAdminPassword) {
        const adminHash = await bcrypt.hash(configuredAdminPassword, 10);
        await query(`
          INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [companyId, 'admin', adminHash, 'System Administrator', 'admin', 'admin@employeedb.local', true, 'ADM-001', false]);
        console.log('[Employee Database Studio Security] Initialized production Administrator account (username: admin).');
      } else {
        console.warn('[Employee Database Studio Security] No administrator account found and INITIAL_ADMIN_PASSWORD is not set in production.');
      }
    } else {
      const devAdminPassword = configuredAdminPassword || 'admin123';
      const adminHash = await bcrypt.hash(devAdminPassword, 10);
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'admin', adminHash, 'System Administrator', 'admin', 'admin@peopledesk.local', true, 'ADM-001', false]);
      console.log('[Employee Database Studio Security] Initialized development Administrator account (username: admin).');
    }
  } else if (!isProd && configuredAdminPassword) {
    const adminUser = adminRes.rows[0];
    if (!adminUser.last_login_at && !adminUser.must_change_password) {
      const matchesConfigured = await bcrypt.compare(configuredAdminPassword, adminUser.password_hash);
      if (!matchesConfigured) {
        const reconciledHash = await bcrypt.hash(configuredAdminPassword, 10);
        await query('UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3', [
          reconciledHash,
          false,
          adminUser.id
        ]);
      }
    }
  }

  // Seed sample role accounts ONLY in non-production local development when users table has only admin
  if (!isProd) {
    const allUsers = await query('SELECT id FROM users');
    if (allUsers.rows.length <= 1) {
      const defaultUserPassword = 'Password@123';
      const userHash = await bcrypt.hash(defaultUserPassword, 10);

      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'hr_lead', userHash, 'Eleanor Vance', 'hr', 'e.vance@apex.corp', true, 'EMP-1002', false]);

      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'payroll_mgr', userHash, 'Marcus Brody', 'payroll', 'm.brody@apex.corp', true, 'EMP-1004', false]);

      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'auditor', userHash, 'Sarah Jenkins', 'readonly', 's.jenkins@apex.corp', true, 'EMP-1008', false]);
    }
  }
}

let initPromise: Promise<void> | null = null;

/**
 * Cold-start safe initialization guard for serverless and standalone runtimes.
 * Runs once per warm container; resets on failure so transient errors can recover.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export function resetInitForTesting(): void {
  initPromise = null;
}
