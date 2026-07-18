import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/glass.dart';
import '../../widgets/motion.dart';
import '../../widgets/upgrade_wall.dart';

/// Performance — GET /auth/performance (admin/manager). Leaderboard of
/// team members with dual Main Pipeline / Project Pipeline breakdown.
/// Mirrors frontend/src/pages/Performance.jsx.
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  bool _refreshing = false;
  bool _exporting = false;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  String _filterMemberId = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<Map<String, dynamic>> get _displayMembers => _filterMemberId.isEmpty
      ? _members
      : _members.where((m) => m['_id'] == _filterMemberId).toList();

  Future<void> _load({bool isRefresh = false}) async {
    setState(() => isRefresh ? _refreshing = true : _loading = true);
    try {
      final params = <String, dynamic>{};
      if (_dateFrom != null) params['dateFrom'] = _dateFrom!.toIso8601String();
      if (_dateTo != null) params['dateTo'] = _dateTo!.toIso8601String();
      final res = await _api.dio.get(
        '/auth/performance',
        queryParameters: params,
      );
      final list = (res.data['performance'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      list.sort(
        (a, b) => ((b['closedWon'] as num?) ?? 0).compareTo(
          (a['closedWon'] as num?) ?? 0,
        ),
      );
      if (mounted) setState(() => _members = list);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load performance'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _dateFrom : _dateTo) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => isFrom ? _dateFrom = picked : _dateTo = picked);
    _load(isRefresh: true);
  }

  void _clearDates() {
    setState(() {
      _dateFrom = null;
      _dateTo = null;
    });
    _load(isRefresh: true);
  }

  String _fmtDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  int _metricTotal(String section, String field) => _displayMembers.fold<int>(
    0,
    (sum, member) =>
        sum + ((((member[section] as Map?)?[field]) as num?)?.toInt() ?? 0),
  );

  Future<void> _downloadReport() async {
    if (_displayMembers.isEmpty || _exporting) return;
    setState(() => _exporting = true);
    try {
      final org = context.read<AuthState>().org;
      final orgName = org?['name']?.toString() ?? 'Your Organisation';
      final generated = DateFormat(
        'd MMMM yyyy, hh:mm a',
      ).format(DateTime.now());
      final range = _dateFrom == null && _dateTo == null
          ? 'All time · Live data'
          : '${_dateFrom == null ? 'Start' : DateFormat('d MMM yyyy').format(_dateFrom!)} → ${_dateTo == null ? 'Today' : DateFormat('d MMM yyyy').format(_dateTo!)}';
      final totalLeads =
          _metricTotal('pipeline', 'totalAssigned') +
          _metricTotal('project', 'totalAssigned');
      final totalVisits =
          _metricTotal('pipeline', 'siteVisits') +
          _metricTotal('project', 'siteVisits');
      final totalWon =
          _metricTotal('pipeline', 'closedWon') +
          _metricTotal('project', 'booked');
      final orange = PdfColor.fromHex('#F97316');
      final border = PdfColor.fromHex('#E2E8F0');
      final muted = PdfColor.fromHex('#64748B');
      final document = pw.Document();

      pw.Widget metric(String label, int value, String note, PdfColor color) {
        return pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: border),
              borderRadius: pw.BorderRadius.circular(10),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  '$value',
                  style: pw.TextStyle(
                    fontSize: 24,
                    fontWeight: pw.FontWeight.bold,
                    color: color,
                  ),
                ),
                pw.Text(
                  label.toUpperCase(),
                  style: pw.TextStyle(
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                    color: muted,
                  ),
                ),
                pw.Text(note, style: pw.TextStyle(fontSize: 7, color: muted)),
              ],
            ),
          ),
        );
      }

      pw.Widget statTable(Map pipeline, Map project) {
        pw.Widget cell(String label, dynamic value, {PdfColor? color}) =>
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(
                horizontal: 7,
                vertical: 8,
              ),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: border, width: .5),
              ),
              child: pw.Column(
                children: [
                  pw.Text(
                    label.toUpperCase(),
                    style: pw.TextStyle(fontSize: 6.5, color: muted),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    '${value ?? 0}',
                    style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                      color: color,
                    ),
                  ),
                ],
              ),
            );
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              'MAIN PIPELINE',
              style: pw.TextStyle(
                fontSize: 8,
                fontWeight: pw.FontWeight.bold,
                color: orange,
              ),
            ),
            pw.SizedBox(height: 5),
            pw.Row(
              children: [
                pw.Expanded(child: cell('Assigned', pipeline['totalAssigned'])),
                pw.Expanded(child: cell('New', pipeline['newLeads'])),
                pw.Expanded(child: cell('Site Visit', pipeline['siteVisits'])),
                pw.Expanded(
                  child: cell(
                    'Closed Won',
                    pipeline['closedWon'],
                    color: PdfColors.green600,
                  ),
                ),
                pw.Expanded(
                  child: cell('Avg Resp.', pipeline['avgResponseTime'] ?? '—'),
                ),
              ],
            ),
            pw.SizedBox(height: 9),
            pw.Text(
              'PROJECT PIPELINE',
              style: pw.TextStyle(
                fontSize: 8,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.indigo500,
              ),
            ),
            pw.SizedBox(height: 5),
            pw.Row(
              children: [
                pw.Expanded(child: cell('Assigned', project['totalAssigned'])),
                pw.Expanded(child: cell('Interested', project['interested'])),
                pw.Expanded(child: cell('Site Visit', project['siteVisits'])),
                pw.Expanded(
                  child: cell(
                    'Booked',
                    project['booked'],
                    color: PdfColors.green600,
                  ),
                ),
              ],
            ),
          ],
        );
      }

      document.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(28),
          header: (context) => pw.Container(
            margin: const pw.EdgeInsets.only(bottom: 18),
            padding: const pw.EdgeInsets.all(16),
            decoration: pw.BoxDecoration(
              color: orange,
              borderRadius: pw.BorderRadius.circular(12),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      'ARTHALEADS',
                      style: pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 18,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.Text(
                      orgName,
                      style: const pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text(
                      'Team Performance Report',
                      style: pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 12,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.Text(
                      'Generated $generated',
                      style: const pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 7,
                      ),
                    ),
                    pw.Text(
                      range,
                      style: const pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 7,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          footer: (context) => pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Confidential · Internal use only · $orgName',
                style: pw.TextStyle(fontSize: 7, color: muted),
              ),
              pw.Text(
                'Page ${context.pageNumber} of ${context.pagesCount} · Arthaleads CRM',
                style: pw.TextStyle(fontSize: 7, color: orange),
              ),
            ],
          ),
          build: (context) => [
            pw.Row(
              children: [
                metric(
                  'Total Leads',
                  totalLeads,
                  'Pipeline + Project combined',
                  orange,
                ),
                pw.SizedBox(width: 9),
                metric(
                  'Site Visits',
                  totalVisits,
                  'Across all pipelines',
                  PdfColors.blue500,
                ),
                pw.SizedBox(width: 9),
                metric(
                  'Closed / Booked',
                  totalWon,
                  'Won + project bookings',
                  PdfColors.green600,
                ),
              ],
            ),
            pw.SizedBox(height: 20),
            pw.Text(
              'AGENT PERFORMANCE BREAKDOWN',
              style: pw.TextStyle(
                fontSize: 9,
                fontWeight: pw.FontWeight.bold,
                color: muted,
              ),
            ),
            pw.SizedBox(height: 10),
            for (final member in _displayMembers)
              pw.Container(
                margin: const pw.EdgeInsets.only(bottom: 12),
                padding: const pw.EdgeInsets.all(12),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: border),
                  borderRadius: pw.BorderRadius.circular(10),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              member['name']?.toString() ?? '—',
                              style: pw.TextStyle(
                                fontSize: 12,
                                fontWeight: pw.FontWeight.bold,
                              ),
                            ),
                            pw.Text(
                              member['email']?.toString() ?? '',
                              style: pw.TextStyle(fontSize: 7, color: muted),
                            ),
                          ],
                        ),
                        pw.Text(
                          '${member['role'] ?? ''} · ${member['isActive'] == false ? 'Inactive' : 'Active'}',
                          style: pw.TextStyle(fontSize: 7, color: muted),
                        ),
                      ],
                    ),
                    pw.SizedBox(height: 10),
                    statTable(
                      (member['pipeline'] as Map?) ?? {},
                      (member['project'] as Map?) ?? {},
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
      await Printing.sharePdf(
        bytes: await document.save(),
        filename:
            'Arthaleads-Performance-${DateFormat('yyyy-MM-dd').format(DateTime.now())}.pdf',
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(error, 'Failed to create report'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Widget _smallTile(
    String label,
    dynamic value, {
    bool highlight = false,
    String? note,
  }) {
    final isNum = value is num;
    return SoftSurface(
      radius: 10,
      padding: const EdgeInsets.all(8),
      boxShadow: const [],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 9),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            isNum ? '$value' : (value?.toString() ?? '-'),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: highlight && value is num && value > 0
                  ? AppColors.success
                  : null,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (note != null)
            Text(
              note,
              style: const TextStyle(
                fontSize: 8,
                color: Color(0xFF14B8A6),
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }

  Widget _progressRow(String label, num pct, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(fontSize: 10)),
            const Spacer(),
            Text(
              '$pct%',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: (pct.clamp(0, 100)) / 100,
            minHeight: 5,
            backgroundColor: color.withValues(alpha: 0.12),
            color: color,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final org = context.watch<AuthState>().org;
    if (!canAccess(org, 'growth')) {
      return UpgradeWall(
        org: org,
        feature: 'Analytics & Reports',
        description:
            'View team performance, conversion rates, booking metrics and individual agent tracking.',
      );
    }

    if (_loading) return const Center(child: AppSpinner(size: 32));
    if (_members.isEmpty)
      return const Center(child: Text('No team performance data yet'));

    final members = _displayMembers;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => _load(isRefresh: true),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          // ── Filters ──
          if (_members.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                height: 34,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    ChoiceChip(
                      label: const Text(
                        'All Members',
                        style: TextStyle(fontSize: 11),
                      ),
                      selected: _filterMemberId.isEmpty,
                      onSelected: (_) => setState(() => _filterMemberId = ''),
                    ),
                    const SizedBox(width: 6),
                    ..._members.map(
                      (m) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(
                            m['name'] as String? ?? '—',
                            style: const TextStyle(fontSize: 11),
                          ),
                          selected: _filterMemberId == m['_id'],
                          onSelected: (_) => setState(
                            () => _filterMemberId = m['_id'] as String? ?? '',
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today, size: 13),
                  label: Text(
                    _dateFrom != null ? _fmtDate(_dateFrom!) : 'From',
                    style: const TextStyle(fontSize: 11),
                  ),
                  onPressed: () => _pickDate(isFrom: true),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today, size: 13),
                  label: Text(
                    _dateTo != null ? _fmtDate(_dateTo!) : 'To',
                    style: const TextStyle(fontSize: 11),
                  ),
                  onPressed: () => _pickDate(isFrom: false),
                ),
              ),
              if (_dateFrom != null || _dateTo != null)
                IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: _clearDates,
                ),
              if (_refreshing)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _refreshing ? null : () => _load(isRefresh: true),
                  icon: _refreshing
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded, size: 17),
                  label: const Text('Refresh'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _exporting || members.isEmpty
                      ? null
                      : _downloadReport,
                  icon: _exporting
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.download_rounded, size: 17),
                  label: const Text('Download Report'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (members.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No data for this agent.')),
            ),

          for (final (i, m) in members.indexed)
            FadeSlideIn(
              delay: Duration(milliseconds: 40 * i),
              child: Column(children: _memberCard(m)),
            ),
        ],
      ),
    );
  }

  List<Widget> _memberCard(Map<String, dynamic> m) {
    final pipeline = (m['pipeline'] as Map?)?.cast<String, dynamic>() ?? {};
    final project = (m['project'] as Map?)?.cast<String, dynamic>() ?? {};
    final hasPipeline = ((pipeline['totalAssigned'] as num?) ?? 0) > 0;
    final hasProject = ((project['totalAssigned'] as num?) ?? 0) > 0;

    return [
      SoftSurface(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name/role header
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text(
                    (m['name'] as String? ?? '?')[0].toUpperCase(),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m['name'] as String? ?? '—',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        m['email'] as String? ?? '',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        m['role'] as String? ?? '',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      m['isActive'] == false ? 'Inactive' : 'Active',
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Main Pipeline
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.of(context).border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: const BoxDecoration(color: Color(0x11FF6B00)),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.view_list,
                          size: 14,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Main Pipeline',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${pipeline['totalAssigned'] ?? 0} leads',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 6,
                      crossAxisSpacing: 6,
                      childAspectRatio: 1.7,
                      children: [
                        _smallTile('Assigned', pipeline['totalAssigned'] ?? 0),
                        _smallTile('New', pipeline['newLeads'] ?? 0),
                        _smallTile('Site Visit', pipeline['siteVisits'] ?? 0),
                        _smallTile(
                          'Closed Won',
                          pipeline['closedWon'] ?? 0,
                          highlight: true,
                        ),
                        _smallTile(
                          'Avg Response',
                          pipeline['avgResponseTime'] ?? '—',
                        ),
                      ],
                    ),
                  ),
                  if (hasPipeline)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                      child: _progressRow(
                        'Conversion Rate',
                        (pipeline['conversionRate'] as num?) ?? 0,
                        AppColors.primary,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Project Pipeline
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.of(context).border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: const BoxDecoration(color: Color(0x116366F1)),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.folder_copy,
                          size: 14,
                          color: Color(0xFF6366F1),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Project Pipeline',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${project['totalAssigned'] ?? 0} leads',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: [
                        GridView.count(
                          crossAxisCount: 4,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 6,
                          crossAxisSpacing: 6,
                          childAspectRatio: 1.1,
                          children: [
                            _smallTile(
                              'Assigned',
                              project['totalAssigned'] ?? 0,
                            ),
                            _smallTile(
                              'Interested',
                              project['interested'] ?? 0,
                            ),
                            _smallTile(
                              'Site Visit',
                              project['siteVisits'] ?? 0,
                              note:
                                  ((project['siteVisitDone'] as num?) ?? 0) > 0
                                  ? '${project['siteVisitDone']} done'
                                  : null,
                            ),
                            _smallTile(
                              'Booked',
                              project['booked'] ?? 0,
                              highlight: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        GridView.count(
                          crossAxisCount: 3,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 6,
                          crossAxisSpacing: 6,
                          childAspectRatio: 1.7,
                          children: [
                            _smallTile('Call Back', project['callBack'] ?? 0),
                            _smallTile(
                              'Not Interested',
                              project['notInterested'] ?? 0,
                            ),
                            _smallTile(
                              'Not Reachable',
                              project['notReachable'] ?? 0,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (hasProject)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                      child: _progressRow(
                        'Booking Rate',
                        (project['conversionRate'] as num?) ?? 0,
                        const Color(0xFF6366F1),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ];
  }
}
