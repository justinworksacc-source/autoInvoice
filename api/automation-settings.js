import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireRole, requireSession } from "../server/security.js";

export async function ensureAutomationSettings() {
  await ensureCompany();
  await database().execute(
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_auto_send_enabled BOOLEAN NOT NULL DEFAULT TRUE"
  );
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);
    await ensureAutomationSettings();
    if (req.method === "POST") {
      requireRole(session, ["admin"]);
      const input = await body(req);
      if (typeof input.enabled !== "boolean") {
        throw Object.assign(new Error("Automatic sending must be enabled or disabled."), { status: 422 });
      }
      await database().execute("UPDATE companies SET invoice_auto_send_enabled=? WHERE id=1", [input.enabled]);
    } else if (req.method !== "GET") {
      return json(res, 405, { success: false, error: "Method not allowed." });
    }
    const [[settings]] = await database().execute(
      `SELECT invoice_auto_send_enabled AS enabled FROM companies WHERE id=1`
    );
    return json(res, 200, { success: true, enabled: settings?.enabled !== false });
  } catch (error) {
    return fail(res, error);
  }
}
