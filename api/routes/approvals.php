<?php
require_once __DIR__ . '/../security.php';
security_bootstrap(['POST']);

$method = $_SERVER['REQUEST_METHOD'];

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$actionName = $payload['action_name'] ?? 'finance_action';
$impact = $payload['impact'] ?? 'high';
$requiredRole = $payload['required_role'] ?? (($impact === 'high') ? 'owner' : 'finance_manager');

$approval = [
  'status' => 'pending',
  'required_role' => $requiredRole,
  'entity_type' => $payload['entity_type'] ?? 'financial_action',
  'entity_id' => $payload['entity_id'] ?? 0,
  'action_name' => $actionName,
  'impact' => $impact,
  'requested_by_agent' => $payload['requested_by_agent'] ?? 'ai_ceo',
  'message' => 'Human approval required before executing this sensitive action.',
  'policy' => [
    'ai_accountant_may_prepare' => true,
    'ai_ceo_may_recommend' => true,
    'owner_must_approve_execution' => true
  ]
];

echo json_encode($approval, JSON_PRETTY_PRINT);
