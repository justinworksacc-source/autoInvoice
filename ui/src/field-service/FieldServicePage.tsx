import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { secureFetch } from "../apiSecurity";

const endpoint = "/api/field-service";
const statusOptions = [
  ["scheduled", "Scheduled"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"]
];

function FieldServicePage({ session, clients }) {
  const canManage = ["super_admin", "admin"].includes(session.role);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ customer_name: "", service_address: "", title: "", description: "", scheduled_at: "", assigned_to: "" });

  async function request(payload?: Record<string, unknown>) {
    const response = await secureFetch(endpoint, payload ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    } : void 0);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || "Field-service request failed.");
    setJobs(Array.isArray(result.jobs) ? result.jobs : []);
    setTechnicians(Array.isArray(result.technicians) ? result.technicians : []);
  }

  useEffect(() => { void request().catch((error) => setNotice(error.message)); }, []);

  function chooseCustomer(name) {
    const client = clients.find((item) => item.name === name);
    setForm((current) => ({ ...current, customer_name: name, service_address: client?.address || current.service_address }));
  }

  async function createJob(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await request({ action: "create", ...form, assigned_to: Number(form.assigned_to) || null });
      setForm({ customer_name: "", service_address: "", title: "", description: "", scheduled_at: "", assigned_to: "" });
      setNotice("Field-service job created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the job.");
    } finally {
      setBusy(false);
    }
  }

  async function updateJob(job, updates) {
    setBusy(true);
    setNotice("");
    try {
      await request({ action: "update", job_id: job.id, status: updates.status ?? job.status, technician_notes: updates.technicianNotes ?? job.technicianNotes });
      setNotice("Field-service job updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the job.");
    } finally {
      setBusy(false);
    }
  }

  async function assignJob(jobId, assignedTo) {
    setBusy(true);
    try {
      await request({ action: "assign", job_id: jobId, assigned_to: Number(assignedTo) || null });
      setNotice("Technician assignment updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not assign the technician.");
    } finally {
      setBusy(false);
    }
  }

  return jsxs("section", { className: "page-stack field-service-page", children: [
    jsxs("div", { className: "page-heading", children: [
      jsxs("div", { children: [jsx("p", { className: "eyebrow", children: "Dispatch and site work" }), jsx("h2", { children: "Field Service" }), jsx("p", { children: canManage ? "Create, assign, and monitor customer site jobs." : "View and update jobs assigned to you." })] }),
      jsx("span", { className: "status-pill", children: canManage ? "Dispatch access" : "Technician access" })
    ] }),
    notice ? jsx("div", { className: /created|updated/i.test(notice) ? "saved-banner" : "database-banner error", children: notice }) : null,
    jsxs("div", { className: `field-service-layout ${canManage ? "with-dispatch" : ""}`, children: [
      canManage ? jsxs("form", { className: "settings-card work-form field-service-form", onSubmit: createJob, children: [
        jsx("h3", { children: "Create site job" }),
        jsxs("label", { children: ["Customer", jsxs("select", { value: form.customer_name, required: true, onChange: (event) => chooseCustomer(event.target.value), children: [jsx("option", { value: "", children: "Choose customer" }), ...clients.map((client) => jsx("option", { value: client.name, children: client.name }, client.id))] })] }),
        jsxs("label", { children: ["Service address", jsx("input", { value: form.service_address, required: true, onChange: (event) => setForm({ ...form, service_address: event.target.value }) })] }),
        jsxs("label", { children: ["Job title", jsx("input", { value: form.title, required: true, placeholder: "Installation, inspection, or repair", onChange: (event) => setForm({ ...form, title: event.target.value }) })] }),
        jsxs("label", { children: ["Work details", jsx("textarea", { value: form.description, rows: 4, onChange: (event) => setForm({ ...form, description: event.target.value }) })] }),
        jsxs("label", { children: ["Schedule", jsx("input", { type: "datetime-local", value: form.scheduled_at, onChange: (event) => setForm({ ...form, scheduled_at: event.target.value }) })] }),
        jsxs("label", { children: ["Assign technician", jsxs("select", { value: form.assigned_to, onChange: (event) => setForm({ ...form, assigned_to: event.target.value }), children: [jsx("option", { value: "", children: "Unassigned" }), ...technicians.map((technician) => jsx("option", { value: technician.id, children: technician.name }, technician.id))] })] }),
        jsx("button", { type: "submit", disabled: busy, children: busy ? "Saving…" : "Create job" })
      ] }) : null,
      jsxs("article", { className: "dashboard-panel field-service-board", children: [
        jsxs("div", { className: "section-heading", children: [jsx("h3", { children: canManage ? "Service jobs" : "My assigned jobs" }), jsx("span", { children: `${jobs.length} job${jobs.length === 1 ? "" : "s"}` })] }),
        jobs.length ? jsx("div", { className: "field-service-list", children: jobs.map((job) => jsxs("article", { children: [
          jsxs("div", { className: "field-job-heading", children: [jsxs("div", { children: [jsx("strong", { children: job.title }), jsx("small", { children: job.customerName })] }), jsx("span", { className: `send-status ${job.status}`, children: job.status.replaceAll("_", " ") })] }),
          jsx("p", { children: job.description || "No work details provided." }),
          jsxs("dl", { children: [jsxs("div", { children: [jsx("dt", { children: "Address" }), jsx("dd", { children: job.serviceAddress })] }), jsxs("div", { children: [jsx("dt", { children: "Schedule" }), jsx("dd", { children: job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : "Not scheduled" })] }), jsxs("div", { children: [jsx("dt", { children: "Technician" }), jsx("dd", { children: job.assignedName })] })] }),
          canManage ? jsxs("label", { children: ["Assignment", jsxs("select", { value: job.assignedTo || "", disabled: busy, onChange: (event) => void assignJob(job.id, event.target.value), children: [jsx("option", { value: "", children: "Unassigned" }), ...technicians.map((technician) => jsx("option", { value: technician.id, children: technician.name }, technician.id))] })] }) : null,
          jsxs("label", { children: ["Status", jsx("select", { value: job.status, disabled: busy, onChange: (event) => void updateJob(job, { status: event.target.value }), children: statusOptions.map(([value, label]) => jsx("option", { value, children: label }, value)) })] }),
          jsxs("label", { children: ["Technician notes", jsx("textarea", { defaultValue: job.technicianNotes, rows: 3, onBlur: (event) => { if (event.target.value !== job.technicianNotes) void updateJob(job, { technicianNotes: event.target.value }); } })] })
        ] }, job.id)) }) : jsx("p", { className: "dashboard-filter-empty", children: canManage ? "No field-service jobs have been created." : "No field-service jobs are assigned to you." })
      ] })
    ] })
  ] });
}

export default FieldServicePage;
