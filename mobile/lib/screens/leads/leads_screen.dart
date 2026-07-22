import 'dart:convert';
import 'dart:typed_data';

import 'package:csv/csv.dart';
import 'package:excel/excel.dart' as xlsx;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/deep_link.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/chips.dart';
import '../../widgets/motion.dart';
import '../../widgets/qr_sheet.dart';
import 'lead_detail_sheet.dart';
import 'lead_filters.dart';
import 'lead_form.dart';
import 'lead_import.dart';
import 'wa_broadcast_sheet.dart';

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
  bool _importing = false;
  bool _exporting = false;

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
    DeepLink.openLeadId.addListener(_handleDeepLink);
    if (DeepLink.openLeadId.value != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _handleDeepLink());
    }
  }

  @override
  void dispose() {
    DeepLink.openLeadId.removeListener(_handleDeepLink);
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  /// Dashboard (and eventually push notifications) can ask this tab to open
  /// a specific lead's detail sheet once it's visible — see core/deep_link.dart.
  /// _openDetail does its own full-lead fetch, so this just hands off the id.
  void _handleDeepLink() {
    final id = DeepLink.openLeadId.value;
    if (id == null) return;
    DeepLink.openLeadId.value = null;
    _openDetail({'_id': id});
  }

  Future<void> _loadMeta() async {
    final auth = context.read<AuthState>();
    try {
      final res = await _api.dio.get('/projects');
      _projects = (res.data['data'] as List? ?? [])
          .cast<Map<String, dynamic>>();
    } catch (_) {}
    if (auth.isAdmin) {
      try {
        final res = await _api.dio.get('/auth/agents');
        _agents = (res.data['agents'] as List? ?? [])
            .cast<Map<String, dynamic>>();
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
      final res = await _api.dio.get(
        '/leads/unified',
        queryParameters: {
          'page': _page,
          'limit': 25,
          if (_searchCtrl.text.trim().isNotEmpty)
            'search': _searchCtrl.text.trim(),
          ..._filters.toParams(),
        },
      );
      final rows = (res.data['leads'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      setState(() {
        _leads.addAll(rows);
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) {
        _snack(ApiClient.errorMessage(e, 'Failed to load leads'), error: true);
      }
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : null,
      ),
    );
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
      options: _agents
          .map((a) => (a['_id'] as String, a['name'] as String? ?? ''))
          .toList(),
    );
    if (agentId == null) return;
    final sel = _splitSelection();
    try {
      if (sel.plainIds.isNotEmpty) {
        final r = await _api.dio.post(
          '/leads/bulk-assign',
          data: {'ids': sel.plainIds, 'agentId': agentId},
        );
        _snack(r.data['message'] as String? ?? 'Assigned');
      }
      if (sel.skipped > 0) {
        _snack('${sel.skipped} project lead(s) skipped', error: true);
      }
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
        final r = await _api.dio.patch(
          '/leads/bulk-status',
          data: {'ids': sel.plainIds, 'status': status},
        );
        _snack(r.data['message'] as String? ?? 'Updated');
      }
      if (sel.skipped > 0) {
        _snack('${sel.skipped} project lead(s) skipped', error: true);
      }
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(
        ApiClient.errorMessage(e, 'Bulk status update failed'),
        error: true,
      );
    }
  }

  Future<void> _bulkTransfer() async {
    final projectId = await _pickFromList(
      title: 'Transfer to project',
      options: _projects
          .map((p) => (p['_id'] as String, p['name'] as String? ?? ''))
          .toList(),
    );
    if (projectId == null) return;
    try {
      final r = await _api.dio.post(
        '/leads/bulk-transfer',
        data: {'ids': _selected.toList(), 'toProjectId': projectId},
      );
      _snack(r.data['message'] as String? ?? 'Transferred');
      setState(() => _selected.clear());
      _load(reset: true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Bulk transfer failed'), error: true);
    }
  }

  void _bulkWhatsApp() {
    final list = _leads
        .where((l) => _selected.contains(l['_id']) && (l['phone'] as String? ?? '').isNotEmpty)
        .toList();
    if (list.isEmpty) {
      _snack('No selected leads have a phone number', error: true);
      return;
    }
    showWaBroadcastSheet(context, list);
  }

  Future<void> _bulkDelete() async {
    // super_admin permanently hard-deletes leads — everyone else soft-deletes
    // to Dump. Matches web's ConfirmDialog exactly.
    final isSuperAdmin = context.read<AuthState>().role == 'super_admin';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isSuperAdmin ? 'Delete leads?' : 'Move to Dump?'),
        content: Text(
          isSuperAdmin
              ? '${_selected.length} lead(s) will be permanently deleted. This cannot be undone.'
              : '${_selected.length} lead(s) will be moved to the Dump.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              isSuperAdmin ? 'Delete' : 'Move',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final sel = _splitSelection();
    try {
      if (sel.plainIds.isNotEmpty) {
        await _api.dio.delete('/leads/bulk', data: {'ids': sel.plainIds});
        _snack(
          '${sel.plainIds.length} lead(s) ${isSuperAdmin ? 'deleted' : 'moved to Dump'}',
        );
      }
      if (sel.skipped > 0) {
        _snack('${sel.skipped} project lead(s) skipped', error: true);
      }
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
                    .map(
                      (o) => ListTile(
                        title: Text(o.$2),
                        onTap: () => Navigator.pop(ctx, o.$1),
                      ),
                    )
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
          ? await _api.dio.patch(
              '/projects/${lead['projectId']}/leads/${lead['_id']}',
              data: updates,
            )
          : await _api.dio.put('/leads/${lead['_id']}', data: updates);
      _upsertRow({
        ...lead,
        ...updates,
        ...(res.data['data'] as Map? ?? {}).cast<String, dynamic>(),
      });
    } catch (_) {
      /* silent — the call/chat still happened */
    }
  }

  Future<void> _openDetail(Map<String, dynamic> lead) async {
    // /leads/unified's list projection is deliberately narrow (perf) and
    // omits several Info-tab-only fields (propertyType, bhk, purpose,
    // preferredLocation, streetAddress, city, followUpNote, remarkNote,
    // formResponses) — fetch the full doc before opening so those aren't
    // silently blank. Project-lead rows are already complete, skip the fetch.
    var detail = lead;
    if (lead['_type'] != 'project') {
      try {
        final res = await _api.dio.get('/leads/${lead['_id']}');
        final fresh = (res.data['data'] as Map?)?.cast<String, dynamic>();
        if (fresh != null) detail = {...lead, ...fresh};
      } catch (e) {
        // A deep-linked open only ever has {'_id': id} — with no fetch and
        // no list-row data to fall back on, there's nothing worth showing.
        if (lead['name'] == null) {
          if (mounted) {
            _snack(ApiClient.errorMessage(e, 'Could not open lead'), error: true);
          }
          return;
        }
        // Otherwise this came from a list-row tap — fall back to that data
        // rather than blocking the sheet over a transient network error.
      }
    }
    if (!mounted) return;
    final result = await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: detail,
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
      MaterialPageRoute(
        builder: (_) => LeadFormScreen(lead: lead, agents: _agents),
      ),
    );
    if (saved == true) _load(reset: true);
  }

  static const _exportHeader = [
    'Name',
    'Phone',
    'Email',
    'Source',
    'Lead Source',
    'Status',
    'Priority',
    'Property Type',
    'BHK',
    'Purpose',
    'Budget Min',
    'Budget Max',
    'Follow Up',
    'Follow Up 2',
    'Follow Up Note',
    'Remark',
    'Remark 1',
    'Remark 2',
    'Booking',
    'Assigned To',
    'Project',
    'Created At',
  ];

  List<dynamic> _exportRow(Map<String, dynamic> lead) => [
    lead['name'] ?? '',
    lead['phone'] ?? '',
    lead['email'] ?? '',
    lead['source'] ?? '',
    lead['leadSourceLabel'] ?? '',
    lead['status'] ?? '',
    lead['priority'] ?? '',
    lead['propertyType'] ?? '',
    lead['bhk'] ?? '',
    lead['purpose'] ?? '',
    (lead['budget'] as Map?)?['min'] ?? '',
    (lead['budget'] as Map?)?['max'] ?? '',
    lead['followUpDate'] ?? '',
    lead['followUp2'] ?? '',
    lead['followUpNote'] ?? '',
    lead['remark'] ?? '',
    lead['remark1'] ?? '',
    lead['remark2'] ?? '',
    lead['booking'] ?? '',
    lead['assignedToName'] ?? '',
    lead['projectName'] ?? '',
    lead['createdAt'] ?? '',
  ];

  /// Mirrors Leads.jsx's exportRows: respects current filters/search when
  /// nothing is selected, narrows to the selection otherwise, and fetches
  /// the full matching set server-side rather than just what's scrolled
  /// into view locally.
  Future<void> _exportLeads({required bool asExcel}) async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      List<Map<String, dynamic>> source;
      if (_selected.isNotEmpty) {
        source = _leads.where((l) => _selected.contains(l['_id'])).toList();
      } else {
        final res = await _api.dio.get(
          '/leads/unified',
          queryParameters: {
            'page': 1,
            'limit': 9999,
            if (_searchCtrl.text.trim().isNotEmpty)
              'search': _searchCtrl.text.trim(),
            ..._filters.toParams(),
          },
        );
        source = (res.data['leads'] as List? ?? [])
            .cast<Map<String, dynamic>>();
      }
      if (source.isEmpty) {
        _snack('No leads to export');
        return;
      }

      final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
      if (asExcel) {
        final wb = xlsx.Excel.createExcel();
        final sheet = wb.getDefaultSheet() ?? 'Sheet1';
        wb.rename(sheet, 'Leads');
        wb.appendRow(
          'Leads',
          _exportHeader.map((h) => xlsx.TextCellValue(h)).toList(),
        );
        for (final lead in source) {
          wb.appendRow(
            'Leads',
            _exportRow(
              lead,
            ).map((v) => xlsx.TextCellValue(v.toString())).toList(),
          );
        }
        final bytes = wb.save();
        if (bytes == null) throw Exception('Failed to build workbook');
        await Share.shareXFiles([
          XFile.fromData(
            Uint8List.fromList(bytes),
            name: 'arthaleads-leads-$date.xlsx',
            mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ),
        ]);
      } else {
        final rows = <List<dynamic>>[
          _exportHeader,
          ...source.map(_exportRow),
        ];
        final csv = const ListToCsvConverter().convert(rows);
        await Share.shareXFiles([
          XFile.fromData(
            Uint8List.fromList(utf8.encode(csv)),
            name: 'arthaleads-leads-$date.csv',
            mimeType: 'text/csv',
          ),
        ]);
      }
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Export failed'), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _importCsv() async {
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv', 'xlsx', 'xls', 'txt'],
      );
      final path = picked?.files.single.path;
      if (path == null) return;
      setState(() => _importing = true);
      final result = await parseLeadImportFile(path, _agents);
      final response = await _api.dio.post(
        '/leads/import',
        data: {'leads': result.leads},
      );
      if (result.notice != null) _snack(result.notice!);
      _snack(
        response.data['message']?.toString() ??
            '${result.leads.length} leads imported',
      );
      await _load(reset: true);
    } on ImportEmptyException catch (e) {
      _snack(e.message, error: true);
    } catch (error) {
      _snack(ApiClient.errorMessage(error, 'Import failed'), error: true);
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  Future<void> _showQrCode() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const QrSheet(
        endpoint: '/org/me/qr-token',
        title: 'Lead Capture QR Code',
        description: 'Prospects can scan this to submit an enquiry directly to your CRM.',
      ),
    );
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      floatingActionButton: _selectMode
          ? null
          : GradientFab(onPressed: () => _openForm()),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Leads Management',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        '$_total active leads across your property funnel',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                IconButton.outlined(
                  tooltip: 'Import CSV',
                  onPressed: _importing ? null : _importCsv,
                  icon: _importing
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.upload_file_rounded, size: 19),
                ),
                const SizedBox(width: 4),
                _exporting
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10),
                        child: SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : PopupMenuButton<bool>(
                        tooltip: _selected.isEmpty
                            ? 'Export leads'
                            : 'Export ${_selected.length} selected',
                        enabled: _leads.isNotEmpty,
                        onSelected: (asExcel) =>
                            _exportLeads(asExcel: asExcel),
                        itemBuilder: (ctx) => const [
                          PopupMenuItem(value: false, child: Text('Export CSV')),
                          PopupMenuItem(value: true, child: Text('Export Excel')),
                        ],
                        child: IgnorePointer(
                          child: IconButton.outlined(
                            onPressed: _leads.isEmpty ? null : () {},
                            icon: const Icon(
                              Icons.download_rounded,
                              size: 19,
                            ),
                          ),
                        ),
                      ),
                const SizedBox(width: 4),
                IconButton.outlined(
                  tooltip: 'Lead capture QR code',
                  onPressed: _showQrCode,
                  icon: const Icon(Icons.qr_code_2_rounded, size: 19),
                ),
              ],
            ),
          ),
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
                Text(
                  '$_total leads',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
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
                ? const Center(child: AppSpinner(size: 32))
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
                            child: Center(child: AppSpinner(size: 22)),
                          );
                        }
                        return FadeSlideIn(
                          delay: Duration(milliseconds: 20 * (i % 12)),
                          child: _leadCard(_leads[i]),
                        );
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
            ? () => setState(
                () => selected ? _selected.remove(id) : _selected.add(id),
              )
            : () => _openDetail(lead),
        onLongPress: () =>
            setState(() => selected ? _selected.remove(id) : _selected.add(id)),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (_selectMode) ...[
                    Icon(
                      selected
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: selected
                          ? AppColors.primary
                          : Theme.of(context).disabledColor,
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      lead['name'] as String? ?? '—',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
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
                  Icon(
                    FontAwesomeIcons.phone.data,
                    size: 13,
                    color: Theme.of(context).textTheme.bodySmall?.color,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    lead['phone'] as String? ?? '',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(width: 12),
                  if (lead['projectName'] != null &&
                      (lead['projectName'] as String).isNotEmpty) ...[
                    Icon(
                      Icons.folder,
                      size: 13,
                      color: AppColors.primary.withValues(alpha: 0.8),
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        lead['projectName'] as String,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.primary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ] else if (lead['source'] != null) ...[
                    Icon(
                      FontAwesomeIcons.globe.data,
                      size: 13,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      lead['source'] as String,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  BookingChip(lead['booking'] as String?),
                  if (followUp != null) ...[
                    const SizedBox(width: 6),
                    Icon(
                      Icons.alarm,
                      size: 13,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
                    const SizedBox(width: 2),
                    Text(
                      followUp.length >= 10
                          ? followUp.substring(0, 10)
                          : followUp,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if ((lead['assignedToName'] as String? ?? '').isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Icon(
                      Icons.person,
                      size: 13,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
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
                    icon: Icon(
                      FontAwesomeIcons.phone.data,
                      size: 19,
                      color: AppColors.primary,
                    ),
                    onPressed: () => _call(lead),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      FontAwesomeIcons.whatsapp.data,
                      size: 19,
                      color: AppColors.whatsapp,
                    ),
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
        left: 8,
        right: 8,
        top: 8,
        bottom: 8 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).dividerTheme.color ?? Colors.transparent,
          ),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            if (auth.isAdmin) ...[
              _bulkBtn(
                Icons.person_add,
                'Assign',
                AppColors.primary,
                _bulkAssign,
              ),
              _bulkBtn(Icons.flag, 'Status', AppColors.info, _bulkStatus),
              _bulkBtn(
                Icons.drive_file_move,
                'Transfer',
                const Color(0xFF3B82F6),
                _bulkTransfer,
              ),
            ],
            _bulkBtn(
              Icons.chat,
              'WhatsApp',
              const Color(0xFF25D366),
              _bulkWhatsApp,
            ),
            _bulkBtn(Icons.delete, 'Delete', AppColors.danger, _bulkDelete),
          ],
        ),
      ),
    );
  }

  Widget _bulkBtn(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
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
