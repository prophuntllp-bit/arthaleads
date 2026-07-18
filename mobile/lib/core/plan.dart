/// Plan feature gates — mirrors frontend/src/utils/plan.js.
const _planLevels = {
  'starter': 1,
  'trial': 2,
  'growth': 2,
  'pro': 2,
  'enterprise': 3,
};

int planLevel(String? plan) => _planLevels[plan] ?? 1;

/// Check if org's plan meets the minimum required plan.
bool canAccess(Map<String, dynamic>? org, String minPlan) {
  if (org == null) return false;
  return planLevel(org['plan'] as String?) >= planLevel(minPlan);
}

const _planLabels = {
  'starter': 'Starter',
  'trial': 'Free Trial',
  'growth': 'Growth',
  'pro': 'Growth',
  'enterprise': 'Enterprise',
};

String planLabel(String? plan) => _planLabels[plan] ?? 'Starter';

/// Human-readable upgrade target — null if already at the top tier.
String? upgradeTarget(String? plan) {
  if (plan == 'trial') return 'Growth';
  if (planLevel(plan) == 1) return 'Growth';
  if (planLevel(plan) == 2) return 'Enterprise';
  return null;
}
