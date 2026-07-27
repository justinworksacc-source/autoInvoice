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
  const session = {
    userId: Number(user.id),
    username: user.username,
    role: user.role || "admin",
    csrf: crypto.randomBytes(32).toString("hex"),
    expires: Date.now() + 12 * 60 * 60 * 1000
  };
  const payload = encode(JSON.stringify(session));
  const token = `${payload}.${sign(payload)}`;
  res.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
  return session;
}

export function requireRole(session, roles) {
  if (!roles.includes(session.role || "admin")) {
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
  json(res, Number(error.status || 500), {
    success: false,
    error: error.status ? error.message : "An internal server error occurred."
  });
}

export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}
