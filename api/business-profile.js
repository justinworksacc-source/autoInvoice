import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireSession } from "../server/security.js";

async function ensureProfileSchema() {
  await ensureCompany();
  const db = database();
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME columnName
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies'`
  );
  const columns = new Set(rows.map((row) => row.columnName));
  if (!columns.has("gmail_sender_email")) {
    try {
      await db.execute("ALTER TABLE companies ADD COLUMN gmail_sender_email VARCHAR(255) NULL");
    } catch (error) {
      if (error?.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
}

async function readProfile() {
  const [rows] = await database().execute(
    `SELECT name companyName, COALESCE(gmail_sender_email, '') gmailAlias
       FROM companies WHERE id = 1 LIMIT 1`
  );
  return rows[0] || { companyName: "Visual Security Systems", gmailAlias: "" };
}

export default async function handler(req, res) {
  try {
    requireSession(req);
    await ensureProfileSchema();
    if (req.method === "GET") {
      return json(res, 200, { success: true, profile: await readProfile() });
    }
    if (req.method !== "POST") {
      return json(res, 405, { success: false, error: "Method not allowed." });
    }
    const input = await body(req);
    const companyName = String(input.companyName || "").trim();
    const gmailAlias = String(input.gmailAlias || "").trim().toLowerCase();
    if (!companyName) {
      throw Object.assign(new Error("Company name is required."), { status: 422 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailAlias)) {
      throw Object.assign(new Error("Enter a valid Gmail sender email."), { status: 422 });
    }
    await database().execute(
      "UPDATE companies SET name = ?, gmail_sender_email = ? WHERE id = 1",
      [companyName, gmailAlias]
    );
    return json(res, 200, { success: true, profile: await readProfile() });
  } catch (error) {
    return fail(res, error);
  }
}
