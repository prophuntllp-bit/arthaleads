import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import 'glass.dart';

/// Building blocks for the Integrations detail screens (Telephony, Plivo,
/// Property portals, Website forms, Conversion tracking, Routing), the app's
/// version of the web's components/integrations/IntegrationUI.jsx (29 Oct
/// 2026): a status header, stat tiles, tabs, key/value panels, copy and
/// secret fields, and setup steps, all in the app's own surfaces.

/// A brand logo bundled in assets/images/brand_*.
class BrandLogo extends StatelessWidget {
  final String brand; // plivo, enablex, meta, 99acres, housing, magicbricks
  final double size;
  const BrandLogo(this.brand, {super.key, this.size = 44});

  static const _files = {
    'plivo': 'brand_plivo.png',
    'enablex': 'brand_enablex.png',
    'meta': 'brand_meta.jpg',
    '99acres': 'brand_99acres.png',
    'housing': 'brand_housing.png',
    'magicbricks': 'brand_magicbricks.png',
  };

  @override
  Widget build(BuildContext context) {
    final file = _files[brand];
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(brand == 'meta' ? size * 0.04 : size * 0.18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.3),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: file == null
          ? Icon(Icons.extension_rounded, color: AppColors.primary, size: size * 0.5)
          : ClipRRect(
              borderRadius: BorderRadius.circular(size * 0.18),
              child: Image.asset('assets/images/$file', fit: BoxFit.contain),
            ),
    );
  }
}

/// Green / grey / amber / red status pill.
class StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  const StatusPill(this.label, {super.key, required this.color});

  static StatusPill on(String label) => StatusPill(label, color: AppColors.success);
  static StatusPill off(String label) => StatusPill(label, color: const Color(0xFF94A3B8));
  static StatusPill warn(String label) => StatusPill(label, color: const Color(0xFFD97706));
  static StatusPill bad(String label) => StatusPill(label, color: AppColors.danger);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ]),
      );
}

/// Logo, name, one-line description and status, with actions underneath.
class IntegrationHeader extends StatelessWidget {
  final Widget logo;
  final String title;
  final String subtitle;
  final Widget? status;
  final List<Widget> actions;
  const IntegrationHeader({
    super.key,
    required this.logo,
    required this.title,
    required this.subtitle,
    this.status,
    this.actions = const [],
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        logo,
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: t.text)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            if (status != null) ...[const SizedBox(height: 8), status!],
          ]),
        ),
      ]),
      if (actions.isNotEmpty) ...[
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: actions),
      ],
    ]);
  }
}

/// One stat tile: a small label, a big value, an optional note.
class MiniStat {
  final String label;
  final String value;
  final String? note;
  const MiniStat(this.label, this.value, [this.note]);
}

/// Stat tiles, two per row on a phone.
class MiniStatGrid extends StatelessWidget {
  final List<MiniStat> stats;
  const MiniStatGrid(this.stats, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return LayoutBuilder(builder: (context, c) {
      final w = (c.maxWidth - 10) / 2;
      return Wrap(spacing: 10, runSpacing: 10, children: [
        for (final s in stats)
          SizedBox(
            width: w,
            child: SoftSurface(
              radius: 16,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: t.textSoft)),
                const SizedBox(height: 4),
                Text(s.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.text)),
                if (s.note != null && s.note!.isNotEmpty)
                  Text(s.note!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, color: t.textSoft)),
              ]),
            ),
          ),
      ]);
    });
  }
}

/// Tabs as a row of chips, like the app's other filter rows.
class ChipTabs extends StatelessWidget {
  final List<String> tabs;
  final String value;
  final ValueChanged<String> onChanged;
  const ChipTabs({super.key, required this.tabs, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (final tab in tabs)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(tab),
                selected: tab == value,
                onSelected: (_) => onChanged(tab),
              ),
            ),
        ]),
      );
}

