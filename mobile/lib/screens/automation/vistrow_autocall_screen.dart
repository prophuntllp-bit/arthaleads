import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/app_select.dart';
import '../../widgets/labeled_field.dart';

/// Automation -> Vistrow auto-call: which NEW leads Vistrow Voice's AI agents
/// phone, and which agent calls each. Admins only. Mirrors the web's
/// frontend/src/components/VistrowOutboundSection.jsx and the same routes
/// (/integrations/vistrow-outbound): switch on/off, the four sources, a
/// default agent and rules per source, a plain summary, and the last 24 hours.
///
/// The connection itself (account number and key) is made from Vistrow Voice
/// or on the web; a phone is the wrong place to paste a secret, and the
/// technical extras (test send, safety limits) stay on the web too.
class VistrowAutoCallScreen extends StatefulWidget {
  const VistrowAutoCallScreen({super.key});

  @override
  State<VistrowAutoCallScreen> createState() => _VistrowAutoCallScreenState();
}

const _base = '/integrations/vistrow-outbound';
const _violet = Color(0xFF7C3AED);
const _manual = '__manual__';

class _Source {
  final String key, label, how, noun;
  final IconData icon;
  const _Source(this.key, this.label, this.icon, this.how, this.noun);
}

const _sources = [
  _Source('website', 'Website', Icons.language_rounded, 'Matched by the page the form was filled on', 'website form'),
  _Source('facebook', 'Facebook', Icons.campaign_outlined, 'Matched by the ad, the campaign or the project the lead came from', 'Facebook lead-ad'),
  _Source('whatsapp', 'WhatsApp', Icons.chat_outlined, 'Matched by the project or the ad the chat started from', 'WhatsApp'),
  _Source('google', 'Google', Icons.search_rounded, 'Matched by the Google Ads campaign or the project the lead is filed under', 'Google Ads lead-form'),
];

/// What a rule can match, per source (the web's pickers).
const _kindsBySource = {
  'website': {'url_contains': 'A page'},
  'facebook': {'form_id': 'A lead form', 'ad_id': 'An ad', 'campaign_id': 'A campaign', 'project': 'A project'},
  'whatsapp': {'project': 'A project', 'ad_id': 'An ad'},
  'google': {'campaign_id': 'A campaign', 'project': 'A project'},
};

const _kindWord = {'url_contains': 'Page', 'project': 'Project', 'ad_id': 'Ad', 'form_id': 'Lead form', 'campaign_id': 'Campaign', 'any': 'Default'};

const _why = {
  'source_disabled': 'Source is off',
  'no_route': 'No matching rule',
  'ambiguous_route': 'Two rules tie',
  'agent_missing': 'Rule has no agent',
  'not_auto_source': 'Not a Website / Facebook / WhatsApp / Google lead',
  'recent_duplicate_phone': 'Called recently',
  'changed_before_send': 'Changed before sending',
  'test_event': 'Test event',
};
const _skip = {'stale_lead': 'Enquiry too old', 'invalid_phone': 'No dialable phone', 'integration_disabled': 'Switched off', 'config_changed': 'Settings changed'};
const _statusLabel = {
  'delivered': 'Delivered',
  'pending': 'Retrying',
  'sending': 'Sending',
  'failed': 'Failed',
  'dead': 'Gave up',
  'skipped': 'Not sent',
  'cancelled': 'Cancelled',
};

/// Drops the leading " · " parts every Facebook option shares (the automation
/// name), so the part that tells them apart is what shows. As on the web.
List<Map<String, dynamic>> dropSharedPrefix(List<Map<String, dynamic>> list) {
  if (list.length < 2) return list;
  final parts = [for (final o in list) '${o['label'] ?? ''}'.split(' · ')];
  var n = 0;
  while (parts.every((p) => p.length > n && p[n] == parts[0][n]) && parts.any((p) => p.length > n + 1)) {
    n++;
  }
  if (n == 0) return list;
  return [
    for (var i = 0; i < list.length; i++) {...list[i], 'label': parts[i].sublist(n).join(' · ')},
  ];
}

class _VistrowAutoCallScreenState extends State<VistrowAutoCallScreen> {
  final _api = ApiClient.instance;

  Map<String, dynamic>? _st;
  bool _loading = true;
  String _busy = '';
  String? _loadError;

  // Agents: idle | loading | ok | error
  String _agentState = 'idle';
  List<Map<String, dynamic>> _agents = [];
  String _agentProblem = '';

  List<Map<String, dynamic>> _projects = [];
  List<String> _pages = [];
  List<Map<String, dynamic>> _allAds = [];
  List<Map<String, dynamic>> _fbForms = [];
  List<Map<String, dynamic>> _fbCampaigns = [];
  List<Map<String, dynamic>> _googleCampaigns = [];
  List<Map<String, dynamic>> _deliveries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  static List<Map<String, dynamic>> _maps(dynamic v) => [
        for (final x in (v as List?) ?? const [])
          if (x is Map) x.cast<String, dynamic>(),
      ];

