import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_ui.dart';

/// Create/edit one WhatsApp template. Mirrors
/// frontend/src/pages/conversations/TemplateBuilder.jsx against
/// GET/POST/PUT /whatsapp/templates and POST /whatsapp/templates/generate.
class TemplateBuilderScreen extends StatefulWidget {
  final Map<String, dynamic>? preset; // gallery item, create-mode only
  final String? editId; // Meta template id, edit-mode
  const TemplateBuilderScreen({super.key, this.preset, this.editId});

  @override
  State<TemplateBuilderScreen> createState() => _TemplateBuilderScreenState();
}

class _ButtonRow {
  String type; // QUICK_REPLY | URL | PHONE_NUMBER
  String text;
  String url;
  String phone;
  _ButtonRow({required this.type, this.text = '', this.url = '', this.phone = ''});
}

class _TemplateBuilderScreenState extends State<TemplateBuilderScreen> {
  final _api = ApiClient.instance;
  bool get _isEditing => widget.editId != null;
  bool _loadingExisting = false;
  bool _saving = false;
  String? _originalStatus;
  List<String> _existingNames = [];

  final _nameCtrl = TextEditingController();
  String _category = 'UTILITY';
  String _language = 'en_US';
  final _headerCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  final _footerCtrl = TextEditingController();
  final List<TextEditingController> _exampleCtrls = [];
  final List<_ButtonRow> _buttons = [];

  // AI generation
  final _aiPromptCtrl = TextEditingController();
  String _aiTone = 'normal';
  String _aiOptimise = 'replies';
  bool _generating = false;
  String? _aiError;
  List<Map<String, dynamic>> _variants = [];

  @override
  void initState() {
    super.initState();
    _loadExistingNames();
    if (_isEditing) {
      _loadExisting();
    } else if (widget.preset != null) {
      _applyPreset(widget.preset!);
    }
    _bodyCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _headerCtrl.dispose();
    _bodyCtrl.dispose();
    _footerCtrl.dispose();
    for (final c in _exampleCtrls) {
      c.dispose();
    }
    _aiPromptCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadExistingNames() async {
    try {
      final res = await _api.dio.get('/whatsapp/templates');
      final list = (res.data['templates'] as List? ?? []).cast<Map>();
      if (mounted) setState(() => _existingNames = list.map((t) => t['name'] as String).toList());
    } catch (_) {}
  }

  void _applyPreset(Map<String, dynamic> preset) {
    _nameCtrl.text = _slugify(preset['title'] as String? ?? preset['key'] as String? ?? '');
    _category = preset['category'] as String? ?? 'UTILITY';
    _bodyCtrl.text = preset['body'] as String? ?? '';
    _footerCtrl.text = preset['footer'] as String? ?? '';
    final example = (preset['example'] as List? ?? []).cast<String>();
    _syncExampleFields();
    for (var i = 0; i < example.length && i < _exampleCtrls.length; i++) {
      _exampleCtrls[i].text = example[i];
    }
    final buttons = (preset['buttons'] as List? ?? []).cast<Map>();
    _buttons.addAll(buttons.map((b) => _ButtonRow(
          type: b['type'] as String? ?? 'QUICK_REPLY',
          text: b['text'] as String? ?? '',
          url: b['url'] as String? ?? '',
        )));
  }

  Future<void> _loadExisting() async {
    setState(() => _loadingExisting = true);
    try {
      final res = await _api.dio.get('/whatsapp/templates/${widget.editId}');
      final t = (res.data['template'] as Map).cast<String, dynamic>();
      _nameCtrl.text = t['name'] as String? ?? '';
      _category = t['category'] as String? ?? 'UTILITY';
      _language = t['language'] as String? ?? 'en_US';
      _originalStatus = t['status'] as String?;
      final components = (t['components'] as List? ?? []).cast<Map>();
      final header = components.firstWhere((c) => c['type'] == 'HEADER', orElse: () => {});
      if (header['format'] == 'TEXT') _headerCtrl.text = header['text'] as String? ?? '';
      final body = components.firstWhere((c) => c['type'] == 'BODY', orElse: () => {});
      _bodyCtrl.text = body['text'] as String? ?? '';
      final example = body['example'];
      final exampleList = (example is Map ? (example['body_text'] as List?)?.first : null) as List?;
      final footer = components.firstWhere((c) => c['type'] == 'FOOTER', orElse: () => {});
      _footerCtrl.text = footer['text'] as String? ?? '';
      final buttonsComp = components.firstWhere((c) => c['type'] == 'BUTTONS', orElse: () => {});
      final rawButtons = (buttonsComp['buttons'] as List? ?? []).cast<Map>();
      _buttons.addAll(rawButtons.map((b) => _ButtonRow(
            type: b['type'] as String? ?? 'QUICK_REPLY',
            text: b['text'] as String? ?? '',
            url: b['url'] as String? ?? '',
            phone: b['phone_number'] as String? ?? '',
          )));
      _syncExampleFields();
      if (exampleList != null) {
        for (var i = 0; i < exampleList.length && i < _exampleCtrls.length; i++) {
          _exampleCtrls[i].text = exampleList[i] as String? ?? '';
        }
      }
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load this template'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingExisting = false);
    }
  }

  String _slugify(String s) {
    var out = s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]+'), '_');
    out = out.replaceAll(RegExp(r'^_+'), '');
    if (out.length > 60) out = out.substring(0, 60);
    return out;
  }

