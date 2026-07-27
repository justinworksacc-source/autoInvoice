<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['POST']);

$method = $_SERVER['REQUEST_METHOD'];

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$taskType = $payload['task_type'] ?? 'cashflow_review';
$companyId = (int) ($payload['company_id'] ?? 1);
$userId = (int) ($payload['user_id'] ?? 1);
$autonomyLevel = $payload['autonomy_level'] ?? 'prepare';
$businessGoal = trim($payload['business_goal'] ?? 'Review the business and prepare finance work for owner approval.');

$taskCatalog = [
    'cashflow_review' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant'],
        'risk_level' => 'medium',
        'requires_approval' => true,
        'directive' => 'Protect cash, rank urgent financial decisions, and hold money movement for owner approval.',
        'accounting_tasks' => [
            'Prepare cash position from bank balance, receivables, and payables.',
            'Draft payment timing plan with must-pay and deferrable items.',
            'Flag shortfall, surplus, and unusual cash movements.'
        ],
        'approval_gates' => ['release_payments', 'change_vendor_terms']
    ],
    'collections' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant'],
        'risk_level' => 'high',
        'requires_approval' => true,
        'directive' => 'Recover overdue cash while protecting customer relationships.',
        'accounting_tasks' => [
            'Build overdue aging list by customer, invoice, days overdue, and balance.',
            'Draft reminder messages using invoice facts only.',
            'Escalate disputed or high-value accounts for human review.'
        ],
        'approval_gates' => ['send_customer_message', 'recommend_suspension', 'legal_escalation']
    ],
    'monthly_invoice_email' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant', 'gmail'],
        'risk_level' => 'high',
        'requires_approval' => true,
        'directive' => 'Run the monthly billing cycle, send routine invoices through Gmail immediately, and hold exceptions for review.',
        'accounting_tasks' => [
            'Generate invoice numbers, line items, due dates, totals, and PDF attachments.',
            'Validate customer billing email, approved monthly amount, credits, disputes, and tax settings.',
            'Prepare Gmail subject, body, recipient, and attachment map for every invoice.'
        ],
        'approval_gates' => [
            'send_invoice_exception',
            'change_invoice_amount',
            'send_to_new_billing_contact'
        ],
        'email_delivery' => [
            'provider' => 'gmail',
            'mode' => 'send_routine_immediately',
            'fallback' => 'create_draft_for_owner_review',
            'attachment_type' => 'invoice_pdf'
        ]
    ],
    'monthly_close' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant'],
        'risk_level' => 'high',
        'requires_approval' => true,
        'directive' => 'Close the month with clean financial records and clear management questions.',
        'accounting_tasks' => [
            'Prepare reconciliation exception report.',
            'Draft adjusting journal entries with evidence references.',
            'Prepare close checklist and unresolved-item list.'
        ],
        'approval_gates' => ['post_journal_entry', 'lock_period']
    ],
    'expense_review' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant'],
        'risk_level' => 'medium',
        'requires_approval' => true,
        'directive' => 'Reduce waste without interrupting important operations.',
        'accounting_tasks' => [
            'Detect duplicate, unusual, or policy-mismatched expenses.',
            'Draft reimbursement approve, reject, or request-info recommendations.',
            'Prepare vendor savings and negotiation list.'
        ],
        'approval_gates' => ['reject_expense', 'approve_reimbursement', 'cancel_vendor']
    ],
    'executive_report' => [
        'primary_agent' => 'ai_ceo',
        'supporting_agents' => ['ai_accountant'],
        'risk_level' => 'low',
        'requires_approval' => false,
        'directive' => 'Turn financial signals into a concise owner decision brief.',
        'accounting_tasks' => [
            'Prepare revenue, margin, cash, receivables, payables, and expense KPIs.',
            'Explain material variances with confidence levels.',
            'Draft next-cycle operating agenda.'
        ],
        'approval_gates' => ['external_report_release']
    ],
    'email_triage' => [
        'primary_agent' => 'secretary',
        'supporting_agents' => [],
        'risk_level' => 'low',
        'requires_approval' => false,
        'directive' => 'Classify messages and draft replies.',
        'accounting_tasks' => [],
        'approval_gates' => ['send_external_email']
    ]
];

$task = $taskCatalog[$taskType] ?? $taskCatalog['cashflow_review'];
$approvalRequired = $task['requires_approval'] || $autonomyLevel !== 'draft';

$decision = [
    'orchestrator' => 'systemt-ai-orchestrator',
    'primary_agent' => $task['primary_agent'],
    'supporting_agents' => $task['supporting_agents'],
    'company_id' => $companyId,
    'user_id' => $userId,
    'task_type' => $taskType,
    'autonomy_level' => $autonomyLevel,
    'risk_level' => $task['risk_level'],
    'requires_approval' => $approvalRequired,
    'response' => [
        'business_goal' => $businessGoal,
        'ceo_directive' => $task['directive'],
        'accountant_work' => $task['accounting_tasks'],
        'approval_gates' => $task['approval_gates'],
        'email_delivery' => $task['email_delivery'] ?? null,
        'next_steps' => [
            'fetch authorized business data',
            'prepare finance packet',
            'create approval requests for sensitive actions',
            'write audit log entries'
        ]
    ],
    'audit' => [
        'actor_type' => 'agent',
        'agent_name' => $task['primary_agent'],
        'action' => 'delegate_business_work',
        'approval_state' => $approvalRequired ? 'pending' : 'not_required'
    ]
];

echo json_encode($decision, JSON_PRETTY_PRINT);
