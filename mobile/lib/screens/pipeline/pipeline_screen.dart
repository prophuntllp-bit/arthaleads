import 'dart:async';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';

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
  List<Map<String, dynamic>> _agents = [];
  String _assignedTo = '';
  bool _loading = true;
  DateTime? _lastUpdated;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _loadAgents();
    _timer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _load(silent: true),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadAgents() async {
    if (!context.read<AuthState>().isAdmin) return;
    try {
      final res = await _api.dio.get('/auth/agents');
      setState(
        () => _agents = (res.data['agents'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
    } catch (_) {}
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await _api.dio.get(
        '/leads/unified',
        queryParameters: {
          'limit': 2000,
          'page': 1,
          if (_assignedTo.isNotEmpty) 'assignedTo': _assignedTo,
        },
      );
      setState(() {
        _leads = (res.data['leads'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        _lastUpdated = DateTime.now();
      });
    } catch (e) {
      if (mounted && !silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load pipeline')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _whatsapp(Map<String, dynamic> lead) async {
    final phone = (lead['phone'] as String? ?? '').replaceAll(
      RegExp(r'\D'),
      '',
    );
    if (phone.isEmpty) return;
    final wa = phone.length == 10 ? '91$phone' : phone;
    await launchUrl(
      Uri.parse('https://wa.me/$wa'),
      mode: LaunchMode.externalApplication,
    );
    _markContacted(lead);
  }

  Future<void> _markContacted(Map<String, dynamic> lead) async {
    if (lead['remark'] == 'Contacted' && lead['status'] != 'New') return;
    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    final updates = {
      'remark': 'Contacted',
      if (lead['status'] == 'New') 'status': 'Contacted',
    };
    try {
      if (isProject) {
        await _api.dio.patch(
          '/projects/${lead['projectId']}/leads/${lead['_id']}',
          data: updates,
        );
      } else {
        await _api.dio.put('/leads/${lead['_id']}', data: updates);
      }
      setState(() => lead.addAll(updates));
    } catch (_) {
      /* silent — the WhatsApp chat still opened */
    }
  }

  Future<void> _moveStage(Map<String, dynamic> lead, String nextStatus) async {
    if (lead['status'] == nextStatus) return;
    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    try {
      if (isProject) {
        await _api.dio.patch(
          '/projects/${lead['projectId']}/leads/${lead['_id']}',
          data: {'status': nextStatus},
        );
      } else {
        await _api.dio.put(
          '/leads/${lead['_id']}',
          data: {'status': nextStatus},
        );
      }
      setState(() => lead['status'] = nextStatus);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to move lead')),
            backgroundColor: AppColors.danger,
          ),
        );
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
              child: Text(
                'Move "${lead['name'] ?? '—'}" to',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
            ),
            ...statusOptions.map(
              (s) => ListTile(
                leading: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: statusColor(s),
                  ),
                ),
                title: Text(s),
                trailing: lead['status'] == s
                    ? const Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  _moveStage(lead, s);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: AppSpinner(size: 32));
    }

    final grouped = <String, List<Map<String, dynamic>>>{
      for (final s in statusOptions)
        s: _leads.where((l) => l['status'] == s).toList(),
    };

    return Column(
      children: [
        PageHeader(
          title: 'Sales Pipeline',
          subtitle:
              '${_leads.length} leads across ${statusOptions.length} stages',
          icon: Icons.view_kanban_rounded,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              if (_agents.isNotEmpty)
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _assignedTo,
                    decoration: const InputDecoration(
                      labelText: 'Member',
                      isDense: true,
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('All Members'),
                      ),
                      ..._agents.map(
                        (a) => DropdownMenuItem(
                          value: a['_id'] as String,
                          child: Text(
                            a['name'] as String? ?? '',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) {
                      setState(() => _assignedTo = v ?? '');
                      _load();
                    },
                  ),
                )
              else
                const Spacer(),
              const SizedBox(width: 8),
              if (_lastUpdated != null)
                Text(
                  'Live · ${DateFormat('hh:mm a').format(_lastUpdated!)}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.success),
                ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
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
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.10),
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: color,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${stageLeads.length}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: color,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: stageLeads.isEmpty
                            ? const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text(
                                    'No leads',
                                    style: TextStyle(fontSize: 12),
                                  ),
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(8),
                                itemCount: stageLeads.length,
                                itemBuilder: (context, i) {
                                  final lead = stageLeads[i];
                                  return FadeSlideIn(
                                    delay: Duration(
                                      milliseconds: 20 * (i % 10),
                                    ),
                                    child: Card(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(16),
                                        onTap: () => _showMoveSheet(lead),
                                        child: Padding(
                                          padding: const EdgeInsets.all(10),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                lead['name'] as String? ?? '—',
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      lead['phone']
                                                              as String? ??
                                                          '',
                                                      style: Theme.of(
                                                        context,
                                                      ).textTheme.bodySmall,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                  InkWell(
                                                    onTap: () {
                                                      final p =
                                                          lead['phone']
                                                              as String?;
                                                      if (p != null) {
                                                        launchUrl(
                                                          Uri.parse('tel:$p'),
                                                        );
                                                      }
                                                    },
                                                    child: Icon(
                                                      FontAwesomeIcons
                                                          .phone
                                                          .data,
                                                      size: 16,
                                                      color: AppColors.primary,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  InkWell(
                                                    onTap: () =>
                                                        _whatsapp(lead),
                                                    child: Icon(
                                                      FontAwesomeIcons
                                                          .whatsapp
                                                          .data,
                                                      size: 16,
                                                      color: AppColors.whatsapp,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              if ((lead['priority']
                                                          as String? ??
                                                      '')
                                                  .isNotEmpty) ...[
                                                const SizedBox(height: 6),
                                                PriorityChip(
                                                  lead['priority'] as String?,
                                                ),
                                              ],
                                              if (((lead['followUpDate'] ??
                                                              lead['followUp'])
                                                          as String? ??
                                                      '')
                                                  .isNotEmpty) ...[
                                                const SizedBox(height: 6),
                                                Row(
                                                  children: [
                                                    const Icon(
                                                      Icons.alarm,
                                                      size: 12,
                                                      color: AppColors.info,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Expanded(
                                                      child: Text(
                                                        DateFormat(
                                                          'dd MMM, hh:mm a',
                                                        ).format(
                                                          DateTime.parse(
                                                            (lead['followUpDate'] ??
                                                                    lead['followUp'])
                                                                as String,
                                                          ).toLocal(),
                                                        ),
                                                        style: const TextStyle(
                                                          fontSize: 11,
                                                        ),
                                                        maxLines: 1,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                              if ((lead['remark'] as String? ??
                                                          '')
                                                      .isNotEmpty ||
                                                  (lead['remark1'] as String? ??
                                                          '')
                                                      .isNotEmpty) ...[
                                                const SizedBox(height: 4),
                                                Text(
                                                  (lead['remark'] as String? ??
                                                              '')
                                                          .isNotEmpty
                                                      ? lead['remark'] as String
                                                      : lead['remark1']
                                                            as String,
                                                  style: Theme.of(context)
                                                      .textTheme
                                                      .bodySmall
                                                      ?.copyWith(fontSize: 11),
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ],
                                          ),
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
          ),
        ),
      ],
    );
  }
}
