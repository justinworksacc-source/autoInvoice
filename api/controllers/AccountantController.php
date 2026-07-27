<?php

final class AccountantController {
    public function __construct(private PDO $pdo, private int $companyId = 1) {}

    public function index(): array {
        $clients = $this->pdo->prepare(
            "SELECT c.id, c.customer_name, c.billing_email, c.invoice_number, c.monthly_amount,
                    c.billing_day, c.due_after_days, c.status,
                    COALESCE(SUM(cycle.balance_due), 0) AS balance_due,
                    COALESCE(SUM(CASE WHEN cycle.status = 'overdue' THEN cycle.balance_due ELSE 0 END), 0) AS overdue_balance
             FROM monthly_invoice_clients c
             LEFT JOIN monthly_invoice_cycles cycle ON cycle.client_id = c.id
             WHERE c.company_id = :company_id
             GROUP BY c.id, c.customer_name, c.billing_email, c.invoice_number, c.monthly_amount,
                      c.billing_day, c.due_after_days, c.status
             ORDER BY overdue_balance DESC, balance_due DESC, c.customer_name"
        );
        $clients->execute([':company_id' => $this->companyId]);
        $clientRows = $clients->fetchAll();

        $payments = $this->pdo->prepare(
            'SELECT id, billing_email, amount, payment_date, method, reference_number, notes
             FROM monthly_invoice_payments WHERE company_id = :company_id
             ORDER BY payment_date DESC, id DESC LIMIT 20'
        );
        $payments->execute([':company_id' => $this->companyId]);
        $paymentRows = $payments->fetchAll();

        $exceptions = $this->pdo->prepare(
            "SELECT COUNT(*) AS review_count FROM monthly_invoice_clients
             WHERE company_id = :company_id AND status IN ('draft', 'needs approval', 'needs_approval')"
        );
        $exceptions->execute([':company_id' => $this->companyId]);
        $reviewCount = (int) (($exceptions->fetch()['review_count'] ?? 0));

        return [
            'clients' => $clientRows,
            'recent_payments' => $paymentRows,
            'review_count' => $reviewCount,
        ];
    }
}
