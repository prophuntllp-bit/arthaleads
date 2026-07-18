import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/plan.dart';
import '../core/theme.dart';

/// Shown when a screen requires a higher plan than the org currently has.
/// Mirrors frontend/src/components/UpgradeWall.jsx.
class UpgradeWall extends StatelessWidget {
  final Map<String, dynamic>? org;
  final String feature;
  final String? description;

  const UpgradeWall({
    super.key,
    required this.org,
    required this.feature,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    final current = planLabel(org?['plan'] as String?);
    final next = upgradeTarget(org?['plan'] as String?);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.lock_rounded, size: 28, color: AppColors.primary),
            ),
            const SizedBox(height: 20),
            Text(
              next != null ? '$feature is a $next feature' : '$feature is locked',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
            ),
            const SizedBox(height: 8),
            Text(
              description ?? 'This feature is not available on your current $current plan.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            if (next != null) ...[
              const SizedBox(height: 4),
              Text.rich(
                TextSpan(
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  children: [
                    const TextSpan(text: 'Upgrade to '),
                    TextSpan(
                      text: next,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                    const TextSpan(text: ' to unlock it.'),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 28),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                  onPressed: () => launchUrl(
                    Uri.parse('https://arthaleads.com/#pricing'),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: const Text('View Plans'),
                ),
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: () => launchUrl(
                    Uri(scheme: 'mailto', path: 'contact@arthaleads.com'),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: const Text('Contact Us'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Currently on $current plan',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }
}
