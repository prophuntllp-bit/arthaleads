import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// The leads dumped from one project, with every remark and note written on
/// them, so whoever dumped a lead can see why. Same as the web's project
/// "Dump Leads" panel: paged, searchable, with Restore. An agent sees only the
/// leads they dumped; admins and managers see all.
class ProjectDumpScreen extends StatefulWidget {
  final String projectId;
  final String projectName;
  const ProjectDumpScreen({super.key, required this.projectId, required this.projectName});

  @override
  State<ProjectDumpScreen> createState() => _ProjectDumpScreenState();
}

class _ProjectDumpScreenState extends State<ProjectDumpScreen> {
  static const _pageSize = 20;
  final _api = ApiClient.instance;
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  List<Map<String, dynamic>>? _leads;
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  String _query = '';
  String? _confirmId;
  String? _busyId;
  bool _changed = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _leads = null;
      _failed = false;
    });
    try {
      final res = await _api.dio.get(
        '/projects/${widget.projectId}/dumped-leads',
        queryParameters: {
          'page': _page,
          'limit': _pageSize,
          if (_query.isNotEmpty) 'search': _query,
        },
      );
      if (!mounted) return;
      setState(() {
        _leads = (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>();
        _total = (res.data['total'] as num?)?.toInt() ?? 0;
        _pages = (res.data['pages'] as num?)?.toInt() ?? 1;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final q = v.trim();
      if (q == _query) return;
      _query = q;
      _page = 1;
      _load();
    });
  }

  Future<void> _restore(Map<String, dynamic> lead) async {
    setState(() => _busyId = lead['_id'] as String);
    try {
      final res = await _api.dio.post(
        '/projects/${widget.projectId}/dumped-leads/${lead['_id']}/restore',
      );
      if (!mounted) return;
      _changed = true;
      final name = lead['name'] ?? 'Lead';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
          res.data['restoredTo'] == 'project'
              ? '$name is back in ${res.data['projectName']}'
              : '$name restored to Leads',
        ),
      ));
      _confirmId = null;
      // If that emptied this page, step back one.
      if ((_leads?.length ?? 0) == 1 && _page > 1) _page--;
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Could not restore this lead')),
          backgroundColor: AppColors.danger,
        ));
        await _load();
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  static String _fmt(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}');
    if (d == null) return '';
    // Server time is UTC; the team works in IST.
    return DateFormat('d MMM yyyy, h:mm a').format(d.toUtc().add(const Duration(hours: 5, minutes: 30)));
  }

  Widget _line(String label, dynamic value) {
    final v = '${value ?? ''}'.trim();
    if (v.isEmpty) return const SizedBox.shrink();
    final soft = Theme.of(context).hintColor;
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Text.rich(
        TextSpan(children: [
          TextSpan(text: '$label: ', style: TextStyle(color: soft)),
          TextSpan(text: v),
        ]),
        style: const TextStyle(fontSize: 13, height: 1.35),
      ),
    );
  }

  Widget _card(Map<String, dynamic> l) {
    final id = l['_id'] as String;
    final status = '${l['status'] ?? ''}';
    final booking = '${l['booking'] ?? ''}';
    final notes = (l['notes'] as List? ?? const []).cast<Map<dynamic, dynamic>>();
    final hasAny = ['remark1', 'remark2', 'remark3', 'remark4', 'remark', 'followUpNote']
            .any((k) => '${l[k] ?? ''}'.trim().isNotEmpty) ||
        notes.isNotEmpty;
    final by = '${l['deletedByName'] ?? ''}';

    Widget action;
    if (_confirmId == id) {
      action = Row(mainAxisSize: MainAxisSize.min, children: [
        FilledButton(
          style: FilledButton.styleFrom(
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          onPressed: _busyId == id ? null : () => _restore(l),
          child: _busyId == id
              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Put back', style: TextStyle(fontSize: 12)),
        ),
        TextButton(
          style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
          onPressed: _busyId == id ? null : () => setState(() => _confirmId = null),
          child: const Text('Cancel', style: TextStyle(fontSize: 12)),
        ),
      ]);
    } else {
      action = FilledButton.tonalIcon(
        style: FilledButton.styleFrom(
          visualDensity: VisualDensity.compact,
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
        onPressed: () => setState(() => _confirmId = id),
        icon: const Icon(Icons.restore_rounded, size: 16),
        label: const Text('Restore', style: TextStyle(fontSize: 12)),
      );
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${l['name'] ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(
                        [
                          '${l['phone'] ?? ''}',
                          if (status.isNotEmpty) status,
                          if (booking.isNotEmpty && booking != status) booking,
                        ].join(' · '),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                action,
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Dumped ${_fmt(l['deletedAt'])}${by.isNotEmpty ? ' by $by' : ''}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const Divider(height: 18),
            _line('Remark 1', l['remark1']),
            _line('Remark 2', l['remark2']),
            _line('Remark 3', l['remark3']),
            _line('Remark 4', l['remark4']),
            _line('Remark note', l['remark']),
            _line('Follow-up note', l['followUpNote']),
            for (final n in notes)
              _line(
                'Note${'${n['addedByName'] ?? ''}'.isNotEmpty ? ' (${n['addedByName']})' : ''}',
                n['text'],
              ),
            if (!hasAny)
              Text('No remarks were written on this lead.',
                  style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Theme.of(context).hintColor)),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_failed) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off_rounded, size: 36),
          const SizedBox(height: 8),
          const Text('Could not load dumped leads'),
          TextButton(onPressed: _load, child: const Text('Try again')),
        ]),
      );
    }
    final leads = _leads;
    if (leads == null) return const Center(child: CircularProgressIndicator());
    if (leads.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.archive_outlined, size: 40, color: Theme.of(context).hintColor),
            const SizedBox(height: 10),
            Text(
              _query.isNotEmpty ? 'No dumped leads match' : 'Nothing dumped from this project',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              _query.isNotEmpty
                  ? 'Try a different name or number.'
                  : 'Leads deleted from this project will appear here with their remarks.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ]),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
      children: [
        for (final l in leads) _card(l),
        if (_pages > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Page $_page of $_pages', style: Theme.of(context).textTheme.bodySmall),
              Row(children: [
                IconButton(
                  tooltip: 'Previous page',
                  onPressed: _page <= 1 ? null : () { _page--; _load(); },
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                IconButton(
                  tooltip: 'Next page',
                  onPressed: _page >= _pages ? null : () { _page++; _load(); },
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ]),
            ],
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Dump leads · ${widget.projectName}', maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: _onSearch,
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Search by name or phone...',
                        prefixIcon: Icon(Icons.search_rounded, size: 20),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text('$_total ${_total == 1 ? 'lead' : 'leads'}',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }
}
