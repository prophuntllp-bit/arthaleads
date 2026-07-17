import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:csv/csv.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/motion.dart';
import '../leads/lead_detail_sheet.dart';
import 'project_form.dart';

/// Project detail — Info / Leads / Prospective tabs, mirroring
/// frontend/src/pages/ProjectDetail.jsx. Leads tab = fresh leads
/// (isProspective false); Prospective tab = booking progressed past
/// Interested/Site Visit (isProspective true), with bulk actions + CSV import.
class ProjectDetailScreen extends StatefulWidget {
  final Map<String, dynamic> project;
  const ProjectDetailScreen({super.key, required this.project});

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late Map<String, dynamic> _project = widget.project;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String get _projectId => _project['_id'] as String;

  Future<void> _editProject() async {
    List<Map<String, dynamic>> agents = [];
    try {
      final res = await ApiClient.instance.dio.get('/auth/agents');
      agents = (res.data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {}
    if (!mounted) return;
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProjectFormScreen(project: _project, agents: agents),
      ),
    );
    if (saved == true) {
      final fresh = await ApiClient.instance.dio.get('/projects/$_projectId');
      if (mounted)
        setState(
          () => _project = (fresh.data['data'] as Map).cast<String, dynamic>(),
        );
    }
  }

  Future<void> _deleteProject() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Project'),
        content: Text(
          'Are you sure you want to delete "${_project['name']}"? '
          'All imported leads will remain but the project will be removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.dio.delete('/projects/$_projectId');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to delete project'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_project['name'] as String? ?? 'Project'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) => v == 'edit' ? _editProject() : _deleteProject(),
            itemBuilder: (ctx) => const [
              PopupMenuItem(value: 'edit', child: Text('Edit Project')),
              PopupMenuItem(value: 'delete', child: Text('Delete Project')),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Info'),
            Tab(text: 'Leads'),
            Tab(text: 'Prospective'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _InfoTab(project: _project),
          _LeadsTab(project: _project, isProspective: false),
          _LeadsTab(project: _project, isProspective: true),
        ],
      ),
    );
  }
}

class _InfoTab extends StatelessWidget {
  final Map<String, dynamic> project;
  const _InfoTab({required this.project});

  @override
  Widget build(BuildContext context) {
    final images = (project['images'] as List?)?.cast<String>() ?? [];
    final bhk = (project['bhkTypes'] as List?)?.cast<String>() ?? [];
    final amenities = (project['amenities'] as List?)?.cast<String>() ?? [];
    final assigned = (project['assignedTo'] as List? ?? [])
        .map((u) => u is Map ? u['name'] as String? ?? '' : '')
        .where((n) => n.isNotEmpty)
        .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (images.isNotEmpty)
          SizedBox(
            height: 140,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  images[i],
                  width: 200,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      Container(width: 200, color: Colors.grey.shade800),
                ),
              ),
            ),
          ),
        const SizedBox(height: 16),
        if ((project['description'] as String? ?? '').isNotEmpty) ...[
          Text('Description', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Text(project['description'] as String),
          const SizedBox(height: 16),
        ],
        _row(context, 'Location', project['location'] as String? ?? '—'),
        _row(
          context,
          'Price Range',
          '${fmtBudget((project['priceMin'] as num?))} – ${fmtBudget((project['priceMax'] as num?))}',
        ),
        _row(context, 'Area', project['area'] as String? ?? '—'),
        _row(context, 'RERA Number', project['reraNumber'] as String? ?? '—'),
        if (bhk.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('BHK Types', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            children: bhk.map((b) => Chip(label: Text(b))).toList(),
          ),
        ],
        if (amenities.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Amenities', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: amenities.map((a) => Chip(label: Text(a))).toList(),
          ),
        ],
        if (assigned.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            'Assigned Agents',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: 4),
          Text(assigned.join(', ')),
        ],
      ],
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _LeadsTab extends StatefulWidget {
  final Map<String, dynamic> project;
  final bool isProspective;
  const _LeadsTab({required this.project, required this.isProspective});

  @override
  State<_LeadsTab> createState() => _LeadsTabState();
}

