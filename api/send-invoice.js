import { body, fail, json, requireSession } from "../server/security.js";

export default async function handler(req, res) {
  try {
    requireSession(req);
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const invoice = await body(req);
    if (!invoice.to || !invoice.invoice_number) throw Object.assign(new Error("Recipient and invoice number are required."), { status: 422 });
    const webhook = process.env.SEND_INVOICE_WEBHOOK_URL;
    if (!webhook) throw Object.assign(new Error("Set SEND_INVOICE_WEBHOOK_URL in Vercel to enable invoice delivery."), { status: 503 });
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.SEND_INVOICE_SECRET || "" },
      body: JSON.stringify({ secret: process.env.SEND_INVOICE_SECRET || "", invoice })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw Object.assign(new Error(result.error || "Invoice delivery webhook failed."), { status: 502 });
    return json(res, 200, { success: true, delivery: result.delivery || "webhook", message_id: result.message_id || null });
  } catch (error) {
    return fail(res, error);
  }
}
