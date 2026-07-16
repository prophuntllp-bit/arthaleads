import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'glass.dart';

/// Icon-chip + big value + label stat tile, replacing every screen's
/// private `_stat`/`_statTile` builder. Ports the web's `StatCard`.
class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final bool selected;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final card = SoftSurface(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: selected ? Border.all(color: color, width: 1.5) : null,
      boxShadow: selected
          ? [...t.shadow, BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 16)]
          : null,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value.isEmpty ? '—' : value,
                    style: AppText.statValue(context).copyWith(fontSize: 18),
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: t.textSoft),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
