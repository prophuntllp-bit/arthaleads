import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import 'lead_detail_sheet.dart';
import 'lead_filters.dart';
import 'lead_form.dart';

/// Unified Leads list — mirrors frontend/src/pages/Leads.jsx.
/// Rows come from GET /leads/unified and are tagged `_type: lead|project`.
class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => LeadsScreenState();
}

class LeadsScreenState extends State<LeadsScreen> {
  final _api = ApiClient.instance;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();

  final List<Map<String, dynamic>> _leads = [];
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  bool _loading = false;
  bool _initialLoaded = false;

  LeadFilters _filters = const LeadFilters();

  // Multi-select / bulk state
  final Set<String> _selected = {};
  bool get _selectMode => _selected.isNotEmpty;

  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _agents = [];
  List<String> _domains = [];

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _loadMeta();
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

  Future<void> _loadMeta() async {
    final auth = context.read<AuthState>();
    try {
      final res = await _api.dio.get('/projects');
      _projects = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {}
    if (auth.isAdmin) {
      try {
        final res = await _api.dio.get('/auth/agents');
        _agents = (res.data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
      } catch (_) {}
    }
    try {
      final res = await _api.dio.get('/leads/domains');
      _domains = (res.data['domains'] as List? ?? []).cast<String>();
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _leads.clear();
      _selected.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/leads/unified', queryParameters: {
        'page': _page,
        'limit': 25,
        if (_searchCtrl.text.trim().isNotEmpty) 'search': _searchCtrl.text.trim(),
        ..._filters.toParams(),
      });
      final rows = (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>();
      setState(() {
        _leads.addAll(rows);
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Failed to load leads'), error: true);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _initialLoaded = true;
        });
      }
    }
  }

  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppColors.danger : null,
    ));
  }

  void _upsertRow(Map<String, dynamic> updated) {
    final i = _leads.indexWhere((l) => l['_id'] == updated['_id']);
    if (i != -1) {
      setState(() => _leads[i] = {..._leads[i], ...updated});
    }
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  /// Bulk endpoints for assign/status/delete only operate on plain Lead docs —
  /// project rows are excluded, same as the web app's splitBulkSelection().
  ({List<String> plainIds, int skipped}) _splitSelection() {
    final plain = _selected.where((id) {
      final l = _leads.where((l) => l['_id'] == id).firstOrNull;
      return l != null && l['_type'] != 'project';
    }).toList();
    return (plainIds: plain, skipped: _selected.length - plain.length);
  }

  Future<void> _bulkAssign() async {
    final agentId = await _pickFromList(
      title: 'Assign to agent',
      options: _agents.map((a) => (a['_id'] as String, a['name'] as String? ?? '')).toList(),
    );
    if (agentId == null) return;
    final sel = _splitSelection();
    try {
      if (sel.plainIds.isNotEmpty) {
        final r = await _api.dio.post('/leads/bulk-assign',
            data: {'ids': sel.plainIds, 'agentId': agentId});
        _snack(r.data['message'] as String? ?? 'Assigned');
      }
      if (sel.skipped > 0) _snack('${sel.skipped} project lead(s) skipped', error: true);
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Bulk assign failed'), error: true);
    }
  }

  Future<void> _bulkStatus() async {
    final status = await _pickFromList(
      title: 'Set status',
      options: statusOptions.map((s) => (s, s)).toList(),
    );
    if (status == null) return;
    final sel = _splitSelection();
    try {
      if (sel.plainIds.isNotEmpty) {
        final r = await _api.dio.patch('/leads/bulk-status',
            data: {'ids': sel.plainIds, 'status': status});
        _snack(r.data['message'] as String? ?? 'Updated');
      }
      if (sel.skipped > 0) _snack('${sel.skipped} project lead(s) skipped', error: true);
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Bulk status update failed'), error: true);
    }
  }

  Future<void> _bulkTransfer() async {
    final projectId = await _pickFromList(
      title: 'Transfer to project',
      options: _projects.map((p) => (p['_id'] as String, p['name'] as String? ?? '')).toList(),
    );
    if (projectId == null) return;
    try {
      final r = await _api.dio.post('/leads/bulk-transfer',
          data: {'ids': _selected.toList(), 'toProjectId': projectId});
      _snack(r.data['message'] as String? ?? 'Transferred');
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Bulk transfer failed'), error: true);
    }
  }

  Future<void> _bulkDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Move to Dump?'),
        content: Text('${_selected.length} lead(s) will be moved to the Dump.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Move', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final sel = _splitSelection();
    try {
      if (sel.plainIds.isNotEmpty) {
        await _api.dio.delete('/leads/bulk', data: {'ids': sel.plainIds});
        _snack('${sel.plainIds.length} lead(s) moved to Dump');
      }
      if (sel.skipped > 0) _snack('${sel.skipped} project lead(s) skipped', error: true);
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Move to Dump failed'), error: true);
    }
  }

  Future<String?> _pickFromList({
    required String title,
    required List<(String, String)> options,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: options
                    .map((o) => ListTile(
                          title: Text(o.$2),
                          onTap: () => Navigator.pop(ctx, o.$1),
                        ))
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Row actions ─────────────────────────────────────────────────────────────

  Future<void> _call(Map<String, dynamic> lead) async {
    final phone = lead['phone'] as String?;
    if (phone == null || phone.isEmpty) return;
    await launchUrl(Uri.parse('tel:$phone'));
    _markContacted(lead);
  }

  Future<void> _whatsapp(Map<String, dynamic> lead) async {
    final phone = (lead['phone'] as String? ?? '').replaceAll(RegExp(r'\D'), '');
    if (phone.isEmpty) return;
    final wa = phone.length == 10 ? '91$phone' : phone;
    await launchUrl(Uri.parse('https://wa.me/$wa'), mode: LaunchMode.externalApplication);
    _markContacted(lead);
  }

  /// Auto-mark as Contacted on call/WhatsApp — mirrors handleContact() on the web.
  Future<void> _markContacted(Map<String, dynamic> lead) async {
    if (lead['remark'] == 'Contacted' && lead['status'] != 'New') return;
    final updates = {
      'remark': 'Contacted',
      if (lead['status'] == 'New') 'status': 'Contacted',
    };
    try {
      final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
      final res = isProject
          ? await _api.dio.patch('/projects/${lead['projectId']}/leads/${lead['_id']}', data: updates)
          : await _api.dio.put('/leads/${lead['_id']}', data: updates);
      _upsertRow({...lead, ...updates, ...(res.data['data'] as Map? ?? {}).cast<String, dynamic>()});
    } catch (_) {/* silent — the call/chat still happened */}
  }

  Future<void> _openDetail(Map<String, dynamic> lead) async {
    final result = await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: lead,
        projects: _projects,
        onUpdated: _upsertRow,
      ),
    );
    if (result == 'edit') {
      await _openForm(lead: lead);
    } else if (result == true) {
      _load(reset: true);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? lead}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => LeadFormScreen(lead: lead, agents: _agents)),
    );
    if (saved == true) _load(reset: true);
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      floatingActionButton: _selectMode
          ? null
          : FloatingActionButton(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              onPressed: () => _openForm(),
              child: const Icon(Icons.add),
            ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Search name, phone…',
                      prefixIcon: Icon(Icons.search, size: 20),
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(reset: true),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  onPressed: () async {
                    final f = await showModalBottomSheet<LeadFilters>(
                      context: context,
                      isScrollControlled: true,
                      showDragHandle: true,
                      builder: (_) => LeadFiltersSheet(
                        current: _filters,
                        projects: _projects,
                        agents: _agents,
                        domains: _domains,
                        isAdmin: auth.isAdmin,
                      ),
                    );
                    if (f != null) {
                      _filters = f;
                      _load(reset: true);
                    }
                  },
                  icon: Badge(
                    isLabelVisible: _filters.activeCount > 0,
                    label: Text('${_filters.activeCount}'),
                    child: const Icon(Icons.filter_list),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text('$_total leads', style: Theme.of(context).textTheme.bodySmall),
                const Spacer(),
                if (_selectMode)
                  TextButton(
                    onPressed: () => setState(() => _selected.clear()),
                    child: Text('Clear (${_selected.length})'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: !_initialLoaded
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _leads.isEmpty
                    ? const Center(child: Text('No leads found'))
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () => _load(reset: true),
                        child: ListView.builder(
                          controller: _scroll,
                          padding: EdgeInsets.only(bottom: _selectMode ? 140 : 88),
                          itemCount: _leads.length + (_loading ? 1 : 0),
                          itemBuilder: (context, i) {
                            if (i >= _leads.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(
                                  child: SizedBox(
                                    width: 22, height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                  ),
                                ),
                              );
                            }
                            return _leadCard(_leads[i]);
                          },
                        ),
                      ),
          ),
        ],
      ),
      bottomSheet: _selectMode ? _bulkBar(auth) : null,
    );
  }

  Widget _leadCard(Map<String, dynamic> lead) {
    final id = lead['_id'] as String;
    final selected = _selected.contains(id);
    final followUp = lead['followUpDate'] as String?;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _selectMode
            ? () => setState(() => selected ? _selected.remove(id) : _selected.add(id))
            : () => _openDetail(lead),
        onLongPress: () => setState(() => selected ? _selected.remove(id) : _selected.add(id)),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (_selectMode) ...[
                    Icon(
                      selected ? Icons.check_circle : Icons.radio_button_unchecked,
                      color: selected ? AppColors.primary : Theme.of(context).disabledColor,
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      lead['name'] as String? ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  StatusChip(lead['status'] as String?),
                  const SizedBox(width: 4),
                  PriorityChip(lead['priority'] as String?),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.phone, size: 13, color: Theme.of(context).textTheme.bodySmall?.color),
                  const SizedBox(width: 4),
                  Text(lead['phone'] as String? ?? '', style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(width: 12),
                  if (lead['projectName'] != null && (lead['projectName'] as String).isNotEmpty) ...[
                    Icon(Icons.folder, size: 13, color: AppColors.primary.withValues(alpha: 0.8)),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        lead['projectName'] as String,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.primary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ] else if (lead['source'] != null) ...[
                    Icon(Icons.language, size: 13, color: Theme.of(context).textTheme.bodySmall?.color),
                    const SizedBox(width: 4),
                    Text(lead['source'] as String, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  BookingChip(lead['booking'] as String?),
                  if (followUp != null) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.alarm, size: 13, color: Theme.of(context).textTheme.bodySmall?.color),
                    const SizedBox(width: 2),
                    Text(
                      followUp.length >= 10 ? followUp.substring(0, 10) : followUp,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if ((lead['assignedToName'] as String? ?? '').isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.person, size: 13, color: Theme.of(context).textTheme.bodySmall?.color),
                    const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        lead['assignedToName'] as String,
                        style: Theme.of(context).textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  const Spacer(),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.call, size: 19, color: AppColors.primary),
                    onPressed: () => _call(lead),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.chat, size: 19, color: AppColors.whatsapp),
                    onPressed: () => _whatsapp(lead),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bulkBar(AuthState auth) {
    return Container(
      padding: EdgeInsets.only(
        left: 8, right: 8, top: 8,
        bottom: 8 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        border: Border(top: BorderSide(color: Theme.of(context).dividerTheme.color ?? Colors.transparent)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            if (auth.isAdmin) ...[
              _bulkBtn(Icons.person_add, 'Assign', AppColors.primary, _bulkAssign),
              _bulkBtn(Icons.flag, 'Status', AppColors.info, _bulkStatus),
              _bulkBtn(Icons.drive_file_move, 'Transfer', const Color(0xFF3B82F6), _bulkTransfer),
            ],
            _bulkBtn(Icons.delete, 'Delete', AppColors.danger, _bulkDelete),
          ],
        ),
      ),
    );
  }

  Widget _bulkBtn(IconData icon, String label, Color color, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ),
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label, style: const TextStyle(fontSize: 12)),
      ),
    );
  }
}
