import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../widgets/buttons.dart';

/// Source filter as a checkbox tree, same as the web's Leads filter: tick any
/// mix of sources, website domains and single pages. Website > domain > page;
/// a parent shows a dash when only some of what is under it is ticked.
/// Tokens are what GET /leads/unified?sourceSel= understands:
///   src:NAME   dom:DOMAIN   page:DOMAIN/PATH
String encodeSel(Iterable<String> tokens) => tokens.map((t) {
      final i = t.indexOf(':');
      return '${t.substring(0, i)}:${Uri.encodeComponent(t.substring(i + 1))}';
    }).join(',');

List<String> decodeSel(String s) => s
    .split(',')
    .where((t) => t.contains(':'))
    .map((t) {
      final i = t.indexOf(':');
      final v = t.substring(i + 1);
      String d;
      try {
        d = Uri.decodeComponent(v);
      } catch (_) {
        d = v;
      }
      return '${t.substring(0, i)}:$d';
    })
    .toList();

/// Short label for one token, shown on chips and the trigger.
String selLabel(String token, List<Map<String, dynamic>> pages) {
  final i = token.indexOf(':');
  final k = token.substring(0, i), v = token.substring(i + 1);
  if (k == 'page') {
    final p = pages.where((x) => x['key'] == v).firstOrNull;
    if (p != null) {
      final path = p['path'] as String? ?? '/';
      return '${p['domain']}${path == '/' ? '' : path}';
    }
  }
  return v;
}

class SourceTreeSheet extends StatefulWidget {
  final List<String> selected;
  final List<String> options;
  final List<String> domains;
  final List<Map<String, dynamic>> pages;

  const SourceTreeSheet({
    super.key,
    required this.selected,
    required this.options,
    required this.domains,
    required this.pages,
  });

  @override
  State<SourceTreeSheet> createState() => _SourceTreeSheetState();
}

enum _Tick { on, some, off }

class _SourceTreeSheetState extends State<SourceTreeSheet> {
  late Set<String> sel = widget.selected.toSet();
  bool websiteOpen = false;
  final Map<String, bool> openDomains = {};

  List<Map<String, dynamic>> pagesOf(String d) =>
      widget.pages.where((p) => p['domain'] == d.toLowerCase()).toList();
  int count(Map<String, dynamic> p) => (p['count'] as num?)?.toInt() ?? 0;
  int domainCount(String d) => pagesOf(d).fold(0, (n, p) => n + count(p));

  bool get websiteOn => sel.contains('src:Website');
  _Tick domainState(String d) {
    if (websiteOn || sel.contains('dom:$d')) return _Tick.on;
    return pagesOf(d).any((p) => sel.contains('page:${p['key']}')) ? _Tick.some : _Tick.off;
  }

  _Tick pageState(String d, Map<String, dynamic> p) =>
      (websiteOn || sel.contains('dom:$d') || sel.contains('page:${p['key']}')) ? _Tick.on : _Tick.off;

  _Tick get websiteState => websiteOn
      ? _Tick.on
      : widget.domains.any((d) => domainState(d) != _Tick.off)
          ? _Tick.some
          : _Tick.off;

  @override
  void initState() {
    super.initState();
    websiteOpen = websiteState != _Tick.off;
    for (final d in widget.domains) {
      if (domainState(d) == _Tick.some) openDomains[d] = true;
    }
  }

  void withoutSites() => sel.removeWhere((t) => t.startsWith('dom:') || t.startsWith('page:'));
  // Unticking something under a fully ticked parent keeps everything else ticked.
  void expandWebsite() {
    sel.remove('src:Website');
    for (final d in widget.domains) {
      sel.add('dom:$d');
    }
  }

  void expandDomain(String d) {
    sel.remove('dom:$d');
    for (final p in pagesOf(d)) {
      sel.add('page:${p['key']}');
    }
  }

  void tickSource(String v) => setState(() {
        if (v == 'Website' && widget.domains.isNotEmpty) {
          if (websiteState != _Tick.off) {
            withoutSites();
            sel.remove('src:Website');
          } else {
            withoutSites();
            sel.add('src:Website');
          }
          return;
        }
        final t = 'src:$v';
        sel.contains(t) ? sel.remove(t) : sel.add(t);
      });

