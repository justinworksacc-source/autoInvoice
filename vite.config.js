import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
const execFileAsync = promisify(execFile);
function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload, null, 2));
}
function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
function cleanHeaderValue(value) {
  return String(value || "").replace(/[\r\n]/g, "").trim();
}
function mailAddress(name, email) {
  return `"${cleanHeaderValue(name).replace(/"/g, "'")}" <${cleanHeaderValue(email)}>`;
}
function base64Url(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pdfEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function buildInvoicePdf(invoice) {
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString();
  const text = (value, x, y, size, font = "F1", color = "0.10 0.16 0.25") => `BT
${color} rg
/${font} ${size} Tf
${x} ${y} Td
(${pdfEscape(value)}) Tj
ET
`;
  const rect = (x, y, width, height, color) => `${color} rg
${x} ${y} ${width} ${height} re
f
`;
  const strokeLine = (x1, y1, x2, y2, color, width = 1) => `${color} RG
${width} w
${x1} ${y1} m
${x2} ${y2} l
S
`;
  const amount = invoice.amount || "0.00";
  const company = invoice.company_name || "Your Company";
  const customer = invoice.to_name || "Customer";
  const email = invoice.to || "";
  const address = invoice.customer_address || "";
  let content = "";
  content += rect(0, 0, 612, 792, "1 1 1");
  content += rect(0, 790, 612, 2, "0.02 0.27 0.70");
  content += "q\n76 0 0 76 26 688 cm\n/Im1 Do\nQ\n";
  content += text("VSS-IT", 110, 748, 25, "F2", "0.03 0.07 0.13");
  content += text(company, 110, 724, 9, "F1", "0.15 0.20 0.28");
  content += text(invoice.from_alias, 110, 707, 9, "F1", "0.15 0.20 0.28");
  content += text("INVOICE", 390, 720, 36, "F2", "0.01 0.03 0.06");
  content += text("Invoice Number", 298, 672, 10);
  content += text(invoice.invoice_number, 445, 672, 10, "F2");
  content += strokeLine(442, 662, 566, 662, "0.55 0.65 0.82", 0.6);
  content += text("Invoice Date", 298, 642, 10);
  content += text(today, 445, 642, 10, "F2");
  content += strokeLine(442, 632, 566, 632, "0.55 0.65 0.82", 0.6);
  content += text("Due Date", 298, 612, 10);
  content += text(invoice.due_date, 445, 612, 10, "F2");
  content += strokeLine(442, 602, 566, 602, "0.55 0.65 0.82", 0.6);
  content += "0.02 0.27 0.70 RG\n1 w\n24 438 378 142 re\nS\n";
  content += text("BILL TO", 56, 552, 12, "F2");
  content += text("Customer Name", 38, 522, 9);
  content += text(customer, 205, 522, 10, "F2");
  content += strokeLine(202, 512, 390, 512, "0.55 0.65 0.82", 0.5);
  content += text("Email", 38, 488, 9);
  content += text(email, 205, 488, 10, "F2");
  content += strokeLine(202, 478, 390, 478, "0.55 0.65 0.82", 0.5);
  content += text("Address", 38, 454, 9);
  content += text(address, 205, 454, 9, "F2");
  content += strokeLine(202, 444, 390, 444, "0.55 0.65 0.82", 0.5);
  content += rect(24, 380, 542, 32, "0.02 0.27 0.70");
  content += text("DESCRIPTION", 130, 391, 9, "F2", "0 0 0");
  content += text("QTY", 350, 391, 9, "F2", "0 0 0");
  content += text("UNIT PRICE", 414, 391, 9, "F2", "0 0 0");
  content += text("AMOUNT", 516, 391, 9, "F2", "0 0 0");
  [292, 322, 352, 380].forEach((y) => {
    content += strokeLine(24, y, 566, y, "0.35 0.43 0.56", 0.5);
  });
  [24, 324, 380, 500, 566].forEach((x) => {
    content += strokeLine(x, 292, x, 412, "0.35 0.43 0.56", 0.5);
  });
  content += text("Monthly IT & Security Services", 30, 362, 9);
  content += text("1", 367, 362, 9);
  content += text(invoice.monthly_amount || amount, 447, 362, 9);
  content += text(amount, 522, 362, 9, "F2");
  content += rect(48, 184, 220, 62, "0.96 0.98 1.00");
  content += text("PAYMENT TERMS", 62, 225, 10, "F2", "0.02 0.27 0.70");
  content += text(`Payment is due by ${invoice.due_date}.`, 62, 204, 9);
  content += text("SUBTOTAL", 350, 241, 9, "F2");
  content += text(amount, 510, 241, 9);
  content += text("TAX (0%)", 350, 222, 9, "F2");
  content += text("0.00", 510, 222, 9);
  content += text("DISCOUNT", 350, 203, 9, "F2");
  content += text("0.00", 510, 203, 9);
  content += rect(335, 166, 229, 29, "0.02 0.27 0.70");
  content += text("TOTAL DUE", 350, 176, 13, "F2", "1 1 1");
  content += text(amount, 500, 176, 13, "F2", "1 1 1");
  content += strokeLine(48, 142, 564, 142, "0.02 0.27 0.70");
  content += strokeLine(48, 112, 564, 112, "0.55 0.61 0.70", 0.5);
  content += text("NOTES", 60, 126, 10, "F2", "0.02 0.27 0.70");
  content += text("Thank you for your business. Please keep this invoice for your records.", 110, 126, 9);
  content += text("Authorized Signature", 350, 76, 18);
  content += strokeLine(325, 66, 545, 66, "0.02 0.27 0.70");
  content += text("AUTHORIZED SIGNATURE", 380, 50, 8, "F2", "0.02 0.27 0.70");
  const logoBytes = readFileSync("invoice-logo.jpg").toString("latin1");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj
<< /Length ${content.length} >>
stream
${content}endstream
endobj
`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `7 0 obj
<< /Type /XObject /Subtype /Image /Width 500 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>
stream
${logoBytes}
endstream
endobj
`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref
0 ${objects.length + 1}
`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n 
`;
  }
  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
`;
  pdf += `startxref
${xrefOffset}
%%EOF`;
  return Buffer.from(pdf, "latin1");
}
function buildMimeMessage(invoice) {
  const boundary = `invoice_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const fileName = `${cleanHeaderValue(invoice.invoice_number)}.pdf`;
  const pdfBytes = buildInvoicePdf(invoice);
  const headers = [
    `From: ${mailAddress(invoice.company_name, invoice.from_alias)}`,
    `To: ${mailAddress(invoice.to_name, invoice.to)}`,
    `Subject: ${cleanHeaderValue(invoice.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];
  return [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    invoice.body,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    pdfBytes.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "",
    `--${boundary}--`
  ].join("\r\n");
}
async function getGmailAccessToken(env) {
  const directToken = env.GMAIL_ACCESS_TOKEN || process.env.GMAIL_ACCESS_TOKEN;
  const clientId = env.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN;
  if (directToken) {
    return directToken;
  }
  if (!clientId || !clientSecret || !refreshToken) {
    return "";
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || result.error || "Gmail OAuth refresh failed.");
  }
  return result.access_token;
}
function normalizeInvoicePayload(payload) {
  return {
    to: cleanHeaderValue(payload.to),
    to_name: cleanHeaderValue(payload.to_name) || "Customer",
    customer_address: cleanHeaderValue(payload.customer_address),
    from_alias: cleanHeaderValue(payload.from_alias),
    company_name: cleanHeaderValue(payload.company_name) || "Your Company",
    invoice_number: cleanHeaderValue(payload.invoice_number),
    amount: cleanHeaderValue(payload.amount) || "0.00",
    monthly_amount: cleanHeaderValue(payload.monthly_amount) || cleanHeaderValue(payload.amount) || "0.00",
    previous_balance: cleanHeaderValue(payload.previous_balance) || "0.00",
    billing_day: cleanHeaderValue(payload.billing_day) || "1",
    due_date: cleanHeaderValue(payload.due_date),
    subject: cleanHeaderValue(payload.subject),
    body: String(payload.body || "").trim()
  };
}
function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function sqlString(value) {
  return `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}
function sqlNullableString(value) {
  const cleanValue = String(value ?? "").trim();
  return cleanValue ? sqlString(cleanValue) : "NULL";
}
function sqlDate(value) {
  const cleanValue = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanValue) ? sqlString(cleanValue) : "NULL";
}
function sqlNumber(value, fallback = 0) {
  const parsedValue = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsedValue) ? String(parsedValue) : String(fallback);
}
function sqlInt(value, fallback, min, max) {
  const parsedValue = Number(value);
  const cleanValue = Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : fallback;
  return String(Math.min(max, Math.max(min, cleanValue)));
}
function toTitleStatus(status) {
  const cleanStatus = String(status || "").toLowerCase();
  if (cleanStatus === "draft") {
    return "Draft";
  }
  if (cleanStatus === "sent") {
    return "Sent";
  }
  if (cleanStatus === "needs approval" || cleanStatus === "needs_approval") {
    return "Needs approval";
  }
  return "Scheduled";
}
function toDbStatus(status) {
  return toTitleStatus(status).toLowerCase();
}
function parseMariaJsonArray(value) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return [];
  }
  const parsedValue = JSON.parse(trimmedValue);
  return Array.isArray(parsedValue) ? parsedValue : [];
}
function mariaConfig(env) {
  return {
    host: env.DB_HOST || process.env.DB_HOST || "127.0.0.1",
    port: env.DB_PORT || process.env.DB_PORT || "3306",
    database: env.DB_NAME || process.env.DB_NAME || "systemt_ai",
    user: env.DB_USER || process.env.DB_USER || "ai_agent",
    password: env.DB_PASS || process.env.DB_PASS || "ai_agent_local"
  };
}
async function runMariaQuery(env, sql, databaseOverride) {
  const config = mariaConfig(env);
  const args = [
    "-h",
    config.host,
    "-P",
    config.port,
    "-u",
    config.user,
    "--batch",
    "--raw",
    "--skip-column-names"
  ];
  if (databaseOverride !== "") {
    args.push(databaseOverride || config.database);
  }
  args.push("-e", sql);
  try {
    const { stdout } = await execFileAsync("mariadb", args, {
      env: {
        ...process.env,
        MARIADB_PWD: config.password,
        MYSQL_PWD: config.password
      },
      maxBuffer: 1024 * 1024 * 10
    });
    return stdout.trim();
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message = stderr || (error instanceof Error ? error.message : "MariaDB command failed.");
    throw new Error(
      `${message.trim()}
Run: sudo mariadb < database/sql/local-setup.sql && sudo mariadb < database/sql/schema.sql`
    );
  }
}
async function ensureMonthlyInvoiceCompany(env) {
  await runMariaQuery(
    env,
    `
      INSERT INTO companies (id, name, tenant_key)
      VALUES (1, 'Visual Security Systems', 'visual-security-systems')
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `
  );
}
async function readMonthlyInvoiceStore(env) {
  await ensureMonthlyInvoiceCompany(env);
  const clientJson = await runMariaQuery(
    env,
    `
      SELECT COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', LOWER(billing_email),
            'name', customer_name,
            'email', billing_email,
            'address', COALESCE(billing_address, ''),
            'invoiceNumber', invoice_number,
            'amount', CAST(monthly_amount AS CHAR),
            'startDate', COALESCE(DATE_FORMAT(start_date, '%Y-%m-%d'), ''),
            'billingDay', CAST(billing_day AS CHAR),
            'dueAfterDays', CAST(due_after_days AS CHAR),
            'lastSent', COALESCE(DATE_FORMAT(last_sent_at, '%b %e, %Y, %h:%i %p'), 'Not sent yet'),
            'lastSentDueDate', COALESCE(DATE_FORMAT(last_sent_due_date, '%Y-%m-%d'), ''),
            'status', CASE status
              WHEN 'draft' THEN 'Draft'
              WHEN 'sent' THEN 'Sent'
              WHEN 'needs approval' THEN 'Needs approval'
              WHEN 'needs_approval' THEN 'Needs approval'
              ELSE 'Scheduled'
            END
          )
        ),
        JSON_ARRAY()
      )
      FROM monthly_invoice_clients
      WHERE company_id = 1
    `
  );
  const paymentJson = await runMariaQuery(
    env,
    `
      SELECT COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', CONCAT('db-', id),
            'clientId', LOWER(billing_email),
            'amount', CAST(amount AS CHAR),
            'paidAt', DATE_FORMAT(payment_date, '%Y-%m-%d'),
            'method', method,
            'referenceNumber', COALESCE(reference_number, ''),
            'notes', COALESCE(notes, ''),
            'createdAt', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ')
          )
        ),
        JSON_ARRAY()
      )
      FROM monthly_invoice_payments
      WHERE company_id = 1
    `
  );
  return {
    clients: parseMariaJsonArray(clientJson),
    payments: parseMariaJsonArray(paymentJson)
  };
}
async function upsertMonthlyInvoiceClient(env, client) {
  const email = cleanHeaderValue(client.email || client.id).toLowerCase();
  if (!email) {
    throw new Error("Client email is required.");
  }
  await ensureMonthlyInvoiceCompany(env);
  await runMariaQuery(
    env,
    `
      INSERT INTO monthly_invoice_clients (
        company_id,
        customer_name,
        billing_email,
        billing_address,
        invoice_number,
        monthly_amount,
        start_date,
        billing_day,
        due_after_days,
        last_sent_due_date,
        status,
        updated_at
      )
      VALUES (
        1,
        ${sqlString(client.name || "Unnamed customer")},
        ${sqlString(email)},
        ${sqlString(client.address || "")},
        ${sqlString(client.invoiceNumber || "")},
        ${sqlNumber(client.amount)},
        ${sqlDate(client.startDate)},
        ${sqlInt(client.billingDay, 1, 1, 31)},
        ${sqlInt(client.dueAfterDays, 14, 1, 90)},
        ${sqlDate(client.lastSentDueDate)},
        ${sqlString(toDbStatus(client.status))},
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        customer_name = VALUES(customer_name),
        billing_address = VALUES(billing_address),
        invoice_number = VALUES(invoice_number),
        monthly_amount = VALUES(monthly_amount),
        start_date = VALUES(start_date),
        billing_day = VALUES(billing_day),
        due_after_days = VALUES(due_after_days),
        last_sent_due_date = VALUES(last_sent_due_date),
        status = VALUES(status),
        updated_at = NOW()
    `
  );
}
async function recordMonthlyInvoicePayment(env, payment) {
  const email = cleanHeaderValue(payment.clientId).toLowerCase();
  if (!email) {
    throw new Error("Payment client email is required.");
  }
  await ensureMonthlyInvoiceCompany(env);
  await runMariaQuery(
    env,
    `
      INSERT INTO monthly_invoice_payments (
        company_id,
        client_id,
        billing_email,
        amount,
        payment_date,
        method,
        reference_number,
        notes
      )
      VALUES (
        1,
        (SELECT id FROM monthly_invoice_clients WHERE company_id = 1 AND billing_email = ${sqlString(email)} LIMIT 1),
        ${sqlString(email)},
        ${sqlNumber(payment.amount)},
        ${sqlDate(payment.paidAt)},
        ${sqlString(payment.method || "Cash")},
        ${sqlNullableString(payment.referenceNumber)},
        ${sqlNullableString(payment.notes)}
      )
    `
  );
}
async function deleteMonthlyInvoiceClient(env, clientId) {
  const email = cleanHeaderValue(clientId).toLowerCase();
  if (!email) {
    throw new Error("Client email is required.");
  }
  await runMariaQuery(
    env,
    `
      DELETE FROM monthly_invoice_payments
      WHERE company_id = 1 AND billing_email = ${sqlString(email)};

      DELETE FROM monthly_invoice_clients
      WHERE company_id = 1 AND billing_email = ${sqlString(email)};
    `
  );
}
async function syncMonthlyInvoiceStore(env, clients, payments) {
  for (const client of clients) {
    await upsertMonthlyInvoiceClient(env, client);
  }
  const existingPaymentCountText = await runMariaQuery(env, "SELECT COUNT(*) FROM monthly_invoice_payments WHERE company_id = 1");
  const existingPaymentCount = Number(existingPaymentCountText);
  if (existingPaymentCount === 0) {
    for (const payment of payments) {
      await recordMonthlyInvoicePayment(env, payment);
    }
  }
}
function devMonthlyInvoicesApi(env) {
  return {
    name: "dev-monthly-invoices-api",
    configureServer(server) {
      server.middlewares.use("/api/routes/monthly-invoices.php", async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        try {
          if (request.method === "GET") {
            sendJson(response, 200, {
              success: true,
              ...await readMonthlyInvoiceStore(env)
            });
            return;
          }
          if (request.method !== "POST") {
            sendJson(response, 405, { success: false, error: "Method not allowed" });
            return;
          }
          const rawBody = await readRequestBody(request);
          const payload = JSON.parse(rawBody || "{}");
          if (payload.action === "upsert_client" && payload.client) {
            await upsertMonthlyInvoiceClient(env, payload.client);
          } else if (payload.action === "record_payment" && payload.payment) {
            await recordMonthlyInvoicePayment(env, payload.payment);
          } else if (payload.action === "delete_client") {
            await deleteMonthlyInvoiceClient(env, payload.client_id);
          } else if (payload.action === "sync") {
            await syncMonthlyInvoiceStore(env, payload.clients || [], payload.payments || []);
          } else {
            sendJson(response, 422, { success: false, error: "Unknown monthly invoice action." });
            return;
          }
          sendJson(response, 200, {
            success: true,
            ...await readMonthlyInvoiceStore(env)
          });
        } catch (error) {
          sendJson(response, 500, {
            success: false,
            error: error instanceof Error ? error.message : "MariaDB monthly invoice request failed."
          });
        }
      });
    }
  };
}
function currentDateInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(/* @__PURE__ */ new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function devBusinessDateApi(env) {
  return {
    name: "dev-business-date-api",
    configureServer(server) {
      server.middlewares.use("/api/routes/business-date.php", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Cron-Secret");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        try {
          await ensureMonthlyInvoiceCompany(env);
          let businessDate = "";
          let source = "automatic";
          if (request.method === "GET") {
            const stored = await runMariaQuery(
              env,
              "SELECT CONCAT(DATE_FORMAT(business_date, '%Y-%m-%d'), '\\t', source) FROM business_dates WHERE company_id = 1"
            );
            if (stored) {
              [businessDate, source] = stored.split("	");
            } else {
              businessDate = currentDateInTimezone(env.APP_TIMEZONE || "Asia/Manila");
              await runMariaQuery(env, `CALL sp_set_business_date(1, ${sqlString(businessDate)}, 'automatic')`);
            }
          } else if (request.method === "POST") {
            const payload = JSON.parse(await readRequestBody(request) || "{}");
            if (payload.action === "sync") {
              const configuredSecret = env.CRON_SECRET || "";
              const providedSecret = cleanHeaderValue(request.headers["x-cron-secret"] || payload.secret);
              if (configuredSecret && configuredSecret !== providedSecret) {
                sendJson(response, 401, { success: false, error: "Invalid cron secret" });
                return;
              }
              businessDate = currentDateInTimezone(env.APP_TIMEZONE || "Asia/Manila");
              source = "cron";
            } else if (payload.action === "set" && /^\d{4}-\d{2}-\d{2}$/.test(payload.business_date || "")) {
              businessDate = payload.business_date || "";
              source = "manual";
            } else {
              sendJson(response, 422, { success: false, error: "Unknown or invalid business date action" });
              return;
            }
            await runMariaQuery(env, `CALL sp_set_business_date(1, ${sqlString(businessDate)}, ${sqlString(source)})`);
          } else {
            sendJson(response, 405, { success: false, error: "Method not allowed" });
            return;
          }
          sendJson(response, 200, { success: true, business_date: businessDate, source });
        } catch (error) {
          sendJson(response, 500, {
            success: false,
            error: error instanceof Error ? error.message : "Business date request failed."
          });
        }
      });
    }
  };
}
function devAuthApi() {
  let username = "admin.demo";
  let password = "admin";
  const sessions = /* @__PURE__ */ new Set();
  return {
    name: "dev-auth-api",
    configureServer(server) {
      server.middlewares.use("/api/routes/auth.php", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        const cookies = Object.fromEntries((request.headers.cookie || "").split(";").map((item) => item.trim().split("=")));
        const token = cookies.vss_session || "";
        const authenticated = sessions.has(token);
        try {
          if (request.method === "POST") {
            const payload = JSON.parse(await readRequestBody(request) || "{}");
            if (payload.username !== username || payload.password !== password) {
              sendJson(response, 401, { success: false, error: "Incorrect username or password." });
              return;
            }
            const nextToken = randomUUID();
            sessions.add(nextToken);
            response.setHeader("Set-Cookie", `vss_session=${nextToken}; Path=/; HttpOnly; SameSite=Lax`);
            sendJson(response, 200, { success: true, user: { username } });
          } else if (request.method === "GET") {
            sendJson(response, authenticated ? 200 : 401, authenticated ? { success: true, user: { username } } : { success: false, error: "Authentication required." });
          } else if (request.method === "PUT" && authenticated) {
            const payload = JSON.parse(await readRequestBody(request) || "{}");
            if ((payload.username || "").trim().length < 3 || (payload.password || "").length < 8) {
              sendJson(response, 422, { success: false, error: "Username must have 3 characters and password must have 8 characters." });
              return;
            }
            username = (payload.username || "").trim();
            password = payload.password || "";
            sendJson(response, 200, { success: true, user: { username } });
          } else if (request.method === "DELETE") {
            sessions.delete(token);
            response.setHeader("Set-Cookie", "vss_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
            sendJson(response, 200, { success: true });
          } else {
            sendJson(response, authenticated ? 405 : 401, { success: false, error: authenticated ? "Method not allowed." : "Authentication required." });
          }
        } catch (error) {
          sendJson(response, 500, { success: false, error: error instanceof Error ? error.message : "Authentication failed." });
        }
      });
    }
  };
}
function devInvoiceApi(env) {
  return {
    name: "dev-invoice-api",
    configureServer(server) {
      server.middlewares.use("/api/routes/send-invoice.php", async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        if (request.method !== "POST") {
          sendJson(response, 405, { success: false, error: "Method not allowed" });
          return;
        }
        try {
          const rawBody = await readRequestBody(request);
          const invoice = normalizeInvoicePayload(JSON.parse(rawBody || "{}"));
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.to)) {
            sendJson(response, 422, { success: false, error: "Customer Gmail / billing email is invalid." });
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.from_alias)) {
            sendJson(response, 422, { success: false, error: "Profile Gmail sender email is invalid." });
            return;
          }
          if (!invoice.invoice_number) {
            sendJson(response, 422, { success: false, error: "Invoice number is required." });
            return;
          }
          const finalInvoice = {
            ...invoice,
            subject: invoice.subject || `Invoice ${invoice.invoice_number} from ${invoice.company_name}`,
            body: invoice.body || `Hi ${invoice.to_name},

Attached is your invoice ${invoice.invoice_number}.

Thank you,
${invoice.company_name}`
          };
          const webhookUrl = env.SEND_INVOICE_WEBHOOK_URL || process.env.SEND_INVOICE_WEBHOOK_URL;
          if (webhookUrl) {
            const webhookResponse = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                secret: env.SEND_INVOICE_SECRET || process.env.SEND_INVOICE_SECRET || "",
                invoice: finalInvoice,
                attachment: {
                  file_name: `${finalInvoice.invoice_number}.pdf`,
                  content_type: "application/pdf",
                  content_base64: buildInvoicePdf(finalInvoice).toString("base64")
                }
              })
            });
            const webhookText = await webhookResponse.text();
            const webhookResult = parseJsonText(webhookText);
            if (!webhookResult) {
              sendJson(response, 502, {
                success: false,
                error: "Invoice sender webhook did not return JSON. Check that the Apps Script Web app URL ends with /exec and access is set to Anyone.",
                webhook_status: webhookResponse.status,
                webhook_body_preview: webhookText.slice(0, 240)
              });
              return;
            }
            if (!webhookResponse.ok || webhookResult.success !== true) {
              sendJson(response, 502, {
                success: false,
                error: typeof webhookResult.error === "string" ? webhookResult.error : `Invoice sender webhook failed with HTTP ${webhookResponse.status}.`,
                webhook_status: webhookResponse.status,
                webhook_response: webhookResult
              });
              return;
            }
            sendJson(response, 200, {
              success: true,
              provider: "vite_dev_webhook",
              message_id: webhookResult.message_id || null,
              invoice_number: finalInvoice.invoice_number,
              sent_to: finalInvoice.to
            });
            return;
          }
          const accessToken = await getGmailAccessToken(env);
          if (!accessToken) {
            sendJson(response, 503, {
              success: false,
              error: "Gmail sender is not configured yet. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN, or SEND_INVOICE_WEBHOOK_URL, before clicking Send now."
            });
            return;
          }
          const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              raw: base64Url(buildMimeMessage(finalInvoice))
            })
          });
          const gmailResult = await gmailResponse.json().catch(() => ({}));
          if (!gmailResponse.ok) {
            sendJson(response, 502, {
              success: false,
              error: gmailResult.error?.message || "Gmail rejected the invoice email.",
              gmail_response: gmailResult
            });
            return;
          }
          sendJson(response, 200, {
            success: true,
            provider: "vite_dev_gmail_api",
            message_id: gmailResult.id,
            invoice_number: finalInvoice.invoice_number,
            sent_to: finalInvoice.to
          });
        } catch (error) {
          sendJson(response, 500, {
            success: false,
            error: error instanceof Error ? error.message : "Invoice send failed."
          });
        }
      });
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), devAuthApi(), devMonthlyInvoicesApi(env), devBusinessDateApi(env), devInvoiceApi(env)],
    server: {
      port: 3e3,
      host: "0.0.0.0"
    }
  };
});
export {
  vite_config_default as default
};
