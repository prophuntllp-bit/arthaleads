import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/glass.dart';
import '../leads/lead_detail_sheet.dart';
import '../leads/lead_form.dart';

/// Drill-down for a Performance tile: the real leads behind the number.
/// GET /auth/performance/leads counts with the same rules as
/// /auth/performance, so the list total always equals the tile. Tapping a row
/// opens the same LeadDetailSheet the Leads tab uses.
///
/// [onChanged] fires (once, on close) if any lead was edited so the caller can
/// refresh its numbers instead of leaving the tiles stale.
Future<void> showPerformanceLeads(
  BuildContext context, {
  required String title,
  required String metric,
  String userId = '',
  String pipeline = '',
  DateTime? dateFrom,
  DateTime? dateTo,
  VoidCallback? onChanged,
}) async {
  var dirty = false;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => _PerformanceLeadsSheet(
      title: title,
      metric: metric,
      userId: userId,
      pipeline: pipeline,
      dateFrom: dateFrom,
      dateTo: dateTo,
      onDirty: () => dirty = true,
    ),
  );
  if (dirty) onChanged?.call();
}

class _PerformanceLeadsSheet extends StatefulWidget {
  final String title;
  final String metric;
  final String userId;
  final String pipeline;
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final VoidCallback onDirty;

  const _PerformanceLeadsSheet({
    required this.title,
    required this.metric,
    required this.userId,
    required this.pipeline,
    required this.dateFrom,
    required this.dateTo,
    required this.onDirty,
  });

  @override
  State<_PerformanceLeadsSheet> createState() => _PerformanceLeadsSheetState();
}

class _PerformanceLeadsSheetState extends State<_PerformanceLeadsSheet> {
  static const _limit = 25;
  final _api = ApiClient.instance;
  final _scroll = ScrollController();

  final List<Map<String, dynamic>> _rows = [];
  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _agents = [];
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  bool _loadingMore = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load(reset: true);
    _loadMeta();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
      _loadMore();
    }
  }

  Map<String, dynamic> _params(int page) => {
    'metric': widget.metric,
    if (widget.userId.isNotEmpty) 'userId': widget.userId,
    if (widget.pipeline.isNotEmpty) 'pipeline': widget.pipeline,
    // Same encoding the Performance screen uses for /auth/performance.
    if (widget.dateFrom != null) 'dateFrom': widget.dateFrom!.toIso8601String(),
    if (widget.dateTo != null) 'dateTo': widget.dateTo!.toIso8601String(),
    'page': page,
    'limit': _limit,
  };

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = false;
      });
    }
    try {
      final res = await _api.dio.get(
        '/auth/performance/leads',
        queryParameters: _params(1),
      );
      if (!mounted) return;
      setState(() {
        _rows
          ..clear()
          ..addAll((res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>());
        _total = (res.data['total'] as num?)?.toInt() ?? 0;
        _pages = (res.data['pages'] as num?)?.toInt() ?? 1;
        _page = 1;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _loadingMore || _page >= _pages) return;
    setState(() => _loadingMore = true);
    try {
      final res = await _api.dio.get(
        '/auth/performance/leads',
        queryParameters: _params(_page + 1),
      );
      if (!mounted) return;
      setState(() {
        _rows.addAll((res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>());
        _page += 1;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  /// Projects (for Transfer) and agents (for Edit) are only needed once a lead
  /// is opened, so fetch them quietly in the background.
  Future<void> _loadMeta() async {
    try {
      final res = await _api.dio.get('/projects');
      _projects = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {}
    try {
      final res = await _api.dio.get('/auth/agents');
      _agents = (res.data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (_) {}
  }

  void _upsertRow(Map<String, dynamic> updated) {
    widget.onDirty();
    final i = _rows.indexWhere((l) => l['_id'] == updated['_id']);
    if (i != -1 && mounted) setState(() => _rows[i] = {..._rows[i], ...updated});
  }

  Future<void> _open(Map<String, dynamic> lead) async {
    // Same rule as the Leads tab: plain leads open with the full document.
    // Project-lead rows from this endpoint are already complete.
    var detail = lead;
    if (lead['_type'] != 'project') {
      try {
        final res = await _api.dio.get('/leads/${lead['_id']}');
        final fresh = (res.data['data'] as Map?)?.cast<String, dynamic>();
        if (fresh != null) detail = {...lead, ...fresh};
      } catch (_) {}
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
    if (!mounted) return;
    if (result == 'edit') {
      final saved = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => LeadFormScreen(lead: lead, agents: _agents),
        ),
      );
      if (saved == true) {
        widget.onDirty();
        _load();
      }
    } else if (result == true) {
      // Transferred / deleted: the row may no longer belong here.
      widget.onDirty();
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final height = MediaQuery.of(context).size.height * 0.88;
    final countLabel = _loading && _rows.isEmpty ? '' : ' ($_total)';

    return SizedBox(
      height: height,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '${widget.title}$countLabel',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
          ),
          Expanded(child: _body(t)),
        ],
      ),
    );
  }

  Widget _body(AppTheme t) {
    if (_loading && _rows.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text("Couldn't load these leads."),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _load(reset: true),
              child: const Text('Try again'),
            ),
          ],
        ),
      );
    }
    if (_rows.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 40, color: Theme.of(context).disabledColor),
            const SizedBox(height: 8),
            const Text('No leads here', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(
              'Nothing matches this number for the selected dates.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        itemCount: _rows.length + (_loadingMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          if (i >= _rows.length) {
            return const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            );
          }
          return _row(_rows[i]);
        },
      ),
    );
  }

  Widget _row(Map<String, dynamic> lead) {
    final isProject = lead['_type'] == 'project';
    final stage = (isProject ? lead['booking'] : lead['status']) as String?;
    final sub = [
      lead['phone'],
      isProject ? lead['projectName'] : lead['source'],
      lead['assignedToName'],
    ].where((e) => e != null && e.toString().isNotEmpty).join(' · ');

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _open(lead),
      child: SoftSurface(
        radius: 16,
        boxShadow: const [],
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (lead['name'] as String?)?.isNotEmpty == true ? lead['name'] as String : 'Unnamed lead',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (sub.isNotEmpty)
                    Text(
                      sub,
                      style: Theme.of(context).textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            if (stage != null && stage.isNotEmpty) ...[
              const SizedBox(width: 8),
              isProject ? BookingChip(stage) : StatusChip(stage),
            ],
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, size: 18, color: Theme.of(context).disabledColor),
          ],
        ),
      ),
    );
  }
}
