import { database, ensureCompany, ensureInvoiceHistorySchema } from "./db.js";
import { deliverInvoice } from "../api/send-invoice.js";
import { ensureAutomationSettings } from "../api/automation-settings.js";

const LEAD_DAYS = 7;
const DAY_MS = 86_400_000;

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function dateFromKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function monthlyDate(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function cycleDates(client, todayKey) {
  const today = dateFromKey(todayKey);
  const start = client.startDate ? dateFromKey(client.startDate) : today;
  const billingDay = Math.min(31, Math.max(1, Number(client.billingDay) || start.getUTCDate()));
  let cycle = monthlyDate(today.getUTCFullYear(), today.getUTCMonth(), billingDay);
  if (cycle > today) cycle = monthlyDate(today.getUTCFullYear(), today.getUTCMonth() - 1, billingDay);
  if (cycle < start) cycle = start;
  const due = new Date(cycle.getTime() + Math.min(90, Math.max(1, Number(client.dueAfterDays) || 14)) * DAY_MS);
  return { cycle, due, sendOn: new Date(due.getTime() - LEAD_DAYS * DAY_MS) };
}

function amount(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function recordFailure(client, dueDate, error) {
  await database().execute(
    `INSERT INTO app_error_events (company_id,source,error_code,message,context)
     VALUES (1,'automatic-invoices','DELIVERY_FAILED',?,?::jsonb)`,
    [String(error?.message || error).slice(0, 1000), JSON.stringify({ clientId: client.id, email: client.email, dueDate })]
  ).catch(() => {});
}

export async function processAutomaticInvoices() {
  await ensureCompany();
  await ensureInvoiceHistorySchema();
  await ensureAutomationSettings();
  const db = database();
  const todayKey = manilaDate();
  const today = dateFromKey(todayKey);
  const [[profile]] = await db.execute(
    `SELECT name AS "companyName", COALESCE(gmail_sender_email,'') AS "gmailAlias",
       invoice_auto_send_enabled AS "autoSendEnabled"
       FROM companies WHERE id=1`
  );
  if (profile?.autoSendEnabled === false) {
    return { date: todayKey, enabled: false, checked: 0, eligible: 0, sent: 0, skipped: 0, failed: 0, failures: [] };
  }
  const [clients] = await db.execute(
    `SELECT id,customer_name AS name,billing_email AS email,COALESCE(billing_address,'') AS address,
       invoice_number AS "invoiceNumber",monthly_amount AS amount,
       COALESCE(TO_CHAR(start_date,'YYYY-MM-DD'),'') AS "startDate",billing_day AS "billingDay",
       due_after_days AS "dueAfterDays",COALESCE(item_type,'Service') AS "itemType",
       COALESCE(item_name,'Monthly service charge') AS "itemName",COALESCE(item_description,'') AS "itemDescription",
       COALESCE(TO_CHAR(last_sent_due_date,'YYYY-MM-DD'),'') AS "lastSentDueDate",status
     FROM monthly_invoice_clients
     WHERE company_id=1 AND archived_at IS NULL AND LOWER(status) NOT IN ('draft','needs approval','needs_approval','archived')
     ORDER BY id LIMIT 50`
  );
  let eligible = 0;
  let sent = 0;
  let skipped = 0;
  const failures = [];
  for (const client of clients) {
    const { cycle, due, sendOn } = cycleDates(client, todayKey);
    const dueDate = dateKey(due);
    if (today < sendOn || today > due || client.lastSentDueDate === dueDate) {
      skipped += 1;
      continue;
    }
    const [[history]] = await db.execute(
      `SELECT COUNT(*)::int AS count FROM invoice_send_history
       WHERE company_id=1 AND client_id=? AND due_date=? AND LOWER(delivery)='automatic'`,
      [client.id, dueDate]
    );
    if (history.count) {
      skipped += 1;
      continue;
    }
    eligible += 1;
    const billingPeriod = dateKey(cycle).slice(0, 7);
    const invoiceNumber = client.invoiceNumber.includes(billingPeriod.replace("-", ""))
      ? client.invoiceNumber
      : `${client.invoiceNumber}-${billingPeriod.replace("-", "")}`;
    const [[balances]] = await db.execute(
      `SELECT COALESCE(SUM(balance_due),0) AS balance FROM monthly_invoice_cycles
       WHERE company_id=1 AND client_id=? AND balance_due>0 AND status NOT IN ('paid','cancelled')`,
      [client.id]
    );
    const monthlyAmount = Number(client.amount) || 0;
    const previousBalance = Number(balances.balance) || 0;
    const totalAmount = monthlyAmount + previousBalance;
    const invoice = {
      to: client.email, to_name: client.name, customer_address: client.address,
      from_alias: profile?.gmailAlias || "", company_name: profile?.companyName || "Visual Security Systems",
      invoice_number: invoiceNumber, item_type: client.itemType, item_name: client.itemName,
      item_description: client.itemDescription, monthly_amount: amount(monthlyAmount),
      previous_balance: amount(previousBalance), amount: amount(totalAmount), billing_day: String(client.billingDay),
      due_date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(due),
      due_date_key: dueDate, delivery: "Automatic",
      subject: `Invoice ${invoiceNumber} from ${profile?.companyName || "Visual Security Systems"}`,
      body: `Hi ${client.name},\n\nAttached is your invoice ${invoiceNumber}.\n\nTotal amount due: ${amount(totalAmount)}\nDue date: ${dueDate}\nPayment reference: ${invoiceNumber}\n\nThank you,\n${profile?.companyName || "Visual Security Systems"}`
    };
    try {
      const result = await deliverInvoice(invoice);
      await db.execute(
        `INSERT INTO invoice_send_history
         (company_id,client_id,client_email,invoice_number,recipient,amount,due_date,delivery,message_id)
         VALUES (1,?,?,?,?,?,?,'Automatic',?)`,
        [client.id, client.email.toLowerCase(), invoiceNumber, client.email.toLowerCase(), totalAmount, dueDate, result.message_id || null]
      );
      await db.execute(
        `UPDATE monthly_invoice_clients SET last_sent_at=NOW(),last_sent_due_date=?,status='sent',updated_at=NOW()
         WHERE id=? AND company_id=1`,
        [dueDate, client.id]
      );
      sent += 1;
    } catch (error) {
      failures.push({ clientId: client.id, error: String(error?.message || error) });
      await recordFailure(client, dueDate, error);
    }
  }
  return { date: todayKey, enabled: true, checked: clients.length, eligible, sent, skipped, failed: failures.length, failures };
}
