import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_embedded_signup_screen.dart';
import 'wa_operations.dart';
import 'wa_ui.dart';

const _providers = {
  'meta': {
    'name': 'Arthaleads WhatsApp API',
    'badge': 'Official',
    'fields': ['apiKey', 'wabaId', 'phoneNumberId', 'webhookVerifyToken'],
    'tagline': 'Direct · No middleman',
    'pricing': 'Templates, campaigns and inbox',
    'apiKeyLabel': 'Permanent access token',
    'apiKeyPlaceholder': 'EAAxxxxx… (permanent system user token)',
    'apiKeyHelp': 'Business Settings → System users → Generate token, with the whatsapp_business_messaging and whatsapp_business_management permissions.',
  },
  'aisensy': {
    'name': 'AiSensy',
    'fields': ['apiKey'],
    'tagline': 'Most popular in India',
    'pricing': 'Free tier · ₹999/mo starter',
    'apiKeyLabel': 'AiSensy API key',
    'apiKeyPlaceholder': 'Paste your AiSensy API key',
    'apiKeyHelp': 'AiSensy dashboard → Settings → API',
  },
  'wati': {
    'name': 'Wati',
    'fields': ['apiKey', 'accountEndpoint'],
    'tagline': 'Global · Easy BSP',
    'pricing': r'$49/mo starter',
    'apiKeyLabel': 'Wati API token',
    'apiKeyPlaceholder': 'Paste your Wati Bearer token',
    'apiKeyHelp': 'Wati dashboard → Manage → API, Docs and Webhooks',
    'endpointLabel': 'Wati account endpoint',
    'endpointPlaceholder': 'https://live-mt-server.wati.io/123456',
    'endpointHelp': 'Your account URL from Wati (shown in dashboard top-right)',
  },
  'interakt': {
    'name': 'Interakt',
    'fields': ['apiKey'],
    'tagline': 'By Jio Haptik · India BSP',
    'pricing': '₹999/mo starter',
    'apiKeyLabel': 'Interakt API key',
    'apiKeyPlaceholder': 'Paste your Interakt API key',
    'apiKeyHelp': 'Interakt dashboard → Settings → Developers → API Key',
  },
};

/// WhatsApp connection settings — one-click connect (Embedded Signup via
/// WebView) + manual advanced flow (pick provider, credentials, test/save,
/// diagnose). Mirrors frontend/src/components/WhatsAppSettings.jsx against
/// GET/PATCH /whatsapp/settings, POST /whatsapp/settings/test,
/// GET /whatsapp/settings/diagnose, POST /whatsapp/settings/webhook-check,
/// GET /api/public/whatsapp-es-config, POST /whatsapp/embedded-signup/exchange.
class WaSettingsPage extends StatefulWidget {
  const WaSettingsPage({super.key});

  @override
  State<WaSettingsPage> createState() => _WaSettingsPageState();
}

class _WaSettingsPageState extends State<WaSettingsPage> {
  final _api = ApiClient.instance;
  bool _loading = true;
  bool _connected = false;
  Map<String, dynamic>? _whatsapp;
  String? _orgId;
  bool _showChangeProvider = false;
  bool _showAdvanced = false;

  String _provider = 'meta';
  bool _hasKey = false;
  final _apiKeyCtrl = TextEditingController();
  bool _obscureKey = true;
  final _wabaIdCtrl = TextEditingController();
  final _phoneNumberIdCtrl = TextEditingController();
  final _webhookTokenCtrl = TextEditingController();
  final _endpointCtrl = TextEditingController();
  final _testPhoneCtrl = TextEditingController();
  bool _testing = false;
  bool _saving = false;

  Map<String, dynamic>? _webhook;
  bool _checkingWebhook = false;
  Map<String, dynamic>? _diagnosis;
  bool _diagnosing = false;

  Map<String, dynamic>? _esConfig;
  bool _esConnecting = false;
  String? _esError;

  @override
  void initState() {
    super.initState();
    _load();
    _loadEsConfig();
  }