  List<int> get _bodyVars {
    final matches = RegExp(r'\{\{(\d+)\}\}').allMatches(_bodyCtrl.text);
    final nums = matches.map((m) => int.parse(m.group(1)!)).toSet().toList()..sort();
    return nums;
  }

  void _syncExampleFields() {
    final n = _bodyVars.isEmpty ? 0 : _bodyVars.last;
    while (_exampleCtrls.length < n) {
      _exampleCtrls.add(TextEditingController());
    }
    while (_exampleCtrls.length > n) {
      _exampleCtrls.removeLast().dispose();
    }
  }

  void _insertVariable() {
    _syncExampleFields();
    final next = (_bodyVars.isEmpty ? 0 : _bodyVars.last) + 1;
    final sel = _bodyCtrl.selection;
    final text = _bodyCtrl.text;
    final insertion = '{{$next}}';
    final pos = sel.start >= 0 ? sel.start : text.length;
    final newText = text.replaceRange(pos, sel.end >= 0 ? sel.end : pos, insertion);
    _bodyCtrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: pos + insertion.length),
    );
    setState(_syncExampleFields);
  }

  // ── Lint (subset of web's templateLint.js, block-level only) ──────────────
  List<String> get _blockers {
    final issues = <String>[];
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      issues.add('Name is required');
    } else if (!RegExp(r'^[a-z0-9][a-z0-9_]*$').hasMatch(name)) {
      issues.add('Name must be lowercase letters, numbers and underscores');
    } else if (!_isEditing && _existingNames.contains(name)) {
      issues.add('A template with this name already exists');
    }
    final body = _bodyCtrl.text.trim();
    if (body.isEmpty) {
      issues.add('Body is required');
    } else {
      final vars = _bodyVars;
      for (var i = 0; i < vars.length; i++) {
        if (vars[i] != i + 1) {
          issues.add('Variables must be numbered contiguously starting at {{1}}');
          break;
        }
      }
      if (vars.isNotEmpty && body.trim().startsWith('{{${vars.first}}}')) {
        issues.add('Body cannot start with a variable');
      }
      if (vars.isNotEmpty && body.trim().endsWith('{{${vars.last}}}')) {
        issues.add('Body cannot end with a variable');
      }
      for (var i = 0; i < vars.length && i < _exampleCtrls.length; i++) {
        if (_exampleCtrls[i].text.trim().isEmpty) {
          issues.add('Every variable needs a sample value');
          break;
        }
      }
      if (body.length > 1024) issues.add('Body must be 1024 characters or fewer');
    }
    if (_footerCtrl.text.length > 60) issues.add('Footer must be 60 characters or fewer');
    if (_headerCtrl.text.length > 60) issues.add('Header must be 60 characters or fewer');
    final quickReply = _buttons.where((b) => b.type == 'QUICK_REPLY').length;
    final url = _buttons.where((b) => b.type == 'URL').length;
    final phone = _buttons.where((b) => b.type == 'PHONE_NUMBER').length;
    if (quickReply > 10) issues.add('At most 10 quick-reply buttons');
    if (url > 2) issues.add('At most 2 URL buttons');
    if (phone > 1) issues.add('At most 1 phone button');
    for (final b in _buttons) {
      if (b.text.trim().isEmpty) issues.add('Every button needs a label');
      if (b.text.length > 25) issues.add('Button labels must be 25 characters or fewer');
      if (b.type == 'URL' && b.url.trim().isEmpty) issues.add('URL buttons need a link');
      if (b.type == 'URL' && b.url.isNotEmpty && !b.url.startsWith('http')) {
        issues.add('URL must start with http:// or https://');
      }
      if (b.type == 'PHONE_NUMBER' && b.phone.trim().isEmpty) issues.add('Phone button needs a number');
    }
    return issues.toSet().toList();
  }

  Future<void> _generate() async {
    if (_aiPromptCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Describe what the message should say')),
      );
      return;
    }
    setState(() {
      _generating = true;
      _aiError = null;
    });
    try {
      final res = await _api.dio.post('/whatsapp/templates/generate', data: {
        'prompt': _aiPromptCtrl.text.trim(),
        'category': _category,
        'tone': _aiTone,
        'optimizeFor': _aiOptimise,
      });
      if (mounted) {
        setState(() => _variants = (res.data['variants'] as List? ?? []).cast<Map<String, dynamic>>());
      }
    } catch (e) {
      if (mounted) setState(() => _aiError = ApiClient.errorMessage(e, 'Could not generate'));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _useVariant(Map<String, dynamic> v) {
    var name = _slugify(v['name'] as String? ?? '');
    var suffix = 2;
    while (_existingNames.contains(name)) {
      name = '${_slugify(v['name'] as String? ?? '')}_$suffix';
      suffix++;
    }
    setState(() {
      _nameCtrl.text = name;
      _bodyCtrl.text = v['body'] as String? ?? '';
      _footerCtrl.text = v['footer'] as String? ?? '';
      _syncExampleFields();
      final example = (v['example'] as List? ?? []).cast<String>();
      for (var i = 0; i < example.length && i < _exampleCtrls.length; i++) {
        _exampleCtrls[i].text = example[i];
      }
      _buttons
        ..clear()
        ..addAll((v['buttons'] as List? ?? []).cast<Map>().map((b) => _ButtonRow(
              type: b['type'] as String? ?? 'QUICK_REPLY',
              text: b['text'] as String? ?? '',
            )));
      _variants = [];
    });
  }

  List<Map<String, dynamic>> _buildComponents() {
    final components = <Map<String, dynamic>>[];
    if (_headerCtrl.text.trim().isNotEmpty) {
      components.add({'type': 'HEADER', 'format': 'TEXT', 'text': _headerCtrl.text.trim()});
    }
    final bodyComp = <String, dynamic>{'type': 'BODY', 'text': _bodyCtrl.text.trim()};
    if (_bodyVars.isNotEmpty) {
      bodyComp['example'] = {
        'body_text': [_exampleCtrls.map((c) => c.text.trim()).toList()],
      };
    }
    components.add(bodyComp);
    if (_footerCtrl.text.trim().isNotEmpty) {
      components.add({'type': 'FOOTER', 'text': _footerCtrl.text.trim()});
    }
    if (_buttons.isNotEmpty) {
      components.add({
        'type': 'BUTTONS',
        'buttons': _buttons.map((b) {
          switch (b.type) {
            case 'URL':
              return {'type': 'URL', 'text': b.text.trim(), 'url': b.url.trim()};
            case 'PHONE_NUMBER':
              return {'type': 'PHONE_NUMBER', 'text': b.text.trim(), 'phone_number': b.phone.trim()};
            default:
              return {'type': 'QUICK_REPLY', 'text': b.text.trim()};
          }
        }).toList(),
      });
    }
    return components;
  }

  Future<void> _submit() async {
    if (_blockers.isNotEmpty) return;
    setState(() => _saving = true);
    try {
      if (_isEditing) {
        await _api.dio.put('/whatsapp/templates/${widget.editId}', data: {
          'category': _category,
          'components': _buildComponents(),
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Saved — back in review')),
          );
        }
      } else {
        await _api.dio.post('/whatsapp/templates', data: {
          'name': _nameCtrl.text.trim(),
          'category': _category,
          'language': _language,
          'components': _buildComponents(),
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Submitted for review')),
          );
        }
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not submit')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  static const _categories = {
    'MARKETING': 'Marketing',
    'UTILITY': 'Utility',
    'AUTHENTICATION': 'Authentication',
  };
  static const _languages = {
    'en_US': 'English (US) — en_US',
    'en_GB': 'English (UK) — en_GB',
    'hi': 'Hindi — hi',
    'mr': 'Marathi — mr',
    'gu': 'Gujarati — gu',
  };
  static const _tones = {'normal': 'Normal', 'friendly': 'Friendly', 'urgent': 'Direct', 'formal': 'Formal'};
  static const _optimise = {'replies': 'Getting a reply', 'clicks': 'Getting a tap'};
  static const _buttonKinds = {'QUICK_REPLY': ('Quick reply', 10), 'URL': ('Link', 2), 'PHONE_NUMBER': ('Call', 1)};

  int _kindCount(String type) => _buttons.where((b) => b.type == type).length;

  @override
  Widget build(BuildContext context) {
    if (_loadingExisting) {
      return const Scaffold(body: Center(child: AppSpinner()));
    }
    final t = AppTheme.of(context);
    final blockers = _blockers;
    final vars = _bodyVars;
    final title = _isEditing
        ? (_nameCtrl.text.isEmpty ? 'Edit template' : _nameCtrl.text)
        : (widget.preset != null ? (widget.preset!['title'] as String? ?? 'New template') : 'New template');
    return Scaffold(
      appBar: AppBar(title: Text(title, overflow: TextOverflow.ellipsis)),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.translucent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 14, left: 2),
              child: Text('Every template is reviewed. Approval usually takes minutes but can take up to 24 hours.',
                  style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            ),
            if (_isEditing && _originalStatus != null)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBBF24).withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: const Color(0xFFFBBF24).withValues(alpha: 0.35)),
                ),
                child: Text(
                  "This template is currently ${_originalStatus!.toLowerCase()}. Saving any change here resubmits it for review — it goes back to Pending and can't be used until approved again.",
                  style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFFB45309)),
                ),
              ),
            if (!_isEditing) _aiCard(),
            WaCard(
              children: [
                WaField(
                  label: 'Template name',
                  controller: _nameCtrl,
                  enabled: !_isEditing,
                  mono: true,
                  hint: 'site_visit_reminder_v2',
                  help: _isEditing
                      ? "Name and language can't be changed once a template exists — only category and content."
                      : 'Lowercase, numbers and underscores. Cannot be changed later.',
                  onChanged: (v) {
                    final s = _slugify(v);
                    if (s != v) {
                      _nameCtrl.value = TextEditingValue(text: s, selection: TextSelection.collapsed(offset: s.length));
                    }
                    setState(() {});
                  },
                ),
                WaSelect<String>(
                  label: 'Category',
                  value: _category,
                  options: _categories,
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
                WaSelect<String>(
                  label: 'Language',
                  value: _language,
                  options: _languages,
                  onChanged: (v) {
                    if (!_isEditing) setState(() => _language = v ?? _language);
                  },
                ),
              ],
            ),
            WaCard(
              children: [
                WaField(
                  label: 'Header',
                  note: '(optional · max 60 chars)',
                  controller: _headerCtrl,
                  maxLength: 60,
                  hint: 'Your site visit is confirmed',
                  help: 'Bold line above the message. Leave blank for none.',
                  onChanged: (_) => setState(() {}),
                ),
                WaField(
                  label: 'Message body',
                  note: '(required)',
                  controller: _bodyCtrl,
                  maxLines: 7,
                  maxLength: 1024,
                  hint: 'Hi {{1}}, this is a quick reminder for your site visit to {{2}}…',
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('Add variable:', style: TextStyle(fontSize: 12, color: t.textSoft)),
                    for (final n in vars) _varChip('{{$n}}', () => _insertVarNumber(n), primary: false),
                    _varChip('+ {{${(vars.isEmpty ? 0 : vars.last) + 1}}}', _insertVariable, primary: true),
                  ],
                ),
                if (vars.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const WaLabel('Sample values'),
                  Text(
                    'An example is required for every variable — it is how a reviewer reads the message.',
                    style: TextStyle(fontSize: 12, height: 1.4, color: t.textSoft),
                  ),
                  const SizedBox(height: 10),
                  for (var i = 0; i < _exampleCtrls.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text('{{${i + 1}}}',
                                style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _exampleCtrls[i],
                              style: const TextStyle(fontSize: 13),
                              decoration: waDecoration(context, hint: 'e.g. Priya', dense: true),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
                const SizedBox(height: 8),
                WaField(
                  label: 'Footer',
                  note: '(optional · max 60 chars)',
                  controller: _footerCtrl,
                  maxLength: 60,
                  hint: 'Reply STOP to unsubscribe',
                  onChanged: (_) => setState(() {}),
                ),
              ],
            ),
            _buttonsEditor(),
            _previewCard(),
            if (blockers.isNotEmpty)
              WaCard(
                title: 'Before you submit',
                children: [for (final b in blockers) WaNotice(b, danger: true)],
              ),
            WaCard(
              children: [
                const Row(
                  children: [
                    Icon(Icons.bolt, size: 16, color: Color(0xFFF59E0B)),
                    SizedBox(width: 6),
                    Text('Review time', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Every template is reviewed — usually within minutes, occasionally up to 24 hours. You can see the result on the Templates tab.',
                  style: TextStyle(fontSize: 11.5, height: 1.4, color: t.textSoft),
                ),
                const SizedBox(height: 8),
                Text(
                  vars.isEmpty
                      ? 'No variables — every recipient gets identical text.'
                      : '${vars.length} variable${vars.length > 1 ? 's' : ''} filled per recipient when you run a campaign.',
                  style: TextStyle(fontSize: 11.5, color: t.textSoft),
                ),
              ],
            ),
            GradientButton(
              fullWidth: true,
              loading: _saving,
              onPressed: (blockers.isEmpty && !_saving) ? _submit : null,
              child: Text(_isEditing ? 'Save & resubmit for review' : 'Submit for review'),
            ),
            if (blockers.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('${blockers.length} thing${blockers.length > 1 ? 's' : ''} to fix first.',
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: t.textSoft)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _varChip(String label, VoidCallback onTap, {required bool primary}) {
    final t = AppTheme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: primary ? AppColors.primary.withValues(alpha: 0.10) : t.surfaceLow,
          border: primary ? null : Border.all(color: t.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label,
            style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: primary ? AppColors.primary : t.text)),
      ),
    );
  }

  void _insertVarNumber(int n) {
    final sel = _bodyCtrl.selection;
    final text = _bodyCtrl.text;
    final insertion = '{{$n}}';
    final pos = sel.start >= 0 ? sel.start : text.length;
    final end = sel.end >= 0 ? sel.end : pos;
    _bodyCtrl.value = TextEditingValue(
      text: text.replaceRange(pos, end, insertion),
      selection: TextSelection.collapsed(offset: pos + insertion.length),
    );
    setState(_syncExampleFields);
  }

  // Live preview, same green bubble the web renders.
  Widget _previewCard() {
    final t = AppTheme.of(context);
    final body = _bodyCtrl.text;
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in RegExp(r'\{\{\s*(\d+)\s*\}\}').allMatches(body)) {
      if (m.start > last) spans.add(TextSpan(text: body.substring(last, m.start)));
      final n = int.parse(m.group(1)!);
      final sample = (n - 1 >= 0 && n - 1 < _exampleCtrls.length) ? _exampleCtrls[n - 1].text.trim() : '';
      spans.add(TextSpan(
        text: sample.isNotEmpty ? sample : 'value $n',
        style: sample.isNotEmpty
            ? const TextStyle(fontWeight: FontWeight.w600)
            : TextStyle(fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.w600, backgroundColor: Colors.black.withValues(alpha: 0.08)),
      ));
      last = m.end;
    }
    if (last < body.length) spans.add(TextSpan(text: body.substring(last)));
    return WaCard(
      title: 'Preview',
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
        child: const Text('Live preview', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
      ),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(18)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
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
                child: DefaultTextStyle(
                  style: const TextStyle(color: Color(0xFF111111), fontSize: 13, height: 1.4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_headerCtrl.text.trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(_headerCtrl.text, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                      body.trim().isEmpty
                          ? const Opacity(opacity: 0.5, child: Text('Your message will appear here'))
                          : Text.rich(TextSpan(children: spans)),
                      if (_footerCtrl.text.trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Opacity(opacity: 0.6, child: Text(_footerCtrl.text, style: const TextStyle(fontSize: 11))),
                        ),
                    ],
                  ),
                ),
              ),
              for (final b in _buttons)
                Container(
                  width: MediaQuery.of(context).size.width * 0.75,
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
                  ),
                  child: Text(b.text.isEmpty ? 'Button' : b.text,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF00A5F4))),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _aiCard() {
    final t = AppTheme.of(context);
    return Column(
      children: [
        if (widget.preset == null)
          WaCard(
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                    child: const Icon(Icons.explore_outlined, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Starting from scratch?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text('There are ready-made templates for every lead stage, with the blanks already wired to your CRM fields.',
                            style: TextStyle(fontSize: 12, height: 1.35, color: t.textSoft)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  WaPillButton('Browse', onPressed: () => Navigator.pop(context)),
                ],
              ),
            ],
          ),
        WaCard(
          title: 'Write it with AI',
          icon: Icons.auto_awesome,
          description: 'Describe the message in plain English. You get three versions to choose from, written around your real projects.',
          children: [
            WaField(
              label: '',
              controller: _aiPromptCtrl,
              maxLines: 3,
              maxLength: 1000,
              hint: 'e.g. invite leads who visited last month to the new tower launch, mention the early-bird price',
              onChanged: (_) => setState(() {}),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: WaSelect<String>(
                    label: 'Tone',
                    value: _aiTone,
                    options: _tones,
                    dense: true,
                    onChanged: (v) => setState(() => _aiTone = v ?? _aiTone),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: WaSelect<String>(
                    label: 'Optimise for',
                    value: _aiOptimise,
                    options: _optimise,
                    dense: true,
                    onChanged: (v) => setState(() => _aiOptimise = v ?? _aiOptimise),
                  ),
                ),
              ],
            ),
            GradientButton(
              fullWidth: true,
              loading: _generating,
              onPressed: (_generating || _aiPromptCtrl.text.trim().isEmpty) ? null : _generate,
              child: Text(_generating ? 'Writing three versions…' : 'Generate'),
            ),
            WaHelp('Generates as ${_category.toLowerCase()}. Nothing is submitted automatically.'),
            if (_aiError != null) WaNotice(_aiError!, danger: true),
            if (_variants.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text('${_variants.length} VERSION${_variants.length == 1 ? '' : 'S'} — PICK ONE TO EDIT',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: t.textSoft)),
              const SizedBox(height: 8),
              for (final v in _variants)
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: t.surfaceLow,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: t.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(v['name'] as String? ?? '',
                          style: TextStyle(fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.w700, color: t.textSoft)),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(color: const Color(0xFFDCF8C6), borderRadius: BorderRadius.circular(14)),
                        child: Text(
                          _fillSample(v['body'] as String? ?? '', (v['example'] as List?) ?? const []),
                          style: const TextStyle(fontSize: 12.5, height: 1.4, color: Color(0xFF111111)),
                        ),
                      ),
                      for (final b in (v['buttons'] as List? ?? const []))
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                          child: Text('${(b as Map)['text']}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF00A5F4))),
                        ),
                      const SizedBox(height: 10),
                      WaPillButton('Use this', full: true, onPressed: () => _useVariant(v)),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ],
    );
  }

  String _fillSample(String body, List example) => body.replaceAllMapped(RegExp(r'\{\{\s*(\d+)\s*\}\}'), (m) {
        final i = int.parse(m[1]!) - 1;
        return (i >= 0 && i < example.length && '${example[i]}'.isNotEmpty) ? '${example[i]}' : 'value ${m[1]}';
      });

  Widget _buttonsEditor() {
    final t = AppTheme.of(context);
    return WaCard(
      title: 'Buttons (optional)',
      description: "Quick replies come back into your inbox as a message. Link and call buttons open on the recipient's phone.",
      children: [
        for (var i = 0; i < _buttons.length; i++)
          Container(
            key: ObjectKey(_buttons[i]),
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: t.surfaceLow,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: t.border),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(color: t.surfaceHigh, borderRadius: BorderRadius.circular(8)),
                      child: Text(_buttonKinds[_buttons[i].type]?.$1 ?? _buttons[i].type,
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.textSoft)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        initialValue: _buttons[i].text,
                        maxLength: 25,
                        style: const TextStyle(fontSize: 13),
                        decoration: waDecoration(context, hint: 'Button label', dense: true).copyWith(counterText: ''),
                        onChanged: (v) => setState(() => _buttons[i].text = v),
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: Icon(Icons.close, size: 18, color: t.textSoft),
                      onPressed: () => setState(() => _buttons.removeAt(i)),
                    ),
                  ],
                ),
                if (_buttons[i].type == 'URL') ...[
                  const SizedBox(height: 8),
                  TextFormField(
                    initialValue: _buttons[i].url,
                    keyboardType: TextInputType.url,
                    style: const TextStyle(fontSize: 13),
                    decoration: waDecoration(context, hint: 'https://yoursite.com/project', dense: true),
                    onChanged: (v) => setState(() => _buttons[i].url = v),
                  ),
                ],
                if (_buttons[i].type == 'PHONE_NUMBER') ...[
                  const SizedBox(height: 8),
                  TextFormField(
                    initialValue: _buttons[i].phone,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(fontSize: 13),
                    decoration: waDecoration(context, hint: '+919876543210', dense: true),
                    onChanged: (v) => setState(() => _buttons[i].phone = v),
                  ),
                ],
              ],
            ),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in _buttonKinds.entries)
              WaPillButton(
                '${e.value.$1}  ${_kindCount(e.key)}/${e.value.$2}',
                icon: Icons.add,
                onPressed: _kindCount(e.key) >= e.value.$2 ? null : () => setState(() => _buttons.add(_ButtonRow(type: e.key))),
              ),
          ],
        ),
      ],
    );
  }
}
