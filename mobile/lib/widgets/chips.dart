import 'package:flutter/material.dart';

import '../core/constants.dart';

class StatusChip extends StatelessWidget {
  final String? status;
  const StatusChip(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    if (status == null || status!.isEmpty) return const SizedBox.shrink();
    final c = statusColor(status);
    return _pill(status!, c);
  }
}

class PriorityChip extends StatelessWidget {
  final String? priority;
  const PriorityChip(this.priority, {super.key});

  @override
  Widget build(BuildContext context) {
    if (priority == null || priority!.isEmpty) return const SizedBox.shrink();
    return _pill(priority!, priorityColor(priority));
  }
}

class BookingChip extends StatelessWidget {
  final String? booking;
  const BookingChip(this.booking, {super.key});

  @override
  Widget build(BuildContext context) {
    if (booking == null || booking!.isEmpty) return const SizedBox.shrink();
    final opt = bookingOptions.where((o) => o.value == booking).firstOrNull;
    return _pill(booking!, opt?.color ?? const Color(0xFF6B7280));
  }
}

Widget _pill(String label, Color color) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: color.withValues(alpha: 0.35)),
    ),
    child: Text(
      label,
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
    ),
  );
}
