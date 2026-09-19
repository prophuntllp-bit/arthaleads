import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_ui.dart';

String _rupees(num? paise) {
  final v = (paise ?? 0) / 100;
  return '₹${NumberFormat('#,##0.00', 'en_IN').format(v)}';
}

const _varFields = [
  'name', 'phone', 'location', 'city', 'bhk', 'propertyType', 'budget', 'visitDate',
];

/// Create/review a campaign draft, then send it. Mirrors
/// frontend/src/pages/conversations/CampaignBuilder.jsx against
/// GET /whatsapp/templates, GET /whatsapp/campaigns/audience-counts,
/// POST /whatsapp/campaigns/preview, POST /whatsapp/campaigns[/:id/send].
class CampaignBuilderScreen extends StatefulWidget {
  final String? campaignId; // reviewing an existing draft
  const CampaignBuilderScreen({super.key, this.campaignId});

  @override
  State<CampaignBuilderScreen> createState() => _CampaignBuilderScreenState();
}

class _CampaignBuilderScreenState extends State<CampaignBuilderScreen> {
  final _api = ApiClient.instance;
  final _nameCtrl = TextEditingController();
  List<Map<String, dynamic>> _templates = [];
  String? _tplError;
  Map<String, dynamic>? _audienceCounts;
  String? _selectedTemplate;
  String _statusFilter = '';
  String _sourceFilter = '';
  DateTime? _from;
  DateTime? _to;
  final List<String> _mapping = [];
  final Map<int, TextEditingController> _literalCtrls = {};

