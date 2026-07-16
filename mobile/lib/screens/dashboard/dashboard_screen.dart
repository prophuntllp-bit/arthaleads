import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';

const _dateRangePresets = [
  {'value': 'today', 'label': 'Today'},
  {'value': 'last7days', 'label': 'Last 7 Days'},
  {'value': 'last30days', 'label': 'Last 30 Days'},
  {'value': 'thismonth', 'label': 'This Month'},
  {'value': 'lastmonth', 'label': 'Last Month'},
  {'value': 'thisyear', 'label': 'This Year'},
  {'value': '', 'label': 'All Time'},
];

final _sourcePalette = <String, Color>{
  'Facebook': const Color(0xFF1877F2),
  'Google': const Color(0xFFEA4335),
  'WhatsApp': const Color(0xFF25D366),
  'Website': const Color(0xFF8B5CF6),
  'Referral': const Color(0xFFEC4899),
  'Manual': const Color(0xFF6B7280),
};
Color _sourceColor(String s, int i) {
  const fallback = [
    Color(0xFF3B82F6),
    Color(0xFFF59E0B),
    Color(0xFF14B8A6),
    Color(0xFFF97316),
  ];
  return _sourcePalette[s] ?? fallback[i % fallback.length];
}

/// Dashboard — GET /leads/analytics + /leads/hot + /leads/followups-due.
/// Mobile-first condensation of the web dashboard's zoned layout.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiClient.instance;
  Map<String, dynamic>? _analytics;
  List<Map<String, dynamic>> _hot = [];
  List<Map<String, dynamic>> _due = [];
  Map<String, dynamic>? _attendance;
  bool _loading = true;
  bool _clockBusy = false;
  String _dateRange = 'last30days';
  int? _goalOverride;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Swallow individual widget failures — one failed panel must not blank the page.
  Future<dynamic> _tryGet(String path, [Map<String, dynamic>? params]) async {
    try {
      return await _api.dio.get(path, queryParameters: params);
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    // Parallel fetch — mirrors the web dashboard's parallel-fetch fix.
    final results = await Future.wait<dynamic>([
      _tryGet(
        '/leads/analytics',
        _dateRange.isEmpty ? null : {'dateRange': _dateRange},
      ),
      _tryGet('/leads/hot', {'limit': 5}),
      _tryGet('/leads/followups-due'),
      _tryGet('/attendance/status'),
    ]);
    if (!mounted) return;
    setState(() {
      _analytics = (results[0]?.data['data'] as Map?)?.cast<String, dynamic>();
      _hot = ((results[1]?.data['data'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      final dueRaw = results[2]?.data['data'];
      _due = dueRaw is List
          ? dueRaw.cast<Map<String, dynamic>>()
          : dueRaw is Map && dueRaw['leads'] is List
          ? (dueRaw['leads'] as List).cast<Map<String, dynamic>>()
          : [];
      _attendance = (results[3]?.data as Map?)?.cast<String, dynamic>();
      _goalOverride = null;
      _loading = false;
    });
  }

  bool get _clockedIn {
    final att = _attendance;
    if (att == null) return false;
    final data = att['data'];
    if (data is Map) {
      return data['clockedIn'] == true ||
          (data['clockIn'] != null && data['clockOut'] == null);
    }
    return att['clockedIn'] == true;
  }

  Future<void> _clock() async {
    setState(() => _clockBusy = true);
    try {
      await _api.dio.post(
        _clockedIn ? '/attendance/clockout' : '/attendance/clockin',
      );
      final res = await _api.dio.get('/attendance/status');
      if (mounted) {
        setState(() => _attendance = (res.data as Map).cast<String, dynamic>());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Attendance action failed'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _clockBusy = false);
    }
  }

  Future<void> _editGoal(int current) async {
    final ctrl = TextEditingController(text: current > 0 ? '$current' : '');
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Monthly closing goal'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. 20'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final n = int.tryParse(ctrl.text.trim());
              Navigator.pop(ctx, (n != null && n > 0) ? n : null);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result == null) return;
    try {
      await _api.dio.patch(
        '/org/me/goal',
        data: {'monthlyClosingGoal': result},
      );
      if (mounted) setState(() => _goalOverride = result);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to save goal')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  String get _dateRangeLabel => _dateRangePresets.firstWhere(
    (p) => p['value'] == _dateRange,
    orElse: () => _dateRangePresets[2],
  )['label']!;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final a = _analytics;
    final role = auth.user?['role'] as String?;
    final isAdmin =
        role == 'admin' || role == 'manager' || role == 'super_admin';

    if (_loading) {
      return const Center(child: AppSpinner(size: 32));
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FadeSlideIn(
            child: SoftSurface(
              radius: 28,
              color: AppTheme.of(context).surface,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text('OVERVIEW', style: AppText.kicker(context)),
                      ),
                      const SizedBox(width: 8),
                      PopupMenuButton<String>(
                        initialValue: _dateRange,
                        onSelected: (v) {
                          setState(() => _dateRange = v);
                          _load();
                        },
                        itemBuilder: (ctx) => _dateRangePresets
                            .map(
                              (p) => PopupMenuItem(
                                value: p['value'],
                                child: Text(p['label']!),
                              ),
                            )
                            .toList(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.09),
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.calendar_today_rounded,
                                size: 12,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                _dateRangeLabel,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Icon(
                                Icons.keyboard_arrow_down_rounded,
                                size: 14,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${_greeting()}, ${(auth.user?['name'] as String? ?? '').split(' ').first}',
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.6,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 14),
                  Divider(height: 1, color: AppTheme.of(context).border),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color:
                              (_clockedIn
                                      ? AppColors.success
                                      : AppColors.primary)
                                  .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          Icons.fingerprint_rounded,
                          size: 19,
                          color: _clockedIn
                              ? AppColors.success
                              : AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _clockedIn ? 'Clocked in' : 'Not clocked in',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'Attendance',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppTheme.of(context).textSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(
                        height: 36,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _clockedIn
                                ? AppColors.danger
                                : AppColors.success,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: _clockBusy ? null : _clock,
                          child: Text(
                            _clockBusy
                                ? '…'
                                : (_clockedIn ? 'Clock Out' : 'Clock In'),
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),

          // ── Stat cards ──
          if (a != null) ...[
            FadeSlideIn(
              delay: const Duration(milliseconds: 40),
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.85,
                children: [
                  _MetricCard(
                    label: 'Total Leads',
                    value: '${a['allTimeTotal'] ?? 0}',
                    sub: 'All time',
                    color: AppColors.primary,
                  ),
                  _MetricCard(
                    label: 'Pipeline',
                    value: fmtBudget(a['pipelineValue'] as num?),
                    sub: '${a['pipelineLeads'] ?? 0} active leads',
                    color: AppTheme.of(context).text,
                  ),
                  _MetricCard(
                    label: 'New',
                    value: '${a['allTimeNew'] ?? 0}',
                    sub: 'Uncontacted',
                    color: const Color(0xFF6366F1),
                  ),
                  _MetricCard(
                    label: 'Closed Won',
                    value: '${a['allTimeClosedWon'] ?? 0}',
                    sub: '${a['conversionRate'] ?? 0}% conversion',
                    color: AppColors.success,
                  ),
                  _MetricCard(
                    label: 'Follow-ups',
                    value: '${a['todayFollowUps'] ?? 0}',
                    sub: 'Due today',
                    color: AppColors.warning,
                  ),
                  _MetricCard(
                    label: 'This Period',
                    value: '${a['totalLeads'] ?? 0}',
                    sub: _dateRangeLabel,
                    color: const Color(0xFF0D9488),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Status breakdown ──
            const _SectionHeader(label: 'Performance'),
            const SizedBox(height: 12),
            SoftSurface(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children:
                    statusOptions.map((s) {
                      final count =
                          ((a['allTimeByStatus'] as Map?) ?? {})[s] as int? ??
                          0;
                      final total = a['allTimeTotal'] as int? ?? 1;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 100,
                              child: Text(
                                s,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: total > 0 ? count / total : 0,
                                  minHeight: 8,
                                  backgroundColor: statusColor(
                                    s,
                                  ).withValues(alpha: 0.12),
                                  color: statusColor(s),
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 40,
                              child: Text(
                                '$count',
                                textAlign: TextAlign.end,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList()..insert(
                      0,
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('PIPELINE', style: AppText.kicker(context)),
                            const SizedBox(height: 2),
                            const Text(
                              'Leads by Status',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Source breakdown ──
            if (((a['bySource'] as Map?) ?? {}).values.any(
              (v) => (v as num) > 0,
            )) ...[
              Text(
                'Acquisition Mix · Leads by Source',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              SoftSurface(
                padding: const EdgeInsets.all(12),
                child: Builder(
                  builder: (ctx) {
                    final src =
                        ((a['bySource'] as Map?) ?? {}).entries
                            .where((e) => (e.value as num) > 0)
                            .toList()
                          ..sort(
                            (x, y) =>
                                (y.value as num).compareTo(x.value as num),
                          );
                    final total = src.fold<num>(
                      0,
                      (s, e) => s + (e.value as num),
                    );
                    return Column(
                      children: [
                        for (var i = 0; i < src.length; i++)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 100,
                                  child: Text(
                                    '${src[i].key}',
                                    style: Theme.of(ctx).textTheme.bodySmall,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Expanded(
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: total > 0
                                          ? (src[i].value as num) / total
                                          : 0,
                                      minHeight: 8,
                                      backgroundColor: _sourceColor(
                                        src[i].key,
                                        i,
                                      ).withValues(alpha: 0.12),
                                      color: _sourceColor(src[i].key, i),
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: 40,
                                  child: Text(
                                    '${src[i].value}',
                                    textAlign: TextAlign.end,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
            ],
          ],

          // ── Hot leads ──
          if (_hot.isNotEmpty) ...[
            Text(
              '🔥 Hot Today',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            for (final (i, l) in _hot.indexed)
              FadeSlideIn(
                delay: Duration(milliseconds: 30 * i),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SoftSurface(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(
                        str(l['name']) ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        // _nextAction is a structured {action, icon, color} object
                        str((l['_nextAction'] as Map?)?['action']) ??
                            str(l['phone']) ??
                            '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: StatusChip(str(l['status'])),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],

          // ── Follow-ups due ──
          if (_due.isNotEmpty) ...[
            Text(
              '⏰ Follow-ups Due',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            for (final (i, l) in _due.indexed.take(5))
              FadeSlideIn(
                delay: Duration(milliseconds: 30 * i),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SoftSurface(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(
                        l['name'] as String? ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(l['phone'] as String? ?? ''),
                      trailing: BookingChip(l['booking'] as String?),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],

          // ── Admin Intelligence ──
          if (isAdmin && a != null) ...[
            const Divider(),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.admin_panel_settings,
                  size: 15,
                  color: Color(0xFF6366F1),
                ),
                const SizedBox(width: 6),
                Text(
                  'Admin Intelligence',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: const Color(0xFF6366F1),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Monthly goal
            Builder(
              builder: (ctx) {
                final goal =
                    _goalOverride ??
                    (a['monthlyClosingGoal'] as num?)?.toInt() ??
                    0;
                final current = (a['thisMonthClosedWon'] as num?)?.toInt() ?? 0;
                final pct = goal > 0
                    ? (current / goal * 100).clamp(0, 100).round()
                    : 0;
                return SoftSurface(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.track_changes,
                        size: 18,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: goal > 0
                            ? Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        'Monthly Goal',
                                        style: Theme.of(
                                          ctx,
                                        ).textTheme.bodySmall,
                                      ),
                                      const Spacer(),
                                      Text(
                                        '$current / $goal',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: pct / 100,
                                      minHeight: 7,
                                      backgroundColor: AppColors.primary
                                          .withValues(alpha: 0.12),
                                      color: pct >= 100
                                          ? AppColors.success
                                          : AppColors.primary,
                                    ),
                                  ),
                                ],
                              )
                            : Text(
                                'No monthly goal set',
                                style: Theme.of(ctx).textTheme.bodySmall,
                              ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit, size: 16),
                        onPressed: () => _editGoal(goal),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 12),

            // Top agents leaderboard
            if ((a['byAgent'] as List?)?.isNotEmpty ?? false) ...[
              Text('Top Agents', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 6),
              SoftSurface(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    for (final (i, ag)
                        in ((a['byAgent'] as List)
                                .cast<Map<String, dynamic>>()
                                .take(5))
                            .indexed)
                      ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          radius: 14,
                          backgroundColor: AppColors.primary.withValues(
                            alpha: 0.12,
                          ),
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        title: Text(
                          ag['name'] as String? ?? '—',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        trailing: Text(
                          '${ag['count'] ?? 0} leads',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Recent activity
            if ((a['recentActivity'] as List?)?.isNotEmpty ?? false) ...[
              Text(
                'Team Activity',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 6),
              SoftSurface(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: (a['recentActivity'] as List)
                      .cast<Map<String, dynamic>>()
                      .take(8)
                      .map((item) {
                        return ListTile(
                          dense: true,
                          leading: const Icon(
                            Icons.circle,
                            size: 8,
                            color: AppColors.primary,
                          ),
                          title: Text(
                            '${item['performedByName'] ?? 'System'} · ${item['description'] ?? ''}',
                            style: const TextStyle(fontSize: 12),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            item['leadName'] as String? ?? '',
                            style: const TextStyle(fontSize: 11),
                          ),
                        );
                      })
                      .toList(),
                ),
              ),
            ],
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final Color color;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return SoftSurface(
      radius: 18,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppTheme.of(context).textSoft,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 21,
                height: 1,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sub,
            style: TextStyle(
              fontSize: 9.5,
              color: AppTheme.of(context).textSoft,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    final border = AppTheme.of(context).border;
    return Row(
      children: [
        Expanded(child: Divider(color: border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
              color: AppTheme.of(context).textSoft,
            ),
          ),
        ),
        Expanded(child: Divider(color: border)),
      ],
    );
  }
}