/// A titled card.
class PanelCard extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;
  const PanelCard({super.key, this.title, this.subtitle, required this.child, this.trailing});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return SoftSurface(
      radius: 18,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (title != null) ...[
          Row(children: [
            Expanded(child: Text(title!, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: t.text))),
            ?trailing,
          ]),
          if (subtitle != null) ...[
            const SizedBox(height: 3),
            Text(subtitle!, style: TextStyle(fontSize: 12, color: t.textSoft)),
          ],
          const SizedBox(height: 10),
        ],
        child,
      ]),
    );
  }
}

/// Label and value rows.
class KeyValueList extends StatelessWidget {
  final List<(String, String)> rows;
  const KeyValueList(this.rows, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(children: [
      for (final (k, v) in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 130, child: Text(k, style: TextStyle(fontSize: 12.5, color: t.textSoft))),
            Expanded(child: Text(v, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.text))),
          ]),
        ),
    ]);
  }
}

/// A read-only value (link, key, URL) with a Copy button.
class CopyField extends StatelessWidget {
  final String label;
  final String value;
  final String? note;
  const CopyField({super.key, required this.label, required this.value, this.note});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.text)),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
        decoration: BoxDecoration(
          color: t.surfaceLow,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: t.border),
        ),
        child: Row(children: [
          Expanded(
            child: SelectableText(value.isEmpty ? '—' : value,
                style: TextStyle(fontSize: 12, color: t.text, fontFamily: 'monospace')),
          ),
          IconButton(
            tooltip: 'Copy',
            icon: const Icon(Icons.copy_rounded, size: 18),
            onPressed: value.isEmpty
                ? null
                : () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(SnackBar(content: Text('$label copied')));
                  },
          ),
        ]),
      ),
      if (note != null) ...[
        const SizedBox(height: 4),
        Text(note!, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
      ],
    ]);
  }
}

/// A write-only secret (token, key): the saved one is never shown, only that
/// it exists; typing replaces it.
class SecretField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final bool saved;
  final String? savedHint;
  const SecretField({super.key, required this.label, required this.controller, required this.saved, this.savedHint});

  @override
  State<SecretField> createState() => _SecretFieldState();
}

class _SecretFieldState extends State<SecretField> {
  bool _show = false;

  @override
  Widget build(BuildContext context) => TextField(
        controller: widget.controller,
        obscureText: !_show,
        autocorrect: false,
        enableSuggestions: false,
        decoration: InputDecoration(
          labelText: widget.label,
          hintText: widget.saved ? (widget.savedHint ?? 'Saved. Paste a new one to replace it.') : null,
          floatingLabelBehavior: widget.saved ? FloatingLabelBehavior.always : null,
          suffixIcon: IconButton(
            tooltip: _show ? 'Hide' : 'Show',
            icon: Icon(_show ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 19),
            onPressed: () => setState(() => _show = !_show),
          ),
        ),
      );
}

/// Numbered setup steps.
class SetupSteps extends StatelessWidget {
  final List<(String, String)> steps;
  const SetupSteps(this.steps, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(children: [
      for (final (i, (title, body)) in steps.indexed)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Text('${i + 1}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.text)),
                const SizedBox(height: 2),
                Text(body, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
              ]),
            ),
          ]),
        ),
    ]);
  }
}

/// A red line for the last error a service reported.
class ErrorNote extends StatelessWidget {
  final String text;
  const ErrorNote(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
        ),
        child: Text(text, style: const TextStyle(fontSize: 12.5, color: AppColors.danger)),
      );
}

/// "29 Oct, 4:05 PM" in IST (the server sends UTC), or [empty].
String istTime(Object? iso, {String empty = '—'}) {
  final d = DateTime.tryParse('${iso ?? ''}');
  if (d == null) return empty;
  final ist = d.toUtc().add(const Duration(hours: 5, minutes: 30));
  return DateFormat('d MMM, h:mm a').format(ist);
}

/// "5 min ago", "3 h ago", "2 d ago".
String agoText(Object? iso) {
  final d = DateTime.tryParse('${iso ?? ''}');
  if (d == null) return '';
  final m = DateTime.now().toUtc().difference(d.toUtc()).inMinutes;
  if (m < 1) return 'just now';
  if (m < 60) return '$m min ago';
  if (m < 60 * 24) return '${m ~/ 60} h ago';
  return '${m ~/ (60 * 24)} d ago';
}
