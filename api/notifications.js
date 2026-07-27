import { database } from "../server/db.js";
import { fail, json } from "../server/security.js";

export default async function handler(req, res) {
  try {
    const expected = String(process.env.CRON_SECRET || "");
    const received = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!expected || received !== expected) return json(res, 401, { success: false, error: "Invalid cron authorization." });
    const webhook = process.env.SEND_INVOICE_WEBHOOK_URL;
    if (!webhook) throw Object.assign(new Error("Set SEND_INVOICE_WEBHOOK_URL before processing notifications."), { status: 503 });
    const [items] = await database().execute(
      `SELECT id,channel,notification_type type,recipient,subject
       FROM billing_notifications WHERE status IN ('queued','retry') AND scheduled_at<=NOW() AND attempts<5
       ORDER BY scheduled_at,id LIMIT 20`
    );
    let sent = 0;
    for (const item of items) {
      try {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.SEND_INVOICE_SECRET || "" },
          body: JSON.stringify({ notification: item })
        });
        if (!response.ok) throw new Error(`Delivery returned HTTP ${response.status}`);
        await database().execute("UPDATE billing_notifications SET status='sent',attempts=attempts+1,sent_at=NOW(),last_error=NULL WHERE id=?", [item.id]);
        sent += 1;
      } catch (error) {
        await database().execute(
          "UPDATE billing_notifications SET status='retry',attempts=attempts+1,last_error=? WHERE id=?",
          [String(error.message || error).slice(0, 1000), item.id]
        );
      }
    }
    return json(res, 200, { success: true, processed: items.length, sent });
  } catch (error) {
    return fail(res, error);
  }
}