  Map<String, dynamic>? _preview;
  bool _previewLoading = false;
  Timer? _debounce;
  String? _campaignId;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _campaignId = widget.campaignId;
    _nameCtrl.addListener(() => setState(() {}));
    _loadTemplates();
    _loadAudienceCounts();
    if (_campaignId != null) _loadExisting();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _debounce?.cancel();
    for (final c in _literalCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadTemplates() async {
    try {
      final res = await _api.dio.get('/whatsapp/templates');
      final all = (res.data['templates'] as List? ?? []).cast<Map<String, dynamic>>();
      if (mounted) {
        setState(() => _templates = all.where((t) => t['status'] == 'APPROVED').toList());
      }
    } catch (e) {
      if (mounted) setState(() => _tplError = ApiClient.errorMessage(e, 'Could not load templates'));
    }
  }

  Future<void> _loadAudienceCounts() async {
    try {
      final res = await _api.dio.get('/whatsapp/campaigns/audience-counts');
      if (mounted) setState(() => _audienceCounts = (res.data as Map).cast<String, dynamic>());
    } catch (_) {}
  }

  Future<void> _loadExisting() async {
    try {
      final res = await _api.dio.get('/whatsapp/campaigns');
      final all = (res.data['campaigns'] as List? ?? []).cast<Map<String, dynamic>>();
      final c = all.firstWhere((c) => c['_id'] == _campaignId, orElse: () => {});
      if (c.isEmpty || !mounted) return;
      setState(() {
        _nameCtrl.text = c['name'] as String? ?? '';
        _selectedTemplate = c['templateName'] as String?;
        final filter = (c['audienceFilter'] as Map?)?.cast<String, dynamic>() ?? {};
        _statusFilter = filter['status'] as String? ?? '';
        _sourceFilter = filter['source'] as String? ?? '';
        _from = DateTime.tryParse(filter['from'] as String? ?? '');
        _to = DateTime.tryParse(filter['to'] as String? ?? '');
        _mapping
          ..clear()
          ..addAll((c['variableMapping'] as List? ?? []).cast<String>());
      });
      _fetchPreview();
    } catch (_) {}
  }

  void _scheduleFetchPreview() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _fetchPreview);
  }

  Future<void> _fetchPreview() async {
    if (_selectedTemplate == null) {
      setState(() => _preview = null);
      return;
    }
    setState(() => _previewLoading = true);
    try {
      final res = await _api.dio.post('/whatsapp/campaigns/preview', data: {
        'templateName': _selectedTemplate,
        'filter': {
          if (_statusFilter.isNotEmpty) 'status': _statusFilter,
          if (_sourceFilter.isNotEmpty) 'source': _sourceFilter,
          if (_from != null) 'from': _from!.toIso8601String(),
          if (_to != null) 'to': _to!.toIso8601String(),
        },
      });
      if (!mounted) return;
      final prev = (res.data as Map).cast<String, dynamic>();
      setState(() {
        _preview = prev;
        final expected = prev['variablesExpected'] as int? ?? 0;
        while (_mapping.length < expected) {
          _mapping.add('name');
        }
        while (_mapping.length > expected) {
          _mapping.removeLast();
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not preview')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _previewLoading = false);
    }
  }

  int _countFor(String kind, String value) {
    final m = (_audienceCounts?[kind] as Map?)?.cast<String, dynamic>();
    return (m?[value] as num?)?.toInt() ?? 0;
  }

  Future<void> _pickDate({required bool from}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (from ? _from : _to) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
    _scheduleFetchPreview();
  }

  Future<void> _send() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Give the campaign a name')));
      return;
    }
    final prev = _preview;
    if (prev == null || prev['canSend'] != true) {
      final blockers = (prev?['blockers'] as List?)?.cast<String>() ?? [];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(blockers.isNotEmpty ? blockers.first : 'Nothing to send')),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send campaign'),
        content: Text('Send to ${prev['sendableCount']} people for ${_rupees(prev['costPaise'])}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _sending = true);
    try {
      if (_campaignId == null) {
        final tpl = _templates.firstWhere((t) => t['name'] == _selectedTemplate, orElse: () => {});
        final res = await _api.dio.post('/whatsapp/campaigns', data: {
          'name': _nameCtrl.text.trim(),
          'templateName': _selectedTemplate,
          'templateLanguage': tpl['language'],
          'templateCategory': tpl['category'],
          'variableMapping': _mapping,
          'audienceFilter': {
            if (_statusFilter.isNotEmpty) 'status': _statusFilter,
            if (_sourceFilter.isNotEmpty) 'source': _sourceFilter,
            if (_from != null) 'from': _from!.toIso8601String(),
            if (_to != null) 'to': _to!.toIso8601String(),
          },
        });
        _campaignId = (res.data['campaign'] as Map)['_id'] as String;
      }
      final res = await _api.dio.post('/whatsapp/campaigns/$_campaignId/send');
      final stats = (res.data['campaign']['stats'] as Map).cast<String, dynamic>();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sent to ${stats['sent']} people')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Campaign failed')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  static const _varLabelMap = {
    'name': 'Lead name',
    'phone': 'Lead phone',
    'location': 'Preferred location',
    'city': 'City',
    'bhk': 'Configuration (BHK)',
    'propertyType': 'Property type',
    'budget': 'Budget range',
    'visitDate': 'Site visit date',
  };

  String get _templateBody {
    for (final t in _templates) {
      if (t['name'] == _selectedTemplate) {
        for (final c in (t['components'] as List? ?? const [])) {
          if (c is Map && c['type'] == 'BODY') return c['text'] as String? ?? '';
        }
      }
    }
    return '';
  }

  /// The words around a {{n}}, so the person mapping it knows what it is for.
  String _contextFor(String body, int n) {
    final m = RegExp('\\{\\{\\s*$n\\s*\\}\\}').firstMatch(body);
    if (m == null) return '';
    final start = (m.start - 28).clamp(0, body.length);
    final end = (m.end + 28).clamp(0, body.length);
    return '${start > 0 ? '…' : ''}${body.substring(start, end).trim()}${end < body.length ? '…' : ''}';
  }

  String _fmtInt(num? n) => NumberFormat('#,##0', 'en_IN').format(n ?? 0);

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final prev = _preview;
    final billedByMeta = prev?['billedDirectlyByMeta'] == true;
    final blockers = (prev?['blockers'] as List?)?.cast<String>() ?? [];
    final varsExpected = (prev?['variablesExpected'] as num?)?.toInt() ?? 0;
    final body = _templateBody;

    return Scaffold(
      appBar: AppBar(title: Text(_campaignId != null ? 'Review campaign' : 'New campaign')),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.translucent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            WaCard(
              title: 'Campaign details',
              description: 'Pick an approved template to begin the broadcast',
              children: [
                WaField(label: 'Campaign name', controller: _nameCtrl, hint: 'Diwali launch — Andheri'),
                if (_tplError != null)
                  WaNotice(_tplError!, danger: true)
                else if (_templates.isEmpty)
                  const WaNotice(
                    'No approved templates yet. Create one and wait for it to be approved before running a campaign.',
                    warn: true,
                  )
                else
                  WaSelect<String>(
                    label: 'Template',
                    value: _selectedTemplate,
                    hint: 'Choose an approved template',
                    options: {
                      for (final tpl in _templates)
                        tpl['name'] as String: '${tpl['name']} · ${'${tpl['category'] ?? ''}'.toLowerCase()}',
                    },
                    help: _selectedTemplate != null ? '✓ Approved' : null,
                    onChanged: (v) {
                      setState(() => _selectedTemplate = v);
                      _fetchPreview();
                    },
                  ),
              ],
            ),
            WaCard(
              title: 'Who gets it',
              description: 'The same filters you use on the Leads page',
              trailing: prev == null
                  ? null
                  : Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(99)),
                      child: Text('${_fmtInt(prev['total'] as num?)} leads matched',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
              children: [
                WaSelect<String>(
                  label: 'Lead status',
                  value: _statusFilter,
                  options: {
                    '': 'All statuses',
                    for (final s in statusOptions) s: '$s (${_countFor('status', s)})',
                  },
                  onChanged: (v) {
                    setState(() => _statusFilter = v ?? '');
                    _scheduleFetchPreview();
                  },
                ),
                WaSelect<String>(
                  label: 'Lead source',
                  value: _sourceFilter,
                  options: {
                    '': 'All sources',
                    for (final s in sourceOptions) s: '$s (${_countFor('source', s)})',
                  },
                  onChanged: (v) {
                    setState(() => _sourceFilter = v ?? '');
                    _scheduleFetchPreview();
                  },
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _dateField('Created from', _from, () => _pickDate(from: true))),
                    const SizedBox(width: 10),
                    Expanded(child: _dateField('Created to', _to, () => _pickDate(from: false))),
                  ],
                ),
                if (_from != null || _to != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          _from = null;
                          _to = null;
                        });
                        _scheduleFetchPreview();
                      },
                      child: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: Text('Clear dates',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ),
                    ),
                  ),
              ],
            ),
            if (varsExpected > 0)
              WaCard(
                title: 'Fill the blanks',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
                  child: Text('$varsExpected dynamic tag${varsExpected > 1 ? 's' : ''}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, fontFamily: 'monospace', color: AppColors.primary)),
                ),
                description: 'This template has $varsExpected value${varsExpected > 1 ? 's' : ''} filled per person',
                children: [
                  for (var i = 0; i < varsExpected; i++) _blankRow(i, body),
                ],
              ),
            _sendCard(prev, billedByMeta, blockers),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.bolt, size: 14, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text('Credits are held for the whole run before the first message goes out, so a campaign never stops half-sent.',
                        style: TextStyle(fontSize: 11, height: 1.4, color: t.textSoft)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateField(String label, DateTime? value, VoidCallback onTap) {
    final t = AppTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WaLabel(label),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadii.input),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                borderRadius: BorderRadius.circular(AppRadii.input),
                border: Border.all(color: t.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      value == null ? 'Any date' : DateFormat('d MMM yyyy').format(value),
                      style: TextStyle(fontSize: 14, color: value == null ? t.textSoft : t.text),
                    ),
                  ),
                  Icon(Icons.calendar_today_outlined, size: 16, color: t.textSoft),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _blankRow(int i, String body) {
    final t = AppTheme.of(context);
    final current = i < _mapping.length ? _mapping[i] : 'name';
    final isField = _varFields.contains(current);
    final ctx = _contextFor(body, i + 1);
    final ctrl = _literalCtrls.putIfAbsent(i, () => TextEditingController(text: isField ? '' : current));
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Text('{{${i + 1}}}',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(ctx.isEmpty ? 'Value for this position' : ctx,
                    style: TextStyle(fontSize: 12, height: 1.35, color: t.textSoft)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          WaSelect<String>(
            label: '',
            dense: true,
            value: isField ? current : 'literal',
            options: {
              for (final f in _varFields) f: _varLabelMap[f] ?? f,
              'literal': 'Same for everyone…',
            },
            onChanged: (v) => setState(() {
              while (_mapping.length <= i) {
                _mapping.add('name');
              }
              _mapping[i] = v == 'literal' ? '' : v!;
              if (v == 'literal') ctrl.clear();
            }),
          ),
          if (!isField)
            TextField(
              controller: ctrl,
              style: const TextStyle(fontSize: 13),
              decoration: waDecoration(context, hint: 'Type the value', dense: true),
              onChanged: (v) => setState(() {
                while (_mapping.length <= i) {
                  _mapping.add('');
                }
                _mapping[i] = v;
              }),
            ),
        ],
      ),
    );
  }

  Widget _sendCard(Map<String, dynamic>? prev, bool billedByMeta, List<String> blockers) {
    final t = AppTheme.of(context);
    return WaCard(
      title: 'Before you send',
      children: [
        if (_previewLoading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: AppSpinner(size: 22)))
        else if (prev == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text('Pick a template to see the audience and cost.', style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            ),
          )
        else ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Icon(Icons.people_outline, size: 18, color: t.textSoft),
              const SizedBox(width: 8),
              Text(_fmtInt(prev['sendableCount'] as num?), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('of ${_fmtInt(prev['total'] as num?)}', style: TextStyle(fontSize: 12, color: t.textSoft)),
              ),
            ],
          ),
          if (((prev['skippedNoConsent'] as num?) ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('${_fmtInt(prev['skippedNoConsent'] as num?)} excluded — no marketing consent.',
                  style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ),
          if (((prev['skippedNoPhone'] as num?) ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('${_fmtInt(prev['skippedNoPhone'] as num?)} excluded — no phone number',
                  style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(16)),
            child: billedByMeta
                ? Text('Billed directly to your own account, not through Arthaleads credits.',
                    style: TextStyle(fontSize: 12.5, color: t.textSoft))
                : Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Cost', style: TextStyle(fontSize: 14, color: t.textSoft)),
                          Text(_rupees(prev['costPaise'] as num?), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${_rupees(prev['ratePaise'] as num?)} each · ${prev['creditCategory']}',
                              style: TextStyle(fontSize: 11, color: t.textSoft)),
                          Text('balance ${_rupees(prev['availablePaise'] as num?)}', style: TextStyle(fontSize: 11, color: t.textSoft)),
                        ],
                      ),
                    ],
                  ),
          ),
          for (final b in blockers) WaNotice(b, danger: true),
          if (prev['qualityRating'] != null && prev['qualityRating'] != 'RED')
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: prev['qualityRating'] == 'GREEN' ? AppColors.success : const Color(0xFFF59E0B),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Number quality: ${'${prev['qualityRating']}'.toLowerCase()}${prev['tierCap'] != null ? ' · ${_fmtInt(prev['tierCap'] as num?)} per 24h limit' : ''}',
                      style: TextStyle(fontSize: 11.5, color: t.textSoft),
                    ),
                  ),
                ],
              ),
            ),
        ],
        const SizedBox(height: 14),
        GradientButton(
          fullWidth: true,
          loading: _sending,
          onPressed: (prev?['canSend'] == true && _nameCtrl.text.trim().isNotEmpty && !_sending) ? _send : null,
          child: Text(_sending ? 'Sending…' : 'Send to ${_fmtInt(prev?['sendableCount'] as num?)}'),
        ),
      ],
    );
  }
}
