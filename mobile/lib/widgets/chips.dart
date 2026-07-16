import 'package:flutter/material.dart';

import '../core/constants.dart';
import 'badges.dart';

class StatusChip extends StatelessWidget {
  final String? status;
  const StatusChip(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    if (status == null || status!.isEmpty) return const SizedBox.shrink();
    return Pill(status!, statusColor(status));
  }
}

class PriorityChip extends StatelessWidget {
  final String? priority;
  const PriorityChip(this.priority, {super.key});

  @override
  Widget build(BuildContext context) {
    if (priority == null || priority!.isEmpty) return const SizedBox.shrink();
    return Pill(priority!, priorityColor(priority));
  }
}

class BookingChip extends StatelessWidget {
  final String? booking;
  const BookingChip(this.booking, {super.key});

  @override
  Widget build(BuildContext context) {
    if (booking == null || booking!.isEmpty) return const SizedBox.shrink();
    final opt = bookingOptions.where((o) => o.value == booking).firstOrNull;
    return Pill(booking!, opt?.color ?? const Color(0xFF6B7280));
  }
}
