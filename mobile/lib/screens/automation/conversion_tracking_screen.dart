import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';
import '../../widgets/upgrade_wall.dart';

/// Integrations → Meta conversion tracking (Growth, admins): tells Meta which
/// ad leads become serious buyers. Mirrors frontend/src/pages/integrations/
/// ConversionTrackingPage.jsx (27 Oct 2026): an on/off switch, Overview,
/// Settings (Instant Lead Forms: dataset, token, test code; Click to WhatsApp
/// Ads: Meta's own event names; a stage-to-event table for each), Activity
/// (recent events, retry failed) and Setup help. Backend: /api/meta-conversions.
/// The access token is stored encrypted and only its last 4 characters return.
class ConversionTrackingScreen extends StatefulWidget {
  const ConversionTrackingScreen({super.key});

  @override
  State<ConversionTrackingScreen> createState() => _ConversionTrackingScreenState();
}

const _channel = {'lead_ads': 'Lead form', 'whatsapp_ctwa': 'WhatsApp ad'};
const _description = 'Tells Meta which of your ad leads become serious buyers, so it shows your ads to more people like them.';

class _ConversionTrackingScreenState extends State<ConversionTrackingScreen> {
  final _api = ApiClient.instance;
  final _dataset = TextEditingController();
  final _token = TextEditingController();
  final _testCode = TextEditingController();
  final Map<String, TextEditingController> _eventNames = {};
  Map<String, dynamic>? _d;
  List<Map<String, dynamic>> _events = [];
  List<Map<String, dynamic>> _waEvents = [];
  bool _chatQualified = true;
  String _view = 'Overview';
  String _kind = 'lead_ads';
  bool _saving = false;
  bool _testing = false;
  (bool, String)? _testNote;

