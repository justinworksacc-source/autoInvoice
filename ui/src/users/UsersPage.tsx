import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { secureFetch } from "../apiSecurity";

const endpoint = "/api/users";

function UsersPage({ session }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "staff" });
  const [notice, setNotice] = useState("");
  const [busyUserId, setBusyUserId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  async function request(payload?: Record<string, unknown>) {
    const response = await secureFetch(endpoint, payload ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    } : undefined);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "User request failed.");
    setUsers(result.users);
    setSelectedUserIds((selectedIds) => selectedIds.filter((userId) => result.users.some((user) => user.id === userId)));
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
  async function updateUser(userId, payload, successMessage) {
    setBusyUserId(userId);
    try {
      await request({ ...payload, user_id: userId });
      setNotice(successMessage);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusyUserId(null);
    }
  }
  async function runBulkAction(action) {
    if (!selectedUserIds.length) return;
    const isDelete = action === "bulk_delete";
    if (isDelete && !window.confirm(`Permanently delete ${selectedUserIds.length} selected account${selectedUserIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusyUserId("bulk");
    try {
      await request({ action, user_ids: selectedUserIds });
      setSelectedUserIds([]);
      setNotice(isDelete ? "Selected user accounts deleted." : "Selected user accounts disabled.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusyUserId(null);
    }
  }
  if (!["super_admin", "admin"].includes(session.role)) return null;
  const selectableUsers = users.filter((user) => user.username !== session.username && user.role !== "super_admin");
  const allUsersSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.includes(user.id));
  const bulkBusy = busyUserId === "bulk";
  return jsxs("section", { className: "page-stack users-page", children: [
    jsxs("div", { className: "page-heading", children: [jsxs("div", { children: [jsx("p", { className: "eyebrow", children: "Access control" }), jsx("h2", { children: "Users & Roles" }), jsx("p", { children: "Create separate accounts and grant only the access each person needs." })] }), jsx("span", { className: "status-pill", children: "Administrator only" })] }),
    notice ? jsx("div", { className: /created|updated|deleted|enabled|disabled/i.test(notice) ? "saved-banner" : "database-banner error", children: notice }) : null,
    jsxs("div", { className: "operations-grid users-grid", children: [
      jsxs("form", { className: "settings-card work-form", onSubmit: create, children: [
        jsxs("div", { className: "users-card-heading", children: [
          jsx("h3", { children: "Add user" }),
          jsx("p", { children: "Create a secure account and choose the access level." })
        ] }),
        jsxs("label", { children: ["Full name", jsx("input", { value: form.full_name, onChange: (event) => setForm({ ...form, full_name: event.target.value }) })] }),
        jsxs("label", { children: ["Username", jsx("input", { value: form.username, required: true, onChange: (event) => setForm({ ...form, username: event.target.value }) })] }),
        jsxs("label", { children: ["Temporary password", jsx("input", { type: "password", minLength: 10, required: true, value: form.password, onChange: (event) => setForm({ ...form, password: event.target.value }) })] }),
        jsxs("label", { children: ["Role", jsxs("select", { value: form.role, onChange: (event) => setForm({ ...form, role: event.target.value }), children: [jsx("option", { value: "staff", children: "Staff" }), jsx("option", { value: "accountant", children: "Accountant" }), jsx("option", { value: "admin", children: "Administrator" })] })] }),
        jsx("button", { type: "submit", children: "Create user" })
      ] }),
      jsxs("article", { className: "dashboard-panel user-list-panel", children: [
        jsxs("div", { className: "users-card-heading current-users-heading", children: [
          jsxs("div", { children: [
            jsx("h3", { children: "Current users" }),
            jsx("p", { children: "Manage roles, account status, or remove access." })
          ] }),
          jsx("span", { className: "status-pill", children: `${users.length} account${users.length === 1 ? "" : "s"}` })
        ] }),
        jsxs("div", { className: "user-bulk-toolbar", children: [
          jsxs("label", { className: "user-select-all", children: [
            jsx("input", { type: "checkbox", checked: allUsersSelected, disabled: !selectableUsers.length || bulkBusy, onChange: (event) => setSelectedUserIds(event.target.checked ? selectableUsers.map((user) => user.id) : []) }),
            jsx("span", { children: selectedUserIds.length ? `${selectedUserIds.length} selected` : "Select all users" })
          ] }),
          jsxs("div", { className: "user-bulk-actions", children: [
            jsx("button", { type: "button", className: "secondary-button", disabled: !selectedUserIds.length || bulkBusy, onClick: () => void runBulkAction("bulk_disable"), children: bulkBusy ? "Working\u2026" : "Disable selected" }),
            jsx("button", { type: "button", className: "danger-button", disabled: !selectedUserIds.length || bulkBusy, onClick: () => void runBulkAction("bulk_delete"), children: bulkBusy ? "Working\u2026" : "Delete selected" })
          ] })
        ] }),
        jsx("div", { className: "user-list", children: users.map((user) => {
          const isCurrentUser = user.username === session.username;
          const isSuperAdmin = user.role === "super_admin";
          const isBusy = busyUserId === user.id;
          return jsxs("div", { className: "user-card", children: [
            jsx("input", { className: "user-select-checkbox", type: "checkbox", checked: selectedUserIds.includes(user.id), disabled: isCurrentUser || isSuperAdmin || bulkBusy, "aria-label": isSuperAdmin ? "Super Administrator cannot be selected" : isCurrentUser ? "Current account cannot be selected" : `Select ${user.fullName || user.username}`, onChange: (event) => setSelectedUserIds((selectedIds) => event.target.checked ? [...selectedIds, user.id] : selectedIds.filter((userId) => userId !== user.id)) }),
            jsxs("div", { className: "user-identity", children: [
              jsx("span", { className: "user-avatar", "aria-hidden": "true", children: (user.fullName || user.username).trim().charAt(0).toUpperCase() }),
              jsxs("span", { children: [
                jsxs("strong", { children: [
                  user.fullName || user.username,
                  isSuperAdmin ? jsx("small", { className: "super-admin-label", children: "Super Admin" }) : null,
                  isCurrentUser ? jsx("small", { className: "current-user-label", children: "You" }) : null
                ] }),
                jsx("small", { children: `@${user.username}` })
              ] })
            ] }),
            jsxs("label", { className: "user-role-control", children: [
              jsx("span", { children: "Role" }),
              jsxs("select", { value: user.role, disabled: isBusy || isSuperAdmin, title: isSuperAdmin ? "The Super Administrator role is protected." : "", onChange: (event) => void updateUser(user.id, { action: "set_role", role: event.target.value }, "User role updated."), children: [
                isSuperAdmin ? jsx("option", { value: "super_admin", children: "Super Administrator" }) : null,
                jsx("option", { value: "staff", children: "Staff" }),
                jsx("option", { value: "accountant", children: "Accountant" }),
                jsx("option", { value: "admin", children: "Administrator" })
              ] })
            ] }),
            jsx("span", { className: `send-status ${user.isActive ? "sent" : "draft"}`, children: user.isActive ? "Active" : "Disabled" })
          ] }, user.id);
        }) })
      ] })
    ] })
  ] });
}

export default UsersPage;
