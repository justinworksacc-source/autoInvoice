import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireSession } from "../server/security.js";

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function manilaTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: process.env.APP_TIMEZONE || "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

async function ensureBusinessTimeColumn(db) {
  const [rows] = await db.execute(
    `SELECT column_name AS "columnName" FROM information_schema.columns
      WHERE table_schema=CURRENT_SCHEMA() AND table_name='business_dates' AND column_name='business_time'`
  );
  if (!rows.length) {
    try {
      await db.execute("ALTER TABLE business_dates ADD COLUMN IF NOT EXISTS business_time TIME NOT NULL DEFAULT '00:00:00'");
    } catch (error) {
      if (error?.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
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
    await ensureBusinessTimeColumn(db);
    if (req.method === "POST") {
      const input = await body(req);
      const value = input.action === "set" && /^\d{4}-\d{2}-\d{2}$/.test(String(input.business_date || "")) ? input.business_date : manilaDate();
      const time = input.action === "set" && /^\d{2}:\d{2}$/.test(String(input.business_time || "")) ? input.business_time : manilaTime();
      const source = input.action === "set" ? "manual" : "automatic";
      await db.execute(
        `INSERT INTO business_dates (company_id,business_date,business_time,source) VALUES (1,?,?,?)
         ON CONFLICT (company_id) DO UPDATE SET business_date=EXCLUDED.business_date,business_time=EXCLUDED.business_time,source=EXCLUDED.source`,
        [value, time, source]
      );
    }
    if (!["GET", "POST"].includes(req.method)) return json(res, 405, { success: false, error: "Method not allowed." });
    const [rows] = await db.execute(
      "SELECT TO_CHAR(business_date,'YYYY-MM-DD') AS business_date,TO_CHAR(business_time,'HH24:MI') AS business_time,source FROM business_dates WHERE company_id=1"
    );
    const today = manilaDate();
    const currentTime = manilaTime();
    const shouldSync = cronRequest || !rows.length || rows[0].source === "automatic";
    const value = shouldSync ? today : rows[0].business_date;
    const time = shouldSync ? currentTime : rows[0].business_time;
    if (shouldSync && (!rows.length || rows[0].business_date !== today || rows[0].business_time !== currentTime || rows[0].source !== "automatic")) {
      await db.execute(
        `INSERT INTO business_dates (company_id,business_date,business_time,source) VALUES (1,?,?,'automatic')
         ON CONFLICT (company_id) DO UPDATE SET business_date=EXCLUDED.business_date,business_time=EXCLUDED.business_time,source=EXCLUDED.source`,
        [today, currentTime]
      );
    }
    return json(res, 200, { success: true, business_date: value, business_time: time });
  } catch (error) {
    return fail(res, error);
  }
}
