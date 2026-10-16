import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';

/// Ticks after Artha applies or undoes a change, so screens showing CRM data
/// reload (the web's "arthaleads:refresh" event, hooks/useAppRefresh.js).
class ArthaEvents {
  ArthaEvents._();
  static final ValueNotifier<int> changed = ValueNotifier(0);
}

/// One change Artha proposed, and where it is in its life: previewing,
/// waiting for a yes, applied (with Undo), undone or cancelled. Mirrors the
/// web card in frontend/src/components/HelpBot.jsx: the same /help/preview,
/// /help/action and /help/undo calls, the same idempotency key per card.
class ChangeProposal extends ChangeNotifier {
  ChangeProposal({
    required this.type,
    required Map<String, dynamic> params,
    required this.page,
    required this.prompt,
    required this.threadId,
    this.writesDisabled = false,
  }) : params = {...params};

  final String type;
  Map<String, dynamic> params;
  final String page;
  final String prompt;
  final String? threadId;
  final bool writesDisabled;

  Map<String, dynamic>? preview;
  String? error;
  Map<String, dynamic>? scopePrompt;
  bool scopeConfirmed = true;
  bool busy = false;

  /// Bulk cards show the first few leads; the rest on request, inline, so
  /// the card never scrolls inside the chat.
  bool showAllRows = false;
  void expandRows() {
    showAllRows = true;
    notifyListeners();
  }

  /// Applied: the server's message and, when it can be put back, the key.
  String? doneMessage;
  String? undoKey;
  bool undone = false;
  bool cancelled = false;

  /// Minted once and reused on every retry, so a dropped response and a
  /// second tap cannot apply the change twice.
  String? _idempotencyKey;

  bool get pending => doneMessage == null && !cancelled && preview != null && error == null && scopePrompt == null;

  List<Map<String, dynamic>> get fields => _maps(preview?['fields']);
  List<Map<String, dynamic>> get rows => _maps(preview?['rows']);

  /// Bulk changes: the rows still ticked (and not skipped by the server).
  int get chosenCount {
    final ids = ((params['leadIds'] as List?) ?? const []).map((e) => '$e').toSet();
    return rows.where((r) => r['skip'] == null && ids.contains('${r['id']}')).length;
  }

