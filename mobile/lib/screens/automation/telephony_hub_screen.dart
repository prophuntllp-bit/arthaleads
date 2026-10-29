import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/glass.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';
import 'plivo_screen.dart';
import 'telephony_integration_screen.dart';

/// "918065492852" reads as "+91 80 6549 2852" (landline grouping, as the web).
String showPlivoNumber(String? n) {
  final s = n ?? '';
  if (RegExp(r'^91\d{10}$').hasMatch(s)) return '+91 ${s.substring(2, 4)} ${s.substring(4, 8)} ${s.substring(8)}';
  return s.isEmpty ? '-' : '+$s';
}

/// Integrations → Telephony: which phone service click-to-call goes through,
/// with a card for each. Mirrors frontend/src/pages/TelephonyIntegration.jsx
/// (27-28 Oct 2026). Only one can be on; switching the one in use off leaves
/// calling off. GET/PATCH /plivo/settings holds the choice for both.
class TelephonyHubScreen extends StatefulWidget {
  const TelephonyHubScreen({super.key});

  @override
  State<TelephonyHubScreen> createState() => _TelephonyHubScreenState();
}

class _TelephonyHubScreenState extends State<TelephonyHubScreen> {
  final _api = ApiClient.instance;
  String? _provider;
  Map<String, dynamic> _plivo = {};
  Map<String, dynamic>? _enablex;
  String _switching = '';

  static const _names = {'plivo': 'Plivo', 'enablex': 'EnableX'};
  static const _lines = {
    'plivo': 'Your phone rings first, then the lead. Each side is recorded separately, so transcripts show who said what.',
    'enablex': 'Click-to-call through your EnableX number, with recordings and the in-app browser phone.',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    Future<void> plivo() async {
      try {
        final r = await _api.dio.get('/plivo/settings');
        _provider = '${r.data['provider'] ?? 'enablex'}';
        _plivo = ((r.data['plivo'] as Map?) ?? {}).cast<String, dynamic>();
      } catch (_) {
        _provider ??= 'enablex';
      }
    }

    Future<void> enablex() async {
      try {
        final r = await _api.dio.get('/calls/settings');
        _enablex = (r.data as Map).cast<String, dynamic>();
      } catch (_) {
        _enablex = {'connected': false};
      }
    }

    await Future.wait([plivo(), enablex()]);
    if (mounted) setState(() {});
  }

  bool get _isAdmin {
    final r = context.read<AuthState>().role;
    return r == 'admin' || r == 'super_admin';
  }

  Map<String, bool> get _ready => {
        'plivo': _plivo['hasAuthToken'] == true && '${_plivo['number'] ?? ''}'.isNotEmpty,
        'enablex': _enablex?['connected'] == true,
      };

  Future<void> _switchTo(String key) async {
    if (key == _provider || _switching.isNotEmpty) return;
    setState(() => _switching = key);
    final messenger = ScaffoldMessenger.of(context);
    final auth = context.read<AuthState>();
    try {
      final res = await _api.dio.patch('/plivo/settings', data: {'provider': key});
      if (!mounted) return;
      setState(() => _provider = key);
      messenger.showSnackBar(SnackBar(
        content: Text(key == 'none'
            ? 'Calling is off. Switch a service on to call leads again.'
            : 'Calls now go through ${_names[key]}.'),
      ));
      final inbound = res.data is Map ? res.data['inbound'] : null;
      if (inbound != null && inbound != 'connected') {
        messenger.showSnackBar(SnackBar(
          content: Text('Incoming calls $inbound. Open Plivo settings to connect them.'),
          backgroundColor: AppColors.danger,
        ));
      }
      // The call menu reads the service from the signed-in profile.
      auth.refresh().catchError((_) {});
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(ApiClient.errorMessage(e, 'Could not switch.')),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _switching = '');
    }
  }

  Future<void> _open(String key) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => key == 'plivo' ? const PlivoScreen() : const TelephonyIntegrationScreen(),
    ));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final p = _provider;
    return Scaffold(
      appBar: AppBar(title: const Text('Telephony')),
      body: p == null
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                IntegrationHeader(
                  logo: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary),
                  ),
                  title: 'Telephony',
                  subtitle:
                      'Click-to-call from the CRM and the app, call recordings and AI call summaries. Call history stays the same whichever service you use.',
                  status: p == 'none' ? StatusPill.off('Calling off') : StatusPill.on('Calls through ${_names[p] ?? p}'),
                ),
                const SizedBox(height: 18),
                Text('Phone services',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.of(context).text)),
                const SizedBox(height: 3),
                Text(
                  'Switch on the one your calls should go through; only one can be on. With both off, click-to-call is off. Open a card for its calls and settings.',
                  style: TextStyle(fontSize: 12, color: AppTheme.of(context).textSoft),
                ),
                const SizedBox(height: 12),
                for (final key in const ['plivo', 'enablex']) ...[
                  _card(key),
                  const SizedBox(height: 12),
                ],
              ]),
            ),
    );
  }

  Widget _card(String key) {
    final t = AppTheme.of(context);
    final ready = _ready[key]!;
    final inUse = _provider == key;
    final footer = key == 'plivo'
        ? (ready ? 'Calls go out from ${showPlivoNumber('${_plivo['number']}')}' : 'Not set up yet')
        : (ready ? 'Number ${(_enablex?['enablex'] as Map?)?['virtualNumber'] ?? 'saved'}' : 'Not set up yet');
    final canSwitch = ready || inUse;
    return InkWell(
      onTap: () => _open(key),
      borderRadius: BorderRadius.circular(18),
      child: SoftSurface(
        radius: 18,
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            BrandLogo(key, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_names[key]!, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: t.text)),
                const SizedBox(height: 3),
                inUse ? StatusPill.on('In use') : (ready ? StatusPill.off('Off') : StatusPill.off('Not connected')),
              ]),
            ),
            if (_isAdmin)
              Tooltip(
                message: canSwitch ? '' : 'Set up ${_names[key]} first',
                child: _switching.isNotEmpty && _switching == (inUse ? 'none' : key)
                    ? const Padding(padding: EdgeInsets.all(12), child: AppSpinner(size: 20))
                    : Switch(
                        value: inUse,
                        onChanged: !canSwitch || _switching.isNotEmpty ? null : (next) => _switchTo(next ? key : 'none'),
                      ),
              ),
          ]),
          const SizedBox(height: 10),
          Text(_lines[key]!, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: Text(footer, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.text))),
            Text(ready ? 'Manage' : 'Set up',
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
            const Icon(Icons.chevron_right_rounded, color: AppColors.primary, size: 18),
          ]),
        ]),
      ),
    );
  }
}
