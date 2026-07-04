import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';

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
      _tryGet('/leads/analytics'),
      _tryGet('/leads/hot', {'limit': 5}),
      _tryGet('/leads/followups-due'),
      _tryGet('/attendance/status'),
    ]);
    if (!mounted) return;
    setState(() {
      _analytics = (results[0]?.data['data'] as Map?)?.cast<String, dynamic>();
      _hot = ((results[1]?.data['data'] as List?) ?? []).cast<Map<String, dynamic>>();
      final dueRaw = results[2]?.data['data'];
      _due = dueRaw is List
          ? dueRaw.cast<Map<String, dynamic>>()
          : dueRaw is Map && dueRaw['leads'] is List
              ? (dueRaw['leads'] as List).cast<Map<String, dynamic>>()
              : [];
      _attendance = (results[3]?.data as Map?)?.cast<String, dynamic>();
      _loading = false;
    });
  }

  bool get _clockedIn {
    final att = _attendance;
    if (att == null) return false;
    final data = att['data'];
    if (data is Map) return data['clockedIn'] == true || (data['clockIn'] != null && data['clockOut'] == null);
    return att['clockedIn'] == true;
  }

  Future<void> _clock() async {
    setState(() => _clockBusy = true);
    try {
      await _api.dio.post(_clockedIn ? '/attendance/clockout' : '/attendance/clockin');
      final res = await _api.dio.get('/attendance/status');
      if (mounted) setState(() => _attendance = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Attendance action failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _clockBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final a = _analytics;

    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Hi, ${(auth.user?['name'] as String? ?? '').split(' ').first} 👋',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),

          // ── Clock in/out ──
          Card(
            child: ListTile(
              leading: Icon(
                Icons.fingerprint,
                color: _clockedIn ? AppColors.success : AppColors.primary,
              ),
              title: Text(_clockedIn ? 'Clocked in' : 'Not clocked in'),
              trailing: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _clockedIn ? AppColors.danger : AppColors.success,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onPressed: _clockBusy ? null : _clock,
                child: Text(_clockBusy ? '…' : (_clockedIn ? 'Clock Out' : 'Clock In')),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Stat cards ──
          if (a != null) ...[
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.9,
              children: [
                _stat('Total Leads', '${a['allTimeTotal'] ?? 0}', Icons.people, AppColors.info),
                _stat('Follow-ups Today', '${a['todayFollowUps'] ?? 0}', Icons.alarm, AppColors.warning),
                _stat('Closed Won', '${a['allTimeClosedWon'] ?? 0}', Icons.emoji_events, AppColors.success),
                _stat('Conversion', '${a['conversionRate'] ?? 0}%', Icons.trending_up, AppColors.primary),
                _stat('Pipeline Value', fmtBudget(a['pipelineValue'] as num?), Icons.currency_rupee, const Color(0xFF8B5CF6)),
                _stat('This Month', '${a['thisMonthLeads'] ?? 0}', Icons.calendar_month, const Color(0xFF0D9488)),
              ],
            ),
            const SizedBox(height: 16),

            // ── Status breakdown ──
            Text('Pipeline', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: statusOptions.map((s) {
                    final count = ((a['allTimeByStatus'] as Map?) ?? {})[s] as int? ?? 0;
                    final total = a['allTimeTotal'] as int? ?? 1;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          SizedBox(width: 100, child: Text(s, style: Theme.of(context).textTheme.bodySmall)),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: total > 0 ? count / total : 0,
                                minHeight: 8,
                                backgroundColor: statusColor(s).withValues(alpha: 0.12),
                                color: statusColor(s),
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 40,
                            child: Text('$count', textAlign: TextAlign.end,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Hot leads ──
          if (_hot.isNotEmpty) ...[
            Text('🔥 Hot Today', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ..._hot.map((l) => Card(
                  child: ListTile(
                    dense: true,
                    title: Text(l['name'] as String? ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      l['_nextAction'] as String? ?? l['phone'] as String? ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: StatusChip(l['status'] as String?),
                  ),
                )),
            const SizedBox(height: 16),
          ],

          // ── Follow-ups due ──
          if (_due.isNotEmpty) ...[
            Text('⏰ Follow-ups Due', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ..._due.take(5).map((l) => Card(
                  child: ListTile(
                    dense: true,
                    title: Text(l['name'] as String? ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(l['phone'] as String? ?? ''),
                    trailing: BookingChip(l['booking'] as String?),
                  ),
                )),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _stat(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      value.isEmpty ? '—' : value,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                    ),
                  ),
                  Text(label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 10),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