  bool get _allowed {
    final a = context.read<AuthState>();
    return a.role == 'super_admin' || (a.role == 'admin' && canAccess(a.org, 'growth'));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _allowed) _load();
    });
  }

  @override
  void dispose() {
    _dataset.dispose();
    _token.dispose();
    _testCode.dispose();
    for (final c in _eventNames.values) {
      c.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> _maps(dynamic v) => [
        for (final x in (v as List?) ?? const [])
          if (x is Map) Map<String, dynamic>.from(x),
      ];

  Future<void> _load() async {
    try {
      final r = await _api.dio.get('/meta-conversions');
      final d = (r.data as Map).cast<String, dynamic>();
      _d = d;
      _dataset.text = '${d['datasetId'] ?? ''}';
      _testCode.text = '${d['testEventCode'] ?? ''}';
      _token.clear();
      _events = _maps(d['events']);
      _waEvents = _maps(d['whatsappEvents']);
      _chatQualified = d['whatsappQualified'] != false;
      for (final e in _events) {
        (_eventNames['${e['stage']}'] ??= TextEditingController()).text = '${e['eventName'] ?? ''}';
      }
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not load conversion tracking.'), error: true);
    }
    if (mounted) setState(() {});
  }

  void _snack(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? AppColors.danger : null));
  }

  Future<bool> _save([Map<String, dynamic> extra = const {}]) async {
    setState(() => _saving = true);
    try {
      for (final e in _events) {
        final c = _eventNames['${e['stage']}'];
        if (c != null) e['eventName'] = c.text.trim();
      }
      await _api.dio.put('/meta-conversions', data: {
        'datasetId': _dataset.text.trim(),
        'accessToken': _token.text.trim(),
        'testEventCode': _testCode.text.trim(),
        'events': _events,
        'whatsappEvents': _waEvents,
        'whatsappQualified': _chatQualified,
        ...extra,
      });
      _snack('Saved.');
      await _load();
      return true;
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not save.'), error: true);
      return false;
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _testNote = null;
    });
    try {
      if (!await _save()) return;
      await _api.dio.post('/meta-conversions/test');
      _testNote = (true, 'Meta received the test event. Check the Test Events tab in Events Manager.');
    } catch (e) {
      _testNote = (false, ApiClient.errorMessage(e, 'The test did not go through.'));
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _retry() async {
    try {
      await _api.dio.post('/meta-conversions/retry');
      _snack('Retrying failed events.');
      await Future.delayed(const Duration(milliseconds: 2500));
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not retry.'), error: true);
    }
  }

  /// Leaving Settings without saving drops unsaved edits, so they can't be
  /// saved by accident later.
  void _switchView(String v) {
    if (_view == 'Settings' && v != 'Settings') {
      _testNote = null;
      _load();
    }
    setState(() => _view = v);
  }

  void _setEvent(String stage, Map<String, dynamic> patch) {
    final list = _kind == 'lead_ads' ? _events : _waEvents;
    final i = list.indexWhere((e) => e['stage'] == stage);
    setState(() {
      if (i >= 0) {
        list[i] = {...list[i], ...patch};
      } else {
        list.add({'stage': stage, 'eventName': _kind == 'lead_ads' ? '' : 'QualifiedLead', 'enabled': true, ...patch});
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final t = AppTheme.of(context);
    if (!_allowed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Conversion tracking')),
        body: auth.role == 'admin'
            ? UpgradeWall(org: auth.org, feature: 'Meta conversion tracking', description: _description, needs: 'growth')
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Only an admin can set up conversion tracking.',
                      textAlign: TextAlign.center, style: TextStyle(color: t.textSoft)),
                ),
              ),
      );
    }
    final d = _d;
    if (d == null) {
      return Scaffold(appBar: AppBar(title: const Text('Conversion tracking')), body: const Center(child: AppSpinner(size: 32)));
    }
    final stats = ((d['stats'] as Map?) ?? {}).cast<String, dynamic>();
    final leadFormsSet = d['tokenSet'] == true && '${d['datasetId'] ?? ''}'.isNotEmpty;
    final configured = (d['tokenSet'] == true && _dataset.text.trim().isNotEmpty) || d['whatsappConnected'] == true;
    final enabled = d['enabled'] == true;
    final channels = [if (d['whatsappConnected'] == true) 'WhatsApp ads', if (leadFormsSet) 'Lead forms'].join(', ');
    return Scaffold(
      appBar: AppBar(title: const Text('Conversion tracking')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
          IntegrationHeader(
            logo: const BrandLogo('meta', size: 52),
            title: 'Meta conversion tracking',
            subtitle: _description,
            status: enabled ? StatusPill.on('On') : (configured ? StatusPill.off('Off') : StatusPill.off('Not connected')),
          ),
          const SizedBox(height: 12),
          PanelCard(
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(enabled ? 'Sending to Meta' : 'Off',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: t.text)),
                  if (!configured)
                    Text('Connect WhatsApp to Meta, or add a lead-form dataset in Settings, to switch this on.',
                        style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                ]),
              ),
              _saving
                  ? const Padding(padding: EdgeInsets.all(12), child: AppSpinner(size: 20))
                  : Switch(value: enabled, onChanged: configured ? (v) => _save({'enabled': v}) : null),
            ]),
          ),
          const SizedBox(height: 12),
          MiniStatGrid([
            MiniStat('Events sent', '${stats['sent'] ?? 0}'),
            MiniStat('Failed', '${stats['failed'] ?? 0}'),
            MiniStat('Leads that can be matched', '${d['matchableLeads'] ?? 0}'),
            MiniStat('Channels', channels.isEmpty ? 'None yet' : channels),
          ]),
          const SizedBox(height: 14),
          ChipTabs(tabs: const ['Overview', 'Settings', 'Activity', 'Setup help'], value: _view, onChanged: _switchView),
          const SizedBox(height: 12),
          if (_view == 'Overview') ..._overview(d, leadFormsSet, configured),
          if (_view == 'Settings') ..._settings(d),
          if (_view == 'Activity') ..._activity(d, stats),
          if (_view == 'Setup help') ..._help(),
        ]),
      ),
    );
  }

  List<Widget> _overview(Map<String, dynamic> d, bool leadFormsSet, bool configured) {
    final t = AppTheme.of(context);
    return [
      PanelCard(
        title: 'Connection',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          KeyValueList([
            ('Status', d['enabled'] == true ? 'Sending events to Meta' : 'Off'),
            ('Click to WhatsApp Ads', d['whatsappConnected'] == true ? 'Connected' : 'Not connected'),
            ('Instant Lead Forms', leadFormsSet ? 'Dataset added' : 'Not set up'),
          ]),
          if (!configured)
            Text('Open Settings to connect a dataset. The switch unlocks once Meta can be reached.',
                style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        ]),
      ),
      if ('${d['lastError'] ?? ''}'.isNotEmpty) ...[
        const SizedBox(height: 12),
        ErrorNote('Meta refused the last event: ${d['lastError']}'),
      ],
      const SizedBox(height: 12),
      const PanelCard(
        title: 'What we send',
        child: KeyValueList([
          ('Who', 'Only leads from your Meta lead forms and WhatsApp ads'),
          ('When', 'Once per lead, as it reaches each stage you pick'),
          ('Matched by', "Meta's own lead or ad click ID"),
          ('Never sent', 'Website, manual and other leads'),
        ]),
      ),
    ];
  }

  List<Widget> _settings(Map<String, dynamic> d) {
    final t = AppTheme.of(context);
    final stages = [for (final s in (d['stages'] as List?) ?? const []) '$s']..remove('Closed Lost');
    final waNames = [for (final s in (d['whatsappEventNames'] as List?) ?? const []) '$s'];
    final leadAds = _kind == 'lead_ads';
    final list = leadAds ? _events : _waEvents;
    return [
      PanelCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(spacing: 6, runSpacing: 6, children: [
            ChoiceChip(
              showCheckmark: false,
              avatar: const FaIcon(FontAwesomeIcons.facebook, size: 15, color: Color(0xFF1877F2)),
              label: const Text('Instant Lead Forms'),
              selected: leadAds,
              onSelected: (_) => setState(() => _kind = 'lead_ads'),
            ),
            ChoiceChip(
              showCheckmark: false,
              avatar: const FaIcon(FontAwesomeIcons.whatsapp, size: 15, color: AppColors.whatsapp),
              label: const Text('Click to WhatsApp Ads'),
              selected: !leadAds,
              onSelected: (_) => setState(() => _kind = 'whatsapp_ctwa'),
            ),
          ]),
          const SizedBox(height: 12),
          if (leadAds) ...[
            Text(
              'For leads from Facebook and Instagram lead forms. Meta needs the first event (a lead arriving) plus at least two later stages before it starts learning from them.',
              style: TextStyle(fontSize: 12, color: t.textSoft),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _dataset,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Dataset ID', hintText: 'e.g. 1234567890123456'),
            ),
            const SizedBox(height: 10),
            SecretField(
              label: 'Conversions API access token',
              controller: _token,
              saved: d['tokenSet'] == true,
              savedHint: 'Saved, ends in ${d['tokenLast4'] ?? ''}. Paste a new one to replace it.',
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _testCode,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Test event code (for "Send a test event")', hintText: 'e.g. TEST12345'),
            ),
            const SizedBox(height: 8),
            Text(
              'In Meta Events Manager, open your dataset, then Settings, then Conversions API, and choose Generate access token. The dataset ID is shown at the top of that page. Your token is stored encrypted and never shown again.',
              style: TextStyle(fontSize: 11.5, color: t.textSoft),
            ),
          ] else ...[
            Text(
              "For leads who messaged you from a Click to WhatsApp ad. Meta accepts only its own event names for these, so pick one from each list.",
              style: TextStyle(fontSize: 12, color: t.textSoft),
            ),
            const SizedBox(height: 8),
            Text(
              d['whatsappConnected'] == true
                  ? "Sent through your WhatsApp connection to your WhatsApp account's own dataset${'${d['whatsappDatasetId'] ?? ''}'.isNotEmpty ? ' (${d['whatsappDatasetId']})' : ''}. Nothing to paste."
                  : "Needs WhatsApp connected to Meta directly (WhatsApp Cloud API). AiSensy, Wati and Interakt don't pass on the ad click, so these leads can't be matched.",
              style: TextStyle(fontSize: 12, color: d['whatsappConnected'] == true ? AppColors.success : t.textSoft),
            ),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      PanelCard(
        title: 'What to tell Meta',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final (i, stage) in stages.indexed) ...[
            if (i > 0) Divider(height: 1, color: t.border),
            Builder(builder: (context) {
              final e = list.firstWhere((x) => x['stage'] == stage,
                  orElse: () => {'stage': stage, 'eventName': '', 'enabled': false});
              final on = e['enabled'] == true;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: on,
                    onChanged: (v) => _setEvent(stage, {'enabled': v == true}),
                    title: Text.rich(TextSpan(style: TextStyle(fontSize: 13, color: t.text), children: [
                      TextSpan(text: stage == 'New' ? 'Lead ' : 'Lead reaches '),
                      TextSpan(text: stage == 'New' ? 'arrives' : stage, style: const TextStyle(fontWeight: FontWeight.w800)),
                    ])),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 48),
                    child: leadAds
                        ? TextField(
                            controller: _eventNames.putIfAbsent(stage, () => TextEditingController(text: '${e['eventName'] ?? ''}')),
                            enabled: on,
                            decoration: const InputDecoration(labelText: 'send event', isDense: true),
                          )
                        : DropdownButtonFormField<String>(
                            key: ValueKey('wa-$stage-${e['eventName']}'),
                            initialValue: waNames.contains(e['eventName']) ? '${e['eventName']}' : null,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'send event', isDense: true),
                            items: [for (final n in waNames) DropdownMenuItem(value: n, child: Text(n))],
                            onChanged: on ? (v) => _setEvent(stage, {'eventName': v}) : null,
                          ),
                  ),
                ]),
              );
            }),
          ],
          if (!leadAds) ...[
            Divider(height: 1, color: t.border),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
              value: _chatQualified,
              onChanged: (v) => setState(() => _chatQualified = v == true),
              title: Text(
                'Lead answers budget and timeline, or asks for a site visit or an advisor, or registers, in the chat',
                style: TextStyle(fontSize: 13, color: t.text),
              ),
              subtitle: const Text('send event QualifiedLead'),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            'Each event goes once per lead. ${d['matchableLeads'] ?? 0} of your leads came from a Meta lead form or WhatsApp ad and can be matched; website, manual and other leads are never sent.',
            style: TextStyle(fontSize: 11.5, color: t.textSoft),
          ),
        ]),
      ),
      const SizedBox(height: 14),
      Wrap(spacing: 10, runSpacing: 10, children: [
        GradientButton(onPressed: _saving ? null : () => _save(), loading: _saving, child: const Text('Save settings')),
        if (leadAds)
          SecondaryButton(
            onPressed: _testing ||
                    _saving ||
                    _dataset.text.trim().isEmpty ||
                    _testCode.text.trim().isEmpty ||
                    !(d['tokenSet'] == true || _token.text.trim().isNotEmpty)
                ? null
                : _test,
            child: Text(_testing ? 'Sending…' : 'Send a test event'),
          ),
      ]),
      if (leadAds && _testCode.text.trim().isEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text('Add a test event code first, so the test is not counted as a real lead.',
              style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        ),
      if (_testNote != null) ...[
        const SizedBox(height: 10),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(_testNote!.$1 ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
              size: 17, color: _testNote!.$1 ? AppColors.success : AppColors.danger),
          const SizedBox(width: 6),
          Expanded(
            child: Text(_testNote!.$2,
                style: TextStyle(fontSize: 12.5, color: _testNote!.$1 ? AppColors.success : AppColors.danger)),
          ),
        ]),
      ],
    ];
  }

  List<Widget> _activity(Map<String, dynamic> d, Map<String, dynamic> stats) {
    final t = AppTheme.of(context);
    final recent = _maps(d['recent']);
    final failed = ((stats['failed'] as num?) ?? 0).toInt();
    final skipped = ((stats['skipped'] as num?) ?? 0).toInt();
    return [
      PanelCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(
              child: Text(
                '${stats['sent'] ?? 0} sent${failed > 0 ? ', $failed failed' : ''}${skipped > 0 ? ', $skipped skipped' : ''}',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: t.textSoft),
              ),
            ),
            if (failed > 0) TextButton(onPressed: _retry, child: const Text('Retry failed')),
          ]),
          if ('${d['lastError'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 8),
            ErrorNote('Meta refused the last event: ${d['lastError']}'),
          ],
          const SizedBox(height: 8),
          if (recent.isEmpty)
            Text('Nothing yet. Events appear here as leads from your Meta ads move through the pipeline.',
                style: TextStyle(fontSize: 12.5, color: t.textSoft))
          else
            for (final (i, e) in recent.indexed) ...[
              if (i > 0) Divider(height: 1, color: t.border),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${e['leadName'] ?? ''}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.text)),
                      Text('${e['stage']} → ${e['eventName']}', style: TextStyle(fontSize: 12, color: t.textSoft)),
                      Text('${_channel[e['channel']] ?? e['channel'] ?? ''} · ${istTime(e['at'])}',
                          style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                      if ('${e['error'] ?? ''}'.isNotEmpty)
                        Text('${e['error']}', style: const TextStyle(fontSize: 11.5, color: AppColors.danger)),
                    ]),
                  ),
                  switch ('${e['status']}') {
                    'sent' => StatusPill.on('Sent'),
                    'failed' => StatusPill.bad('Failed'),
                    'skipped' => StatusPill.off('Skipped'),
                    _ => StatusPill.warn('Waiting'),
                  },
                ]),
              ),
            ],
        ]),
      ),
    ];
  }

  List<Widget> _help() => const [
        PanelCard(
          title: 'Click to WhatsApp Ads',
          child: SetupSteps([
            ('Connect WhatsApp', 'Connect WhatsApp to Meta directly (WhatsApp Cloud API) under Integrations, WhatsApp Business.'),
            ('Pick the events', 'On the Settings tab, choose Click to WhatsApp Ads and pick an event for each stage.'),
            ('Switch it on', 'Save, then switch tracking on at the top of this screen.'),
          ]),
        ),
        SizedBox(height: 12),
        PanelCard(
          title: 'Instant Lead Forms',
          child: SetupSteps([
            ('Make a token', 'In Meta Events Manager, open your dataset, then Settings, then Conversions API, and generate an access token.'),
            ('Paste it here', 'Paste the dataset ID and token on the Settings tab, under Instant Lead Forms.'),
            ('Test it', 'Add a test event code and use Send a test event to check it arrives in Events Manager.'),
            ('Give it time', 'Meta needs the lead arriving plus at least two later stages before it learns from them.'),
          ]),
        ),
      ];
}
