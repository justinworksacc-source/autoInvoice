import bcrypt from "bcryptjs";
import { database, ensureAuthSchema } from "../server/db.js";
import { body, fail, json, requireRole, requireSession } from "../server/security.js";

const roles = new Set(["admin", "accountant", "staff"]);
const superAdminUsername = "visualsecsys";

async function ensureSuperAdmin() {
  const [[existing]] = await database().execute("SELECT COUNT(*)::int AS count FROM auth_accounts WHERE role='super_admin'");
  if (!Number(existing.count)) {
    await database().execute(
      "UPDATE auth_accounts SET role='super_admin',is_active=TRUE WHERE LOWER(username)=?",
      [superAdminUsername]
    );
  }
}

async function isProtectedSuperAdmin(userId) {
  const [users] = await database().execute(
    "SELECT id FROM auth_accounts WHERE id=? AND (role='super_admin' OR LOWER(username)=?) LIMIT 1",
    [userId, superAdminUsername]
  );
  return users.length > 0;
}

async function listUsers() {
  const [users] = await database().execute(
    `SELECT id,username,COALESCE(full_name,'') AS "fullName",role,is_active AS "isActive",
      TO_CHAR(last_login_at,'YYYY-MM-DD HH24:MI') AS "lastLoginAt",
      TO_CHAR(created_at,'YYYY-MM-DD') AS "createdAt"
     FROM auth_accounts ORDER BY username`
  );
  return users;
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);
    requireRole(session, ["admin"]);
    await ensureAuthSchema();
    await ensureSuperAdmin();
    if (req.method === "GET") return json(res, 200, { success: true, users: await listUsers() });
    if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });
    const input = await body(req);
    if (input.action === "create") {
      const username = String(input.username || "").trim();
      const password = String(input.password || "");
      const role = String(input.role || "staff");
      if (username.toLowerCase() === superAdminUsername) {
        throw Object.assign(new Error("That username is reserved for the Super Administrator."), { status: 422 });
      }
      if (username.length < 3 || password.length < 10 || !roles.has(role)) {
        throw Object.assign(new Error("Use a valid username, role, and password of at least 10 characters."), { status: 422 });
      }
      await database().execute(
        "INSERT INTO auth_accounts (company_id,username,password_hash,full_name,role) VALUES (1,?,?,?,?)",
        [username, await bcrypt.hash(password, 12), String(input.full_name || "").trim() || null, role]
      );
    } else if (input.action === "set_active") {
      const userId = Number(input.user_id);
      if (await isProtectedSuperAdmin(userId)) throw Object.assign(new Error("The Super Administrator account cannot be disabled."), { status: 422 });
      if (userId === session.userId && !input.is_active) throw Object.assign(new Error("You cannot disable your own account."), { status: 422 });
      await database().execute("UPDATE auth_accounts SET is_active=? WHERE id=?", [input.is_active ? 1 : 0, userId]);
    } else if (input.action === "set_role") {
      const role = String(input.role || "");
      if (!roles.has(role)) throw Object.assign(new Error("Invalid role."), { status: 422 });
      const userId = Number(input.user_id);
      if (await isProtectedSuperAdmin(userId)) throw Object.assign(new Error("The Super Administrator role cannot be changed."), { status: 422 });
      await database().execute("UPDATE auth_accounts SET role=? WHERE id=?", [role, userId]);
    } else if (input.action === "delete") {
      const userId = Number(input.user_id);
      if (!Number.isInteger(userId) || userId < 1) throw Object.assign(new Error("Invalid user account."), { status: 422 });
      if (await isProtectedSuperAdmin(userId)) throw Object.assign(new Error("The Super Administrator account cannot be deleted."), { status: 422 });
      if (userId === session.userId) throw Object.assign(new Error("You cannot delete your own logged-in account."), { status: 422 });
      const [result] = await database().execute("DELETE FROM auth_accounts WHERE id=?", [userId]);
      if (!result.affectedRows) throw Object.assign(new Error("User account was not found."), { status: 404 });
    } else if (input.action === "bulk_disable" || input.action === "bulk_delete") {
      const userIds = [...new Set((Array.isArray(input.user_ids) ? input.user_ids : []).map(Number))]
        .filter((userId) => Number.isInteger(userId) && userId > 0)
        .slice(0, 100);
      if (!userIds.length) throw Object.assign(new Error("Select at least one user account."), { status: 422 });
      if (userIds.includes(session.userId)) throw Object.assign(new Error("Your own logged-in account cannot be selected."), { status: 422 });
      const placeholders = userIds.map(() => "?").join(",");
      const [[protectedAccount]] = await database().execute(
        `SELECT COUNT(*) count FROM auth_accounts WHERE id IN (${placeholders}) AND (role='super_admin' OR LOWER(username)=?)`,
        [...userIds, superAdminUsername]
      );
      if (Number(protectedAccount.count)) throw Object.assign(new Error("The Super Administrator account cannot be changed."), { status: 422 });
      if (input.action === "bulk_disable") {
        await database().execute(`UPDATE auth_accounts SET is_active=0 WHERE id IN (${placeholders})`, userIds);
      } else {
        await database().execute(`DELETE FROM auth_accounts WHERE id IN (${placeholders})`, userIds);
      }
    } else throw Object.assign(new Error("Unknown user operation."), { status: 422 });
    return json(res, 200, { success: true, users: await listUsers() });
  } catch (error) {
    return fail(res, error);
  }
}
