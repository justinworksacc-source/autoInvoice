import mysql from "mysql2/promise";

let pool;

export function database() {
  if (!pool) {
    const host = process.env.DB_HOST;
    if (!host || host === "127.0.0.1" || host === "localhost") {
      throw Object.assign(new Error("Set DB_HOST to a public managed MySQL host in Vercel."), { status: 503 });
    }
    const sslEnabled = process.env.DB_SSL !== "false";
    const ca = String(process.env.DB_SSL_CA || "").replace(/\\n/g, "\n").trim();
    pool = mysql.createPool({
      host,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      enableKeepAlive: true,
      ssl: sslEnabled ? {
        ...(ca ? { ca } : {}),
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
      } : undefined
    });
  }
  return pool;
}

export async function ensureCompany() {
  const db = database();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS companies (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      tenant_key VARCHAR(100) UNIQUE NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await db.execute(
    `INSERT INTO companies (id, name, tenant_key)
     VALUES (1, 'Visual Security Systems', 'visual-security-systems')
     ON DUPLICATE KEY UPDATE tenant_key = VALUES(tenant_key)`
  );
}

let authSchemaPromise;

export async function ensureAuthSchema() {
  if (!authSchemaPromise) {
    authSchemaPromise = (async () => {
      const db = database();
      await ensureCompany();
      await db.execute(
        `CREATE TABLE IF NOT EXISTS auth_accounts (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          company_id BIGINT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          role VARCHAR(30) NOT NULL DEFAULT 'admin',
          full_name VARCHAR(255) NULL,
          last_login_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id)
        )`
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS auth_login_attempts (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX auth_login_attempts_lookup_idx (username, ip_address, attempted_at)
        )`
      );
      const [rows] = await db.execute(
        `SELECT COLUMN_NAME columnName
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_accounts'`
      );
      const columns = new Set(rows.map((row) => row.columnName));
      const additions = [
        ["role", "ALTER TABLE auth_accounts ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'admin'"],
        ["full_name", "ALTER TABLE auth_accounts ADD COLUMN full_name VARCHAR(255) NULL"],
        ["last_login_at", "ALTER TABLE auth_accounts ADD COLUMN last_login_at DATETIME NULL"]
      ];
      for (const [column, statement] of additions) {
        if (!columns.has(column)) {
          try {
            await db.execute(statement);
          } catch (error) {
            // Another cold-started function may have added the same column first.
            if (error?.code !== "ER_DUP_FIELDNAME") throw error;
          }
        }
      }
    })().catch((error) => {
      authSchemaPromise = undefined;
      throw error;
    });
  }
  return authSchemaPromise;
}
