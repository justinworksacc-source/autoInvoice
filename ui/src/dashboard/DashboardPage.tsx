import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { clampNumber, formatAmount, formatDueDate, getClientPaymentSummary, parseDateInput } from "../shared";
const sentDateFilterStorageKey = "vss-dashboard-sent-date-filter";
const selectedSentDateStorageKey = "vss-dashboard-selected-sent-date";
function loadSentDateFilter() {
  try {
    const savedFilter = sessionStorage.getItem(sentDateFilterStorageKey);
    const validFilters = ["today", "yesterday", "last7", "previous7", "custom", "all"];
    return validFilters.includes(savedFilter) ? savedFilter : "today";
  } catch {
    return "today";
  }
}
function loadSelectedSentDate() {
  try {
    return sessionStorage.getItem(selectedSentDateStorageKey) || manilaDateKey(/* @__PURE__ */ new Date());
  } catch {
    return manilaDateKey(/* @__PURE__ */ new Date());
  }
}
function manilaDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function parseClientLastSent(value) {
  if (!value || value === "Not sent yet") return null;
  const valueWithYear = /\b\d{4}\b/.test(value) ? value : `${value}, ${(/* @__PURE__ */ new Date()).getFullYear()}`;
  const parsed = new Date(valueWithYear);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function monthlyDate(year, month, billingDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(billingDay, lastDay));
}
function getUpcomingClientEvent(client, referenceDate, daysAfterBilling) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startDate = client.startDate ? parseDateInput(client.startDate) : today;
  const billingDay = clampNumber(client.billingDay, startDate.getDate(), 1, 31);
  let cycleDate = monthlyDate(today.getFullYear(), today.getMonth(), billingDay);
  while (cycleDate < startDate) {
    cycleDate = monthlyDate(cycleDate.getFullYear(), cycleDate.getMonth() + 1, billingDay);
  }
  let eventDate = new Date(cycleDate);
  eventDate.setDate(eventDate.getDate() + daysAfterBilling);
  while (eventDate < today) {
    cycleDate = monthlyDate(cycleDate.getFullYear(), cycleDate.getMonth() + 1, billingDay);
    eventDate = new Date(cycleDate);
    eventDate.setDate(eventDate.getDate() + daysAfterBilling);
  }
  return eventDate;
}
function findNextClientEvent(clients, referenceDate, offsetForClient) {
  return clients.map((client) => ({
    client,
    date: getUpcomingClientEvent(client, referenceDate, offsetForClient(client))
  })).sort((left, right) => left.date.getTime() - right.date.getTime())[0] || null;
}
function DashboardPage({ clients, payments, profile, session, businessDate, invoiceHistory, autoSendEnabled }) {
  const [sentDateFilter, setSentDateFilter] = useState(loadSentDateFilter);
  const [selectedSentDate, setSelectedSentDate] = useState(loadSelectedSentDate);
  const businessDateValue = parseDateInput(businessDate);
  const paymentSummaries = clients.map((client) => getClientPaymentSummary(client, payments, businessDateValue));
  const monthlyTotal = clients.reduce((total, client) => total + Number(client.amount.replace(/[^0-9.-]/g, "")), 0);
  const outstandingBalance = paymentSummaries.reduce((total, summary) => total + summary.balanceDue, 0);
  const recordedPayments = payments.reduce((total, payment) => total + Number(payment.amount.replace(/[^0-9.-]/g, "")), 0);
  const overdueClients = paymentSummaries.filter((summary) => summary.overdueInvoiceCount > 0).length;
  const scheduledCount = clients.filter((client) => client.status === "Scheduled").length;
  const draftCount = clients.filter((client) => client.status === "Draft").length;
  const needsApprovalCount = clients.filter((client) => client.status === "Needs approval").length;
  const nextInvoiceEvent = findNextClientEvent(clients, businessDateValue, () => 0);
  const nextDueEvent = findNextClientEvent(
    clients,
    businessDateValue,
    (client) => clampNumber(client.dueAfterDays, 14, 1, 90)
  );
  const nextAutoSendEvent = autoSendEnabled ? findNextClientEvent(
    clients,
    businessDateValue,
    (client) => clampNumber(client.dueAfterDays, 14, 1, 90) - 7
  ) : null;
  const recentClients = clients.slice(-5).reverse();
  const todayKey = manilaDateKey(/* @__PURE__ */ new Date());
  const startOfToday = Date.parse(`${todayKey}T00:00:00Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1e3;
  const recordedClientIds = new Set(invoiceHistory.map((entry) => entry.clientId));
  const legacySendHistory = clients.flatMap((client) => {
    const lastSent = parseClientLastSent(client.lastSent);
    if (!lastSent || recordedClientIds.has(client.id)) return [];
    return [{
      id: `legacy-${client.id}-${lastSent.getTime()}`,
      clientId: client.id,
      invoiceNumber: client.invoiceNumber,
      recipient: client.email,
      amount: client.amount,
      dueDate: client.lastSentDueDate || "",
      sentAt: lastSent.toISOString(),
      delivery: "Automatic"
    }];
  });
  const filteredInvoiceHistory = [...invoiceHistory, ...legacySendHistory].filter((entry) => {
    if (sentDateFilter === "all") return true;
    const entryDateKey = manilaDateKey(new Date(entry.sentAt));
    if (sentDateFilter === "custom") return entryDateKey === selectedSentDate;
    const sentDay = Date.parse(`${entryDateKey}T00:00:00Z`);
    const daysAgo = Math.round((startOfToday - sentDay) / millisecondsPerDay);
    if (sentDateFilter === "today") return daysAgo === 0;
    if (sentDateFilter === "yesterday") return daysAgo === 1;
    if (sentDateFilter === "last7") return daysAgo >= 0 && daysAgo < 7;
    return daysAgo >= 7 && daysAgo < 14;
  }).sort((left, right) => right.sentAt.localeCompare(left.sentAt));
  const yesterday = new Date(startOfToday - millisecondsPerDay);
  const filteredPeriodLabel = sentDateFilter === "custom" ? formatDueDate(parseDateInput(selectedSentDate)) : sentDateFilter === "today" ? formatDueDate(parseDateInput(todayKey)) : sentDateFilter === "yesterday" ? formatDueDate(parseDateInput(manilaDateKey(yesterday))) : sentDateFilter === "last7" ? "Last 7 days" : sentDateFilter === "previous7" ? "Previous 7 days" : "All time";
  const chartItems = [
    { label: "Scheduled", value: scheduledCount },
    { label: "Sent", value: filteredInvoiceHistory.length },
    { label: "Draft", value: draftCount },
    { label: "Review", value: needsApprovalCount }
  ];
  const largestChartValue = Math.max(...chartItems.map((item) => item.value), 1);
  return /* @__PURE__ */ jsxs("section", { className: "page-stack", children: [
    /* @__PURE__ */ jsxs("div", { className: "page-heading", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "AI accountant overview" }),
        /* @__PURE__ */ jsx("h2", { children: "Dashboard" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "status-pill", children: "Live billing overview" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "accountant-summary dashboard-summary", "aria-label": "Dashboard summary", children: [
      /* @__PURE__ */ jsxs("article", { children: [
        /* @__PURE__ */ jsx("span", { children: "Monthly billing" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(monthlyTotal) }),
        /* @__PURE__ */ jsxs("small", { children: [
          clients.length,
          " active billing account",
          clients.length === 1 ? "" : "s"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: outstandingBalance > 0 ? "attention" : "", children: [
        /* @__PURE__ */ jsx("span", { children: "Balance due" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(outstandingBalance) }),
        /* @__PURE__ */ jsxs("small", { children: [
          paymentSummaries.filter((summary) => summary.balanceDue > 0).length,
          " open account(s)"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { children: [
        /* @__PURE__ */ jsx("span", { children: "Payments logged" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(recordedPayments) }),
        /* @__PURE__ */ jsxs("small", { children: [
          payments.length,
          " recorded transaction",
          payments.length === 1 ? "" : "s"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: overdueClients > 0 ? "review" : "", children: [
        /* @__PURE__ */ jsx("span", { children: "Overdue clients" }),
        /* @__PURE__ */ jsx("strong", { children: overdueClients }),
        /* @__PURE__ */ jsx("small", { children: overdueClients > 0 ? "Collection review required" : "No overdue accounts" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "dashboard-layout", children: [
      /* @__PURE__ */ jsxs("article", { className: "dashboard-panel dashboard-main-panel", children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "FIN" }),
          /* @__PURE__ */ jsx("h3", { children: "Billing Command" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "dashboard-status-grid", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Next invoice cycle" }),
            /* @__PURE__ */ jsx("strong", { children: nextInvoiceEvent ? formatDueDate(nextInvoiceEvent.date) : "No clients" }),
            nextInvoiceEvent ? /* @__PURE__ */ jsx("small", { children: nextInvoiceEvent.client.name }) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Next automatic send" }),
            /* @__PURE__ */ jsx("strong", { children: autoSendEnabled ? nextAutoSendEvent ? formatDueDate(nextAutoSendEvent.date) : "No clients" : "Delivery is off" }),
            nextAutoSendEvent ? /* @__PURE__ */ jsx("small", { children: nextAutoSendEvent.client.name }) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Next payment due" }),
            /* @__PURE__ */ jsx("strong", { children: nextDueEvent ? formatDueDate(nextDueEvent.date) : "No clients" }),
            nextDueEvent ? /* @__PURE__ */ jsx("small", { children: nextDueEvent.client.name }) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Sender" }),
            /* @__PURE__ */ jsx("strong", { children: profile.gmailAlias })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Company" }),
            /* @__PURE__ */ jsx("strong", { children: profile.companyName })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Filtered period" }),
            /* @__PURE__ */ jsx("strong", { children: filteredPeriodLabel })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Logged in" }),
            /* @__PURE__ */ jsx("strong", { children: session.email })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "dashboard-chart", "aria-label": "Invoice status chart", children: chartItems.map((item) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { style: { height: `${Math.max(12, item.value / largestChartValue * 100)}%` } }),
          /* @__PURE__ */ jsx("strong", { children: item.value }),
          /* @__PURE__ */ jsx("small", { children: item.label })
        ] }, item.label)) })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "dashboard-panel quick-actions-panel", children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token ceo", children: "CEO" }),
          /* @__PURE__ */ jsx("h3", { children: "Business Health" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "dashboard-health-list", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Billing operation" }),
            /* @__PURE__ */ jsx("strong", { children: clients.length > 0 ? "Active" : "Setup needed" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Collection risk" }),
            /* @__PURE__ */ jsx("strong", { children: overdueClients > 0 ? `${overdueClients} overdue` : "Clear" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Invoices for review" }),
            /* @__PURE__ */ jsx("strong", { children: draftCount + needsApprovalCount })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "dashboard-panel sent-invoices-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "section-heading sent-invoices-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { children: "Sent Invoices" }),
          /* @__PURE__ */ jsxs("span", { children: [
            filteredInvoiceHistory.length,
            " invoice",
            filteredInvoiceHistory.length === 1 ? "" : "s",
            " found"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "dashboard-date-filter", children: [
          /* @__PURE__ */ jsx("span", { children: "Sent date" }),
          /* @__PURE__ */ jsxs("select", { value: sentDateFilter, onChange: (event) => {
            const nextFilter = event.target.value;
            setSentDateFilter(nextFilter);
            sessionStorage.setItem(sentDateFilterStorageKey, nextFilter);
          }, children: [
            /* @__PURE__ */ jsx("option", { value: "today", children: "Today" }),
            /* @__PURE__ */ jsx("option", { value: "yesterday", children: "Yesterday" }),
            /* @__PURE__ */ jsx("option", { value: "last7", children: "Last 7 days" }),
            /* @__PURE__ */ jsx("option", { value: "previous7", children: "Previous 7 days" }),
            /* @__PURE__ */ jsx("option", { value: "custom", children: "Choose date" }),
            /* @__PURE__ */ jsx("option", { value: "all", children: "All time" })
          ] }),
          sentDateFilter === "custom" ? /* @__PURE__ */ jsx("input", { type: "date", value: selectedSentDate, onChange: (event) => {
            setSelectedSentDate(event.target.value);
            sessionStorage.setItem(selectedSentDateStorageKey, event.target.value);
          } }) : null
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "sent-invoice-list", children: [
        filteredInvoiceHistory.map((entry) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("strong", { children: entry.invoiceNumber }),
            /* @__PURE__ */ jsx("small", { children: entry.recipient })
          ] }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("small", { children: "Amount" }),
            /* @__PURE__ */ jsx("strong", { children: formatAmount(Number(entry.amount.replace(/[^0-9.-]/g, ""))) })
          ] }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("small", { children: "Sent" }),
            /* @__PURE__ */ jsx("strong", { children: new Date(entry.sentAt).toLocaleString() })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "send-status sent", children: entry.delivery })
        ] }, entry.id)),
        filteredInvoiceHistory.length === 0 ? /* @__PURE__ */ jsx("p", { className: "dashboard-filter-empty", children: "No invoices were sent during this period." }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "dashboard-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "section-heading", children: [
        /* @__PURE__ */ jsx("h3", { children: "Recent Customers" }),
        /* @__PURE__ */ jsxs("span", { children: [
          clients.length,
          " saved client",
          clients.length === 1 ? "" : "s"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "dashboard-client-list", children: [
        recentClients.map((client) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: client.name }),
          /* @__PURE__ */ jsx("span", { children: client.email }),
          /* @__PURE__ */ jsx("span", { children: client.invoiceNumber }),
          /* @__PURE__ */ jsx("strong", { children: formatAmount(Number(client.amount.replace(/[^0-9.-]/g, ""))) }),
          /* @__PURE__ */ jsx("span", { className: `send-status ${client.status.toLowerCase().replace(/\s+/g, "-")}`, children: client.status })
        ] }, client.id)),
        recentClients.length === 0 ? /* @__PURE__ */ jsx("p", { children: "No customers yet." }) : null
      ] })
    ] })
  ] });
}
export {
  DashboardPage as default
};
