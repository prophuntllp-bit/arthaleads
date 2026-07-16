import 'package:flutter/material.dart';

/// Single reusable pill/badge, parameterized by color. Ports the web's
/// `.badge` — `rounded-full`, tinted fill, tinted border. Used directly for
/// one-off badges, and underpins [StatusChip]/[PriorityChip]/[BookingChip]
/// in `chips.dart`.
class Pill extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const Pill(this.label, this.color, {super.key, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 11, color: color), const SizedBox(width: 3)],
          Text(
            label,
            style: TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}
