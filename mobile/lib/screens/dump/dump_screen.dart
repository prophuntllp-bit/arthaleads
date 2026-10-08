import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:csv/csv.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/motion.dart';
import '../leads/lead_origin.dart';

/// Dump Leads — GET /leads/dump: pipeline leads that were deleted or marked
/// Closed Lost. Booking status no longer sends anything here; a lead marked
/// "Not Interested" stays in the working list where the agent left it.
/// Restore/permanent-delete use /leads/:id/restore + /leads/:id/permanent.
/// Mirrors frontend/src/pages/DumpLeads.jsx including search, bulk select +
/// bulk delete, and CSV import/export.
class DumpScreen extends StatefulWidget {
  const DumpScreen({super.key});

  @override
  State<DumpScreen> createState() => _DumpScreenState();
}

class _DumpScreenState extends State<DumpScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _leads = [];
  bool _loading = true;
  bool _importing = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  final Set<String> _selected = {};

  String _uid(Map<String, dynamic> l) => '${l['_id']}${l['_type'] ?? ''}';

  List<Map<String, dynamic>> get _filtered {
    if (_search.isEmpty) return _leads;
    final q = _search.toLowerCase();
    return _leads.where((l) {
      final name = (l['name'] as String? ?? '').toLowerCase();
      final phone = (l['phone'] as String? ?? '').toLowerCase();
      final email = (l['email'] as String? ?? '').toLowerCase();
      return name.contains(q) || phone.contains(q) || email.contains(q);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/leads/dump', queryParameters: {'limit': 1000});
      setState(() {
        _leads = ((res.data['leads'] ?? res.data['data']) as List? ?? []).cast<Map<String, dynamic>>();
        _selected.clear();
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
      if (lead['_type'] == 'project') {
        await _api.dio.patch('/projects/${lead['projectId']}/leads/${lead['_id']}', data: {'booking': ''});
      } else {
        await _api.dio.patch('/leads/${lead['_id']}/restore');
      }
      setState(() => _leads.remove(lead));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${lead['name']} restored'),
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
      if (lead['_type'] == 'project') {
        await _api.dio.delete('/projects/${lead['projectId']}/leads/${lead['_id']}');
      } else {
        await _api.dio.delete('/leads/${lead['_id']}/permanent');
      }
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

  Future<void> _bulkDelete() async {
    final selectedLeads = _leads.where((l) => _selected.contains(_uid(l))).toList();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete ${selectedLeads.length} leads?'),
        content: const Text('This action is permanent and cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete permanently', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Future.wait(selectedLeads.map((lead) => lead['_type'] == 'project'
          ? _api.dio.delete('/projects/${lead['projectId']}/leads/${lead['_id']}')
          : _api.dio.delete('/leads/${lead['_id']}/permanent')));
      setState(() {
        _leads.removeWhere((l) => _selected.contains(_uid(l)));
        _selected.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${selectedLeads.length} leads permanently deleted'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Bulk delete failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _exportCsv() async {
    final source = _selected.isNotEmpty
        ? _leads.where((l) => _selected.contains(_uid(l))).toList()
        : _filtered;
    final rows = [
      ['Name', 'Phone', 'Email', 'Source', 'Project', 'Pipeline Status', 'Lead Outcome', 'Reason', 'Assigned To', 'Remark', 'Added'],
      ...source.map((l) => [
            l['name'] ?? '',
            l['phone'] ?? '',
            l['email'] ?? '',
            l['source'] ?? '',
            l['projectName'] ?? '',
            l['status'] ?? '',
            l['booking'] ?? '',
            l['isDeleted'] == true ? 'Deleted' : 'Closed Lost',
            l['assignedToName'] ?? '',
            l['remark'] ?? l['remark1'] ?? '',
            l['createdAt'] != null ? DateFormat('yyyy-MM-dd').format(DateTime.parse(l['createdAt']).toLocal()) : '',
          ]),
    ];
    final csv = const ListToCsvConverter().convert(rows);
    final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await Share.shareXFiles([
      XFile.fromData(Uint8List.fromList(utf8.encode(csv)),
          name: 'arthaleads-dump-leads-$dateStr.csv', mimeType: 'text/csv'),
    ]);
  }

  Future<void> _importCsv() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['csv']);
      final path = result?.files.single.path;
      if (path == null) return;
      setState(() => _importing = true);
      final content = await File(path).readAsString();
      final rows = const CsvToListConverter(eol: '\n').convert(content, shouldParseNumbers: false);
      if (rows.isEmpty) return;
      final header = rows.first.map((h) => h.toString().trim().toLowerCase()).toList();
      final nameIdx = header.indexWhere((h) => h.contains('name'));
      final phoneIdx = header.indexWhere((h) => h.contains('phone') || h.contains('mobile'));
      final emailIdx = header.indexWhere((h) => h.contains('email'));
      final sourceIdx = header.indexWhere((h) => h.contains('source'));
      final remarkIdx = header.indexWhere((h) => h.contains('remark'));
      if (nameIdx == -1 || phoneIdx == -1) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('CSV must have Name and Phone columns'),
            backgroundColor: AppColors.danger,
          ));
        }
        return;
      }
      final leadsToImport = rows.skip(1).map((r) {
        String cell(int idx) => idx != -1 && idx < r.length ? r[idx].toString().trim() : '';
        return {
          'name': cell(nameIdx),
          'phone': cell(phoneIdx),
          if (emailIdx != -1) 'email': cell(emailIdx),
          'source': sourceIdx != -1 && cell(sourceIdx).isNotEmpty ? cell(sourceIdx) : 'Manual',
          'status': 'New',
          if (remarkIdx != -1) 'remark': cell(remarkIdx),
          'isDeleted': true,
        };
      }).where((r) => (r['name'] as String).isNotEmpty && (r['phone'] as String).isNotEmpty).toList();

      if (leadsToImport.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('No valid leads found. File must have Name and Phone columns.'),
            backgroundColor: AppColors.danger,
          ));
        }
        return;
      }

      final res = await _api.dio.post('/leads/import', data: {'leads': leadsToImport});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res.data['message']?.toString() ?? '${leadsToImport.length} leads imported to dump'),
          backgroundColor: AppColors.success,
        ));
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Import failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '—';
    return DateFormat('dd MMM yyyy').format(dt);
  }

  /// A dumped lead laid out like a card on the Leads screen: same text sizes,
  /// chips and icon sizes, with the name on one line (shortened with "...") so
  /// it never breaks mid-word, and the restore / delete buttons beside it.
  Widget _dumpCard(Map<String, dynamic> lead, String uid, bool selected, bool canDelete) {
    final soft = Theme.of(context).textTheme.bodySmall;
    final email = (lead['email'] as String?) ?? '';
    final project = (lead['projectName'] as String?) ?? '';
    final assignee = (lead['assignedToName'] as String?) ?? '';
    final remark = ((lead['remark'] ?? lead['remark1']) as String?) ?? '';
    final deleted = lead['isDeleted'] == true;
    final badge = deleted ? AppColors.danger : AppColors.warning;
    final date = _fmtDate(lead['createdAt'] as String?);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      color: selected ? AppColors.primary.withValues(alpha: 0.06) : null,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: canDelete
            ? () => setState(() => selected ? _selected.remove(uid) : _selected.add(uid))
            : null,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (canDelete) ...[
                    Icon(
                      selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                      color: selected ? AppColors.primary : Theme.of(context).disabledColor,
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      lead['name'] as String? ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (canDelete) ...[
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.restore_rounded, color: AppColors.success, size: 21),
                      tooltip: 'Restore',
                      onPressed: () => _restore(lead),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.delete_forever_rounded, color: AppColors.danger, size: 21),
                      tooltip: 'Delete permanently',
                      onPressed: () => _deleteForever(lead),
                    ),
                  ] else
                    const SizedBox(width: 8),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.phone, size: 13, color: soft?.color),
                        const SizedBox(width: 4),
                        Flexible(child: Text(lead['phone'] as String? ?? '', style: soft, overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 10),
                        SourceChip(lead['source'] as String?),
                      ],
                    ),
                    if (email.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(email, style: soft, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    if (project.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            const Icon(Icons.folder, size: 13, color: Color(0xFF8B5CF6)),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                project,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                    LeadOriginLine(lead),
                    const SizedBox(height: 6),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: badge.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            deleted ? 'Deleted' : 'Closed Lost',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: badge),
                          ),
                        ),
                        if (((lead['status'] as String?) ?? '').isNotEmpty) StatusChip(lead['status'] as String?),
                        if (((lead['booking'] as String?) ?? '').isNotEmpty) BookingChip(lead['booking'] as String?),
                      ],
                    ),
                    if (remark.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          remark,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: soft?.color),
                        ),
                      ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 12,
                      runSpacing: 2,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (assignee.isNotEmpty)
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.person, size: 13, color: soft?.color),
                            const SizedBox(width: 2),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 170),
                              child: Text(assignee, style: soft, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                          ]),
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.schedule, size: 13, color: soft?.color),
                          const SizedBox(width: 2),
                          Text(date, style: soft),
                        ]),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final role = auth.user?['role'] as String?;
    final canDelete = role == 'admin' || role == 'manager' || role == 'super_admin';
    final filtered = _filtered;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search by name, phone, or email…',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              suffixIcon: _search.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _search = '');
                      },
                    )
                  : null,
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
          child: Row(
            children: [
              Text('${filtered.length} dump leads', style: Theme.of(context).textTheme.bodySmall),
              const Spacer(),
              if (_selected.isNotEmpty && canDelete)
                TextButton.icon(
                  onPressed: _bulkDelete,
                  icon: const Icon(Icons.delete_forever, size: 16, color: AppColors.danger),
                  label: Text('Delete ${_selected.length}', style: const TextStyle(color: AppColors.danger, fontSize: 12)),
                ),
              IconButton(
                icon: _importing
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.upload_file, size: 20),
                tooltip: 'Import CSV',
                onPressed: _importing ? null : _importCsv,
              ),
              IconButton(
                icon: const Icon(Icons.download, size: 20),
                tooltip: _selected.isNotEmpty ? 'Export ${_selected.length} selected' : 'Export CSV',
                onPressed: filtered.isEmpty ? null : _exportCsv,
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: AppSpinner(size: 32))
              : filtered.isEmpty
                  ? Center(child: Text(_search.isNotEmpty ? 'No matches' : 'Dump is empty'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: _load,
                      child: ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (context, i) {
                          final lead = filtered[i];
                          final uid = _uid(lead);
                          final selected = _selected.contains(uid);
                          return _dumpCard(lead, uid, selected, canDelete);
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
