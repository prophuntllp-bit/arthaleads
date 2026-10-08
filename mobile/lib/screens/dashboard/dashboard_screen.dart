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
import '../../widgets/skeleton.dart';
import '../../widgets/buttons.dart';
import '../../widgets/call_options_sheet.dart';
import '../../widgets/whatsapp_send_sheet.dart';
import '../../widgets/date_range_picker.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import '../../widgets/onboarding_checklist.dart';
import '../attendance/attendance_capture_sheet.dart';
import '../leads/lead_filters.dart';
import '../leads/lead_form.dart';
import 'dashboard_widgets.dart';
import '../projects/project_detail_screen.dart';
import '../../widgets/adaptive_grid.dart';

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

  Future<void> _call({required String? phone, String? name, String? leadId}) async {
    if (phone == null || phone.isEmpty) return;
    final choice = await pickCallMethod(context, name: name, phone: phone);
    if (!mounted || choice == null) return;
    if (choice == 'native') {
      await launchUrl(Uri.parse('tel:$phone'));
      return;
    }
    try {
      final res = await _api.dio.post('/calls/initiate', data: {'leadId': leadId});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] as String? ?? 'Call initiated — check your phone.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Call failed. Check EnableX settings.')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Map<String, dynamic>? _analytics;
  List<Map<String, dynamic>> _hot = [];
  List<Map<String, dynamic>> _due = [];
  List<Map<String, dynamic>> _stale = [];
  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _team = [];
  List<Map<String, dynamic>> _automations = [];
  // WhatsApp is the org's own connection, not an automation, so its status is
  // asked for separately (same as the web dashboard).
  bool _waConnected = false;
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
  // Like the web, these panels load closed on every visit; the chevron
  // opens one for this visit only.
  bool _dueExpanded = false;
  bool _hotExpanded = false;
  bool _staleExpanded = false;
  bool _projectsExpanded = false;
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
      _tryGet('/whatsapp/status'),
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
      _waConnected = results[8]?.data['connected'] == true;
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
  String get _scope => describeRange(_dateRange);

  /// Opens the Leads tab showing exactly what a dashboard card counted: this
  /// dashboard's date range, plus a status or source when the card has one.
  void _openLeadsFiltered({String status = '', String source = ''}) {
    final r = _dateRange;
    DeepLink.leadFilters.value = r is Map
        ? LeadFilters(
            status: status,
            source: source,
            from: DateTime.tryParse('${r['from']}'),
            to: DateTime.tryParse('${r['to']}'),
          )
        : LeadFilters(status: status, source: source, dateRange: (r as String?) ?? '');
    widget.onNavigate?.call('Leads');
  }

  /// Follow-up shortcuts from the dashboard list, same as the web: move to
  /// tomorrow 11 AM IST, or clear it.
  Future<void> _setFollowUp(Map<String, dynamic> lead, String? isoDate) async {
    final name = lead['name']?.toString() ?? 'Lead';
    try {
      await _api.dio.patch('/leads/${lead['_id']}', data: {'followUpDate': isoDate});
      if (!mounted) return;
      setState(() => _due.removeWhere((l) => l['_id'] == lead['_id']));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(isoDate == null ? '$name: follow-up cleared' : '$name: moved to tomorrow 11 AM'),
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ApiClient.errorMessage(e, "Couldn't update that follow-up")),
        backgroundColor: AppColors.danger,
      ));
    }
  }

  String _tomorrow11Ist() {
    final ist = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30, days: 1));
    final key = ist.toIso8601String().substring(0, 10);
    return DateTime.parse('${key}T11:00:00+05:30').toUtc().toIso8601String();
  }

  Future<void> _clearStaleFollowUps() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear old follow-ups?'),
        content: const Text(
          'Removes every follow-up that is more than 30 days overdue. The leads stay as they are; only the old date is removed, and it is noted on each lead.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await _api.dio.post('/leads/followups/clear-stale', data: {'olderThanDays': 30});
      final n = (res.data['cleared'] as num?)?.toInt() ?? 0;
      if (!mounted) return;
      setState(() => _due.removeWhere((l) => ((l['daysOverdue'] as num?)?.toInt() ?? 0) > 30));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cleared $n old follow-up${n == 1 ? '' : 's'}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ApiClient.errorMessage(e, "Couldn't clear old follow-ups")),
        backgroundColor: AppColors.danger,
      ));
    }
  }

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
    // A pill for every source that is connected or has leads in this period, in
    // a fixed order. Anything that is not one of the named sources (Manual,
    // Referral, Walk-in, the property portals...) is counted together as Other,
    // so the pills add up to the Total Leads card. Same rule as the web.
    final connected = <String>{
      for (final a in _automations)
        if (a['status'] == 'connected' && a['isActive'] != false) '${a['platform']}',
      if (_waConnected) 'WhatsApp',
    };
    const named = {'Facebook', 'Google', 'WhatsApp', 'Website', 'Vistrow Voice'};
    int n(String key) => (bySource[key] as num?)?.toInt() ?? 0;
    final otherCount = bySource.entries
        .where((e) => !named.contains('${e.key}'))
        .fold<int>(0, (sum, e) => sum + ((e.value as num?)?.toInt() ?? 0));
    final specs = <({String platform, String label, int count, Color color, IconData icon})>[
      (platform: 'Facebook', label: 'Facebook', count: n('Facebook'), color: const Color(0xFF1877F2), icon: FontAwesomeIcons.facebookF.data),
      (platform: 'Google', label: 'Google', count: n('Google'), color: const Color(0xFFEA4335), icon: FontAwesomeIcons.google.data),
      (platform: 'WhatsApp', label: 'WhatsApp', count: n('WhatsApp'), color: AppColors.whatsapp, icon: FontAwesomeIcons.whatsapp.data),
      (platform: 'Website Form', label: 'Website', count: n('Website'), color: AppColors.purple, icon: FontAwesomeIcons.globe.data),
      (platform: 'Vistrow Voice', label: 'Vistrow Voice', count: n('Vistrow Voice'), color: const Color(0xFF8B5CF6), icon: Icons.mic_rounded),
      (platform: 'Custom', label: 'Other', count: otherCount, color: AppColors.warning, icon: FontAwesomeIcons.bolt.data),
    ];
    final sources = [
      for (final sp in specs)
        if (connected.contains(sp.platform) || sp.count > 0) sp,
    ];

    return SoftSurface(
      radius: 28,
      color: AppTheme.of(context).surface,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (sources.isNotEmpty) ...[
            // Wraps onto a second line rather than scrolling sideways, so no
            // source is ever cut off at the edge on a narrow screen.
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final source in sources)
                  _SourcePill(
                    count: source.count,
                    color: source.color,
                    icon: source.icon,
                    tooltip: source.label,
                  ),
              ],
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
                    // Days overdue ("45d"), same as the web, so the name
                    // keeps its own line next to the row's shortcuts.
                    leading: _smallBadge(
                      overdueLeads.contains(lead)
                          ? '${(lead['daysOverdue'] as num?)?.toInt() ?? '!'}d'
                          : 'TODAY',
                      overdueLeads.contains(lead)
                          ? AppColors.danger
                          : AppColors.warning,
                    ),
                    minLeadingWidth: 0,
                    horizontalTitleGap: 10,
                    title: Text(
                      lead['name']?.toString() ?? 'Lead',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${lead['assignedToName'] ?? 'Unassigned'} · ${_followUpTime(lead['followUpDate'])}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            minimumSize: const Size(0, 32),
                            visualDensity: VisualDensity.compact,
                          ),
                          onPressed: () => _setFollowUp(lead, _tomorrow11Ist()),
                          child: const Text('Tomorrow', style: TextStyle(fontSize: 11.5)),
                        ),
                        IconButton(
                          tooltip: 'Clear this follow-up',
                          visualDensity: VisualDensity.compact,
                          onPressed: () => _setFollowUp(lead, null),
                          icon: const Icon(Icons.close_rounded, size: 18),
                        ),
                        IconButton(
                          tooltip: 'Call',
                          visualDensity: VisualDensity.compact,
                          onPressed: () => _call(
                            phone: lead['phone']?.toString(),
                            name: lead['name']?.toString(),
                            leadId: lead['_id']?.toString(),
                          ),
                          icon: Icon(FontAwesomeIcons.phone.data, size: 16),
                        ),
                      ],
                    ),
                  ),
                if (context.read<AuthState>().isAdmin &&
                    _due.any((l) => ((l['daysOverdue'] as num?)?.toInt() ?? 0) > 30))
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 4, 8, 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${_due.where((l) => ((l['daysOverdue'] as num?)?.toInt() ?? 0) > 30).length} of these are more than 30 days overdue.',
                            style: TextStyle(fontSize: 11, color: AppTheme.of(context).textSoft),
                          ),
                        ),
                        TextButton(
                          onPressed: _clearStaleFollowUps,
                          child: const Text('Clear old', style: TextStyle(color: AppColors.danger, fontSize: 12)),
                        ),
                      ],
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
                InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => setState(() => _hotExpanded = !_hotExpanded),
                  child: Padding(
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
                            const Row(
                              children: [
                                Text(
                                  'Hot Today',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                InfoTip(
                                  'Ranked by recent WhatsApp replies, how new the lead is, follow-ups due, budget and pipeline stage. Leads tagged Not a buyer are left out.',
                                ),
                              ],
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
                      const SizedBox(width: 6),
                      Icon(
                        _hotExpanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                      ),
                    ],
                  ),
                ),
                ),
                if (_hotExpanded)
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
                          onPressed: () => _call(
                            phone: str(hot['phone']),
                            name: str(hot['name']),
                            leadId: str(hot['_id']),
                          ),
                          icon: Icon(
                            FontAwesomeIcons.phone.data,
                            color: AppColors.primary,
                          ),
                        ),
                        IconButton(
                          tooltip: 'WhatsApp',
                          onPressed: () => showWhatsAppSendSheet(
                            context,
                            phone: str(hot['phone']),
                            name: str(hot['name']),
                            leadId: str(hot['_id']),
                          ),
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
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => setState(() => _staleExpanded = !_staleExpanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(Icons.history_rounded, color: AppColors.warning),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_stale.length} stale lead${_stale.length == 1 ? '' : 's'} need attention',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                        const SizedBox(height: 2),
                        Text('No activity in 7+ days',
                            style: TextStyle(fontSize: 12, color: AppTheme.of(context).textSoft)),
                        InkWell(
                          onTap: () => widget.onNavigate?.call('Leads'),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 6),
                            child: Text('View all',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(
                      _staleExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      size: 22,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_staleExpanded)
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
                onPressed: () => _call(
                  phone: lead['phone']?.toString(),
                  name: lead['name']?.toString(),
                  leadId: lead['_id']?.toString(),
                ),
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
          AdaptiveGrid(
 columns: 2,
 spacing: 8,
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
        if (_automations.isNotEmpty)
          DashSourcesHealth(
            automations: _automations,
            iconFor: _platformIcon,
            onOpen: () => widget.onNavigate?.call('Integrations'),
          ),
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
            onTap: () => setState(() => _projectsExpanded = !_projectsExpanded),
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
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () => widget.onNavigate?.call('Projects'),
                  child: const Text('View all'),
                ),
                Icon(
                  _projectsExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  size: 18,
                ),
              ],
            ),
          ),
          if (_projectsExpanded) Divider(height: 1, color: t.border),
          if (_projectsExpanded)
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
          dashCardHeader(context, 'Live', 'Agent Status Today', pill: '$clockedIn online'),
          const SizedBox(height: 12),
          // Two tiles across, each as tall as it needs to be, so the card uses
          // its full width instead of a single narrow column.
          AdaptiveGrid(
            columns: 2,
            spacing: 8,
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
                                    fontSize: 13,
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
                                    fontSize: 11,
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
          // Left-aligned, clear of the floating assistant bubble at the right.
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
              onPressed: () => widget.onNavigate?.call('Attendance'),
              child: const Text('Open Attendance →'),
            ),
          ),
        ],
      ),
    );
  }

  /// Mirrors web's AutomationHealthWidget — per-connection live/off status.
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

    // First load only — _load() keeps _loading false on background refreshes,
    // so this never replaces content the user is already reading.
    if (_loading) {
      return const DashboardSkeleton();
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
              // Two columns on a phone, three on a small tablet, all six in
              // a row on a large one, so cards never stretch into big empty
              // boxes on wide screens.
              child: LayoutBuilder(builder: (context, box) {
                final cols = box.maxWidth >= 1000 ? 6 : box.maxWidth >= 560 ? 3 : 2;
                return AdaptiveGrid(
 columns: cols,
 spacing: 10,
 children: [
                  // Same six cards as the web, all for the selected range
                  // except Follow-ups (due today is due today).
                  Builder(
                    builder: (context) {
                      final total = (a['totalLeads'] as num?)?.toInt() ?? 0;
                      final prev = (a['previousPeriodLeads'] as num?)?.toInt();
                      final delta = prev == null ? null : _calcDelta(total, prev);
                      return _MetricCard(
                        label: 'Total Leads',
                        value: '$total',
                        sub: delta != null
                            ? '${delta >= 0 ? '↑' : '↓'} ${delta.abs()}% vs previous'
                            : 'created $_scope',
                        subColor: delta == null
                            ? null
                            : delta >= 0
                            ? AppColors.success
                            : AppColors.danger,
                        color: AppColors.primary,
                        tip: 'Leads that came in during the selected dates, including any later moved into a project.',
                        onTap: () => _openLeadsFiltered(),
                      );
                    },
                  ),
                  _MetricCard(
                    label: 'New',
                    value: '${((a['byStatus'] as Map?) ?? {})['New'] ?? 0}',
                    sub: 'Not contacted yet',
                    color: const Color(0xFF6366F1),
                    tip: 'Leads from these dates still in New: nobody has marked them contacted yet.',
                    onTap: () => _openLeadsFiltered(status: 'New'),
                  ),
                  Builder(
                    builder: (context) {
                      // A person reached the lead within an hour: a call,
                      // marked Contacted, or an agent's WhatsApp message.
                      // The WhatsApp bot's replies don't count.
                      final sp = (a['speedToLead'] as Map?) ?? {};
                      final tot = (sp['total'] as num?)?.toInt() ?? 0;
                      final pct = tot == 0 ? null : (((sp['within1h'] as num?) ?? 0) / tot * 100).round();
                      return _MetricCard(
                        label: 'Reached in 1 hr',
                        tip: "Share of these leads a person reached within an hour of arriving: a call, marking them Contacted, or an agent's own WhatsApp message. The WhatsApp bot's replies don't count.",
                        value: pct == null ? '-' : '$pct%',
                        sub: tot == 0
                            ? 'No leads in this period'
                            : '${sp['within5m'] ?? 0} in 5 min · ${sp['notContacted'] ?? 0} not yet',
                        color: pct == null
                            ? AppTheme.of(context).textSoft
                            : pct >= 60
                            ? AppColors.success
                            : pct >= 30
                            ? AppColors.warning
                            : AppColors.danger,
                      );
                    },
                  ),
                  Builder(
                    builder: (context) {
                      final visits = ((a['sourcePerformance'] as List?) ?? [])
                          .fold<int>(0, (n, r) => n + (((r as Map)['visits'] as num?)?.toInt() ?? 0));
                      return _MetricCard(
                        label: 'Site Visits',
                        value: '$visits',
                        sub: visits > 0 ? 'Reached site visit or later' : 'None yet this period',
                        color: const Color(0xFF8B5CF6),
                        tip: 'Leads from these dates at the Site Visit stage or later, or with a site visit date set.',
                        onTap: () => _openLeadsFiltered(status: 'Site Visit'),
                      );
                    },
                  ),
                  Builder(
                    builder: (context) {
                      final won = (((a['byStatus'] as Map?) ?? {})['Closed Won'] as num?)?.toInt() ?? 0;
                      final total = (a['totalLeads'] as num?)?.toInt() ?? 0;
                      return _MetricCard(
                        label: 'Closed Won',
                        value: '$won',
                        sub: won > 0 && total > 0
                            ? '${(won / total * 1000).round() / 10}% of leads'
                            : 'None marked Closed Won',
                        color: AppColors.success,
                        tip: 'Leads from these dates marked Closed Won.',
                        onTap: () => _openLeadsFiltered(status: 'Closed Won'),
                      );
                    },
                  ),
                  _MetricCard(
                    label: 'Follow-ups',
                    value: '${a['todayFollowUps'] ?? 0}',
                    sub: 'Due today, all leads',
                    color: AppColors.warning,
                    tip: 'Follow-ups due today across all your leads. This one ignores the date range above.',
                    onTap: () => widget.onNavigate?.call('Follow-ups'),
                  ),
                ],
              );
              }),
            ),
            const SizedBox(height: 8),
            Text(
              'Showing leads created $_scope.${a['allTimeTotal'] != null ? ' ${NumberFormat.decimalPattern('en_IN').format(a['allTimeTotal'])} leads in total.' : ''}',
              style: TextStyle(fontSize: 11, color: AppTheme.of(context).textSoft),
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
              // Projects from closed deals; with none yet it could only show
              // dashes and zeros, so it waits for the first one.
              if (((a['allTimeClosedWon'] as num?)?.toInt() ?? 0) > 0) ...[
                _forecastSection(context, a),
                const SizedBox(height: 12),
              ],
              DashLeadsTrend(data: a, scope: _scope),
              const SizedBox(height: 12),
              _liveOperationsSection(context),
              const SizedBox(height: 20),
            ],

            // ── Performance: all for the selected range ──
            const _SectionHeader(label: 'Performance'),
            const SizedBox(height: 12),
            DashStatusBreakdown(
              byStatus: (a['byStatus'] as Map?) ?? {},
              scope: _scope,
              onSelect: (status) => _openLeadsFiltered(status: status),
            ),
            const SizedBox(height: 12),
            DashSourceDonut(
              bySource: (a['bySource'] as Map?) ?? {},
              scope: _scope,
              onSelect: (source) => _openLeadsFiltered(source: source),
            ),
            const SizedBox(height: 12),
            DashSourcePerformance(
              rows: ((a['sourcePerformance'] as List?) ?? []).cast<Map<String, dynamic>>(),
              scope: _scope,
              onSelect: (source) => _openLeadsFiltered(source: source),
            ),
            const SizedBox(height: 16),
          ],

          // ── Team: goal (admins), leaderboard and live feed (every role) ──
          if (a != null) ...[
            const _SectionHeader(label: 'Team'),
            const SizedBox(height: 12),
            if (isAdmin) ...[
              _goalCard(context, a),
              const SizedBox(height: 12),
            ],
            if ((a['byAgent'] as List?)?.isNotEmpty ?? false) ...[
              _topAgentsCard(context, a),
              const SizedBox(height: 12),
            ],
            if ((a['recentActivity'] as List?)?.isNotEmpty ?? false) _teamActivityCard(context, a),
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _goalCard(BuildContext context, Map<String, dynamic> a) {
    final t = AppTheme.of(context);
    final goal = _goalOverride ?? (a['monthlyClosingGoal'] as num?)?.toInt() ?? 0;
    final current = (a['thisMonthClosedWon'] as num?)?.toInt() ?? 0;
    final pct = goal > 0 ? (current / goal * 100).clamp(0, 100).round() : 0;
    return SoftSurface(
      padding: const EdgeInsets.fromLTRB(14, 14, 6, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: dashCardHeader(context, 'This month', 'Monthly Goal')),
              IconButton(
                tooltip: 'Set goal',
                icon: const Icon(Icons.edit_outlined, size: 18),
                onPressed: () => _editGoal(goal),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: goal > 0
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text('$current', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                          Text(' of $goal closed won', style: TextStyle(fontSize: 13, color: t.textSoft)),
                          const Spacer(),
                          Text('$pct%', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: pct / 100,
                          minHeight: 8,
                          backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                          color: pct >= 100 ? AppColors.success : AppColors.primary,
                        ),
                      ),
                    ],
                  )
                : Text('No monthly goal set. Tap the pencil to set one.',
                    style: TextStyle(fontSize: 13, color: t.textSoft)),
          ),
        ],
      ),
    );
  }

  Widget _topAgentsCard(BuildContext context, Map<String, dynamic> a) {
    final t = AppTheme.of(context);
    final agents = (a['byAgent'] as List).cast<Map<String, dynamic>>().take(5).toList();
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dashCardHeader(context, 'Leaderboard', 'Top Agents', pill: 'by leads'),
          const SizedBox(height: 6),
          for (final (i, ag) in agents.indexed)
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => _focusAgent(ag['_id'] as String?),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: i == 0 ? null : Border(top: BorderSide(color: t.border)),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                      child: Text('${i + 1}',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(ag['name'] as String? ?? '—',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    ),
                    Text(
                      '${ag['count'] ?? 0} ${(ag['count'] as num?)?.toInt() == 1 ? 'lead' : 'leads'}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  static String _timeAgo(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}');
    if (d == null) return '';
    final s = DateTime.now().difference(d).inSeconds;
    if (s < 60) return 'just now';
    if (s < 3600) return '${s ~/ 60}m ago';
    if (s < 86400) return '${s ~/ 3600}h ago';
    return '${s ~/ 86400}d ago';
  }

  static const _activityColors = {
    'status_changed': Color(0xFFF59E0B),
    'called': Color(0xFF22C55E),
    'site_visit': Color(0xFF8B5CF6),
    'note_added': Color(0xFF06B6D4),
    'assigned': Color(0xFF3B82F6),
    'follow_up_set': Color(0xFFF97316),
    'created': Color(0xFFFF6B00),
    'emailed': Color(0xFFEC4899),
  };

  Widget _teamActivityCard(BuildContext context, Map<String, dynamic> a) {
    final t = AppTheme.of(context);
    final items = (a['recentActivity'] as List).cast<Map<String, dynamic>>().take(10).toList();
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dashCardHeader(context, 'Live feed', 'Team Activity', pill: 'Last 10 actions'),
          const SizedBox(height: 6),
          for (final (i, item) in items.indexed)
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => _openLead(item['leadId'] as String?),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: i == 0 ? null : Border(top: BorderSide(color: t.border)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _activityColors['${item['type']}'] ?? const Color(0xFF6B7280),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: '${item['performedByName'] ?? 'System'}',
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                TextSpan(
                                  text: ' · ${item['description'] ?? ''}',
                                  style: TextStyle(color: t.textSoft),
                                ),
                              ],
                            ),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, height: 1.35),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            [
                              if (((item['leadName'] as String?) ?? '').isNotEmpty) item['leadName'] as String,
                              _timeAgo(item['createdAt']),
                            ].where((e) => e.isNotEmpty).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, color: t.textSoft),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
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
  final String? tip;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
    this.subColor,
    this.onTap,
    this.tip,
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
          Row(
            children: [
              Flexible(
                child: Text(
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
              ),
              if (tip != null)
                SizedBox(width: 20, height: 14, child: OverflowBox(maxWidth: 20, maxHeight: 24, child: InfoTip(tip!, size: 12))),
            ],
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
