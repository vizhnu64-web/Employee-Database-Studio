import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { getPool, resolvePostgresConnection } from '../src/server/db/pool';

dotenv.config();

const MIGRATION_LOCK_KEY = 8842101;

async function runMigrations() {
  const { connectionString, sourceVar } = resolvePostgresConnection('migration');
  if (!connectionString) {
    console.error('[Migrate] No PostgreSQL connection string configured. Set POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL.');
    process.exit(1);
  }

  console.log(`[Migrate] Connecting to PostgreSQL using ${sourceVar}...`);
  const pool = getPool('migration');
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migrate] No migrations directory found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const checkRes = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (checkRes.rows.length > 0) {
        console.log(`[Migrate] Skipping already applied migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`[Migrate] Applying migration: ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[Migrate] Applied migration: ${file}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Ensure at least one default company row exists (never deletes/overwrites existing)
    const compRes = await client.query('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
    let companyId: number;
    if (compRes.rows.length === 0) {
      const insertComp = await client.query(
        `INSERT INTO companies (company_name, address_line1, city_state_zip, currency_symbol, currency_name, authorized_signatory_name, authorized_signatory_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          'Apex Enterprise Solutions Inc.',
          '450 Innovation Parkway, Suite 800',
          'San Francisco, CA 94107',
          '$',
          'USD',
          'Eleanor Vance',
          'Director of Human Resources',
        ]
      );
      companyId = insertComp.rows[0].id;
      console.log('[Migrate] Created initial default company workspace.');
    } else {
      companyId = compRes.rows[0].id;
    }

    // Create initial admin account ONLY if no admin exists AND INITIAL_ADMIN_PASSWORD is explicitly provided
    const adminCheck = await client.query(
      "SELECT id FROM users WHERE role IN ('admin', 'super_admin') OR username = 'admin' LIMIT 1"
    );

    if (adminCheck.rows.length === 0) {
      const initPass = process.env.INITIAL_ADMIN_PASSWORD?.trim();
      if (initPass) {
        const hash = await bcrypt.hash(initPass, 10);
        await client.query(
          `INSERT INTO users (company_id, username, password_hash, full_name, role, email, is_active, employee_id, must_change_password)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [companyId, 'admin', hash, 'System Administrator', 'admin', 'admin@employeedb.local', true, 'ADM-001', false]
        );
        console.log('[Migrate] Initialized administrator user (username: admin).');
      } else {
        console.warn('[Migrate] No admin user exists and INITIAL_ADMIN_PASSWORD is not set. Skipping initial admin creation.');
      }
    }

    console.log('[Migrate] All migrations completed cleanly.');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

runMigrations().catch((err) => {
  console.error('[Migrate] Migration failed:', err?.message || err);
  process.exit(1);
});
