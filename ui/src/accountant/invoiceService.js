import {
  formatAmount,
  formatDueDate,
  getClientCycleStartDate,
  getClientPaymentSummary,
  getCycleInvoiceNumber,
  getNextDueDate,
  parseAmount
} from "../shared";
import { secureFetch } from "../apiSecurity";
const invoiceSendEndpoint = "/api/send-invoice";
const autoSendAttemptStorageKey = "ai-accountant-ceo-auto-send-attempts";
export const AUTO_SEND_LEAD_DAYS = 7;
export function loadAutoSendAttemptKeys() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(autoSendAttemptStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}
export function saveAutoSendAttemptKeys(keys) {
  try {
    window.localStorage.setItem(autoSendAttemptStorageKey, JSON.stringify([...new Set(keys)]));
  } catch {
  }
}
export function getAutoSendAttemptKey(client, dueDate) {
  return `${client.id}:${dueDate}`;
}
export async function sendInvoiceForClient(client, profile, referenceDate = /* @__PURE__ */ new Date(), payments = []) {
  const dueDate = getNextDueDate(client, referenceDate);
  const cycleStartDate = getClientCycleStartDate(client, referenceDate);
  const invoiceNumber = getCycleInvoiceNumber(client, cycleStartDate);
  const paymentSummary = getClientPaymentSummary(client, payments, referenceDate);
  const invoiceAmount = paymentSummary.invoices.length > 0 ? paymentSummary.balanceDue : parseAmount(client.amount);
  const previousBalance = Math.max(0, invoiceAmount - parseAmount(client.amount));
  const response = await secureFetch(invoiceSendEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: client.email,
      to_name: client.name,
      customer_address: client.address || "",
      from_alias: profile.gmailAlias,
      company_name: profile.companyName,
      invoice_number: invoiceNumber,
      monthly_amount: formatAmount(parseAmount(client.amount)),
      previous_balance: formatAmount(previousBalance),
      amount: formatAmount(invoiceAmount),
      billing_day: client.billingDay,
      due_date: formatDueDate(dueDate),
      subject: `Invoice ${invoiceNumber} from ${profile.companyName}`,
      body: `Hi ${client.name},

Attached is your invoice ${invoiceNumber} from ${profile.companyName}.

Current monthly charge: ${formatAmount(parseAmount(client.amount))}
Previous unpaid balance: ${formatAmount(previousBalance)}
Total amount due: ${formatAmount(invoiceAmount)}
Billing day: Day ${client.billingDay}
Due date: ${formatDueDate(dueDate)}
Payment reference: ${invoiceNumber}

Thank you,
${profile.companyName}`
    })
  });
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Send endpoint did not return JSON. Check the Vercel API deployment.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Invoice was not sent. Check the Gmail sender setup.");
  }
  return result;
}
