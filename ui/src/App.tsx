import { jsx, jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "./dashboard/DashboardPage";
import LoginPage from "./auth/LoginPage";
import { saveCsrfToken, secureFetch } from "./apiSecurity";
import {
  clampNumber,
  formatAmount,
  formatDueDate,
  getClientCycleStartDate,
  getCycleInvoiceNumber,
  getDaysUntilDue,
  getNextDueDate,
  parseAmount
} from "./shared";
const AccountantPage = lazy(() => import("./accountant/AccountantPage"));
const CustomersPage = lazy(() => import("./accountant/CustomersPage"));
const PrepareInvoicesPage = lazy(() => import("./accountant/PrepareInvoicesPage"));
const ProfilePage = lazy(() => import("./profile/ProfilePage"));
const SettingsPage = lazy(() => import("./settings/SettingsPage"));
const OperationsPage = lazy(() => import("./operations/OperationsPage"));
const CustomerPortalPage = lazy(() => import("./portal/CustomerPortalPage"));
const UsersPage = lazy(() => import("./users/UsersPage"));
const defaultBusinessProfile = {
  companyName: "Visual Security Systems",
  gmailAlias: ""
};
const profileStorageKey = "ai-accountant-ceo-profile";
const authStorageKey = "ai-accountant-ceo-session";
const clientsStorageKey = "ai-accountant-ceo-clients";
const paymentsStorageKey = "ai-accountant-ceo-payments";
const invoiceHistoryStorageKey = "ai-accountant-ceo-invoice-history";
const businessDateStorageKey = "ai-accountant-ceo-business-date";
const businessTimeStorageKey = "ai-accountant-ceo-business-time";
const themeStorageKey = "ai-accountant-ceo-theme";
const autoSendEnabledStorageKey = "ai-accountant-ceo-auto-send-enabled";
const monthlyInvoicesEndpoint = "/api/monthly-invoices";
const businessDateEndpoint = "/api/business-date";
const businessProfileEndpoint = "/api/business-profile";
const authEndpoint = "/api/auth";
const legacySampleClientId = "customer@example.com";
function formatDateInput(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function parseDateInput(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (!year || !month || !day || Number.isNaN(parsedDate.getTime())) {
    return /* @__PURE__ */ new Date();
  }
  return parsedDate;
}
function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateInput(value).getTime());
}
function loadBusinessProfile() {
  try {
    const savedProfile = window.localStorage.getItem(profileStorageKey);
    if (!savedProfile) {
      return defaultBusinessProfile;
    }
    return { ...defaultBusinessProfile, ...JSON.parse(savedProfile) };
  } catch {
    return defaultBusinessProfile;
  }
}
function loadAuthSession() {
  try {
    const savedSession = window.localStorage.getItem(authStorageKey);
    if (!savedSession) {
      return null;
    }
    return JSON.parse(savedSession);
  } catch {
    return null;
  }
}
function loadBusinessDate() {
  try {
    const savedBusinessDate = window.localStorage.getItem(businessDateStorageKey);
    if (savedBusinessDate && isDateInput(savedBusinessDate)) {
      return savedBusinessDate;
    }
    return formatDateInput();
  } catch {
    return formatDateInput();
  }
}
function loadBusinessTime() {
  try {
    const savedBusinessTime = window.localStorage.getItem(businessTimeStorageKey);
    return /^\d{2}:\d{2}$/.test(savedBusinessTime || "") ? savedBusinessTime : "08:00";
  } catch {
    return "08:00";
  }
}
function loadTheme() {
  try {
    return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function loadAutoSendEnabled() {
  try {
    return window.localStorage.getItem(autoSendEnabledStorageKey) !== "false";
  } catch {
    return true;
  }
}
async function requestBusinessDate(payload?: Record<string, unknown>) {
  const response = await secureFetch(businessDateEndpoint, payload ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  } : void 0);
  const result = await response.json();
  if (!response.ok || !result.success || !result.business_date) {
    throw new Error(result.error || "Business date request failed.");
  }
  return { businessDate: result.business_date, businessTime: result.business_time || "08:00" };
}
const initialMonthlyInvoiceClients = [];
function isMonthlyInvoiceClient(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const client = value;
  const validStatuses = ["Scheduled", "Draft", "Sent", "Needs approval"];
  return typeof client.id === "string" && typeof client.name === "string" && typeof client.email === "string" && (client.address === void 0 || typeof client.address === "string") && typeof client.invoiceNumber === "string" && typeof client.amount === "string" && (client.startDate === void 0 || typeof client.startDate === "string") && typeof client.billingDay === "string" && (client.dueAfterDays === void 0 || typeof client.dueAfterDays === "string") && typeof client.lastSent === "string" && (client.lastSentDueDate === void 0 || typeof client.lastSentDueDate === "string") && validStatuses.includes(client.status);
}
function isLegacySampleClient(client) {
  return client.id.toLowerCase() === legacySampleClientId
    && client.email.toLowerCase() === legacySampleClientId
    && client.name === "Customer Name";
}
function loadMonthlyInvoiceClients() {
  try {
    const savedClients = window.localStorage.getItem(clientsStorageKey);
    if (!savedClients) {
      return initialMonthlyInvoiceClients;
    }
    const parsedClients = JSON.parse(savedClients);
    if (!Array.isArray(parsedClients) || !parsedClients.every(isMonthlyInvoiceClient)) {
      return initialMonthlyInvoiceClients;
    }
    return parsedClients.filter((client) => !isLegacySampleClient(client)).map((client) => {
      const startDate = client.startDate && isDateInput(client.startDate) ? client.startDate : formatDateInput();
      const startDay = String(clampNumber(String(parseDateInput(startDate).getDate()), 1, 1, 31));
      return {
        ...client,
        startDate,
        billingDay: client.startDate && isDateInput(client.startDate) ? client.billingDay : startDay,
        dueAfterDays: client.dueAfterDays || "14"
      };
    });
  } catch {
    return initialMonthlyInvoiceClients;
  }
}
function isInvoicePayment(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payment = value;
  return typeof payment.id === "string" && typeof payment.clientId === "string" && typeof payment.amount === "string" && typeof payment.paidAt === "string" && typeof payment.method === "string" && typeof payment.referenceNumber === "string" && typeof payment.notes === "string" && typeof payment.createdAt === "string";
}
function loadInvoicePayments() {
  try {
    const savedPayments = window.localStorage.getItem(paymentsStorageKey);
    if (!savedPayments) {
      return [];
    }
    const parsedPayments = JSON.parse(savedPayments);
    return Array.isArray(parsedPayments) && parsedPayments.every(isInvoicePayment)
      ? parsedPayments.filter((payment) => payment.clientId.toLowerCase() !== legacySampleClientId)
      : [];
  } catch {
    return [];
  }
}
function loadInvoiceHistory() {
  try {
    const savedHistory = window.localStorage.getItem(invoiceHistoryStorageKey);
    const parsedHistory = savedHistory ? JSON.parse(savedHistory) : [];
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch {
    return [];
  }
}
async function requestMonthlyInvoiceStore(payload?: Record<string, unknown>) {
  const response = await secureFetch(monthlyInvoicesEndpoint, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : void 0,
    body: payload ? JSON.stringify(payload) : void 0
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "MariaDB monthly invoice request failed.");
  }
  return {
    clients: Array.isArray(result.clients)
      ? result.clients.filter(isMonthlyInvoiceClient).filter((client) => !isLegacySampleClient(client))
      : [],
    payments: Array.isArray(result.payments)
      ? result.payments.filter(isInvoicePayment).filter((payment) => payment.clientId.toLowerCase() !== legacySampleClientId)
      : []
  };
}
async function requestBusinessProfile(profile?: { companyName: string; gmailAlias: string }) {
  const response = await secureFetch(businessProfileEndpoint, profile ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  } : void 0);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || !result.profile) {
    throw new Error(result.error || "Company profile request failed.");
  }
  return { ...defaultBusinessProfile, ...result.profile };
}
function App() {
  const [clients, setClients] = useState(() => loadMonthlyInvoiceClients());
  const [payments, setPayments] = useState(() => loadInvoicePayments());
  const [invoiceHistory, setInvoiceHistory] = useState(() => loadInvoiceHistory());
  const [profile, setProfile] = useState(() => loadBusinessProfile());
  const [session, setSession] = useState(() => loadAuthSession());
  const [authChecked, setAuthChecked] = useState(false);
  const [businessDate, setBusinessDate] = useState(() => loadBusinessDate());
  const [businessTime, setBusinessTime] = useState(() => loadBusinessTime());
  const [theme, setTheme] = useState(() => loadTheme());
  const [autoSendEnabled, setAutoSendEnabled] = useState(() => loadAutoSendEnabled());
  const [databaseNotice, setDatabaseNotice] = useState("");
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const upcomingReminders = useMemo(() => {
    const referenceDate = parseDateInput(businessDate);
    return clients.flatMap((client) => {
      const dueDate = getNextDueDate(client, referenceDate);
      const dueDateKey = formatDateInput(dueDate);
      const daysUntilDue = getDaysUntilDue(client, referenceDate);
      if (daysUntilDue < 0 || daysUntilDue > 7 || client.lastSentDueDate === dueDateKey) return [];
      const cycleStartDate = getClientCycleStartDate(client, referenceDate);
      return [{
        clientId: client.id,
        customerName: client.name,
        invoiceNumber: getCycleInvoiceNumber(client, cycleStartDate),
        dueDate,
        daysUntilDue,
        amount: parseAmount(client.amount)
      }];
    }).sort((first, second) => first.daysUntilDue - second.daysUntilDue);
  }, [businessDate, clients]);
  useEffect(() => {
    secureFetch(authEndpoint).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success || !result.user?.username) {
        window.localStorage.removeItem(authStorageKey);
        setSession(null);
        return;
      }
      saveCsrfToken(result.csrf_token);
      const verifiedSession = { email: result.user.username, username: result.user.username, role: result.user.role || "staff", signedInAt: (/* @__PURE__ */ new Date()).toISOString() };
      window.localStorage.setItem(authStorageKey, JSON.stringify(verifiedSession));
      setSession(verifiedSession);
    }).catch(() => setSession(null)).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    window.localStorage.setItem(clientsStorageKey, JSON.stringify(clients));
  }, [clients]);
  useEffect(() => {
    window.localStorage.setItem(paymentsStorageKey, JSON.stringify(payments));
  }, [payments]);
  useEffect(() => {
    window.localStorage.setItem(invoiceHistoryStorageKey, JSON.stringify(invoiceHistory));
  }, [invoiceHistory]);
  useEffect(() => {
    window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    window.localStorage.setItem(businessDateStorageKey, businessDate);
  }, [businessDate]);
  useEffect(() => {
    window.localStorage.setItem(businessTimeStorageKey, businessTime);
  }, [businessTime]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem(autoSendEnabledStorageKey, String(autoSendEnabled));
  }, [autoSendEnabled]);
  useEffect(() => {
    if (!authChecked || !session) {
      return;
    }
    let cancelled = false;
    requestBusinessProfile().then(async (databaseProfile) => {
      const hasExistingLocalSender = profile.gmailAlias
        && profile.gmailAlias !== defaultBusinessProfile.gmailAlias;
      const resolvedProfile = !databaseProfile.gmailAlias && hasExistingLocalSender
        ? await requestBusinessProfile(profile)
        : databaseProfile;
      if (!cancelled) setProfile(resolvedProfile);
    }).catch((error) => {
      if (!cancelled) {
        setDatabaseNotice(`Company profile could not be loaded: ${error instanceof Error ? error.message : "Unknown database error."}`);
      }
    }).finally(() => {
      if (!cancelled) setProfileLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authChecked, session]);
  useEffect(() => {
    if (!authChecked || !session) {
      return;
    }
    let cancelled = false;
    function syncBusinessClock() {
      requestBusinessDate().then(({ businessDate: databaseBusinessDate, businessTime: databaseBusinessTime }) => {
        if (!cancelled && isDateInput(databaseBusinessDate)) {
          setBusinessDate(databaseBusinessDate);
          setBusinessTime(databaseBusinessTime);
        }
      }).catch(() => {
      });
    }
    syncBusinessClock();
    const timer = window.setInterval(syncBusinessClock, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authChecked, session]);
  useEffect(() => {
    if (!authChecked || !session) {
      return;
    }
    let cancelled = false;
    async function loadDatabaseState() {
      try {
        const databaseState = await requestMonthlyInvoiceStore();
        if (cancelled) {
          return;
        }
        if (databaseState.clients.length > 0 || databaseState.payments.length > 0) {
          setClients(databaseState.clients);
          setPayments(databaseState.payments);
          setDatabaseNotice("");
          return;
        }
        if (clients.length > 0 || payments.length > 0) {
          await requestMonthlyInvoiceStore({
            action: "sync",
            clients,
            payments
          });
          setDatabaseNotice("");
          return;
        }
        setDatabaseNotice("");
      } catch (error) {
        if (!cancelled) {
          setDatabaseNotice(`MariaDB not connected: ${error instanceof Error ? error.message : "Unknown database error."}`);
        }
      } finally {
        if (!cancelled) setBillingLoaded(true);
      }
    }
    void loadDatabaseState();
    return () => {
      cancelled = true;
    };
  }, [authChecked, session]);
  async function refreshFromDatabase(payload) {
    try {
      const databaseState = await requestMonthlyInvoiceStore(payload);
      setClients(databaseState.clients);
      setPayments(databaseState.payments);
      setDatabaseNotice("");
    } catch (error) {
      setDatabaseNotice(`MariaDB save failed: ${error instanceof Error ? error.message : "Unknown database error."}`);
    }
  }
  function saveClientToDatabase(client) {
    void refreshFromDatabase({
      action: "upsert_client",
      client
    });
  }
  async function saveProfileToDatabase(nextProfile) {
    const savedProfile = await requestBusinessProfile(nextProfile);
    setProfile(savedProfile);
    setDatabaseNotice("");
    return savedProfile;
  }
  function deleteClientFromDatabase(clientId) {
    void refreshFromDatabase({
      action: "delete_client",
      client_id: clientId
    });
  }
  function saveBusinessDate(nextBusinessDate, nextBusinessTime = businessTime) {
    const cleanBusinessDate = isDateInput(nextBusinessDate) ? nextBusinessDate : formatDateInput();
    const cleanBusinessTime = /^\d{2}:\d{2}$/.test(nextBusinessTime) ? nextBusinessTime : "08:00";
    setBusinessDate(cleanBusinessDate);
    setBusinessTime(cleanBusinessTime);
    void requestBusinessDate({
      action: "set",
      business_date: cleanBusinessDate,
      business_time: cleanBusinessTime
    }).then(({ businessDate: savedDate, businessTime: savedTime }) => {
      setBusinessDate(savedDate);
      setBusinessTime(savedTime);
    }).catch((error) => {
      setDatabaseNotice(`Business date and time save failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    });
  }
  async function handleLogin(username, password) {
    try {
      const response = await secureFetch(authEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.user?.username) {
        return result.error || "Login failed.";
      }
      saveCsrfToken(result.csrf_token);
      const nextSession = { email: result.user.username, username: result.user.username, role: result.user.role || "staff", signedInAt: (/* @__PURE__ */ new Date()).toISOString() };
      window.localStorage.setItem(authStorageKey, JSON.stringify(nextSession));
      window.history.replaceState(null, "", "/");
      setProfileLoaded(false);
      setBillingLoaded(false);
      setSession(nextSession);
      return null;
    } catch {
      return "Authentication server is unavailable.";
    }
  }
  async function handleCredentialsChange(username, password) {
    const response = await secureFetch(authEndpoint, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Credential update failed.");
    }
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }
      const nextSession = { ...currentSession, email: username, username };
      window.localStorage.setItem(authStorageKey, JSON.stringify(nextSession));
      return nextSession;
    });
  }
  function handleLogout() {
    void secureFetch(authEndpoint, { method: "DELETE" });
    saveCsrfToken(undefined);
    window.localStorage.removeItem(authStorageKey);
    setProfileLoaded(false);
    setBillingLoaded(false);
    setSession(null);
  }
  if (!authChecked) {
    return /* @__PURE__ */ jsx("div", { className: "route-loading", children: "Checking your session\u2026" });
  }
  if (window.location.pathname === "/portal") {
    return /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("main", { className: "portal-shell", children: "Loading billing portal\u2026" }), children: /* @__PURE__ */ jsx(CustomerPortalPage, {}) });
  }
  if (!session) {
    return /* @__PURE__ */ jsx(LoginPage, { onLogin: handleLogin });
  }
  if (!profileLoaded || !billingLoaded) {
    return null;
  }
  return /* @__PURE__ */ jsx(Suspense, { fallback: null, children: /* @__PURE__ */ jsx(BrowserRouter, { children: /* @__PURE__ */ jsxs("div", { className: "app-shell", children: [
    /* @__PURE__ */ jsxs("aside", { className: "sidebar", children: [
      /* @__PURE__ */ jsxs("div", { className: "brand-block", children: [
        /* @__PURE__ */ jsx("img", { src: "/logo.png", alt: "Visual Security Systems logo", className: "brand-logo" }),
        /* @__PURE__ */ jsx("h1", { children: "Visual Security Systems" })
      ] }),
      /* @__PURE__ */ jsxs("nav", { "aria-label": "Primary navigation", children: [
        /* @__PURE__ */ jsx(NavLink, { to: "/", end: true, className: ({ isActive }) => isActive ? "nav-link active" : "nav-link", children: "Dashboard" }),
        /* @__PURE__ */ jsx(NavLink, { to: "/accountant", className: ({ isActive }) => isActive ? "nav-link active" : "nav-link", children: "Accountant" }),
        /* @__PURE__ */ jsx(NavLink, { to: "/operations", className: ({ isActive }) => isActive ? "nav-link active" : "nav-link", children: "Operations & Reports" }),
        session.role === "admin" ? /* @__PURE__ */ jsx(NavLink, { to: "/users", className: ({ isActive }) => isActive ? "nav-link active" : "nav-link", children: "Users & Roles" }) : null
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "sidebar-footer", children: [
        /* @__PURE__ */ jsxs("div", { className: "account-links", children: [
          /* @__PURE__ */ jsxs("div", { className: "reminder-menu", children: [
            /* @__PURE__ */ jsxs("button", { type: "button", className: `reminder-button ${upcomingReminders.length ? "has-reminders" : ""}`, onClick: () => setRemindersOpen((open) => !open), "aria-expanded": remindersOpen, "aria-label": upcomingReminders.length ? `${upcomingReminders.length} invoices due within 7 days` : "No invoices due within 7 days", children: [
              /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" }) }),
              upcomingReminders.length ? /* @__PURE__ */ jsx("span", { className: "reminder-count", children: upcomingReminders.length > 99 ? "99+" : upcomingReminders.length }) : null
            ] }),
            remindersOpen ? /* @__PURE__ */ jsxs("div", { className: "reminder-popover", children: [
              /* @__PURE__ */ jsxs("div", { className: "reminder-popover-heading", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("strong", { children: "Payment reminders" }),
                  /* @__PURE__ */ jsx("small", { children: "Invoices due within the next 7 days" })
                ] }),
                /* @__PURE__ */ jsx("span", { children: upcomingReminders.length })
              ] }),
              upcomingReminders.length ? /* @__PURE__ */ jsx("div", { className: "reminder-list", children: upcomingReminders.map((reminder) => /* @__PURE__ */ jsxs(Link, { to: "/customers", onClick: () => setRemindersOpen(false), children: [
                /* @__PURE__ */ jsx("span", { className: "reminder-alert-icon", "aria-hidden": "true", children: "!" }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("strong", { children: reminder.customerName }),
                  /* @__PURE__ */ jsxs("small", { children: [
                    reminder.invoiceNumber,
                    " \xB7 Due ",
                    formatDueDate(reminder.dueDate)
                  ] }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    reminder.daysUntilDue === 0 ? "Due today" : `${reminder.daysUntilDue} days until due`,
                    " \xB7 ",
                    formatAmount(reminder.amount)
                  ] })
                ] })
              ] }, reminder.clientId)) }) : /* @__PURE__ */ jsxs("div", { className: "reminder-empty", children: [
                /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2713" }),
                /* @__PURE__ */ jsx("strong", { children: "No upcoming reminders" }),
                /* @__PURE__ */ jsx("p", { children: "Customers will appear here 7 days before their invoice is due." })
              ] })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsx(
            NavLink,
            {
              to: "/settings",
              "aria-label": "Settings",
              title: "Settings",
              className: ({ isActive }) => isActive ? "settings-icon-link active" : "settings-icon-link",
              children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: [
                /* @__PURE__ */ jsx("path", { d: "M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" }),
                /* @__PURE__ */ jsx("path", { d: "M19.4 13.5a7.7 7.7 0 0 0 .05-1.5 7.7 7.7 0 0 0-.05-1.5l2-1.55-2-3.46-2.47 1a8.6 8.6 0 0 0-2.58-1.5L14 2.35h-4l-.35 2.64a8.6 8.6 0 0 0-2.58 1.5l-2.47-1-2 3.46 2 1.55a7.7 7.7 0 0 0-.05 1.5c0 .51.02 1.01.05 1.5l-2 1.55 2 3.46 2.47-1a8.6 8.6 0 0 0 2.58 1.5L10 21.65h4l.35-2.64a8.6 8.6 0 0 0 2.58-1.5l2.47 1 2-3.46-2-1.55Z" })
              ] })
            }
          ),
          /* @__PURE__ */ jsx(NavLink, { to: "/profile", className: ({ isActive }) => isActive ? "logout-button profile-account-link active" : "logout-button profile-account-link", children: "Profile" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "content", children: [
      databaseNotice ? /* @__PURE__ */ jsx("div", { className: `database-banner ${databaseNotice.includes("failed") || databaseNotice.includes("not connected") ? "error" : ""}`, children: databaseNotice }) : null,
      /* @__PURE__ */ jsxs(Routes, { children: [
        /* @__PURE__ */ jsx(Route, { path: "/", element: /* @__PURE__ */ jsx(DashboardPage, { clients, payments, profile, session, businessDate, invoiceHistory }) }),
        /* @__PURE__ */ jsx(Route, { path: "/dashboard", element: /* @__PURE__ */ jsx(DashboardPage, { clients, payments, profile, session, businessDate, invoiceHistory }) }),
        /* @__PURE__ */ jsx(Route, { path: "/accountant", element: /* @__PURE__ */ jsx(AccountantPage, { clients, payments, businessDate }) }),
        /* @__PURE__ */ jsx(Route, { path: "/operations", element: /* @__PURE__ */ jsx(OperationsPage, { clients, payments, businessDate }) }),
        /* @__PURE__ */ jsx(Route, { path: "/users", element: session.role === "admin" ? /* @__PURE__ */ jsx(UsersPage, { session }) : /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) }),
        /* @__PURE__ */ jsx(
          Route,
          {
            path: "/settings",
            element: /* @__PURE__ */ jsx(
              SettingsPage,
              {
                businessDate,
                businessTime,
                onBusinessDateChange: saveBusinessDate,
                theme,
                onThemeChange: setTheme,
                autoSendEnabled,
                onAutoSendChange: setAutoSendEnabled
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(Route, { path: "/profile", element: /* @__PURE__ */ jsx(ProfilePage, { profile, onProfileSave: saveProfileToDatabase, session, onLogout: handleLogout, onCredentialsChange: handleCredentialsChange }) }),
        /* @__PURE__ */ jsx(
          Route,
          {
            path: "/invoices",
            element: /* @__PURE__ */ jsx(
              PrepareInvoicesPage,
              {
                clients,
                profile,
                businessDate,
                setClients,
                saveClientToDatabase,
                autoSendEnabled,
                onAutoSendChange: setAutoSendEnabled
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          Route,
          {
            path: "/customers",
            element: /* @__PURE__ */ jsx(
              CustomersPage,
              {
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
              }
            )
          }
        )
      ] })
    ] })
  ] }) }) });
}
export {
  App as default
};
