import crypto from "node:crypto";
import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireSession } from "../server/security.js";

const statusName = (value) => {
  const status = String(value || "").toLowerCase();
  if (status === "draft") return "Draft";
  if (status === "sent") return "Sent";
  if (status === "needs approval" || status === "needs_approval") return "Needs approval";
  return "Scheduled";
};
const decimal = (value) => Number(String(value || "0").replace(/[^0-9.-]/g, "")) || 0;
const dateValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : null;
const intValue = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(value, 10) || fallback));

async function readStore() {
  await ensureCompany();
  const db = database();
  const [clients] = await db.execute(
    `SELECT LOWER(billing_email) id, id databaseId, COALESCE(customer_number,'') customerNumber,
      customer_name name, billing_email email, COALESCE(phone,'') phone,
      COALESCE(billing_address, '') address, invoice_number invoiceNumber,
      CAST(monthly_amount AS CHAR) amount, COALESCE(DATE_FORMAT(start_date, '%Y-%m-%d'), '') startDate,
      CAST(billing_day AS CHAR) billingDay, CAST(due_after_days AS CHAR) dueAfterDays,
      COALESCE(DATE_FORMAT(last_sent_at, '%b %e, %Y, %h:%i %p'), 'Not sent yet') lastSent,
      COALESCE(DATE_FORMAT(last_sent_due_date, '%Y-%m-%d'), '') lastSentDueDate, status
     FROM monthly_invoice_clients WHERE company_id = 1 AND archived_at IS NULL ORDER BY id`
  );
  const [payments] = await db.execute(
    `SELECT CONCAT('db-', id) id, LOWER(billing_email) clientId, CAST(amount AS CHAR) amount,
      DATE_FORMAT(payment_date, '%Y-%m-%d') paidAt, method,
      COALESCE(reference_number, '') referenceNumber, COALESCE(notes, '') notes,
      DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') createdAt
     FROM monthly_invoice_payments WHERE company_id = 1 ORDER BY payment_date, id`
  );
  return { clients: clients.map((client) => ({ ...client, status: statusName(client.status) })), payments };
}

async function upsertClient(client) {
  const email = String(client.email || client.id || "").trim().toLowerCase();
  if (!email) throw Object.assign(new Error("Client email is required."), { status: 422 });
  await ensureCompany();
  await database().execute(
    `INSERT INTO monthly_invoice_clients
      (company_id, customer_number, customer_name, billing_email, phone, billing_address, invoice_number, monthly_amount,
       start_date, billing_day, due_after_days, last_sent_due_date, status, updated_at)
     VALUES (1, NULLIF(?,''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE customer_name=VALUES(customer_name), billing_address=VALUES(billing_address),
       customer_number=COALESCE(VALUES(customer_number),customer_number), phone=VALUES(phone),
       invoice_number=VALUES(invoice_number), monthly_amount=VALUES(monthly_amount), start_date=VALUES(start_date),
       billing_day=VALUES(billing_day), due_after_days=VALUES(due_after_days),
       last_sent_due_date=VALUES(last_sent_due_date), status=VALUES(status), updated_at=NOW()`,
    [String(client.customerNumber || "").trim(), String(client.name || "Unnamed customer").trim(), email,
      String(client.phone || "").trim(), String(client.address || "").trim(),
      String(client.invoiceNumber || "").trim(), decimal(client.amount), dateValue(client.startDate),
      intValue(client.billingDay, 1, 1, 31), intValue(client.dueAfterDays, 14, 1, 90),
      dateValue(client.lastSentDueDate), statusName(client.status).toLowerCase()]
  );
}

async function recordPayment(payment) {
  const email = String(payment.clientId || "").trim().toLowerCase();
  if (!email) throw Object.assign(new Error("Payment client email is required."), { status: 422 });
  const receiptNumber = `OR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await database().execute(
    `INSERT INTO monthly_invoice_payments
      (company_id, client_id, billing_email, amount, payment_date, method, reference_number, notes, receipt_number)
     VALUES (1, (SELECT id FROM monthly_invoice_clients WHERE company_id=1 AND billing_email=? LIMIT 1), ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?)`,
    [email, email, decimal(payment.amount), dateValue(payment.paidAt), String(payment.method || "Cash"),
      String(payment.referenceNumber || "") || null, String(payment.notes || "") || null, receiptNumber]
  );
}

export default async function handler(req, res) {
  try {
    requireSession(req);
    if (req.method === "GET") return json(res, 200, { success: true, ...(await readStore()) });
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const input = await body(req);
    if (input.action === "upsert_client") await upsertClient(input.client || {});
    else if (input.action === "record_payment") await recordPayment(input.payment || {});
    else if (input.action === "delete_client" || input.action === "archive_client") {
      const email = String(input.client_id || "").toLowerCase();
      await database().execute("UPDATE monthly_invoice_clients SET archived_at=NOW(),status='archived' WHERE company_id=1 AND billing_email=?", [email]);
    } else if (input.action === "sync") {
      for (const client of input.clients || []) await upsertClient(client);
      const [[count]] = await database().execute("SELECT COUNT(*) count FROM monthly_invoice_payments WHERE company_id=1");
      if (!Number(count.count)) for (const payment of input.payments || []) await recordPayment(payment);
    } else throw Object.assign(new Error("Unknown action."), { status: 422 });
    return json(res, 200, { success: true, ...(await readStore()) });
  } catch (error) {
    return fail(res, error);
  }
}
