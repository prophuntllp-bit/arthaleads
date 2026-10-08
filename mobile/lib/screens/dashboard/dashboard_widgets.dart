import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/glass.dart';

// Dashboard pieces ported from the web dashboard (frontend/src/components/
// dashboard/*.jsx and pages/Dashboard.jsx), so both apps show the same
// numbers the same way. Everything here follows the dashboard's date range.

/// "in the last 30 days", "today", ... — same phrases as the web.
const _rangePhrases = {
  'today': 'today',
  'yesterday': 'yesterday',
  'todayYesterday': 'today and yesterday',
  'last7days': 'in the last 7 days',
  'last14days': 'in the last 14 days',
  'last28days': 'in the last 28 days',
  'last30days': 'in the last 30 days',
  'thisweek': 'this week',
  'lastweek': 'last week',
  'thismonth': 'this month',
  'lastmonth': 'last month',
  'thisyear': 'this year',
  'lastyear': 'last year',
};

String describeRange(dynamic range) {
  if (range is Map) {
    String f(String? k) {
      final d = DateTime.tryParse(k ?? '');
      return d == null ? '' : DateFormat('d MMM').format(d);
    }
    final from = range['from'] as String?, to = range['to'] as String?;
    return from != null && to != null ? 'from ${f(from)} to ${f(to)}' : 'in this period';
  }
  if (range == null || range == '') return 'across all time';
  return _rangePhrases[range] ?? 'in this period';
}

/// A small "?" that explains a number or widget. Tap to read (phones have no
/// hover). Same wording as the web dashboard's InfoTip.
class InfoTip extends StatelessWidget {
  const InfoTip(this.text, {super.key, this.size = 14});

  final String text;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: text,
      triggerMode: TooltipTriggerMode.tap,
      showDuration: const Duration(seconds: 8),
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      textStyle: const TextStyle(fontSize: 12.5, height: 1.35, color: Colors.white),
      decoration: BoxDecoration(color: const Color(0xFF26262B), borderRadius: BorderRadius.circular(10)),
      child: Semantics(
        label: 'More info',
        button: true,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Icon(Icons.help_outline_rounded, size: size, color: AppTheme.of(context).textSoft),
        ),
      ),
    );
  }
}

// ── Source colours ──────────────────────────────────────────────────────────
// Fixed per source (colour follows the source, never its rank), five named
// slots then "Other". Same validated palette as the web (styles.css --src-*),
// with its own dark-mode steps.
const _sourceSlot = {'Facebook': 1, 'Website': 2, 'WhatsApp': 3, 'Vistrow Voice': 4, 'Google': 5};
const _otherSlot = 6;
const _srcLight = [Color(0xFF2563EB), Color(0xFFEA580C), Color(0xFF16A34A), Color(0xFF7C3AED), Color(0xFF0891B2), Color(0xFFDB2777)];
const _srcDark = [Color(0xFF3B82F6), Color(0xFFEA580C), Color(0xFF16A34A), Color(0xFF8B5CF6), Color(0xFF0891B2), Color(0xFFEC4899)];

int sourceSlot(String name) => _sourceSlot[name] ?? _otherSlot;
Color sourceColor(BuildContext context, String name) {
  final list = AppTheme.of(context).isDark ? _srcDark : _srcLight;
  return list[sourceSlot(name) - 1];
}

/// Card title block. The date range sits on its own line under the title (a
/// phone is too narrow to fit it in the pill without cutting it off); the pill
/// is kept for a short figure such as "53 leads".
Widget dashCardHeader(BuildContext context, String kicker, String title, {String? pill, String? scope, String? tip}) {
  final t = AppTheme.of(context);
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(kicker.toUpperCase(), style: AppText.kicker(context)),
            const SizedBox(height: 2),
            Row(
              children: [
                Flexible(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
                if (tip != null) InfoTip(tip),
              ],
            ),
            if (scope != null && scope.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('Leads created $scope', style: TextStyle(fontSize: 11, color: t.textSoft)),
              ),
          ],
        ),
      ),
      if (pill != null && pill.isNotEmpty)
        Container(
            margin: const EdgeInsets.only(left: 8),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: t.border),
              color: t.surfaceLow,
            ),
            child: Text(pill,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, color: t.textSoft, fontWeight: FontWeight.w600)),
        ),
    ],
  );
}

