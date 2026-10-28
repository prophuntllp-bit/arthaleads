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
import '../../widgets/card_skeleton.dart';
import '../../widgets/app_select.dart';
import '../../widgets/call_options_sheet.dart';
import '../../widgets/chips.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import '../../widgets/whatsapp_send_sheet.dart';
import '../leads/lead_detail_sheet.dart';

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
  String _pipelineType = 'all'; // 'all' | 'leads' | 'projects'
  bool _loading = true;
  DateTime? _lastUpdated;
  // Cards loaded per column (same as the web board); the badge shows the
  // column's real total from the server.
  static const _columnLimit = 300;
  Map<String, int> _columnTotals = {};
  int get _total => _columnTotals.values.fold(0, (a, b) => a + b);
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
      // One request per column. A single "newest 2000" request filled the
      // board with whatever arrived last (imported, status-less project
      // contacts) and left the other columns looking empty.
      final results = await Future.wait(statusOptions.map((status) async {
        final res = await _api.dio.get(
          '/leads/unified',
          queryParameters: {
            'limit': _columnLimit,
            'page': 1,
            'type': _pipelineType,
            'status': status,
            if (_assignedTo.isNotEmpty) 'assignedTo': _assignedTo,
          },
        );
        return (
          status,
          (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>(),
          (res.data['total'] as num?)?.toInt() ?? 0,
        );
      }));
      final seen = <dynamic>{};
      final merged = <Map<String, dynamic>>[];
      for (final (status, leads, _) in results) {
        for (final l in leads) {
          if (seen.add(l['_id'])) merged.add({...l, 'status': status});
        }
      }
      setState(() {
        _leads = merged;
        _columnTotals = {for (final (status, _, total) in results) status: total};
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
    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    await showWhatsAppSendSheet(
      context,
      phone: lead['phone'] as String?,
      name: lead['name'] as String?,
      leadId: lead['_id'] as String?,
      projectId: isProject ? lead['projectId'] as String? : null,
      onSent: () => _markContacted(lead),
    );
  }

  Future<void> _call(Map<String, dynamic> lead) async {
    final phone = lead['phone'] as String?;
    if (phone == null || phone.isEmpty) return;
    final choice = await pickCallMethod(context, name: lead['name'] as String?, phone: phone);
    if (!mounted || choice == null) return;
    if (choice.native) {
      await launchUrl(Uri.parse('tel:${choice.dial(phone)}'));
      _markContacted(lead);
      return;
    }
    try {
      final res = await _api.dio.post('/calls/initiate', data: choice.body(callTargetPayload(lead)));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] as String? ?? 'Call initiated — check your phone.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      _markContacted(lead);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Call failed. Check the phone service in Integrations.')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
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
      setState(() {
        final from = lead['status'] as String?;
        if (from != null) _columnTotals[from] = ((_columnTotals[from] ?? 1) - 1).clamp(0, 1 << 30);
        _columnTotals[nextStatus] = (_columnTotals[nextStatus] ?? 0) + 1;
        lead['status'] = nextStatus;
      });
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

  /// Same as Leads: plain leads are fetched in full first (the board's list
  /// rows leave out Info-tab fields); project leads are complete already.
  Future<void> _openDetail(Map<String, dynamic> lead) async {
    var detail = lead;
    if (lead['_type'] != 'project') {
      try {
        final res = await _api.dio.get('/leads/${lead['_id']}');
        final fresh = (res.data['data'] as Map?)?.cast<String, dynamic>();
        if (fresh != null) detail = {...lead, ...fresh};
      } catch (_) {}
    }
    List<Map<String, dynamic>> projects = [];
    try {
      final res = await _api.dio.get('/projects');
      projects = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {}
    if (!mounted) return;
    await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: detail,
        projects: projects,
        onUpdated: (updated) {
          final i = _leads.indexWhere((l) => l['_id'] == updated['_id']);
          if (i != -1) setState(() => _leads[i] = {..._leads[i], ...updated});
        },
      ),
    );
  }

  Future<void> _showMoveSheet(Map<String, dynamic> lead) async {
    await showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // On a phone the board is where people find a lead, so the card
            // also opens the full lead, not only the stage picker.
            ListTile(
              leading: const Icon(Icons.open_in_new_rounded),
              title: const Text('Open lead details'),
              onTap: () {
                Navigator.pop(ctx);
                _openDetail(lead);
              },
            ),
            const Divider(height: 1),
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

  /// While loading: sample leads spread over the columns, shimmering.
  List<Map<String, dynamic>> get _leadRows => _loading
      ? [
          for (var i = 0; i < 12; i++)
            {...SampleData.lead(i), 'status': statusOptions[i % statusOptions.length]},
        ]
      : _leads;

  @override
  Widget build(BuildContext context) {
    final grouped = <String, List<Map<String, dynamic>>>{
      for (final s in statusOptions)
        s: _leadRows.where((l) => l['status'] == s).toList(),
    };

    return SectionSkeleton(loading: _loading, child: Column(
      children: [
        PageHeader(
          title: 'Sales Pipeline',
          // The "Live" time sits here so both filters get the full row and
          // their labels are not cut off.
          subtitle: [
            '${plural(_total, 'lead')} across ${statusOptions.length} stages',
            if (_lastUpdated != null)
              'Live ${DateFormat('hh:mm a').format(_lastUpdated!)}',
          ].join(' · '),
          icon: Icons.view_kanban_rounded,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: AppSelect<String>(
                  label: 'Pipeline',
                  dense: true,
                  value: _pipelineType,
                  options: const {
                    'all': 'All Pipelines',
                    'leads': 'Leads Pipeline',
                    'projects': 'Project Pipeline',
                  },
                  onChanged: (v) {
                    setState(() => _pipelineType = v ?? 'all');
                    _load();
                  },
                ),
              ),
              if (_agents.isNotEmpty) const SizedBox(width: 8),
              if (_agents.isNotEmpty)
                Expanded(
                  child: AppSelect<String>(
                    label: 'Member',
                    dense: true,
                    value: _assignedTo,
                    options: {
                      '': 'All Members',
                      for (final a in _agents)
                        (a['_id'] as String): (a['name'] as String? ?? ''),
                    },
                    onChanged: (v) {
                      setState(() => _assignedTo = v ?? '');
                      _load();
                    },
                  ),
                )
              else
                const Spacer(),
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
                                '${(_columnTotals[status] ?? 0) > stageLeads.length ? _columnTotals[status] : stageLeads.length}',
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
                                  // `remark` is a fixed Contacted/Not-Contacted
                                  // status, not a note — mirror web's note
                                  // preview (remark1 + remark2 + remarkNote).
                                  final noteText = [
                                    lead['remark1'],
                                    lead['remark2'],
                                    lead['remarkNote'],
                                  ].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
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
                                              if ((lead['projectName']
                                                          as String? ??
                                                      '')
                                                  .isNotEmpty)
                                                Text(
                                                  lead['projectName']
                                                      as String,
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: Color(0xFF8B5CF6),
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
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
                                                    onTap: () => _call(lead),
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
                                                      .isNotEmpty ||
                                                  (lead['source']
                                                              as String? ??
                                                          '')
                                                      .isNotEmpty) ...[
                                                const SizedBox(height: 6),
                                                Wrap(
                                                  spacing: 6,
                                                  runSpacing: 4,
                                                  crossAxisAlignment:
                                                      WrapCrossAlignment
                                                          .center,
                                                  children: [
                                                    if ((lead['priority']
                                                                as String? ??
                                                            '')
                                                        .isNotEmpty)
                                                      PriorityChip(
                                                        lead['priority']
                                                            as String?,
                                                      ),
                                                    if ((lead['source']
                                                                as String? ??
                                                            '')
                                                        .isNotEmpty)
                                                      Text(
                                                        lead['source']
                                                            as String,
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          color: Colors
                                                              .grey
                                                              .shade600,
                                                        ),
                                                      ),
                                                  ],
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
                                              if (noteText.isNotEmpty) ...[
                                                const SizedBox(height: 4),
                                                Text(
                                                  noteText,
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
    ));
  }
}
