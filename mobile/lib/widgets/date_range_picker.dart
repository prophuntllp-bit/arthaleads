import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'buttons.dart';

/// Ports `frontend/src/components/DateRangePicker.jsx`'s preset list — same
/// values/order so query params match the backend's `getDateRangeFilter`
/// switch in `leadService.js` exactly.
const dateRangePresets = [
  {'value': 'today', 'label': 'Today'},
  {'value': 'yesterday', 'label': 'Yesterday'},
  {'value': 'todayYesterday', 'label': 'Today & Yesterday'},
  {'value': 'last7days', 'label': 'Last 7 days'},
  {'value': 'last14days', 'label': 'Last 14 days'},
  {'value': 'last28days', 'label': 'Last 28 days'},
  {'value': 'last30days', 'label': 'Last 30 days'},
  {'value': 'thisweek', 'label': 'This week'},
  {'value': 'lastweek', 'label': 'Last week'},
  {'value': 'thismonth', 'label': 'This month'},
  {'value': 'lastmonth', 'label': 'Last month'},
  {'value': 'thisyear', 'label': 'This year'},
  {'value': '', 'label': 'Maximum'},
];

const _months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const _days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

bool _isCustom(dynamic v) => v is Map && v['preset'] == 'custom';

String _fmtShort(DateTime d) => '${d.day} ${_months[d.month - 1].substring(0, 3)} ${d.year}';

String dateRangeLabel(dynamic value) {
  if (_isCustom(value)) return 'Custom Range';
  final preset = dateRangePresets.firstWhere(
    (p) => p['value'] == value,
    orElse: () => const {'value': 'last30days', 'label': 'Last 30 days'},
  );
  return preset['label']!;
}

/// Builds the `/leads/analytics`-style query params for a picker value:
/// `{'from': ..., 'to': ...}` for a custom range, `{'dateRange': value}` for
/// a preset, or `null` for "Maximum" (no filter).
Map<String, String>? dateRangeParams(dynamic value) {
  if (_isCustom(value)) {
    return {'from': value['from'] as String, 'to': value['to'] as String};
  }
  final preset = value as String? ?? '';
  return preset.isEmpty ? null : {'dateRange': preset};
}

/// Compact trigger + bottom-sheet picker — ports the web's `DateRangePicker`
/// preset list plus a single-month custom-range calendar (mobile uses the
/// web's own small-screen layout: preset list first, calendar only once
/// "Custom range" is tapped, rather than the desktop dual-month view).
class DateRangePicker extends StatelessWidget {
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  const DateRangePicker({super.key, required this.value, required this.onChanged});

  Future<void> _open(BuildContext context) async {
    final result = await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DateRangeSheet(initialValue: value),
    );
    if (result != null) onChanged(result);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _open(context),
      child: Container(
        width: 46,
        height: 40,
        decoration: BoxDecoration(
          color: AppTheme.of(context).surfaceLow,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.of(context).borderStrong),
        ),
        child: const Icon(Icons.calendar_month_rounded, size: 19, color: AppColors.primary),
      ),
    );
  }
}

class _DateRangeSheet extends StatefulWidget {
  final dynamic initialValue;
  const _DateRangeSheet({required this.initialValue});

  @override
  State<_DateRangeSheet> createState() => _DateRangeSheetState();
}

