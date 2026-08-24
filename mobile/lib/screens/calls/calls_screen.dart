import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/call_options_sheet.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import 'call_history_screen.dart';
import '../../widgets/direction_badge.dart';

/// Calls — GET /calls (per-lead call history), GET /calls/stats,
/// POST /calls/initiate (EnableX bridge call — rings the agent's own phone
/// first, then bridges to the lead once answered; no in-app telephony
/// needed). Mirrors frontend/src/pages/Calls.jsx.
class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  final _api = ApiClient.instance;
  final _searchCtrl = TextEditingController();

  final List<Map<String, dynamic>> _calls = [];
  Map<String, dynamic> _stats = {};
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  String? _callingLeadId;
  final _scroll = ScrollController();

  static const _statusTabs = [
    ('all', 'All Calls'),
    ('answered', 'Answered'),
    ('missed', 'Missed'),
    ('initiated', 'Initiated'),
  ];
  String _statusFilter = 'all';
  String _agentFilter = '';
  List<Map<String, dynamic>> _agents = [];

  bool _analyticsLoading = true;
  Map<String, dynamic>? _analytics;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _loadAgents();
    _loadAnalytics();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading &&
          _page < _pages) {
        _page += 1;
        _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAgents() async {
    if (!context.read<AuthState>().isAdmin) return;
    try {
      final res = await _api.dio.get('/auth/agents');
      if (mounted) {
        setState(
          () => _agents = (res.data['agents'] as List? ?? [])
              .cast<Map<String, dynamic>>(),
        );
      }
    } catch (_) {}
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _calls.clear();
    }
    setState(() => _loading = true);
    try {
      final futures = <Future>[
        _api.dio.get(
          '/calls',
          queryParameters: {
            'page': _page,
            'limit': 30,
            if (_statusFilter != 'all') 'status': _statusFilter,
            if (_agentFilter.isNotEmpty) 'agentId': _agentFilter,
            if (_searchCtrl.text.trim().isNotEmpty)
              'search': _searchCtrl.text.trim(),
          },
        ),
      ];
      if (reset) futures.add(_api.dio.get('/calls/stats'));

      final results = await Future.wait(futures);
      setState(() {
        _calls.addAll(
          (results[0].data['calls'] as List? ?? [])
              .cast<Map<String, dynamic>>(),
        );
        _pages = results[0].data['pages'] as int? ?? 1;
        if (results.length > 1) {
          _stats = (results[1].data as Map).cast<String, dynamic>();
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load calls')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _call(Map<String, dynamic> row) async {
    final leadId = row['leadId'] as String?;
    if (leadId == null || _callingLeadId != null) return;
    final phone = row['leadPhone'] as String?;
    final choice = await pickCallMethod(
      context,
      name: row['leadName'] as String?,
      phone: phone,
    );
    if (!mounted || choice == null) return;
    if (choice == 'native') {
      if (phone != null && phone.isNotEmpty) {
        await launchUrl(Uri.parse('tel:$phone'));
      }
      return;
    }
    setState(() => _callingLeadId = leadId);
    try {
      final res = await _api.dio.post(
        '/calls/initiate',
        data: {'leadId': leadId},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] as String? ?? 'Calling…'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Call failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _callingLeadId = null);
    }
  }

  Future<void> _loadAnalytics() async {
    setState(() => _analyticsLoading = true);
    try {
      final res = await _api.dio.get('/calls/analytics');
      if (mounted) {
        setState(() => _analytics = (res.data as Map).cast<String, dynamic>());
      }
    } catch (_) {
      // Analytics is a secondary panel — fail quietly, keep the call list usable.
    } finally {
      if (mounted) setState(() => _analyticsLoading = false);
    }
  }

  Future<void> _refresh() =>
      Future.wait([_load(reset: true), _loadAnalytics()]);

  Color _statusColor(String? s) {
    switch (s) {
      case 'answered':
        return AppColors.success;
      case 'missed':
      case 'no-answer':
      case 'failed':
        return AppColors.danger;
      default:
        return AppColors.info;
    }
  }

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '—';
    // No leading zeros: the call card packs this next to two badges and a
    // duration, and the two saved characters buy real room on a narrow phone.
    return DateFormat('d MMM, h:mm a').format(dt);
  }

  String _pluralCalls(dynamic count) {
    final n = (count as num? ?? 0).toInt();
    return n == 1 ? '1 call' : '$n calls';
  }

  String _fmtDuration(dynamic secs) {
    final s = secs is num ? secs.toInt() : 0;
    if (s <= 0) return '';
    // Most calls here are under a minute, and a leading "0m " on every one of
    // them is noise that also costs width on the already-tight call card.
    if (s < 60) return '${s}s';
    return '${s ~/ 60}m ${s % 60}s';
  }

  static const _monthAbbr = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /// Compact 14-day column chart.
  ///
  /// This was previously fourteen full-width horizontal bars. Two things made
  /// that cost most of a screen: the date column was 34px wide, so every label
  /// except "1 Aug" wrapped onto a second line and doubled its row height, and
  /// scaling every bar against the busiest day left the quiet days as a 4px dot
  /// trailed by ~300px of blank space with the total stranded at the far edge.
  /// Vertical columns encode the same three numbers per day (answered, missed,
  /// total) in roughly a third of the height, and put each total directly above
  /// the bar it belongs to.
  Widget _volumeByDayCard(List<Map> volumeByDay) {
    const barsHeight = 72.0;
    final maxTotal = volumeByDay.fold<int>(
      1,
      (m, d) => (d['total'] as num? ?? 0).toInt() > m
          ? (d['total'] as num).toInt()
          : m,
    );
    final theme = AppTheme.of(context);

    // The kicker used to claim "LAST 14 DAYS", but the series only contains
    // days that actually had calls — gaps are silently dropped. Showing the
    // real span keeps the label honest and doubles as the month qualifier that
    // the day-number axis below omits.
    String rangeLabel() {
      String fmt(Map d) {
        final id = (d['_id'] as Map?) ?? {};
        final m = (id['m'] as num?)?.toInt();
        final day = (id['d'] as num?)?.toInt();
        if (m == null || day == null) return '';
        return '$day ${_monthAbbr[(m - 1).clamp(0, 11)]}';
      }

      final first = fmt(volumeByDay.first);
      final last = fmt(volumeByDay.last);
      if (first.isEmpty || last.isEmpty) return '';
      return first == last ? first : '$first – $last';
    }

    return SoftSurface(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  'DAILY CALL VOLUME',
                  style: AppText.kicker(context),
                ),
              ),
              if (volumeByDay.isNotEmpty)
                Text(
                  rangeLabel(),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (volumeByDay.isEmpty)
            Text(
              'No calls in the last 30 days.',
              style: Theme.of(context).textTheme.bodySmall,
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: volumeByDay.map((d) {
                final id = (d['_id'] as Map?) ?? {};
                final day = (id['d'] as num?)?.toInt();
                final total = (d['total'] as num? ?? 0).toInt();
                final answered = (d['answered'] as num? ?? 0).toInt();
                final missed = (d['missed'] as num? ?? 0).toInt();

                // A day with a single call still has to be visible, so give any
                // non-zero segment a 3px floor rather than letting it round away.
                double seg(int v) => v <= 0
                    ? 0
                    : (v / maxTotal * barsHeight).clamp(3.0, barsHeight);

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$total',
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: theme.text,
                          ),
                        ),
                        const SizedBox(height: 3),
                        SizedBox(
                          height: barsHeight,
                          child: Stack(
                            children: [
                              // Faint full-height track, so short bars still
                              // read against a common baseline.
                              Positioned.fill(
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: theme.textSoft.withValues(
                                      alpha: 0.08,
                                    ),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                ),
                              ),
                              Positioned.fill(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      if (missed > 0)
                                        SizedBox(
                                          height: seg(missed),
                                          width: double.infinity,
                                          child: ColoredBox(
                                            color: AppColors.danger.withValues(
                                              alpha: 0.55,
                                            ),
                                          ),
                                        ),
                                      if (answered > 0)
                                        SizedBox(
                                          height: seg(answered),
                                          width: double.infinity,
                                          child: ColoredBox(
                                            color: AppColors.success.withValues(
                                              alpha: 0.75,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          day?.toString() ?? '',
                          maxLines: 1,
                          style: TextStyle(fontSize: 9, color: theme.textSoft),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _legendDot(
                  AppColors.success.withValues(alpha: 0.75),
                  'Answered',
                ),
                const SizedBox(width: 12),
                _legendDot(AppColors.danger.withValues(alpha: 0.55), 'Missed'),
                const Spacer(),
                Text(
                  'peak $maxTotal',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ],
  );

  Widget _agentDurationCard(List<Map> durationByAgent) {
    return SoftSurface(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ANSWERED CALLS BY AGENT', style: AppText.kicker(context)),
          const SizedBox(height: 12),
          if (durationByAgent.isEmpty)
            Text(
              'No answered calls with duration yet.',
              style: Theme.of(context).textTheme.bodySmall,
            )
          else
            for (var i = 0; i < durationByAgent.length; i++)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  border: i < durationByAgent.length - 1
                      ? Border(
                          bottom: BorderSide(
                            color: AppTheme.of(context).border,
                          ),
                        )
                      : null,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        durationByAgent[i]['name'] as String? ?? 'Unknown',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                    Text(
                      _pluralCalls(durationByAgent[i]['totalCalls']),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if ((durationByAgent[i]['avgDuration'] as num? ?? 0) >
                        0) ...[
                      const SizedBox(width: 6),
                      Text(
                        '${_fmtDuration(durationByAgent[i]['avgDuration'])} avg',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Widget _analyticsSection() {
    if (_analyticsLoading && _analytics == null) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: AppSpinner(size: 28)),
      );
    }
    final allVolumeByDay = (_analytics?['volumeByDay'] as List? ?? [])
        .cast<Map>();
    final volumeByDay = allVolumeByDay.length > 14
        ? allVolumeByDay.sublist(allVolumeByDay.length - 14)
        : allVolumeByDay;
    final durationByAgent = (_analytics?['durationByAgent'] as List? ?? [])
        .cast<Map>();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Column(
        children: [
          _volumeByDayCard(volumeByDay),
          const SizedBox(height: 12),
          _agentDurationCard(durationByAgent),
        ],
      ),
    );
  }

  Widget _statCard(String label, dynamic value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(
              '${value ?? 0}',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: color,
              ),
            ),
            Text(label, style: TextStyle(fontSize: 11, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    final tab = _statusTabs.firstWhere((s) => s.$1 == _statusFilter).$2;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.phone_disabled_rounded,
                color: AppColors.primary,
                size: 28,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'No calls yet',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 6),
            Text(
              _statusFilter == 'all'
                  ? "Make your first call from any lead's profile. Recordings and AI summaries will appear here."
                  : 'No $tab calls found.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => _load(reset: true),
      child: CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverToBoxAdapter(child: _header(auth)),
          if (_loading && _calls.isEmpty)
            const SliverFillRemaining(
              // hasScrollBody: false lets the skeleton size to its content
              // inside the sliver instead of being forced to fill the viewport.
              hasScrollBody: false,
              child: CallListSkeleton(),
            )
          else if (_calls.isEmpty)
            SliverFillRemaining(child: _emptyState())
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) => _callCard(i),
                childCount: _calls.length,
              ),
            ),
        ],
      ),
    );
  }

  /// Title, stat cards, analytics charts, search, status tabs, and the
  /// admin agent filter — scrolls away together with the call list below
  /// it, matching web's single continuously-scrolling page (Calls.jsx).
  Widget _header(AuthState auth) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ENABLEX TELEPHONY', style: AppText.kicker(context)),
                    const SizedBox(height: 2),
                    const Text(
                      'Calls',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton.filledTonal(
                tooltip: 'Refresh calls',
                onPressed: _loading ? null : _refresh,
                icon: _loading
                    ? const Padding(
                        padding: EdgeInsets.all(2),
                        child: AppSpinner(size: 16),
                      )
                    : const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              _statCard('Total Calls', _stats['total'], AppColors.info),
              const SizedBox(width: 8),
              _statCard('Answered', _stats['answered'], AppColors.success),
              const SizedBox(width: 8),
              _statCard('Missed', _stats['missed'], AppColors.danger),
            ],
          ),
        ),
        const SizedBox(height: 4),
        _analyticsSection(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(
              hintText: 'Search lead name or phone…',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
            ),
            onSubmitted: (_) => _load(reset: true),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ..._statusTabs.map(
                  ((String, String) s) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(s.$2),
                      selected: _statusFilter == s.$1,
                      onSelected: (_) {
                        setState(() => _statusFilter = s.$1);
                        _load(reset: true);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (auth.isAdmin && _agents.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: Row(
              children: [
                Icon(
                  Icons.filter_alt_outlined,
                  size: 16,
                  color: AppTheme.of(context).textSoft,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _agentFilter.isEmpty ? '' : _agentFilter,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('All Agents'),
                      ),
                      ..._agents.map(
                        (a) => DropdownMenuItem(
                          value: a['_id'] as String,
                          child: Text(a['name'] as String? ?? ''),
                        ),
                      ),
                    ],
                    onChanged: (v) {
                      setState(() => _agentFilter = v ?? '');
                      _load(reset: true);
                    },
                  ),
                ),
                if (_agentFilter.isNotEmpty)
                  TextButton(
                    onPressed: () {
                      setState(() => _agentFilter = '');
                      _load(reset: true);
                    },
                    child: const Text('Clear'),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _callCard(int i) {
    final row = _calls[i];
    final color = _statusColor(row['lastStatus'] as String?);
    final calling = _callingLeadId == row['leadId'];
    return FadeSlideIn(
      delay: Duration(milliseconds: 20 * (i % 12)),
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: ListTile(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => CallHistoryScreen(
                leadId: row['leadId'] as String,
                leadName: row['leadName'] as String? ?? '—',
                leadPhone: row['leadPhone'] as String?,
              ),
            ),
          ),
          title: Text(
            row['leadName'] as String? ?? '—',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(row['leadPhone'] as String? ?? ''),
              const SizedBox(height: 2),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: color.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      row['lastStatus'] as String? ?? '—',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: color,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  DirectionBadge(
                    direction: row['lastDirection'] as String?,
                    compact: true,
                  ),
                  const SizedBox(width: 8),
                  // Timestamp and duration share one flexible slot. They used
                  // to be two unconstrained Text widgets, so on a card that had
                  // both, the row overran the subtitle box and painted straight
                  // over the trailing call count — release builds show no
                  // overflow stripes, so it just read as garbled text.
                  Expanded(
                    child: Text(
                      [
                        _fmtDate(row['lastCallAt'] as String?),
                        _fmtDuration(row['lastDuration']),
                      ].where((s) => s.isNotEmpty).join('  ·  '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ],
          ),
          trailing: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: calling
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      )
                    : Icon(
                        FontAwesomeIcons.phone.data,
                        color: AppColors.primary,
                      ),
                onPressed: calling ? null : () => _call(row),
              ),
              Text(
                _pluralCalls(row['callCount']),
                maxLines: 1,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
