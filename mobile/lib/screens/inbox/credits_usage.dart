import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat, NumberFormat;

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/date_range_picker.dart';

/// "Credits utilization": where the messages and the money went in a period.
/// Mirrors UtilizationSection in frontend/src/pages/conversations/
/// CreditsPage.jsx against GET /credits/utilization (admins and managers):
/// totals, messages per day by type, the per-type table, who sent them and
/// the campaigns in the period.
class CreditsUsageSection extends StatefulWidget {
  const CreditsUsageSection({super.key});

  @override
  State<CreditsUsageSection> createState() => _CreditsUsageSectionState();
}

/// Query params for a picker value, as the web sends them: a custom range is
/// from/to, a preset is dateRange, and "Maximum" is dateRange=all.
Map<String, String> creditRangeParams(dynamic value) => dateRangeParams(value) ?? const {'dateRange': 'all'};

class _CreditsUsageSectionState extends State<CreditsUsageSection> {
  dynamic _range = 'last30days';
  Map<String, dynamic>? _data;
  bool _loading = true;
  int? _picked; // the tapped day in the chart

  static const _colors = {'marketing': Color(0xFFEA580C), 'service': Color(0xFF2563EB), 'other': Color(0xFF0D9488)};
  static const _labels = {'marketing': 'Marketing', 'service': 'Replies', 'other': 'Utility & other'};
  // Meta's published India rates in paise (before GST), as the web shows
  // them for a company billed directly by Meta.
  static const _metaRate = {'marketing': 86.31, 'service': 11.5, 'utility': 11.5, 'authentication': 11.5};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.dio.get('/credits/utilization', queryParameters: creditRangeParams(_range));
      if (mounted) setState(() => _data = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not load usage'))));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static String _num(num? n) => NumberFormat.decimalPattern('en_IN').format(n ?? 0);
  static String _rupees(num? paise) => '₹${NumberFormat('#,##0.00', 'en_IN').format(((paise ?? 0) / 100).abs())}';
  static String _rate(num? paise) => '₹${NumberFormat('#,##0.00#', 'en_IN').format((paise ?? 0) / 100)}';
  static String _day(String iso) {
    final d = DateTime.tryParse('${iso}T00:00:00Z');
    return d == null ? iso : DateFormat('d MMM').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final data = _data;
    final direct = data?['billedDirectlyByMeta'] == true;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(Icons.bar_chart_rounded, size: 18, color: t.textSoft),
                    const SizedBox(width: 6),
                    Text('Credits utilization', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: t.text)),
                  ]),
                  const SizedBox(height: 2),
                  Text(
                    direct
                        ? 'What your WhatsApp messages are costing you, by type and by who sent them'
                        : 'Where your credits are going, by message type and by who sent them',
                    style: TextStyle(fontSize: 12, color: t.textSoft),
                  ),
                  const SizedBox(height: 6),
                  Text(dateRangeLabel(_range), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ),
              DateRangePicker(
                value: _range,
                onChanged: (v) {
                  setState(() {
                    _range = v;
                    _picked = null;
                  });
                  _load();
                },
              ),
            ]),
            if (_loading && data == null)
              const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
            else if (data != null)
              Opacity(opacity: _loading ? 0.6 : 1, child: _body(t, data, direct)),
          ],
        ),
      ),
    );
  }

  Widget _body(AppTheme t, Map<String, dynamic> data, bool direct) {
    final totals = (data['totals'] as Map?)?.cast<String, dynamic>() ?? const {};
    final days = [for (final d in (data['days'] as List?) ?? const []) if (d is Map) d.cast<String, dynamic>()];
    final categories = [for (final c in (data['categories'] as List?) ?? const []) if (c is Map) c.cast<String, dynamic>()];
    final sources = (data['sources'] as Map?)?.cast<String, dynamic>() ?? const {};
    final campaigns = [for (final c in (sources['campaigns'] as List?) ?? const []) if (c is Map) c.cast<String, dynamic>()];
    final campaignTotal = campaigns.fold<num>(0, (a, c) => a + ((c['messages'] as num?) ?? 0));
    final sourceTotal = ((sources['bot'] as num?) ?? 0) + ((sources['team'] as num?) ?? 0) + campaignTotal;
    int pct(num n) => sourceTotal == 0 ? 0 : (n / sourceTotal * 100).round();

    final tiles = [
      ('Messages sent', _num(totals['messages'] as num?), 'all outgoing WhatsApp messages'),
      ('Free replies', _num(totals['free'] as num?), 'covered by the monthly allowance'),
      ('Paid messages', _num(totals['paid'] as num?), 'marketing, utility and replies past the allowance'),
      direct
          ? ('Estimated Meta charge', _rupees(totals['estMetaPaise'] as num?), "before GST, on Meta's published rates")
          : ('Credits spent', _rupees(totals['spentPaise'] as num?), 'taken from your wallet, before GST'),
    ];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 12),
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1.45,
        children: [
          for (final (label, value, hint) in tiles)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(16), border: Border.all(color: t.border)),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                const SizedBox(height: 2),
                FittedBox(
                  child: Text(value,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: t.text, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
                const SizedBox(height: 2),
                Text(hint, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, color: t.textSoft)),
              ]),
            ),
        ],
      ),
      if (((totals['messages'] as num?) ?? 0) == 0)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 28),
          child: Center(child: Text('No messages were sent in this period.', style: TextStyle(fontSize: 13, color: t.textSoft))),
        )
      else ...[
        const SizedBox(height: 16),
        Text('Messages sent per day', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSoft)),
        const SizedBox(height: 6),
        Wrap(spacing: 12, runSpacing: 4, children: [
          for (final k in _colors.keys)
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: _colors[k], borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 5),
              Text(_labels[k]!, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ]),
        ]),
        const SizedBox(height: 8),
        LayoutBuilder(builder: (context, box) {
          return GestureDetector(
            onTapDown: (d) {
              if (days.isEmpty) return;
              final i = ((d.localPosition.dx - _DayBars.leftPad) / ((box.maxWidth - _DayBars.leftPad) / days.length)).floor();
              setState(() => _picked = i.clamp(0, days.length - 1));
            },
            child: SizedBox(
              height: 180,
              width: box.maxWidth,
              child: CustomPaint(
                painter: _DayBars(
                  days: days,
                  colors: _colors,
                  grid: t.border,
                  text: t.textSoft,
                  picked: _picked,
                  label: _day,
                ),
              ),
            ),
          );
        }),
        if (_picked != null && _picked! < days.length) _pickedDay(t, days[_picked!]),
        const SizedBox(height: 14),
        for (final c in categories) _categoryRow(t, c, direct),
        const SizedBox(height: 14),
        Text('Who sent them', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSoft)),
        const SizedBox(height: 6),
        for (final (label, n) in [
          ('Assistant and button flow', (sources['bot'] as num?) ?? 0),
          ('Your team', (sources['team'] as num?) ?? 0),
          ('Campaigns', campaignTotal),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(label, style: TextStyle(fontSize: 12.5, color: t.text))),
                Text('${_num(n)} · ${pct(n)}%', style: TextStyle(fontSize: 12, color: t.textSoft)),
              ]),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct(n) / 100,
                  minHeight: 6,
                  backgroundColor: t.surfaceLow,
                  color: AppColors.primary,
                ),
              ),
            ]),
          ),
        const SizedBox(height: 8),
        Text('Campaigns in this period', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSoft)),
        const SizedBox(height: 4),
        if (campaigns.isEmpty)
          Text('No campaign messages were sent.', style: TextStyle(fontSize: 12, color: t.textSoft))
        else
          for (final c in campaigns.take(6))
            Container(
              padding: const EdgeInsets.symmetric(vertical: 7),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: t.border))),
              child: Row(children: [
                Expanded(child: Text('${c['name'] ?? ''}', overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: t.text))),
                Text('${_num(c['messages'] as num?)} sent', style: TextStyle(fontSize: 12, color: t.textSoft)),
              ]),
            ),
        const SizedBox(height: 12),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.info_outline_rounded, size: 14, color: t.textSoft),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '${direct ? "Your messages are billed by Meta to your own account, not from this wallet. Estimates use Meta's published India rates before GST and assume each free reply is covered by the monthly allowance. Meta's invoice is the final figure." : 'Credits spent is what was taken from your wallet, before GST. Free replies use the monthly allowance and cost nothing.'} Messages that failed to send are not counted.',
              style: TextStyle(fontSize: 11, height: 1.4, color: t.textSoft),
            ),
          ),
        ]),
      ],
    ]);
  }

  Widget _pickedDay(AppTheme t, Map<String, dynamic> d) => Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(10), border: Border.all(color: t.border)),
        child: Wrap(spacing: 12, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text(_day('${d['date']}'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.text)),
          for (final k in _colors.keys)
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: _colors[k], borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 4),
              Text('${_labels[k]} ${_num(d[k] as num?)}', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ]),
        ]),
      );

  Widget _categoryRow(AppTheme t, Map<String, dynamic> c, bool direct) {
    final cat = '${c['category']}';
    final colorKey = cat == 'marketing' || cat == 'service' ? cat : 'other';
    final other = cat == 'other';
    final rate = other ? null : (direct ? _metaRate[cat] : (c['ratePaise'] as num?));
    final cost = other ? null : (direct ? c['estMetaPaise'] : c['spentPaise']) as num?;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: t.border))),
      child: Row(children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: _colors[colorKey], borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${c['label'] ?? cat}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.text)),
            Text(
              '${_num(c['messages'] as num?)} sent · ${_num(c['free'] as num?)} free · ${_num(c['paid'] as num?)} paid'
              '${rate != null ? ' · ${_rate(rate)} each' : ''}',
              style: TextStyle(fontSize: 11.5, color: t.textSoft),
            ),
          ]),
        ),
        Text(cost == null ? '—' : _rupees(cost), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.text)),
      ]),
    );
  }
}