  void _apply(dynamic status) {
    if (status is! Map) return;
    final s = status.cast<String, dynamic>();
    final routing = <String, dynamic>{...((s['routing'] as Map?)?.cast<String, dynamic>() ?? const {})};
    for (final src in _sources) {
      routing[src.key] ??= {'enabled': false, 'routes': []};
    }
    _st = {...s, 'routing': routing};
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final res = await _api.dio.get(_base);
      _apply(res.data['status']);
    } catch (e) {
      _loadError = ApiClient.errorMessage(e, 'Could not load the Vistrow settings');
    }
    // The pickers' lists: none of them is essential, so each fails quietly.
    await Future.wait([
      _api.dio.get('/projects').then((r) => _projects = _maps(r.data['data'])).catchError((_) => <Map<String, dynamic>>[]),
      _api.dio.get('/leads/domains').then((r) {
        _pages = {
          for (final p in _maps(r.data['pages']))
            if ('${p['path'] ?? ''}'.isNotEmpty && p['path'] != '/') '${p['path']}',
        }.toList();
      }).catchError((_) {}),
      _api.dio.get('/leads/campaign-options').then((r) {
        final o = (r.data['options'] as Map?) ?? const {};
        _allAds = _maps((o['ads'] as Map?)?['all']);
        _fbForms = dropSharedPrefix(_maps((o['facebook'] as Map?)?['form_id']));
        _fbCampaigns = dropSharedPrefix(_maps((o['facebook'] as Map?)?['campaign_id']));
        _googleCampaigns = _maps((o['google'] as Map?)?['campaign_id']);
      }).catchError((_) {}),
      _loadDeliveries(),
    ]);
    if (!mounted) return;
    setState(() => _loading = false);
    if (_st?['configured'] == true) _loadAgents();
  }

  Future<void> _loadDeliveries() async {
    try {
      final r = await _api.dio.get('$_base/deliveries', queryParameters: {'limit': 20});
      _deliveries = _maps(r.data['deliveries']);
    } catch (_) {}
  }

  Future<void> _loadAgents() async {
    setState(() {
      _agentState = 'loading';
      _agentProblem = '';
    });
    try {
      final r = await _api.dio.get('$_base/agents');
      final problem = r.data['problem'];
      if (problem is Map) {
        _agentState = 'error';
        _agents = [];
        _agentProblem = '${problem['message'] ?? 'Could not load your Vistrow agents.'}';
      } else {
        _agentState = 'ok';
        _agents = _maps(r.data['agents']);
      }
    } catch (_) {
      _agentState = 'error';
      _agents = [];
      _agentProblem = 'Could not load your Vistrow agents. Try again in a minute.';
    }
    if (mounted) setState(() {});
  }

  /// Runs a change; the server answers with the new status. Says how it went.
  Future<bool> _call(String key, Future<dynamic> Function() fn, String ok) async {
    setState(() => _busy = key);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await fn();
      final data = r?.data;
      if (data is Map && data['status'] != null) _apply(data['status']);
      if (ok.isNotEmpty) messenger.showSnackBar(SnackBar(content: Text(ok)));
      return true;
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e, 'Something went wrong'))));
      return false;
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<bool> _confirm(String title, String message, String yes) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(yes)),
        ],
      ),
    );
    return ok == true;
  }

  // ── Routing ──────────────────────────────────────────────────────────────

  Map<String, dynamic> _cfg(String source) => ((_st!['routing'] as Map)[source] as Map).cast<String, dynamic>();
  List<Map<String, dynamic>> _routes(String source) => _maps(_cfg(source)['routes']);

  /// A row as the server takes it back. No agent field: the server keeps the
  /// agent the row already has. Only a deliberate choice adds `agentRef`.
  static Map<String, dynamic> _toRow(Map<String, dynamic> r) => {
        '_id': r['id'],
        'label': r['customLabel'] ?? '',
        'matchKind': r['matchKind'],
        'matchValue': r['matchValue'],
        if ('${r['projectId'] ?? ''}'.isNotEmpty) 'projectId': r['projectId'],
      };

  Future<bool> _saveRoutes(String source, List<Map<String, dynamic>> rows, String ok) =>
      _call('routes-$source', () => _api.dio.put('$_base/routing', data: {source: {'routes': rows}}), ok);

  Future<void> _removeRoute(String source, String id) =>
      _saveRoutes(source, [for (final r in _routes(source)) if (r['id'] != id) _toRow(r)], 'Removed');

  Future<void> _changeAgent(String source, String id, String agentRef) => _saveRoutes(
        source,
        [for (final r in _routes(source)) r['id'] == id ? {..._toRow(r), 'agentRef': agentRef} : _toRow(r)],
        agentRef.isNotEmpty ? 'Agent changed' : 'Saved: this rule will not call anyone',
      );

  /// The default agent is the source's single "any" rule.
  Future<void> _setDefaultAgent(String source, String agentRef) async {
    final cur = _routes(source).where((r) => r['matchKind'] == 'any').firstOrNull;
    if (agentRef.isEmpty) {
      if (cur != null) await _removeRoute(source, '${cur['id']}');
      return;
    }
    if (cur != null) return _changeAgent(source, '${cur['id']}', agentRef);
    await _saveRoutes(
      source,
      [..._routes(source).map(_toRow), {'matchKind': 'any', 'matchValue': '*', 'label': '', 'agentRef': agentRef}],
      'Default agent saved',
    );
  }

  Future<void> _toggleSource(_Source src, bool next) async {
    final live = _st!['enabled'] == true;
    if (next && live) {
      final ok = await _confirm(
        'Start calling new ${src.label} leads?',
        'New ${src.noun} leads that match a rule will be phoned by that rule\'s agent within moments of arriving. '
            'Leads that match nothing are never called. Existing leads are never called.',
        'Yes, start calling',
      );
      if (!ok) return;
    }
    await _call(
      'src-${src.key}',
      () => _api.dio.put('$_base/routing', data: {
        src.key: {'enabled': next},
        if (next) 'confirm': true,
      }),
      next
          ? (live ? '${src.label} leads can now be called' : '${src.label} chosen. Nothing happens until you switch on.')
          : '${src.label} leads will not be called',
    );
  }

  Future<void> _toggleMaster() async {
    if (_st!['enabled'] == true) {
      await _call('master', () => _api.dio.post('$_base/disable'), 'Sending to Vistrow is off');
      return;
    }
    final ok = await _confirm(
      'Switch on Vistrow for new leads?',
      'From now on, every NEW lead created in ArthaLeads is added to Vistrow as a contact. Only the sources you chose, '
          'and only leads that match a rule with an agent, will be phoned. Leads that already exist are never sent or called.',
      'Yes, switch on',
    );
    if (ok) await _call('master', () => _api.dio.post('$_base/enable', data: {'confirm': true}), 'Sending to Vistrow is on');
  }

  Future<void> _addRule(_Source src) async {
    final row = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddRuleSheet(
        source: src,
        agents: _agents,
        projects: _projects,
        pages: _pages,
        adOptions: _adOptions(),
        fbForms: _idOptions(_fbForms),
        fbCampaigns: _idOptions(_fbCampaigns),
        googleCampaigns: _idOptions(_googleCampaigns),
      ),
    );
    if (row == null) return;
    await _saveRoutes(src.key, [..._routes(src.key).map(_toRow), row], 'Saved');
  }

  /// "Name · id · N leads", newest first, so two ads with one name differ.
  static Map<String, String> _idOptions(List<Map<String, dynamic>> list) {
    final sorted = [...list]..sort((a, b) => '${b['lastSeenAt'] ?? ''}'.compareTo('${a['lastSeenAt'] ?? ''}'));
    return {
      for (final a in sorted)
        '${a['value']}': [
          if ('${a['label'] ?? ''}'.isNotEmpty && a['label'] != a['value']) '${a['label']}',
          '${a['value']}',
          if (((a['count'] as num?) ?? 0) > 0) '${a['count']} lead${a['count'] == 1 ? '' : 's'}',
        ].join(' · '),
    };
  }

  Map<String, String> _adOptions() => {
        for (final a in _allAds)
          '${a['value']}': [
            '${a['kind'] == 'leadform' ? 'Lead-form ad' : 'WhatsApp ad'} · ${a['label']}',
            if (a['label'] != a['value']) '${a['value']}',
            ((a['count'] as num?) ?? 0) > 0 ? '${a['count']} lead${a['count'] == 1 ? '' : 's'}' : 'no leads yet',
            if ('${a['agentName'] ?? ''}'.isNotEmpty) 'routed to ${a['agentName']}',
          ].join(' · '),
      };

  Map<String, String> get _agentOptions => {
        for (final a in _agents) '${a['ref']}': '${a['name']} · ${a['knowledgeBase']}',
      };

  // ── UI ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Vistrow auto-call')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2.4))
          : _st == null
              ? ListView(padding: const EdgeInsets.all(24), children: [
                  Text(_loadError ?? 'Could not load the Vistrow settings', textAlign: TextAlign.center, style: TextStyle(color: t.textSoft)),
                  const SizedBox(height: 12),
                  Center(child: OutlinedButton(onPressed: _load, child: const Text('Try again'))),
                ])
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                    children: _body(t),
                  ),
                ),
    );
  }

  List<Widget> _body(AppTheme t) {
    final st = _st!;
    final live = st['enabled'] == true;
    final configured = st['configured'] == true;
    final config = (st['config'] as Map?) ?? const {};
    final health = (st['health'] as Map?) ?? const {};
    final server = (st['server'] as Map?) ?? const {};
    final anyOn = _sources.any((s) => _cfg(s.key)['enabled'] == true);
    final lastFail = DateTime.tryParse('${health['lastFailureAt'] ?? ''}');
    final lastOk = DateTime.tryParse('${health['lastSuccessAt'] ?? ''}');
    final failing = health['lastError'] is Map && lastFail != null && (lastOk == null || lastFail.isAfter(lastOk));

    return [
      Text('Nothing is called until you switch it on, and only brand-new leads are ever included, never the leads you already have.',
          style: TextStyle(fontSize: 13, height: 1.4, color: t.textSoft)),
      const SizedBox(height: 12),
      _masterCard(t, live, configured),
      if (server['killSwitch'] == true) _banner('Sending is paused by the server administrator. Nothing will be sent until they lift it.'),
      if (failing)
        _banner('The last lead could not be passed to Vistrow (${(health['lastError'] as Map)['code']}) at ${_when(health['lastFailureAt'])}. It is still saved here.'),
      if (health['lastWarning'] != null)
        _banner('Vistrow received a lead but did not place the call. Check that the chosen agent exists in Vistrow and has a phone number to call from.',
            amber: true),

      _step(t, 1, 'Connection', configured),
      _card(t, [
        if (!configured)
          Text('Not connected yet. In Vistrow Voice, open Integrations → ArthaLeads and paste the connection token. '
              'You can also connect on the web under Integrations → Vistrow Voice.',
              style: TextStyle(fontSize: 13, height: 1.4, color: t.textSoft))
        else ...[
          Text(
            config['linkedBy'] == 'vistrow'
                ? 'Connected to Vistrow account ${config['accountId']}${'${config['linkedAccountName'] ?? ''}'.isNotEmpty ? ' · ${config['linkedAccountName']}' : ''}'
                : 'Connected to Vistrow account ${config['accountId']}',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text),
          ),
          const SizedBox(height: 6),
          _agentStatus(t),
        ],
      ]),

      _step(t, 2, 'Which new leads should Vistrow call?', anyOn),
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text('Leads from a source you leave off are still added to Vistrow as contacts, but never called.',
            style: TextStyle(fontSize: 12.5, color: t.textSoft)),
      ),
      for (final src in _sources) _sourceToggle(t, src, configured),

      _step(t, 3, 'Choose who calls', _sources.any((s) => _cfg(s.key)['enabled'] == true && _routes(s.key).any((r) => r['unassigned'] != true))),
      if (!anyOn)
        _card(t, [Text('Switch on at least one source above to choose its agents.', style: TextStyle(fontSize: 13, color: t.textSoft))])
      else
        for (final src in _sources.where((s) => _cfg(s.key)['enabled'] == true)) _sourceRules(t, src),

      _step(t, 4, 'What will happen', live),
      _card(t, _summary(t)),

      _step(t, 5, 'Last 24 hours', false, number: false),
      _card(t, _activity(t)),
    ];
  }

  Widget _masterCard(AppTheme t, bool live, bool configured) => _card(t, [
        Row(children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(shape: BoxShape.circle, color: live ? AppColors.success : t.textSoft.withValues(alpha: 0.5)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(live ? 'Live since ${_when(_st!['enabledAt'])}' : 'Not switched on',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: t.text)),
          ),
          if (_busy == 'master')
            const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
          else if (live)
            OutlinedButton(onPressed: _toggleMaster, child: const Text('Switch off'))
          else
            FilledButton(onPressed: configured ? _toggleMaster : null, child: const Text('Switch on')),
        ]),
        if (!configured)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Connect Vistrow first (step 1).', style: TextStyle(fontSize: 12.5, color: t.textSoft)),
          ),
      ]);

  Widget _agentStatus(AppTheme t) {
    switch (_agentState) {
      case 'loading':
        return Row(children: [
          const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 8),
          Text('Checking your Vistrow agents…', style: TextStyle(fontSize: 12.5, color: t.textSoft)),
        ]);
      case 'ok':
        return Row(children: [
          const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF15803D)),
          const SizedBox(width: 6),
          Expanded(
            child: Text('Found ${_agents.length} agent${_agents.length == 1 ? '' : 's'} you can use.',
                style: const TextStyle(fontSize: 12.5, color: Color(0xFF15803D))),
          ),
          TextButton(onPressed: _loadAgents, child: const Text('Refresh')),
        ]);
      case 'error':
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFB45309)),
          const SizedBox(width: 6),
          Expanded(child: Text(_agentProblem, style: const TextStyle(fontSize: 12.5, color: Color(0xFFB45309)))),
          TextButton(onPressed: _loadAgents, child: const Text('Try again')),
        ]);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _sourceToggle(AppTheme t, _Source src, bool configured) {
    final on = _cfg(src.key)['enabled'] == true;
    final busy = _busy == 'src-${src.key}';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
      decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: t.border)),
      child: Row(children: [
        Icon(src.icon, size: 20, color: _violet),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${src.label} leads', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text)),
            const SizedBox(height: 2),
            Text(on ? 'Call them' : "Don't call",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: on ? const Color(0xFF15803D) : t.textSoft)),
          ]),
        ),
        busy
            ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
            : Switch(
                value: on,
                onChanged: configured && _busy.isEmpty ? (v) => _toggleSource(src, v) : null,
              ),
      ]),
    );
  }

  Widget _sourceRules(AppTheme t, _Source src) {
    final routes = _routes(src.key);
    final def = routes.where((r) => r['matchKind'] == 'any').firstOrNull;
    final rules = routes.where((r) => r['matchKind'] != 'any').toList();
    final ready = _agentState == 'ok';
    final busy = _busy == 'routes-${src.key}';
    return _card(t, [
      Row(children: [
        Icon(src.icon, size: 18, color: _violet),
        const SizedBox(width: 8),
        Expanded(child: Text('${src.label} leads', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: t.text))),
        if (busy) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
      ]),
      const SizedBox(height: 10),
      AppSelect<String>(
        label: 'Default agent',
        note: '(when no rule matches)',
        value: def?['agentRef'] as String? ?? '',
        hint: ready ? 'No default: only the rules below call' : 'Agents not loaded yet',
        enabled: ready && !busy,
        options: {
          '': "No agent: won't call",
          ..._agentOptions,
          // An agent that left the Vistrow list still shows by name.
          if (def != null && '${def['agentRef'] ?? ''}'.isNotEmpty && !_agentOptions.containsKey(def['agentRef']))
            '${def['agentRef']}': '${def['agentLabel']} (not in your Vistrow list now)',
        },
        onChanged: (v) => _setDefaultAgent(src.key, v ?? ''),
      ),
      Text('Send some leads to a different agent', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: t.text)),
      const SizedBox(height: 4),
      if (rules.isEmpty)
        Text(
          def != null ? 'No rules yet: every ${src.label} lead goes to the default agent.' : 'No agent chosen yet, so ${src.label} leads will not be called.',
          style: TextStyle(fontSize: 12.5, color: t.textSoft),
        ),
      for (final r in rules) _ruleRow(t, src, r, ready && !busy),
      const SizedBox(height: 6),
      Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: ready && !busy ? () => _addRule(src) : null,
          icon: const Icon(Icons.add_rounded, size: 18),
          label: const Text('Add a rule'),
        ),
      ),
    ]);
  }

  Widget _ruleRow(AppTheme t, _Source src, Map<String, dynamic> r, bool enabled) {
    final unassigned = r['unassigned'] == true;
    final ref = '${r['agentRef'] ?? ''}';
    final agentText = unassigned
        ? "No agent: won't call"
        : (_agentOptions[ref] ?? ('${r['agentLabel'] ?? ''}'.isNotEmpty ? '${r['agentLabel']}' : 'The chosen agent'));
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(
              TextSpan(children: [
                TextSpan(text: '${_kindWord[r['matchKind']] ?? 'Rule'}: ', style: TextStyle(color: t.textSoft)),
                TextSpan(text: _matchText(src.key, r), style: TextStyle(fontWeight: FontWeight.w600, color: t.text)),
              ]),
              style: const TextStyle(fontSize: 13.5, height: 1.35),
            ),
            const SizedBox(height: 4),
            InkWell(
              onTap: enabled ? () => _pickRuleAgent(src, r) : null,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Icon(Icons.arrow_forward_rounded, size: 15, color: t.textSoft),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(agentText,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: unassigned ? const Color(0xFFB45309) : (t.isDark ? const Color(0xFFC4B5FD) : _violet),
                        )),
                  ),
                  Icon(Icons.expand_more_rounded, size: 18, color: t.textSoft),
                ]),
              ),
            ),
          ]),
        ),
        IconButton(
          tooltip: 'Remove this rule',
          onPressed: enabled ? () => _removeRoute(src.key, '${r['id']}') : null,
          icon: Icon(Icons.delete_outline_rounded, size: 20, color: t.textSoft),
        ),
      ]),
    );
  }

  Future<void> _pickRuleAgent(_Source src, Map<String, dynamic> r) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final t = AppTheme.of(ctx);
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.62),
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(vertical: 12), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text('Who calls these leads', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: t.text)),
              ),
              ListTile(title: Text("No agent: won't call", style: TextStyle(color: t.textSoft)), onTap: () => Navigator.pop(ctx, '')),
              for (final a in _agents)
                ListTile(
                  selected: a['ref'] == r['agentRef'],
                  title: Text('${a['name']}'),
                  subtitle: Text('${a['knowledgeBase']}'),
                  onTap: () => Navigator.pop(ctx, '${a['ref']}'),
                ),
            ]),
          ),
        );
      },
    );
    if (picked != null && picked != r['agentRef']) await _changeAgent(src.key, '${r['id']}', picked);
  }

  String _label(List<Map<String, dynamic>> list, String v) {
    final hit = list.where((x) => x['value'] == v).firstOrNull;
    return hit != null && '${hit['label'] ?? ''}'.isNotEmpty && hit['label'] != v ? '${hit['label']}' : '';
  }

  String _matchText(String source, Map<String, dynamic> r) {
    final v = '${r['matchValue'] ?? ''}';
    switch (r['matchKind']) {
      case 'url_contains':
        return '${r['projectName'] ?? ''}'.isNotEmpty ? '$v (${r['projectName']})' : v;
      case 'project':
        return '${'${r['projectName'] ?? ''}'.isNotEmpty ? r['projectName'] : 'Unknown project'}';
      case 'campaign_id':
        final n = _label(source == 'facebook' ? _fbCampaigns : _googleCampaigns, v);
        return n.isNotEmpty ? n : 'campaign $v';
      case 'form_id':
        final n = _label(_fbForms, v);
        return n.isNotEmpty ? n : 'form $v';
      case 'ad_id':
        final n = _label(_allAds, v);
        return n.isNotEmpty ? n : 'ad $v';
      default:
        return '${r['label'] ?? v}';
    }
  }

  List<Widget> _summary(AppTheme t) {
    Widget line(String text, {bool soft = false, double indent = 0}) => Padding(
          padding: EdgeInsets.only(left: indent, top: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(indent > 0 ? '◦  ' : '•  ', style: TextStyle(color: t.textSoft)),
            Expanded(child: Text(text, style: TextStyle(fontSize: 13, height: 1.4, color: soft ? t.textSoft : t.text))),
          ]),
        );
    return [
      line('Every new lead from now on is added to Vistrow as a contact. Existing leads are never sent or called.'),
      for (final src in _sources) ...() {
        final cfg = _cfg(src.key);
        if (cfg['enabled'] != true) return [line('${src.label} leads: not called.')];
        final liveRows = _routes(src.key).where((r) => r['unassigned'] != true).toList();
        if (liveRows.isEmpty) return [line('${src.label} leads: not called, no agent chosen yet.')];
        final dflt = liveRows.where((r) => r['matchKind'] == 'any').firstOrNull;
        final rules = liveRows.where((r) => r['matchKind'] != 'any').toList();
        final n = '${rules.length} rule${rules.length == 1 ? '' : 's'}';
        return [
          line(dflt != null
              ? '${src.label} leads: called by ${'${dflt['agentLabel'] ?? ''}'.isNotEmpty ? dflt['agentLabel'] : 'the default agent'}'
                  '${rules.isNotEmpty ? '; $n send${rules.length == 1 ? 's' : ''} some to other agents.' : '.'}'
              : '${src.label} leads: only leads matching $n are called; others are not.'),
          for (final r in rules)
            line('${_kindWord[r['matchKind']]}: ${_matchText(src.key, r)} → ${'${r['agentLabel'] ?? ''}'.isNotEmpty ? r['agentLabel'] : 'the chosen agent'}',
                indent: 16),
          if (rules.isNotEmpty && dflt == null) line('Any other ${src.label} lead → added as a contact, not called', soft: true, indent: 16),
        ];
      }(),
      line('Leads from anywhere else, or that arrive late or without a valid phone number, are never called.'),
    ];
  }

  List<Widget> _activity(AppTheme t) {
    final s = (_st!['stats24h'] as Map?) ?? const {};
    final counts = (s['counts'] as Map?) ?? const {};
    final tiles = [
      ('Delivered', '${counts['delivered'] ?? 0}'),
      ('Calls requested', '${s['callsRequested'] ?? 0}'),
      ('Declined by Vistrow', '${s['callsDeclinedByVistrow'] ?? 0}'),
      ('Failed', '${((counts['failed'] as num?) ?? 0) + ((counts['dead'] as num?) ?? 0)}'),
    ];
    return [
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 2.4,
        children: [
          for (final (k, v) in tiles)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(k, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.textSoft)),
                Text(v, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: t.text)),
              ]),
            ),
        ],
      ),
      const SizedBox(height: 12),
      Text('Recent', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: t.text)),
      if (_deliveries.isEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text('Nothing has been sent yet.', style: TextStyle(fontSize: 13, color: t.textSoft)),
        ),
      for (final d in _deliveries) _deliveryRow(t, d),
    ];
  }

  Widget _deliveryRow(AppTheme t, Map<String, dynamic> d) {
    final status = '${d['status'] ?? ''}';
    final (bg, fg) = switch (status) {
      'delivered' => (const Color(0x1F22C55E), const Color(0xFF15803D)),
      'pending' || 'sending' => (const Color(0x24F59E0B), const Color(0xFFB45309)),
      'failed' || 'dead' => (const Color(0x1FDC2626), const Color(0xFFDC2626)),
      _ => (t.surfaceLow, t.textSoft),
    };
    final what = status == 'skipped' || status == 'cancelled'
        ? (_skip[d['skipReason']] ?? '${d['skipReason'] ?? ''}')
        : d['autoCall'] == true
            ? 'Call → ${'${d['agentLabel'] ?? ''}'.isNotEmpty ? d['agentLabel'] : 'the chosen agent'}'
                '${'${d['routeLabel'] ?? ''}'.isNotEmpty ? ' via ${d['routeLabel']}' : ''}'
            : 'Contact only: ${_why[d['autoCallReason']] ?? d['autoCallReason'] ?? '-'}';
    final extra = <(String, Color)>[
      if (d['callQueued'] == false && d['autoCall'] == true)
        ('${'${d['callReasonText'] ?? ''}'.isNotEmpty ? d['callReasonText'] : 'Vistrow did not queue the call'}', const Color(0xFFB45309)),
      if (d['callQueued'] == true && d['callQueuedUntil'] != null) ('Call scheduled for ${_when(d['callQueuedUntil'])}', const Color(0xFF15803D)),
      if ('${d['lastErrorCode'] ?? ''}'.isNotEmpty && status != 'delivered')
        ('${d['lastErrorCode']}${'${d['lastErrorMessage'] ?? ''}'.isNotEmpty ? ': ${d['lastErrorMessage']}' : ''}', const Color(0xFFDC2626)),
    ];
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('${_when(d['createdAt'])}  ·  ${d['phone'] ?? '-'}',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.textSoft)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
            child: Text('${d['isTest'] == true ? 'Test: ' : ''}${_statusLabel[status] ?? status}',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
          ),
        ]),
        const SizedBox(height: 4),
        Text(what, style: TextStyle(fontSize: 13, color: t.text)),
        for (final (text, color) in extra)
          Padding(padding: const EdgeInsets.only(top: 2), child: Text(text, style: TextStyle(fontSize: 12, color: color))),
      ]),
    );
  }

  // ── Bits ─────────────────────────────────────────────────────────────────

  Widget _step(AppTheme t, int n, String title, bool done, {bool number = true}) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 18, 2, 8),
        child: Row(children: [
          if (number)
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? const Color(0x2622C55E) : _violet.withValues(alpha: 0.12),
              ),
              child: done
                  ? const Icon(Icons.check_rounded, size: 15, color: Color(0xFF15803D))
                  : Text('$n', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _violet)),
            ),
          if (number) const SizedBox(width: 10),
          Expanded(child: Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: t.text))),
        ]),
      );

  Widget _card(AppTheme t, List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(AppRadii.card), border: Border.all(color: t.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );

  Widget _banner(String text, {bool amber = false}) {
    final fg = amber ? const Color(0xFF92400E) : const Color(0xFFB91C1C);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (amber ? const Color(0xFFF59E0B) : const Color(0xFFDC2626)).withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: (amber ? const Color(0xFFF59E0B) : const Color(0xFFDC2626)).withValues(alpha: 0.28)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.warning_amber_rounded, size: 18, color: fg),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13, height: 1.4, color: fg))),
      ]),
    );
  }

  /// "19 Oct, 2:48 pm" in IST.
  static String _when(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}');
    if (d == null) return '-';
    final ist = d.toUtc().add(const Duration(hours: 5, minutes: 30));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    return '${ist.day} ${months[ist.month - 1]}, $h:${ist.minute.toString().padLeft(2, '0')} ${ist.hour < 12 ? 'am' : 'pm'}';
  }
}