class _LeadsTabState extends State<_LeadsTab> {
  final _api = ApiClient.instance;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();

  final List<Map<String, dynamic>> _leads = [];
  List<Map<String, dynamic>> _projects = [];
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  final Set<String> _selected = {};
  bool get _selectMode => _selected.isNotEmpty;

  String get _projectId => widget.project['_id'] as String;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _api.dio
        .get('/projects')
        .then((res) {
          _projects = (res.data['data'] as List? ?? [])
              .cast<Map<String, dynamic>>();
        })
        .catchError((_) {});
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

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _leads.clear();
      _selected.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get(
        '/projects/$_projectId/leads',
        queryParameters: {
          'page': _page,
          'limit': 25,
          'isProspective': widget.isProspective,
          if (_searchCtrl.text.trim().isNotEmpty)
            'search': _searchCtrl.text.trim(),
        },
      );
      setState(() {
        _leads.addAll(
          (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>(),
        );
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load leads')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> lead) async {
    final tagged = {
      ...lead,
      '_type': 'project',
      'projectId': _projectId,
      'projectName': widget.project['name'],
      'followUpDate': lead['followUp'],
    };
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: tagged,
        projects: _projects,
        onUpdated: (updated) {
          final i = _leads.indexWhere((l) => l['_id'] == updated['_id']);
          if (i != -1) setState(() => _leads[i] = {..._leads[i], ...updated});
        },
      ),
    );
    if (changed == true) _load(reset: true);
  }

