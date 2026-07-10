import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

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

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading && _page < _pages) {
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

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _calls.clear();
    }
    setState(() => _loading = true);
    try {
      final futures = <Future>[
        _api.dio.get('/calls', queryParameters: {
          'page': _page,
          'limit': 30,
          if (_searchCtrl.text.trim().isNotEmpty) 'search': _searchCtrl.text.trim(),
        }),
      ];
      if (reset) futures.add(_api.dio.get('/calls/stats'));

      final results = await Future.wait(futures);
      setState(() {
        _calls.addAll((results[0].data['calls'] as List? ?? []).cast<Map<String, dynamic>>());
        _pages = results[0].data['pages'] as int? ?? 1;
        if (results.length > 1) {
          _stats = (results[1].data as Map).cast<String, dynamic>();
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load calls')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _call(Map<String, dynamic> row) async {
    final leadId = row['leadId'] as String?;
    if (leadId == null || _callingLeadId != null) return;
    setState(() => _callingLeadId = leadId);
    try {
      final res = await _api.dio.post('/calls/initiate', data: {'leadId': leadId});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res.data['message'] as String? ?? 'Calling…'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Call failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _callingLeadId = null);
    }
  }

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
    return DateFormat('dd MMM, hh:mm a').format(dt);
  }

  String _fmtDuration(dynamic secs) {
    final s = secs is num ? secs.toInt() : 0;
    if (s <= 0) return '';
    return '${s ~/ 60}m ${s % 60}s';
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
            Text('${value ?? 0}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: color)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              _statCard('Total', _stats['total'], AppColors.info),
              const SizedBox(width: 8),
              _statCard('Answered', _stats['answered'], AppColors.success),
              const SizedBox(width: 8),
              _statCard('Missed', _stats['missed'], AppColors.danger),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(
              hintText: 'Search name or phone…',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
            ),
            onSubmitted: (_) => _load(reset: true),
          ),
        ),
        Expanded(
          child: _loading && _calls.isEmpty
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _calls.isEmpty
                  ? const Center(child: Text('No calls yet'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () => _load(reset: true),
                      child: ListView.builder(
                        controller: _scroll,
                        itemCount: _calls.length,
                        itemBuilder: (context, i) {
                          final row = _calls[i];
                          final color = _statusColor(row['lastStatus'] as String?);
                          final calling = _callingLeadId == row['leadId'];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              title: Text(row['leadName'] as String? ?? '—',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(row['leadPhone'] as String? ?? ''),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: color.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(999),
                                          border: Border.all(color: color.withValues(alpha: 0.35)),
                                        ),
                                        child: Text(
                                          row['lastStatus'] as String? ?? '—',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(_fmtDate(row['lastCallAt'] as String?),
                                          style: Theme.of(context).textTheme.bodySmall),
                                      if (_fmtDuration(row['lastDuration']).isNotEmpty) ...[
                                        const SizedBox(width: 8),
                                        Text(_fmtDuration(row['lastDuration']),
                                            style: Theme.of(context).textTheme.bodySmall),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  IconButton(
                                    icon: calling
                                        ? const SizedBox(
                                            width: 18, height: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                          )
                                        : const Icon(Icons.call, color: AppColors.primary),
                                    onPressed: calling ? null : () => _call(row),
                                  ),
                                  Text('${row['callCount'] ?? 0} calls',
                                      style: Theme.of(context).textTheme.bodySmall),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
