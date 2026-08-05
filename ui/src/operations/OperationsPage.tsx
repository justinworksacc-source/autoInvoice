import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { secureFetch } from "../apiSecurity";
import { formatAmount, getClientPaymentSummary, parseAmount, parseDateInput } from "../shared";

const endpoint = "/api/billing-operations";
const invoiceStatuses = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"];

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function OperationsPage({ clients, payments, businessDate }) {
  const [data, setData] = useState({ invoices: [], notifications: [], activity: [] });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const summaries = useMemo(
    () => clients.map((client) => ({ client, ...getClientPaymentSummary(client, payments, parseDateInput(businessDate)) })),
    [clients, payments, businessDate]
  );
  const aging = summaries.reduce((result, item) => {
    if (item.balanceDue <= 0) return result;
    const days = Math.max(0, Math.floor((parseDateInput(businessDate).getTime() - item.nextDueDate.getTime()) / 864e5));
    const bucket = days === 0 ? "current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    result[bucket] += item.balanceDue;
    return result;
  }, { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });

  async function load() {
    try {
      const response = await secureFetch(endpoint);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load operations.");
      setData(result);
    } catch (error) {
      setNotice(error.message);
    }
  }
  useEffect(() => void load(), []);
  async function run(payload) {
    setBusy(true);
    setNotice("");
    try {
      const response = await secureFetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Operation failed.");
      setData(result);
      setNotice(payload.action === "create_portal_link" ? `Customer portal link: ${result.portal_url}` : "Operation completed.");
      if (result.portal_url) await navigator.clipboard?.writeText(result.portal_url);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  function exportCustomers() {
    downloadCsv("customers.csv", [
      ["Customer number", "Name", "Email", "Phone", "Address", "Monthly amount", "Status"],
      ...clients.map((client) => [client.customerNumber, client.name, client.email, client.phone, client.address, client.amount, client.status])
    ]);
  }
  function exportPayments() {
    downloadCsv("payments.csv", [
      ["Date", "Customer", "Amount", "Method", "Reference", "Notes"],
      ...payments.map((payment) => [payment.paidAt, payment.clientId, payment.amount, payment.method, payment.referenceNumber, payment.notes])
    ]);
  }
  return jsxs("section", { className: "page-stack operations-page", children: [
    jsxs("div", { className: "page-heading", children: [
      jsxs("div", { children: [jsx("p", { className: "eyebrow", children: "Billing control center" }), jsx("h2", { children: "Operations & Reports" }), jsx("p", { children: "Manage invoice status, reminders, customer access, reports, and audit history." })] }),
      jsxs("div", { className: "operations-actions", children: [
        jsx("button", { className: "secondary-button", onClick: exportCustomers, children: "Export customers CSV" }),
        jsx("button", { className: "secondary-button", onClick: exportPayments, children: "Export payments CSV" })
      ] })
    ] }),
    notice ? jsx("div", { className: notice.includes("completed") || notice.includes("portal") ? "saved-banner" : "database-banner error", children: notice }) : null,
    jsx("div", { className: "accountant-summary", children: Object.entries(aging).map(([label, amount]) => jsxs("article", { className: amount ? "attention" : "", children: [jsx("span", { children: `${label} days` }), jsx("strong", { children: formatAmount(amount) }), jsx("small", { children: "Receivables aging" })] }, label)) }),
    jsxs("div", { className: "operations-grid", children: [
      jsxs("article", { className: "dashboard-panel", children: [
        jsx("h3", { children: "Customer access & reminders" }),
        jsx("div", { className: "operations-list", children: clients.map((client) => jsxs("div", { children: [
          jsxs("span", { children: [jsx("strong", { children: client.name }), jsx("small", { children: client.email })] }),
          jsxs("span", { children: [jsx("strong", { children: formatAmount(parseAmount(client.amount)) }), jsx("small", { children: client.status })] }),
          jsx("button", { disabled: busy || !client.databaseId, onClick: () => run({ action: "queue_reminder", client_id: client.databaseId, type: "due_reminder" }), children: "Queue reminder" }),
          jsx("button", { className: "secondary-button", disabled: busy || !client.databaseId, onClick: () => run({ action: "create_portal_link", client_id: client.databaseId }), children: "Copy portal link" })
        ] }, client.id)) })
      ] }),
      jsxs("article", { className: "dashboard-panel", children: [
        jsx("h3", { children: "Invoice lifecycle" }),
        data.invoices?.length ? jsx("div", { className: "operations-list", children: data.invoices.map((invoice) => jsxs("div", { children: [
          jsxs("span", { children: [jsx("strong", { children: invoice.invoiceNumber }), jsx("small", { children: `${invoice.customerName} · Due ${invoice.dueDate}` })] }),
          jsx("strong", { children: formatAmount(invoice.balanceDue) }),
          jsx("select", { value: invoice.status, disabled: busy, onChange: (event) => run({ action: "update_invoice", invoice_id: invoice.id, status: event.target.value }), children: invoiceStatuses.map((status) => jsx("option", { value: status, children: status.replaceAll("_", " ") }, status)) })
        ] }, invoice.id)) }) : jsx("p", { children: "Invoice cycles will appear after the billing cycle is generated." })
      ] })
    ] }),
    jsxs("div", { className: "operations-grid", children: [
      jsxs("article", { className: "dashboard-panel", children: [
        jsx("h3", { children: "Notification queue" }),
        data.notifications?.length ? jsx("div", { className: "audit-list", children: data.notifications.map((item) => jsxs("div", { children: [jsx("strong", { children: item.type.replaceAll("_", " ") }), jsx("span", { children: item.recipient }), jsx("small", { children: `${item.status} · ${item.scheduledAt}` })] }, item.id)) }) : jsx("p", { children: "No queued reminders." })
      ] }),
      jsxs("article", { className: "dashboard-panel", children: [
        jsx("h3", { children: "Audit history" }),
        data.activity?.length ? jsx("div", { className: "audit-list", children: data.activity.map((item) => jsxs("div", { children: [jsx("strong", { children: item.action }), jsx("span", { children: item.entityType }), jsx("small", { children: item.createdAt })] }, item.id)) }) : jsx("p", { children: "No recorded operations yet." })
      ] })
    ] })
  ] });
}

export default OperationsPage;
