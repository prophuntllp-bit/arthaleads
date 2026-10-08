import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/plan.dart';
import 'upgrade_wall.dart';

/// Shows its child only when the org's plan includes the feature, otherwise the
/// upgrade wall. The server enforces the same rule; this keeps people from
/// landing on a screen whose every request would be refused. Mirrors the web's
/// PlanOnly.
class PlanOnly extends StatelessWidget {
  final String min;
  final String feature;
  final String? description;
  final Widget child;
  const PlanOnly({
    super.key,
    required this.min,
    required this.feature,
    this.description,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (auth.role == 'super_admin' || canAccess(auth.org, min)) return child;
    return UpgradeWall(org: auth.org, feature: feature, description: description, needs: min);
  }
}
