import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { formatAmount } from "../shared";

function CustomerPortalPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    fetch(`/api/customer-portal?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Portal unavailable.");
        setData(result);
      }).catch((reason) => setError(reason.message));
  }, [token]);
  async function pay() {
    setPaying(true);
    try {
      const amount = data.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0) || Number(data.client.monthlyAmount);
      const response = await fetch("/api/xendit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_token: token, client_id: data.client.email, amount })
      });
      const result = await response.json();
      if (!response.ok || !result.payment_url) throw new Error(result.error || "Payment checkout unavailable.");
      window.location.assign(result.payment_url);
    } catch (reason) {
      setError(reason.message);
      setPaying(false);
    }
  }
  if (error) return jsx("main", { className: "portal-shell", children: jsxs("article", { className: "portal-card", children: [jsx("h1", { children: "Customer Portal" }), jsx("div", { className: "database-banner error", children: error })] }) });
  if (!data) return jsx("main", { className: "portal-shell", children: jsx("p", { children: "Loading your billing account…" }) });
  const balance = data.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
  return jsx("main", { className: "portal-shell", children: jsxs("article", { className: "portal-card", children: [
    jsx("img", { src: "/ui/vss_logo.svg", alt: "Visual Security Systems", width: 512, height: 512 }),
    jsx("p", { className: "eyebrow", children: "Secure customer access" }),
    jsx("h1", { children: `Hello, ${data.client.name}` }),
    jsx("p", { children: data.client.address || data.client.email }),
    jsxs("div", { className: "portal-balance", children: [jsx("span", { children: "Outstanding balance" }), jsx("strong", { children: formatAmount(balance || Number(data.client.monthlyAmount)) })] }),
    jsx("button", { disabled: paying, onClick: pay, children: paying ? "Opening secure checkout…" : "Pay securely with Xendit" }),
    jsx("button", { className: "secondary-button", onClick: () => window.print(), children: "Print invoices and receipts" }),
    jsx("h2", { children: "Invoices" }),
    data.invoices.length ? jsx("div", { className: "portal-list", children: data.invoices.map((invoice) => jsxs("div", { children: [jsx("strong", { children: invoice.invoiceNumber }), jsx("span", { children: invoice.dueDate }), jsx("span", { children: formatAmount(invoice.balanceDue) }), jsx("small", { children: invoice.status })] }, invoice.id)) }) : jsx("p", { children: "No generated invoice cycles yet." }),
    jsx("h2", { children: "Payment history & receipts" }),
    data.payments.length ? jsx("div", { className: "portal-list", children: data.payments.map((payment) => jsxs("div", { children: [jsx("strong", { children: formatAmount(payment.amount) }), jsx("span", { children: payment.paidAt }), jsx("span", { children: payment.method }), jsx("small", { children: payment.receiptNumber || payment.referenceNumber || "Receipt pending" })] }, payment.id)) }) : jsx("p", { children: "No payments recorded." })
  ] }) });
}

export default CustomerPortalPage;
