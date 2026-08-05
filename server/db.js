import pg from "pg";

const { Pool } = pg;
let pool;

function postgresUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
}

function placeholders(sql) {
  let index = 0;
  let quote = null;
  let output = "";
  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position];
    if ((character === "'" || character === '"') && sql[position - 1] !== "\\") {
      quote = quote === character ? null : (quote || character);
    }
    output += character === "?" && !quote ? `$${++index}` : character;
  }
  return output;
}

function mysqlCompatibleResult(result) {
  if (result.command === "SELECT") return [result.rows, result.fields];
  return [{ affectedRows: result.rowCount, insertId: result.rows?.[0]?.id }, result.fields];
}

function adapter(queryable, release) {
  return {
    async execute(sql, values = []) {
      const result = await queryable.query(placeholders(sql), values);
      return mysqlCompatibleResult(result);
    },
    async beginTransaction() { await queryable.query("BEGIN"); },
    async commit() { await queryable.query("COMMIT"); },
    async rollback() { await queryable.query("ROLLBACK"); },
    release: release || (() => {})
  };
}

export function database() {
  if (!pool) {
    const connectionString = postgresUrl();
    if (!connectionString) {
      throw Object.assign(new Error("Set SUPABASE_DB_URL in Vercel to your Supabase PostgreSQL connection string."), { status: 503 });
    }
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false }
    });
  }
  const db = adapter(pool);
  db.getConnection = async () => {
    const client = await pool.connect();
    return adapter(client, () => client.release());
  };
  return db;
}

export async function ensureCompany() {
  await database().execute(
    `INSERT INTO companies (id, name, tenant_key)
     VALUES (1, 'Visual Security Systems', 'visual-security-systems')
     ON CONFLICT (id) DO UPDATE SET tenant_key = EXCLUDED.tenant_key`
  );
}

export async function ensureInvoiceHistorySchema() {
  await ensureCompany();
}

export async function ensureAuthSchema() {
  await ensureCompany();
  const [[superAdmin]] = await database().execute(
    "SELECT COUNT(*)::int AS count FROM auth_accounts WHERE role='super_admin'"
  );
  if (!superAdmin.count) {
    await database().execute(
      "UPDATE auth_accounts SET role='super_admin', is_active=TRUE WHERE LOWER(username)='visualsecsys'"
    );
  }
}
