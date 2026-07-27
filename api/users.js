import bcrypt from "bcryptjs";
import { database } from "../server/db.js";
import { body, fail, json, requireRole, requireSession } from "../server/security.js";

const roles = new Set(["admin", "accountant", "staff"]);

async function listUsers() {
  const [users] = await database().execute(
    `SELECT id,username,COALESCE(full_name,'') fullName,role,is_active isActive,
      DATE_FORMAT(last_login_at,'%Y-%m-%d %H:%i') lastLoginAt,
      DATE_FORMAT(created_at,'%Y-%m-%d') createdAt
     FROM auth_accounts ORDER BY username`
  );
  return users;
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);
    requireRole(session, ["admin"]);
    if (req.method === "GET") return json(res, 200, { success: true, users: await listUsers() });
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const input = await body(req);
    if (input.action === "create") {
      const username = String(input.username || "").trim();
      const password = String(input.password || "");
      const role = String(input.role || "staff");
      if (username.length < 3 || password.length < 10 || !roles.has(role)) {
        throw Object.assign(new Error("Use a valid username, role, and password of at least 10 characters."), { status: 422 });
      }
      await database().execute(
        "INSERT INTO auth_accounts (company_id,username,password_hash,full_name,role) VALUES (1,?,?,?,?)",
        [username, await bcrypt.hash(password, 12), String(input.full_name || "").trim() || null, role]
      );
    } else if (input.action === "set_active") {
      const userId = Number(input.user_id);
      if (userId === session.userId && !input.is_active) throw Object.assign(new Error("You cannot disable your own account."), { status: 422 });
      await database().execute("UPDATE auth_accounts SET is_active=? WHERE id=?", [input.is_active ? 1 : 0, userId]);
    } else if (input.action === "set_role") {
      const role = String(input.role || "");
      if (!roles.has(role)) throw Object.assign(new Error("Invalid role."), { status: 422 });
      await database().execute("UPDATE auth_accounts SET role=? WHERE id=?", [role, Number(input.user_id)]);
    } else throw Object.assign(new Error("Unknown user operation."), { status: 422 });
    return json(res, 200, { success: true, users: await listUsers() });
  } catch (error) {
    return fail(res, error);
  }
}
