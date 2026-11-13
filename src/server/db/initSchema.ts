import { query } from './pool';
import bcrypt from 'bcrypt';

export async function initializeDatabase() {
  try {
    console.log('[Employee Database Studio DB] Initializing database schema...');

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
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    const adminRes = await query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminRes.rows.length === 0) {
      const adminHash = await bcrypt.hash(adminPassword, 10);
      await query(`
        INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [companyId, 'admin', adminHash, 'System Administrator', 'admin', 'admin@peopledesk.local', true, 'ADM-001', false]);
      console.log(`[Employee Database Studio Security] Initialized Administrator account. Username: admin`);
    } else {
      const adminUser = adminRes.rows[0];
      // Reconcile only if the default admin has never logged in and is not mid-password-reset
      if (!adminUser.last_login_at && !adminUser.must_change_password) {
        const matchesConfigured = await bcrypt.compare(adminPassword, adminUser.password_hash);
        if (!matchesConfigured) {
          const reconciledHash = await bcrypt.hash(adminPassword, 10);
          await query('UPDATE users SET password_hash = $1, must_change_password = $2 WHERE id = $3', [
            reconciledHash,
            false,
            adminUser.id
          ]);
          console.log('[Employee Database Studio Security] Synchronized initial Administrator credential on unused account.');
        }
      }
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

      console.log(`[Employee Database Studio Security] Seeded standard role accounts: hr_lead (HR), payroll_mgr (Payroll), auditor (Read-Only)`);
    }

    console.log('[Employee Database Studio DB] Database schema and initial credentials successfully initialized.');
  } catch (err) {
    console.error('[Employee Database Studio DB] Database initialization error:', err);
  }
}
