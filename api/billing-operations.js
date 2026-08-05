import crypto from "node:crypto";
import { database, ensureCompany } from "../server/db.js";
import { body, fail, json, requireRole, requireSession } from "../server/security.js";

const money = (value) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
const allowedInvoiceStatuses = new Set(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"]);

async function audit(session, action, entityType, entityId, nextValue = null) {
  await database().execute(
    `INSERT INTO audit_logs
      (company_id,actor_type,actor_id,agent_name,action,entity_type,entity_id,new_value,approval_state)
     VALUES (1,'user',?,NULL,?,?,?,?, 'approved')`,
    [session.userId, action, entityType, entityId || null, nextValue ? JSON.stringify(nextValue) : null]
  );
}

async function overview() {
  await ensureCompany();
  const db = database();
  const [[totals]] = await db.execute(
    `SELECT
       COUNT(*)::int AS customer_count,
       COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS active_customer_count,
       COALESCE(SUM(CASE WHEN archived_at IS NULL THEN monthly_amount ELSE 0 END),0) AS monthly_billing
     FROM monthly_invoice_clients WHERE company_id=1`
  );
  const [[payments]] = await db.execute(
    `SELECT COALESCE(SUM(amount-refunded_amount),0) AS collected,
       COALESCE(SUM(refunded_amount),0) AS refunded,
       COUNT(*)::int AS payment_count
     FROM monthly_invoice_payments WHERE company_id=1`
  );
  const [invoices] = await db.execute(
    `SELECT c.id, c.invoice_number AS "invoiceNumber", c.billing_period AS "billingPeriod",
       TO_CHAR(c.due_date,'YYYY-MM-DD') AS "dueDate", c.total_amount AS "totalAmount",
       c.paid_amount AS "paidAmount", c.balance_due AS "balanceDue", c.status,
       p.customer_name AS "customerName", p.billing_email AS email
     FROM monthly_invoice_cycles c
     JOIN monthly_invoice_clients p ON p.id=c.client_id
     WHERE c.company_id=1 ORDER BY c.due_date DESC, c.id DESC LIMIT 250`
  );
  const [notifications] = await db.execute(
    `SELECT n.id,n.notification_type type,n.channel,n.recipient,n.subject,n.status,n.attempts,
       TO_CHAR(n.scheduled_at,'YYYY-MM-DD HH24:MI') AS "scheduledAt",
       TO_CHAR(n.sent_at,'YYYY-MM-DD HH24:MI') AS "sentAt"
     FROM billing_notifications n WHERE n.company_id=1 ORDER BY n.id DESC LIMIT 100`
  );
  const [activity] = await db.execute(
    `SELECT id,action,entity_type AS "entityType",entity_id AS "entityId",
       TO_CHAR(created_at,'YYYY-MM-DD HH24:MI') AS "createdAt"
     FROM audit_logs WHERE company_id=1 ORDER BY id DESC LIMIT 100`
  );
  return { totals, payments, invoices, notifications, activity };
}

async function updateInvoice(session, input) {
  requireRole(session, ["admin", "accountant"]);
  const id = Number(input.invoice_id);
  const status = String(input.status || "").toLowerCase();
  if (!id || !allowedInvoiceStatuses.has(status)) {
    throw Object.assign(new Error("A valid invoice and status are required."), { status: 422 });
  }
  const cancelled = status === "cancelled";
  const [result] = await database().execute(
    `UPDATE monthly_invoice_cycles SET status=?, viewed_at=IF(?='viewed',COALESCE(viewed_at,NOW()),viewed_at),
       cancelled_at=IF(?,NOW(),NULL),cancelled_reason=IF(?,?,NULL),updated_at=NOW()
     WHERE id=? AND company_id=1`,
    [status, status, cancelled, cancelled, String(input.reason || "").slice(0, 500), id]
  );
  if (!result.affectedRows) throw Object.assign(new Error("Invoice was not found."), { status: 404 });
  await audit(session, "invoice.status_changed", "invoice", id, { status });
}

async function queueReminder(session, input) {
  requireRole(session, ["admin", "accountant", "staff"]);
  const clientId = Number(input.client_id);
  const invoiceId = Number(input.invoice_id) || null;
  const type = String(input.type || "due_reminder");
  const [clients] = await database().execute(
    "SELECT id,customer_name,billing_email,invoice_number FROM monthly_invoice_clients WHERE id=? AND company_id=1 AND archived_at IS NULL",
    [clientId]
  );
  const client = clients[0];
  if (!client) throw Object.assign(new Error("Customer was not found."), { status: 404 });
  const subjectByType = {
    invoice: `Invoice ${client.invoice_number}`,
    due_reminder: `Payment reminder for ${client.invoice_number}`,
    overdue: `Overdue invoice ${client.invoice_number}`,
    payment_confirmation: `Payment received for ${client.invoice_number}`
  };
  await database().execute(
    `INSERT INTO billing_notifications
      (company_id,client_id,invoice_cycle_id,channel,notification_type,recipient,subject,status,scheduled_at)
     VALUES (1,?,?,?, ?,?,?,'queued',NOW())`,
    [client.id, invoiceId, input.channel === "sms" ? "sms" : "email", type,
      client.billing_email, subjectByType[type] || "Billing notification"]
  );
  await audit(session, "notification.queued", "customer", client.id, { type });
}

async function refund(session, input) {
  requireRole(session, ["admin", "accountant"]);
  const paymentId = Number(input.payment_id);
  const amount = money(input.amount);
  if (!paymentId || !amount || !String(input.reason || "").trim()) {
    throw Object.assign(new Error("Payment, refund amount, and reason are required."), { status: 422 });
  }
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [[payment]] = await connection.execute(
      "SELECT amount,refunded_amount FROM monthly_invoice_payments WHERE id=? AND company_id=1 FOR UPDATE",
      [paymentId]
    );
    if (!payment || amount > Number(payment.amount) - Number(payment.refunded_amount)) {
      throw Object.assign(new Error("Refund exceeds the available payment amount."), { status: 422 });
    }
    const reference = `REF-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    await connection.execute(
      `INSERT INTO payment_refunds (company_id,payment_id,amount,reason,external_reference,created_by)
       VALUES (1,?,?,?,?,?)`,
      [paymentId, amount, String(input.reason).trim(), reference, session.userId]
    );
    await connection.execute(
      "UPDATE monthly_invoice_payments SET refunded_amount=refunded_amount+? WHERE id=?",
      [amount, paymentId]
    );
    await connection.commit();
    await audit(session, "payment.refund_recorded", "payment", paymentId, { amount, reference });
    return reference;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function portalLink(session, input, req) {
  requireRole(session, ["admin", "accountant", "staff"]);
  const clientId = Number(input.client_id);
  if (!clientId) throw Object.assign(new Error("Customer is required."), { status: 422 });
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const [result] = await database().execute(
    "UPDATE monthly_invoice_clients SET portal_token_hash=? WHERE id=? AND company_id=1 AND archived_at IS NULL",
    [hash, clientId]
  );
  if (!result.affectedRows) throw Object.assign(new Error("Customer was not found."), { status: 404 });
  const publicUrl = String(process.env.APP_PUBLIC_URL || `https://${req.headers.host}`).replace(/\/$/, "");
  await audit(session, "portal.link_created", "customer", clientId);
  return `${publicUrl}/portal?token=${encodeURIComponent(token)}`;
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);
    if (req.method === "GET") return json(res, 200, { success: true, ...(await overview()) });
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const input = await body(req);
    let result = {};
    if (input.action === "update_invoice") await updateInvoice(session, input);
    else if (input.action === "queue_reminder") await queueReminder(session, input);
    else if (input.action === "record_refund") result.reference = await refund(session, input);
    else if (input.action === "create_portal_link") result.portal_url = await portalLink(session, input, req);
    else throw Object.assign(new Error("Unknown billing operation."), { status: 422 });
    return json(res, 200, { success: true, ...result, ...(await overview()) });
  } catch (error) {
    return fail(res, error);
  }
}