  Future<void> loadPreview() async {
    busy = true;
    notifyListeners();
    try {
      final res = await ApiClient.instance.dio.post('/help/preview', data: {
        'type': type,
        'params': params,
        'page': page,
        'scopeConfirmed': scopeConfirmed,
      });
      preview = (res.data as Map).cast<String, dynamic>();
      error = null;
      scopePrompt = null;
    } on DioException catch (e) {
      final body = e.response?.data;
      if (body is Map && body['needsScopeChange'] == true) {
        scopePrompt = body.cast<String, dynamic>();
        preview = null;
      } else {
        error = ApiClient.errorMessage(e, 'Could not preview that change.');
        preview = null;
      }
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  /// A value the model got wrong, corrected on the card; the preview is
  /// asked again so the card shows exactly what will be saved.
  Future<void> edit(String param, dynamic value) async {
    params = {...params, param: value};
    await loadPreview();
  }

  void toggleRow(String id, bool on) {
    final ids = ((params['leadIds'] as List?) ?? const []).map((e) => '$e').toSet();
    on ? ids.add(id) : ids.remove(id);
    params = {...params, 'leadIds': ids.toList()};
    notifyListeners();
  }

  Future<void> allowScope() async {
    scopeConfirmed = true;
    scopePrompt = null;
    await loadPreview();
  }

  Future<String?> apply() async {
    if (busy || !pending) return null;
    busy = true;
    notifyListeners();
    _idempotencyKey ??= '$type-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 32).toRadixString(36)}';
    try {
      final res = await ApiClient.instance.dio.post('/help/action', data: {
        'type': type,
        'params': params,
        'page': page,
        'scopeConfirmed': scopeConfirmed,
        'idempotencyKey': _idempotencyKey,
        'prompt': prompt,
        'source': 'artha',
        'threadId': ?threadId,
      });
      final data = (res.data as Map).cast<String, dynamic>();
      doneMessage = '${data['message'] ?? 'Done.'}';
      undoKey = data['undoable'] == true ? data['undoKey'] as String? : null;
      ArthaEvents.changed.value++;
      return null;
    } on DioException catch (e) {
      final body = e.response?.data;
      if (body is Map && body['needsScopeChange'] == true) {
        scopePrompt = body.cast<String, dynamic>();
        return null;
      }
      return ApiClient.errorMessage(e, 'That change did not go through. Please try again.');
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<String?> undo() async {
    if (busy || undoKey == null) return null;
    busy = true;
    notifyListeners();
    try {
      await ApiClient.instance.dio.post('/help/undo', data: {'undoKey': undoKey});
      undone = true;
      undoKey = null;
      ArthaEvents.changed.value++;
      return null;
    } on DioException catch (e) {
      return ApiClient.errorMessage(e, 'Could not undo that.');
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void cancel() {
    cancelled = true;
    notifyListeners();
  }

  static List<Map<String, dynamic>> _maps(dynamic v) =>
      v is List ? [for (final x in v) if (x is Map) x.cast<String, dynamic>()] : [];
}

/// The card itself (Phase 4 design, screens 2 and 3).
class ChangeCard extends StatelessWidget {
  final ChangeProposal p;
  const ChangeCard({super.key, required this.p});

  static const _green = Color(0xFF047857);
  static const _greenDark = Color(0xFF4ADE80);

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: p, builder: (context, _) => _body(context));

  Widget _body(BuildContext context) {
    final t = AppTheme.of(context);
    if (p.cancelled) return _note(t, Icons.block_rounded, 'No changes were made.');
    if (p.doneMessage != null) return _receipt(context, t);
    if (p.scopePrompt != null) return _scope(t);
    if (p.error != null) return _errorBox(t, p.error!);
    if (p.preview == null) {
      return _frame(
        t,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
            const SizedBox(width: 10),
            Text('Checking what would change…', style: TextStyle(fontSize: 13, color: t.textSoft)),
          ]),
        ),
      );
    }
    return _previewCard(context, t);
  }

  Widget _frame(AppTheme t, {required Widget child, Color? border}) => Container(
        margin: const EdgeInsets.only(top: 8),
        decoration: BoxDecoration(
          color: t.isDark ? const Color(0xFF18171A) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: border ?? AppColors.primary.withValues(alpha: 0.40)),
          boxShadow: t.isDark ? null : const [BoxShadow(color: Color(0x14A04100), blurRadius: 24, offset: Offset(0, 8))],
        ),
        clipBehavior: Clip.antiAlias,
        child: child,
      );

  Widget _previewCard(BuildContext context, AppTheme t) {
    final fields = p.fields;
    final rows = p.rows;
    final subject = '${p.preview?['subject'] ?? ''}';
    final bulk = rows.isNotEmpty;
    final count = bulk ? p.chosenCount : (fields.isEmpty ? 1 : fields.length);
    final title = bulk
        ? (subject.isNotEmpty ? subject : 'Change $count leads')
        : (subject.isNotEmpty ? 'Update $subject' : 'Artha wants to make ${plural(count, 'change')}');
    final applyLabel = bulk ? 'Apply to $count' : (count == 1 ? 'Apply' : 'Apply $count changes');
    return _frame(
      t,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            color: AppColors.primary.withValues(alpha: t.isDark ? 0.08 : 0.05),
            child: Row(children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                child: Icon(bulk ? Icons.groups_2_outlined : Icons.edit_outlined, size: 18, color: _accent(t)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: t.text)),
                  Text(bulk ? '${rows.length} found · untick any to leave out' : plural(fields.length, 'change'),
                      style: TextStyle(fontSize: 12, color: t.textSoft)),
                ]),
              ),
            ]),
          ),
          Divider(height: 1, color: t.border),
          if (bulk) ...[
            for (final r in p.showAllRows ? rows : rows.take(_rowsShown)) _row(t, r),
            if (!p.showAllRows && rows.length > _rowsShown)
              TextButton(
                onPressed: p.expandRows,
                child: Text('Show all ${rows.length}', style: TextStyle(color: _accent(t), fontWeight: FontWeight.w600)),
              ),
            Divider(height: 1, color: t.border),
          ],
          for (final f in fields) _field(context, t, f),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Text(
              p.writesDisabled
                  ? 'Changes from Artha are switched off for your company. Ask your admin.'
                  : 'From what you said. Dates in IST. Tap a value to change it.',
              style: TextStyle(fontSize: 12, color: t.textSoft),
            ),
          ),
          if (!p.writesDisabled)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(children: [
                Expanded(
                  child: _GradientAction(
                    label: p.busy ? 'Working…' : applyLabel,
                    onTap: p.busy || count == 0 ? null : () => _apply(context),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: OutlinedButton(
                    onPressed: p.busy ? null : p.cancel,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: t.text,
                      side: BorderSide(color: t.borderStrong),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.button)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            ),
        ],
      ),
    );
  }

  static const _rowsShown = 6;

  Color _accent(AppTheme t) => t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C);

  Widget _row(AppTheme t, Map<String, dynamic> r) {
    final id = '${r['id']}';
    final skip = r['skip'] as String?;
    final ids = ((p.params['leadIds'] as List?) ?? const []).map((e) => '$e').toSet();
    return CheckboxListTile(
      dense: true,
      value: skip == null && ids.contains(id),
      onChanged: skip != null || p.busy ? null : (v) => p.toggleRow(id, v ?? false),
      controlAffinity: ListTileControlAffinity.leading,
      activeColor: AppColors.primary,
      title: Text('${r['name'] ?? ''}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.text)),
      subtitle: Text(skip ?? 'from ${r['from'] ?? ''}', style: TextStyle(fontSize: 12, color: t.textSoft)),
    );
  }

  Widget _field(BuildContext context, AppTheme t, Map<String, dynamic> f) {
    final editor = (f['editor'] as Map?)?.cast<String, dynamic>();
    final canEdit = f['param'] != null && editor != null && !p.writesDisabled;
    final from = f['from'];
    final hasFrom = from != null && '$from'.isNotEmpty;
    final value = Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 6,
      runSpacing: 4,
      children: [
        if (hasFrom) ...[
          _tag('$from', strike: true, fg: t.textSoft, bg: AppColors.danger.withValues(alpha: 0.08)),
          Text('→', style: TextStyle(color: t.textSoft)),
        ],
        _tag('${f['to'] ?? ''}',
            fg: t.isDark ? _greenDark : _green, bg: const Color(0xFF10B981).withValues(alpha: 0.10), bold: true),
        if (canEdit) Icon(_editorIcon(editor), size: 15, color: _accent(t)),
      ],
    );
    return InkWell(
      onTap: canEdit && !p.busy ? () => _editField(context, f, editor) : null,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: t.border))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 90,
            child: Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text('${f['label'] ?? ''}'.toUpperCase(),
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 0.8, color: t.textSoft)),
            ),
          ),
          Expanded(child: value),
        ]),
      ),
    );
  }

  static IconData _editorIcon(Map<String, dynamic> e) => switch (e['type']) {
        'datetime' || 'date' => Icons.calendar_today_rounded,
        'select' => Icons.expand_more_rounded,
        _ => Icons.edit_outlined,
      };

  Widget _tag(String text, {required Color fg, required Color bg, bool strike = false, bool bold = false}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(text,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: fg,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              decoration: strike ? TextDecoration.lineThrough : null,
              decorationColor: fg,
            )),
      );

  Future<void> _editField(BuildContext context, Map<String, dynamic> f, Map<String, dynamic> editor) async {
    final param = '${f['param']}';
    // A closing picker hands focus back to the message box, which reopens
    // the keyboard over the card; nothing should hold focus here.
    FocusManager.instance.primaryFocus?.unfocus();
    switch (editor['type']) {
      case 'datetime':
        final v = await _pickDateTime(context, '${editor['value'] ?? ''}');
        if (v != null) await p.edit(param, v);
      case 'date':
        final now = DateTime.now();
        final initial = DateTime.tryParse('${editor['value'] ?? ''}') ?? now;
        final d = await showDatePicker(
            context: context, initialDate: initial, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 3));
        if (d != null) await p.edit(param, '${d.year}-${_two(d.month)}-${_two(d.day)}');
      case 'select':
        final v = await _pickOption(context, '${f['label'] ?? ''}', editor);
        if (v != null) await p.edit(param, v);
      default:
        final v = await _editText(context, '${f['label'] ?? ''}', '${editor['value'] ?? f['to'] ?? ''}');
        if (v != null) await p.edit(param, v);
    }
  }

  static String _two(int n) => n.toString().padLeft(2, '0');

  /// The editor's value is an IST wall-clock "YYYY-MM-DDTHH:mm"; it goes back
  /// with an explicit +05:30 so the phone's own time zone never shifts it.
  Future<String?> _pickDateTime(BuildContext context, String value) async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(value) ?? now;
    final d = await showDatePicker(
        context: context, initialDate: initial, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 3));
    if (d == null || !context.mounted) return null;
    final tm = await showTimePicker(context: context, initialTime: TimeOfDay(hour: initial.hour, minute: initial.minute));
    if (tm == null) return null;
    return '${d.year}-${_two(d.month)}-${_two(d.day)}T${_two(tm.hour)}:${_two(tm.minute)}:00+05:30';
  }

  Future<dynamic> _pickOption(BuildContext context, String label, Map<String, dynamic> editor) {
    final t = AppTheme.of(context);
    final options = (editor['options'] as List?) ?? const [];
    final current = '${editor['value'] ?? ''}';
    return showModalBottomSheet<dynamic>(
      context: context,
      showDragHandle: true,
      backgroundColor: t.surfaceSolid,
      builder: (_) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: t.text)),
            ),
            for (final o in options)
              Builder(builder: (ctx) {
                final value = o is Map ? o['value'] : o;
                final text = o is Map ? '${o['label'] ?? value}' : '$o';
                final selected = '$value' == current;
                return ListTile(
                  title: Text(text, style: TextStyle(color: t.text, fontWeight: selected ? FontWeight.w600 : FontWeight.w400)),
                  trailing: selected ? const Icon(Icons.check_rounded, color: AppColors.primary) : null,
                  onTap: () => Navigator.pop(ctx, value),
                );
              }),
          ],
        ),
      ),
    );
  }

  Future<String?> _editText(BuildContext context, String label, String value) {
    final c = TextEditingController(text: value);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: TextField(controller: c, autofocus: true, minLines: 1, maxLines: 5),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Use this')),
        ],
      ),
    );
  }

  Future<void> _apply(BuildContext context) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final err = await p.apply();
    if (err != null) messenger?.showSnackBar(SnackBar(content: Text(err)));
  }

  Widget _receipt(BuildContext context, AppTheme t) {
    final green = t.isDark ? _greenDark : _green;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
      decoration: BoxDecoration(
        color: (p.undone ? t.textSoft : const Color(0xFF10B981)).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: (p.undone ? t.textSoft : const Color(0xFF10B981)).withValues(alpha: 0.30)),
      ),
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: (p.undone ? t.textSoft : const Color(0xFF10B981)).withValues(alpha: 0.16),
          ),
          child: Icon(p.undone ? Icons.undo_rounded : Icons.check_rounded, size: 16, color: p.undone ? t.textSoft : green),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(p.undone ? 'Undone. Everything from this change was put back.' : '${p.doneMessage}',
              style: TextStyle(
                fontSize: 13.5,
                height: 1.4,
                fontWeight: FontWeight.w600,
                color: p.undone ? t.textSoft : t.text,
              )),
        ),
        if (p.undoKey != null)
          SizedBox(
            height: 44,
            child: OutlinedButton(
              onPressed: p.busy
                  ? null
                  : () async {
                      final messenger = ScaffoldMessenger.maybeOf(context);
                      final err = await p.undo();
                      if (err != null) messenger?.showSnackBar(SnackBar(content: Text(err)));
                    },
              style: OutlinedButton.styleFrom(
                foregroundColor: t.text,
                side: BorderSide(color: t.borderStrong),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(p.busy ? '…' : 'Undo', style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
      ]),
    );
  }

  Widget _scope(AppTheme t) {
    const amber = Color(0xFFF59E0B);
    final label = '${p.scopePrompt?['scopeLabel'] ?? 'that page'}';
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: amber.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: amber.withValues(alpha: 0.35)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${p.scopePrompt?['message'] ?? ''}', style: TextStyle(fontSize: 13, height: 1.45, color: t.text)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          FilledButton.tonal(onPressed: p.busy ? null : p.allowScope, child: Text('Yes, work on $label')),
          OutlinedButton(onPressed: p.busy ? null : p.cancel, child: const Text('No')),
        ]),
      ]),
    );
  }

  Widget _errorBox(AppTheme t, String message) => Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.30)),
        ),
        child: Text(message, style: const TextStyle(fontSize: 13, height: 1.45, color: AppColors.danger)),
      );

  Widget _note(AppTheme t, IconData icon, String text) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(children: [
          Icon(icon, size: 15, color: t.textSoft),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(fontSize: 13, color: t.textSoft)),
        ]),
      );
}

class _GradientAction extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  const _GradientAction({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Opacity(
        opacity: onTap == null ? 0.6 : 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.button),
            gradient: const LinearGradient(colors: [AppColors.primaryDeep, AppColors.primary]),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadii.button),
              onTap: onTap,
              child: SizedBox(
                height: 48,
                child: Center(
                  child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ),
        ),
      );
}
