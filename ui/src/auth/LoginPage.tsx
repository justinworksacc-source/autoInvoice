import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  async function handleSubmit(event) {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    const loginError = await onLogin(cleanUsername, password);
    setError(loginError || "");
  }
  return /* @__PURE__ */ jsx("main", { className: "login-shell", children: /* @__PURE__ */ jsxs("div", { className: "login-content", children: [
    /* @__PURE__ */ jsxs("header", { className: "login-brand-heading", children: [
      /* @__PURE__ */ jsx("img", { src: "/logo.png", alt: "Visual Security Systems", className: "login-brand-logo" }),
      /* @__PURE__ */ jsx("h1", { children: "Visual Security System" }),
      /* @__PURE__ */ jsx("p", { children: "Information Technology Solutions" })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "login-card", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Visual Security Systems" }),
        /* @__PURE__ */ jsx("h2", { children: "Login" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "login-form", autoComplete: "off", onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxs("label", { children: [
          "Username",
          /* @__PURE__ */ jsxs("span", { className: "login-input-wrap", children: [
            /* @__PURE__ */ jsx("span", { className: "login-input-icon", "aria-hidden": "true", children: "\u2659" }),
            /* @__PURE__ */ jsx("input", { autoComplete: "off", name: "login-username", placeholder: "Enter your username", value: username, onChange: (event) => setUsername(event.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Password",
          /* @__PURE__ */ jsxs("span", { className: "login-input-wrap", children: [
            /* @__PURE__ */ jsx("span", { className: "login-input-icon", "aria-hidden": "true", children: "\u2659" }),
            /* @__PURE__ */ jsx("input", { type: showPassword ? "text" : "password", autoComplete: "new-password", name: "login-password", placeholder: "Enter your password", value: password, onChange: (event) => setPassword(event.target.value) }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "login-password-toggle", "aria-label": showPassword ? "Hide password" : "Show password", onClick: () => setShowPassword((visible) => !visible), children: "\u25C9" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "login-options", children: [
          /* @__PURE__ */ jsxs("label", { className: "remember-login", children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox" }),
            " ",
            /* @__PURE__ */ jsx("span", { children: "Remember me" })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "forgot-password", onClick: () => setError("Please contact your administrator to reset your password."), children: "Forgot password?" })
        ] }),
        error ? /* @__PURE__ */ jsx("p", { className: "login-error", children: error }) : null,
        /* @__PURE__ */ jsxs("button", { type: "submit", children: [
          /* @__PURE__ */ jsx("span", { children: "Login" }),
          /* @__PURE__ */ jsx("b", { "aria-hidden": "true", children: "\u2192" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "login-security-note", children: [
      /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2662" }),
      " Secure access to your security and IT solutions"
    ] })
  ] }) });
}
export {
  LoginPage as default
};
