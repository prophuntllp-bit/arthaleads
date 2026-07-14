import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Performance — GET /auth/performance (admin/manager). Leaderboard of
/// team members with dual Main Pipeline / Project Pipeline breakdown.
/// Mirrors frontend/src/pages/Performance.jsx.
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  bool _refreshing = false;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  String _filterMemberId = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<Map<String, dynamic>> get _displayMembers => _filterMemberId.isEmpty
      ? _members
      : _members.where((m) => m['_id'] == _filterMemberId).toList();

  Future<void> _load({bool isRefresh = false}) async {
    setState(() => isRefresh ? _refreshing = true : _loading = true);
    try {
      final params = <String, dynamic>{};
      if (_dateFrom != null) params['dateFrom'] = _dateFrom!.toIso8601String();
      if (_dateTo != null) params['dateTo'] = _dateTo!.toIso8601String();
      final res = await _api.dio.get('/auth/performance', queryParameters: params);
      final list = (res.data['performance'] as List? ?? []).cast<Map<String, dynamic>>();
      list.sort((a, b) => ((b['closedWon'] as num?) ?? 0).compareTo((a['closedWon'] as num?) ?? 0));
      if (mounted) setState(() => _members = list);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load performance')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _dateFrom : _dateTo) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => isFrom ? _dateFrom = picked : _dateTo = picked);
    _load(isRefresh: true);
  }

  void _clearDates() {
    setState(() {
      _dateFrom = null;
      _dateTo = null;
    });
    _load(isRefresh: true);
  }

  String _fmtDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  Widget _smallTile(String label, dynamic value, {bool highlight = false, String? note}) {
    final isNum = value is num;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 3),
          Text(
            isNum ? '$value' : (value?.toString() ?? '-'),
            style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w800,
              color: highlight && value is num && value > 0 ? AppColors.success : null,
            ),
            maxLines: 1, overflow: TextOverflow.ellipsis,
          ),
          if (note != null) Text(note, style: const TextStyle(fontSize: 8, color: Color(0xFF14B8A6), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _progressRow(String label, num pct, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(fontSize: 10)),
            const Spacer(),
            Text('$pct%', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
        const SizedBox(height: 3),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: (pct.clamp(0, 100)) / 100,
            minHeight: 5,
            backgroundColor: color.withValues(alpha: 0.12),
            color: color,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_members.isEmpty) return const Center(child: Text('No team performance data yet'));

    final members = _displayMembers;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => _load(isRefresh: true),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          // ── Filters ──
          if (_members.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                height: 34,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    ChoiceChip(
                      label: const Text('All Members', style: TextStyle(fontSize: 11)),
                      selected: _filterMemberId.isEmpty,
                      onSelected: (_) => setState(() => _filterMemberId = ''),
                    ),
                    const SizedBox(width: 6),
                    ..._members.map((m) => Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(m['name'] as String? ?? '—', style: const TextStyle(fontSize: 11)),
                            selected: _filterMemberId == m['_id'],
                            onSelected: (_) => setState(() => _filterMemberId = m['_id'] as String? ?? ''),
                          ),
                        )),
                  ],
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today, size: 13),
                  label: Text(_dateFrom != null ? _fmtDate(_dateFrom!) : 'From', style: const TextStyle(fontSize: 11)),
                  onPressed: () => _pickDate(isFrom: true),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today, size: 13),
                  label: Text(_dateTo != null ? _fmtDate(_dateTo!) : 'To', style: const TextStyle(fontSize: 11)),
                  onPressed: () => _pickDate(isFrom: false),
                ),
              ),
              if (_dateFrom != null || _dateTo != null)
                IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: _clearDates),
              if (_refreshing) const Padding(
                padding: EdgeInsets.only(left: 4),
                child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (members.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No data for this agent.')),
            ),

          for (final m in members) ..._memberCard(m),
        ],
      ),
    );
  }

  List<Widget> _memberCard(Map<String, dynamic> m) {
    final pipeline = (m['pipeline'] as Map?)?.cast<String, dynamic>() ?? {};
    final project = (m['project'] as Map?)?.cast<String, dynamic>() ?? {};
    final hasPipeline = ((pipeline['totalAssigned'] as num?) ?? 0) > 0;
    final hasProject = ((project['totalAssigned'] as num?) ?? 0) > 0;

    return [
      Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Name/role header
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text((m['name'] as String? ?? '?')[0].toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m['name'] as String? ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text(m['email'] as String? ?? '',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(m['role'] as String? ?? '',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                      const SizedBox(height: 4),
                      Text(m['isActive'] == false ? 'Inactive' : 'Active', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Main Pipeline
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: const BoxDecoration(
                        color: Color(0x11FF6B00),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.view_list, size: 14, color: AppColors.primary),
                          const SizedBox(width: 6),
                          const Text('Main Pipeline', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          const Spacer(),
                          Text('${pipeline['totalAssigned'] ?? 0} leads', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 6,
                        crossAxisSpacing: 6,
                        childAspectRatio: 1.7,
                        children: [
                          _smallTile('Assigned', pipeline['totalAssigned'] ?? 0),
                          _smallTile('New', pipeline['newLeads'] ?? 0),
                          _smallTile('Site Visit', pipeline['siteVisits'] ?? 0),
                          _smallTile('Closed Won', pipeline['closedWon'] ?? 0, highlight: true),
                          _smallTile('Avg Response', pipeline['avgResponseTime'] ?? '—'),
                        ],
                      ),
                    ),
                    if (hasPipeline)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                        child: _progressRow('Conversion Rate', (pipeline['conversionRate'] as num?) ?? 0, AppColors.primary),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Project Pipeline
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: const BoxDecoration(color: Color(0x116366F1)),
                      child: Row(
                        children: [
                          const Icon(Icons.folder_copy, size: 14, color: Color(0xFF6366F1)),
                          const SizedBox(width: 6),
                          const Text('Project Pipeline', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          const Spacer(),
                          Text('${project['totalAssigned'] ?? 0} leads', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        children: [
                          GridView.count(
                            crossAxisCount: 4,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            mainAxisSpacing: 6,
                            crossAxisSpacing: 6,
                            childAspectRatio: 1.1,
                            children: [
                              _smallTile('Assigned', project['totalAssigned'] ?? 0),
                              _smallTile('Interested', project['interested'] ?? 0),
                              _smallTile('Site Visit', project['siteVisits'] ?? 0,
                                  note: ((project['siteVisitDone'] as num?) ?? 0) > 0 ? '${project['siteVisitDone']} done' : null),
                              _smallTile('Booked', project['booked'] ?? 0, highlight: true),
                            ],
                          ),
                          const SizedBox(height: 6),
                          GridView.count(
                            crossAxisCount: 3,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            mainAxisSpacing: 6,
                            crossAxisSpacing: 6,
                            childAspectRatio: 1.7,
                            children: [
                              _smallTile('Call Back', project['callBack'] ?? 0),
                              _smallTile('Not Interested', project['notInterested'] ?? 0),
                              _smallTile('Not Reachable', project['notReachable'] ?? 0),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (hasProject)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                        child: _progressRow('Booking Rate', (project['conversionRate'] as num?) ?? 0, const Color(0xFF6366F1)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ];
  }
}
