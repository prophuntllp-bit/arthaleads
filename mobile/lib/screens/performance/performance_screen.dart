import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Performance — GET /auth/performance (admin/manager). Leaderboard of
/// team members by assigned/closed leads. Mirrors the summary cards in
/// frontend/src/pages/Performance.jsx.
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/auth/performance');
      final list = (res.data['performance'] as List? ?? []).cast<Map<String, dynamic>>();
      list.sort((a, b) => ((b['closedWon'] as num?) ?? 0).compareTo((a['closedWon'] as num?) ?? 0));
      setState(() => _members = list);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load performance')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _stat(String label, dynamic value, Color color) {
    return Column(
      children: [
        Text('${value ?? 0}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: color)),
        Text(label, style: const TextStyle(fontSize: 10)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_members.isEmpty) return const Center(child: Text('No team performance data yet'));

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _members.length,
        itemBuilder: (context, i) {
          final m = _members[i];
          final rank = i + 1;
          final rankColor = rank == 1
              ? const Color(0xFFEAB308)
              : rank == 2
                  ? const Color(0xFF9CA3AF)
                  : rank == 3
                      ? const Color(0xFFB45309)
                      : Theme.of(context).disabledColor;
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: rankColor.withValues(alpha: 0.15),
                    child: Text('$rank', style: TextStyle(color: rankColor, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m['name'] as String? ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text(m['role'] as String? ?? '', style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _stat('Leads', m['totalAssigned'], AppColors.info),
                        _stat('Visits', m['siteVisits'], AppColors.warning),
                        _stat('Won', m['closedWon'], AppColors.success),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
