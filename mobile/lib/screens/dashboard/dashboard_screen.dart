import 'dart:math' as math;
import 'dart:async';
import 'dart:convert';

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
import '../../widgets/card_skeleton.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../widgets/call_options_sheet.dart';
import '../../widgets/whatsapp_send_sheet.dart';
import '../../widgets/date_range_picker.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import '../../widgets/onboarding_checklist.dart';
import '../attendance/attendance_capture_sheet.dart';
import '../leads/lead_filters.dart';
import 'dashboard_widgets.dart';
import 'morning_brief.dart';
import '../../core/artha_features.dart';
import '../artha/artha_sheet.dart';
import '../projects/project_detail_screen.dart';
import '../../widgets/adaptive_grid.dart';

/// Overdue follow-ups, for the badge on the bottom bar's Follow-ups tab.
/// Set each time the Dashboard loads.
final overdueFollowUps = ValueNotifier<int>(0);

/// Dashboard — GET /leads/analytics + /leads/hot + /leads/followups-due.
/// Mobile-first condensation of the web dashboard's zoned layout.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onNavigate, this.reports = false});

  final ValueChanged<String>? onNavigate;

  /// The Reports tab: the charts and Team section, no home cards.
  final bool reports;

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
  bool _refreshing = false;
  bool _analyticsError = false;
  bool _clocking = false;
  dynamic _dateRange = 'last30days';
  int? _goalOverride;
  // Like the web, these panels load closed on every visit; the chevron
  // opens one for this visit only.
  bool _dueExpanded = false;
  bool _staleExpanded = false;
  bool _projectsExpanded = false;
  Timer? _refreshTimer;
  DateTime? _lastLoadedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Sample content shimmers in each section's place until its data lands;
    // the last data kept on the phone shows at once when there is some.
    _placeholders();
    _restoreCache().whenComplete(_load);
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
    _briefRefresh.dispose();
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

  /// Ticks on every load, so the morning brief refreshes with the rest.
  final _briefRefresh = ValueNotifier<int>(0);

  /// Sections still waiting for their first data. Each shimmers in place
  /// (SectionSkeleton) and fills in as soon as its own request answers, so
  /// a slow one never holds up the rest (23 Oct 2026: the screen used to
  /// wait for all nine requests behind a generic grey placeholder).
  final Set<String> _pending = {'analytics', 'hot', 'due', 'attendance'};

  void _placeholders() {
    final now = DateTime.now();
    _analytics = {
      'totalLeads': 120, 'previousPeriodLeads': 100, 'allTimeTotal': 1200, 'todayFollowUps': 4,
      'byStatus': {'New': 40, 'Contacted': 30, 'Site Visit': 8, 'Closed Won': 2},
      'bySource': {'Facebook': 40, 'WhatsApp': 50, 'Website': 30},
      'speedToLead': {'total': 120, 'within1h': 60, 'within5m': 20, 'notContacted': 30},
      'sourcePerformance': [{'source': 'WhatsApp', 'visits': 8}],
      'upcomingItems': [
        {...SampleData.lead(1), 'followUpDate': now.add(const Duration(hours: 20)).toIso8601String()},
      ],
      'byAgent': [], 'recentActivity': [],
    };
    _hot = [for (var i = 0; i < 3; i++) SampleData.lead(i)];
    _due = [SampleData.lead(2)];
  }

  String get _cacheKey => 'dash_cache_v1_${context.read<AuthState>().user?['_id'] ?? ''}';

  /// The last home data, kept per person for the default range, so the app
  /// opens on real numbers at once and refreshes them quietly.
  Future<void> _restoreCache() async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_cacheKey);
      if (raw == null || !mounted) return;
      final c = (jsonDecode(raw) as Map).cast<String, dynamic>();
      if (_dateRange != 'last30days' || !_pending.contains('analytics')) return;
      List<Map<String, dynamic>> maps(dynamic v) => [for (final x in (v as List?) ?? const []) if (x is Map) x.cast<String, dynamic>()];
      setState(() {
        _analytics = (c['analytics'] as Map?)?.cast<String, dynamic>() ?? _analytics;
        _hot = maps(c['hot']);
        _due = maps(c['due']);
        _attendance = (c['attendance'] as Map?)?.cast<String, dynamic>();
        _automations = maps(c['automations']);
        _waConnected = c['wa'] == true;
        overdueFollowUps.value = _due.where(_isOverdue).length;
        _pending.clear();
      });
    } catch (_) {}
  }

  Future<void> _saveCache() async {
    if (_dateRange != 'last30days' || _analyticsError || _analytics == null) return;
    try {
      (await SharedPreferences.getInstance()).setString(_cacheKey, jsonEncode({
        'analytics': _analytics,
        'hot': _hot,
        'due': _due,
        'attendance': _attendance,
        'automations': _automations,
        'wa': _waConnected,
      }));
    } catch (_) {}
  }

  Future<void> _load({bool background = false}) async {
    if (_refreshing) return;
    if (_lastLoadedAt != null) _briefRefresh.value++;
    _refreshing = true;
    // Stale leads, project stats, team attendance and automations are
    // admin/manager only on the server; an agent would just collect 403s.
    final staff = context.read<AuthState>().isAdmin;
    Future<dynamic> staffGet(String path) => staff ? _tryGet(path) : Future.value(null);
    List<Map<String, dynamic>> list(dynamic v) => ((v as List?) ?? []).cast<Map<String, dynamic>>();
    // Each request fills its own part of the screen the moment it answers.
    Future<void> piece(Future<dynamic> request, void Function(dynamic res) apply) =>
        request.then((res) {
          if (mounted) setState(() => apply(res));
        });
    await Future.wait([
      piece(_tryGet('/leads/analytics', dateRangeParams(_dateRange)), (res) {
        final analytics = (res?.data['data'] as Map?)?.cast<String, dynamic>();
        if (analytics != null) {
          _analytics = analytics;
        } else if (_pending.contains('analytics')) {
          _analytics = null; // never leave the sample numbers showing
        }
        _analyticsError = analytics == null;
        _pending.remove('analytics');
      }),
      piece(_tryGet('/leads/hot', {'limit': 5}), (res) {
        _hot = list(res?.data['data']);
        _pending.remove('hot');
      }),
      piece(_tryGet('/leads/followups-due'), (res) {
        final dueRaw = res?.data['data'];
        _due = dueRaw is List
            ? dueRaw.cast<Map<String, dynamic>>()
            : dueRaw is Map && dueRaw['leads'] is List
            ? (dueRaw['leads'] as List).cast<Map<String, dynamic>>()
            : [];
        overdueFollowUps.value = _due.where(_isOverdue).length;
        _pending.remove('due');
      }),
      piece(staffGet('/leads/stale'), (res) => _stale = list(res?.data['data'])),
      piece(staffGet('/projects/stats'), (res) => _projects = list(res?.data['data'])),
      piece(staffGet('/attendance/team-today'), (res) => _team = list(res?.data['data'])),
      piece(staffGet('/automations'), (res) => _automations = list(res?.data['automations'])),
      piece(_tryGet('/attendance/status'), (res) {
        _attendance = (res?.data['data'] as Map?)?.cast<String, dynamic>();
        _requireSelfie = res?.data['requireSelfie'] as bool? ?? _requireSelfie;
        _pending.remove('attendance');
      }),
      piece(_tryGet('/whatsapp/status'), (res) => _waConnected = res?.data['connected'] == true),
    ]);
    if (!mounted) return;
    setState(() {
      _goalOverride = null;
      _refreshing = false;
      _lastLoadedAt = DateTime.now();
    });
    _saveCache();
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
          // No photo (camera unavailable): tell the server it was declared, as the web does.
          if (proof.selfie == null && _requireSelfie) 'proofUnavailable': true,
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

  // ── Artha insights (the banner's View) ───────────────────────────────────

  /// Two short lines from this range's numbers (POST /help/ask, as before).
  Future<List<String>>? _insightsFuture;

  Future<List<String>> _fetchInsights() async {
    final a = _analytics;
    if (a == null) return const [];
    try {
      final sources = ((a['bySource'] as Map?) ?? {}).entries.toList()
        ..sort((x, y) => (y.value as num).compareTo(x.value as num));
      final topSource = sources.isEmpty ? 'N/A' : '${sources.first.key} (${sources.first.value})';
      final summary = [
        'Total leads: ${a['allTimeTotal'] ?? 0}',
        'New this period: ${a['totalLeads'] ?? 0}',
        'Closed won this month: ${a['thisMonthClosedWon'] ?? 0}',
        'Conversion: ${a['conversionRate'] ?? 0}%',
        'Follow-ups today: ${a['todayFollowUps'] ?? 0}',
        'Top source: $topSource',
        'Pipeline value: ${a['pipelineValue'] ?? 0}',
      ].join('. ');
      final res = await _api.dio.post('/help/ask', data: {
        'question':
            'Using only these CRM numbers: $summary. Give exactly 2 short insights: one positive and one action. Each on its own line, maximum 15 words.',
        'page': '',
      });
      final answer = res.data['answer'] as String? ?? '';
      final lines = answer
          .split('\n')
          .map((line) => line.replaceFirst(RegExp(r'^[•\-*]\s*'), '').trim())
          .where((line) => line.isNotEmpty)
          .take(2)
          .toList();
      return lines.isEmpty ? const ['Insights are unavailable right now.'] : lines;
    } catch (_) {
      return const ['Insights are unavailable right now.'];
    }
  }

  void _openInsights() {
    _insightsFuture ??= _fetchInsights();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final t = AppTheme.of(ctx);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.auto_awesome_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Artha insights', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text))),
                ]),
                const SizedBox(height: 2),
                Text('From your numbers $_scope', style: TextStyle(fontSize: 12.5, color: t.textSoft)),
                const SizedBox(height: 14),
                FutureBuilder<List<String>>(
                  future: _insightsFuture,
                  builder: (_, snap) {
                    if (snap.connectionState != ConnectionState.done) {
                      return const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Center(child: AppSpinner(size: 22)));
                    }
                    return Column(children: [
                      for (final line in snap.data ?? const <String>[])
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 3),
                              child: Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.primary),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(line, style: TextStyle(fontSize: 14, height: 1.4, color: t.text))),
                          ]),
                        ),
                    ]);
                  },
                ),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => setSheet(() => _insightsFuture = _fetchInsights()),
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Refresh'),
                      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        showArthaSheet(context, navLabel: 'Dashboard', onNavigate: widget.onNavigate);
                      },
                      icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                      label: const Text('Ask Artha'),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.primary, minimumSize: const Size(0, 46)),
                    ),
                  ),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

  // ── Home (redesigned 21 Oct 2026) ────────────────────────────────────────
  // Action first: what to do today, then the numbers. Charts and the Team
  // section moved to the Reports tab (DashboardScreen(reports: true)).

  static const _arthaPurple = Color(0xFF7C3AED);

  /// Today in IST, as a plain date.
  static DateTime _istDay(DateTime d) {
    final x = d.toUtc().add(const Duration(hours: 5, minutes: 30));
    return DateTime(x.year, x.month, x.day);
  }

  bool _isOverdue(Map<String, dynamic> lead) {
    final date = DateTime.tryParse('${lead['followUpDate'] ?? ''}');
    return date != null && _istDay(date).isBefore(_istDay(DateTime.now()));
  }

  bool _isDueToday(Map<String, dynamic> lead) {
    final date = DateTime.tryParse('${lead['followUpDate'] ?? ''}');
    return date != null && _istDay(date) == _istDay(DateTime.now());
  }

  List<Map<String, dynamic>> _upcoming(Map<String, dynamic>? a) =>
      ((a?['upcomingItems'] as List?) ?? const []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();

  bool get _agent => context.read<AuthState>().role == 'agent';

  Widget _homeHeader(BuildContext context, AuthState auth, Map<String, dynamic>? analytics) {
    final t = AppTheme.of(context);
    final bySource = (analytics?['bySource'] as Map?) ?? {};
    // A pill for every source that is connected or has leads in this period,
    // in a fixed order. Anything that is not a named source (Manual, Referral,
    // the portals...) counts as Other, so the pills add up to Total Leads.
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
    final specs = <({String platform, String source, String label, int count, Color color, IconData icon})>[
      (platform: 'Facebook', source: 'Facebook', label: 'Facebook', count: n('Facebook'), color: const Color(0xFF1877F2), icon: FontAwesomeIcons.facebookF.data),
      (platform: 'Google', source: 'Google', label: 'Google', count: n('Google'), color: const Color(0xFFEA4335), icon: FontAwesomeIcons.google.data),
      (platform: 'WhatsApp', source: 'WhatsApp', label: 'WhatsApp', count: n('WhatsApp'), color: AppColors.whatsapp, icon: FontAwesomeIcons.whatsapp.data),
      (platform: 'Website Form', source: 'Website', label: 'Website', count: n('Website'), color: AppColors.purple, icon: FontAwesomeIcons.globe.data),
      (platform: 'Vistrow Voice', source: 'Vistrow Voice', label: 'Calls', count: n('Vistrow Voice'), color: const Color(0xFF2563EB), icon: Icons.phone_in_talk_rounded),
      (platform: 'Custom', source: '', label: 'Other', count: otherCount, color: AppColors.warning, icon: FontAwesomeIcons.bolt.data),
    ];
    final sources = [
      for (final sp in specs)
        if (connected.contains(sp.platform) || sp.count > 0) sp,
    ];
    final first = (auth.user?['name'] as String? ?? '').split(' ').first;

    return SoftSurface(
      radius: 24,
      color: t.surface,
      padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${_greeting()},', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: t.textSoft)),
              Text(
                first.isEmpty ? 'Welcome' : first,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: t.text, height: 1.2),
              ),
              const SizedBox(height: 2),
              Text("Here's your overview for today", style: TextStyle(fontSize: 12, color: t.textSoft)),
            ]),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            DateRangePicker(
              value: _dateRange,
              label: _dateRangeLabel,
              onChanged: (value) {
                setState(() {
                  _dateRange = value;
                  _insightsFuture = null;
                });
                _load();
              },
            ),
          ]),
        ]),
        if (sources.isNotEmpty) ...[
          const SizedBox(height: 12),
          // One line that scrolls sideways, never a second row.
          SizedBox(
            height: 50,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: sources.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final sp = sources[i];
                return _SourceChip(
                  count: sp.count,
                  label: sp.label,
                  color: sp.color,
                  icon: sp.icon,
                  onTap: () => _openLeadsFiltered(source: sp.source),
                );
              },
            ),
          ),
        ],
      ]),
    );
  }

  /// One line: Artha's insights for this range ("View" opens them).
  Widget _arthaBanner(BuildContext context) => _ArthaBanner(onTap: _openInsights);

  /// Today's priorities: the morning brief's counts as three tiles. The
  /// header opens the full brief (who to call first, needs attention) where
  /// the company has it, else Follow-ups.
  Widget _prioritiesCard(BuildContext context, Map<String, dynamic>? a) {
    final t = AppTheme.of(context);
    final today = _istDay(DateTime.now());
    final visits = _upcoming(a).where((i) {
      final d = DateTime.tryParse('${i['siteVisitDate'] ?? ''}');
      return d != null && _istDay(d) == today;
    }).length;
    final overdue = _due.where(_isOverdue).length;

    Widget tile(IconData icon, Color color, int n, String label, String sub, VoidCallback onTap) {
      final on = n > 0;
      return Expanded(
        child: Material(
          color: on ? color.withValues(alpha: t.isDark ? 0.14 : 0.07) : t.surfaceLow,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(icon, size: 19, color: on ? color : t.textSoft),
                  const SizedBox(width: 6),
                  Text('$n', style: TextStyle(fontSize: 22, height: 1.1, fontWeight: FontWeight.w800, color: on ? color : t.text)),
                ]),
                const SizedBox(height: 6),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: t.text)),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: t.textSoft)),
              ]),
            ),
          ),
        ),
      );
    }

    return SoftSurface(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(14, 8, 12, 14),
      child: Column(children: [
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: _openPriorities,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.10), shape: BoxShape.circle),
                child: const Icon(Icons.track_changes_rounded, size: 20, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text("Today's priorities", style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: t.text)),
                  Text(_agent ? 'From your leads and follow-ups' : "From your team's leads and follow-ups",
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                ]),
              ),
              Icon(Icons.chevron_right_rounded, color: t.textSoft),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Row(children: [
          tile(Icons.local_fire_department_rounded, AppColors.primary, _hot.length, 'Hot leads', 'Need attention', _openHotSheet),
          const SizedBox(width: 8),
          tile(Icons.alarm_rounded, AppColors.danger, overdue, 'Overdue', 'Follow-ups', () => widget.onNavigate?.call('Follow-ups')),
          const SizedBox(width: 8),
          tile(Icons.event_available_rounded, _arthaPurple, visits, 'Site visits', 'Today', () => widget.onNavigate?.call('Follow-ups')),
        ]),
      ]),
    );
  }

  /// The full morning brief in a sheet, for companies that have it.
  Future<void> _openPriorities() async {
    final brief = (await ArthaFeatures.get())['brief'] == true;
    if (!mounted) return;
    if (!brief) {
      widget.onNavigate?.call('Follow-ups');
      return;
    }
    final auth = context.read<AuthState>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
          children: [
            MorningBrief(
              userId: '${auth.user?['_id'] ?? ''}',
              refresh: _briefRefresh,
              expanded: true,
              onOpen: () => Navigator.of(ctx).pop(),
              onNavigate: (label) => widget.onNavigate?.call(label),
              onCall: _call,
            ),
          ],
        ),
      ),
    );
  }

  Widget _attendanceRow(BuildContext context) {
    final t = AppTheme.of(context);
    final clockIn = DateTime.tryParse('${_attendance?['clockIn'] ?? ''}')?.toLocal();
    final clockOut = DateTime.tryParse('${_attendance?['clockOut'] ?? ''}')?.toLocal();
    final working = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;
    final (status, color) = working
        ? ('Clocked in ${DateFormat('h:mm a').format(clockIn)}', AppColors.success)
        : done
        ? ('Done · ${DateFormat('h:mm a').format(clockIn)} to ${DateFormat('h:mm a').format(clockOut)}', t.textSoft)
        : ('Not clocked in', AppColors.danger);
    return SoftSurface(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.10), shape: BoxShape.circle),
          child: Icon(working ? Icons.timer_outlined : Icons.fingerprint_rounded, size: 21, color: working ? AppColors.success : AppColors.primary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Attendance', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: t.text)),
            const SizedBox(height: 2),
            Row(children: [
              Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 5),
              Flexible(
                child: Text(status, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
              ),
            ]),
          ]),
        ),
        if (!done)
          FilledButton(
            onPressed: _clocking ? null : _clockAttendance,
            style: FilledButton.styleFrom(
              backgroundColor: working ? AppColors.danger : AppColors.primary,
              minimumSize: const Size(0, 44),
              padding: const EdgeInsets.symmetric(horizontal: 18),
            ),
            child: _clocking
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(working ? 'Clock Out' : 'Clock In'),
          )
        else
          IconButton(
            tooltip: 'Open Attendance',
            onPressed: () => widget.onNavigate?.call('Attendance'),
            icon: const Icon(Icons.chevron_right_rounded),
          ),
      ]),
    );
  }

  /// The six numbers in one card, three to a row.
  Widget _performanceCard(BuildContext context, Map<String, dynamic> a) {
    final t = AppTheme.of(context);
    final byStatus = (a['byStatus'] as Map?) ?? {};
    final total = (a['totalLeads'] as num?)?.toInt() ?? 0;
    final prev = (a['previousPeriodLeads'] as num?)?.toInt();
    final delta = prev == null ? null : _calcDelta(total, prev);
    final fresh = (byStatus['New'] as num?)?.toInt() ?? 0;
    final sp = (a['speedToLead'] as Map?) ?? {};
    final tot = (sp['total'] as num?)?.toInt() ?? 0;
    final in1h = (sp['within1h'] as num?)?.toInt() ?? 0;
    final pct = tot == 0 ? null : (in1h / tot * 100).round();
    final visits = ((a['sourcePerformance'] as List?) ?? []).fold<int>(0, (n, r) => n + (((r as Map)['visits'] as num?)?.toInt() ?? 0));
    final won = (byStatus['Closed Won'] as num?)?.toInt() ?? 0;
    final dueToday = (a['todayFollowUps'] as num?)?.toInt() ?? 0;
    // Colour only where it means something: a zero stays plain.
    Color tone(int v, Color c) => v > 0 ? c : t.text;

    final tiles = [
      _KpiTile(
        label: 'Total leads',
        value: '$total',
        sub: delta != null ? '${delta >= 0 ? '↑' : '↓'} ${delta.abs()}% vs previous' : 'In this period',
        subColor: delta == null ? null : (delta >= 0 ? AppColors.success : AppColors.danger),
        color: tone(total, AppColors.primary),
        tip: 'Leads that came in during the selected dates, including any later moved into a project.',
        onTap: () => _openLeadsFiltered(),
      ),
      _KpiTile(
        label: 'New leads',
        value: '$fresh',
        sub: 'Not contacted yet',
        color: tone(fresh, const Color(0xFF2563EB)),
        tip: 'Leads from these dates still in New: nobody has marked them contacted yet.',
        onTap: () => _openLeadsFiltered(status: 'New'),
      ),
      _KpiTile(
        label: 'Response',
        value: pct == null ? '-' : '$pct%',
        // The headline is "within 1 hour", so the line under it is too.
        sub: tot == 0 ? 'No leads yet' : '$in1h of $tot in 1 hr',
        sub2: tot == 0 ? null : '${sp['notContacted'] ?? 0} not yet',
        color: pct == null ? t.textSoft : pct >= 60 ? AppColors.success : pct >= 30 ? AppColors.warning : AppColors.danger,
        tip: "Leads a person reached within an hour of arriving: a call, marking them Contacted, or an agent's own WhatsApp message. The WhatsApp bot's replies don't count.",
      ),
      _KpiTile(
        label: 'Site visits',
        value: '$visits',
        sub: visits > 0 ? 'Reached site or later' : 'None yet',
        color: tone(visits, _arthaPurple),
        tip: 'Leads from these dates at the Site Visit stage or later, or with a site visit date set.',
        onTap: () => _openLeadsFiltered(status: 'Site Visit'),
      ),
      _KpiTile(
        label: 'Closed won',
        value: '$won',
        sub: won > 0 && total > 0 ? '${(won / total * 1000).round() / 10}% of leads' : 'None yet',
        color: tone(won, AppColors.success),
        tip: 'Leads from these dates marked Closed Won.',
        onTap: () => _openLeadsFiltered(status: 'Closed Won'),
      ),
      _KpiTile(
        label: 'Follow-ups',
        value: '$dueToday',
        sub: 'Due today',
        color: tone(dueToday, AppColors.warning),
        tip: 'Follow-ups due today. This one ignores the date range above.',
        onTap: () => widget.onNavigate?.call('Follow-ups'),
      ),
    ];

    return SoftSurface(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(14, 8, 12, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => widget.onNavigate?.call('Reports'),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              const Icon(Icons.bar_chart_rounded, size: 22, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(child: Text('Lead performance', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: t.text))),
              Text(_dateRangeLabel, style: TextStyle(fontSize: 12, color: t.textSoft)),
              Icon(Icons.chevron_right_rounded, size: 20, color: t.textSoft),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        _kpiRow(tiles.sublist(0, 3)),
        const SizedBox(height: 8),
        _kpiRow(tiles.sublist(3)),
      ]),
    );
  }

  Widget _kpiRow(List<Widget> tiles) => IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: tiles[0]),
          const SizedBox(width: 8),
          Expanded(child: tiles[1]),
          const SizedBox(width: 8),
          Expanded(child: tiles[2]),
        ]),
      );

  /// Overdue and due-today follow-ups in one line; Review opens the list.
  Widget _actionBar(BuildContext context) {
    final t = AppTheme.of(context);
    final overdueLeads = _due.where(_isOverdue).toList();
    final todayLeads = _due.where(_isDueToday).toList();
    final scope = _agent ? 'Your follow-ups' : 'Across your team';
    if (overdueLeads.isEmpty && todayLeads.isEmpty) {
      return SoftSurface(
        radius: 20,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("You're all caught up for today", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: t.text)),
              Text('No follow-ups overdue or due today · $scope', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ]),
          ),
        ]),
      );
    }
    final urgent = overdueLeads.isNotEmpty;
    final accent = urgent ? AppColors.danger : AppColors.warning;
    return SoftSurface(
      radius: 20,
      color: accent.withValues(alpha: 0.05),
      border: Border.all(color: accent.withValues(alpha: 0.26)),
      padding: EdgeInsets.zero,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
          child: Row(children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.warning_amber_rounded, size: 21, color: accent),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Action required', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: accent)),
                Text('${overdueLeads.length} overdue · ${todayLeads.length} due today',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
                Text(scope, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
              ]),
            ),
            OutlinedButton(
              onPressed: () => setState(() => _dueExpanded = !_dueExpanded),
              style: OutlinedButton.styleFrom(
                foregroundColor: accent,
                side: BorderSide(color: accent.withValues(alpha: 0.4)),
                minimumSize: const Size(0, 40),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: const StadiumBorder(),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(_dueExpanded ? 'Hide' : 'Review'),
                Icon(_dueExpanded ? Icons.expand_less_rounded : Icons.chevron_right_rounded, size: 18),
              ]),
            ),
          ]),
        ),
        if (_dueExpanded) ...[
          Divider(height: 1, color: t.border),
          for (final lead in [...overdueLeads, ...todayLeads].take(8))
            ListTile(
              dense: true,
              onTap: () => _openLead(lead['_id'] as String?),
              leading: _smallBadge(
                overdueLeads.contains(lead) ? '${(lead['daysOverdue'] as num?)?.toInt() ?? '!'}d' : 'TODAY',
                overdueLeads.contains(lead) ? AppColors.danger : AppColors.warning,
              ),
              minLeadingWidth: 0,
              horizontalTitleGap: 10,
              title: Text(lead['name']?.toString() ?? 'Lead',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                '${orIfBlank(lead['assignedToName'], 'Unassigned')} · ${_followUpTime(lead['followUpDate'])}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
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
                  onPressed: () => _call(phone: lead['phone']?.toString(), name: lead['name']?.toString(), leadId: lead['_id']?.toString()),
                  icon: Icon(FontAwesomeIcons.phone.data, size: 16),
                ),
              ]),
            ),
          if (context.read<AuthState>().isAdmin && _due.any((l) => ((l['daysOverdue'] as num?)?.toInt() ?? 0) > 30))
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 8, 4),
              child: Row(children: [
                Expanded(
                  child: Text(
                    '${_due.where((l) => ((l['daysOverdue'] as num?)?.toInt() ?? 0) > 30).length} of these are more than 30 days overdue.',
                    style: TextStyle(fontSize: 11, color: t.textSoft),
                  ),
                ),
                TextButton(
                  onPressed: _clearStaleFollowUps,
                  child: const Text('Clear old', style: TextStyle(color: AppColors.danger, fontSize: 12)),
                ),
              ]),
            ),
          if (overdueLeads.length + todayLeads.length > 8)
            TextButton(
              onPressed: () => widget.onNavigate?.call('Follow-ups'),
              child: Text('View all ${plural(overdueLeads.length + todayLeads.length, 'follow-up')}'),
            ),
        ],
      ]),
    );
  }

  /// Hot Today and Upcoming 48 hours side by side: the top lead of each with
  /// its actions; the header opens the whole list.
  Widget _hotAndUpcoming(BuildContext context, Map<String, dynamic>? a) {
    final upcoming = _upcoming(a);
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
          child: _miniList(
            context,
            icon: Icons.local_fire_department_rounded,
            color: AppColors.primary,
            title: 'Hot Today',
            sub: plural(_hot.length, 'ranked lead'),
            count: _hot.length,
            empty: 'No hot leads right now',
            onOpen: _openHotSheet,
            first: _hot.firstOrNull,
            firstLine: (l) => [str(l['status']), str(l['location'])].whereType<String>().where((v) => v.isNotEmpty).join(' · '),
            actions: (l) => [
              _miniAction(context, FontAwesomeIcons.phone.data, 'Call', AppColors.success,
                  () => _call(phone: str(l['phone']), name: str(l['name']), leadId: str(l['_id']))),
              _miniAction(context, FontAwesomeIcons.whatsapp.data, 'WhatsApp', AppColors.whatsapp,
                  () => showWhatsAppSendSheet(context, phone: str(l['phone']), name: str(l['name']), leadId: str(l['_id']))),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _miniList(
            context,
            icon: Icons.calendar_month_rounded,
            color: const Color(0xFF6366F1),
            title: 'Upcoming',
            sub: 'Next 48 hours',
            count: upcoming.length,
            empty: 'Nothing in the next 48 hours',
            onOpen: () => _openUpcomingSheet(upcoming),
            first: upcoming.firstOrNull,
            date: (l) => _shortDate(l['followUpDate'] ?? l['siteVisitDate']),
            firstLine: (l) => '${l['followUpDate'] != null ? 'Follow-up' : 'Site visit'} · ${orIfBlank(l['assignedToName'], 'Unassigned')}',
            warn: (l) => '${l['assignedToName'] ?? ''}'.trim().isEmpty,
            actions: (l) => [
              if (context.read<AuthState>().isAdmin && '${l['assignedToName'] ?? ''}'.trim().isEmpty)
                _miniAction(context, Icons.person_add_alt_1_outlined, 'Assign', AppColors.primary, () => _assign(l))
              else
                _miniAction(context, Icons.open_in_new_rounded, 'View lead', AppColors.primary, () => _openLead(str(l['_id']))),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _miniList(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required String sub,
    required int count,
    required String empty,
    required VoidCallback onOpen,
    required Map<String, dynamic>? first,
    required String Function(Map<String, dynamic>) firstLine,
    required List<Widget> Function(Map<String, dynamic>) actions,
    String Function(Map<String, dynamic>)? date,
    bool Function(Map<String, dynamic>)? warn,
  }) {
    final t = AppTheme.of(context);
    return SoftSurface(
      radius: 20,
      padding: const EdgeInsets.fromLTRB(12, 6, 10, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: count > 0 ? onOpen : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: t.text)),
                  Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, color: t.textSoft)),
                ]),
              ),
              if (count > 0) _smallBadge('$count', color),
            ]),
          ),
        ),
        Divider(height: 12, color: t.border),
        if (first == null)
          Expanded(
            child: Center(
              child: Text(empty, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: t.textSoft)),
            ),
          )
        else ...[
          InkWell(
            onTap: () => _openLead(str(first['_id'])),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: t.surfaceLow,
                child: Text(
                  (str(first['name']) ?? '?').isEmpty ? '?' : str(first['name'])![0].toUpperCase(),
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: t.textSoft),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                      child: Text(str(first['name']) ?? 'Lead',
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.text)),
                    ),
                    if (date != null)
                      Text(date(first), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF6366F1))),
                  ]),
                  Text(
                    firstLine(first),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: warn?.call(first) == true ? AppColors.warning : t.textSoft,
                      fontWeight: warn?.call(first) == true ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ]),
              ),
            ]),
          ),
          const Spacer(),
          const SizedBox(height: 10),
          Row(children: [
            for (final (i, w) in actions(first).indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(child: w),
            ],
          ]),
        ],
      ]),
    );
  }

  Widget _miniAction(BuildContext context, IconData icon, String label, Color color, VoidCallback onTap) {
    final t = AppTheme.of(context);
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: t.text,
        side: BorderSide(color: t.border),
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _hotRow(BuildContext context, Map<String, dynamic> hot) {
    final t = AppTheme.of(context);
    return InkWell(
      onTap: () => _openLead(str(hot['_id'])),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.09), borderRadius: BorderRadius.circular(14)),
            child: Text('${hot['_score'] ?? hot['score'] ?? 'HOT'}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppColors.danger)),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(hot['name']) ?? 'Lead', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: t.text)),
              Text(
                [str(hot['status']), str(hot['priority']), str(hot['location'])].whereType<String>().where((v) => v.isNotEmpty).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11.5, color: t.textSoft),
              ),
            ]),
          ),
          IconButton(
            tooltip: 'Call',
            onPressed: () => _call(phone: str(hot['phone']), name: str(hot['name']), leadId: str(hot['_id'])),
            icon: Icon(FontAwesomeIcons.phone.data, color: AppColors.success, size: 19),
          ),
          IconButton(
            tooltip: 'WhatsApp',
            onPressed: () => showWhatsAppSendSheet(context, phone: str(hot['phone']), name: str(hot['name']), leadId: str(hot['_id'])),
            icon: Icon(FontAwesomeIcons.whatsapp.data, color: AppColors.whatsapp),
          ),
        ]),
      ),
    );
  }

  Future<void> _listSheet(String title, String sub, List<Widget> Function(BuildContext ctx) rows) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (ctx) {
          final t = AppTheme.of(ctx);
          return ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.only(top: 16, bottom: 16), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text)),
                  Text(sub, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
                ]),
              ),
              ...rows(ctx),
            ]),
          );
        },
      );

  void _openHotSheet() {
    if (_hot.isEmpty) return;
    _listSheet(
      'Hot Today',
      'Ranked by recent WhatsApp replies, how new the lead is, follow-ups due, budget and stage',
      (ctx) => [for (final h in _hot) _hotRow(ctx, h)],
    );
  }

  void _openUpcomingSheet(List<Map<String, dynamic>> items) {
    if (items.isEmpty) return;
    final admin = context.read<AuthState>().isAdmin;
    _listSheet('Upcoming 48 hours', 'Follow-ups and site visits', (ctx) => [
          for (final item in items)
            ListTile(
              onTap: () {
                Navigator.pop(ctx);
                _openLead(item['_id'] as String?);
              },
              title: Text(item['name']?.toString() ?? 'Lead', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                '${item['followUpDate'] != null ? 'Follow-up' : 'Site visit'} · ${orIfBlank(item['assignedToName'], 'Unassigned')}',
              ),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(_shortDate(item['followUpDate'] ?? item['siteVisitDate']),
                    style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.w700)),
                if (admin && '${item['assignedToName'] ?? ''}'.trim().isEmpty)
                  IconButton(
                    tooltip: 'Assign',
                    onPressed: () {
                      Navigator.pop(ctx);
                      _assign(item);
                    },
                    icon: const Icon(Icons.person_add_alt_1_outlined, color: AppColors.primary),
                  ),
              ]),
            ),
        ]);
  }

  /// Assign an unassigned lead from the dashboard (admins and managers).
  Future<void> _assign(Map<String, dynamic> lead) async {
    final id = str(lead['_id']);
    if (id == null) return;
    List<Map<String, dynamic>> agents = [];
    try {
      final res = await _api.dio.get('/auth/agents');
      agents = ((res.data['agents'] as List?) ?? []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();
    } catch (_) {}
    if (!mounted) return;
    if (agents.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No team members to assign to yet.')));
      return;
    }
    final agentId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.62),
        child: SafeArea(
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(vertical: 12), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text('Assign ${str(lead['name']) ?? 'this lead'} to',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.of(ctx).text)),
            ),
            for (final a in agents)
              ListTile(title: Text('${a['name'] ?? ''}'), subtitle: Text('${a['role'] ?? ''}'), onTap: () => Navigator.pop(ctx, '${a['_id']}')),
          ]),
        ),
      ),
    );
    if (agentId == null || !mounted) return;
    try {
      final r = await _api.dio.post('/leads/bulk-assign', data: {
        'ids': [id],
        'agentId': agentId,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${r.data['message'] ?? 'Assigned'}')));
      _load(background: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not assign the lead'))));
      }
    }
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
                        plural(total, 'lead'),
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

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        children: widget.reports
            ? [SectionSkeleton(loading: _pending.contains('analytics'), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _reportsBody(context, a, isAdmin)))]
            : _homeBody(context, auth, a, role),
      ),
    );
  }

  List<Widget> _errorBanner() => [
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.danger.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.danger.withValues(alpha: .25)),
          ),
          child: Row(children: [
            const Icon(Icons.cloud_off_rounded, color: AppColors.danger),
            const SizedBox(width: 9),
            const Expanded(child: Text('Dashboard data could not refresh. Showing the latest available information.')),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      ];

  /// Home: what to act on today, then the numbers.
  List<Widget> _homeBody(BuildContext context, AuthState auth, Map<String, dynamic>? a, String? role) => [
        SectionSkeleton(loading: _pending.contains('analytics'), child: _homeHeader(context, auth, a)),
        const SizedBox(height: 12),
        _arthaBanner(context),
        const SizedBox(height: 12),
        SectionSkeleton(loading: _pending.any({'analytics', 'hot', 'due'}.contains), child: _prioritiesCard(context, a)),
        if (role == 'agent' && a != null && ((a['allTimeTotal'] as num?)?.toInt() ?? 0) == 0) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.warning_amber_rounded, size: 18, color: AppColors.warning),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('No leads assigned to you yet',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.warning)),
                  const SizedBox(height: 2),
                  Text('Ask your manager to assign leads so they appear here.',
                      style: TextStyle(fontSize: 11.5, color: AppTheme.of(context).textSoft)),
                ]),
              ),
            ]),
          ),
        ],
        const SizedBox(height: 12),
        SectionSkeleton(loading: _pending.contains('attendance'), child: _attendanceRow(context)),
        if (_analyticsError) ..._errorBanner(),
        if (a != null) ...[
          const SizedBox(height: 12),
          SectionSkeleton(loading: _pending.contains('analytics'), child: _performanceCard(context, a)),
        ],
        const SizedBox(height: 12),
        SectionSkeleton(loading: _pending.contains('due'), child: _actionBar(context)),
        const SizedBox(height: 12),
        SectionSkeleton(loading: _pending.any({'analytics', 'hot'}.contains), child: _hotAndUpcoming(context, a)),
        // Setup steps (connect Facebook, add a teammate): last, so a new
        // company's checklist does not push today's work down. Admin jobs an
        // agent cannot do from the app, so agents do not get it.
        if (role != 'agent') ...[
          const SizedBox(height: 12),
          OnboardingChecklist(
            totalLeads: (a?['allTimeTotal'] as num?)?.toInt() ?? 0,
            onNavigate: (label) => widget.onNavigate?.call(label),
          ),
        ],
        const SizedBox(height: 20),
      ];

  /// Reports: the charts and the Team section that used to sit below the
  /// home screen, for the same date range picker.
  List<Widget> _reportsBody(BuildContext context, Map<String, dynamic>? a, bool isAdmin) {
    final t = AppTheme.of(context);
    return [
      Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              a?['allTimeTotal'] != null
                  ? 'Leads created $_scope · ${NumberFormat.decimalPattern('en_IN').format(a!['allTimeTotal'])} in total'
                  : 'Leads created $_scope',
              style: TextStyle(fontSize: 12.5, color: t.textSoft),
            ),
          ]),
        ),
        const SizedBox(width: 8),
        DateRangePicker(
          value: _dateRange,
          label: _dateRangeLabel,
          onChanged: (value) {
            setState(() => _dateRange = value);
            _load();
          },
        ),
      ]),
      if (_analyticsError) ..._errorBanner(),
      const SizedBox(height: 16),
      if (a != null) ...[
        if (isAdmin) ...[
          const _SectionHeader(label: 'Admin Intelligence', color: Color(0xFF6366F1)),
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

        // ── Team: goal (admins), leaderboard and live feed (every role) ──
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
      const SizedBox(height: 20),
    ];
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
                                  text: orIfBlank(item['performedByName'], 'System'),
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

/// A source counter in the home header: icon, count and name, tappable to
/// open Leads filtered by that source.
class _SourceChip extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  const _SourceChip({required this.count, required this.label, required this.color, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Semantics(
      button: true,
      label: '$label leads: $count',
      excludeSemantics: true,
      child: Material(
        color: color.withValues(alpha: t.isDark ? 0.14 : 0.07),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: color.withValues(alpha: 0.22)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 17, color: color),
              const SizedBox(width: 8),
              Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('$count', style: TextStyle(fontSize: 15, height: 1.1, fontWeight: FontWeight.w800, color: t.text)),
                Text(label, style: TextStyle(fontSize: 10.5, color: t.textSoft)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

/// One number in Lead performance: label (with an info tip), the number, and
/// up to two short lines of context. Same shape for all six.
class _KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final String? sub2;
  final Color color;
  final Color? subColor;
  final VoidCallback? onTap;
  final String? tip;

  const _KpiTile({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
    this.sub2,
    this.subColor,
    this.onTap,
    this.tip,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(10, 9, 6, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(
            child: Text(label,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.textSoft)),
          ),
          if (tip != null) SizedBox(width: 20, height: 16, child: OverflowBox(maxWidth: 24, maxHeight: 24, child: InfoTip(tip!, size: 12))),
        ]),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: TextStyle(fontSize: 24, height: 1.1, fontWeight: FontWeight.w800, color: color)),
        ),
        const SizedBox(height: 4),
        Text(
          sub,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11,
            height: 1.3,
            fontWeight: subColor != null ? FontWeight.w700 : FontWeight.w400,
            color: subColor ?? t.textSoft,
          ),
        ),
        if (sub2 != null)
          Text(sub2!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, height: 1.3, color: t.textSoft)),
      ]),
    );
    return Material(
      color: t.surfaceLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: t.border)),
      child: onTap == null
          ? body
          : InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: onTap,
              child: Semantics(button: true, child: body),
            ),
    );
  }
}