class _DateRangeSheetState extends State<_DateRangeSheet> {
  bool _showCalendar = false;
  DateTime? _rangeStart;
  DateTime? _rangeEnd;
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    if (_isCustom(widget.initialValue)) {
      _showCalendar = true;
      _rangeStart = DateTime.tryParse(widget.initialValue['from'] as String? ?? '');
      _rangeEnd = DateTime.tryParse(widget.initialValue['to'] as String? ?? '');
      if (_rangeEnd != null) _month = DateTime(_rangeEnd!.year, _rangeEnd!.month);
    }
  }

  void _shiftMonth(int dir) {
    setState(() => _month = DateTime(_month.year, _month.month + dir));
  }

  void _onDayTap(DateTime d) {
    setState(() {
      if (_rangeStart == null || (_rangeStart != null && _rangeEnd != null)) {
        _rangeStart = d;
        _rangeEnd = null;
      } else {
        if (d.isBefore(_rangeStart!)) {
          _rangeEnd = _rangeStart;
          _rangeStart = d;
        } else {
          _rangeEnd = d;
        }
      }
    });
  }

  void _apply() {
    if (_rangeStart == null) return;
    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    Navigator.pop(context, {
      'preset': 'custom',
      'from': fmt(_rangeStart!),
      'to': fmt(_rangeEnd ?? _rangeStart!),
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: t.border),
        ),
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
        child: _showCalendar ? _buildCalendar(t) : _buildPresetList(t),
      ),
    );
  }

  Widget _buildPresetList(AppTheme t) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              const Expanded(
                child: Text('Date Range', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: dateRangePresets.map((p) {
                final active = p['value'] == widget.initialValue;
                return ChoiceChip(
                  label: Text(p['label']!, style: const TextStyle(fontSize: 12.5)),
                  selected: active,
                  onSelected: (_) => Navigator.pop(context, p['value']),
                );
              }).toList(),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: SizedBox(
            width: double.infinity,
            child: SecondaryButton(
              icon: Icons.date_range,
              onPressed: () => setState(() {
                _showCalendar = true;
                _rangeStart = null;
                _rangeEnd = null;
              }),
              child: const Text('Custom date range'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCalendar(AppTheme t) {
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday % 7;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left, size: 20),
                onPressed: () => _shiftMonth(-1),
              ),
              const Spacer(),
              Text(
                '${_months[_month.month - 1]} ${_month.year}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.chevron_right, size: 20),
                onPressed: () => _shiftMonth(1),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: _days
                .map((d) => Expanded(
                      child: Center(
                        child: Text(d,
                            style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700, color: t.textSoft)),
                      ),
                    ))
                .toList(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7),
            itemCount: firstWeekday + daysInMonth,
            itemBuilder: (ctx, i) {
              if (i < firstWeekday) return const SizedBox.shrink();
              final day = DateTime(_month.year, _month.month, i - firstWeekday + 1);
              final isStart = _rangeStart != null && day == _rangeStart;
              final isEnd = _rangeEnd != null && day == _rangeEnd;
              final lo = _rangeStart;
              final hi = _rangeEnd ?? _rangeStart;
              final inRange = lo != null && hi != null && !day.isBefore(lo) && !day.isAfter(hi);
              final isToday = day == todayDate;
              return InkWell(
                onTap: () => _onDayTap(day),
                child: Container(
                  margin: EdgeInsets.symmetric(vertical: inRange && !isStart && !isEnd ? 0 : 2),
                  decoration: BoxDecoration(
                    color: (isStart || isEnd)
                        ? AppColors.primary
                        : inRange
                            ? AppColors.primary.withValues(alpha: 0.12)
                            : null,
                    borderRadius: BorderRadius.circular((isStart || isEnd) ? 999 : 4),
                  ),
                  child: Center(
                    child: Text(
                      '${day.day}',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isToday || isStart || isEnd ? FontWeight.w700 : FontWeight.w500,
                        color: (isStart || isEnd)
                            ? Colors.white
                            : isToday
                                ? AppColors.primary
                                : null,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _rangeStart == null
                      ? 'Tap a start date'
                      : '${_fmtShort(_rangeStart!)}${_rangeEnd != null ? ' → ${_fmtShort(_rangeEnd!)}' : ''}',
                  style: TextStyle(fontSize: 11, color: t.textSoft),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                onPressed: () => setState(() => _showCalendar = false),
                child: const Text('Back'),
              ),
              const SizedBox(width: 4),
              GradientButton(
                onPressed: _rangeStart == null ? null : _apply,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                child: const Text('Apply'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
