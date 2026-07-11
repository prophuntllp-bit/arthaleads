import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';

/// Dump Leads — GET /leads/dump (deleted/lost pipeline leads + "Not
/// Interested" project leads, merged). Restore/permanent-delete only apply
/// to plain leads (_type: "lead") — project leads here are booking-status
/// flagged, not actually deleted, so the backend has no restore/delete for
/// them (mirrors frontend/src/pages/DumpLeads.jsx).
class DumpScreen extends StatefulWidget {
  const DumpScreen({super.key});

  @override
  State<DumpScreen> createState() => _DumpScreenState();
}

class _DumpScreenState extends State<DumpScreen> {
  final _api = ApiClient.instance;
  final List<Map<String, dynamic>> _leads = [];
  int _page = 1;
  int _pages = 1;
  int _total = 0;
  bool _loading = true;
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
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _leads.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/leads/dump', queryParameters: {'page': _page, 'limit': 30});
      setState(() {
        _leads.addAll((res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>());
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load dump leads')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _restore(Map<String, dynamic> lead) async {
    try {
      await _api.dio.patch('/leads/${lead['_id']}/restore');
      setState(() => _leads.remove(lead));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${lead['name']} restored to pipeline'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Restore failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _deleteForever(Map<String, dynamic> lead) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete permanently?'),
        content: Text('"${lead['name']}" will be permanently deleted. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/leads/${lead['_id']}/permanent');
      setState(() => _leads.remove(lead));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Delete failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '—';
    return DateFormat('dd MMM yyyy').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text('$_total dump leads', style: Theme.of(context).textTheme.bodySmall),
          ),
        ),
        Expanded(
          child: _loading && _leads.isEmpty
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _leads.isEmpty
                  ? const Center(child: Text('Dump is empty'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () => _load(reset: true),
                      child: ListView.builder(
                        controller: _scroll,
                        itemCount: _leads.length,
                        itemBuilder: (context, i) {
                          final lead = _leads[i];
                          final isPlainLead = lead['_type'] == 'lead';
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              title: Text(lead['name'] as String? ?? '—',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(lead['phone'] as String? ?? ''),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      if ((lead['status'] as String? ?? '').isNotEmpty)
                                        StatusChip(lead['status'] as String?),
                                      if ((lead['booking'] as String? ?? '').isNotEmpty) ...[
                                        const SizedBox(width: 6),
                                        BookingChip(lead['booking'] as String?),
                                      ],
                                      const Spacer(),
                                      Text(_fmtDate(lead['updatedAt'] as String? ?? lead['createdAt'] as String?),
                                          style: Theme.of(context).textTheme.bodySmall),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: isPlainLead
                                  ? Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.restore_rounded, color: AppColors.success, size: 20),
                                          tooltip: 'Restore',
                                          onPressed: () => _restore(lead),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_forever_rounded, color: AppColors.danger, size: 20),
                                          tooltip: 'Delete permanently',
                                          onPressed: () => _deleteForever(lead),
                                        ),
                                      ],
                                    )
                                  : null,
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
