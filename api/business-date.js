import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireSession } from "../server/security.js";

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isCronRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && req.headers.authorization === `Bearer ${cronSecret}`;
}

export default async function handler(req, res) {
  try {
    const cronRequest = isCronRequest(req);
    if (!cronRequest) requireSession(req);
    await ensureCompany();
    const db = database();
    if (req.method === "POST") {
      const input = await body(req);
      const value = input.action === "set" && /^\d{4}-\d{2}-\d{2}$/.test(String(input.business_date || "")) ? input.business_date : manilaDate();
      const source = input.action === "set" ? "manual" : "automatic";
      await db.execute(
        "INSERT INTO business_dates (company_id,business_date,source) VALUES (1,?,?) ON DUPLICATE KEY UPDATE business_date=VALUES(business_date),source=VALUES(source)",
        [value, source]
      );
    }
    if (!["GET", "POST"].includes(req.method)) return json(res, 405, { success: false, error: "Method not allowed." });
    const [rows] = await db.execute("SELECT DATE_FORMAT(business_date,'%Y-%m-%d') business_date, source FROM business_dates WHERE company_id=1");
    const today = manilaDate();
    const shouldSync = cronRequest || !rows.length || rows[0].source === "automatic";
    const value = shouldSync ? today : rows[0].business_date;
    if (shouldSync && (!rows.length || rows[0].business_date !== today || rows[0].source !== "automatic")) {
      await db.execute(
        "INSERT INTO business_dates (company_id,business_date,source) VALUES (1,?,'automatic') ON DUPLICATE KEY UPDATE business_date=VALUES(business_date),source=VALUES(source)",
        [today]
      );
    }
    return json(res, 200, { success: true, business_date: value });
  } catch (error) {
    return fail(res, error);
  }
}
