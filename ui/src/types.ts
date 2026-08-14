export type InvoiceStatus = "Scheduled" | "Draft" | "Sent" | "Needs approval";

export interface BusinessProfile {
  companyName: string;
  gmailAlias: string;
}

export interface AuthSession {
  email: string;
  username: string;
  signedInAt: string;
  role?: string;
}

export interface InvoiceClient {
  id: string;
  name: string;
  email: string;
  address?: string;
  phone?: string;
  customerNumber?: string;
  invoiceNumber: string;
  amount: string;
  itemType?: "Service" | "Product";
  itemName?: string;
  itemDescription?: string;
  startDate?: string;
  billingDay: string;
  dueAfterDays?: string;
  lastSent: string;
  lastSentDueDate?: string;
  status: InvoiceStatus;
  databaseId?: number;
}

export interface InvoicePayment {
  id: string;
  clientId: string;
  amount: string;
  paidAt: string;
  method: string;
  referenceNumber: string;
  notes: string;
  createdAt: string;
}

export interface InvoiceHistoryEntry {
  id: string;
  clientId: string;
  invoiceNumber: string;
  recipient: string;
  amount: string;
  dueDate: string;
  sentAt: string;
  delivery: string;
}
