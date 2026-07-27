<?php

final class DashboardController {
    public function __construct(private PDO $pdo, private int $companyId = 1) {}

    public function index(): array {
        $statement = $this->pdo->prepare(
            "SELECT
              (SELECT COUNT(*) FROM monthly_invoice_clients WHERE company_id = :company_clients) AS client_count,
              (SELECT COALESCE(SUM(monthly_amount), 0) FROM monthly_invoice_clients WHERE company_id = :company_billing) AS monthly_billing,
              (SELECT COUNT(*) FROM monthly_invoice_clients WHERE company_id = :company_scheduled AND status = 'scheduled') AS scheduled_count,
              (SELECT COUNT(*) FROM monthly_invoice_clients WHERE company_id = :company_sent AND status = 'sent') AS sent_count,
              (SELECT COUNT(*) FROM monthly_invoice_clients WHERE company_id = :company_draft AND status = 'draft') AS draft_count,
              (SELECT COUNT(*) FROM monthly_invoice_clients WHERE company_id = :company_review AND status IN ('needs approval', 'needs_approval')) AS needs_approval_count,
              (SELECT COALESCE(SUM(balance_due), 0) FROM monthly_invoice_cycles WHERE company_id = :company_balance) AS outstanding_balance,
              (SELECT COUNT(DISTINCT client_id) FROM monthly_invoice_cycles WHERE company_id = :company_overdue AND status = 'overdue' AND balance_due > 0) AS overdue_clients,
              (SELECT COALESCE(SUM(amount), 0) FROM monthly_invoice_payments WHERE company_id = :company_payments) AS total_payments"
        );
        $statement->execute([
            ':company_clients' => $this->companyId, ':company_billing' => $this->companyId,
            ':company_scheduled' => $this->companyId, ':company_sent' => $this->companyId,
            ':company_draft' => $this->companyId, ':company_review' => $this->companyId,
            ':company_balance' => $this->companyId, ':company_overdue' => $this->companyId,
            ':company_payments' => $this->companyId,
        ]);
        $summary = $statement->fetch() ?: [];

        return $summary;
    }
}