/// "Add a rule": what to match (per source) and the agent who calls.
/// Returns the new route row, agent included.
class _AddRuleSheet extends StatefulWidget {
  final _Source source;
  final List<Map<String, dynamic>> agents;
  final List<Map<String, dynamic>> projects;
  final List<String> pages;
  final Map<String, String> adOptions, fbForms, fbCampaigns, googleCampaigns;
  const _AddRuleSheet({
    required this.source,
    required this.agents,
    required this.projects,
    required this.pages,
    required this.adOptions,
    required this.fbForms,
    required this.fbCampaigns,
    required this.googleCampaigns,
  });

  @override
  State<_AddRuleSheet> createState() => _AddRuleSheetState();
}

class _AddRuleSheetState extends State<_AddRuleSheet> {
  late String _kind = _kindsBySource[widget.source.key]!.keys.first;
  final _text = TextEditingController(); // page, or a typed ID
  String _picked = ''; // project / ad / form / campaign from a list
  String _project = ''; // website rules: optional project
  String _agent = '';
  bool _typing = false; // entering an ID by hand
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Map<String, String> get _projectOptions => {for (final p in widget.projects) '${p['_id']}': '${p['name']}'};

  Map<String, String> get _idList => switch (_kind) {
        'ad_id' => widget.adOptions,
        'form_id' => widget.fbForms,
        'campaign_id' => widget.source.key == 'facebook' ? widget.fbCampaigns : widget.googleCampaigns,
        _ => const {},
      };