  void tickDomain(String d) => setState(() {
        if (domainState(d) == _Tick.off) {
          for (final p in pagesOf(d)) {
            sel.remove('page:${p['key']}');
          }
          sel.add('dom:$d');
        } else {
          if (sel.contains('src:Website')) expandWebsite();
          sel.remove('dom:$d');
          for (final p in pagesOf(d)) {
            sel.remove('page:${p['key']}');
          }
        }
      });

  void tickPage(String d, Map<String, dynamic> p) => setState(() {
        final t = 'page:${p['key']}';
        if (pageState(d, p) == _Tick.off) {
          sel.add(t);
          return;
        }
        if (sel.contains('src:Website')) expandWebsite();
        if (sel.contains('dom:$d')) expandDomain(d);
        sel.remove(t);
      });

  Widget _box(_Tick s) {
    final on = s != _Tick.off;
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        color: on ? AppColors.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: on ? AppColors.primary : Theme.of(context).dividerColor,
          width: 1.6,
        ),
      ),
      child: on
          ? Icon(s == _Tick.on ? Icons.check_rounded : Icons.remove_rounded, size: 15, color: Colors.white)
          : null,
    );
  }

  Widget _row({
    required String label,
    required _Tick state,
    required VoidCallback onTick,
    IconData? icon,
    int n = 0,
    bool expandable = false,
    bool expanded = false,
    VoidCallback? onOpen,
    double indent = 0,
  }) {
    return Padding(
      padding: EdgeInsets.only(left: indent),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            height: 44,
            child: expandable
                ? IconButton(
                    padding: EdgeInsets.zero,
                    tooltip: expanded ? 'Hide $label' : 'Show $label',
                    onPressed: onOpen,
                    icon: AnimatedRotation(
                      turns: expanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 150),
                      child: const Icon(Icons.chevron_right_rounded, size: 20),
                    ),
                  )
                : null,
          ),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: onTick,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44),
                child: Row(
                  children: [
                    _box(state),
                    const SizedBox(width: 10),
                    if (icon != null) ...[
                      Icon(icon, size: 16, color: Theme.of(context).hintColor),
                      const SizedBox(width: 6),
                    ],
                    Expanded(
                      child: Text(label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                    if (n > 0)
                      Container(
                        margin: const EdgeInsets.only(left: 6, right: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Theme.of(context).dividerColor),
                        ),
                        child: Text('$n', style: Theme.of(context).textTheme.labelSmall),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.domains.fold(0, (n, d) => n + domainCount(d));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: Row(children: [
              Text('Source', style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              TextButton(
                onPressed: sel.isEmpty ? null : () => setState(sel.clear),
                child: const Text('Clear'),
              ),
            ]),
          ),
          Expanded(
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final o in widget.options)
                  if (o == 'Website' && widget.domains.isNotEmpty) ...[
                    _row(
                      label: 'Website',
                      icon: Icons.public_rounded,
                      n: total,
                      state: websiteState,
                      expandable: true,
                      expanded: websiteOpen,
                      onOpen: () => setState(() => websiteOpen = !websiteOpen),
                      onTick: () => tickSource('Website'),
                    ),
                    if (websiteOpen)
                      for (final d in widget.domains) ...[
                        _row(
                          label: d,
                          icon: Icons.public_rounded,
                          n: domainCount(d),
                          state: domainState(d),
                          indent: 18,
                          expandable: pagesOf(d).length > 1,
                          expanded: openDomains[d] == true,
                          onOpen: () => setState(() => openDomains[d] = !(openDomains[d] == true)),
                          onTick: () => tickDomain(d),
                        ),
                        if (pagesOf(d).length > 1 && openDomains[d] == true)
                          for (final p in pagesOf(d))
                            _row(
                              label: (p['path'] as String? ?? '/') == '/' ? 'Home page' : p['path'] as String,
                              icon: Icons.description_outlined,
                              n: count(p),
                              state: pageState(d, p),
                              indent: 36,
                              onTick: () => tickPage(d, p),
                            ),
                      ],
                  ] else
                    _row(
                      label: o,
                      state: sel.contains('src:$o') ? _Tick.on : _Tick.off,
                      onTick: () => tickSource(o),
                    ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: GradientButton(
              fullWidth: true,
              onPressed: () => Navigator.pop(context, sel.toList()),
              child: Text(sel.isEmpty ? 'Done: all sources' : 'Done: ${sel.length} selected'),
            ),
          ),
        ],
      ),
    );
  }
}
