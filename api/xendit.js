import crypto from "node:crypto";
import { database } from "../server/db.js";
import { body, fail, json, readSession, requireSession } from "../server/security.js";

function cleanAmount(value) {
  return Math.round((Number(String(value || "0").replace(/[^0-9.-]/g, "")) || 0) * 100) / 100;
}

async function webhook(req, res) {
  const expected = String(process.env.XENDIT_WEBHOOK_TOKEN || "");
  const received = String(req.headers["x-callback-token"] || "");
  if (!expected || !received || expected !== received) return json(res, 401, { success: false, error: "Invalid webhook token." });
  const input = await body(req);
  const eventKey = String(req.headers["webhook-id"] || input.id || input.data?.payment_id || input.data?.reference_id || "");
  if (eventKey) {
    try {
      await database().execute(
        `INSERT INTO webhook_events (provider,event_key,event_type,status,payload)
         VALUES ('xendit',?,?, 'processing',?)`,
        [eventKey, String(input.event || "unknown"), JSON.stringify(input)]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return json(res, 200, { success: true, duplicate: true });
      throw error;
    }
  }
  if (input.event !== "payment_session.completed") {
    if (input.data?.reference_id && /expired|failed|cancelled/i.test(String(input.event))) {
      await database().execute(
        "UPDATE xendit_payment_sessions SET status=? WHERE reference_id=? AND status<>'paid'",
        [String(input.event).split(".").pop().toLowerCase(), input.data.reference_id]
      );
    }
    if (eventKey) await database().execute("UPDATE webhook_events SET status='ignored',processed_at=NOW() WHERE provider='xendit' AND event_key=?", [eventKey]);
    return json(res, 200, { success: true, ignored: true });
  }
  const data = input.data || {};
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM xendit_payment_sessions WHERE reference_id=? FOR UPDATE", [data.reference_id]);
    const session = rows[0];
    if (!session || session.status === "paid") {
      await connection.commit();
      return json(res, 200, { success: true, duplicate: true });
    }
    const receiptNumber = `OR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    await connection.execute(
      `INSERT INTO monthly_invoice_payments
       (company_id,client_id,billing_email,amount,payment_date,method,reference_number,notes,receipt_number)
       VALUES (1,?,?,?,CURDATE(),'Xendit',?,'Confirmed automatically by Xendit webhook',?)`,
      [session.client_id, session.billing_email, session.amount, data.payment_id || data.reference_id, receiptNumber]
    );
    await connection.execute(
      "UPDATE xendit_payment_sessions SET status='paid',payment_id=?,webhook_id=?,paid_at=NOW() WHERE id=?",
      [data.payment_id || null, String(req.headers["webhook-id"] || "") || null, session.id]
    );
    await connection.commit();
    if (eventKey) await database().execute("UPDATE webhook_events SET status='processed',processed_at=NOW() WHERE provider='xendit' AND event_key=?", [eventKey]);
    return json(res, 200, { success: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default async function handler(req, res) {
  try {
    if (req.query?.webhook !== undefined) {
      if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
      return await webhook(req, res);
    }
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const input = await body(req);
    const authenticated = readSession(req);
    const portalToken = String(input.portal_token || "");
    if (!authenticated && !portalToken) requireSession(req);
    const portalHash = portalToken ? crypto.createHash("sha256").update(portalToken).digest("hex") : "";
    const email = String(input.client_id || "").trim().toLowerCase();
    let amount = cleanAmount(input.amount);
    if (!email || amount <= 0) throw Object.assign(new Error("A customer and positive amount are required."), { status: 422 });
    const [clients] = await database().execute(
      `SELECT id,customer_name,billing_email,invoice_number,monthly_amount
       FROM monthly_invoice_clients WHERE company_id=1 AND LOWER(billing_email)=?
       AND archived_at IS NULL AND (?='' OR portal_token_hash=?) LIMIT 1`,
      [email, portalHash, portalHash]
    );
    const client = clients[0];
    if (!client) throw Object.assign(new Error("Customer was not found."), { status: 404 });
    if (!authenticated) amount = Math.min(amount, cleanAmount(client.monthly_amount));
    const secret = process.env.XENDIT_SECRET_KEY;
    if (!secret) throw Object.assign(new Error("Set XENDIT_SECRET_KEY in Vercel."), { status: 503 });
    const referenceId = `VSS-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const publicUrl = String(process.env.APP_PUBLIC_URL || `https://${req.headers.host}`).replace(/\/$/, "");
    const givenNames = String(client.customer_name).replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 50) || "Customer";
    const response = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": referenceId
      },
      body: JSON.stringify({
        reference_id: referenceId, session_type: "PAY", mode: "PAYMENT_LINK", amount,
        currency: "PHP", country: "PH", locale: "en", capture_method: "AUTOMATIC",
        allow_save_payment_method: "DISABLED",
        customer: { reference_id: `client${client.id}`, type: "INDIVIDUAL", email, individual_detail: { given_names: givenNames } },
        description: `Payment for invoice ${client.invoice_number}`,
        success_return_url: `${publicUrl}/customers?payment=success`,
        cancel_return_url: `${publicUrl}/customers?payment=cancelled`,
        metadata: { client_email: email, invoice_number: String(client.invoice_number) }
      })
    });
    const session = await response.json().catch(() => ({}));
    if (!response.ok || !session.payment_link_url) throw Object.assign(new Error(session.message || "Xendit rejected the request."), { status: 502 });
    await database().execute(
      `INSERT INTO xendit_payment_sessions
       (company_id,client_id,billing_email,reference_id,payment_session_id,amount,currency,status,payment_link_url)
       VALUES (1,?,?,?,?,?,'PHP',?,?)`,
      [client.id, email, referenceId, session.payment_session_id || null, amount, String(session.status || "active").toLowerCase(), session.payment_link_url]
    );
    return json(res, 201, { success: true, payment_url: session.payment_link_url });
  } catch (error) {
    return fail(res, error);
  }
}