// ── Leads by Status ─────────────────────────────────────────────────────────
// One row per pipeline stage, in pipeline order, for the selected range.
// Replaces both the old status bars and the separate Pipeline Drop-off card,
// which showed the same numbers twice.
class DashStatusBreakdown extends StatelessWidget {
  const DashStatusBreakdown({super.key, required this.byStatus, required this.scope, this.onSelect});

  final Map byStatus;
  final String scope;
  final ValueChanged<String>? onSelect;

  static const stages = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed Won', 'Closed Lost'];

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    int count(String s) => (byStatus[s] as num?)?.toInt() ?? 0;
    final total = stages.fold<int>(0, (n, s) => n + count(s));
    final max = stages.fold<int>(1, (m, s) => math.max(m, count(s)));
    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dashCardHeader(context, 'Pipeline', 'Leads by Status', pill: '$total leads', scope: scope,
              tip: 'Where the leads from these dates are in your pipeline right now. Tap a stage to see those leads.'),
          const SizedBox(height: 10),
          if (total == 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('No leads in this period', style: TextStyle(color: t.textSoft, fontSize: 13))),
            )
          else
            for (final s in stages)
              InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: count(s) > 0 && onSelect != null ? () => onSelect!(s) : null,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 84,
                        child: Text(s,
                            style: TextStyle(fontSize: 12, color: count(s) > 0 ? t.text : t.textSoft)),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: Container(
                            height: 9,
                            color: t.surfaceLow,
                            alignment: Alignment.centerLeft,
                            child: count(s) == 0
                                ? null
                                : FractionallySizedBox(
                                    widthFactor: math.max(count(s) / max, 0.02),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: statusColor(s),
                                        borderRadius: BorderRadius.circular(99),
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 40,
                        child: Text('${count(s)}',
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: count(s) > 0 ? t.text : t.textSoft,
                              fontFeatures: const [FontFeature.tabularFigures()],
                            )),
                      ),
                      SizedBox(
                        width: 38,
                        child: Text('${(count(s) / total * 100).round()}%',
                            textAlign: TextAlign.right,
                            style: TextStyle(fontSize: 11, color: t.textSoft)),
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

// ── Leads by Source (donut) ─────────────────────────────────────────────────
class _SrcRow {
  final String name;
  final int value;
  final int slot;
  final List<String> parts;
  _SrcRow(this.name, this.value, this.slot, [this.parts = const []]);
}

List<_SrcRow> _sourceRows(Map bySource) {
  final rows = <_SrcRow>[];
  var other = 0;
  final parts = <String>[];
  bySource.forEach((k, v) {
    final n = (v as num?)?.toInt() ?? 0;
    if (n <= 0) return;
    final name = '$k';
    if (_sourceSlot.containsKey(name)) {
      rows.add(_SrcRow(name, n, _sourceSlot[name]!));
    } else {
      other += n;
      parts.add('${name.isEmpty ? 'Unknown' : name} $n');
    }
  });
  rows.sort((a, b) => a.slot.compareTo(b.slot));
  if (other > 0) rows.add(_SrcRow('Other', other, _otherSlot, parts));
  return rows;
}

class DashSourceDonut extends StatefulWidget {
  const DashSourceDonut({super.key, required this.bySource, required this.scope, this.onSelect});

  final Map bySource;
  final String scope;
  final ValueChanged<String>? onSelect;

  @override
  State<DashSourceDonut> createState() => _DashSourceDonutState();
}

class _DashSourceDonutState extends State<DashSourceDonut> {
  String? _active;

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final rows = _sourceRows(widget.bySource);
    final total = rows.fold<int>(0, (n, r) => n + r.value);
    final palette = t.isDark ? _srcDark : _srcLight;
    final focus = _active == null ? null : rows.where((r) => r.name == _active).firstOrNull;

    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dashCardHeader(context, 'Acquisition mix', 'Leads by Source', scope: widget.scope,
              tip: 'Where the leads from these dates came from. Tap a source to see its leads.'),
          const SizedBox(height: 12),
          if (total == 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('No leads in this period', style: TextStyle(color: t.textSoft, fontSize: 13))),
            )
          else ...[
            Center(
              child: SizedBox(
                width: 176,
                height: 176,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size.square(176),
                      painter: _DonutPainter(
                        values: [for (final r in rows) r.value.toDouble()],
                        colors: [for (final r in rows) palette[r.slot - 1]],
                        track: t.surfaceLow,
                        highlight: focus == null ? null : rows.indexOf(focus),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${focus?.value ?? total}',
                            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                        Text(focus?.name ?? 'leads', style: TextStyle(fontSize: 11, color: t.textSoft)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            for (final r in rows)
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () {
                  if (r.slot != _otherSlot && widget.onSelect != null) {
                    widget.onSelect!(r.name);
                  } else {
                    setState(() => _active = _active == r.name ? null : r.name);
                  }
                },
                onLongPress: () => setState(() => _active = _active == r.name ? null : r.name),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 7),
                  decoration: BoxDecoration(
                    color: _active == r.name ? t.surfaceLow : null,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(color: palette[r.slot - 1], shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          r.parts.isEmpty ? r.name : '${r.name} (${r.parts.join(', ')})',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                      Text('${r.value}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      SizedBox(
                        width: 42,
                        child: Text('${(r.value / total * 100).round()}%',
                            textAlign: TextAlign.right,
                            style: TextStyle(fontSize: 11, color: t.textSoft)),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.values, required this.colors, required this.track, this.highlight});

  final List<double> values;
  final List<Color> colors;
  final Color track;
  final int? highlight;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 22.0;
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - stroke / 2 - 4;
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(center, radius, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track);
    final total = values.fold<double>(0, (a, b) => a + b);
    if (total <= 0) return;
    // A small surface gap between slices (none when there is only one).
    final gap = values.where((v) => v > 0).length > 1 ? 0.035 : 0.0;
    var start = -math.pi / 2;
    for (var i = 0; i < values.length; i++) {
      final sweep = values[i] / total * 2 * math.pi;
      final dim = highlight != null && highlight != i;
      canvas.drawArc(
        rect,
        start + gap / 2,
        math.max(sweep - gap, 0.01),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = highlight == i ? stroke + 6 : stroke
          ..color = dim ? colors[i].withValues(alpha: 0.35) : colors[i],
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.values != values || old.highlight != highlight || old.track != track;
}

// ── Sources this period ─────────────────────────────────────────────────────
// Which source brings leads that actually go somewhere, not just how many.
class DashSourcePerformance extends StatelessWidget {
  const DashSourcePerformance({super.key, required this.rows, required this.scope, this.onSelect});

  final List<Map<String, dynamic>> rows;
  final String scope;
  final ValueChanged<String>? onSelect;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    int n(Map r, String k) => (r[k] as num?)?.toInt() ?? 0;
    final tot = {
      for (final k in ['leads', 'contacted', 'visits', 'won']) k: rows.fold<int>(0, (s, r) => s + n(r, k)),
    };
    String pct(int part, int whole) => whole == 0 ? '-' : '${(part / whole * 100).round()}%';
    TextStyle head = TextStyle(fontSize: 10, letterSpacing: 0.6, fontWeight: FontWeight.w700, color: t.textSoft);
    const numStyle = TextStyle(fontSize: 13, fontWeight: FontWeight.w600, fontFeatures: [FontFeature.tabularFigures()]);

    Widget row(String source, int leads, int contacted, int visits, int won, {bool bold = false, VoidCallback? onTap}) {
      final style = bold ? numStyle.copyWith(fontWeight: FontWeight.w800) : numStyle;
      return InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Row(
            children: [
              Expanded(
                flex: 5,
                child: Row(
                  children: [
                    if (!bold) ...[
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(color: sourceColor(context, source), shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: Text(source,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
                    ),
                  ],
                ),
              ),
              Expanded(flex: 2, child: Text('$leads', textAlign: TextAlign.right, style: style)),
              Expanded(flex: 3, child: Text(pct(contacted, leads), textAlign: TextAlign.right, style: style)),
              Expanded(flex: 2, child: Text('$visits', textAlign: TextAlign.right, style: style)),
              Expanded(flex: 2, child: Text('$won', textAlign: TextAlign.right, style: style)),
            ],
          ),
        ),
      );
    }

    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          dashCardHeader(context, 'Source quality', 'Sources this period', scope: scope,
              tip: 'Which source brings leads that go somewhere, not just the most leads. Tap a source to see its leads.'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(flex: 5, child: Text('SOURCE', style: head)),
              // Short labels that always fit their column (the full word still
              // reads in the note under the table).
              for (final (flex, label) in const [(2, 'LEADS'), (3, 'CONTACT'), (2, 'VISITS'), (2, 'WON')])
                Expanded(
                  flex: flex,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerRight,
                      child: Text(label, maxLines: 1, style: head),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          for (final r in rows)
            row('${r['source'] ?? 'Unknown'}', n(r, 'leads'), n(r, 'contacted'), n(r, 'visits'), n(r, 'won'),
                onTap: onSelect == null ? null : () => onSelect!('${r['source']}')),
          row('All sources', tot['leads']!, tot['contacted']!, tot['visits']!, tot['won']!, bold: true),
          const SizedBox(height: 6),
          Text('Contact: moved past New. Visits: reached Site Visit or later, or has a visit date.',
              style: TextStyle(fontSize: 10.5, color: t.textSoft)),
        ],
      ),
    );
  }
}

// ── Leads over time ─────────────────────────────────────────────────────────
// Per day for ranges up to ~3 months, per month beyond that, filling in the
// empty days so a quiet day reads as zero rather than disappearing.
class DashLeadsTrend extends StatelessWidget {
  const DashLeadsTrend({super.key, required this.data, required this.scope});

  final Map<String, dynamic> data;
  final String scope;

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final counts = <String, int>{
      for (final r in (data['dailyLeads'] as List? ?? []).cast<Map>())
        '${r['_id']}': (r['count'] as num?)?.toInt() ?? 0,
    };
    final monthly = data['trendBucket'] == 'month';
    final keys = <String>[];
    if (!monthly) {
      final start = DateTime.tryParse('${data['rangeStartKey']}T00:00:00Z');
      final end = DateTime.tryParse('${data['rangeEndKey']}T00:00:00Z');
      if (start != null && end != null) {
        for (var d = start; !d.isAfter(end) && keys.length < 120; d = d.add(const Duration(days: 1))) {
          keys.add(d.toIso8601String().substring(0, 10));
        }
      }
    } else {
      final present = counts.keys.toList()..sort();
      final first = (data['rangeStartKey'] as String?)?.substring(0, 7) ?? (present.isEmpty ? null : present.first);
      final last = (data['rangeEndKey'] as String?)?.substring(0, 7) ?? (present.isEmpty ? null : present.last);
      if (first != null && last != null) {
        var y = int.parse(first.substring(0, 4)), m = int.parse(first.substring(5, 7));
        final ey = int.parse(last.substring(0, 4)), em = int.parse(last.substring(5, 7));
        while ((y < ey || (y == ey && m <= em)) && keys.length < 60) {
          keys.add('$y-${m.toString().padLeft(2, '0')}');
          m += 1;
          if (m > 12) { m = 1; y += 1; }
        }
      }
    }
    final values = [for (final k in keys) counts[k] ?? 0];
    final total = values.fold<int>(0, (a, b) => a + b);
    String label(String k) => monthly
        ? DateFormat('MMM yy').format(DateTime.parse('$k-01'))
        : DateFormat('d MMM').format(DateTime.parse(k));

    return SoftSurface(
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
                    Text('TRENDS', style: AppText.kicker(context)),
                    const SizedBox(height: 2),
                    const Text('Leads Over Time', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('$total', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  Text(scope, style: TextStyle(fontSize: 10, color: t.textSoft)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (keys.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('No leads in this period', style: TextStyle(color: t.textSoft, fontSize: 13))),
            )
          else ...[
            SizedBox(
              height: 110,
              width: double.infinity,
              child: CustomPaint(
                painter: _TrendPainter(values: values, line: AppColors.primary, grid: t.border, text: t.textSoft),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(label(keys.first), style: TextStyle(fontSize: 10, color: t.textSoft)),
                const Spacer(),
                if (keys.length > 2)
                  Text(label(keys[keys.length ~/ 2]), style: TextStyle(fontSize: 10, color: t.textSoft)),
                if (keys.length > 2) const Spacer(),
                if (keys.length > 1)
                  Text(label(keys.last), style: TextStyle(fontSize: 10, color: t.textSoft)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({required this.values, required this.line, required this.grid, required this.text});

  final List<int> values;
  final Color line, grid, text;

  @override
  void paint(Canvas canvas, Size size) {
    final maxV = math.max(1, values.fold<int>(0, math.max));
    const left = 22.0, top = 6.0, bottom = 4.0;
    final w = size.width - left, h = size.height - top - bottom;
    // Faint grid with the top value labelled.
    final gridPaint = Paint()..color = grid..strokeWidth = 1;
    for (final f in [0.0, 0.5, 1.0]) {
      final y = top + h * (1 - f);
      canvas.drawLine(Offset(left, y), Offset(size.width, y), gridPaint);
      final tp = TextPainter(
        text: TextSpan(text: '${(maxV * f).round()}', style: TextStyle(fontSize: 9, color: text)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(0, y - tp.height / 2));
    }
    Offset pt(int i) => Offset(
          left + (values.length == 1 ? w / 2 : w * i / (values.length - 1)),
          top + h * (1 - values[i] / maxV),
        );
    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (var i = 1; i < values.length; i++) {
      final p0 = pt(i - 1), p1 = pt(i);
      final cx = (p0.dx + p1.dx) / 2;
      path.cubicTo(cx, p0.dy, cx, p1.dy, p1.dx, p1.dy);
    }
    final area = Path.from(path)
      ..lineTo(pt(values.length - 1).dx, top + h)
      ..lineTo(pt(0).dx, top + h)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [line.withValues(alpha: 0.22), line.withValues(alpha: 0.0)],
        ).createShader(Rect.fromLTWH(0, top, size.width, h)),
    );
    canvas.drawPath(path, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = line);
    if (values.length <= 14) {
      for (var i = 0; i < values.length; i++) {
        canvas.drawCircle(pt(i), 3, Paint()..color = line);
      }
    }
    // Emphasise the latest point.
    canvas.drawCircle(pt(values.length - 1), 4.5, Paint()..color = line);
  }

  @override
  bool shouldRepaint(_TrendPainter old) => old.values != values || old.line != line;
}

// ── Lead sources health ─────────────────────────────────────────────────────
// Is every source actually sending leads? Shows each one's last lead and goes
// amber after a day of silence, problems first.
const _genericName = r'^(wordpress site|website|my site)( \d+)?$';

String _hostOf(String url) {
  final u = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
  return (u?.host ?? url).replaceFirst(RegExp(r'^www\.'), '');
}

/// Same naming as the web's ConnectionCard: the site's own name, then its
/// domain when the saved name is a placeholder, then the typed label.
String connectionTitle(Map a) {
  final name = '${a['name'] ?? ''}'.trim();
  if (a['platform'] != 'Website Form') return name.isNotEmpty ? name : '${a['platform'] ?? ''}';
  final generic = RegExp(_genericName, caseSensitive: false);
  final siteName = '${a['siteName'] ?? ''}'.trim();
  final host = '${a['siteUrl'] ?? ''}'.isNotEmpty ? _hostOf('${a['siteUrl']}') : '';
  if (siteName.isNotEmpty && !generic.hasMatch(siteName)) return siteName;
  if (host.isNotEmpty && generic.hasMatch(name)) return host;
  return name.isNotEmpty ? name : (host.isNotEmpty ? host : 'Website');
}

String _ago(DateTime d) {
  final min = DateTime.now().difference(d).inMinutes;
  if (min < 1) return 'just now';
  if (min < 60) return '$min min ago';
  if (min < 1440) return '${min ~/ 60} hr ago';
  final days = min ~/ 1440;
  return days == 1 ? 'yesterday' : '$days days ago';
}

class DashSourcesHealth extends StatelessWidget {
  const DashSourcesHealth({super.key, required this.automations, required this.iconFor, this.onOpen});

  final List<Map<String, dynamic>> automations;
  final IconData Function(String? platform) iconFor;
  final VoidCallback? onOpen;

  static const _quietHours = 24;

  @override
  Widget build(BuildContext context) {
    if (automations.isEmpty) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    String stateOf(Map a) {
      final last = DateTime.tryParse('${a['lastSyncAt'] ?? ''}');
      if (a['isActive'] == false || a['status'] == 'paused' || a['status'] == 'error') return 'off';
      if (a['status'] != 'connected') return 'setup';
      if (last == null) return 'never';
      return DateTime.now().difference(last).inHours > _quietHours ? 'quiet' : 'ok';
    }

    const rank = {'off': 0, 'quiet': 1, 'never': 2, 'setup': 3, 'ok': 4};
    final rows = [for (final a in automations) (a: a, state: stateOf(a))]
      ..sort((x, y) => rank[x.state]!.compareTo(rank[y.state]!));
    final problems = rows.where((r) => r.state == 'off' || r.state == 'quiet').length;
    Color dot(String s) => switch (s) {
          'ok' => AppColors.success,
          'quiet' => AppColors.warning,
          'off' => AppColors.danger,
          _ => t.textSoft,
        };
    String line(Map a, String s) => switch (s) {
          'off' => a['status'] == 'paused' ? 'Paused' : 'Turned off',
          'setup' => 'Not set up yet',
          'never' => 'No leads yet',
          _ => 'Last lead ${_ago(DateTime.parse('${a['lastSyncAt']}').toLocal())}',
        };

    return SoftSurface(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('INTEGRATIONS', style: AppText.kicker(context)),
                    const SizedBox(height: 2),
                    const Row(
                      children: [
                        Flexible(child: Text('Lead Sources Health', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
                        InfoTip('Each connected lead source and when its last lead arrived. Amber means no lead for 24 hours, which can mean a connection has broken.'),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: (problems > 0 ? AppColors.warning : AppColors.success).withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(problems > 0 ? '$problems need a look' : 'All sending',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: problems > 0 ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                    )),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final r in rows)
            InkWell(
              onTap: onOpen,
              borderRadius: BorderRadius.circular(13),
              child: Container(
                margin: const EdgeInsets.only(bottom: 7),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: t.surfaceLow,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: t.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(color: t.border),
                      ),
                      child: r.a['platform'] == 'Website Form' && '${r.a['siteUrl'] ?? ''}'.isNotEmpty
                          ? Image.network(
                              'https://www.google.com/s2/favicons?domain=${Uri.encodeComponent(_hostOf('${r.a['siteUrl']}'))}&sz=64',
                              width: 20,
                              height: 20,
                              errorBuilder: (_, _, _) => Icon(iconFor(r.a['platform'] as String?), size: 16, color: Colors.black87),
                            )
                          : Icon(iconFor(r.a['platform'] as String?), size: 16, color: Colors.black87),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(connectionTitle(r.a),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                          Text(line(r.a, r.state),
                              style: TextStyle(
                                fontSize: 11,
                                color: r.state == 'quiet'
                                    ? const Color(0xFFD97706)
                                    : r.state == 'off'
                                        ? AppColors.danger
                                        : t.textSoft,
                              )),
                        ],
                      ),
                    ),
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: dot(r.state), shape: BoxShape.circle)),
                  ],
                ),
              ),
            ),
          Text('Amber: no lead in the last $_quietHours hours.', style: TextStyle(fontSize: 10.5, color: t.textSoft)),
        ],
      ),
    );
  }
}
