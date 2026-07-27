import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import usePostalPH from "use-postal-ph";
import {
  clampNumber,
  formatAmount,
  formatClientActiveDays,
  formatDateInput,
  formatDueDate,
  formatDueDistance,
  getClientActiveDays,
  getClientPaymentSummary,
  getClientPayments,
  getClientStartDate,
  getClientStartDateInput,
  getDaysUntilDue,
  getNextDueDate,
  isDateInput,
  parseAmount,
  parseDateInput
} from "../shared";
import { AUTO_SEND_LEAD_DAYS, getAutoSendAttemptKey, loadAutoSendAttemptKeys, saveAutoSendAttemptKeys, sendInvoiceForClient } from "./invoiceService";
import { secureFetch } from "../apiSecurity";
const customerPostalPlaces = usePostalPH().fetchDataLists().data;
function uniqueAddressValues(values) {
  return [...new Set(values.filter((value) => value !== void 0 && value !== ""))].sort((left, right) => String(left).localeCompare(String(right)));
}
function getNameInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "CRM";
  }
  return words.slice(0, 3).map((word) => word.charAt(0).toUpperCase()).join("");
}
function CustomersPage({
  clients,
  payments,
  profile,
  businessDate,
  setClients,
  setPayments,
  invoiceHistory,
  setInvoiceHistory,
  saveClientToDatabase,
  deleteClientFromDatabase,
  autoSendEnabled
}) {
  const [clientPendingDelete, setClientPendingDelete] = useState(null);
  const [clientPendingEdit, setClientPendingEdit] = useState(null);
  const [clientPendingSend, setClientPendingSend] = useState(null);
  const [clientPendingDueDate, setClientPendingDueDate] = useState(null);
  const [clientPendingHistory, setClientPendingHistory] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearchInput, setClientSearchInput] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("all");
  const [clientSort, setClientSort] = useState("name");
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAddressHouse, setEditAddressHouse] = useState("");
  const [editAddressStreet, setEditAddressStreet] = useState("");
  const [editAddressSubdivision, setEditAddressSubdivision] = useState("");
  const [editAddressBarangay, setEditAddressBarangay] = useState("");
  const [editAddressRegion, setEditAddressRegion] = useState("");
  const [editAddressProvince, setEditAddressProvince] = useState("");
  const [editAddressCity, setEditAddressCity] = useState("");
  const [editAddressPostalCode, setEditAddressPostalCode] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStartDate, setEditStartDate] = useState(formatDateInput());
  const [editDueAfterDays, setEditDueAfterDays] = useState("14");
  const [isSending, setIsSending] = useState(false);
  const [autoSendingClientIds, setAutoSendingClientIds] = useState([]);
  const [sendError, setSendError] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const [xenditClientId, setXenditClientId] = useState("");
  const businessDateValue = parseDateInput(businessDate);
  const pendingDueDate = clientPendingDueDate ? getNextDueDate(clientPendingDueDate, businessDateValue) : null;
  const pendingDueDays = clientPendingDueDate ? getDaysUntilDue(clientPendingDueDate, businessDateValue) : 0;
  const pendingActiveDays = clientPendingDueDate ? getClientActiveDays(clientPendingDueDate, businessDateValue) : 0;
  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const normalizedClientSearch = clientSearchQuery.trim().toLowerCase();
  const filteredClients = clients.filter((client) => {
    const matchesSearch = !normalizedClientSearch || [client.name, client.email, client.invoiceNumber, client.amount, String(client.billingDay)].some((value) => value.toLowerCase().includes(normalizedClientSearch));
    const summary = getClientPaymentSummary(client, payments, businessDateValue);
    const daysUntilDue = getDaysUntilDue(client, businessDateValue);
    const hasInvoices = summary.invoices.length > 0;
    const matchesStatus = clientStatusFilter === "all" || clientStatusFilter === "overdue" && summary.overdueInvoiceCount > 0 || clientStatusFilter === "unpaid" && summary.balanceDue > 0 || clientStatusFilter === "paid" && hasInvoices && summary.balanceDue <= 0 || clientStatusFilter === "upcoming" && daysUntilDue > 0 && summary.overdueInvoiceCount === 0;
    return matchesSearch && matchesStatus;
  }).sort((left, right) => {
    if (clientSort === "amount") {
      return parseAmount(right.amount) - parseAmount(left.amount);
    }
    if (clientSort === "balance") {
      return getClientPaymentSummary(right, payments, businessDateValue).balanceDue - getClientPaymentSummary(left, payments, businessDateValue).balanceDue;
    }
    if (clientSort === "due-date") {
      return getNextDueDate(left, businessDateValue).getTime() - getNextDueDate(right, businessDateValue).getTime();
    }
    return left.name.localeCompare(right.name);
  });
  const clientPageCount = Math.max(1, Math.ceil(filteredClients.length / clientPageSize));
  const safeClientPage = Math.min(clientPage, clientPageCount);
  const clientPageStart = (safeClientPage - 1) * clientPageSize;
  const paginatedClients = filteredClients.slice(clientPageStart, clientPageStart + clientPageSize);
  const editRegions = uniqueAddressValues(customerPostalPlaces.map((place) => place.region));
  const editProvincePlaces = customerPostalPlaces.filter((place) => place.region === editAddressRegion);
  const editProvinces = uniqueAddressValues(editProvincePlaces.map((place) => place.municipality));
  const editCityPlaces = editProvincePlaces.filter((place) => place.municipality === editAddressProvince);
  const editCities = uniqueAddressValues(editCityPlaces.map((place) => place.location));
  const editPostalCodes = uniqueAddressValues(editCityPlaces.filter((place) => !editAddressCity || place.location === editAddressCity).map((place) => place.post_code));
  function updateEditAddress(next) {
    const house = String(next.house ?? editAddressHouse);
    const street = String(next.street ?? editAddressStreet);
    const subdivision = String(next.subdivision ?? editAddressSubdivision);
    const barangay = String(next.barangay ?? editAddressBarangay);
    const province = String(next.municipality ?? editAddressProvince);
    const city = String(next.location ?? editAddressCity);
    const postalCode = String(next.post_code ?? editAddressPostalCode);
    setEditAddress([house, street, subdivision, barangay, city, province, postalCode, "Philippines"].filter(Boolean).join(", "));
  }
  function searchClients(event) {
    event.preventDefault();
    setClientSearchQuery(clientSearchInput);
  }
  function resetClientTable() {
    setClientSearchInput("");
    setClientSearchQuery("");
    setClientStatusFilter("all");
    setClientSort("name");
    setClientPage(1);
  }
  const selectedDueDays = selectedClient ? getDaysUntilDue(selectedClient, businessDateValue) : 0;
  const selectedActiveDays = selectedClient ? getClientActiveDays(selectedClient, businessDateValue) : 0;
  const selectedDueDate = selectedClient ? getNextDueDate(selectedClient, businessDateValue) : null;
  const selectedIsAutoSending = selectedClient ? autoSendingClientIds.includes(selectedClient.id) : false;
  const selectedPaymentSummary = selectedClient ? getClientPaymentSummary(selectedClient, payments, businessDateValue) : null;
  const selectedIsSettled = selectedPaymentSummary ? selectedPaymentSummary.invoices.length > 0 && selectedPaymentSummary.balanceDue <= 0 : false;
  const selectedOpenInvoices = selectedPaymentSummary ? selectedPaymentSummary.invoices.filter((invoice) => invoice.balanceDue > 0).slice(0, 4) : [];
  const selectedRecentPayments = selectedClient ? getClientPayments(selectedClient, payments).slice(-4).reverse() : [];
  const pendingSendSummary = clientPendingSend ? getClientPaymentSummary(clientPendingSend, payments, businessDateValue) : null;
  const pendingInvoiceHistory = clientPendingHistory ? invoiceHistory.filter((entry) => entry.clientId === clientPendingHistory.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt)) : [];
  async function payWithXendit(client) {
    const summary = getClientPaymentSummary(client, payments, businessDateValue);
    const amount = summary.invoices.length > 0 ? summary.balanceDue : parseAmount(client.amount);
    if (amount <= 0) {
      setSendNotice(`${client.name} has no outstanding balance.`);
      return;
    }
    setXenditClientId(client.id);
    setSendError("");
    try {
      const response = await secureFetch("/api/xendit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, amount })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.payment_url) {
        throw new Error(result.error || "Could not start Xendit checkout.");
      }
      window.location.assign(result.payment_url);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not start Xendit checkout.");
      setXenditClientId("");
    }
  }
  useEffect(() => {
    if (!autoSendEnabled) {
      setAutoSendingClientIds([]);
    }
    if (selectedClientId && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId("");
    }
  }, [autoSendEnabled, clients, selectedClientId]);
  useEffect(() => {
    if (!selectedClient) {
      return;
    }
    function closeDetailsOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedClientId("");
      }
    }
    window.addEventListener("keydown", closeDetailsOnEscape);
    return () => window.removeEventListener("keydown", closeDetailsOnEscape);
  }, [selectedClient]);
  useEffect(() => {
    setClientPage(1);
  }, [clientSearchQuery, clientStatusFilter, clientSort, clientPageSize]);
  useEffect(() => {
    const currentBusinessDate = parseDateInput(businessDate);
    const currentAttemptKeys = loadAutoSendAttemptKeys();
    const currentAttemptKeySet = new Set(currentAttemptKeys);
    const dueTodayClients = clients.map((client) => {
      const dueDateKey = formatDateInput(getNextDueDate(client, currentBusinessDate));
      return {
        client,
        dueDateKey,
        attemptKey: getAutoSendAttemptKey(client, dueDateKey)
      };
    }).filter(({ client, dueDateKey, attemptKey }) => {
      const canAutoSend = client.status !== "Draft" && client.status !== "Needs approval";
      return canAutoSend && getDaysUntilDue(client, currentBusinessDate) === AUTO_SEND_LEAD_DAYS && client.lastSentDueDate !== dueDateKey && !currentAttemptKeySet.has(attemptKey);
    });
    if (dueTodayClients.length === 0) {
      return;
    }
    saveAutoSendAttemptKeys([...currentAttemptKeys, ...dueTodayClients.map(({ attemptKey }) => attemptKey)]);
    setAutoSendingClientIds(dueTodayClients.map(({ client }) => client.id));
    let cancelled = false;
    async function sendDueTodayInvoices() {
      let sentCount = 0;
      for (const { client, dueDateKey } of dueTodayClients) {
        try {
          await sendInvoiceForClient(client, profile, currentBusinessDate, payments);
          if (cancelled) {
            return;
          }
          addInvoiceHistory(client, dueDateKey, "Automatic");
          const sentAt = new Intl.DateTimeFormat(void 0, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }).format(/* @__PURE__ */ new Date());
          setClients(
            (currentClients) => currentClients.map(
              (currentClient) => currentClient.id === client.id ? {
                ...currentClient,
                lastSent: sentAt,
                lastSentDueDate: dueDateKey,
                status: "Sent"
              } : currentClient
            )
          );
          sentCount += 1;
        } catch (error) {
          if (cancelled) {
            return;
          }
          setSendError(`Auto-send failed for ${client.name}: ${error instanceof Error ? error.message : "Invoice was not sent."}`);
        }
      }
      if (!cancelled) {
        setAutoSendingClientIds([]);
        if (sentCount > 0) {
          setSendNotice(`${sentCount} invoice${sentCount === 1 ? "" : "s"} sent automatically 7 days before the due date.`);
        }
      }
    }
    void sendDueTodayInvoices();
    return () => {
      cancelled = true;
    };
  }, [autoSendEnabled, businessDate, clients, payments, profile, setClients]);
  function startSendClient(client) {
    setSendError("");
    setSendNotice("");
    setClientPendingSend(client);
  }
  function startEditClient(client) {
    setClientPendingEdit(client);
    setEditName(client.name);
    setEditEmail(client.email);
    setEditAddress(client.address || "");
    setEditAddressHouse("");
    setEditAddressStreet("");
    setEditAddressSubdivision("");
    setEditAddressBarangay("");
    setEditAddressRegion("");
    setEditAddressProvince("");
    setEditAddressCity("");
    setEditAddressPostalCode("");
    setEditAmount(client.amount);
    setEditStartDate(getClientStartDateInput(client));
    setEditDueAfterDays(client.dueAfterDays || "14");
  }
  function addInvoiceHistory(client, dueDate, delivery) {
    setInvoiceHistory((currentHistory) => [{
      id: `${client.id}-${client.invoiceNumber}-${Date.now()}`,
      clientId: client.id,
      invoiceNumber: client.invoiceNumber,
      recipient: client.email,
      amount: client.amount,
      dueDate,
      sentAt: (/* @__PURE__ */ new Date()).toISOString(),
      delivery
    }, ...currentHistory]);
  }
  function saveEditedClient(event) {
    event.preventDefault();
    if (!clientPendingEdit) {
      return;
    }
    const nextEmail = editEmail.trim();
    const cleanStartDate = isDateInput(editStartDate) ? editStartDate : formatDateInput();
    const nextBillingDay = String(clampNumber(String(parseDateInput(cleanStartDate).getDate()), 1, 1, 31));
    const nextClient = {
      ...clientPendingEdit,
      id: nextEmail.toLowerCase(),
      name: editName.trim() || "Unnamed customer",
      email: nextEmail,
      address: editAddress.trim(),
      amount: editAmount.trim() || "0.00",
      startDate: cleanStartDate,
      billingDay: nextBillingDay,
      dueAfterDays: editDueAfterDays
    };
    setClients((currentClients) => currentClients.map((client) => client.id === clientPendingEdit.id ? nextClient : client));
    setPayments(
      (currentPayments) => currentPayments.map((payment) => payment.clientId === clientPendingEdit.id ? { ...payment, clientId: nextClient.id } : payment)
    );
    saveClientToDatabase(nextClient);
    setSelectedClientId(nextClient.id);
    setClientPendingEdit(null);
  }
  async function confirmSendNow() {
    if (!clientPendingSend || isSending) {
      return;
    }
    const dueDateKey = formatDateInput(getNextDueDate(clientPendingSend, businessDateValue));
    setIsSending(true);
    setSendError("");
    try {
      await sendInvoiceForClient(clientPendingSend, profile, businessDateValue, payments);
      addInvoiceHistory(clientPendingSend, dueDateKey, "Manual");
      const sentAt = new Intl.DateTimeFormat(void 0, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(/* @__PURE__ */ new Date());
      setClients(
        (currentClients) => currentClients.map(
          (client) => client.id === clientPendingSend.id ? {
            ...client,
            lastSent: sentAt,
            lastSentDueDate: dueDateKey,
            status: "Sent"
          } : client
        )
      );
      setSendNotice(`${clientPendingSend.invoiceNumber} sent to ${clientPendingSend.email}.`);
      setClientPendingSend(null);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Invoice was not sent. Check the Gmail sender setup on the backend.");
    } finally {
      setIsSending(false);
    }
  }
  function confirmDeleteClient() {
    if (!clientPendingDelete) {
      return;
    }
    setClients((currentClients) => currentClients.filter((client) => client.id !== clientPendingDelete.id));
    setPayments((currentPayments) => currentPayments.filter((payment) => payment.clientId !== clientPendingDelete.id));
    deleteClientFromDatabase(clientPendingDelete.id);
    setClientPendingDelete(null);
  }
  return /* @__PURE__ */ jsxs("section", { className: "page-stack customers-page", children: [
    /* @__PURE__ */ jsx("div", { className: "page-heading", children: /* @__PURE__ */ jsxs("div", { className: "customers-heading-content", children: [
      /* @__PURE__ */ jsx(Link, { to: "/accountant", className: "page-back-link", "aria-label": "Back to Accountant", title: "Back to Accountant", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M15 18 9 12l6-6" }) }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Billing records" }),
        /* @__PURE__ */ jsxs("div", { className: "customers-title-row", children: [
          /* @__PURE__ */ jsx("h2", { children: "Customers" }),
          /* @__PURE__ */ jsxs("span", { className: "status-pill", children: [
            clients.length,
            " active"
          ] })
        ] })
      ] })
    ] }) }),
    sendNotice ? /* @__PURE__ */ jsx("div", { className: "saved-banner", children: sendNotice }) : null,
    sendError && !clientPendingSend ? /* @__PURE__ */ jsx("div", { className: "error-banner", children: sendError }) : null,
    /* @__PURE__ */ jsxs("section", { className: "customers-workspace", children: [
      /* @__PURE__ */ jsxs("div", { className: "customers-list-panel", children: [
        /* @__PURE__ */ jsxs("div", { className: "section-heading", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Monthly Client List" }),
            /* @__PURE__ */ jsxs("span", { children: [
              clients.length,
              " client",
              clients.length === 1 ? "" : "s",
              " in billing run"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("form", { className: "client-search-form", role: "search", onSubmit: searchClients, children: [
            /* @__PURE__ */ jsx("label", { className: "sr-only", htmlFor: "client-search", children: "Search clients" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: "client-search",
                type: "search",
                placeholder: "Name, email, or invoice",
                value: clientSearchInput,
                onChange: (event) => {
                  const nextSearch = event.target.value;
                  setClientSearchInput(nextSearch);
                  if (!nextSearch.trim()) {
                    setClientSearchQuery("");
                  }
                }
              }
            ),
            /* @__PURE__ */ jsx("button", { type: "submit", children: "Search" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "client-table-toolbar", "aria-label": "Client table controls", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Status",
            /* @__PURE__ */ jsxs("select", { value: clientStatusFilter, onChange: (event) => setClientStatusFilter(event.target.value), children: [
              /* @__PURE__ */ jsx("option", { value: "all", children: "All statuses" }),
              /* @__PURE__ */ jsx("option", { value: "overdue", children: "Overdue" }),
              /* @__PURE__ */ jsx("option", { value: "unpaid", children: "Unpaid" }),
              /* @__PURE__ */ jsx("option", { value: "paid", children: "Paid" }),
              /* @__PURE__ */ jsx("option", { value: "upcoming", children: "Upcoming" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Sort by",
            /* @__PURE__ */ jsxs("select", { value: clientSort, onChange: (event) => setClientSort(event.target.value), children: [
              /* @__PURE__ */ jsx("option", { value: "name", children: "Name A\u2013Z" }),
              /* @__PURE__ */ jsx("option", { value: "balance", children: "Highest balance" }),
              /* @__PURE__ */ jsx("option", { value: "amount", children: "Highest amount" }),
              /* @__PURE__ */ jsx("option", { value: "due-date", children: "Due date" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "client-result-count", "aria-live": "polite", children: [
            filteredClients.length,
            " of ",
            clients.length,
            " client",
            clients.length === 1 ? "" : "s"
          ] }),
          clientSearchQuery || clientStatusFilter !== "all" || clientSort !== "name" ? /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", onClick: resetClientTable, children: "Reset" }) : null
        ] }),
        /* @__PURE__ */ jsx("div", { className: "client-table", children: /* @__PURE__ */ jsxs("table", { "aria-label": "Monthly invoice client list", children: [
          /* @__PURE__ */ jsxs("colgroup", { children: [
            /* @__PURE__ */ jsx("col", { className: "client-name-column" }),
            /* @__PURE__ */ jsx("col", { className: "client-email-column" }),
            /* @__PURE__ */ jsx("col", { className: "client-invoice-column" }),
            /* @__PURE__ */ jsx("col", { className: "client-money-column" }),
            /* @__PURE__ */ jsx("col", { className: "client-money-column" }),
            /* @__PURE__ */ jsx("col", { className: "client-schedule-column" })
          ] }),
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "client-head", children: [
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Client" }),
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Email" }),
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Invoice" }),
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Amount" }),
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Balance" }),
            /* @__PURE__ */ jsx("th", { scope: "col", children: "Schedule" })
          ] }) }),
          /* @__PURE__ */ jsxs("tbody", { children: [
            paginatedClients.map((client) => {
              const clientPaymentSummary = getClientPaymentSummary(client, payments, businessDateValue);
              const clientIsOverdue = clientPaymentSummary.overdueInvoiceCount > 0;
              const clientIsPaid = clientPaymentSummary.invoices.length > 0 && clientPaymentSummary.balanceDue <= 0;
              return /* @__PURE__ */ jsxs(
                "tr",
                {
                  className: `client-picker-row ${selectedClient?.id === client.id ? "active" : ""} ${clientIsOverdue ? "overdue" : clientIsPaid ? "paid" : ""}`,
                  tabIndex: 0,
                  onClick: () => setSelectedClientId(client.id),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedClientId(client.id);
                    }
                  },
                  children: [
                    /* @__PURE__ */ jsx("th", { scope: "row", children: /* @__PURE__ */ jsxs("span", { className: "client-name-cell", children: [
                      /* @__PURE__ */ jsx("span", { className: "client-table-avatar", "aria-hidden": "true", children: getNameInitials(client.name).slice(0, 2) }),
                      /* @__PURE__ */ jsx("span", { children: client.name })
                    ] }) }),
                    /* @__PURE__ */ jsx("td", { title: client.email, children: client.email }),
                    /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "invoice-number-chip", children: client.invoiceNumber }) }),
                    /* @__PURE__ */ jsx("td", { className: "client-money-value", children: client.amount }),
                    /* @__PURE__ */ jsx("td", { className: `client-balance-value ${clientIsOverdue ? "overdue" : clientIsPaid ? "paid" : ""}`, children: formatAmount(clientPaymentSummary.balanceDue) }),
                    /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("span", { className: "billing-day-chip", children: [
                      "Day ",
                      client.billingDay
                    ] }) })
                  ]
                },
                client.id
              );
            }),
            filteredClients.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsxs("td", { className: "client-search-empty", colSpan: 6, children: [
              "No clients match \u201C",
              clientSearchQuery.trim(),
              "\u201D."
            ] }) }) : null
          ] })
        ] }) }),
        filteredClients.length > 0 ? /* @__PURE__ */ jsxs("nav", { className: "client-pagination", "aria-label": "Client list pagination", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "Showing ",
            clientPageStart + 1,
            "\u2013",
            Math.min(clientPageStart + clientPageSize, filteredClients.length),
            " of ",
            filteredClients.length
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Rows",
            /* @__PURE__ */ jsxs("select", { value: clientPageSize, onChange: (event) => setClientPageSize(Number(event.target.value)), children: [
              /* @__PURE__ */ jsx("option", { value: 10, children: "10" }),
              /* @__PURE__ */ jsx("option", { value: 25, children: "25" }),
              /* @__PURE__ */ jsx("option", { value: 50, children: "50" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "client-page-buttons", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", disabled: safeClientPage === 1, onClick: () => setClientPage((page) => Math.max(1, page - 1)), children: "Previous" }),
            Array.from({ length: clientPageCount }, (_, index) => index + 1).filter((page) => page === 1 || page === clientPageCount || Math.abs(page - safeClientPage) <= 1).map((page, index, visiblePages) => /* @__PURE__ */ jsxs("span", { className: "client-page-number", children: [
              index > 0 && page - visiblePages[index - 1] > 1 ? /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2026" }) : null,
              /* @__PURE__ */ jsx("button", { type: "button", className: page === safeClientPage ? "active" : "secondary-button", "aria-current": page === safeClientPage ? "page" : void 0, onClick: () => setClientPage(page), children: page })
            ] }, page)),
            /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", disabled: safeClientPage === clientPageCount, onClick: () => setClientPage((page) => Math.min(clientPageCount, page + 1)), children: "Next" })
          ] })
        ] }) : null
      ] }),
      selectedClient ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop customer-details-backdrop", role: "presentation", onMouseDown: () => setSelectedClientId(""), children: /* @__PURE__ */ jsxs("aside", { className: "customer-side-panel customer-details-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "customer-details-title", onMouseDown: (event) => event.stopPropagation(), children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "customer-details-close", "aria-label": "Close customer details", onClick: () => setSelectedClientId(""), children: "\xD7" }),
        /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: selectedClient ? getNameInitials(selectedClient.name) : "CRM" }),
          /* @__PURE__ */ jsxs("div", { className: "panel-heading-text", children: [
            /* @__PURE__ */ jsx("h3", { id: "customer-details-title", children: selectedClient ? selectedClient.name : "Customer Panel" }),
            selectedClient && /* @__PURE__ */ jsx("span", { className: "selected-customer-email", children: selectedClient.email })
          ] })
        ] }),
        selectedClient ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "selected-customer" }),
          /* @__PURE__ */ jsxs("div", { className: "customer-summary-grid", children: [
            /* @__PURE__ */ jsxs("div", { className: `due-check detail-due-check ${selectedIsSettled ? "settled" : selectedDueDays < 0 ? "overdue" : selectedDueDays === 0 ? "due-today" : "upcoming"}`, children: [
              /* @__PURE__ */ jsx("span", { className: "customer-summary-label", children: "Due date" }),
              /* @__PURE__ */ jsx("strong", { children: selectedIsSettled ? "Paid" : formatClientActiveDays(selectedActiveDays) }),
              /* @__PURE__ */ jsx("small", { children: selectedIsSettled ? "Current cycle settled" : formatDueDistance(selectedDueDays) })
            ] }),
            selectedPaymentSummary ? /* @__PURE__ */ jsxs("div", { className: `balance-card ${selectedPaymentSummary.balanceDue > 0 ? "has-balance" : "settled"}`, children: [
              /* @__PURE__ */ jsx("span", { children: "Balance due" }),
              /* @__PURE__ */ jsx("strong", { children: formatAmount(selectedPaymentSummary.balanceDue) }),
              /* @__PURE__ */ jsxs("small", { children: [
                selectedPaymentSummary.unpaidInvoiceCount,
                " unpaid cycle",
                selectedPaymentSummary.unpaidInvoiceCount === 1 ? "" : "s",
                selectedPaymentSummary.unappliedPayment > 0 ? ` | ${formatAmount(selectedPaymentSummary.unappliedPayment)} credit` : ""
              ] })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "customer-panel-actions", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "payment-client-button",
                onClick: () => void payWithXendit(selectedClient),
                disabled: xenditClientId === selectedClient.id || selectedIsSettled,
                children: xenditClientId === selectedClient.id ? "Opening Xendit..." : selectedIsSettled ? "Paid" : "Pay with Xendit"
              }
            ),
            /* @__PURE__ */ jsx("button", { type: "button", className: "payment-client-button", onClick: () => setClientPendingHistory(selectedClient), children: "Invoice history" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "send-client-button", onClick: () => startSendClient(selectedClient), disabled: selectedIsAutoSending, children: selectedIsAutoSending ? "Auto sending..." : "Send now" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "calendar-client-button",
                "aria-label": `View due date for ${selectedClient.name}`,
                title: "View due date",
                onClick: () => setClientPendingDueDate(selectedClient),
                children: /* @__PURE__ */ jsx("span", { className: "calendar-icon", "aria-hidden": "true" })
              }
            ),
            /* @__PURE__ */ jsx("button", { type: "button", className: "edit-client-button", onClick: () => startEditClient(selectedClient), children: "Edit" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "delete-client-button", onClick: () => setClientPendingDelete(selectedClient), children: "Delete" })
          ] }),
          /* @__PURE__ */ jsxs("dl", { className: "customer-detail-list", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Status" }),
              /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", { className: `send-status ${selectedClient.status.toLowerCase().replace(/\s+/g, "-")}`, children: selectedClient.status }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Start date" }),
              /* @__PURE__ */ jsx("dd", { children: formatDueDate(getClientStartDate(selectedClient)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Due date" }),
              /* @__PURE__ */ jsx("dd", { children: selectedDueDate ? formatDueDate(selectedDueDate) : "-" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Invoice" }),
              /* @__PURE__ */ jsx("dd", { children: selectedClient.invoiceNumber })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Amount" }),
              /* @__PURE__ */ jsx("dd", { children: selectedClient.amount })
            ] }),
            selectedPaymentSummary ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("dt", { children: "Total billed" }),
                /* @__PURE__ */ jsx("dd", { children: formatAmount(selectedPaymentSummary.totalBilled) })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("dt", { children: "Total paid" }),
                /* @__PURE__ */ jsx("dd", { children: formatAmount(selectedPaymentSummary.totalPaid) })
              ] })
            ] }) : null,
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { children: "Billing day" }),
              /* @__PURE__ */ jsxs("dd", { children: [
                "Day ",
                selectedClient.billingDay
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ledger-section", children: [
            /* @__PURE__ */ jsx("h4", { children: "Open invoices" }),
            selectedOpenInvoices.length > 0 ? selectedOpenInvoices.map((invoice) => /* @__PURE__ */ jsxs("div", { className: "ledger-row", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("strong", { children: invoice.billingPeriod }),
                /* @__PURE__ */ jsx("span", { children: formatDueDate(invoice.dueDate) })
              ] }),
              /* @__PURE__ */ jsx("span", { className: `ledger-status ${invoice.status}`, children: invoice.status }),
              /* @__PURE__ */ jsx("strong", { children: formatAmount(invoice.balanceDue) })
            ] }, invoice.cycleKey)) : /* @__PURE__ */ jsx("p", { children: "No unpaid invoices." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ledger-section", children: [
            /* @__PURE__ */ jsx("h4", { children: "Recent payments" }),
            selectedRecentPayments.length > 0 ? selectedRecentPayments.map((payment) => /* @__PURE__ */ jsxs("div", { className: "ledger-row", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("strong", { children: formatAmount(parseAmount(payment.amount)) }),
                /* @__PURE__ */ jsx("span", { children: formatDueDate(parseDateInput(payment.paidAt)) })
              ] }),
              /* @__PURE__ */ jsx("span", { children: payment.method }),
              /* @__PURE__ */ jsx("strong", { children: payment.referenceNumber || "-" })
            ] }, payment.id)) : /* @__PURE__ */ jsx("p", { children: "No payments recorded." })
          ] })
        ] }) : /* @__PURE__ */ jsx("p", { className: "empty-panel-copy", children: "No customers saved yet." })
      ] }) }) : null
    ] }),
    clientPendingSend ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxs("div", { className: "confirm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "send-client-title", children: [
      /* @__PURE__ */ jsx("h3", { id: "send-client-title", children: "Send this invoice now?" }),
      /* @__PURE__ */ jsxs("p", { children: [
        clientPendingSend.invoiceNumber,
        " will be sent to ",
        clientPendingSend.name,
        " <",
        clientPendingSend.email,
        "> immediately."
      ] }),
      pendingSendSummary ? /* @__PURE__ */ jsxs("dl", { className: "due-details", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Amount due" }),
          /* @__PURE__ */ jsx("dd", { children: formatAmount(pendingSendSummary.invoices.length > 0 ? pendingSendSummary.balanceDue : parseAmount(clientPendingSend.amount)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Unpaid cycles" }),
          /* @__PURE__ */ jsx("dd", { children: pendingSendSummary.unpaidInvoiceCount })
        ] })
      ] }) : null,
      sendError ? /* @__PURE__ */ jsx("p", { className: "dialog-error", children: sendError }) : null,
      /* @__PURE__ */ jsxs("div", { className: "button-row", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", onClick: () => setClientPendingSend(null), disabled: isSending, children: "Cancel" }),
        /* @__PURE__ */ jsx("button", { type: "button", onClick: confirmSendNow, disabled: isSending, children: isSending ? "Sending..." : "Send now" })
      ] })
    ] }) }) : null,
    clientPendingHistory ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxs("div", { className: "confirm-dialog invoice-history-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "invoice-history-title", children: [
      /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
        /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "HIS" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { id: "invoice-history-title", children: "Invoice history" }),
          /* @__PURE__ */ jsx("span", { children: clientPendingHistory.name })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "invoice-history-list", children: [
        pendingInvoiceHistory.map((entry) => /* @__PURE__ */ jsxs("article", { children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("strong", { children: entry.invoiceNumber }),
            /* @__PURE__ */ jsxs("span", { children: [
              "Sent ",
              new Date(entry.sentAt).toLocaleString()
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: entry.delivery }),
            /* @__PURE__ */ jsx("strong", { children: formatAmount(parseAmount(entry.amount)) })
          ] }),
          /* @__PURE__ */ jsxs("small", { children: [
            "To ",
            entry.recipient,
            " \xB7 Due ",
            formatDueDate(parseDateInput(entry.dueDate))
          ] })
        ] }, entry.id)),
        pendingInvoiceHistory.length === 0 ? /* @__PURE__ */ jsx("p", { children: "No invoices have been sent to this customer yet." }) : null
      ] }),
      /* @__PURE__ */ jsx("div", { className: "button-row", children: /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setClientPendingHistory(null), children: "Close" }) })
    ] }) }) : null,
    clientPendingDueDate ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxs("div", { className: "confirm-dialog due-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "due-client-title", children: [
      /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
        /* @__PURE__ */ jsx("span", { className: "agent-token accountant", children: "DUE" }),
        /* @__PURE__ */ jsx("h3", { id: "due-client-title", children: "Due date" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: `due-summary ${pendingDueDays < 0 ? "overdue" : pendingDueDays === 0 ? "due-today" : ""}`, children: [
        /* @__PURE__ */ jsx("strong", { children: formatDueDistance(pendingDueDays) }),
        /* @__PURE__ */ jsx("span", { children: pendingDueDate ? formatDueDate(pendingDueDate) : "" })
      ] }),
      /* @__PURE__ */ jsxs("dl", { className: "due-details", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Business date" }),
          /* @__PURE__ */ jsx("dd", { children: formatDueDate(businessDateValue) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Start date" }),
          /* @__PURE__ */ jsx("dd", { children: formatDueDate(getClientStartDate(clientPendingDueDate)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Client day" }),
          /* @__PURE__ */ jsx("dd", { children: formatClientActiveDays(pendingActiveDays) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Client" }),
          /* @__PURE__ */ jsx("dd", { children: clientPendingDueDate.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Billing day" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            "Day ",
            clientPendingDueDate.billingDay
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Due after" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            clientPendingDueDate.dueAfterDays || "14",
            " days"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "button-row", children: /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setClientPendingDueDate(null), children: "Close" }) })
    ] }) }) : null,
    clientPendingEdit ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxs("form", { className: "confirm-dialog edit-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "edit-client-title", onSubmit: saveEditedClient, children: [
      /* @__PURE__ */ jsx("h3", { id: "edit-client-title", children: "Edit client" }),
      /* @__PURE__ */ jsxs("label", { children: [
        "Customer name",
        /* @__PURE__ */ jsx("input", { value: editName, onChange: (event) => setEditName(event.target.value), required: true })
      ] }),
      /* @__PURE__ */ jsxs("label", { children: [
        "Customer Gmail / billing email",
        /* @__PURE__ */ jsx("input", { type: "email", value: editEmail, onChange: (event) => setEditEmail(event.target.value), required: true })
      ] }),
      /* @__PURE__ */ jsxs("fieldset", { className: "billing-address-fields edit-address-fields", children: [
        /* @__PURE__ */ jsx("legend", { children: "Customer billing address" }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Block / Lot / House No.",
            /* @__PURE__ */ jsx("input", { value: editAddressHouse, placeholder: "e.g. Block 3, Lot 9", onChange: (event) => {
              setEditAddressHouse(event.target.value);
              updateEditAddress({ house: event.target.value });
            } })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Street",
            /* @__PURE__ */ jsx("input", { value: editAddressStreet, placeholder: "e.g. Bergamo Street", onChange: (event) => {
              setEditAddressStreet(event.target.value);
              updateEditAddress({ street: event.target.value });
            } })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Subdivision / Village",
            /* @__PURE__ */ jsx("input", { value: editAddressSubdivision, placeholder: "e.g. Camella Homes", onChange: (event) => {
              setEditAddressSubdivision(event.target.value);
              updateEditAddress({ subdivision: event.target.value });
            } })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Barangay",
            /* @__PURE__ */ jsx("input", { value: editAddressBarangay, placeholder: "e.g. Cantil-e", onChange: (event) => {
              setEditAddressBarangay(event.target.value);
              updateEditAddress({ barangay: event.target.value });
            } })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Region",
            /* @__PURE__ */ jsxs("select", { value: editAddressRegion, onChange: (event) => {
              const region = event.target.value;
              setEditAddressRegion(region);
              setEditAddressProvince("");
              setEditAddressCity("");
              setEditAddressPostalCode("");
              updateEditAddress({ region, municipality: "", location: "", post_code: "" });
            }, children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose region" }),
              editRegions.map((region) => /* @__PURE__ */ jsx("option", { value: region, children: region }, region))
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Province",
            /* @__PURE__ */ jsxs("select", { value: editAddressProvince, disabled: !editAddressRegion, onChange: (event) => {
              const province = event.target.value;
              setEditAddressProvince(province);
              setEditAddressCity("");
              setEditAddressPostalCode("");
              updateEditAddress({ municipality: province, location: "", post_code: "" });
            }, children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose province" }),
              editProvinces.map((province) => /* @__PURE__ */ jsx("option", { value: province, children: province }, province))
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "City / Municipality",
            /* @__PURE__ */ jsxs("select", { value: editAddressCity, disabled: !editAddressProvince, onChange: (event) => {
              const city = event.target.value;
              setEditAddressCity(city);
              setEditAddressPostalCode("");
              updateEditAddress({ location: city, post_code: "" });
            }, children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose city / municipality" }),
              editCities.map((city) => /* @__PURE__ */ jsx("option", { value: city, children: city }, city))
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Postal code",
            /* @__PURE__ */ jsxs("select", { value: editAddressPostalCode, disabled: !editAddressProvince, onChange: (event) => {
              const postCode = event.target.value;
              setEditAddressPostalCode(postCode);
              updateEditAddress({ post_code: postCode });
            }, children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose postal code" }),
              editPostalCodes.map((postCode) => /* @__PURE__ */ jsx("option", { value: postCode, children: postCode }, postCode))
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Country",
          /* @__PURE__ */ jsx("input", { value: "Philippines", readOnly: true })
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Complete address:" }),
          " ",
          editAddress || clientPendingEdit.address || "Select the address fields above."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("label", { children: [
          "Monthly amount",
          /* @__PURE__ */ jsx("input", { inputMode: "decimal", value: editAmount, onChange: (event) => setEditAmount(event.target.value), required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Start date",
          /* @__PURE__ */ jsx("input", { type: "date", value: editStartDate, onChange: (event) => setEditStartDate(event.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { children: [
        "Due after days",
        /* @__PURE__ */ jsx("input", { min: "1", max: "90", type: "number", value: editDueAfterDays, onChange: (event) => setEditDueAfterDays(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Invoice number stays ",
        clientPendingEdit.invoiceNumber,
        "."
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "button-row", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", onClick: () => setClientPendingEdit(null), children: "Cancel" }),
        /* @__PURE__ */ jsx("button", { type: "submit", children: "Save changes" })
      ] })
    ] }) }) : null,
    clientPendingDelete ? /* @__PURE__ */ jsx("div", { className: "modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxs("div", { className: "confirm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "delete-client-title", children: [
      /* @__PURE__ */ jsx("h3", { id: "delete-client-title", children: "Are you sure you want to delete this client?" }),
      /* @__PURE__ */ jsxs("p", { children: [
        clientPendingDelete.name,
        " <",
        clientPendingDelete.email,
        "> will be removed from the monthly invoice list."
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "button-row", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", onClick: () => setClientPendingDelete(null), children: "Cancel" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "danger-button", onClick: confirmDeleteClient, children: "Delete client" })
      ] })
    ] }) }) : null
  ] });
}
export {
  CustomersPage as default
};
