import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/app_select.dart';
import '../../widgets/buttons.dart';
import '../../widgets/labeled_field.dart';

// Mirrors backend/models/RoutingRule.js MATCH_FIELDS_BY_SOURCE and the web's
// LeadRoutingSection on the Integrations page.
const _matchFieldsBySource = {
  'facebook': ['form_id', 'campaign_id', 'adset_id', 'ad_id'],
  'whatsapp': ['ad_id'],
  'google': ['campaign_id'],
  'website': ['domain', 'page_path'],
};
const _sourceLabels = {
  'facebook': 'Facebook Lead Ads',
  'whatsapp': 'WhatsApp (Click-to-WhatsApp Ads)',
  'google': 'Google Ads',
  'website': 'Website',
};
const _matchFieldLabels = {
  'form_id': 'Form ID',
  'campaign_id': 'Campaign ID',
  'adset_id': 'Ad Set ID',
  'ad_id': 'Ad ID',
  'domain': 'Website Domain',
  'page_path': 'Page URL Contains',
};
const _placeholders = {
  'form_id': 'e.g. 9655855458173381',
  'campaign_id': 'e.g. 120200000000000',
  'adset_id': 'e.g. 120200000000001',
  'ad_id': 'e.g. 120200000000002',
  'domain': 'e.g. prophuntllp.com',
  'page_path': 'e.g. /projects/khopoli',
};

/// Lead Routing Rules, on the Integrations page like the web: an inline form
/// to add a rule (with a tick list of the real campaigns, ads and forms your
/// leads have come from, and optional filing into a project), and every rule
/// listed with its on/off switch and delete.
class LeadRoutingSection extends StatefulWidget {
  const LeadRoutingSection({super.key});

  @override
  State<LeadRoutingSection> createState() => _LeadRoutingSectionState();
}

