import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// "Today", "Yesterday" or "Fri, 9 Oct", like the web Inbox's day separators.
String chatDayLabel(DateTime d) {
  final day = DateTime(d.year, d.month, d.day);
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return DateFormat(day.year == today.year ? 'EEE, d MMM' : 'EEE, d MMM yyyy').format(d);
}

/// True when message [i] starts a new day compared with the one before it.
bool startsNewDay(List<Map<String, dynamic>> messages, int i, {String key = 'timestamp'}) {
  final cur = DateTime.tryParse(messages[i][key]?.toString() ?? '')?.toLocal();
  if (cur == null) return false;
  if (i == 0) return true;
  final prev = DateTime.tryParse(messages[i - 1][key]?.toString() ?? '')?.toLocal();
  return prev == null || prev.year != cur.year || prev.month != cur.month || prev.day != cur.day;
}

/// The small centred pill shown between messages from different days.
class DayDivider extends StatelessWidget {
  final DateTime date;
  final Color? background;
  final Color? foreground;
  const DayDivider({super.key, required this.date, this.background, this.foreground});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: background ?? (dark ? const Color(0xFF1F2C34) : const Color(0xFFE1F3FB)),
            borderRadius: BorderRadius.circular(8),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 1, offset: const Offset(0, 1))],
          ),
          child: Text(
            chatDayLabel(date),
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: foreground ?? (dark ? const Color(0xFF8696A0) : const Color(0xFF54656F)),
            ),
          ),
        ),
      ),
    );
  }
}
