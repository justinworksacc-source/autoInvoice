import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { secureFetch } from "../apiSecurity";

const endpoint = "/api/users";

function UsersPage({ session }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "staff" });
  const [notice, setNotice] = useState("");
  async function request(payload?: Record<string, unknown>) {
    const response = await secureFetch(endpoint, payload ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    } : undefined);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "User request failed.");
    setUsers(result.users);
  }
  useEffect(() => { request().catch((error) => setNotice(error.message)); }, []);
  async function create(event) {
    event.preventDefault();
    try {
      await request({ action: "create", ...form });
      setForm({ username: "", full_name: "", password: "", role: "staff" });
      setNotice("User account created.");
    } catch (error) {
      setNotice(error.message);
    }
  }
  if (session.role && session.role !== "admin") return jsx("section", { className: "page-stack", children: jsx("div", { className: "database-banner error", children: "Only administrators can manage users." }) });
  return jsxs("section", { className: "page-stack", children: [
    jsxs("div", { className: "page-heading", children: [jsxs("div", { children: [jsx("p", { className: "eyebrow", children: "Access control" }), jsx("h2", { children: "Users & Roles" }), jsx("p", { children: "Create separate accounts and grant only the access each person needs." })] }), jsx("span", { className: "status-pill", children: "Administrator only" })] }),
    notice ? jsx("div", { className: notice.includes("created") ? "saved-banner" : "database-banner error", children: notice }) : null,
    jsxs("div", { className: "operations-grid", children: [
      jsxs("form", { className: "settings-card work-form", onSubmit: create, children: [
        jsx("h3", { children: "Add user" }),
        jsxs("label", { children: ["Full name", jsx("input", { value: form.full_name, onChange: (event) => setForm({ ...form, full_name: event.target.value }) })] }),
        jsxs("label", { children: ["Username", jsx("input", { value: form.username, required: true, onChange: (event) => setForm({ ...form, username: event.target.value }) })] }),
        jsxs("label", { children: ["Temporary password", jsx("input", { type: "password", minLength: 10, required: true, value: form.password, onChange: (event) => setForm({ ...form, password: event.target.value }) })] }),
        jsxs("label", { children: ["Role", jsxs("select", { value: form.role, onChange: (event) => setForm({ ...form, role: event.target.value }), children: [jsx("option", { value: "staff", children: "Staff" }), jsx("option", { value: "accountant", children: "Accountant" }), jsx("option", { value: "admin", children: "Administrator" })] })] }),
        jsx("button", { type: "submit", children: "Create user" })
      ] }),
      jsxs("article", { className: "dashboard-panel", children: [
        jsx("h3", { children: "Current users" }),
        jsx("div", { className: "operations-list", children: users.map((user) => jsxs("div", { children: [
          jsxs("span", { children: [jsx("strong", { children: user.fullName || user.username }), jsx("small", { children: user.username })] }),
          jsxs("select", { value: user.role, onChange: (event) => request({ action: "set_role", user_id: user.id, role: event.target.value }).catch((error) => setNotice(error.message)), children: [jsx("option", { value: "staff", children: "Staff" }), jsx("option", { value: "accountant", children: "Accountant" }), jsx("option", { value: "admin", children: "Admin" })] }),
          jsx("span", { className: `send-status ${user.isActive ? "sent" : "draft"}`, children: user.isActive ? "Active" : "Disabled" }),
          jsx("button", { className: "secondary-button", onClick: () => request({ action: "set_active", user_id: user.id, is_active: !user.isActive }).catch((error) => setNotice(error.message)), children: user.isActive ? "Disable" : "Enable" })
        ] }, user.id)) })
      ] })
    ] })
  ] });
}

export default UsersPage;
