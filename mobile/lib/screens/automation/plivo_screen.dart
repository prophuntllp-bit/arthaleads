import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/app_select.dart';
import '../../widgets/buttons.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';
import 'telephony_hub_screen.dart' show showPlivoNumber;

/// Integrations → Telephony → Plivo. Mirrors frontend/src/pages/integrations/
/// PlivoPage.jsx and components/PlivoSettings.jsx (27 Oct 2026): Overview
/// (connection, 7-day calls), Settings for admins (Auth ID and Token, the
/// number calls go out from, incoming calls, test), Setup help. The Auth
/// Token is stored encrypted on the server and never sent back.
class PlivoScreen extends StatefulWidget {
  const PlivoScreen({super.key});

  @override
  State<PlivoScreen> createState() => _PlivoScreenState();
}

class _PlivoScreenState extends State<PlivoScreen> {
  final _api = ApiClient.instance;
  final _authId = TextEditingController();
  final _token = TextEditingController();
  Map<String, dynamic>? _d;
  Map<String, dynamic>? _stats;
  String _tab = 'Overview';
  String _busy = '';
  (bool, String)? _note;

  @override
  void initState() {
    super.initState();
    _load(fillForm: true);
  }

  @override
  void dispose() {
    _authId.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _load({bool fillForm = false}) async {
    try {
      final r = await _api.dio.get('/plivo/settings');
      _d = (r.data as Map).cast<String, dynamic>();
      if (fillForm) _authId.text = '${_p['authId'] ?? ''}';
    } catch (_) {}
    try {
      final r = await _api.dio.get('/plivo/call-stats', queryParameters: {'provider': 'plivo'});
      _stats = (r.data as Map).cast<String, dynamic>();
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Map<String, dynamic> get _p => ((_d?['plivo'] as Map?) ?? {}).cast<String, dynamic>();
  bool get _ready => _p['hasAuthToken'] == true && '${_p['number'] ?? ''}'.isNotEmpty;
  bool get _inUse => _d?['provider'] == 'plivo';
  bool get _isAdmin {
    final r = context.read<AuthState>().role;
    return r == 'admin' || r == 'super_admin';
  }

  void _snack(String text, {bool error = false}) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? AppColors.danger : null));

  Future<bool> _save() async {
    setState(() => _busy = 'save');
    try {
      final body = <String, dynamic>{'authId': _authId.text.trim()};
      if (_token.text.trim().isNotEmpty) body['authToken'] = _token.text.trim();
      await _api.dio.patch('/plivo/settings', data: body);
      _token.clear();
      _snack('Plivo settings saved.');
      await _load();
      return true;
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not save.'), error: true);
      return false;
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  /// Settings tab: saves first, as the web does. Header: tests what is saved.
  Future<void> _test({bool saveFirst = false}) async {
    setState(() => _note = null);
    if (saveFirst && !await _save()) return;
    setState(() => _busy = 'test');
    try {
      final r = await _api.dio.post('/plivo/settings/test');
      _note = (true, '${r.data['message'] ?? 'Connected.'}');
      await _load();
    } catch (e) {
      _note = (false, ApiClient.errorMessage(e, 'Could not reach Plivo.'));
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _use() async {
    setState(() => _busy = 'use');
    final auth = context.read<AuthState>();
    try {
      final r = await _api.dio.patch('/plivo/settings', data: {'provider': 'plivo'});
      _snack('Calls now go through Plivo.');
      final inbound = r.data is Map ? r.data['inbound'] : null;
      if (inbound != null && inbound != 'connected') _snack('Incoming calls $inbound.', error: true);
      auth.refresh().catchError((_) {});
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not switch.'), error: true);
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _setNumber(String number) async {
    try {
      await _api.dio.patch('/plivo/settings', data: {'number': number});
      _snack('Calls now go out from ${showPlivoNumber(number)}.');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not change the number.'), error: true);
    }
  }

  Future<void> _connectInbound() async {
    setState(() => _busy = 'inbound');
    try {
      final r = await _api.dio.post('/plivo/settings/inbound');
      _snack('${r.data['message'] ?? 'Incoming calls connected.'}');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not connect incoming calls.'), error: true);
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    final tabs = ['Overview', if (_isAdmin) 'Settings', 'Setup help'];
    return Scaffold(
      appBar: AppBar(title: const Text('Plivo')),
      body: d == null
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                IntegrationHeader(
                  logo: const BrandLogo('plivo', size: 52),
                  title: 'Plivo',
                  subtitle:
                      'Your phone rings first; when you answer, the lead is dialled from your Plivo number. Each side is recorded on its own channel, so the transcript shows who said what.',
                  status: _inUse
                      ? StatusPill.on('In use')
                      : (_ready ? StatusPill.off('Off') : StatusPill.off('Not connected')),
                  actions: [
                    if (_isAdmin && _p['hasAuthToken'] == true)
                      SecondaryButton(
                        onPressed: _busy.isEmpty ? () => _test() : null,
                        child: Text(_busy == 'test' ? 'Testing…' : 'Test connection'),
                      ),
                    if (_isAdmin && _ready && !_inUse)
                      GradientButton(
                        onPressed: _busy.isEmpty ? _use : null,
                        loading: _busy == 'use',
                        child: const Text('Use Plivo for calls'),
                      ),
                  ],
                ),
                if (_note != null) ...[
                  const SizedBox(height: 10),
                  _noteLine(_note!),
                ],
                const SizedBox(height: 14),
                MiniStatGrid([
                  MiniStat('Calls · 7 days', _stats == null ? '-' : '${_stats!['total'] ?? 0}'),
                  MiniStat('Answered · 7 days', _stats == null ? '-' : '${_stats!['answered'] ?? 0}'),
                  MiniStat('Incoming · 7 days', _stats == null ? '-' : '${_stats!['inbound'] ?? 0}'),
                  MiniStat('Last call', _stats?['lastAt'] != null ? agoText(_stats!['lastAt']) : 'None yet'),
                ]),
                const SizedBox(height: 14),
                ChipTabs(tabs: tabs, value: _tab, onChanged: (v) => setState(() => _tab = v)),
                const SizedBox(height: 12),
                if (_tab == 'Overview') ..._overview(),
                if (_tab == 'Settings' && _isAdmin) ..._settings(),
                if (_tab == 'Setup help') ..._help(),
              ]),
            ),
    );
  }

  Widget _noteLine((bool, String) note) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(note.$1 ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
            size: 17, color: note.$1 ? AppColors.success : AppColors.danger),
        const SizedBox(width: 6),
        Expanded(
          child: Text(note.$2,
              style: TextStyle(fontSize: 12.5, color: note.$1 ? AppColors.success : AppColors.danger)),
        ),
      ]);

  List<Widget> _overview() => [
        PanelCard(
          title: 'Connection',
          child: KeyValueList([
            ('Status', _inUse ? 'In use for calls' : (_ready ? 'Connected, not in use' : 'Not connected')),
            ('Auth ID', '${_p['authId'] ?? ''}'.isEmpty ? '-' : '${_p['authId']}'),
            ('Calls go out from', showPlivoNumber('${_p['number'] ?? ''}')),
            ('Incoming calls', _p['inboundConnected'] == true ? 'Connected' : 'Not connected'),
            if (_stats?['lastAt'] != null) ('Last call', istTime(_stats!['lastAt'])),
          ]),
        ),
        const SizedBox(height: 12),
        PanelCard(
          title: 'Incoming calls',
          child: Text(
            'A lead who calls your Plivo number rings the team member who last called them (or the next one in rotation). The call is logged on the lead and recorded.',
            style: TextStyle(fontSize: 12.5, color: AppTheme.of(context).textSoft),
          ),
        ),
        const SizedBox(height: 12),
        const PanelCard(
          title: 'Recordings and transcripts',
          child: KeyValueList([
            ('Recording', 'Both sides, on separate channels'),
            ('Transcript', 'Each line labelled agent or lead'),
            ('Summary', 'AI summary after every answered call'),
            ('Stored', 'On Plivo, with a copy in your file space where it is set up'),
          ]),
        ),
      ];

  List<Widget> _settings() {
    final t = AppTheme.of(context);
    final numbers = [for (final n in (_p['numbers'] as List?) ?? const []) '$n'];
    final number = '${_p['number'] ?? ''}';
    final inbound = _p['inboundConnected'] == true;
    return [
      PanelCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(
            controller: _authId,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(labelText: 'Auth ID', hintText: 'From the Plivo console home page'),
          ),
          const SizedBox(height: 12),
          SecretField(
            label: 'Auth Token',
            controller: _token,
            saved: _p['hasAuthToken'] == true,
          ),
          if (number.isNotEmpty) ...[
            const SizedBox(height: 14),
            if (numbers.length > 1)
              AppSelect<String>(
                label: 'Calls go out from',
                value: numbers.contains(number) ? number : numbers.first,
                options: {for (final n in numbers) n: showPlivoNumber(n)},
                onChanged: (v) {
                  if (v != null && v != number) _setNumber(v);
                },
              )
            else
              Text.rich(TextSpan(style: TextStyle(fontSize: 13, color: t.textSoft), children: [
                const TextSpan(text: 'Calls go out from '),
                TextSpan(
                    text: showPlivoNumber(number),
                    style: TextStyle(fontWeight: FontWeight.w800, color: t.text)),
                const TextSpan(text: ' from your Plivo account'),
              ])),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      PanelCard(
        title: 'Incoming calls',
        subtitle: inbound
            ? 'Connected. A lead calling your Plivo number rings the agent who last called them, and the call is logged and recorded.'
            : "Not connected yet. Calls to your Plivo number won't reach your team until you connect them.",
        child: Align(
          alignment: Alignment.centerLeft,
          child: SecondaryButton(
            onPressed: _busy.isEmpty && _p['hasAuthToken'] == true && number.isNotEmpty ? _connectInbound : null,
            child: Text(_busy == 'inbound' ? 'Connecting…' : (inbound ? 'Reconnect' : 'Connect incoming calls')),
          ),
        ),
      ),
      const SizedBox(height: 12),
      PanelCard(
        child: Text(
          'Plivo India rules: the account must be in the India data region with KYC approved, the caller ID must be your Plivo Indian number, and calls stay within India. Use a landline (Local) number for calls to people who enquired; cold or promotional calls are not allowed under TRAI rules.',
          style: TextStyle(fontSize: 12, color: t.textSoft),
        ),
      ),
      const SizedBox(height: 14),
      Wrap(spacing: 10, runSpacing: 10, children: [
        GradientButton(
          onPressed: _busy.isEmpty ? _save : null,
          loading: _busy == 'save',
          child: const Text('Save'),
        ),
        SecondaryButton(
          onPressed: _busy.isEmpty && _authId.text.trim().isNotEmpty ? () => _test(saveFirst: true) : null,
          child: Text(_busy == 'test' ? 'Testing…' : 'Test connection'),
        ),
      ]),
      if (_note != null) ...[const SizedBox(height: 10), _noteLine(_note!)],
    ];
  }

  List<Widget> _help() => [
        const PanelCard(
          title: 'Set it up',
          child: SetupSteps([
            ('Copy the keys', 'In the Plivo console, open the Overview page and copy the Auth ID and Auth Token.'),
            ('Save them here', 'Paste both on the Settings tab and save. Your Plivo number is picked up from the account.'),
            ('Switch Plivo on', 'Tap Use Plivo for calls. Incoming calls to the number are connected at the same time.'),
            ('Call a lead', "Call a lead from the CRM: your phone rings first, then the lead's."),
          ]),
        ),
        const SizedBox(height: 12),
        PanelCard(
          title: 'Rules in India',
          child: Text(
            'The Plivo account must be in the India data region with KYC approved, and calls stay within India. Use a landline (Local) number for calls to people who enquired. Cold or promotional calls are not allowed under TRAI rules.',
            style: TextStyle(fontSize: 12.5, color: AppTheme.of(context).textSoft),
          ),
        ),
      ];
}
