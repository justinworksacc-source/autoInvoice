import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
function ProfilePage({ profile, onProfileSave, session, onLogout, onCredentialsChange }) {
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [gmailAlias, setGmailAlias] = useState(profile.gmailAlias);
  const [saved, setSaved] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [username, setUsername] = useState(session.username || session.email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    setCompanyName(profile.companyName);
    setGmailAlias(profile.gmailAlias);
  }, [profile.companyName, profile.gmailAlias]);
  async function handleSaveCredentials(event) {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setCredentialsMessage("Username must be at least 3 characters.");
      return;
    }
    if (newPassword.length < 8) {
      setCredentialsMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setCredentialsMessage("The password confirmation does not match.");
      return;
    }
    try {
      await onCredentialsChange(cleanUsername, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setCredentialsMessage("Username and password updated.");
    } catch (error) {
      setCredentialsMessage(error instanceof Error ? error.message : "Credential update failed.");
    }
  }
  async function handleSaveProfile(event) {
    event.preventDefault();
    setSaved(false);
    setProfileMessage("");
    try {
      const savedProfile = await onProfileSave({
        companyName: companyName.trim() || profile.companyName,
        gmailAlias: gmailAlias.trim()
      });
      setCompanyName(savedProfile.companyName);
      setGmailAlias(savedProfile.gmailAlias);
      setSaved(true);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    }
  }
  return /* @__PURE__ */ jsxs("section", { className: "page-stack profile-page", children: [
    /* @__PURE__ */ jsx("div", { className: "profile-page-heading", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h2", { children: "Profile" }),
      /* @__PURE__ */ jsx("span", { className: "status-pill", children: "\u2727\xA0 Auto-fill source" })
    ] }) }),
    saved ? /* @__PURE__ */ jsx("div", { className: "saved-banner", children: "Profile saved to the database. All devices will use these values automatically." }) : null,
    profileMessage ? /* @__PURE__ */ jsx("div", { className: "login-error", children: profileMessage }) : null,
    /* @__PURE__ */ jsxs("div", { className: "profile-editor-grid", children: [
      /* @__PURE__ */ jsxs("form", { className: "profile-editor-card", onSubmit: handleSaveProfile, children: [
        /* @__PURE__ */ jsxs("div", { className: "profile-card-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "profile-heading-icon", "aria-hidden": "true", children: "\u25A5" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Company Profile" }),
            /* @__PURE__ */ jsx("p", { children: "Manage your company information." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Company name",
          /* @__PURE__ */ jsx("input", { value: companyName, onChange: (event) => setCompanyName(event.target.value), required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Gmail sender email",
          /* @__PURE__ */ jsx("input", { type: "email", value: gmailAlias, onChange: (event) => setGmailAlias(event.target.value), required: true })
        ] }),
        /* @__PURE__ */ jsxs("button", { type: "submit", children: [
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u25A3" }),
          " Save profile"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "profile-editor-card", onSubmit: handleSaveCredentials, children: [
        /* @__PURE__ */ jsxs("div", { className: "profile-card-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "profile-heading-icon security", "aria-hidden": "true", children: "\u2659" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: "Login & Security" }),
            /* @__PURE__ */ jsx("p", { children: "Update your login credentials." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Username",
          /* @__PURE__ */ jsx("input", { autoComplete: "username", value: username, onChange: (event) => setUsername(event.target.value), required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "New password",
          /* @__PURE__ */ jsx("input", { type: showPassword ? "text" : "password", autoComplete: "new-password", value: newPassword, onChange: (event) => setNewPassword(event.target.value), minLength: 8, required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Confirm new password",
          /* @__PURE__ */ jsxs("span", { className: "password-input-wrap", children: [
            /* @__PURE__ */ jsx("input", { type: showPassword ? "text" : "password", autoComplete: "new-password", value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value), minLength: 8, required: true }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "password-toggle", "aria-label": showPassword ? "Hide passwords" : "Show passwords", onClick: () => setShowPassword((visible) => !visible), children: "\u25C9" })
          ] })
        ] }),
        credentialsMessage ? /* @__PURE__ */ jsx("p", { className: credentialsMessage.includes("updated") ? "settings-saved-message" : "login-error", children: credentialsMessage }) : null,
        /* @__PURE__ */ jsxs("button", { type: "submit", children: [
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2659" }),
          " Update login credentials"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("article", { className: "current-profile-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "profile-card-heading", children: [
        /* @__PURE__ */ jsx("span", { className: "profile-heading-icon", "aria-hidden": "true", children: "\u2659" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { children: "Current Profile" }),
          /* @__PURE__ */ jsx("p", { children: "Your current account information." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("dl", { className: "current-profile-details", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "current-profile-icon", "aria-hidden": "true", children: "\u25A5" }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Company" }),
            /* @__PURE__ */ jsx("dd", { children: profile.companyName })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "current-profile-icon", "aria-hidden": "true", children: "\u2709" }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Gmail sender" }),
            /* @__PURE__ */ jsx("dd", { children: profile.gmailAlias })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { className: "current-profile-icon", "aria-hidden": "true", children: "\u2659" }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Logged in" }),
            /* @__PURE__ */ jsx("dd", { children: session.username || session.email })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "profile-logout-cell", children: /* @__PURE__ */ jsx("button", { type: "button", className: "danger-button profile-logout-button", onClick: onLogout, children: "\u21AA\xA0 Logout" }) })
      ] })
    ] })
  ] });
}
export {
  ProfilePage as default
};
