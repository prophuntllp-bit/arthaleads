import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';

/// Pipeline — kanban-style stage view. Reuses GET /leads/unified (same data
/// as Leads/Follow-ups) grouped client-side by status, mirroring
/// frontend/src/pages/LeadPipeline.jsx. Moving a card between stages issues
/// the same PATCH/PUT the web app uses (project lead vs plain lead).
class PipelineScreen extends StatefulWidget {
  const PipelineScreen({super.key});

  @override
  State<PipelineScreen> createState() => _PipelineScreenState();
}

class _PipelineScreenState extends State<PipelineScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _leads = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/leads/unified', queryParameters: {'limit': 2000, 'page': 1});
      setState(() {
        _leads = (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load pipeline')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _moveStage(Map<String, dynamic> lead, String nextStatus) async {
    if (lead['status'] == nextStatus) return;
    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    try {
      if (isProject) {
        await _api.dio.patch('/projects/${lead['projectId']}/leads/${lead['_id']}',
            data: {'status': nextStatus});
      } else {
        await _api.dio.put('/leads/${lead['_id']}', data: {'status': nextStatus});
      }
      setState(() => lead['status'] = nextStatus);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to move lead')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _showMoveSheet(Map<String, dynamic> lead) async {
    await showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Move "${lead['name'] ?? '—'}" to',
                  style: Theme.of(ctx).textTheme.titleMedium),
            ),
            ...statusOptions.map((s) => ListTile(
                  leading: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: statusColor(s)),
                  ),
                  title: Text(s),
                  trailing: lead['status'] == s ? const Icon(Icons.check_rounded, color: AppColors.primary) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    _moveStage(lead, s);
                  },
                )),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final grouped = <String, List<Map<String, dynamic>>>{
      for (final s in statusOptions) s: _leads.where((l) => l['status'] == s).toList(),
    };

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.all(12),
        children: statusOptions.map((status) {
          final stageLeads = grouped[status] ?? [];
          final color = statusColor(status);
          return Container(
            width: 260,
            margin: const EdgeInsets.only(right: 10),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.10),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(status,
                            style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text('${stageLeads.length}',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: stageLeads.isEmpty
                      ? const Center(child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No leads', style: TextStyle(fontSize: 12)),
                        ))
                      : ListView.builder(
                          padding: const EdgeInsets.all(8),
                          itemCount: stageLeads.length,
                          itemBuilder: (context, i) {
                            final lead = stageLeads[i];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(16),
                                onTap: () => _showMoveSheet(lead),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(lead['name'] as String? ?? '—',
                                          style: const TextStyle(fontWeight: FontWeight.w600),
                                          maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              lead['phone'] as String? ?? '',
                                              style: Theme.of(context).textTheme.bodySmall,
                                              maxLines: 1, overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          InkWell(
                                            onTap: () {
                                              final p = lead['phone'] as String?;
                                              if (p != null) launchUrl(Uri.parse('tel:$p'));
                                            },
                                            child: const Icon(Icons.call, size: 16, color: AppColors.primary),
                                          ),
                                        ],
                                      ),
                                      if ((lead['priority'] as String? ?? '').isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        PriorityChip(lead['priority'] as String?),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
