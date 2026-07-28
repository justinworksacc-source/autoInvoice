import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateInput, formatDueDate, isDateInput, parseDateInput } from "../shared";
function manilaClock(date = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}
function SettingsPage({ businessDate, businessTime, onBusinessDateChange, theme, onThemeChange, autoSendEnabled, onAutoSendChange }) {
  const [draftBusinessDate, setDraftBusinessDate] = useState(businessDate);
  const [draftBusinessTime, setDraftBusinessTime] = useState(businessTime);
  const [liveManilaTime, setLiveManilaTime] = useState(() => manilaClock());
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraftBusinessDate(businessDate);
    setDraftBusinessTime(businessTime);
  }, [businessDate, businessTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setLiveManilaTime(manilaClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function saveDate(event) {
    event.preventDefault();
    const nextDate = isDateInput(draftBusinessDate) ? draftBusinessDate : formatDateInput();
    setDraftBusinessDate(nextDate);
    onBusinessDateChange(nextDate, draftBusinessTime);
    setSaved(true);
  }
  function useToday() {
    const today = formatDateInput();
    const currentTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
    setDraftBusinessDate(today);
    setDraftBusinessTime(currentTime);
    onBusinessDateChange(today, currentTime);
    setSaved(true);
  }
  return /* @__PURE__ */ jsxs("section", { className: "page-stack settings-page", children: [
    /* @__PURE__ */ jsxs("div", { className: "page-heading", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Application preferences" }),
        /* @__PURE__ */ jsx("h2", { children: "Settings" }),
        /* @__PURE__ */ jsx("p", { className: "settings-intro", children: "Manage the working date used by dashboards, invoices, due dates, and payment calculations." })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "status-pill", children: "Asia/Manila" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "settings-layout", children: [
      /* @__PURE__ */ jsxs("article", { className: "settings-card business-date-settings", children: [
        /* @__PURE__ */ jsxs("div", { className: "settings-card-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "settings-icon", "aria-hidden": "true", children: "\u25A3" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Business date & time" }),
            /* @__PURE__ */ jsx("p", { children: "Control the date and time used for financial operations." })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "automation-badge", children: "Automatic sync enabled" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "current-business-date", children: [
          /* @__PURE__ */ jsx("span", { children: "Current business date" }),
          /* @__PURE__ */ jsx("strong", { children: formatDueDate(parseDateInput(businessDate)) }),
          /* @__PURE__ */ jsx("span", { children: "Live Manila time" }),
          /* @__PURE__ */ jsx("strong", { children: liveManilaTime }),
          /* @__PURE__ */ jsx("small", { children: "The live clock updates every second." })
        ] }),
        /* @__PURE__ */ jsxs("form", { className: "settings-date-form", onSubmit: saveDate, children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Set business date manually",
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                value: draftBusinessDate,
                onChange: (event) => {
                  setDraftBusinessDate(event.target.value);
                  setSaved(false);
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Set business time manually",
            /* @__PURE__ */ jsx("input", {
              type: "time",
              value: draftBusinessTime,
              onChange: (event) => {
                setDraftBusinessTime(event.target.value);
                setSaved(false);
              }
            })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "settings-form-actions", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "secondary-button", onClick: useToday, children: "Use current date & time" }),
            /* @__PURE__ */ jsx("button", { type: "submit", children: "Save date & time" })
          ] }),
          saved ? /* @__PURE__ */ jsx("p", { className: "settings-saved-message", children: "Business date and time saved." }) : null
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "settings-card appearance-settings", children: [
        /* @__PURE__ */ jsxs("div", { className: "settings-card-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "settings-icon appearance", "aria-hidden": "true", children: "\u25D0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Appearance" }),
            /* @__PURE__ */ jsx("p", { children: "Choose how the entire workspace looks." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "theme-options", role: "group", "aria-label": "Color theme", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: theme === "dark" ? "theme-option active" : "theme-option",
              "aria-pressed": theme === "dark",
              onClick: () => onThemeChange("dark"),
              children: [
                /* @__PURE__ */ jsxs("span", { className: "theme-preview dark-preview", children: [
                  /* @__PURE__ */ jsx("i", {}),
                  /* @__PURE__ */ jsx("i", {}),
                  /* @__PURE__ */ jsx("i", {})
                ] }),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("strong", { children: "Dark mode" }),
                  /* @__PURE__ */ jsx("small", { children: "Low-light finance workspace" })
                ] }),
                /* @__PURE__ */ jsx("b", { children: theme === "dark" ? "\u2713" : "" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: theme === "light" ? "theme-option active" : "theme-option",
              "aria-pressed": theme === "light",
              onClick: () => onThemeChange("light"),
              children: [
                /* @__PURE__ */ jsxs("span", { className: "theme-preview light-preview", children: [
                  /* @__PURE__ */ jsx("i", {}),
                  /* @__PURE__ */ jsx("i", {}),
                  /* @__PURE__ */ jsx("i", {})
                ] }),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("strong", { children: "Light mode" }),
                  /* @__PURE__ */ jsx("small", { children: "Bright daytime workspace" })
                ] }),
                /* @__PURE__ */ jsx("b", { children: theme === "light" ? "\u2713" : "" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "settings-card automation-settings", children: [
        /* @__PURE__ */ jsxs("div", { className: "settings-card-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "settings-icon automation", "aria-hidden": "true", children: "\u2197" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Invoice automation" }),
            /* @__PURE__ */ jsx("p", { children: "Control automatic invoice delivery seven days before customer due dates." })
          ] }),
          /* @__PURE__ */ jsx("span", { className: `automation-state ${autoSendEnabled ? "enabled" : "disabled"}`, children: autoSendEnabled ? "On" : "Off" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "automation-control-row", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Auto-send invoices" }),
            /* @__PURE__ */ jsx("small", { children: autoSendEnabled ? "Invoices send automatically 7 days before they are due." : "Only manual Send now actions are allowed." })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `settings-switch ${autoSendEnabled ? "on" : "off"}`,
              role: "switch",
              "aria-checked": autoSendEnabled,
              onClick: () => onAutoSendChange(!autoSendEnabled),
              children: [
                /* @__PURE__ */ jsx("span", {}),
                /* @__PURE__ */ jsx("b", { children: autoSendEnabled ? "Turn off" : "Turn on" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("aside", { className: "settings-card settings-info-card", children: [
        /* @__PURE__ */ jsx("h3", { children: "Date behavior" }),
        /* @__PURE__ */ jsxs("dl", { children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Timezone" }),
            /* @__PURE__ */ jsx("dd", { children: "Asia/Manila" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Automatic update" }),
            /* @__PURE__ */ jsx("dd", { children: "Daily at midnight" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Storage" }),
            /* @__PURE__ */ jsx("dd", { children: "MariaDB" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Manual override" }),
            /* @__PURE__ */ jsx("dd", { children: "Allowed" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("p", { children: "The next cron synchronization will return the business date to the current Manila date." }),
        /* @__PURE__ */ jsx(Link, { to: "/profile", children: "Open profile settings" })
      ] })
    ] })
  ] });
}
export {
  SettingsPage as default
};
