import 'dart:async';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/deep_link.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/date_range_picker.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import '../../widgets/onboarding_checklist.dart';
import '../attendance/attendance_capture_sheet.dart';
import '../leads/lead_form.dart';
import '../projects/project_detail_screen.dart';

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
  const DashboardScreen({super.key, this.onNavigate});

  final ValueChanged<String>? onNavigate;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with WidgetsBindingObserver {
  final _api = ApiClient.instance;
  Map<String, dynamic>? _analytics;
  List<Map<String, dynamic>> _hot = [];
  List<Map<String, dynamic>> _due = [];
  List<Map<String, dynamic>> _stale = [];
  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _team = [];
  List<Map<String, dynamic>> _automations = [];
  Map<String, dynamic>? _attendance;
  bool _requireSelfie = true;
  bool _loading = true;
  bool _refreshing = false;
  bool _analyticsError = false;
  bool _clocking = false;
  dynamic _dateRange = 'last30days';
  int? _goalOverride;
  List<String> _insights = [];
  bool _insightsOpen = false;
  bool _insightsLoading = false;
  bool _dueExpanded = false;
  Timer? _refreshTimer;
  DateTime? _lastLoadedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _refreshTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) _load(background: true);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        (_lastLoadedAt == null ||
            DateTime.now().difference(_lastLoadedAt!).inSeconds > 20)) {
      _load(background: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshTimer?.cancel();
    super.dispose();
  }

  /// Swallow individual widget failures — one failed panel must not blank the page.
  Future<dynamic> _tryGet(String path, [Map<String, dynamic>? params]) async {
    try {
      return await _api.dio.get(path, queryParameters: params);
    } catch (_) {
      return null;
    }
  }

  Future<void> _load({bool background = false}) async {
    if (_refreshing) return;
    setState(() {
      _refreshing = true;
      if (!background && _analytics == null) _loading = true;
    });
    // Parallel fetch — mirrors the web dashboard's parallel-fetch fix.
    final results = await Future.wait<dynamic>([
      _tryGet('/leads/analytics', dateRangeParams(_dateRange)),
      _tryGet('/leads/hot', {'limit': 5}),
      _tryGet('/leads/followups-due'),
      _tryGet('/leads/stale'),
      _tryGet('/projects/stats'),
      _tryGet('/attendance/team-today'),
      _tryGet('/automations'),
      _tryGet('/attendance/status'),
    ]);
    if (!mounted) return;
    final analytics = (results[0]?.data['data'] as Map?)
        ?.cast<String, dynamic>();
    setState(() {
      if (analytics != null) _analytics = analytics;
      _analyticsError = analytics == null;
      _hot = ((results[1]?.data['data'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      final dueRaw = results[2]?.data['data'];
      _due = dueRaw is List
          ? dueRaw.cast<Map<String, dynamic>>()
          : dueRaw is Map && dueRaw['leads'] is List
          ? (dueRaw['leads'] as List).cast<Map<String, dynamic>>()
          : [];
      _stale = ((results[3]?.data['data'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      _projects = ((results[4]?.data['data'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      _team = ((results[5]?.data['data'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      _automations = ((results[6]?.data['automations'] as List?) ?? [])
          .cast<Map<String, dynamic>>();
      _attendance = (results[7]?.data['data'] as Map?)?.cast<String, dynamic>();
      _requireSelfie =
          results[7]?.data['requireSelfie'] as bool? ?? _requireSelfie;
      _goalOverride = null;
      _loading = false;
      _refreshing = false;
      _lastLoadedAt = DateTime.now();
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

  String get _dateRangeLabel => dateRangeLabel(_dateRange);

  /// Deep-links into the specific record on another tab (Shell caches tab
  /// screens, so DeepLink is how an already-built screen finds out it
  /// should open something after the tab switch — see core/deep_link.dart).
  void _openLead(String? id) {
    if (id != null && id.isNotEmpty) DeepLink.openLeadId.value = id;
    widget.onNavigate?.call('Leads');
  }

  void _focusAgent(String? id) {
    if (id != null && id.isNotEmpty) DeepLink.focusAgentId.value = id;
    widget.onNavigate?.call('Performance');
  }

  Future<void> _openProject(String id) async {
    try {
      final res = await _api.dio.get('/projects/$id');
      final project = (res.data['data'] as Map?)?.cast<String, dynamic>();
      if (project != null && mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: project)),
        );
        return;
      }
    } catch (_) {}
    widget.onNavigate?.call('Projects');
  }

  IconData _platformIcon(String? platform) {
    switch (platform) {
      case 'Facebook':
        return FontAwesomeIcons.facebookF.data;
      case 'Google':
        return FontAwesomeIcons.google.data;
      case 'WhatsApp':
        return FontAwesomeIcons.whatsapp.data;
      case 'Website':
        return FontAwesomeIcons.globe.data;
      default:
        return FontAwesomeIcons.bolt.data;
    }
  }

  /// Mirrors web's calcDelta(current, previous) used on the Total Leads card.
  int? _calcDelta(int? current, int? previous) {
    if (previous == null || previous == 0) return null;
    return (((current ?? 0) - previous) / previous * 100).round();
  }

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

  Future<void> _clockAttendance() async {
    if (_clocking) return;
    final clockedIn =
        _attendance?['clockIn'] != null && _attendance?['clockOut'] == null;
    AttendanceCaptureResult proof = const AttendanceCaptureResult();
    if (_requireSelfie) {
      final captured = await showModalBottomSheet<AttendanceCaptureResult>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: AppTheme.of(context).surfaceSolid,
        barrierColor: Colors.black.withValues(alpha: .78),
        builder: (_) => FractionallySizedBox(
          heightFactor: .94,
          child: AttendanceCaptureSheet(
            clockIn: !clockedIn,
            requiredProof: true,
          ),
        ),
      );
      if (captured == null) return;
      proof = captured;
    }
    setState(() => _clocking = true);
    try {
      final response = await _api.dio.post(
        '/attendance/${clockedIn ? 'clockout' : 'clockin'}',
        data: {
          if (proof.selfie != null) 'selfie': proof.selfie,
          if (proof.latitude != null) 'lat': proof.latitude,
          if (proof.longitude != null) 'lng': proof.longitude,
          if (proof.accuracy != null) 'accuracy': proof.accuracy,
        },
      );
      if (mounted) {
        setState(() {
          _attendance = (response.data['data'] as Map?)
              ?.cast<String, dynamic>();
        });
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(error, 'Attendance action failed'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _clocking = false);
    }
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
        icon: FontAwesomeIcons.facebookF.data,
      ),
      (
        label: 'Google',
        count: (bySource['Google'] as num?)?.toInt() ?? 0,
        color: const Color(0xFFEA4335),
        icon: FontAwesomeIcons.google.data,
      ),
      (
        label: 'WhatsApp',
        count: (bySource['WhatsApp'] as num?)?.toInt() ?? 0,
        color: AppColors.whatsapp,
        icon: FontAwesomeIcons.whatsapp.data,
      ),
      (
        label: 'Website',
        count:
            ((bySource['Website'] ?? bySource['Website Form']) as num?)
                ?.toInt() ??
            0,
        color: AppColors.purple,
        icon: FontAwesomeIcons.globe.data,
      ),
      (
        label: 'Other',
        count:
            ((bySource['Other'] ?? bySource['Custom']) as num?)?.toInt() ?? 0,
        color: AppColors.warning,
        icon: FontAwesomeIcons.bolt.data,
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
              DateRangePicker(
                value: _dateRange,
                onChanged: (value) {
                  setState(() => _dateRange = value);
                  _load();
                },
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
          if (auth.isAdmin) ...[
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
                      if (_insightsOpen &&
                          _insights.isNotEmpty &&
                          !_insightsLoading)
                        InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: _generateInsights,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 5,
                              vertical: 3,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.bolt_rounded,
                                  size: 11,
                                  color: AppTheme.of(context).textSoft,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  'Refresh',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppTheme.of(context).textSoft,
                                  ),
                                ),
                              ],
                            ),
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
        ],
      ),
    );
  }

  Widget _actionRequiredSection(BuildContext context) {
    final now = DateTime.now();
    final overdueLeads = _due.where((lead) {
      final raw = lead['followUpDate'] as String?;
      final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
      return date != null &&
          date.isBefore(DateTime(now.year, now.month, now.day));
    }).toList();
    final todayLeads = _due.where((lead) {
      final raw = lead['followUpDate'] as String?;
      final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
      return date != null &&
          date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    }).toList();
    final overdue = overdueLeads.length;
    final dueToday = todayLeads.length;

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
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              InkWell(
                onTap: () => setState(() => _dueExpanded = !_dueExpanded),
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
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
                              '$overdue overdue · $dueToday due today',
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
                      Icon(
                        _dueExpanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ),
              if (_dueExpanded) ...[
                Divider(height: 1, color: AppTheme.of(context).border),
                if (overdueLeads.isEmpty && todayLeads.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No follow-ups require action.'),
                  ),
                for (final lead in [...overdueLeads, ...todayLeads].take(8))
                  ListTile(
                    dense: true,
                    onTap: () => _openLead(lead['_id'] as String?),
                    leading: _smallBadge(
                      overdueLeads.contains(lead) ? 'OVERDUE' : 'TODAY',
                      overdueLeads.contains(lead)
                          ? AppColors.danger
                          : AppColors.warning,
                    ),
                    title: Text(
                      lead['name']?.toString() ?? 'Lead',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${lead['assignedToName'] ?? 'Unassigned'} · ${_followUpTime(lead['followUpDate'])}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: IconButton(
                      tooltip: 'Call',
                      onPressed: () {
                        final phone = lead['phone']?.toString();
                        if (phone != null && phone.isNotEmpty) {
                          launchUrl(Uri.parse('tel:$phone'));
                        }
                      },
                      icon: Icon(FontAwesomeIcons.phone.data, size: 17),
                    ),
                  ),
                if (overdueLeads.length + todayLeads.length > 8)
                  TextButton(
                    onPressed: () => widget.onNavigate?.call('Follow-ups'),
                    child: Text(
                      'View all ${overdueLeads.length + todayLeads.length} follow-ups',
                    ),
                  ),
              ],
            ],
          ),
        ),
        if (_hot.isNotEmpty) ...[
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
                for (final hot in _hot) ...[
                  Divider(height: 1, color: AppTheme.of(context).border),
                  InkWell(
                    onTap: () => _openLead(str(hot['_id'])),
                    child: Padding(
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
                          icon: Icon(
                            FontAwesomeIcons.phone.data,
                            color: AppColors.primary,
                          ),
                        ),
                        IconButton(
                          tooltip: 'WhatsApp',
                          onPressed: () {
                            final digits = (str(hot['phone']) ?? '')
                                .replaceAll(RegExp(r'\D'), '');
                            if (digits.isNotEmpty) {
                              launchUrl(
                                Uri.parse(
                                  'https://wa.me/${digits.length == 10 ? '91$digits' : digits}',
                                ),
                                mode: LaunchMode.externalApplication,
                              );
                            }
                          },
                          icon: Icon(
                            FontAwesomeIcons.whatsapp.data,
                            color: AppColors.whatsapp,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _attendanceCard(BuildContext context) {
    final clockIn = DateTime.tryParse(
      '${_attendance?['clockIn'] ?? ''}',
    )?.toLocal();
    final clockOut = DateTime.tryParse(
      '${_attendance?['clockOut'] ?? ''}',
    )?.toLocal();
    final working = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;
    return SoftSurface(
      radius: 18,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(
            working ? Icons.timer_outlined : Icons.fingerprint_rounded,
            color: working ? AppColors.success : AppColors.primary,
            size: 28,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  working
                      ? 'Clocked in ${DateFormat('hh:mm a').format(clockIn)}'
                      : done
                      ? 'Attendance completed'
                      : 'Not clocked in',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  working
                      ? 'Tap to clock out'
                      : done
                      ? '${DateFormat('hh:mm a').format(clockIn)} – ${DateFormat('hh:mm a').format(clockOut)}'
                      : 'Selfie and location may be required',
                  style: TextStyle(
                    fontSize: 10.5,
                    color: AppTheme.of(context).textSoft,
                  ),
                ),
              ],
            ),
          ),
          if (!done)
            FilledButton(
              onPressed: _clocking ? null : _clockAttendance,
              style: FilledButton.styleFrom(
                backgroundColor: working ? AppColors.danger : AppColors.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 9,
                ),
              ),
              child: _clocking
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(working ? 'Clock Out' : 'Clock In'),
            )
          else
            IconButton(
              onPressed: () => widget.onNavigate?.call('Attendance'),
              icon: const Icon(Icons.arrow_forward_rounded),
            ),
        ],
      ),
    );
  }

  Widget _upcomingSection(BuildContext context, Map<String, dynamic> data) {
    final items = (data['upcomingItems'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    if (items.isEmpty) return const SizedBox.shrink();
    return SoftSurface(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          ListTile(
            dense: true,
            leading: const Icon(
              Icons.calendar_month_rounded,
              color: Color(0xFF6366F1),
            ),
            title: const Text(
              'Upcoming 48 hours',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            trailing: _smallBadge('${items.length}', const Color(0xFF6366F1)),
          ),
          Divider(height: 1, color: AppTheme.of(context).border),
          for (final item in items.take(6))
            ListTile(
              dense: true,
              onTap: () => _openLead(item['_id'] as String?),
              title: Text(
                item['name']?.toString() ?? 'Lead',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                '${item['followUpDate'] != null ? 'Follow-up' : 'Site visit'} · ${item['assignedToName'] ?? 'Unassigned'}',
              ),
              trailing: Text(
                _shortDate(item['followUpDate'] ?? item['siteVisitDate']),
                style: const TextStyle(
                  color: Color(0xFF6366F1),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _staleSection(BuildContext context) {
    if (_stale.isEmpty) return const SizedBox.shrink();
    return SoftSurface(
      border: Border.all(color: AppColors.warning.withValues(alpha: .3)),
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          ListTile(
            leading: const Icon(
              Icons.history_rounded,
              color: AppColors.warning,
            ),
            title: Text(
              '${_stale.length} stale lead${_stale.length == 1 ? '' : 's'} need attention',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: const Text('No activity in 7+ days'),
            trailing: TextButton(
              onPressed: () => widget.onNavigate?.call('Leads'),
              child: const Text('View all'),
            ),
          ),
          for (final lead in _stale.take(4))
            ListTile(
              dense: true,
              onTap: () => _openLead(lead['_id'] as String?),
              leading: _smallBadge(
                '${_daysAgo(lead['updatedAt'])}d',
                AppColors.warning,
              ),
              title: Text(
                lead['name']?.toString() ?? 'Lead',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                [
                  lead['status'],
                  lead['source'],
                  lead['assignedToName'],
                ].where((value) => value != null).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                onPressed: () {
                  final phone = lead['phone']?.toString();
                  if (phone != null && phone.isNotEmpty) {
                    launchUrl(Uri.parse('tel:$phone'));
                  }
                },
                icon: Icon(FontAwesomeIcons.phone.data, size: 17),
              ),
            ),
        ],
      ),
    );
  }

  Widget _forecastSection(BuildContext context, Map<String, dynamic> data) {
    final pipeline = (data['pipelineValue'] as num?)?.toDouble() ?? 0;
    final conversion = (data['conversionRate'] as num?)?.toDouble() ?? 0;
    final monthWon = (data['thisMonthClosedWon'] as num?)?.toInt() ?? 0;
    final goal =
        (_goalOverride ?? data['monthlyClosingGoal'] as num?)?.toInt() ?? 0;
    final days = DateUtils.getDaysInMonth(
      DateTime.now().year,
      DateTime.now().month,
    );
    final pace = (monthWon / DateTime.now().day * days).round();
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('FORECAST', style: AppText.kicker(context)),
          const SizedBox(height: 3),
          const Text(
            'Revenue & Closing Pace',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2.1,
            children: [
              _miniMetric(
                'Expected Revenue',
                fmtBudget(pipeline * conversion / 100),
                'At ${conversion.toStringAsFixed(1)}%',
                AppColors.success,
              ),
              _miniMetric(
                'Month Leads',
                '${data['thisMonthLeads'] ?? 0}',
                'Last: ${data['lastMonthLeads'] ?? 0}',
                const Color(0xFF6366F1),
              ),
              _miniMetric(
                'Closings',
                '$monthWon / ${data['lastMonthClosedWon'] ?? 0}',
                'This / last month',
                AppColors.primary,
              ),
              _miniMetric(
                'Projected Pace',
                '$pace',
                goal == 0
                    ? 'No goal set'
                    : pace >= goal
                    ? 'On track'
                    : 'Behind goal',
                goal > 0 && pace < goal ? AppColors.danger : AppColors.success,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _liveOperationsSection(BuildContext context) {
    return Column(
      children: [
        if (_projects.isNotEmpty) ...[
          _projectBreakdownWidget(context),
          const SizedBox(height: 12),
        ],
        if (_team.isNotEmpty) ...[
          _liveAgentStatusWidget(context),
          const SizedBox(height: 12),
        ],
        if (_automations.isNotEmpty) _automationHealthWidget(context),
      ],
    );
  }

  /// Mirrors web's ProjectBreakdownWidget — per-project lead count + %-won
  /// progress bar, tapping opens that project's detail screen directly.
  Widget _projectBreakdownWidget(BuildContext context) {
    final t = AppTheme.of(context);
    final projects = [..._projects]
      ..sort(
        (a, b) => ((b['totalLeads'] as num?) ?? 0).compareTo(
          (a['totalLeads'] as num?) ?? 0,
        ),
      );
    return SoftSurface(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          ListTile(
            leading: Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.apartment_rounded,
                size: 15,
                color: Color(0xFF6366F1),
              ),
            ),
            title: const Text(
              'Project-wise Leads',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            subtitle: Text(
              '${projects.length} active project${projects.length == 1 ? '' : 's'}',
            ),
            trailing: TextButton(
              onPressed: () => widget.onNavigate?.call('Projects'),
              child: const Text('View all'),
            ),
          ),
          Divider(height: 1, color: t.border),
          for (final p in projects.take(6))
            Builder(
              builder: (context) {
                final total = (p['totalLeads'] as num?)?.toInt() ?? 0;
                final won = (p['closedWon'] as num?)?.toInt() ?? 0;
                final pct = total > 0
                    ? ((won / total) * 100).clamp(0, 100).round()
                    : 0;
                return ListTile(
                  dense: true,
                  onTap: () => _openProject(p['_id'] as String),
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(
                          p['name'] as String? ?? '—',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        '$total leads',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: pct / 100,
                              minHeight: 6,
                              backgroundColor: t.surfaceLow,
                              color: pct >= 50
                                  ? AppColors.success
                                  : AppColors.warning,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '$pct% won',
                          style: TextStyle(fontSize: 10, color: t.textSoft),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  /// Mirrors web's LiveAgentStatusWidget — per-agent clock-in status grid.
  Widget _liveAgentStatusWidget(BuildContext context) {
    final t = AppTheme.of(context);
    final clockedIn = _team.where((row) {
      final a = row['attendance'] as Map?;
      return a?['clockIn'] != null && a?['clockOut'] == null;
    }).length;
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('LIVE', style: AppText.kicker(context)),
                    const Text(
                      'Agent Status Today',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
              _smallBadge('$clockedIn online', AppColors.success),
              const SizedBox(width: 6),
              TextButton(
                onPressed: () => widget.onNavigate?.call('Attendance'),
                child: const Text('Attendance →'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final row in _team)
                Builder(
                  builder: (context) {
                    final user = (row['user'] as Map?)?.cast<String, dynamic>() ?? {};
                    final a = (row['attendance'] as Map?)?.cast<String, dynamic>();
                    final isIn = a?['clockIn'] != null && a?['clockOut'] == null;
                    final isDone = a?['clockIn'] != null && a?['clockOut'] != null;
                    final color = isIn
                        ? AppColors.success
                        : isDone
                        ? const Color(0xFF6366F1)
                        : Colors.grey;
                    final clockInTime = a?['clockIn'] != null
                        ? DateFormat(
                            'hh:mm a',
                          ).format(DateTime.parse(a!['clockIn'] as String).toLocal())
                        : null;
                    return Container(
                      width: 158,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: t.surfaceLow,
                        borderRadius: BorderRadius.circular(13),
                        border: Border.all(color: t.border),
                      ),
                      child: Row(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              CircleAvatar(
                                radius: 15,
                                backgroundColor: color.withValues(alpha: 0.14),
                                child: Text(
                                  ((user['name'] as String? ?? '?').isNotEmpty
                                          ? user['name'] as String
                                          : '?')[0]
                                      .toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: color,
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: -1,
                                right: -1,
                                child: Container(
                                  width: 9,
                                  height: 9,
                                  decoration: BoxDecoration(
                                    color: color,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: t.surfaceLow,
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user['name'] as String? ?? '—',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  isIn
                                      ? 'In since $clockInTime'
                                      : isDone
                                      ? 'Done for today'
                                      : 'Not checked in',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    color: t.textSoft,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// Mirrors web's AutomationHealthWidget — per-connection live/off status.
  Widget _automationHealthWidget(BuildContext context) {
    final t = AppTheme.of(context);
    final active = _automations
        .where((a) => a['status'] == 'connected' && a['isActive'] != false)
        .length;
    final inactive = _automations.length - active;
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('INTEGRATIONS', style: AppText.kicker(context)),
                    const Text(
                      'Automation Health',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
              if (active > 0) _smallBadge('$active live', AppColors.success),
              if (active > 0 && inactive > 0) const SizedBox(width: 6),
              if (inactive > 0) _smallBadge('$inactive off', AppColors.danger),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final a in _automations.take(6))
                Builder(
                  builder: (context) {
                    final isLive =
                        a['status'] == 'connected' && a['isActive'] != false;
                    return Container(
                      width: 158,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: t.surfaceLow,
                        borderRadius: BorderRadius.circular(13),
                        border: Border.all(color: t.border),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _platformIcon(a['platform'] as String?),
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (a['name'] as String?)?.isNotEmpty == true
                                      ? a['name'] as String
                                      : a['platform'] as String? ?? '—',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  a['platform'] as String? ?? '',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    color: t.textSoft,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isLive
                                  ? AppColors.success
                                  : AppColors.danger,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _weeklyTrendSection(BuildContext context, Map<String, dynamic> data) {
    final raw = (data['recentDailyLeads'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    final counts = <String, int>{
      for (final item in raw)
        item['_id']?.toString() ?? '': (item['count'] as num?)?.toInt() ?? 0,
    };
    final now = DateTime.now();
    final days = List.generate(7, (index) {
      final date = DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(Duration(days: 6 - index));
      final key = DateFormat('yyyy-MM-dd').format(date);
      return (date: date, count: counts[key] ?? 0);
    });
    final maxCount = days.fold<int>(
      1,
      (max, item) => item.count > max ? item.count : max,
    );
    final total = days.fold<int>(0, (sum, item) => sum + item.count);
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('TRENDS', style: AppText.kicker(context)),
                    const Text(
                      'Leads This Week',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$total',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                'last 7 days',
                style: TextStyle(
                  fontSize: 9,
                  color: AppTheme.of(context).textSoft,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 92,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final item in days)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            '${item.count}',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Container(
                            height: 52 * item.count / maxCount + 3,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateFormat('E').format(item.date),
                            style: TextStyle(
                              fontSize: 9,
                              color: AppTheme.of(context).textSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dropoffSection(BuildContext context, Map<String, dynamic> data) {
    const stages = [
      'New',
      'Contacted',
      'Site Visit',
      'Negotiation',
      'Closed Won',
      'Closed Lost',
    ];
    final values = (data['allTimeByStatus'] as Map?) ?? {};
    final total = stages.fold<int>(
      0,
      (sum, stage) => sum + ((values[stage] as num?)?.toInt() ?? 0),
    );
    if (total == 0) return const SizedBox.shrink();
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('CONVERSION', style: AppText.kicker(context)),
          const SizedBox(height: 3),
          const Text(
            'Pipeline Drop-off',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 12),
          for (final stage in stages) ...[
            Row(
              children: [
                Expanded(
                  child: Text(stage, style: const TextStyle(fontSize: 11)),
                ),
                Text(
                  '${values[stage] ?? 0}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 32,
                  child: Text(
                    '${(((values[stage] as num?)?.toDouble() ?? 0) / total * 100).round()}%',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.of(context).textSoft,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: ((values[stage] as num?)?.toDouble() ?? 0) / total,
              minHeight: 7,
              borderRadius: BorderRadius.circular(99),
              backgroundColor: AppTheme.of(context).surfaceLow,
              color: statusColor(stage),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget _miniMetric(
    String label,
    String value,
    String sub,
    Color color,
  ) => Container(
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: AppTheme.of(context).surfaceLow,
      borderRadius: BorderRadius.circular(13),
      border: Border.all(color: AppTheme.of(context).border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(fontSize: 8, color: AppTheme.of(context).textSoft),
        ),
        Text(
          value,
          maxLines: 1,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        Text(
          sub,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 8, color: AppTheme.of(context).textSoft),
        ),
      ],
    ),
  );

  Widget _smallBadge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      label,
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
    ),
  );

  String _shortDate(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    return date == null ? '—' : DateFormat('d MMM').format(date);
  }

  String _followUpTime(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    return date == null ? 'No time' : DateFormat('d MMM, hh:mm a').format(date);
  }

  int _daysAgo(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    return date == null ? 0 : DateTime.now().difference(date).inDays;
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
          const SizedBox(height: 10),
          OnboardingChecklist(
            totalLeads: (a?['allTimeTotal'] as num?)?.toInt() ?? 0,
            onNavigate: (label) => widget.onNavigate?.call(label),
          ),
          if (role == 'agent' &&
              a != null &&
              ((a['allTimeTotal'] as num?)?.toInt() ?? 0) == 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    size: 18,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'No leads assigned to you yet',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.warning,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Ask your manager to assign leads so they appear here.',
                          style: TextStyle(
                            fontSize: 11.5,
                            color: AppTheme.of(context).textSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          _attendanceCard(context),
          if (_analyticsError) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: .25),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_off_rounded, color: AppColors.danger),
                  const SizedBox(width: 9),
                  const Expanded(
                    child: Text(
                      'Dashboard data could not refresh. Showing the latest available information.',
                    ),
                  ),
                  TextButton(onPressed: _load, child: const Text('Retry')),
                ],
              ),
            ),
          ],
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
                  Builder(
                    builder: (context) {
                      final delta = _calcDelta(
                        (a['thisMonthLeads'] as num?)?.toInt(),
                        (a['lastMonthLeads'] as num?)?.toInt(),
                      );
                      return _MetricCard(
                        label: 'Total Leads',
                        value: '${a['allTimeTotal'] ?? 0}',
                        sub: delta != null
                            ? '${delta >= 0 ? '↑' : '↓'} ${delta.abs()}% vs last month'
                            : 'All time',
                        subColor: delta == null
                            ? null
                            : delta >= 0
                            ? AppColors.success
                            : AppColors.danger,
                        color: AppColors.primary,
                        onTap: () => widget.onNavigate?.call('Leads'),
                      );
                    },
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
                    onTap: () => widget.onNavigate?.call('Leads'),
                  ),
                  _MetricCard(
                    label: 'Closed Won',
                    value: '${a['allTimeClosedWon'] ?? 0}',
                    sub: '${a['conversionRate'] ?? 0}% conversion',
                    color: AppColors.success,
                    onTap: () => widget.onNavigate?.call('Leads'),
                  ),
                  _MetricCard(
                    label: 'Follow-ups',
                    value: '${a['todayFollowUps'] ?? 0}',
                    sub: 'Due today',
                    color: AppColors.warning,
                    onTap: () => widget.onNavigate?.call('Follow-ups'),
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
            if ((a['upcomingItems'] as List?)?.isNotEmpty ?? false) ...[
              const SizedBox(height: 12),
              _upcomingSection(context, a),
            ],
            const SizedBox(height: 20),

            if (isAdmin) ...[
              const _SectionHeader(
                label: 'Admin Intelligence',
                color: Color(0xFF6366F1),
              ),
              const SizedBox(height: 12),
              if (_stale.isNotEmpty) ...[
                _staleSection(context),
                const SizedBox(height: 12),
              ],
              _forecastSection(context, a),
              const SizedBox(height: 12),
              _weeklyTrendSection(context, a),
              const SizedBox(height: 12),
              _liveOperationsSection(context),
              const SizedBox(height: 20),
            ],

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
            _dropoffSection(context, a),
            const SizedBox(height: 16),
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
          ],

          // ── Team — visible to every role, not just admins (matches web) ──
          if (a != null) ...[
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
                        onTap: () => _focusAgent(ag['_id'] as String?),
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
                          onTap: () => _openLead(item['leadId'] as String?),
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
  final Color? subColor;
  final VoidCallback? onTap;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
    this.subColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final content = SoftSurface(
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
              fontWeight: subColor != null ? FontWeight.w700 : FontWeight.w400,
              color: subColor ?? AppTheme.of(context).textSoft,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
    if (onTap == null) return content;
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: content,
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