  @override
  void dispose() {
    _apiKeyCtrl.dispose();
    _wabaIdCtrl.dispose();
    _phoneNumberIdCtrl.dispose();
    _webhookTokenCtrl.dispose();
    _endpointCtrl.dispose();
    _testPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/whatsapp/settings');
      if (!mounted) return;
      final data = (res.data as Map).cast<String, dynamic>();
      setState(() {
        _whatsapp = (data['whatsapp'] as Map?)?.cast<String, dynamic>();
        _connected = data['connected'] == true;
        _orgId = data['orgId'] as String?;
        _hasKey = _whatsapp?['hasApiKey'] == true;
        _provider = _whatsapp?['provider'] as String? ?? 'meta';
        _wabaIdCtrl.text = _whatsapp?['wabaId'] as String? ?? '';
        _phoneNumberIdCtrl.text = _whatsapp?['phoneNumberId'] as String? ?? '';
        _webhookTokenCtrl.text = _whatsapp?['webhookVerifyToken'] as String? ?? '';
        _endpointCtrl.text = _whatsapp?['accountEndpoint'] as String? ?? '';
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadEsConfig() async {
    try {
      final res = await _api.dio.get('/public/whatsapp-es-config');
      if (mounted) setState(() => _esConfig = (res.data as Map).cast<String, dynamic>());
    } catch (_) {}
  }

  Future<void> _connectWithMeta() async {
    final cfg = _esConfig;
    if (cfg == null || cfg['configured'] != true) return;
    setState(() {
      _esConnecting = true;
      _esError = null;
    });
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(
        builder: (_) => WaEmbeddedSignupScreen(appId: cfg['appId'] as String, configId: cfg['configId'] as String),
      ),
    );
    if (!mounted) return;
    setState(() => _esConnecting = false);
    if (result == null) return; // user backed out
    if (result['error'] != null) {
      setState(() => _esError = result['error'] as String);
      return;
    }
    try {
      final res = await _api.dio.post('/whatsapp/embedded-signup/exchange', data: {
        'code': result['code'],
        'wabaId': result['wabaId'],
        'phoneNumberId': result['phoneNumberId'],
      });
      final data = (res.data as Map).cast<String, dynamic>();
      if (mounted) {
        setState(() {
          _connected = data['connected'] == true;
          _showChangeProvider = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('WhatsApp connected')));
        _load();
      }
    } catch (e) {
      if (mounted) setState(() => _esError = ApiClient.errorMessage(e, 'Could not finish connecting'));
    }
  }

  Map<String, dynamic> _buildPatch() {
    final patch = <String, dynamic>{'provider': _provider};
    if (_apiKeyCtrl.text.trim().isNotEmpty) patch['apiKey'] = _apiKeyCtrl.text.trim();
    if (_endpointCtrl.text.trim().isNotEmpty) patch['accountEndpoint'] = _endpointCtrl.text.trim();
    if (_phoneNumberIdCtrl.text.trim().isNotEmpty) patch['phoneNumberId'] = _phoneNumberIdCtrl.text.trim();
    if (_webhookTokenCtrl.text.trim().isNotEmpty) patch['webhookVerifyToken'] = _webhookTokenCtrl.text.trim();
    if (_provider == 'meta') patch['wabaId'] = _wabaIdCtrl.text.trim();
    return patch;
  }

  Future<void> _connectAndTest() async {
    if (_apiKeyCtrl.text.trim().isEmpty && !_hasKey) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter your API key first')));
      return;
    }
    if (_testPhoneCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a test phone number')));
      return;
    }
    setState(() => _testing = true);
    try {
      await _api.dio.patch('/whatsapp/settings', data: _buildPatch());
      final res = await _api.dio.post('/whatsapp/settings/test', data: {
        'testPhone': _testPhoneCtrl.text.replaceAll(RegExp(r'\D'), ''),
      });
      final webhook = (res.data['webhook'] as Map?)?.cast<String, dynamic>();
      if (mounted) {
        if (webhook != null && webhook['applicable'] == true && webhook['subscribed'] != true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Test message sent — but incoming messages are not set up yet.'), duration: Duration(seconds: 8)),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('WhatsApp connected. Check your phone…')),
          );
        }
        _showChangeProvider = false;
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Connection failed. Check your credentials.')), backgroundColor: AppColors.danger, duration: const Duration(seconds: 8)),
        );
      }
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _saveWithoutTesting() async {
    setState(() => _saving = true);
    try {
      await _api.dio.patch('/whatsapp/settings', data: _buildPatch());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
        _showChangeProvider = false;
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not save')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _checkWebhook() async {
    setState(() => _checkingWebhook = true);
    try {
      final res = await _api.dio.post('/whatsapp/settings/webhook-check');
      if (mounted) setState(() => _webhook = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        setState(() => _webhook = {'subscribed': false, 'error': ApiClient.errorMessage(e)});
      }
    } finally {
      if (mounted) setState(() => _checkingWebhook = false);
    }
  }

  Future<void> _diagnose() async {
    setState(() => _diagnosing = true);
    try {
      final res = await _api.dio.get('/whatsapp/settings/diagnose');
      if (mounted) setState(() => _diagnosis = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _diagnosing = false);
    }
  }

  Future<void> _disconnect() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnect WhatsApp?'),
        content: const Text('Your conversation history will be kept.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Disconnect', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.patch('/whatsapp/settings', data: {'enabled': false});
      if (mounted) {
        setState(() => _connected = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Disconnected')));
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  String get _webhookUrl {
    final base = _api.dio.options.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return _orgId != null ? '$base/api/whatsapp/webhook/$_orgId' : '$base/api/whatsapp/webhook';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: AppSpinner());
    if (_connected && !_showChangeProvider) return _connectedView();
    return _connectFlow();
  }

  Widget _connectedView() {
    final displayName = _provider == 'meta' ? 'Arthaleads' : (_providers[_provider]?['name'] as String? ?? _provider);
    final quality = _whatsapp?['qualityRating'] as String?;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(displayName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                      child: const Text('Connected', style: TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                if (_whatsapp?['displayPhoneNumber'] != null) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.phone, size: 14, color: Colors.grey),
                    const SizedBox(width: 6),
                    Text(_whatsapp!['displayPhoneNumber'] as String, style: const TextStyle(fontSize: 13)),
                  ]),
                ],
                if (quality != null && quality.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Number quality: ${quality.toLowerCase()}',
                    style: TextStyle(fontSize: 12, color: quality == 'GREEN' ? AppColors.success : (quality == 'RED' ? AppColors.danger : AppColors.warning)),
                  ),
                ],
                if (_whatsapp?['displayPhoneNumber'] == null && (quality == null || quality.isEmpty)) ...[
                  const SizedBox(height: 6),
                  Text('Credentials saved and verified.', style: TextStyle(fontSize: 12.5, color: AppTheme.of(context).textSoft)),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _showChangeProvider = true),
                        child: const Text('Change provider'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _disconnect,
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                        child: const Text('Disconnect'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (_provider == 'meta') ...[
          const SizedBox(height: 12),
          _webhookHealthCard(),
        ],
        const WaOperationsSection(),
      ],
    );
  }

  Widget _webhookHealthCard() {
    final subscribed = _webhook?['subscribed'] == true;
    final checked = _webhook != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  !checked ? Icons.info_outline : (subscribed ? Icons.check_circle : Icons.warning_amber),
                  size: 16,
                  color: !checked ? Colors.grey : (subscribed ? AppColors.success : AppColors.warning),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    !checked
                        ? 'Incoming messages not checked yet'
                        : subscribed
                            ? 'Incoming messages are set up${_webhook?['appName'] != null ? ' (${_webhook!['appName']})' : ''}'
                            : (_webhook?['error'] as String? ?? 'Not subscribed yet'),
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            GradientButton(
              onPressed: _checkingWebhook ? null : _checkWebhook,
              loading: _checkingWebhook,
              child: Text(checked ? 'Check again' : 'Check incoming messages'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _connectFlow() {
    final prov = _providers[_provider]!;
    final fields = (prov['fields'] as List).cast<String>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_showChangeProvider)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppRadii.card)),
            child: Row(
              children: [
                const Expanded(child: Text('Changing provider', style: TextStyle(fontSize: 12))),
                TextButton(onPressed: () => setState(() => _showChangeProvider = false), child: const Text('Cancel')),
              ],
            ),
          )
        else
          const Text('WhatsApp not connected', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 16),

        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('One-click connect', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                if (_esConfig == null)
                  const AppSpinner(size: 18)
                else if (_esConfig!['configured'] != true)
                  const Text("One-click connect isn't turned on for this deployment yet.", style: TextStyle(fontSize: 12, color: Colors.grey))
                else ...[
                  if (_esError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_esError!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
                    ),
                  GradientButton(
                    fullWidth: true,
                    loading: _esConnecting,
                    icon: Icons.link,
                    onPressed: _connectWithMeta,
                    child: const Text('Connect WhatsApp'),
                  ),
                ],
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() => _showAdvanced = !_showAdvanced),
                  child: Text(_showAdvanced ? 'Hide advanced' : 'Advanced: connect a different way'),
                ),
              ],
            ),
          ),
        ),

        if (_showAdvanced) ...[
          const SizedBox(height: 16),
          const Text('1. Choose provider', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          ..._providers.entries.map((e) {
            final sel = _provider == e.key;
            final t = AppTheme.of(context);
            return InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () => setState(() => _provider = e.key),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: t.surfaceSolid,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: sel ? AppColors.primary : t.border, width: sel ? 1.6 : 1),
                ),
                child: Row(
                  children: [
                    Icon(sel ? Icons.radio_button_checked : Icons.radio_button_off,
                        size: 20, color: sel ? AppColors.primary : t.textSoft),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(e.value['name'] as String, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                              if (e.value['badge'] != null) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(color: AppColors.info.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                                  child: Text(e.value['badge'] as String, style: const TextStyle(fontSize: 10, color: AppColors.info, fontWeight: FontWeight.w600)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(e.value['tagline'] as String? ?? '', style: TextStyle(fontSize: 12, color: t.textSoft)),
                          Text(e.value['pricing'] as String? ?? '',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 8),
          const Text('2. Webhook URL', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(border: Border.all(color: AppTheme.of(context).border), borderRadius: BorderRadius.circular(AppRadii.card)),
            child: Row(
              children: [
                Expanded(child: Text(_webhookUrl, style: const TextStyle(fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis)),
                IconButton(
                  icon: const Icon(Icons.copy, size: 16),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _webhookUrl));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Webhook URL copied')));
                  },
                ),
              ],
            ),
          ),
          if (_provider == 'meta') ...[
            const SizedBox(height: 8),
            _webhookHealthCard(),
          ],
          const SizedBox(height: 16),
          const Text('3. Credentials', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          WaField(
            label: prov['apiKeyLabel'] as String,
            controller: _apiKeyCtrl,
            hint: _hasKey ? 'Saved — enter a new one to replace it' : (prov['apiKeyPlaceholder'] as String?),
            obscureText: _obscureKey,
            help: prov['apiKeyHelp'] as String?,
            mono: true,
            suffix: IconButton(
              icon: Icon(_obscureKey ? Icons.visibility : Icons.visibility_off, size: 18),
              onPressed: () => setState(() => _obscureKey = !_obscureKey),
            ),
          ),
          if (fields.contains('wabaId'))
            WaField(
              label: 'WhatsApp Business Account ID',
              controller: _wabaIdCtrl,
              keyboardType: TextInputType.number,
              mono: true,
              hint: 'e.g. 102290129340398',
              help: 'WhatsApp Manager → Account tools → the ID under your business name. Needed for templates and campaigns.',
            ),
          if (fields.contains('accountEndpoint'))
            WaField(
              label: prov['endpointLabel'] as String? ?? 'Account endpoint URL',
              controller: _endpointCtrl,
              hint: prov['endpointPlaceholder'] as String?,
              help: prov['endpointHelp'] as String?,
            ),
          if (fields.contains('phoneNumberId'))
            WaField(
              label: 'Phone number ID',
              controller: _phoneNumberIdCtrl,
              keyboardType: TextInputType.number,
              mono: true,
              hint: 'e.g. 123456789012345',
              help: 'WhatsApp Manager → Phone numbers → the ID beside your number (not the number itself).',
            ),
          if (fields.contains('webhookVerifyToken'))
            WaField(
              label: 'Webhook verify token',
              controller: _webhookTokenCtrl,
              hint: 'A secret string you choose (e.g. artha-webhook-2024)',
              help: 'Enter the same string in your WhatsApp dashboard when you add the webhook URL.',
            ),
          WaField(
            label: 'Your WhatsApp number (receives the test message)',
            controller: _testPhoneCtrl,
            keyboardType: TextInputType.phone,
            hint: 'e.g. 919876543210 (with country code, no +)',
          ),
          const SizedBox(height: 16),
          GradientButton(
            fullWidth: true,
            loading: _testing,
            onPressed: _connectAndTest,
            child: Text(_hasKey ? 'Reconnect & test' : 'Connect & test'),
          ),
          if (_hasKey) ...[
            const SizedBox(height: 8),
            SecondaryButton(onPressed: _saving ? null : _saveWithoutTesting, child: const Text('Save without testing')),
          ],
          if (_provider == 'meta' && _hasKey) ...[
            const SizedBox(height: 8),
            SecondaryButton(
              onPressed: _diagnosing ? null : _diagnose,
              child: _diagnosing
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Check credentials'),
            ),
            if (_diagnosis != null) ...[
              const SizedBox(height: 10),
              _diagRow('Token', _diagnosis!['token'] as Map?),
              _diagRow('Business Account', _diagnosis!['waba'] as Map?),
              _diagRow('Phone', _diagnosis!['phone'] as Map?),
              for (final w in ((_diagnosis!['warnings'] as List?)?.cast<String>() ?? []))
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('⚠ $w', style: const TextStyle(fontSize: 11, color: AppColors.warning)),
                ),
            ],
          ],
        ],
      ],
    );
  }

  Widget _diagRow(String label, Map? d) {
    if (d == null) return const SizedBox.shrink();
    final ok = d['ok'] == true;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ok ? Icons.check_circle : Icons.cancel, size: 14, color: ok ? AppColors.success : AppColors.danger),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '$label: ${ok ? (d['name'] ?? d['displayPhoneNumber'] ?? 'OK') : (d['message'] ?? 'Failed')}',
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
