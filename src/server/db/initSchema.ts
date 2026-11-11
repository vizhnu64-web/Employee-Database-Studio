import { query } from './pool';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export async function initializeDatabase() {
  try {
    console.log('[PeopleDesk DB] Initializing database schema...');

    // Try executing DDL if PostgreSQL is active
    try {
      await query(`
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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
      `);
    } catch (e) {
      // Postgres table creation skipped if using file engine
    }

    // Ensure default company exists
    const compRes = await query('SELECT id FROM companies LIMIT 1');
    let companyId = 1;
    if (compRes.rows.length === 0) {
      const insertComp = await query(`
        INSERT INTO companies (company_name, address_line1, city_state_zip, currency_symbol, currency_name, authorized_signatory_name, authorized_signatory_title)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
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

    // Ensure default Administrator exists
    const adminRes = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminRes.rows.length === 0) {
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
      const adminHash = await bcrypt.hash(adminPassword, 10);
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'admin', adminHash, 'System Administrator', 'admin', 'admin@peopledesk.local', true, 'ADM-001', false]);
      console.log(`[PeopleDesk Security] Initialized Administrator account. Username: admin`);
    }

    // Seed sample role accounts for testing if users table has only admin
    const allUsers = await query('SELECT id FROM users');
    if (allUsers.rows.length <= 1) {
      const defaultUserPassword = 'Password@123';
      const userHash = await bcrypt.hash(defaultUserPassword, 10);

      // HR Specialist
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'hr_lead', userHash, 'Eleanor Vance', 'hr', 'e.vance@apex.corp', true, 'EMP-1002', false]);

      // Payroll Specialist
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'payroll_mgr', userHash, 'Marcus Brody', 'payroll', 'm.brody@apex.corp', true, 'EMP-1004', false]);

      // Read-Only Auditor
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'auditor', userHash, 'Sarah Jenkins', 'readonly', 's.jenkins@apex.corp', true, 'EMP-1008', false]);

      console.log(`[PeopleDesk Security] Seeded standard role accounts: hr_lead (HR), payroll_mgr (Payroll), auditor (Read-Only)`);
    }

    console.log('[PeopleDesk DB] Database schema and initial credentials successfully initialized.');
  } catch (err) {
    console.error('[PeopleDesk DB] Database initialization error:', err);
  }
}