  Future<void> _bulkDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete leads?'),
        content: Text(
          '${_selected.length} lead(s) will be permanently deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete(
        '/projects/$_projectId/leads/bulk',
        data: {'ids': _selected.toList()},
      );
      _load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Bulk delete failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _bulkStatus() async {
    final booking = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: bookingOptions
              .where((o) => o.value.isNotEmpty)
              .map(
                (o) => ListTile(
                  title: Text(o.label),
                  onTap: () => Navigator.pop(ctx, o.value),
                ),
              )
              .toList(),
        ),
      ),
    );
    if (booking == null) return;
    try {
      await _api.dio.patch(
        '/projects/$_projectId/leads/bulk-status',
        data: {'ids': _selected.toList(), 'booking': booking},
      );
      _load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Bulk status update failed'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _importCsv() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv'],
      );
      final path = result?.files.single.path;
      if (path == null) return;
      final content = await File(path).readAsString();
      final rows = const CsvToListConverter(
        eol: '\n',
      ).convert(content, shouldParseNumbers: false);
      if (rows.isEmpty) return;
      final header = rows.first
          .map((h) => h.toString().trim().toLowerCase())
          .toList();
      final nameIdx = header.indexWhere((h) => h.contains('name'));
      final phoneIdx = header.indexWhere(
        (h) => h.contains('phone') || h.contains('mobile'),
      );
      final emailIdx = header.indexWhere((h) => h.contains('email'));
      if (nameIdx == -1 || phoneIdx == -1) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('CSV must have Name and Phone columns'),
              backgroundColor: AppColors.danger,
            ),
          );
        }
        return;
      }
      final dataRows = rows
          .skip(1)
          .map(
            (r) => {
              'name': nameIdx < r.length ? r[nameIdx].toString().trim() : '',
              'phone': phoneIdx < r.length ? r[phoneIdx].toString().trim() : '',
              if (emailIdx != -1 && emailIdx < r.length)
                'email': r[emailIdx].toString().trim(),
            },
          )
          .where(
            (r) =>
                (r['name'] ?? '').toString().isNotEmpty &&
                (r['phone'] ?? '').toString().isNotEmpty,
          )
          .toList();
      if (dataRows.isEmpty) {
        if (mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('No valid rows found')));
        return;
      }
      final res = await _api.dio.post(
        '/projects/$_projectId/leads/import',
        data: {'rows': dataRows},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Imported ${res.data['imported'] ?? dataRows.length}, '
              '${res.data['duplicates'] ?? 0} duplicate(s) skipped',
            ),
          ),
        );
      }
      _load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Import failed: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _exportCsv() async {
    final rows = [
      ['Name', 'Phone', 'Email', 'Booking', 'Status'],
      ..._leads.map(
        (l) => [
          l['name'] ?? '',
          l['phone'] ?? '',
          l['email'] ?? '',
          l['booking'] ?? '',
          l['status'] ?? '',
        ],
      ),
    ];
    final csv = const ListToCsvConverter().convert(rows);
    await Share.shareXFiles([
      XFile.fromData(
        Uint8List.fromList(utf8.encode(csv)),
        name: '${widget.project['name']}_leads.csv',
        mimeType: 'text/csv',
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                      hintText: 'Search leads…',
                      prefixIcon: Icon(Icons.search, size: 20),
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(reset: true),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.upload_file, size: 20),
                  tooltip: 'Import CSV',
                  onPressed: _importCsv,
                ),
                IconButton(
                  icon: const Icon(Icons.download, size: 20),
                  tooltip: 'Export CSV',
                  onPressed: _exportCsv,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
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
            child: _loading && _leads.isEmpty
                ? const Center(child: AppSpinner(size: 32))
                : _leads.isEmpty
                ? const Center(child: Text('No leads here'))
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => _load(reset: true),
                    child: ListView.builder(
                      controller: _scroll,
                      padding: EdgeInsets.only(bottom: _selectMode ? 80 : 8),
                      itemCount: _leads.length,
                      itemBuilder: (context, i) {
                        final lead = _leads[i];
                        final id = lead['_id'] as String;
                        final selected = _selected.contains(id);
                        return Card(
                          margin: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          child: ListTile(
                            leading: widget.isProspective
                                ? Icon(
                                    selected
                                        ? Icons.check_circle
                                        : Icons.radio_button_unchecked,
                                    color: selected
                                        ? AppColors.primary
                                        : Theme.of(context).disabledColor,
                                  )
                                : null,
                            title: Text(
                              lead['name'] as String? ?? '—',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(lead['phone'] as String? ?? ''),
                                if ((lead['booking'] as String? ?? '')
                                    .isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: BookingChip(
                                      lead['booking'] as String?,
                                    ),
                                  ),
                              ],
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: Icon(
                                    FontAwesomeIcons.phone.data,
                                    size: 18,
                                    color: AppColors.primary,
                                  ),
                                  onPressed: () {
                                    final p = lead['phone'] as String?;
                                    if (p != null)
                                      launchUrl(Uri.parse('tel:$p'));
                                  },
                                ),
                                IconButton(
                                  icon: Icon(
                                    FontAwesomeIcons.whatsapp.data,
                                    size: 19,
                                    color: AppColors.whatsapp,
                                  ),
                                  onPressed: () {
                                    final p = (lead['phone'] as String? ?? '')
                                        .replaceAll(RegExp(r'\D'), '');
                                    if (p.isEmpty) return;
                                    final wa = p.length == 10 ? '91$p' : p;
                                    launchUrl(
                                      Uri.parse('https://wa.me/$wa'),
                                      mode: LaunchMode.externalApplication,
                                    );
                                  },
                                ),
                              ],
                            ),
                            onTap: widget.isProspective && _selectMode
                                ? () => setState(
                                    () => selected
                                        ? _selected.remove(id)
                                        : _selected.add(id),
                                  )
                                : () => _openDetail(lead),
                            onLongPress: widget.isProspective
                                ? () => setState(
                                    () => selected
                                        ? _selected.remove(id)
                                        : _selected.add(id),
                                  )
                                : null,
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
      bottomSheet: widget.isProspective && _selectMode
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              decoration: BoxDecoration(
                color: Theme.of(context).cardTheme.color,
                border: Border(
                  top: BorderSide(
                    color:
                        Theme.of(context).dividerTheme.color ??
                        Colors.transparent,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _bulkStatus,
                      icon: const Icon(Icons.flag, size: 16),
                      label: const Text('Status'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.danger,
                      ),
                      onPressed: _bulkDelete,
                      icon: const Icon(Icons.delete, size: 16),
                      label: const Text('Delete'),
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
