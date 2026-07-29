import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import usePostalPH from "use-postal-ph";
import { clampNumber, formatDueDate, isDateInput, parseDateInput } from "../shared";
const philippinePostalPlaces = usePostalPH().fetchDataLists().data;
function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== void 0 && value !== ""))].sort((left, right) => String(left).localeCompare(String(right)));
}
function PrepareInvoicesPage({
  clients,
  profile,
  businessDate,
  setClients,
  saveClientToDatabase,
  autoSendEnabled,
  onAutoSendChange
}) {
  const [startDate, setStartDate] = useState(businessDate);
  const [sendTime, setSendTime] = useState("09:00");
  const [dueDays, setDueDays] = useState("14");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [addressHouse, setAddressHouse] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressSubdivision, setAddressSubdivision] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressMunicipality, setAddressMunicipality] = useState("");
  const [addressLocality, setAddressLocality] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [itemType, setItemType] = useState("Service");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [subject, setSubject] = useState("Invoice {{invoice_number}} for {{billing_month}}");
  const [message, setMessage] = useState(
    "Hi {{customer_name}},\n\nAttached is your invoice {{invoice_number}} for {{billing_month}}. Payment is due on {{due_date}}.\n\nThank you,\n{{company_name}}"
  );
  const [saved, setSaved] = useState(false);
  const [customerSaved, setCustomerSaved] = useState(false);
  useEffect(() => {
    setStartDate(businessDate);
  }, [businessDate]);
  const cleanStartDate = isDateInput(startDate) ? startDate : businessDate;
  const startDateValue = parseDateInput(cleanStartDate);
  const billingDay = String(clampNumber(String(startDateValue.getDate()), 1, 1, 31));
  const startDateLabel = formatDueDate(startDateValue);
  const dueDateValue = new Date(startDateValue);
  dueDateValue.setDate(dueDateValue.getDate() + clampNumber(dueDays, 14, 1, 90));
  const dueDateLabel = formatDueDate(dueDateValue);
  const automaticInvoiceNumber = useMemo(() => {
    const existingClient = clients.find((client) => client.email.toLowerCase() === customerEmail.trim().toLowerCase());
    if (existingClient) {
      return existingClient.invoiceNumber;
    }
    const now = parseDateInput(businessDate);
    const billingMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sequence = String(clients.length + 1).padStart(3, "0");
    return `INV-${billingMonth}-${sequence}`;
  }, [businessDate, clients, customerEmail]);
  const exceptionRules = [
    "missing billing email",
    "changed monthly amount",
    "credit or refund applied",
    "open dispute",
    "invoice total over approved limit"
  ];
  const addressRegions = uniqueValues(philippinePostalPlaces.map((place) => place.region));
  const municipalityPlaces = philippinePostalPlaces.filter((place) => place.region === addressRegion);
  const addressMunicipalities = uniqueValues(municipalityPlaces.map((place) => place.municipality));
  const localityPlaces = municipalityPlaces.filter((place) => place.municipality === addressMunicipality);
  const addressLocalities = uniqueValues(localityPlaces.map((place) => place.location));
  const postalPlaces = localityPlaces.filter((place) => !addressLocality || place.location === addressLocality);
  const addressPostalCodes = uniqueValues(postalPlaces.map((place) => place.post_code));
  function updateComposedAddress(next) {
    const house = String(next.house ?? addressHouse);
    const street = String(next.street ?? addressStreet);
    const subdivision = String(next.subdivision ?? addressSubdivision);
    const barangay = String(next.barangay ?? addressBarangay);
    const municipality = String(next.municipality ?? addressMunicipality);
    const locality = String(next.location ?? addressLocality);
    const postalCode = String(next.post_code ?? addressPostalCode);
    setCustomerAddress([house, street, subdivision, barangay, locality, municipality, postalCode, "Philippines"].filter(Boolean).join(", "));
  }
  function handleSave(event) {
    event.preventDefault();
    const emailKey = customerEmail.trim().toLowerCase();
    const nextClient = {
      id: emailKey,
      name: customerName.trim() || "Unnamed customer",
      email: customerEmail.trim(),
      address: customerAddress.trim(),
      invoiceNumber: automaticInvoiceNumber,
      amount: invoiceAmount.trim() || "0.00",
      itemType,
      itemName: itemName.trim(),
      itemDescription: itemDescription.trim(),
      startDate: cleanStartDate,
      billingDay,
      dueAfterDays: dueDays,
      lastSent: "Not sent yet",
      status: autoSendEnabled ? "Scheduled" : "Draft"
    };
    setClients((currentClients) => {
      const existingIndex = currentClients.findIndex((client) => client.id === emailKey);
      if (existingIndex === -1) {
        return [...currentClients, nextClient];
      }
      return currentClients.map((client, index) => index === existingIndex ? nextClient : client);
    });
    saveClientToDatabase(nextClient);
    setSaved(true);
    setCustomerSaved(true);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerAddress("");
    setAddressRegion("");
    setAddressMunicipality("");
    setAddressLocality("");
    setAddressPostalCode("");
    setInvoiceAmount("");
    setItemType("Service");
    setItemName("");
    setItemDescription("");
  }
  return /* @__PURE__ */ jsxs("section", { className: "page-stack monthly-invoices-page", children: [
    /* @__PURE__ */ jsx("div", { className: "page-heading", children: /* @__PURE__ */ jsxs("div", { className: "page-heading-with-back", children: [
      /* @__PURE__ */ jsx(Link, { to: "/accountant", className: "page-back-link", "aria-label": "Back to Accountant", title: "Back to Accountant", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M15 18 9 12l6-6" }) }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Gmail invoice automation" }),
        /* @__PURE__ */ jsx("h2", { children: "Monthly Invoices" }),
        /* @__PURE__ */ jsx("p", { className: "monthly-invoices-subtitle", children: "Automate and manage monthly invoice generation and delivery." })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "metric-grid", "aria-label": "Monthly invoice status", children: [
      /* @__PURE__ */ jsxs("article", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("span", { children: "Next run" }),
        /* @__PURE__ */ jsx("strong", { children: startDateLabel }),
        /* @__PURE__ */ jsxs("small", { children: [
          "at ",
          sendTime
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("span", { children: "Clients" }),
        /* @__PURE__ */ jsx("strong", { children: clients.length }),
        /* @__PURE__ */ jsx("small", { children: "Active clients" })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("span", { children: "Due after" }),
        /* @__PURE__ */ jsxs("strong", { children: [
          dueDays,
          " days"
        ] }),
        /* @__PURE__ */ jsx("small", { children: "Invoice payment terms" })
      ] })
    ] }),
    saved ? /* @__PURE__ */ jsx("div", { className: "saved-banner", children: "Monthly invoice rule saved locally for the next billing run." }) : null,
    customerSaved ? /* @__PURE__ */ jsx("div", { className: "saved-banner", children: "Client Gmail recipient saved to the monthly invoice list." }) : null,
    /* @__PURE__ */ jsxs("div", { className: "invoice-layout", children: [
      /* @__PURE__ */ jsxs("form", { id: "monthly-invoice-settings", className: "work-form settings-card monthly-settings-card", onSubmit: handleSave, children: [
        /* @__PURE__ */ jsxs("div", { className: "monthly-card-title", children: [
          /* @__PURE__ */ jsx("span", { children: "\u2699" }),
          /* @__PURE__ */ jsx("h3", { children: "Invoice Automation Settings" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Customer start date",
            /* @__PURE__ */ jsx("input", { type: "date", value: startDate, onChange: (event) => setStartDate(event.target.value) })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Send time",
            /* @__PURE__ */ jsx("input", { type: "time", value: sendTime, onChange: (event) => setSendTime(event.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Due after days",
            /* @__PURE__ */ jsx("input", { min: "1", max: "90", type: "number", value: dueDays, onChange: (event) => setDueDays(event.target.value) })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "From Gmail alias",
            /* @__PURE__ */ jsx("output", { className: "monthly-readonly-value", children: profile.gmailAlias || "Not configured" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Company name",
          /* @__PURE__ */ jsx("output", { className: "monthly-readonly-value", children: profile.companyName || "Not configured" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Customer name",
            /* @__PURE__ */ jsx("input", { value: customerName, placeholder: "Enter customer name", onChange: (event) => setCustomerName(event.target.value), required: true })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Customer Gmail / billing email",
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "email",
                value: customerEmail,
                placeholder: "customer@gmail.com",
                onChange: (event) => setCustomerEmail(event.target.value),
                required: true
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Invoice number (automatic)",
            /* @__PURE__ */ jsx("output", { className: "monthly-readonly-value", children: automaticInvoiceNumber })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Monthly amount",
            /* @__PURE__ */ jsx("input", { inputMode: "decimal", value: invoiceAmount, placeholder: "0.00", onChange: (event) => setInvoiceAmount(event.target.value), required: true })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("label", { children: [
            "Item type",
            /* @__PURE__ */ jsxs("select", { value: itemType, onChange: (event) => setItemType(event.target.value), children: [
              /* @__PURE__ */ jsx("option", { value: "Service", children: "Service" }),
              /* @__PURE__ */ jsx("option", { value: "Product", children: "Product" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Service or product",
            /* @__PURE__ */ jsx("input", { value: itemName, placeholder: "e.g. Consultancy services", onChange: (event) => setItemName(event.target.value), required: true })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          "Description (optional)",
          /* @__PURE__ */ jsx("textarea", { value: itemDescription, placeholder: "e.g. Monthly business consultancy and advisory support", rows: 3, onChange: (event) => setItemDescription(event.target.value) })
        ] }),
        /* @__PURE__ */ jsxs("fieldset", { className: "billing-address-fields", children: [
          /* @__PURE__ */ jsx("legend", { children: "Customer billing address" }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Block / Lot / House No.",
              /* @__PURE__ */ jsx("input", { value: addressHouse, placeholder: "e.g. Block 3, Lot 9", onChange: (event) => {
                setAddressHouse(event.target.value);
                updateComposedAddress({ house: event.target.value });
              } })
            ] }),
            /* @__PURE__ */ jsxs("label", { children: [
              "Street",
              /* @__PURE__ */ jsx("input", { value: addressStreet, placeholder: "e.g. Bergamo Street", onChange: (event) => {
                setAddressStreet(event.target.value);
                updateComposedAddress({ street: event.target.value });
              } })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Subdivision / Village",
              /* @__PURE__ */ jsx("input", { value: addressSubdivision, placeholder: "e.g. Camella Homes", onChange: (event) => {
                setAddressSubdivision(event.target.value);
                updateComposedAddress({ subdivision: event.target.value });
              } })
            ] }),
            /* @__PURE__ */ jsxs("label", { children: [
              "Barangay",
              /* @__PURE__ */ jsx("input", { value: addressBarangay, placeholder: "e.g. Cantil-e", onChange: (event) => {
                setAddressBarangay(event.target.value);
                updateComposedAddress({ barangay: event.target.value });
              } })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Region ",
              /* @__PURE__ */ jsx("span", { className: "sr-only", children: "used to filter provinces" }),
              /* @__PURE__ */ jsxs("select", { value: addressRegion, onChange: (event) => {
                const region = event.target.value;
                setAddressRegion(region);
                setAddressMunicipality("");
                setAddressLocality("");
                setAddressPostalCode("");
                updateComposedAddress({ region, municipality: "", location: "", post_code: "" });
              }, children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Choose region" }),
                addressRegions.map((region) => /* @__PURE__ */ jsx("option", { value: region, children: region }, region))
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { children: [
              "Province",
              /* @__PURE__ */ jsxs("select", { value: addressMunicipality, disabled: !addressRegion, onChange: (event) => {
                const municipality = event.target.value;
                setAddressMunicipality(municipality);
                setAddressLocality("");
                setAddressPostalCode("");
                updateComposedAddress({ municipality, location: "", post_code: "" });
              }, children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Choose province" }),
                addressMunicipalities.map((municipality) => /* @__PURE__ */ jsx("option", { value: municipality, children: municipality }, municipality))
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "City / Municipality",
              /* @__PURE__ */ jsxs("select", { value: addressLocality, disabled: !addressMunicipality, onChange: (event) => {
                const location = event.target.value;
                setAddressLocality(location);
                setAddressPostalCode("");
                updateComposedAddress({ location, post_code: "" });
              }, children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Choose city / municipality" }),
                addressLocalities.map((locality) => /* @__PURE__ */ jsx("option", { value: locality, children: locality }, locality))
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { children: [
              "Postal code",
              /* @__PURE__ */ jsxs("select", { value: addressPostalCode, disabled: !addressMunicipality, onChange: (event) => {
                const postCode = event.target.value;
                setAddressPostalCode(postCode);
                updateComposedAddress({ post_code: postCode });
              }, children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Choose postal code" }),
                addressPostalCodes.map((postCode) => /* @__PURE__ */ jsx("option", { value: postCode, children: postCode }, postCode))
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { children: [
            "Country",
            /* @__PURE__ */ jsx("output", { className: "monthly-readonly-value", children: "Philippines" })
          ] }),
          /* @__PURE__ */ jsxs("p", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Complete address:" }),
            " ",
            customerAddress || "Select the address fields above."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "checkbox-line", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: autoSendEnabled, onChange: (event) => onAutoSendChange(event.target.checked) }),
          "Send monthly invoices automatically 7 days before due"
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", children: "Save monthly invoice" })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "invoice-preview invoice-text-summary", "aria-label": "Invoice details summary", children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "monthly-title-icon", children: "\u25A7" }),
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h3", { children: "Invoice PDF Details" }) })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "invoice-details-info", children: "\u24D8 \xA0 These details will be used to generate the invoice PDF that is emailed." }),
        /* @__PURE__ */ jsxs("dl", { children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Invoice number" }),
            /* @__PURE__ */ jsx("dd", { children: automaticInvoiceNumber })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Invoice date" }),
            /* @__PURE__ */ jsx("dd", { children: startDateLabel })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Due date" }),
            /* @__PURE__ */ jsx("dd", { children: dueDateLabel })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Customer" }),
            /* @__PURE__ */ jsx("dd", { children: customerName.trim() || "No customer entered" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Billing email" }),
            /* @__PURE__ */ jsx("dd", { children: customerEmail.trim() || "No billing email entered" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Billing address" }),
            /* @__PURE__ */ jsx("dd", { children: customerAddress.trim() || "No billing address entered" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Service / product" }),
            /* @__PURE__ */ jsxs("dd", { children: [
              itemName.trim() || "No item entered",
              itemDescription.trim() ? ` — ${itemDescription.trim()}` : ""
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Monthly amount" }),
            /* @__PURE__ */ jsx("dd", { children: invoiceAmount.trim() || "0.00" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Attachment" }),
            /* @__PURE__ */ jsxs("dd", { children: [
              automaticInvoiceNumber,
              ".pdf"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "invoice-summary-note", children: "The Gmail attachment contains the final invoice layout. This panel only confirms the information that will be placed in that PDF." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "invoice-layout", children: [
      /* @__PURE__ */ jsxs("form", { className: "work-form settings-card monthly-email-card", children: [
        /* @__PURE__ */ jsxs("label", { children: [
          /* @__PURE__ */ jsx("span", { className: "monthly-field-title", children: "\u2709 \xA0 Email Subject" }),
          /* @__PURE__ */ jsx("input", { value: subject, onChange: (event) => setSubject(event.target.value) })
        ] }),
        /* @__PURE__ */ jsxs("label", { children: [
          /* @__PURE__ */ jsx("span", { className: "monthly-field-title", children: "\u2709 \xA0 Email Body" }),
          /* @__PURE__ */ jsx("textarea", { value: message, onChange: (event) => setMessage(event.target.value), rows: 8 })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("article", { className: "invoice-preview", children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
          /* @__PURE__ */ jsx("span", { className: "monthly-title-icon", children: "\u2662" }),
          /* @__PURE__ */ jsx("h3", { children: "Send Policy" })
        ] }),
        /* @__PURE__ */ jsx("p", { children: "Routine invoices send immediately when auto-send is on. Exception invoices stay in the approval queue so billing does not stop for normal customers." }),
        /* @__PURE__ */ jsx("ul", { className: "exception-list", children: exceptionRules.map((rule) => /* @__PURE__ */ jsx("li", { children: rule }, rule)) })
      ] })
    ] })
  ] });
}
export {
  PrepareInvoicesPage as default
};
