export function parseDateInput(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (!year || !month || !day || Number.isNaN(parsedDate.getTime())) {
    return /* @__PURE__ */ new Date();
  }
  return parsedDate;
}
export function formatAmount(amount) {
  return amount.toLocaleString(void 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
export function parseAmount(amount) {
  const cleanAmount = Number(amount.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(cleanAmount) ? cleanAmount : 0;
}
export function getDayDifference(fromDate, toDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1e3;
  const fromTime = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toTime = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((toTime - fromTime) / millisecondsPerDay);
}
export function clampNumber(value, fallback, min, max) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsedValue)));
}
export function getMonthlyDate(year, month, billingDay) {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(billingDay, lastDayOfMonth));
}
export function getBillingPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function getCycleInvoiceNumber(client, cycleStartDate) {
  const billingPeriod = getBillingPeriod(cycleStartDate).replace("-", "");
  if (client.invoiceNumber.includes(billingPeriod)) {
    return client.invoiceNumber;
  }
  return `${client.invoiceNumber}-${billingPeriod}`;
}
export function getClientStartDateInput(client) {
  if (client.startDate && isDateInput(client.startDate)) {
    return client.startDate;
  }
  return formatDateInput();
}
export function getClientStartDate(client) {
  return parseDateInput(getClientStartDateInput(client));
}
export function getClientCycleStartDate(client, referenceDate = /* @__PURE__ */ new Date()) {
  const startDate = getClientStartDate(client);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const billingDay = clampNumber(client.billingDay, startDate.getDate(), 1, 31);
  let cycleStart = getMonthlyDate(today.getFullYear(), today.getMonth(), billingDay);
  if (cycleStart > today) {
    cycleStart = getMonthlyDate(today.getFullYear(), today.getMonth() - 1, billingDay);
  }
  if (cycleStart < startDate) {
    return startDate;
  }
  return cycleStart;
}
export function getNextDueDate(client, referenceDate = /* @__PURE__ */ new Date()) {
  const dueAfterDays = clampNumber(client.dueAfterDays, 14, 1, 90);
  const dueDate = new Date(getClientCycleStartDate(client, referenceDate));
  dueDate.setDate(dueDate.getDate() + dueAfterDays);
  return dueDate;
}
export function getDaysUntilDue(client, referenceDate = /* @__PURE__ */ new Date()) {
  const startOfBusinessDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const nextDueDate = getNextDueDate(client, referenceDate);
  return getDayDifference(startOfBusinessDate, nextDueDate);
}
export function getClientActiveDays(client, referenceDate = /* @__PURE__ */ new Date()) {
  const startOfBusinessDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const cycleStartDate = getClientCycleStartDate(client, referenceDate);
  return Math.max(0, getDayDifference(cycleStartDate, startOfBusinessDate));
}
export function formatClientActiveDays(activeDays) {
  if (activeDays === 0) {
    return "Started today";
  }
  return `Day ${activeDays}`;
}
export function formatDueDistance(daysUntilDue) {
  const absoluteDays = Math.abs(daysUntilDue);
  const dayLabel = absoluteDays === 1 ? "day" : "days";
  if (daysUntilDue < 0) {
    return `${absoluteDays} ${dayLabel} overdue`;
  }
  if (daysUntilDue === 0) {
    return "Due today";
  }
  return `${daysUntilDue} ${dayLabel} left`;
}
export function formatDueDate(date) {
  return new Intl.DateTimeFormat(void 0, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}
export function getClientPayments(client, payments) {
  return payments.filter((payment) => payment.clientId === client.id).sort((firstPayment, secondPayment) => {
    const firstTime = parseDateInput(firstPayment.paidAt).getTime();
    const secondTime = parseDateInput(secondPayment.paidAt).getTime();
    if (firstTime !== secondTime) {
      return firstTime - secondTime;
    }
    return firstPayment.createdAt.localeCompare(secondPayment.createdAt);
  });
}
export function getDueLedgerInvoices(client, referenceDate = /* @__PURE__ */ new Date()) {
  const invoices = [];
  const startDate = getClientStartDate(client);
  const billingDay = clampNumber(client.billingDay, startDate.getDate(), 1, 31);
  const dueAfterDays = clampNumber(client.dueAfterDays, 14, 1, 90);
  const monthlyAmount = parseAmount(client.amount);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  let monthOffset = 0;
  while (monthOffset < 120) {
    const cycleStartDate = monthOffset === 0 ? startDate : getMonthlyDate(startYear, startMonth + monthOffset, billingDay);
    const dueDate = new Date(cycleStartDate);
    dueDate.setDate(dueDate.getDate() + dueAfterDays);
    if (dueDate > referenceDate) {
      break;
    }
    invoices.push({
      cycleKey: formatDateInput(cycleStartDate),
      invoiceNumber: getCycleInvoiceNumber(client, cycleStartDate),
      billingPeriod: getBillingPeriod(cycleStartDate),
      cycleStartDate,
      dueDate,
      amount: monthlyAmount,
      paidAmount: 0,
      balanceDue: monthlyAmount,
      status: dueDate < referenceDate ? "overdue" : "unpaid"
    });
    monthOffset += 1;
  }
  return invoices;
}
export function getClientPaymentSummary(client, payments, referenceDate = /* @__PURE__ */ new Date()) {
  let remainingPaid = getClientPayments(client, payments).reduce((total, payment) => total + Math.max(0, parseAmount(payment.amount)), 0);
  const invoices = getDueLedgerInvoices(client, referenceDate).map((invoice) => {
    const paidAmount = Math.min(invoice.amount, remainingPaid);
    remainingPaid -= paidAmount;
    const balanceDue2 = Math.max(0, invoice.amount - paidAmount);
    let status = invoice.status;
    if (balanceDue2 <= 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partial";
    }
    return {
      ...invoice,
      paidAmount,
      balanceDue: balanceDue2,
      status
    };
  });
  const totalBilled = invoices.reduce((total, invoice) => total + invoice.amount, 0);
  const totalPaidToInvoices = invoices.reduce((total, invoice) => total + invoice.paidAmount, 0);
  const balanceDue = invoices.reduce((total, invoice) => total + invoice.balanceDue, 0);
  return {
    invoices,
    totalBilled,
    totalPaid: totalPaidToInvoices + Math.max(0, remainingPaid),
    unappliedPayment: Math.max(0, remainingPaid),
    balanceDue,
    unpaidInvoiceCount: invoices.filter((invoice) => invoice.balanceDue > 0).length,
    overdueInvoiceCount: invoices.filter((invoice) => invoice.balanceDue > 0 && invoice.dueDate < referenceDate).length
  };
}
export function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateInput(value).getTime());
}
export function formatDateInput(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
