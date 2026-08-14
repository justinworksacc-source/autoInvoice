import { database, ensureCompany } from "./db.js";

export async function ensureAutomationSettings() {
  await ensureCompany();
  await database().execute(
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_auto_send_enabled BOOLEAN NOT NULL DEFAULT TRUE"
  );
}
