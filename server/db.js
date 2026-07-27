import mysql from "mysql2/promise";

let pool;

export function database() {
  if (!pool) {
    const host = process.env.DB_HOST;
    if (!host || host === "127.0.0.1" || host === "localhost") {
      throw Object.assign(new Error("Set DB_HOST to a public managed MySQL host in Vercel."), { status: 503 });
    }
    pool = mysql.createPool({
      host,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      enableKeepAlive: true,
      ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    });
  }
  return pool;
}

export async function ensureCompany() {
  await database().execute(
    `INSERT INTO companies (id, name, tenant_key)
     VALUES (1, 'Visual Security Systems', 'visual-security-systems')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`
  );
}
