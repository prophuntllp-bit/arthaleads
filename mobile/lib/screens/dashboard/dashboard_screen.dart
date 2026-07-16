import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import '../leads/lead_form.dart';

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
  bool _loading = true;
  String _dateRange = 'last30days';
  int? _goalOverride;
  List<String> _insights = [];
  bool _insightsOpen = false;
  bool _insightsLoading = false;

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
      _goalOverride = null;
      _loading = false;
    });
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

  Future<void> _openAddLead() async {
    List<Map<String, dynamic>> agents = [];
    if (context.read<AuthState>().isAdmin) {
      try {
        final res = await _api.dio.get('/auth/agents');
        agents = (res.data['agents'] as List? ?? [])
            .cast<Map<String, dynamic>>();
      } catch (_) {}
    }
    if (!mounted) return;
    final saved = await Navigator.of(context).push<bool>(
      FadeSlidePageRoute(builder: (_) => LeadFormScreen(agents: agents)),
    );
    if (saved == true) _load();
  }

  Future<void> _generateInsights() async {
    final a = _analytics;
    if (a == null || _insightsLoading) return;
    setState(() {
      _insightsOpen = true;
      _insightsLoading = true;
    });
    try {
      final sources = ((a['bySource'] as Map?) ?? {}).entries.toList()
        ..sort((x, y) => (y.value as num).compareTo(x.value as num));
      final topSource = sources.isEmpty
          ? 'N/A'
          : '${sources.first.key} (${sources.first.value})';
      final summary = [
        'Total leads: ${a['allTimeTotal'] ?? 0}',
        'New this period: ${a['totalLeads'] ?? 0}',
        'Closed won this month: ${a['thisMonthClosedWon'] ?? 0}',
        'Conversion: ${a['conversionRate'] ?? 0}%',
        'Follow-ups today: ${a['todayFollowUps'] ?? 0}',
        'Top source: $topSource',
        'Pipeline value: ${a['pipelineValue'] ?? 0}',
      ].join('. ');
      final res = await _api.dio.post(
        '/help/ask',
        data: {
          'question':
              'Using only these CRM numbers: $summary. Give exactly 2 short insights: one positive and one action. Each on its own line, maximum 15 words.',
          'page': '',
        },
      );
      final answer = res.data['answer'] as String? ?? '';
      final lines = answer
          .split('\n')
          .map((line) => line.replaceFirst(RegExp(r'^[•\-*]\s*'), '').trim())
          .where((line) => line.isNotEmpty)
          .take(2)
          .toList();
      if (mounted) setState(() => _insights = lines);
    } catch (_) {
      if (mounted) {
        setState(() => _insights = ['Insights are unavailable right now.']);
      }
    } finally {
      if (mounted) setState(() => _insightsLoading = false);
    }
  }

  Widget _dashboardHeader(
    BuildContext context,
    AuthState auth,
    Map<String, dynamic>? analytics,
  ) {
    final bySource = (analytics?['bySource'] as Map?) ?? {};
    final sources = <({String label, int count, Color color, IconData icon})>[
      (
        label: 'Facebook',
        count: (bySource['Facebook'] as num?)?.toInt() ?? 0,
        color: const Color(0xFF1877F2),
        icon: Icons.facebook_rounded,
      ),
      (
        label: 'Google',
        count: (bySource['Google'] as num?)?.toInt() ?? 0,
        color: const Color(0xFFEA4335),
        icon: Icons.g_mobiledata_rounded,
      ),
      (
        label: 'WhatsApp',
        count: (bySource['WhatsApp'] as num?)?.toInt() ?? 0,
        color: AppColors.whatsapp,
        icon: Icons.chat_rounded,
      ),
      (
        label: 'Website',
        count:
            ((bySource['Website'] ?? bySource['Website Form']) as num?)
                ?.toInt() ??
            0,
        color: AppColors.purple,
        icon: Icons.language_rounded,
      ),
      (
        label: 'Other',
        count:
            ((bySource['Other'] ?? bySource['Custom']) as num?)?.toInt() ?? 0,
        color: AppColors.warning,
        icon: Icons.bolt_rounded,
      ),
    ].where((source) => source.count > 0).toList();

    return SoftSurface(
      radius: 28,
      color: AppTheme.of(context).surface,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (sources.isNotEmpty) ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final source in sources)
                    Padding(
                      padding: const EdgeInsets.only(right: 7),
                      child: _SourcePill(
                        count: source.count,
                        color: source.color,
                        icon: source.icon,
                        tooltip: source.label,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          Text('OVERVIEW', style: AppText.kicker(context)),
          const SizedBox(height: 6),
          Text(
            '${_greeting()}, ${(auth.user?['name'] as String? ?? '').split(' ').first}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.7,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              PopupMenuButton<String>(
                initialValue: _dateRange,
                onSelected: (value) {
                  setState(() => _dateRange = value);
                  _load();
                },
                itemBuilder: (ctx) => _dateRangePresets
                    .map(
                      (preset) => PopupMenuItem(
                        value: preset['value'],
                        child: Text(preset['label']!),
                      ),
                    )
                    .toList(),
                child: Container(
                  width: 46,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppTheme.of(context).surfaceLow,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppTheme.of(context).borderStrong,
                    ),
                  ),
                  child: const Icon(
                    Icons.calendar_month_rounded,
                    size: 19,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 9),
              GradientButton(
                onPressed: _openAddLead,
                icon: Icons.add_rounded,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: const Text('New Lead'),
              ),
              const Spacer(),
              Text(
                _dateRangeLabel,
                style: TextStyle(
                  fontSize: 10,
                  color: AppTheme.of(context).textSoft,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: _insights.isEmpty
                ? _generateInsights
                : () => setState(() => _insightsOpen = !_insightsOpen),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.045),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.auto_awesome_rounded,
                        size: 15,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 7),
                      const Text(
                        'ARTHA AI',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.4,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'LIVE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          _insightsLoading
                              ? 'Analysing pipeline…'
                              : _insights.isEmpty
                              ? 'Tap for live insights'
                              : '${_insights.length} insights ready',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.of(context).textSoft,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (_insightsLoading)
                        const AppSpinner(size: 14)
                      else
                        Icon(
                          _insightsOpen
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: AppTheme.of(context).textSoft,
                        ),
                    ],
                  ),
                  if (_insightsOpen && _insights.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Divider(height: 1, color: AppTheme.of(context).border),
                    const SizedBox(height: 8),
                    for (final insight in _insights)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 5),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 3),
                              child: Icon(
                                Icons.arrow_upward_rounded,
                                size: 10,
                                color: AppColors.primary,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                insight,
                                style: const TextStyle(
                                  fontSize: 11,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionRequiredSection(BuildContext context) {
    final now = DateTime.now();
    final overdue = _due.where((lead) {
      final raw = lead['followUpDate'] as String?;
      final date = raw == null ? null : DateTime.tryParse(raw);
      return date != null &&
          date.isBefore(DateTime(now.year, now.month, now.day));
    }).length;
    final hot = _hot.isEmpty ? null : _hot.first;

    return Column(
      children: [
        const _SectionHeader(
          label: 'Action Required',
          color: AppColors.primary,
        ),
        const SizedBox(height: 12),
        SoftSurface(
          radius: 20,
          color: AppColors.danger.withValues(alpha: 0.045),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.24)),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  size: 20,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$overdue overdue · ${_due.length} due today',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Across your team',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.of(context).textSoft,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.keyboard_arrow_up_rounded, size: 18),
            ],
          ),
        ),
        if (hot != null) ...[
          const SizedBox(height: 12),
          SoftSurface(
            radius: 20,
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.65),
              width: 1.2,
            ),
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(13),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: const Icon(
                          Icons.local_fire_department_rounded,
                          size: 21,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Hot Today',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              '${_hot.length} ranked leads',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppTheme.of(context).textSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.auto_awesome_rounded,
                        size: 17,
                        color: AppColors.primary,
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: AppTheme.of(context).border),
                Padding(
                  padding: const EdgeInsets.all(13),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.09),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          '${hot['_score'] ?? hot['score'] ?? 'HOT'}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: AppColors.danger,
                          ),
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              str(hot['name']) ?? '—',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              [
                                    str(hot['status']),
                                    str(hot['priority']),
                                    str(hot['location']),
                                  ]
                                  .whereType<String>()
                                  .where((v) => v.isNotEmpty)
                                  .join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: AppTheme.of(context).textSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Call',
                        onPressed: () {
                          final phone = str(hot['phone']);
                          if (phone != null && phone.isNotEmpty) {
                            launchUrl(Uri.parse('tel:$phone'));
                          }
                        },
                        icon: const Icon(
                          Icons.call_rounded,
                          color: AppColors.primary,
                        ),
                      ),
                      IconButton(
                        tooltip: 'WhatsApp',
                        onPressed: () {
                          final digits = (str(hot['phone']) ?? '').replaceAll(
                            RegExp(r'\D'),
                            '',
                          );
                          if (digits.isNotEmpty) {
                            launchUrl(
                              Uri.parse(
                                'https://wa.me/${digits.length == 10 ? '91$digits' : digits}',
                              ),
                              mode: LaunchMode.externalApplication,
                            );
                          }
                        },
                        icon: const Icon(
                          Icons.chat_rounded,
                          color: AppColors.whatsapp,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

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
          FadeSlideIn(child: _dashboardHeader(context, auth, a)),
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
                    label: 'Avg Response',
                    value: _fmtResponse(a['avgResponseMs'] as num?),
                    sub: 'First contact',
                    color: AppColors.success,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _actionRequiredSection(context),
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

  String _fmtResponse(num? milliseconds) {
    if (milliseconds == null || milliseconds <= 0) return 'No data';
    final minutes = milliseconds / 60000;
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return '${minutes.round()} min';
    final hours = minutes / 60;
    return hours < 24
        ? '${hours.toStringAsFixed(1)} hr'
        : '${(hours / 24).toStringAsFixed(1)} d';
  }
}

class _SourcePill extends StatelessWidget {
  final int count;
  final Color color;
  final IconData icon;
  final String tooltip;

  const _SourcePill({
    required this.count,
    required this.color,
    required this.icon,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.24)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 5),
            Text(
              '$count',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
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
  final Color? color;
  const _SectionHeader({required this.label, this.color});

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
              color: color ?? AppTheme.of(context).textSoft,
            ),
          ),
        ),
        Expanded(child: Divider(color: border)),
      ],
    );
  }
}
