import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

/// Automation -> Telephony — EnableX credentials, webhook/answer URLs, and
/// AI auto-status. Reached from Automation's "Telephony" quick-connect tile,
/// mirroring frontend/src/pages/TelephonyIntegration.jsx (which wraps the
/// same EnableXSettings component web moved out of Settings).
class TelephonyIntegrationScreen extends StatefulWidget {
  const TelephonyIntegrationScreen({super.key});

  @override
  State<TelephonyIntegrationScreen> createState() =>
      _TelephonyIntegrationScreenState();
}

class _TelephonyIntegrationScreenState
    extends State<TelephonyIntegrationScreen> {
  final _api = ApiClient.instance;

  final _appId = TextEditingController();
  final _apiKey = TextEditingController();
  final _number = TextEditingController();
  bool _loaded = false;
  bool _connected = false;
  bool _hasKey = false;
  bool _aiStatus = false;
  bool _busy = false;
  bool _showKey = false;
  String _inboundUrl = '';
  String _orgId = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _appId.dispose();
    _apiKey.dispose();
    _number.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _busy = true);
    try {
      final res = await _api.dio.get('/calls/settings');
      final settings = (res.data['enablex'] as Map? ?? {})
          .cast<String, dynamic>();
      _appId.text = settings['appId']?.toString() ?? '';
      _number.text = settings['virtualNumber']?.toString() ?? '';
      setState(() {
        _connected = res.data['connected'] == true;
        _hasKey = settings['hasApiKey'] == true;
        _aiStatus = settings['aiAutoStatus'] == true;
        _inboundUrl = res.data['inboundUrl']?.toString() ?? '';
        _orgId = res.data['orgId']?.toString() ?? '';
        _loaded = true;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load telephony settings'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (_appId.text.trim().isEmpty ||
        (_apiKey.text.trim().isEmpty && !_hasKey)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter the EnableX APP ID and APP KEY'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.dio.patch(
        '/calls/settings',
        data: {
          'appId': _appId.text.trim(),
          if (_apiKey.text.trim().isNotEmpty) 'apiKey': _apiKey.text.trim(),
          'virtualNumber': _number.text.trim(),
        },
      );
      setState(() => _hasKey = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('EnableX credentials saved'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Save failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _test() async {
    setState(() => _busy = true);
    try {
      await _api.dio.post('/calls/settings/test');
      setState(() => _connected = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('EnableX connected successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Connection failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirmDisconnect() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnect EnableX telephony?'),
        content: const Text(
          'Click-to-call, recordings, and AI call summaries will stop working until you reconnect.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Disconnect',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _updateFlag(String key, bool value) async {
    if (key == 'enabled' && value == false && !await _confirmDisconnect()) {
      return;
    }
    try {
      await _api.dio.patch('/calls/settings', data: {key: value});
      setState(() {
        if (key == 'enabled') _connected = value;
        if (key == 'aiAutoStatus') _aiStatus = value;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Update failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Telephony Integration')),
      body: _busy && !_loaded
          ? const Center(child: AppSpinner(size: 32))
          : _body(context),
    );
  }

  Widget _body(BuildContext context) {
    final webhook = _orgId.isEmpty
        ? 'https://api.arthaleads.com/api/calls/webhook'
        : 'https://api.arthaleads.com/api/calls/webhook/$_orgId';

    Widget copyRow(String label, String value) => Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    value,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Copy',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(const SnackBar(content: Text('Copied')));
                  },
                  icon: const Icon(Icons.copy, size: 17),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.phone_in_talk_outlined,
                color: AppColors.primary,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AUTOMATION',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppTheme.of(context).textSoft,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Connect EnableX for click-to-call, recordings and AI summaries',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          color: (_connected ? AppColors.success : AppColors.primary)
              .withValues(alpha: 0.07),
          child: ListTile(
            leading: Icon(
              _connected ? Icons.wifi : Icons.wifi_off,
              color: _connected ? AppColors.success : AppColors.primary,
            ),
            title: Text(
              _connected ? 'EnableX Connected' : 'EnableX not connected',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              _connected
                  ? 'Click-to-call, recordings and AI summaries are active.'
                  : 'Enter your credentials to enable telephony.',
            ),
            trailing: _connected
                ? TextButton(
                    onPressed: () => _updateFlag('enabled', false),
                    child: const Text(
                      'Disconnect',
                      style: TextStyle(color: AppColors.danger),
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'EnableX credentials',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: () => launchUrl(
            Uri.parse('https://portal.enablex.io'),
            mode: LaunchMode.externalApplication,
          ),
          child: const Text(
            'Get your APP ID and APP KEY from the EnableX partner portal →',
            style: TextStyle(fontSize: 11, color: AppColors.primary),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _appId,
          decoration: const InputDecoration(labelText: 'APP ID'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _apiKey,
          obscureText: !_showKey,
          decoration: InputDecoration(
            labelText: _hasKey ? 'APP KEY (saved — enter only to replace)' : 'APP KEY',
            suffixIcon: IconButton(
              onPressed: () => setState(() => _showKey = !_showKey),
              icon: Icon(
                _showKey ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _number,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Virtual Phone Number'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: GradientButton(
                loading: _busy,
                onPressed: _busy ? null : _save,
                child: const Text('Save Credentials'),
              ),
            ),
            if (_hasKey) ...[
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _test,
                  icon: const Icon(Icons.phone, size: 16),
                  label: const Text('Test & Enable'),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 18),
        copyRow('Recording Webhook URL', webhook),
        if (_inboundUrl.isNotEmpty) copyRow('Inbound Answer URL', _inboundUrl),
        if (_connected)
          Card(
            child: SwitchListTile.adaptive(
              title: const Text(
                'AI Auto-Status Updates',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: const Text(
                'Advance lead status automatically when call AI detects intent.',
              ),
              value: _aiStatus,
              onChanged: (value) => _updateFlag('aiAutoStatus', value),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }
}