/// Stacked bars, one per day: replies, marketing, utility & other.
class _DayBars extends CustomPainter {
  _DayBars({required this.days, required this.colors, required this.grid, required this.text, required this.picked, required this.label});

  final List<Map<String, dynamic>> days;
  final Map<String, Color> colors;
  final Color grid;
  final Color text;
  final int? picked;
  final String Function(String) label;

  static const leftPad = 28.0;
  static const bottomPad = 18.0;

  @override
  void paint(Canvas canvas, Size size) {
    if (days.isEmpty) return;
    final chartH = size.height - bottomPad;
    final chartW = size.width - leftPad;
    num total(Map<String, dynamic> d) => ((d['service'] as num?) ?? 0) + ((d['marketing'] as num?) ?? 0) + ((d['other'] as num?) ?? 0);
    final peak = days.map(total).fold<num>(0, (a, b) => b > a ? b : a);
    final top = _niceTop(peak.toDouble());

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = chartH - chartH * i / 3;
      canvas.drawLine(Offset(leftPad, y), Offset(size.width, y), gridPaint);
      _text(canvas, '${(top * i / 3).round()}', Offset(0, y - 6), 10, leftPad - 4, TextAlign.right);
    }

    final slot = chartW / days.length;
    final barW = (slot * 0.7).clamp(1.5, 26.0);
    for (var i = 0; i < days.length; i++) {
      final d = days[i];
      final x = leftPad + slot * i + (slot - barW) / 2;
      var y = chartH;
      for (final k in ['service', 'marketing', 'other']) {
        final v = ((d[k] as num?) ?? 0).toDouble();
        if (v <= 0) continue;
        final h = chartH * v / top;
        final paint = Paint()..color = colors[k]!.withValues(alpha: picked == null || picked == i ? 1 : 0.45);
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y - h, barW, h), const Radius.circular(2)), paint);
        y -= h;
      }
    }

    // A few dates along the bottom: first, middle, last.
    final ticks = days.length <= 3 ? List.generate(days.length, (i) => i) : [0, days.length ~/ 2, days.length - 1];
    for (final i in ticks) {
      final cx = leftPad + slot * i + slot / 2;
      final align = i == 0 ? TextAlign.left : (i == days.length - 1 ? TextAlign.right : TextAlign.center);
      final w = 60.0;
      final left = align == TextAlign.left ? cx - slot / 2 : (align == TextAlign.right ? cx + slot / 2 - w : cx - w / 2);
      _text(canvas, label('${days[i]['date']}'), Offset(left, chartH + 4), 10, w, align);
    }
  }

  double _niceTop(double peak) {
    if (peak <= 3) return 3;
    final step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].firstWhere((s) => peak / s <= 3, orElse: () => 10000);
    return step * 3.0;
  }

  void _text(Canvas canvas, String s, Offset at, double size, double width, TextAlign align) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, color: text)),
      textAlign: align,
      textDirection: TextDirection.ltr,
    )..layout(minWidth: width, maxWidth: width);
    tp.paint(canvas, at);
  }

  @override
  bool shouldRepaint(_DayBars old) => old.days != days || old.picked != picked || old.grid != grid;
}
