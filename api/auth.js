import bcrypt from "bcryptjs";
import { database, ensureAuthSchema } from "../server/db.js";
import { body, clearSession, createSession, fail, json, readSession, requireSession } from "../server/security.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      await ensureAuthSchema();
      const input = await body(req);
      const username = String(input.username || "").trim();
      const password = String(input.password || "");
      const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].slice(0, 45);
      const db = database();
      const [[attempts]] = await db.execute(
        "SELECT COUNT(*) count FROM auth_login_attempts WHERE username = ? AND ip_address = ? AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)",
        [username, ip]
      );
      if (Number(attempts.count) >= 5) throw Object.assign(new Error("Too many login attempts. Try again in 15 minutes."), { status: 429 });
      const [rows] = await db.execute("SELECT id, username, password_hash, role FROM auth_accounts WHERE username = ? AND is_active = 1 LIMIT 1", [username]);
      const account = rows[0];
      if (!account || !(await bcrypt.compare(password, account.password_hash))) {
        await db.execute("INSERT INTO auth_login_attempts (username, ip_address) VALUES (?, ?)", [username, ip]);
        throw Object.assign(new Error("Incorrect username or password."), { status: 401 });
      }
      await db.execute("DELETE FROM auth_login_attempts WHERE username = ? AND ip_address = ?", [username, ip]);
      await db.execute("UPDATE auth_accounts SET last_login_at=NOW() WHERE id=?", [account.id]);
      const session = createSession(res, account);
      return json(res, 200, { success: true, user: { username: account.username, role: session.role }, csrf_token: session.csrf });
    }
    if (req.method === "GET") {
      const session = readSession(req);
      if (!session) return json(res, 401, { success: false, error: "Authentication required." });
      return json(res, 200, { success: true, user: { username: session.username, role: session.role }, csrf_token: session.csrf });
    }
    if (req.method === "PUT") {
      const session = requireSession(req);
      const input = await body(req);
      const username = String(input.username || "").trim();
      const password = String(input.password || "");
      if (username.length < 3 || password.length < 8) throw Object.assign(new Error("Username needs 3 characters and password needs 8 characters."), { status: 422 });
      const hash = await bcrypt.hash(password, 12);
      await database().execute("UPDATE auth_accounts SET username = ?, password_hash = ? WHERE id = ?", [username, hash, session.userId]);
      const next = createSession(res, { id: session.userId, username, role: session.role });
      return json(res, 200, { success: true, user: { username, role: next.role }, csrf_token: next.csrf });
    }
    if (req.method === "DELETE") {
      requireSession(req);
      clearSession(res);
      return json(res, 200, { success: true });
    }
    return json(res, 405, { success: false, error: "Method not allowed." });
  } catch (error) {
    return fail(res, error);
  }
}
