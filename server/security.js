import crypto from "node:crypto";

const cookieName = "vss_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw Object.assign(new Error("Set SESSION_SECRET to a random value of at least 32 characters in Vercel."), { status: 503 });
  }
  return value;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "").split(";").map((item) => item.trim().split(/=(.*)/s)).filter(([key]) => key)
  );
}

export function createSession(res, user) {
  const role = ["super_admin", "admin", "accountant", "staff"].includes(user.role) ? user.role : "staff";
  const session = {
    userId: Number(user.id),
    username: user.username,
    role,
    csrf: crypto.randomBytes(32).toString("hex"),
    expires: Date.now() + 12 * 60 * 60 * 1000
  };
  const payload = encode(JSON.stringify(session));
  const token = `${payload}.${sign(payload)}`;
  res.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
  return session;
}

export function requireRole(session, roles) {
  if (session.role !== "super_admin" && !roles.includes(session.role)) {
    throw Object.assign(new Error("You do not have permission to perform this action."), { status: 403 });
  }
  return session;
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function readSession(req) {
  const token = cookies(req)[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.expires > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function requireSession(req, { csrf = true } = {}) {
  const session = readSession(req);
  if (!session) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (csrf && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const provided = String(req.headers["x-csrf-token"] || "");
    if (!provided || provided !== session.csrf) {
      throw Object.assign(new Error("Invalid security token. Refresh and try again."), { status: 403 });
    }
  }
  return session;
}

export function json(res, status, payload) {
  res.status(status).setHeader("Cache-Control", "no-store").json(payload);
}

export function fail(res, error) {
  console.error(error);
  const databaseMessages = {
    ER_NO_SUCH_TABLE: "The database schema is incomplete. Redeploy to initialize the required tables.",
    ER_BAD_FIELD_ERROR: "The database schema is outdated. Redeploy to apply the compatibility update.",
    ER_ACCESS_DENIED_ERROR: "The database rejected the configured username or password.",
    ER_DBACCESS_DENIED_ERROR: "The database user does not have access to the configured database.",
    ER_TABLEACCESS_DENIED_ERROR: "The database user cannot initialize the required tables or columns.",
    ECONNREFUSED: "The database refused the connection. Check DB_HOST and DB_PORT in Vercel.",
    ETIMEDOUT: "The database connection timed out. Check the Aiven service and Vercel environment settings.",
    ENOTFOUND: "The database host could not be found. Check DB_HOST in Vercel.",
    CERT_HAS_EXPIRED: "The database TLS certificate has expired.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The database TLS certificate could not be verified. Check DB_SSL_CA in Vercel."
  };
  const safeDatabaseMessage = databaseMessages[error?.code];
  json(res, Number(error.status || 500), {
    success: false,
    error: error.status ? error.message : safeDatabaseMessage || "An internal server error occurred."
  });
}

export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}