/// The Artha AI line on the home screen, in the brand orange (23 Oct 2026,
/// owner: was purple). A soft light sweeps across the sparkle tile, the
/// sparkle breathes and the LIVE dot pulses, so it reads as something alive
/// without pulling the eye on every frame. Still when the phone asks for
/// reduced motion.
class _ArthaBanner extends StatefulWidget {
  final VoidCallback onTap;
  const _ArthaBanner({required this.onTap});

  @override
  State<_ArthaBanner> createState() => _ArthaBannerState();
}

class _ArthaBannerState extends State<_ArthaBanner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2800));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.stop();
      _c.value = 0.35;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    const orange = AppColors.primary;
    final tint = t.isDark ? const Color(0xFFFF9A52) : AppColors.primaryDeep;
    return Material(
      color: orange.withValues(alpha: t.isDark ? 0.13 : 0.07),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: orange.withValues(alpha: 0.25)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: widget.onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 11, 10, 11),
          child: Row(children: [
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final v = _c.value;
                // The sheen crosses the tile in the first half of each cycle.
                final sweep = (v * 2).clamp(0.0, 1.0);
                final breathe = 1 + 0.08 * math.sin(v * 2 * math.pi);
                return Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFFF9A3D), Color(0xFFFF6B00), Color(0xFFE05A00)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: orange.withValues(alpha: 0.22 + 0.18 * math.sin(v * math.pi)),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(alignment: Alignment.center, children: [
                      Positioned.fill(
                        child: FractionalTranslation(
                          translation: Offset(-1.2 + 2.4 * sweep, 0),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(colors: [
                                Colors.white.withValues(alpha: 0),
                                Colors.white.withValues(alpha: 0.38),
                                Colors.white.withValues(alpha: 0),
                              ]),
                            ),
                          ),
                        ),
                      ),
                      Transform.scale(
                        scale: breathe,
                        child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 20),
                      ),
                    ]),
                  ),
                );
              },
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text('ARTHA AI', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: tint)),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.fromLTRB(5, 1, 6, 1),
                    decoration: BoxDecoration(color: orange.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AnimatedBuilder(
                        animation: _c,
                        builder: (context, _) {
                          final pulse = 0.5 + 0.5 * math.sin(_c.value * 4 * math.pi);
                          return Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: orange.withValues(alpha: 0.45 + 0.55 * pulse),
                              boxShadow: [BoxShadow(color: orange.withValues(alpha: 0.5 * pulse), blurRadius: 4 + 3 * pulse)],
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 4),
                      Text('LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: tint)),
                    ]),
                  ),
                ]),
                const SizedBox(height: 2),
                Text('AI insights for smarter follow-ups',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.text)),
              ]),
            ),
            const SizedBox(width: 6),
            Text('View', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tint)),
            Icon(Icons.chevron_right_rounded, size: 20, color: tint),
          ]),
        ),
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
