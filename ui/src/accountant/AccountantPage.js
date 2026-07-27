import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import {
  formatAmount,
  formatDueDate,
  formatDueDistance,
  getClientPaymentSummary,
  getDaysUntilDue,
  getNextDueDate,
  parseAmount,
  parseDateInput
} from "../shared";
function AccountantPage({ clients, payments, businessDate }) {
  const businessDateValue = parseDateInput(businessDate);
  const clientRows = clients.map((client) => {
    const summary = getClientPaymentSummary(client, payments, businessDateValue);
    const daysUntilDue = getDaysUntilDue(client, businessDateValue);
    return {
      client,
      summary,
      daysUntilDue,
      dueDate: getNextDueDate(client, businessDateValue)
    };
  }).sort((first, second) => {
    if (first.summary.overdueInvoiceCount !== second.summary.overdueInvoiceCount) {
      return second.summary.overdueInvoiceCount - first.summary.overdueInvoiceCount;
    }
    return second.summary.balanceDue - first.summary.balanceDue;
  });
  const totalReceivable = clientRows.reduce((total, row) => total + row.summary.balanceDue, 0);
  const overdueReceivable = clientRows.reduce(
    (total, row) => total + (row.summary.overdueInvoiceCount > 0 ? row.summary.balanceDue : 0),
    0
  );
  const unappliedPayments = clientRows.reduce((total, row) => total + row.summary.unappliedPayment, 0);
  const reviewCount = clients.filter((client) => client.status === "Draft" || client.status === "Needs approval").length;
  const overdueRows = clientRows.filter((row) => row.summary.overdueInvoiceCount > 0);
  const recentPayments = [...payments].sort((first, second) => second.paidAt.localeCompare(first.paidAt) || second.createdAt.localeCompare(first.createdAt)).slice(0, 6);
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  return /* @__PURE__ */ jsxs("section", { className: "page-stack accountant-workspace", children: [
    /* @__PURE__ */ jsxs("div", { className: "accountant-heading", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Finance operations" }),
        /* @__PURE__ */ jsx("h2", { children: "Accountant workspace" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Review receivables, payments, and billing exceptions for ",
          formatDueDate(businessDateValue),
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "accountant-heading-actions", children: [
        /* @__PURE__ */ jsx(Link, { className: "secondary-link-button", to: "/customers", children: "Client Management" }),
        /* @__PURE__ */ jsx(Link, { className: "primary-link-button", to: "/invoices", children: "Prepare invoices" })
      ] })
    ] }),
    ,
    /* @__PURE__ */ jsxs("div", { className: "accountant-summary", "aria-label": "Accounting summary", children: [
      /* @__PURE__ */ jsxs("article", { children: [
        /* @__PURE__ */ jsx("span", { children: "Accounts receivable" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(totalReceivable) }),
        /* @__PURE__ */ jsxs("small", { children: [
          clientRows.filter((row) => row.summary.balanceDue > 0).length,
          " open account(s)"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: overdueReceivable > 0 ? "attention" : "", children: [
        /* @__PURE__ */ jsx("span", { children: "Overdue receivable" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(overdueReceivable) }),
        /* @__PURE__ */ jsxs("small", { children: [
          overdueRows.length,
          " customer(s) overdue"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { children: [
        /* @__PURE__ */ jsx("span", { children: "Unapplied payments" }),
        /* @__PURE__ */ jsx("strong", { children: formatAmount(unappliedPayments) }),
        /* @__PURE__ */ jsx("small", { children: "Available customer credits" })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: reviewCount > 0 ? "review" : "", children: [
        /* @__PURE__ */ jsx("span", { children: "Needs review" }),
        /* @__PURE__ */ jsx("strong", { children: reviewCount }),
        /* @__PURE__ */ jsx("small", { children: "Drafts and approval items" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("nav", { className: "accountant-primary-actions", "aria-label": "Accountant actions", children: [
      /* @__PURE__ */ jsxs(Link, { to: "/invoices", children: [
        /* @__PURE__ */ jsx("span", { className: "accountant-action-icon", children: "+" }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Create monthly invoice" }),
          /* @__PURE__ */ jsx("small", { children: "Prepare and send the next customer invoice" })
        ] }),
        /* @__PURE__ */ jsx("b", { "aria-hidden": "true", children: "\u2192" })
      ] }),
      /* @__PURE__ */ jsxs(Link, { to: "/customers", children: [
        /* @__PURE__ */ jsx("span", { className: "accountant-action-icon customers", children: "\u25CE" }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: "View clients" }),
          /* @__PURE__ */ jsx("small", { children: "Review balances, due dates, and payment history" })
        ] }),
        /* @__PURE__ */ jsx("b", { "aria-hidden": "true", children: "\u2192" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "accountant-grid", children: [
      /* @__PURE__ */ jsxs("article", { className: "accountant-card receivables-card", children: [
        /* @__PURE__ */ jsxs("div", { className: "accountant-card-heading", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "AR" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { children: "Receivables ledger" }),
              /* @__PURE__ */ jsx("p", { children: "Customer balances ordered by collection priority" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(Link, { to: "/customers", children: "Open customers" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "accountant-table-wrap", children: [
          /* @__PURE__ */ jsxs("table", { className: "accountant-table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Customer" }),
              /* @__PURE__ */ jsx("th", { children: "Invoice" }),
              /* @__PURE__ */ jsx("th", { children: "Due date" }),
              /* @__PURE__ */ jsx("th", { children: "Balance" }),
              /* @__PURE__ */ jsx("th", { children: "Status" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: clientRows.map(({ client, summary, daysUntilDue, dueDate }) => {
              const isOverdue = summary.overdueInvoiceCount > 0;
              const isPaid = summary.balanceDue <= 0;
              const statusLabel = isPaid ? "Paid" : isOverdue ? formatDueDistance(daysUntilDue) : formatDueDistance(daysUntilDue);
              return /* @__PURE__ */ jsxs("tr", { children: [
                /* @__PURE__ */ jsxs("td", { children: [
                  /* @__PURE__ */ jsx("strong", { children: client.name }),
                  /* @__PURE__ */ jsx("small", { children: client.email })
                ] }),
                /* @__PURE__ */ jsx("td", { children: client.invoiceNumber }),
                /* @__PURE__ */ jsx("td", { children: formatDueDate(dueDate) }),
                /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("strong", { children: formatAmount(summary.balanceDue) }) }),
                /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `ledger-status ${isPaid ? "paid" : isOverdue ? "overdue" : "open"}`, children: statusLabel }) })
              ] }, client.id);
            }) })
          ] }),
          clientRows.length === 0 ? /* @__PURE__ */ jsx("p", { className: "accountant-empty", children: "No receivables yet. Add a customer to begin billing." }) : null
        ] })
      ] }),
      /* @__PURE__ */ jsxs("aside", { className: "accountant-card work-queue-card", children: [
        /* @__PURE__ */ jsx("div", { className: "accountant-card-heading compact", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token ceo", children: "Q" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Work queue" }),
            /* @__PURE__ */ jsx("p", { children: "Items requiring attention" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "accountant-queue", children: [
          /* @__PURE__ */ jsxs(Link, { to: "/customers", children: [
            /* @__PURE__ */ jsx("span", { className: "queue-icon danger", children: "!" }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Follow up overdue accounts" }),
              /* @__PURE__ */ jsxs("small", { children: [
                overdueRows.length,
                " customer(s) need collection review"
              ] })
            ] }),
            /* @__PURE__ */ jsx("b", { children: overdueRows.length })
          ] }),
          /* @__PURE__ */ jsxs(Link, { to: "/invoices", children: [
            /* @__PURE__ */ jsx("span", { className: "queue-icon warning", children: "\u2713" }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Review billing exceptions" }),
              /* @__PURE__ */ jsx("small", { children: "Draft and approval-gated invoices" })
            ] }),
            /* @__PURE__ */ jsx("b", { children: reviewCount })
          ] }),
          /* @__PURE__ */ jsxs(Link, { to: "/customers", children: [
            /* @__PURE__ */ jsx("span", { className: "queue-icon info", children: "\u20B1" }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Apply customer credits" }),
              /* @__PURE__ */ jsx("small", { children: "Payments not applied to an invoice" })
            ] }),
            /* @__PURE__ */ jsx("b", { children: unappliedPayments > 0 ? "1+" : "0" })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "accountant-bottom-grid", children: [
      /* @__PURE__ */ jsxs("article", { className: "accountant-card", children: [
        /* @__PURE__ */ jsx("div", { className: "accountant-card-heading", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "PAY" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Recent payments" }),
            /* @__PURE__ */ jsx("p", { children: "Latest receipts recorded in the customer ledger" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "payment-activity-list", children: [
          recentPayments.map((payment) => /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "payment-method", children: payment.method.slice(0, 2).toUpperCase() }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("strong", { children: clientNames.get(payment.clientId) || payment.clientId }),
              /* @__PURE__ */ jsxs("small", { children: [
                payment.referenceNumber || "No reference",
                " \xB7 ",
                payment.paidAt
              ] })
            ] }),
            /* @__PURE__ */ jsx("strong", { children: formatAmount(parseAmount(payment.amount)) })
          ] }, payment.id)),
          recentPayments.length === 0 ? /* @__PURE__ */ jsx("p", { className: "accountant-empty", children: "No payments have been recorded." }) : null
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "accountant-card close-card", children: [
        /* @__PURE__ */ jsx("div", { className: "accountant-card-heading compact", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "CHK" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Period checks" }),
            /* @__PURE__ */ jsx("p", { children: "Billing controls for the current cycle" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("ul", { className: "accountant-checklist", children: [
          /* @__PURE__ */ jsxs("li", { className: clients.length > 0 ? "complete" : "", children: [
            /* @__PURE__ */ jsx("span", {}),
            " Customer billing records loaded ",
            /* @__PURE__ */ jsx("strong", { children: clients.length })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: reviewCount === 0 ? "complete" : "", children: [
            /* @__PURE__ */ jsx("span", {}),
            " Invoice exceptions cleared ",
            /* @__PURE__ */ jsx("strong", { children: reviewCount })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: overdueRows.length === 0 ? "complete" : "", children: [
            /* @__PURE__ */ jsx("span", {}),
            " Overdue accounts reviewed ",
            /* @__PURE__ */ jsx("strong", { children: overdueRows.length })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: payments.length > 0 ? "complete" : "", children: [
            /* @__PURE__ */ jsx("span", {}),
            " Payment activity recorded ",
            /* @__PURE__ */ jsx("strong", { children: payments.length })
          ] })
        ] })
      ] })
    ] })
  ] });
}
export {
  AccountantPage as default
};