class _LeadRoutingSectionState extends State<LeadRoutingSection> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _rules = [];
  List<Map<String, dynamic>> _agents = [];
  List<Map<String, dynamic>> _projects = [];
  List<String> _domains = [];
  List<Map<String, dynamic>> _sitePages = [];
  Map<String, dynamic> _campaignOptions = {};
  bool _loading = true;
  bool _showForm = false;
  bool _saving = false;
  String? _planError;

  final _label = TextEditingController();
  final _value = TextEditingController();
  String _source = 'facebook';
  String _matchField = 'form_id';
  String _assignTo = '';
  String _project = '';
  final Set<String> _ticked = {};

  // Editing an existing rule: only its name, agent and project can change.
  // What it matches on is its identity; to match something else, add a rule.
  String? _editingId;
  final _editLabel = TextEditingController();
  String _editAssign = '';
  String _editProject = '';
  bool _savingEdit = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _label.dispose();
    _value.dispose();
    _editLabel.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _planError = null;
    });
    try {
      final rulesRes = await _api.dio.get('/routing-rules');
      _rules = (rulesRes.data['rules'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (e) {
      final msg = ApiClient.errorMessage(e, 'Failed to load routing rules');
      if (msg.toLowerCase().contains('plan') || msg.toLowerCase().contains('upgrade')) {
        _planError = msg;
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: AppColors.danger),
        );
      }
    }
    // The rest only feeds the add form; a failure here never hides the rules.
    Future<void> grab(String path, void Function(dynamic data) use) async {
      try {
        final r = await _api.dio.get(path);
        use(r.data);
      } catch (_) {}
    }

    await Future.wait([
      grab('/auth/agents', (d) {
        _agents = (d['agents'] as List? ?? []).cast<Map<String, dynamic>>();
        if (_assignTo.isEmpty && _agents.isNotEmpty) _assignTo = _agents.first['_id'] as String;
      }),
      grab('/leads/domains', (d) {
        _domains = (d['domains'] as List? ?? []).cast<String>();
        _sitePages = (d['pages'] as List? ?? []).cast<Map<String, dynamic>>();
      }),
      grab('/projects', (d) {
        _projects = ((d['data'] ?? d['projects']) as List? ?? []).cast<Map<String, dynamic>>();
      }),
      grab('/leads/campaign-options', (d) {
        _campaignOptions = (d['options'] as Map? ?? {}).cast<String, dynamic>();
      }),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  // Real form/campaign/ad-set/ad values already seen on leads for the chosen
  // source and field, so nothing has to be dug out of Ads Manager by hand.
  List<Map<String, dynamic>>? get _quickPick {
    if (_source == 'website') return null;
    final bySource = _campaignOptions[_source];
    if (bySource is! Map) return null;
    final list = bySource[_matchField];
    if (list is! List || list.isEmpty) return null;
    return list.cast<Map<String, dynamic>>();
  }

  // Website: one row per known domain and, indented, per page under it.
  Map<String, String> get _websiteOptions {
    final out = <String, String>{'': '— Type manually below —'};
    for (final d in _domains) {
      final pages = _sitePages.where((p) => p['domain'] == d).toList();
      final total = pages.fold<int>(0, (n, p) => n + ((p['count'] as num?)?.toInt() ?? 0));
      out['domain:$d'] = '$d${total > 0 ? ' ($total)' : ''}';
      for (final p in pages) {
        if (p['path'] == '/') continue;
        out['page:${p['path']}'] = '   ${p['path']} (${p['count']})';
      }
    }
    return out;
  }

  void _resetForm() {
    _label.clear();
    _value.clear();
    _source = 'facebook';
    _matchField = 'form_id';
    _project = '';
    _ticked.clear();
    _assignTo = _agents.isNotEmpty ? _agents.first['_id'] as String : '';
  }

  void _toast(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: error ? AppColors.danger : null),
    );
  }

  Future<void> _save() async {
    if (_label.text.trim().isEmpty || (_ticked.isEmpty && _value.text.trim().isEmpty)) {
      _toast('Please fill in all fields', error: true);
      return;
    }
    if (_assignTo.isEmpty) {
      _toast('No agents available to assign to', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      Map<String, dynamic> body(String value, String label) => {
            'label': label,
            'source': _source,
            'matchField': _matchField,
            'matchValue': _matchField == 'domain' ? value.toLowerCase() : value,
            'assignTo': _assignTo,
            if (_project.isNotEmpty) 'assignToProject': _project,
          };
      if (_ticked.isNotEmpty) {
        // One rule per ticked value, so any of them can later be paused,
        // deleted or reassigned on its own.
        final pick = _quickPick ?? const [];
        final results = await Future.wait(_ticked.map((v) async {
          final match = pick.where((o) => o['value'] == v).firstOrNull;
          final name = match?['label'] as String?;
          final label = name != null && name != v ? '${_label.text.trim()} — $name' : _label.text.trim();
          try {
            final r = await _api.dio.post('/routing-rules', data: body(v, label));
            return (r.data['rule'] as Map).cast<String, dynamic>();
          } catch (_) {
            return null;
          }
        }));
        final created = results.whereType<Map<String, dynamic>>().toList();
        final failed = results.length - created.length;
        if (created.isNotEmpty) _rules = [...created, ..._rules];
        _toast(failed > 0
            ? '${created.length} of ${results.length} rules saved, $failed failed'
            : '${created.length} routing rule${created.length > 1 ? 's' : ''} added', error: failed > 0);
      } else {
        final r = await _api.dio.post('/routing-rules', data: body(_value.text.trim(), _label.text.trim()));
        _rules = [(r.data['rule'] as Map).cast<String, dynamic>(), ..._rules];
        _toast('Routing rule added');
      }
      _resetForm();
      _showForm = false;
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Failed to save rule'), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> rule) async {
    try {
      final res = await _api.dio.patch('/routing-rules/${rule['_id']}', data: {'isActive': rule['isActive'] == false});
      final i = _rules.indexWhere((r) => r['_id'] == rule['_id']);
      if (i != -1) setState(() => _rules[i] = (res.data['rule'] as Map).cast<String, dynamic>());
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Failed to update rule'), error: true);
    }
  }

  void _startEdit(Map<String, dynamic> rule) {
    setState(() {
      _editingId = '${rule['_id']}';
      _editLabel.text = '${rule['label'] ?? ''}';
      final who = '${rule['assignTo'] ?? ''}';
      _editAssign = _agents.any((a) => '${a['_id']}' == who) ? who : '';
      final proj = '${rule['assignToProject'] ?? ''}';
      _editProject = _projects.any((p) => '${p['_id']}' == proj) ? proj : '';
    });
  }

  Future<void> _saveEdit(Map<String, dynamic> rule) async {
    if (_editLabel.text.trim().isEmpty) return _toast('Give the rule a name', error: true);
    if (_editAssign.isEmpty) return _toast('Pick who it should be assigned to', error: true);
    setState(() => _savingEdit = true);
    try {
      final res = await _api.dio.patch('/routing-rules/${rule['_id']}', data: {
        'label': _editLabel.text.trim(),
        'assignTo': _editAssign,
        'assignToProject': _editProject.isEmpty ? null : _editProject,
      });
      final i = _rules.indexWhere((r) => r['_id'] == rule['_id']);
      if (i != -1) _rules[i] = (res.data['rule'] as Map).cast<String, dynamic>();
      _editingId = null;
      _toast('Rule updated. New leads will follow it.');
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Could not update the rule'), error: true);
    } finally {
      if (mounted) setState(() => _savingEdit = false);
    }
  }

  Widget _editCard(AppTheme t, Map<String, dynamic> r) {
    final source = _sourceLabels['${r['source'] ?? 'facebook'}'] ?? '${r['source'] ?? ''}';
    final field = _matchFieldLabels['${r['matchField']}'] ?? '${r['matchField'] ?? ''}';
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              style: TextStyle(fontSize: 12, color: t.textSoft),
              children: [
                TextSpan(text: '$source · $field '),
                TextSpan(
                  text: '${r['matchValue'] ?? ''}',
                  style: const TextStyle(fontFamily: 'monospace', color: AppColors.primary),
                ),
                const TextSpan(text: " (what it matches can't be changed here; add a new rule to match something else)"),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Rule name',
            child: TextField(controller: _editLabel, textCapitalization: TextCapitalization.sentences),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Assign to',
            dense: true,
            value: _editAssign,
            options: {for (final a in _agents) '${a['_id']}': '${a['name'] ?? ''}'},
            onChanged: (v) => setState(() => _editAssign = v ?? ''),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Also file into project',
            dense: true,
            value: _editProject,
            options: {
              '': "Don't file into a project",
              for (final p in _projects) '${p['_id']}': '${p['name'] ?? ''}',
            },
            onChanged: (v) => setState(() => _editProject = v ?? ''),
          ),
          const SizedBox(height: 6),
          Text(
            'Applies to leads that arrive from now on. Leads already routed keep the agent they were given.',
            style: TextStyle(fontSize: 11.5, color: t.textSoft),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _savingEdit ? null : () => setState(() => _editingId = null),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GradientButton(
                  fullWidth: true,
                  loading: _savingEdit,
                  onPressed: _savingEdit ? null : () => _saveEdit(r),
                  child: const Text('Save changes'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _delete(Map<String, dynamic> rule) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this routing rule?'),
        content: Text('"${rule['label']}" will no longer route matching leads.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/routing-rules/${rule['_id']}');
      setState(() => _rules.removeWhere((r) => r['_id'] == rule['_id']));
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Failed to delete'), error: true);
    }
  }

  Widget _form(AppTheme t) {
    final pick = _quickPick;
    final fields = _matchFieldsBySource[_source]!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: t.surfaceLow,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New Routing Rule', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          LabeledField(
            label: 'Label',
            child: TextField(
              controller: _label,
              decoration: const InputDecoration(isDense: true, hintText: 'e.g. Khopoli ads to Sheetal'),
            ),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Source',
            dense: true,
            value: _source,
            options: _sourceLabels,
            onChanged: (v) => setState(() {
              _source = v ?? 'facebook';
              _matchField = _matchFieldsBySource[_source]!.first;
              _ticked.clear();
              _value.clear();
            }),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Match By',
            dense: true,
            value: _matchField,
            options: {for (final f in fields) f: _matchFieldLabels[f] ?? f},
            onChanged: (v) => setState(() {
              _matchField = v ?? fields.first;
              _ticked.clear();
              _value.clear();
            }),
          ),
          if (_source == 'website' && _domains.isNotEmpty) ...[
            const SizedBox(height: 10),
            AppSelect<String>(
              label: 'Pick from your website traffic',
              dense: true,
              value: '',
              options: _websiteOptions,
              onChanged: (v) => setState(() {
                final s = v ?? '';
                if (s.startsWith('domain:')) {
                  _matchField = 'domain';
                  _value.text = s.substring(7);
                } else if (s.startsWith('page:')) {
                  _matchField = 'page_path';
                  _value.text = s.substring(5);
                }
              }),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Only domains and pages that already sent a lead are listed. A brand-new page is not there yet, so type it below.',
                style: TextStyle(fontSize: 11.5, color: t.textSoft),
              ),
            ),
          ],
          if (pick != null) ...[
            const SizedBox(height: 12),
            Text(
              'Pick from your real leads${_ticked.isNotEmpty ? ' (${_ticked.length} selected)' : ''}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 6),
            Container(
              constraints: const BoxConstraints(maxHeight: 240),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: t.border),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: pick.length,
                  separatorBuilder: (_, _) => Divider(height: 1, color: t.border),
                  itemBuilder: (context, i) {
                    final o = pick[i];
                    final v = '${o['value']}';
                    final n = (o['count'] as num?)?.toInt() ?? 0;
                    return CheckboxListTile(
                      dense: true,
                      value: _ticked.contains(v),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: AppColors.primary,
                      onChanged: (_) => setState(() => _ticked.contains(v) ? _ticked.remove(v) : _ticked.add(v)),
                      title: Text('${o['label'] ?? v}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                      secondary: n > 0
                          ? Text('$n lead${n == 1 ? '' : 's'}', style: TextStyle(fontSize: 11.5, color: t.textSoft))
                          : null,
                    );
                  },
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _ticked.isNotEmpty
                    ? 'Save will create ${_ticked.length} rule${_ticked.length > 1 ? 's' : ''}, all assigned to the same agent${_project.isNotEmpty ? ' and project' : ''}.'
                    : 'Tick one or more to route them all the same way. Leave everything unticked to type a single value below.',
                style: TextStyle(fontSize: 11.5, color: t.textSoft),
              ),
            ),
          ],
          const SizedBox(height: 12),
          LabeledField(
            label: '${_matchFieldLabels[_matchField]} Value',
            child: TextField(
              controller: _value,
              enabled: _ticked.isEmpty,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              decoration: InputDecoration(
                isDense: true,
                hintText: _ticked.isNotEmpty ? 'Using ticked selections above' : _placeholders[_matchField],
              ),
            ),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Assign to',
            dense: true,
            value: _assignTo,
            options: {for (final a in _agents) '${a['_id']}': '${a['name'] ?? ''}'},
            onChanged: (v) => setState(() => _assignTo = v ?? ''),
          ),
          const SizedBox(height: 10),
          AppSelect<String>(
            label: 'Also file into project (optional)',
            dense: true,
            value: _project,
            options: {
              '': "Don't file into a project",
              for (final p in _projects) '${p['_id']}': '${p['name'] ?? ''}',
            },
            onChanged: (v) => setState(() => _project = v ?? ''),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              "Also drops a copy of the lead straight into this project's Leads tab, skipping the manual Transfer step. The lead still stays in the main pipeline too.",
              style: TextStyle(fontSize: 11.5, color: t.textSoft),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving ? null : () => setState(() => _showForm = false),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GradientButton(
                  fullWidth: true,
                  loading: _saving,
                  onPressed: _saving ? null : _save,
                  child: const Text('Save Rule'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _ruleRow(AppTheme t, Map<String, dynamic> r) {
    if (_editingId == '${r['_id']}') return _editCard(t, r);
    final on = r['isActive'] != false;
    final source = _sourceLabels['${r['source'] ?? 'facebook'}'] ?? '${r['source'] ?? ''}';
    final field = _matchFieldLabels['${r['matchField']}'] ?? '${r['matchField'] ?? ''}';
    final project = '${r['assignToProjectName'] ?? ''}';
    final who = '${r['assignToName'] ?? ''}';
    const green = Color(0xFF10B981);
    return Opacity(
      opacity: on ? 1 : 0.55,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(8, 8, 2, 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name and actions on one row, details full width underneath, so the
            // text is not squeezed into a narrow column beside the switch.
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 46,
                  height: 32,
                  child: FittedBox(
                    child: Switch(
                      value: on,
                      activeThumbColor: Colors.white,
                      activeTrackColor: green,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      onChanged: (_) => _toggle(r),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${r['label'] ?? 'Routing rule'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      Text(source.toUpperCase(),
                          style: TextStyle(fontSize: 9.5, letterSpacing: 0.6, fontWeight: FontWeight.w700, color: t.textSoft)),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Edit rule',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _startEdit(r),
                  icon: Icon(Icons.edit_outlined, size: 19, color: t.textSoft),
                ),
                IconButton(
                  tooltip: 'Delete rule',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _delete(r),
                  icon: Icon(Icons.delete_outline_rounded, size: 19, color: t.textSoft),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 2, 8, 0),
              child: Text.rich(
                TextSpan(
                  style: TextStyle(fontSize: 12, height: 1.35, color: t.textSoft),
                  children: [
                    TextSpan(text: '$field '),
                    TextSpan(
                      text: '${r['matchValue'] ?? ''}',
                      style: const TextStyle(fontFamily: 'monospace', color: AppColors.primary),
                    ),
                    const TextSpan(text: '  ->  '),
                    TextSpan(
                      text: who.isNotEmpty ? who : 'team member',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: green),
                    ),
                    if (project.isNotEmpty) ...[
                      const TextSpan(text: '  + filed into '),
                      TextSpan(text: project, style: const TextStyle(fontWeight: FontWeight.w700, color: green)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lead Routing Rules', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              'Route leads from specific Facebook or Google campaigns, WhatsApp ads, or website domains and pages directly to a team member. All other leads follow the round-robin rotation.',
              style: TextStyle(height: 1.4, color: t.textSoft),
            ),
            if (_planError == null) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _loading ? null : () => setState(() => _showForm = !_showForm),
                icon: Icon(_showForm ? Icons.close_rounded : Icons.add, size: 17),
                label: Text(_showForm ? 'Close' : 'Add Rule'),
              ),
            ],
            if (_showForm && _planError == null) _form(t),
            const SizedBox(height: 14),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)))
            else if (_planError != null)
              Row(children: [
                const Icon(Icons.lock_outline, size: 18, color: AppColors.warning),
                const SizedBox(width: 8),
                Expanded(child: Text(_planError!)),
              ])
            else if (_rules.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  border: Border.all(color: t.border),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  'No routing rules yet. Add one above to route specific campaigns, ads, or website pages to a team member.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: t.textSoft),
                ),
              )
            else ...[
              ..._rules.map((r) => _ruleRow(t, r)),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Center(
                  child: Text(
                    'All other leads (no match) are assigned round-robin to your team',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: t.textSoft),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
