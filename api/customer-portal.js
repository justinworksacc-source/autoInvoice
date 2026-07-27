import crypto from "node:crypto";
import { database } from "../server/db.js";
import { fail, json } from "../server/security.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return json(res, 405, { success: false, error: "Method not allowed." });
    const token = String(req.query?.token || "");
    if (token.length < 32) throw Object.assign(new Error("This portal link is invalid."), { status: 401 });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const [clients] = await database().execute(
      `SELECT id,customer_number customerNumber,customer_name name,billing_email email,
        billing_address address,invoice_number invoiceNumber,monthly_amount monthlyAmount
       FROM monthly_invoice_clients WHERE company_id=1 AND portal_token_hash=? AND archived_at IS NULL LIMIT 1`,
      [hash]
    );
    const client = clients[0];
    if (!client) throw Object.assign(new Error("This portal link has expired."), { status: 401 });
    const [invoices] = await database().execute(
      `SELECT id,invoice_number invoiceNumber,billing_period billingPeriod,
        DATE_FORMAT(due_date,'%Y-%m-%d') dueDate,total_amount totalAmount,
        paid_amount paidAmount,balance_due balanceDue,status
       FROM monthly_invoice_cycles WHERE company_id=1 AND client_id=? ORDER BY due_date DESC`,
      [client.id]
    );
    const [payments] = await database().execute(
      `SELECT id,amount,refunded_amount refundedAmount,DATE_FORMAT(payment_date,'%Y-%m-%d') paidAt,
        method,reference_number referenceNumber,receipt_number receiptNumber
       FROM monthly_invoice_payments WHERE company_id=1 AND client_id=? ORDER BY payment_date DESC,id DESC`,
      [client.id]
    );
    return json(res, 200, { success: true, client, invoices, payments });
  } catch (error) {
    return fail(res, error);
  }
}
