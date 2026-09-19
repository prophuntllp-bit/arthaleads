import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_ui.dart';

/// Send one approved template into a conversation — what the composer's
/// lightning button opens, and the only way to reach someone once WhatsApp's
/// 24-hour reply window has closed. Mirrors
/// frontend/src/components/TemplateSendModal.jsx against GET
/// /whatsapp/templates and POST /whatsapp/send-template.
///
/// Resolves to the sent message map, or null if dismissed / out of credits.
Future<Map<String, dynamic>?> showTemplateSendSheet(
  BuildContext context, {
  required String conversationId,
  required String contactName,
  required Map<String, dynamic>? credits,
}) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.modal))),
    builder: (_) => _TemplateSendSheet(conversationId: conversationId, contactName: contactName, credits: credits),
  );
}

class _TemplateSendSheet extends StatefulWidget {
  final String conversationId;
  final String contactName;
  final Map<String, dynamic>? credits;
  const _TemplateSendSheet({required this.conversationId, required this.contactName, required this.credits});
  @override
  State<_TemplateSendSheet> createState() => _TemplateSendSheetState();
}

class _TemplateSendSheetState extends State<_TemplateSendSheet> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _list;
  String _error = '';
  String? _name;
  List<TextEditingController> _values = [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  @override
  void dispose() {
    for (final c in _values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadList() async {
    try {
      final res = await _api.dio.get('/whatsapp/templates');
      final all = (res.data['templates'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e));
      if (mounted) setState(() => _list = all.where((t) => t['status'] == 'APPROVED').toList());
    } catch (e) {
      if (mounted) {
        setState(() {
          _list = [];
          _error = ApiClient.errorMessage(e, 'Could not load templates.');
        });
      }
    }
  }

  Map<String, dynamic>? get _tpl {
    for (final t in _list ?? const <Map<String, dynamic>>[]) {
      if (t['name'] == _name) return t;
    }
    return null;
  }

  String _bodyOf(Map<String, dynamic>? t) {
    for (final c in (t?['components'] as List? ?? const [])) {
      if (c is Map && c['type'] == 'BODY') return c['text'] as String? ?? '';
    }
    return '';
  }

  int _varCount(String text) =>
      RegExp(r'\{\{\s*(\d+)\s*\}\}').allMatches(text).map((m) => m.group(1)).toSet().length;

  void _pick(String? name) {
    for (final c in _values) {
      c.dispose();
    }
    setState(() {
      _name = name;
      final n = _varCount(_bodyOf(_tpl));
      final first = widget.contactName.trim().split(RegExp(r'\s+')).first;
      _values = List.generate(n, (i) => TextEditingController(text: i == 0 ? first : ''));
    });
  }

  String get _rendered => _bodyOf(_tpl).replaceAllMapped(RegExp(r'\{\{\s*(\d+)\s*\}\}'), (m) {
        final i = int.parse(m[1]!) - 1;
        final v = (i >= 0 && i < _values.length) ? _values[i].text : '';
        return v.isEmpty ? '[value ${m[1]}]' : v;
      });

  bool get _ready => _tpl != null && _values.every((c) => c.text.trim().isNotEmpty);

  String _rupees(num? p) => '₹${((p ?? 0) / 100).toStringAsFixed(2)}';

  Future<void> _send() async {
    if (!_ready || _sending) return;
    setState(() => _sending = true);
    try {
      final res = await _api.dio.post('/whatsapp/send-template', data: {
        'conversationId': widget.conversationId,
        'templateName': _name,
        'values': _values.map((c) => c.text.trim()).toList(),
      });
      if (!mounted) return;
      final msg = res.data['message'];
      Navigator.pop(context, msg is Map ? Map<String, dynamic>.from(msg) : <String, dynamic>{});
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not send the template')), backgroundColor: AppColors.danger, duration: const Duration(seconds: 6)),
      );
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final tpl = _tpl;
    final credit = '${tpl?['category'] ?? 'MARKETING'}'.toLowerCase();
    final rate = (widget.credits?['ratesPaise'] as Map?)?[credit] as num?;
    final byMeta = widget.credits?['billedDirectlyByMeta'] == true;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: t.border, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(child: Text('Send a template', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const SizedBox(height: 8),
            if (_list == null)
              const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: AppSpinner()))
            else if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text(_error, textAlign: TextAlign.center, style: TextStyle(color: t.textSoft))),
              )
            else if (_list!.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    const Text('No approved templates yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(
                      'A template has to be approved before it can be sent. Approval usually takes minutes. Create one from the Templates tab.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12.5, height: 1.4, color: t.textSoft),
                    ),
                  ],
                ),
              )
            else ...[
              WaSelect<String>(
                label: 'Template',
                value: _name,
                hint: 'Choose an approved template',
                options: {for (final x in _list!) x['name'] as String: '${x['name']} · ${'${x['category'] ?? ''}'.toLowerCase()}'},
                onChanged: _pick,
              ),
              if (tpl != null && _values.isNotEmpty)
                for (var i = 0; i < _values.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        WaLabel('{{${i + 1}}}'),
                        TextField(
                          controller: _values[i],
                          decoration: waDecoration(context, hint: 'Value for {{${i + 1}}}'),
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                    ),
                  ),
              if (tpl != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(18)),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: const BoxDecoration(
                        color: Color(0xFFDCF8C6),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(16),
                          topRight: Radius.circular(4),
                          bottomLeft: Radius.circular(16),
                          bottomRight: Radius.circular(16),
                        ),
                      ),
                      child: Text(_rendered, style: const TextStyle(fontSize: 13.5, height: 1.4, color: Color(0xFF111111))),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 15, color: t.textSoft),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        byMeta
                            ? 'Billed directly to your own account, not through Arthaleads credits.'
                            : '${rate != null ? 'Costs ${_rupees(rate)} as a $credit message. ' : ''}Free monthly replies do not apply to templates.',
                        style: TextStyle(fontSize: 12, height: 1.4, color: t.textSoft),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              GradientButton(
                fullWidth: true,
                loading: _sending,
                icon: Icons.send_rounded,
                onPressed: (_ready && !_sending) ? _send : null,
                child: Text(_sending ? 'Sending…' : 'Send template'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