  String get _noun => switch (_kind) {
        'ad_id' => 'ad',
        'form_id' => 'lead form',
        'campaign_id' => 'campaign',
        'project' => 'project',
        _ => 'page',
      };

  void _save() {
    final row = <String, dynamic>{'matchKind': _kind, 'label': ''};
    if (_kind == 'url_contains') {
      row['matchValue'] = _text.text.trim();
      if (_project.isNotEmpty) row['projectId'] = _project;
    } else if (_kind == 'project') {
      row['projectId'] = _picked;
      row['matchValue'] = _picked;
    } else {
      row['matchValue'] = _typing ? _text.text.trim() : _picked;
    }
    if ('${row['matchValue']}'.isEmpty) {
      setState(() => _error = _kind == 'url_contains' ? 'Enter the page to match' : 'Choose a $_noun');
      return;
    }
    if (_agent.isEmpty) {
      setState(() => _error = 'Choose which agent should call these leads');
      return;
    }
    row['agentRef'] = _agent;
    Navigator.pop(context, row);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final kinds = _kindsBySource[widget.source.key]!;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text('New rule for ${widget.source.label} leads', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text)),
            const SizedBox(height: 4),
            Text(widget.source.how, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            const SizedBox(height: 14),
            if (kinds.length > 1)
              AppSelect<String>(
                label: widget.source.key == 'whatsapp' ? 'When the chat is about' : 'When the lead came from',
                value: _kind,
                options: kinds,
                onChanged: (v) => setState(() {
                  _kind = v ?? _kind;
                  _picked = '';
                  _typing = false;
                  _text.clear();
                  _error = null;
                }),
              ),
            if (_kind == 'url_contains') ...[
              LabeledField(
                label: 'When the form is on a page containing',
                child: TextField(
                  controller: _text,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: '/shapoorji-pallonji-khopoli/'),
                ),
              ),
              // Pages your website leads came from, to tap instead of typing.
              if (widget.pages.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final p in widget.pages.where((p) => _text.text.isEmpty || p.contains(_text.text.trim())).take(6))
                      ActionChip(
                        label: Text(p, style: const TextStyle(fontSize: 12)),
                        onPressed: () => setState(() => _text.text = p),
                      ),
                  ]),
                ),
              const SizedBox(height: 14),
              AppSelect<String>(
                label: 'Project',
                note: '(optional)',
                value: _project,
                options: {'': 'None', ..._projectOptions},
                onChanged: (v) => setState(() => _project = v ?? ''),
              ),
            ] else if (_kind == 'project')
              AppSelect<String>(
                label: 'Project',
                value: _picked,
                hint: 'Choose a project',
                options: _projectOptions,
                onChanged: (v) => setState(() => _picked = v ?? ''),
              )
            else if (_typing || _idList.isEmpty) ...[
              LabeledField(
                label: '${_noun[0].toUpperCase()}${_noun.substring(1)} ID',
                child: TextField(controller: _text, keyboardType: TextInputType.number, decoration: InputDecoration(hintText: 'Paste the $_noun ID')),
              ),
              const SizedBox(height: 6),
              if (_idList.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text('No ${_noun}s seen yet. They appear after the first lead arrives.', style: TextStyle(fontSize: 12, color: t.textSoft)),
                ),
            ] else
              AppSelect<String>(
                label: '${_noun[0].toUpperCase()}${_noun.substring(1)}',
                value: _picked,
                hint: 'Choose a $_noun',
                options: {..._idList, _manual: 'Enter an ID manually…'},
                onChanged: (v) => setState(() {
                  if (v == _manual) {
                    _typing = true;
                    _picked = '';
                  } else {
                    _picked = v ?? '';
                  }
                }),
              ),
            AppSelect<String>(
              label: 'Agent who calls',
              value: _agent,
              hint: 'Choose an agent',
              options: {for (final a in widget.agents) '${a['ref']}': '${a['name']} · ${a['knowledgeBase']}'},
              onChanged: (v) => setState(() => _agent = v ?? ''),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.danger)),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add rule'),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
