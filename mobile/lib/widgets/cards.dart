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
  final bool compact;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
    this.selected = false,
    this.compact = false,
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
      // `compact` is for a narrow slot (three across on a 360dp phone): the icon
      // and the text cannot sit side by side without squeezing the label to a
      // few letters, so the icon goes above the figure and the label gets the
      // full width.
      child: Builder(builder: (context) {
        final narrow = compact;
        final iconBox = Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 18, color: color),
        );
        final text = Column(
          mainAxisSize: MainAxisSize.min,
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
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );
        if (narrow) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [iconBox, const SizedBox(height: 8), text],
          );
        }
        return Row(
          children: [
            iconBox,
            const SizedBox(width: 10),
            Expanded(child: text),
          ],
        );
      }),
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
