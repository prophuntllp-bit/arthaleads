import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:flutter/services.dart';

import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import '../../widgets/app_select.dart';
import '../../widgets/buttons.dart';
import '../../widgets/labeled_field.dart';
import 'automation_form.dart';
import 'connection_card.dart';
import 'conversion_tracking_screen.dart';
import 'portals_screen.dart';
import 'routing_screen.dart';
import 'telephony_hub_screen.dart';
import 'websites_screen.dart';
import '../../widgets/glass.dart';
import '../../widgets/integration_kit.dart';
import 'vistrow_autocall_screen.dart';
import '../inbox/wa_settings_page.dart';

// Staging builds show staging's own addresses (29 Oct 2026: this was fixed
// to the live server, so the staging app's connect links went to production).
String get _serverBase => ApiClient.serverBase;

/// Automation — GET/POST/PATCH/DELETE /automations, plus Lead Routing Rules.
/// Includes generic sources, WordPress/Google/Vistrow token managers, routing
/// rules, Facebook token health, diagnostics and re-subscribe controls.
class AutomationScreen extends StatefulWidget {
  const AutomationScreen({super.key});

  @override
  State<AutomationScreen> createState() => _AutomationScreenState();
}

class _AutomationScreenState extends State<AutomationScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _automations = [];
  bool _loading = true;
  // WhatsApp Business (the real Inbox connection — Meta/AiSensy/Wati/Interakt
  // credentials, managed on WaSettingsPage) is a different thing from the
  // "WhatsApp" quick-connect card below, which is for routing leads in from a
  // 3rd-party bot's webhook. Only a live status badge is fetched here; the
  // actual connect/disconnect form is not duplicated on this screen.
  bool? _waConnected;
  // Status for the telephony, portal, routing and conversion cards (29 Oct
  // 2026, as the web's Integrations page). Each call may be refused by plan or
  // role; the card then just shows "Not set up yet".
  final Map<String, dynamic> _extra = {};
  String _group = 'All';

  void _loadExtra() {
    void put(String key, String path) => _api.dio.get(path).then((r) {
          if (mounted) setState(() => _extra[key] = r.data);
        }).catchError((_) {});
    put('telephony', '/plivo/settings');
    put('enablex', '/calls/settings');
    put('portals', '/portal-leads/settings');
    put('capi', '/meta-conversions');
    put('rules', '/routing-rules');
  }

  @override
  void initState() {
    super.initState();
    _load();
    _loadExtra();
    _api.dio.get('/whatsapp/status').then((r) {
      if (mounted) setState(() => _waConnected = r.data['connected'] == true);
    }).catchError((_) {
      if (mounted) setState(() => _waConnected = false);
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/automations');
      setState(() {
        _automations = (res.data['automations'] as List? ?? [])
            .cast<Map<String, dynamic>>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load automations'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static bool _isPaused(Map<String, dynamic> a) =>
      a['isActive'] == false || a['status'] == 'paused';

  // Pause or resume one connection. Paused means the webhook ignores new
  // leads from it (isActive false); nothing already received is touched.
  // Same call and wording as the web's pause button on the connection card.
  String? _togglingId;
  Future<void> _toggleActive(Map<String, dynamic> a) async {
    final resume = _isPaused(a);
    setState(() => _togglingId = a['_id'] as String?);
    try {
      final res = await _api.dio.patch(
        '/automations/${a['_id']}',
        data: {'isActive': resume, 'status': resume ? 'connected' : 'paused'},
      );
      setState(() {
        final idx = _automations.indexWhere((x) => x['_id'] == a['_id']);
        if (idx != -1) {
          final saved = (res.data['automation'] as Map?)?.cast<String, dynamic>();
          _automations[idx] = {
            ..._automations[idx],
            ...?saved,
            'isActive': resume,
            'status': saved?['status'] ?? (resume ? 'connected' : 'paused'),
          };
        }
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(resume
              ? 'Connection resumed'
              : 'Connection paused: new leads from it are ignored'),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Could not change this connection')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _togglingId = null);
    }
  }

  Future<void> _delete(Map<String, dynamic> a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove connection?'),
        content: Text('"${a['name']}" will stop receiving leads.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Remove',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/automations/${a['_id']}');
      setState(() => _automations.remove(a));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to remove')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _openForm({
    Map<String, dynamic>? automation,
    String? initialPlatform,
  }) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AutomationFormScreen(
          automation: automation,
          initialPlatform: initialPlatform,
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _refreshToken(Map<String, dynamic> a) async {
    try {
      final res = await _api.dio.post(
        '/automations/facebook/refresh-tokens',
        data: {'automationId': a['_id']},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] as String? ?? 'Refreshed'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Refresh failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  static const _wpBlue = Color(0xFF21759B);
  static const _voicePurple = Color(0xFF8B5CF6);
  static const _wpPlugins = [
    'Contact Form 7', 'WPForms', 'Elementor', 'Gravity Forms',
    'Ninja Forms', 'Forminator', 'Fluent Forms',
  ];

  Future<void> _openTokenManager(String kind) async {
    final website = kind == 'website';
    final google = kind == 'google';
    final voice = !website && !google;
    final accent = website ? _wpBlue : voice ? _voicePurple : AppColors.primary;
    final title = website
        ? 'WordPress / Website Forms'
        : google
        ? 'Google Ads Lead Forms'
        : 'Vistrow Voice';
    final path = website
        ? '/automations/website'
        : google
        ? '/automations/google'
        : '/automations/voice';
    final endpoint = website
        ? '$_serverBase/webhook/website'
        : google
        ? '$_serverBase/webhook/google'
        : '$_serverBase/webhook/lead';
    var loading = true;
    var adding = false;
    var requested = false;
    var showExtra = false;
    var connections = <Map<String, dynamic>>[];

    Future<void> fetchConnections(
      void Function(VoidCallback) setSheetState,
    ) async {
      try {
        final res = await _api.dio.get(
          google
              ? '$path/connections'
              : '$path/${website ? 'token' : 'connections'}',
        );
        connections = (res.data['connections'] as List? ?? [])
            .cast<Map<String, dynamic>>();
      } finally {
        setSheetState(() => loading = false);
      }
    }

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          if (loading && !requested) {
            requested = true;
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => fetchConnections(setSheetState),
            );
          }
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
              child: SizedBox(
                height: MediaQuery.of(ctx).size.height * .72,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(title, style: Theme.of(ctx).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(
                      website
                          ? 'Create a site token and paste it into the Arthaleads WordPress plugin.'
                          : google
                          ? 'Use the webhook URL and key in your Google Ads lead form asset.'
                          : 'Create a token and paste it into the Arthaleads integration in Vistrow Voice.',
                      style: Theme.of(ctx).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: loading
                          ? const Center(child: AppSpinner(size: 30))
                          : ListView(
                              children: [
                                if (connections.isEmpty)
                                  const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 16),
                                    child: Center(child: Text('No connections yet')),
                                  ),
                                for (var index = 0; index < connections.length; index++)
                                  Builder(builder: (_) {
                                    final connection = connections[index];
                                    final token = connection['token']?.toString() ?? '';
                                    final connected = connection['status']?.toString() == 'connected';
                                    final siteUrl = connection['siteUrl']?.toString();
                                    final lastSync = connection['lastSyncAt']?.toString();
                                    return Card(
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                        side: BorderSide(
                                          color: connected ? AppColors.success.withValues(alpha: 0.4) : Colors.transparent,
                                        ),
                                      ),
                                      clipBehavior: Clip.antiAlias,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            color: connected ? AppColors.success : null,
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                            child: Row(
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        connection['siteName']?.toString() ?? connection['name']?.toString() ?? 'Connection',
                                                        style: TextStyle(
                                                          fontWeight: FontWeight.w700,
                                                          color: connected ? Colors.white : null,
                                                        ),
                                                      ),
                                                      if (website && siteUrl != null && siteUrl.isNotEmpty)
                                                        Text(siteUrl,
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              color: connected ? Colors.white70 : AppTheme.of(ctx).textSoft,
                                                            )),
                                                      if (lastSync != null && lastSync.isNotEmpty)
                                                        Text('Last lead: ${DateTime.tryParse(lastSync)?.toLocal() ?? lastSync}',
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              color: connected ? Colors.white70 : AppTheme.of(ctx).textSoft,
                                                            )),
                                                    ],
                                                  ),
                                                ),
                                                if (!connected)
                                                  Text('draft',
                                                      style: TextStyle(fontSize: 11, color: accent, fontWeight: FontWeight.w700)),
                                                IconButton(
                                                  tooltip: 'Delete',
                                                  icon: Icon(Icons.delete_outline,
                                                      color: connected ? Colors.white : AppColors.danger, size: 20),
                                                  onPressed: () async {
                                                    await _api.dio.delete('/automations/${connection['id']}');
                                                    setSheetState(() => connections.removeAt(index));
                                                    _load();
                                                  },
                                                ),
                                              ],
                                            ),
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.all(12),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                SelectableText(token, style: const TextStyle(fontSize: 11)),
                                                const SizedBox(height: 6),
                                                Row(
                                                  children: [
                                                    TextButton.icon(
                                                      onPressed: () => Clipboard.setData(ClipboardData(text: token)),
                                                      icon: const Icon(Icons.copy, size: 15),
                                                      label: const Text('Copy token'),
                                                    ),
                                                    TextButton.icon(
                                                      onPressed: () => Clipboard.setData(ClipboardData(text: endpoint)),
                                                      icon: const Icon(Icons.link, size: 15),
                                                      label: const Text('Copy endpoint'),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                const SizedBox(height: 4),
                                OutlinedButton.icon(
                                  onPressed: adding
                                      ? null
                                      : () async {
                                          setSheetState(() => adding = true);
                                          try {
                                            final res = await _api.dio.post(
                                              '$path/create',
                                              data: {
                                                'name': website
                                                    ? 'WordPress Site ${connections.length + 1}'
                                                    : google
                                                    ? 'Google Ads ${connections.length + 1}'
                                                    : 'Vistrow Voice ${connections.length + 1}',
                                              },
                                            );
                                            final created = (res.data['connection'] as Map).cast<String, dynamic>();
                                            setSheetState(() => connections.add(created));
                                            _load();
                                          } finally {
                                            setSheetState(() => adding = false);
                                          }
                                        },
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    side: BorderSide(color: accent.withValues(alpha: 0.4)),
                                  ),
                                  icon: adding
                                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Icon(Icons.add),
                                  label: Text(
                                    adding
                                        ? 'Creating…'
                                        : connections.isEmpty
                                            ? (website ? 'Create Connection' : voice ? 'Add Voice Connection' : 'Create Connection')
                                            : 'Add Another Connection',
                                  ),
                                ),
                                if (website) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: AppTheme.of(ctx).border),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        InkWell(
                                          onTap: () => setSheetState(() => showExtra = !showExtra),
                                          child: Padding(
                                            padding: const EdgeInsets.all(14),
                                            child: Row(
                                              children: [
                                                const Expanded(
                                                  child: Text('SETUP STEPS',
                                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                                                ),
                                                Icon(showExtra ? Icons.expand_less : Icons.expand_more, size: 20),
                                              ],
                                            ),
                                          ),
                                        ),
                                        if (showExtra)
                                          for (final (i, step) in const [
                                            'In your WordPress admin → Plugins → Add New',
                                            'Search for "Arthaleads" and install the plugin',
                                            'Activate it, then click "Arthaleads CRM" in the left sidebar',
                                            "Copy your site's token above and paste it into the Account Token field",
                                            'Enter your website name, then click Save',
                                            'Leads will now flow into Arthaleads automatically',
                                          ].indexed)
                                            Padding(
                                              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                                              child: Row(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Container(
                                                    width: 20,
                                                    height: 20,
                                                    alignment: Alignment.center,
                                                    decoration: BoxDecoration(
                                                      color: accent.withValues(alpha: 0.15),
                                                      shape: BoxShape.circle,
                                                    ),
                                                    child: Text('${i + 1}',
                                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent)),
                                                  ),
                                                  const SizedBox(width: 10),
                                                  Expanded(child: Text(step, style: const TextStyle(fontSize: 12.5))),
                                                ],
                                              ),
                                            ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: [
                                      for (final p in _wpPlugins)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: Colors.cyan.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(color: Colors.cyan.withValues(alpha: 0.25)),
                                          ),
                                          child: Text('✓ $p',
                                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.cyan)),
                                        ),
                                    ],
                                  ),
                                ],
                                if (voice) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppTheme.of(ctx).surfaceLow,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('HOW TO CONNECT',
                                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                                        const SizedBox(height: 10),
                                        for (final (i, step) in const [
                                          'Tap "Add Voice Connection" to generate your token.',
                                          'Copy the token shown above.',
                                          'In Vistrow Voice, open the Arthaleads integration and paste it in.',
                                          "That's it — qualified calls flow straight into your leads.",
                                        ].indexed)
                                          Padding(
                                            padding: const EdgeInsets.only(bottom: 8),
                                            child: Row(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Container(
                                                  width: 20,
                                                  height: 20,
                                                  alignment: Alignment.center,
                                                  decoration: BoxDecoration(
                                                    color: accent.withValues(alpha: 0.15),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: Text('${i + 1}',
                                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent)),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(child: Text(step, style: const TextStyle(fontSize: 12.5))),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: AppTheme.of(ctx).border),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        InkWell(
                                          onTap: () => setSheetState(() => showExtra = !showExtra),
                                          child: Padding(
                                            padding: const EdgeInsets.all(14),
                                            child: Row(
                                              children: [
                                                const Expanded(
                                                  child: Text('DEVELOPER DETAILS (OPTIONAL)',
                                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                                                ),
                                                Icon(showExtra ? Icons.expand_less : Icons.expand_more, size: 20),
                                              ],
                                            ),
                                          ),
                                        ),
                                        if (showExtra)
                                          Padding(
                                            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "Only needed if you're wiring a custom sender by hand — the Vistrow Voice integration does this for you.",
                                                  style: TextStyle(fontSize: 11.5, color: AppTheme.of(ctx).textSoft),
                                                ),
                                                const SizedBox(height: 10),
                                                Text('Endpoint',
                                                    style: TextStyle(fontSize: 11, color: AppTheme.of(ctx).textSoft)),
                                                const SizedBox(height: 4),
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                        decoration: BoxDecoration(
                                                          color: AppTheme.of(ctx).surfaceLow,
                                                          borderRadius: BorderRadius.circular(10),
                                                        ),
                                                        child: Text(endpoint,
                                                            style: TextStyle(fontSize: 11, color: accent),
                                                            overflow: TextOverflow.ellipsis),
                                                      ),
                                                    ),
                                                    IconButton(
                                                      onPressed: () => Clipboard.setData(ClipboardData(text: endpoint)),
                                                      icon: const Icon(Icons.copy, size: 16),
                                                    ),
                                                  ],
                                                ),
                                                const SizedBox(height: 10),
                                                Container(
                                                  width: double.infinity,
                                                  padding: const EdgeInsets.all(10),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.of(ctx).surfaceLow,
                                                    borderRadius: BorderRadius.circular(10),
                                                  ),
                                                  child: Text(
                                                    'POST { "token", "name", "phone", "email", "message" }',
                                                    style: TextStyle(fontSize: 11, color: accent, fontFamily: 'monospace'),
                                                  ),
                                                ),
                                                const SizedBox(height: 8),
                                                Text.rich(
                                                  TextSpan(
                                                    style: TextStyle(fontSize: 11.5, color: AppTheme.of(ctx).textSoft),
                                                    children: [
                                                      TextSpan(
                                                          text: 'message',
                                                          style: TextStyle(color: accent, fontWeight: FontWeight.w700)),
                                                      const TextSpan(text: " becomes the lead's Requirements. Leads arrive as source "),
                                                      TextSpan(
                                                          text: 'Vistrow Voice',
                                                          style: TextStyle(color: accent, fontWeight: FontWeight.w700)),
                                                      const TextSpan(text: '.'),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _diagnoseFacebook(Map<String, dynamic> automation) async {
    try {
      final res = await _api.dio.post(
        '/automations/facebook/diagnose',
        data: {'automationId': automation['_id']},
      );
      final results = (res.data['results'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      final diag = results.isEmpty
          ? {'checks': [], 'message': res.data['message']}
          : results.first;
      if (!mounted) return;
      await _showFacebookDiagnosticDialog(automation, diag);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Diagnostics failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _showFacebookDiagnosticDialog(
    Map<String, dynamic> automation,
    Map<String, dynamic> diag,
  ) async {
    final checks = (diag['checks'] as List? ?? []).cast<Map<String, dynamic>>();
    final canResubscribe = diag['canResubscribe'] == true;
    var resubscribing = false;
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return AlertDialog(
            title: const Text('Facebook Diagnostics'),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (checks.isEmpty)
                    Text(
                      diag['message']?.toString() ?? 'No diagnostic results',
                    )
                  else
                    ...checks.map(
                      (check) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          check['ok'] == true
                              ? Icons.check_circle
                              : Icons.error_outline,
                          color: check['ok'] == true
                              ? AppColors.success
                              : AppColors.danger,
                        ),
                        title: Text(check['label']?.toString() ?? ''),
                        subtitle: Text(check['detail']?.toString() ?? ''),
                      ),
                    ),
                  if (canResubscribe) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: resubscribing
                            ? null
                            : () async {
                                setSheetState(() => resubscribing = true);
                                final ok = await _resubscribeFacebook(automation);
                                if (!ctx.mounted) return;
                                Navigator.pop(ctx);
                                // Re-check so the user sees it turn green, matching web.
                                if (ok) _diagnoseFacebook(automation);
                              },
                        icon: resubscribing
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.refresh, size: 18),
                        label: Text(
                          resubscribing
                              ? 'Re-subscribing…'
                              : 'Re-subscribe Page to leadgen webhook',
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<bool> _resubscribeFacebook(Map<String, dynamic> automation) async {
    try {
      await _api.dio.post(
        '/automations/facebook/resubscribe',
        data: {'automationId': automation['_id']},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Facebook Page re-subscribed successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      _load();
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Re-subscribe failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
      return false;
    }
  }

  Future<void> _syncGoogle(Map<String, dynamic> automation) async {
    try {
      final res = await _api.dio.post(
        '/automations/google/${automation['_id']}/sync',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              res.data['message']?.toString() ?? 'Google Ads sync complete',
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Sync failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<Map<String, dynamic>> _runOAuth(String provider) async {
    if (_api.token == null) throw Exception('Your session has expired');
    // A 60-second ticket goes in the link, never the login token: URLs end up
    // in server logs and the browser's history (24 Oct 2026).
    final ticketRes = await _api.dio.post('/automations/popup-ticket');
    final ticket = '${ticketRes.data['ticket'] ?? ''}';
    if (ticket.isEmpty) throw Exception('Could not start the connection');
    final callback = await FlutterWebAuth2.authenticate(
      url:
          '$_serverBase/api/automations/$provider/connect?mobile=1&token=${Uri.encodeQueryComponent(ticket)}',
      callbackUrlScheme: 'arthaleads',
    );
    final session = Uri.parse(callback).queryParameters['session'];
    if (session == null || session.isEmpty) {
      throw Exception('OAuth did not return a session');
    }
    final resultPath = provider == 'facebook' ? 'result' : 'oauth-result';
    final response = await _api.dio.get(
      '/automations/$provider/$resultPath',
      queryParameters: {'session': session},
    );
    return (response.data as Map).cast<String, dynamic>();
  }

  Future<void> _connectFacebookOAuth() async {
    try {
      final result = await _runOAuth('facebook');
      if (result['type'] != 'success') {
        throw Exception(
          result['message']?.toString() ?? 'Facebook connection failed',
        );
      }
      final pages = (result['pages'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      if (pages.isEmpty) {
        throw Exception(
          'No Facebook Pages found. Use a Business Manager System User Token instead.',
        );
      }
      await _chooseAndSaveFacebook(
        pages: pages,
        userToken: result['freshToken']?.toString() ?? '',
        isSystemToken: false,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(
                e,
                e.toString().replaceFirst('Exception: ', ''),
              ),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _chooseAndSaveFacebook({
    required List<Map<String, dynamic>> pages,
    required String userToken,
    required bool isSystemToken,
  }) async {
    if (!mounted) return;
    var pageId = pages.first['id']?.toString() ?? '';
    var forms = (pages.first['forms'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    var formId = forms.isEmpty ? '' : forms.first['id']?.toString() ?? '';
    final nameController = TextEditingController(
      text: '${pages.first['name'] ?? 'Facebook'} - Lead Ads',
    );
    final save = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              0,
              20,
              MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Color(0xFF1877F2),
                      child: FaIcon(
                        FontAwesomeIcons.facebookF,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Choose Page & Form',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                AppSelect<String>(
                  label: 'Facebook Page',
                  value: pageId,
                  options: {
                    for (final page in pages)
                      (page['id']?.toString() ?? ''): (page['name']?.toString() ?? 'Page'),
                  },
                  onChanged: (value) {
                    final selected = pages.firstWhere(
                      (page) => page['id']?.toString() == value,
                    );
                    setSheetState(() {
                      pageId = value ?? '';
                      forms = (selected['forms'] as List? ?? [])
                          .cast<Map<String, dynamic>>();
                      formId = forms.isEmpty
                          ? ''
                          : forms.first['id']?.toString() ?? '';
                      nameController.text =
                          '${selected['name'] ?? 'Facebook'} - Lead Ads';
                    });
                  },
                ),
                const SizedBox(height: 12),
                AppSelect<String?>(
                  label: 'Lead Form (optional)',
                  value: formId.isEmpty ? null : formId,
                  options: {
                    for (final form in forms)
                      (form['id']?.toString() ?? ''): (form['name']?.toString() ?? 'Form'),
                  },
                  onChanged: (value) =>
                      setSheetState(() => formId = value ?? ''),
                ),
                const SizedBox(height: 12),
                LabeledField(
                  label: 'Connection Name',
                  child: TextField(controller: nameController),
                ),
                const SizedBox(height: 18),
                GradientButton(
                  fullWidth: true,
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Connect Facebook'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (save != true) {
      nameController.dispose();
      return;
    }
    final page = pages.firstWhere((item) => item['id']?.toString() == pageId);
    await _api.dio.post(
      '/automations',
      data: {
        'name': nameController.text.trim(),
        'platform': 'Facebook',
        'mode': 'webhook',
        'status': 'connected',
        'leadSourceLabel': 'Facebook',
        'webhookPath': '/webhook',
        'pageId': pageId,
        'pageName': page['name']?.toString() ?? '',
        'formId': formId,
        'accessToken': page['accessToken']?.toString() ?? userToken,
        'userToken': userToken,
        'isSystemToken': isSystemToken,
        'verifyToken': 'arthaleads_${DateTime.now().millisecondsSinceEpoch}',
        'isActive': true,
      },
    );
    nameController.dispose();
    await _load();
  }

  Future<void> _connectGoogleOAuth() async {
    try {
      final result = await _runOAuth('google');
      if (result['type'] != 'success') {
        throw Exception(
          result['message']?.toString() ?? 'Google connection failed',
        );
      }
      final customers = (result['customers'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      if (customers.isEmpty) {
        throw Exception('No Google Ads accounts found for this login');
      }
      if (!mounted) return;
      var customerId = customers.first['id']?.toString() ?? '';
      final nameController = TextEditingController(
        text: customers.first['name']?.toString() == customerId
            ? 'Google Ads'
            : customers.first['name']?.toString() ?? 'Google Ads',
      );
      final save = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setSheetState) => SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                0,
                20,
                MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Choose Google Ads Account',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 16),
                  AppSelect<String>(
                    label: 'Google Ads Account',
                    value: customerId,
                    options: {
                      for (final customer in customers)
                        (customer['id']?.toString() ?? ''):
                            (customer['name']?.toString() ?? customer['id']?.toString() ?? 'Account'),
                    },
                    onChanged: (value) {
                      final selected = customers.firstWhere(
                        (item) => item['id']?.toString() == value,
                      );
                      setSheetState(() {
                        customerId = value ?? '';
                        nameController.text =
                            selected['name']?.toString() ?? 'Google Ads';
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  LabeledField(
                    label: 'Connection Name',
                    child: TextField(controller: nameController),
                  ),
                  const SizedBox(height: 18),
                  GradientButton(
                    fullWidth: true,
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Connect Google Ads'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      if (save != true) {
        nameController.dispose();
        return;
      }
      final customer = customers.firstWhere(
        (item) => item['id']?.toString() == customerId,
      );
      await _api.dio.post(
        '/automations/google/oauth-create',
        data: {
          'name': nameController.text.trim(),
          'customerId': customerId,
          'customerName': customer['name']?.toString() ?? customerId,
          'accessToken': result['accessToken'],
          'refreshToken': result['refreshToken'],
        },
      );
      nameController.dispose();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(
                e,
                e.toString().replaceFirst('Exception: ', ''),
              ),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _connectFacebookSystemToken() async {
    final tokenController = TextEditingController();
    final token = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Connect Facebook Lead Ads'),
        content: LabeledField(
          label: 'Meta System User Token',
          child: TextField(
            controller: tokenController,
            obscureText: true,
            maxLines: 1,
            decoration: const InputDecoration(
              helperText:
                  'Use a permanent token with page and leads permissions.',
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, tokenController.text.trim()),
            child: const Text('Verify Token'),
          ),
        ],
      ),
    );
    tokenController.dispose();
    if (token == null || token.isEmpty) return;

    try {
      final verify = await _api.dio.post(
        '/automations/facebook/verify-system-token',
        data: {'token': token},
      );
      final pages = (verify.data['pages'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      if (pages.isEmpty) {
        throw Exception('No Facebook Pages were found for this token');
      }
      if (!mounted) return;

      var pageId = pages.first['id']?.toString() ?? '';
      var forms = (pages.first['forms'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      var formId = forms.isEmpty ? '' : forms.first['id']?.toString() ?? '';
      final nameController = TextEditingController(
        text: '${pages.first['name'] ?? 'Facebook'} - Lead Ads',
      );
      final save = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setSheetState) => Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              0,
              16,
              MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Choose Page & Form',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
                const SizedBox(height: 14),
                AppSelect<String>(
                  label: 'Facebook Page',
                  value: pageId,
                  options: {
                    for (final page in pages)
                      (page['id']?.toString() ?? ''): (page['name']?.toString() ?? 'Page'),
                  },
                  onChanged: (value) {
                    final selected = pages.firstWhere(
                      (page) => page['id']?.toString() == value,
                    );
                    setSheetState(() {
                      pageId = value ?? '';
                      forms = (selected['forms'] as List? ?? [])
                          .cast<Map<String, dynamic>>();
                      formId = forms.isEmpty
                          ? ''
                          : forms.first['id']?.toString() ?? '';
                      nameController.text =
                          '${selected['name'] ?? 'Facebook'} - Lead Ads';
                    });
                  },
                ),
                const SizedBox(height: 12),
                AppSelect<String?>(
                  label: 'Lead Form (optional)',
                  value: formId.isEmpty ? null : formId,
                  options: {
                    for (final form in forms)
                      (form['id']?.toString() ?? ''): (form['name']?.toString() ?? 'Form'),
                  },
                  onChanged: (value) =>
                      setSheetState(() => formId = value ?? ''),
                ),
                const SizedBox(height: 12),
                LabeledField(
                  label: 'Connection Name',
                  child: TextField(controller: nameController),
                ),
                const SizedBox(height: 18),
                GradientButton(
                  fullWidth: true,
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Connect Facebook'),
                ),
              ],
            ),
          ),
        ),
      );
      if (save != true) {
        nameController.dispose();
        return;
      }
      final page = pages.firstWhere((item) => item['id']?.toString() == pageId);
      await _api.dio.post(
        '/automations',
        data: {
          'name': nameController.text.trim(),
          'platform': 'Facebook',
          'mode': 'webhook',
          'status': 'connected',
          'leadSourceLabel': 'Facebook',
          'webhookPath': '/webhook',
          'pageId': pageId,
          'pageName': page['name']?.toString() ?? '',
          'formId': formId,
          'accessToken': page['accessToken']?.toString() ?? token,
          'userToken': token,
          'isSystemToken': true,
          'verifyToken': 'arthaleads_${DateTime.now().millisecondsSinceEpoch}',
          'isActive': true,
        },
      );
      nameController.dispose();
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Facebook Lead Ads connected'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Facebook connection failed'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _openFacebookWizard() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Color(0xFF1877F2),
                    child: FaIcon(
                      FontAwesomeIcons.facebookF,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Facebook Lead Ads',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text('Connect your ad account in seconds'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: .06),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppColors.info.withValues(alpha: .18),
                  ),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'What happens when you continue:',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    SizedBox(height: 10),
                    Text('✓  A Facebook login window opens'),
                    SizedBox(height: 6),
                    Text('✓  You approve access to your pages'),
                    SizedBox(height: 6),
                    Text('✓  Your pages and lead forms load automatically'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1877F2),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _connectFacebookOAuth();
                },
                icon: const FaIcon(FontAwesomeIcons.facebookF, size: 18),
                label: const Text('Continue with Facebook'),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _connectFacebookSystemToken();
                },
                icon: const Icon(Icons.verified_user_outlined, size: 18),
                label: const Text(
                  'Using Business Manager? Paste a System User Token',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openGoogleWizard() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Color(0xFFFEE2E2),
                    child: FaIcon(
                      FontAwesomeIcons.google,
                      color: Color(0xFFEF4444),
                      size: 21,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Google Ads',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Sign in with Google — or connect manually via webhook',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _connectGoogleOAuth();
                },
                icon: const FaIcon(FontAwesomeIcons.google, size: 18),
                label: const Text('Sign in with Google'),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _openTokenManager('google');
                },
                icon: const Icon(Icons.webhook_outlined),
                label: const Text('Or connect manually via webhook'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Google Ads, Vistrow Voice and the Custom webhook / API are Enterprise.
  bool get _enterpriseOk {
    final a = context.read<AuthState>();
    return a.role == 'super_admin' || canAccess(a.org, 'enterprise');
  }

  Widget _connectionCard(Map<String, dynamic> a) {
    final platform = a['platform']?.toString() ?? 'Custom';
    final path = (a['webhookPath'] as String?)?.isNotEmpty == true
        ? a['webhookPath'] as String
        : platform == 'Website Form'
            ? '/webhook/website'
            : platform == 'Google'
                ? '/webhook/google'
                : '/webhook/lead';
    return ConnectionCard(
      key: ValueKey(a['_id']),
      item: a,
      serverBase: _serverBase,
      endpointPath: path,
      onCopy: (_) => ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Copied'), duration: Duration(seconds: 1)),
      ),
      onEdit: () => _openForm(automation: a),
      onDelete: () => _delete(a),
      onToggleActive: () => _toggleActive(a),
      toggling: _togglingId == a['_id'],
      onDiagnose: platform == 'Facebook' ? () => _diagnoseFacebook(a) : null,
      onSync: platform == 'Google' && a['mode'] == 'oauth' ? () => _syncGoogle(a) : null,
      onRefreshToken: platform == 'Facebook' ? () => _refreshToken(a) : null,
      formNamesEditor: platform == 'Facebook'
          ? _FormLabelsEditor(
              automation: a,
              onUpdated: (labels) => setState(() {
                final idx = _automations.indexWhere((x) => x['_id'] == a['_id']);
                if (idx != -1) {
                  _automations[idx] = {..._automations[idx], 'formLabels': labels};
                }
              }),
            )
          : null,
    );
  }

  void _push(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    if (!mounted) return;
    _load();
    _loadExtra();
  }

  void _locked(String plan) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text('This is part of the $plan plan.')));

  List<Map<String, dynamic>> _byPlatform(String p) => _automations.where((a) => a['platform'] == p).toList();
  int _liveOf(String p) => _byPlatform(p).where((a) => a['status'] == 'connected' && a['isActive'] != false).length;
  String _footerFor(String p, String noun) {
    final list = _byPlatform(p);
    if (list.isEmpty) return 'Not set up yet';
    final lasts = [for (final a in list) if (a['lastSyncAt'] != null) '${a['lastSyncAt']}']..sort();
    return '${list.length} $noun${list.length == 1 ? '' : 's'}${lasts.isEmpty ? '' : ' · last lead ${agoText(lasts.last)}'}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: AppSpinner(size: 32));
    final auth = context.read<AuthState>();
    final growthOk = planAllows(auth, 'growth');
    final isAdmin = const ['admin', 'super_admin'].contains(auth.role);

    final tel = (_extra['telephony'] as Map?) ?? const {};
    final telProvider = tel['provider'] as String?;
    final plivo = (tel['plivo'] as Map?) ?? const {};
    final telReady = telProvider == 'none'
        ? false
        : telProvider == 'plivo'
            ? plivo['hasAuthToken'] == true && '${plivo['number'] ?? ''}'.isNotEmpty
            : (_extra['enablex'] as Map?)?['connected'] == true;
    final portals = [for (final p in ((_extra['portals'] as Map?)?['portals'] as List?) ?? const []) if (p is Map && p['lastLeadAt'] != null) p];
    final portalsLast = ([for (final p in portals) '${p['lastLeadAt']}']..sort()).lastOrNull;
    final housingOn = (((_extra['portals'] as Map?)?['housing'] as Map?)?['enabled']) == true;
    final rules = _extra['rules'] is Map ? ((_extra['rules'] as Map)['rules'] as List? ?? const []) : (_extra['rules'] as List? ?? const []);
    final rulesActive = rules.where((r) => r is Map && r['isActive'] != false).length;
    final capi = _extra['capi'] as Map?;

    final sections = <_Section>[
      _Section('Lead sources', 'Where your leads come from. Each one drops new leads straight into Leads.', [
        _Card(
          logo: _tile(const FaIcon(FontAwesomeIcons.facebookF, color: Colors.white, size: 20), const Color(0xFF1877F2)),
          name: 'Facebook Lead Ads',
          category: 'Facebook & Instagram',
          description: 'Every Instant Form lead from your Facebook and Instagram ads, in one click. No technical setup.',
          on: _liveOf('Facebook') > 0,
          footer: _footerFor('Facebook', 'page'),
          onOpen: _openFacebookWizard,
        ),
        _Card(
          logo: _tile(const FaIcon(FontAwesomeIcons.whatsapp, color: AppColors.whatsapp, size: 22), AppColors.whatsapp.withValues(alpha: 0.12)),
          name: 'WhatsApp Business',
          category: 'Messaging',
          description: 'Your own number for WhatsApp chats, templates, campaigns and the AI agent. Chats become leads.',
          on: _waConnected == true,
          footer: _waConnected == true ? 'Number connected' : 'Not set up yet',
          onOpen: () => _push(Scaffold(appBar: AppBar(title: const Text('WhatsApp Business')), body: const WaSettingsPage())),
        ),
        _Card(
          logo: _tile(const FaIcon(FontAwesomeIcons.wordpress, color: Colors.white, size: 21), const Color(0xFF21759B)),
          name: 'Website forms',
          category: 'Lead sources',
          description: 'Capture enquiries from WordPress contact forms with our plugin, or any site form.',
          on: _liveOf('Website Form') > 0,
          footer: _footerFor('Website Form', 'site'),
          onOpen: () => _push(const WebsitesScreen()),
        ),
        _Card(
          logo: const BrandLogo('99acres', size: 44),
          name: 'Property portals',
          category: '99acres · Housing.com · MagicBricks',
          description: 'Portal enquiries arrive in Leads by themselves, tagged with the portal and project.',
          on: portals.isNotEmpty || housingOn,
          footer: portals.isNotEmpty ? '${portals.length} of 3 sending · last ${agoText(portalsLast)}' : 'Not set up yet',
          lock: growthOk ? null : 'Growth',
          onOpen: () => growthOk ? _push(const PortalsScreen()) : _locked('Growth'),
        ),
        _Card(
          logo: _tile(const FaIcon(FontAwesomeIcons.google, color: Color(0xFFEF4444), size: 20), Colors.white),
          name: 'Google Ads lead forms',
          category: 'Lead sources',
          description: 'Leads from Google Ads lead form assets, sent in as they are submitted.',
          on: _liveOf('Google') > 0,
          footer: _footerFor('Google', 'connection'),
          lock: _enterpriseOk ? null : 'Enterprise',
          onOpen: () => _enterpriseOk ? _openGoogleWizard() : _locked('Enterprise'),
        ),
        _Card(
          logo: _tile(const Icon(Icons.link_rounded, color: AppColors.primary), AppColors.primary.withValues(alpha: 0.10)),
          name: 'Custom / API',
          category: 'Developer',
          description: 'Any partner, broker or vendor that can post a lead to a link: send it straight into your CRM.',
          on: _liveOf('Custom') > 0,
          footer: _footerFor('Custom', 'connection'),
          lock: _enterpriseOk ? null : 'Enterprise',
          onOpen: () => _enterpriseOk ? _openForm(initialPlatform: 'Custom') : _locked('Enterprise'),
        ),
      ]),
      _Section('Calling', 'Click-to-call, recordings, AI call summaries and AI calling.', [
        _Card(
          logo: telProvider == 'plivo' || telProvider == 'enablex'
              ? BrandLogo(telProvider!, size: 44)
              : _tile(const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary), AppColors.primary.withValues(alpha: 0.10)),
          name: 'Telephony',
          category: 'Calling',
          description: 'Call leads from the CRM and the app; every call is logged, recorded and summarised.',
          on: telReady,
          footer: telProvider == 'none'
              ? 'Calling switched off'
              : telProvider != null
                  ? 'Calls through ${telProvider == 'plivo' ? 'Plivo' : 'EnableX'}'
                  : 'Not set up yet',
          onOpen: () => _push(const TelephonyHubScreen()),
        ),
        _Card(
          logo: _tile(const Icon(Icons.mic_none_rounded, color: Color(0xFF8B5CF6)), const Color(0xFF8B5CF6).withValues(alpha: 0.10)),
          name: 'Vistrow Voice',
          category: 'AI calling',
          description: 'AI calls your new leads in seconds and sends back qualified leads with the full transcript.',
          on: _liveOf('Vistrow Voice') > 0,
          footer: _liveOf('Vistrow Voice') > 0 ? 'Connected' : 'Not set up yet',
          lock: _enterpriseOk ? null : 'Enterprise',
          onOpen: () => _enterpriseOk ? _openTokenManager('voice') : _locked('Enterprise'),
        ),
        // Which new leads Vistrow's AI agents phone (admins; the server
        // allows only them).
        if (isAdmin)
          _Card(
            logo: _tile(const Icon(Icons.phone_forwarded_rounded, color: Color(0xFF8B5CF6)), const Color(0xFF8B5CF6).withValues(alpha: 0.10)),
            name: 'Vistrow auto-call',
            category: 'AI calling',
            description: 'Let Vistrow AI agents call new leads within moments of arriving.',
            on: null,
            footer: 'Sources, hours and agents',
            lock: _enterpriseOk ? null : 'Enterprise',
            onOpen: () => _enterpriseOk ? _push(const VistrowAutoCallScreen()) : _locked('Enterprise'),
          ),
      ]),
      _Section('Ads and routing', 'Send leads to the right person, and tell Meta which leads turn into buyers.', [
        _Card(
          logo: _tile(const Icon(Icons.alt_route_rounded, color: AppColors.primary), AppColors.primary.withValues(alpha: 0.10)),
          name: 'Lead routing rules',
          category: 'Routing',
          description: 'Leads from a chosen campaign, WhatsApp ad or website page go straight to a team member or project.',
          on: rulesActive > 0,
          status: rulesActive > 0 ? '$rulesActive active' : 'No rules',
          footer: rulesActive > 0 ? 'Everything else follows the rotation' : 'Not set up yet',
          lock: growthOk ? null : 'Growth',
          onOpen: () => growthOk ? _push(const RoutingScreen()) : _locked('Growth'),
        ),
        _Card(
          logo: const BrandLogo('meta', size: 44),
          name: 'Meta conversion tracking',
          category: 'Ads',
          description: 'Tells Meta which ad leads become serious buyers, so your ads find more people like them.',
          on: capi?['enabled'] == true,
          status: capi?['enabled'] == true ? 'On' : 'Off',
          footer: capi != null ? '${(capi['stats'] as Map?)?['sent'] ?? 0} events sent' : 'Not set up yet',
          lock: growthOk ? null : 'Growth',
          onOpen: () => growthOk ? _push(const ConversionTrackingScreen()) : _locked('Growth'),
        ),
      ]),
    ];
    final all = [for (final sec in sections) ...sec.cards];
    final live = all.where((c) => c.lock == null && c.on == true).length;
    final t = AppTheme.of(context);
    final tabs = ['All', for (final sec in sections) sec.title, if (_automations.isNotEmpty) 'Your connections'];
    if (!tabs.contains(_group)) _group = 'All';

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        _loadExtra();
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('Integrations', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: t.text)),
          const SizedBox(height: 4),
          Text('Connect where your leads come from, how you call them, and how your ads learn from them.',
              style: TextStyle(fontSize: 12.5, color: t.textSoft)),
          const SizedBox(height: 14),
          MiniStatGrid([
            MiniStat('Connected', '$live'),
            MiniStat('Available', '${all.length}'),
            MiniStat('Your connections', '${_automations.length}'),
          ]),
          const SizedBox(height: 14),
          ChipTabs(tabs: tabs, value: _group, onChanged: (v) => setState(() => _group = v)),
          const SizedBox(height: 12),
          for (final sec in sections)
            if (_group == 'All' || _group == sec.title) ...[
              Text(sec.title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: t.text)),
              const SizedBox(height: 2),
              Text(sec.note, style: TextStyle(fontSize: 12, color: t.textSoft)),
              const SizedBox(height: 10),
              for (final c in sec.cards) ...[_integrationCard(c), const SizedBox(height: 10)],
              const SizedBox(height: 8),
            ],
          if ((_group == 'All' || _group == 'Your connections') && _automations.isNotEmpty) ...[
            Text('Your connections (${_automations.length})',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: t.text)),
            const SizedBox(height: 8),
            for (final g in groupConnections(_automations)) ...[
              ConnectionGroupHeader(g),
              ...g.rows.map(_connectionCard),
              const SizedBox(height: 8),
            ],
          ],
        ],
      ),
    );
  }

  Widget _tile(Widget child, Color bg) => Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: AppTheme.of(context).border),
        ),
        child: child,
      );

  Widget _integrationCard(_Card c) {
    final t = AppTheme.of(context);
    final locked = c.lock != null;
    return InkWell(
      onTap: c.onOpen,
      borderRadius: BorderRadius.circular(18),
      child: SoftSurface(
        radius: 18,
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            c.logo,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
                Text(c.category, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
              ]),
            ),
            if (locked)
              StatusPill(c.lock!, color: AppColors.primary)
            else if (c.on != null)
              c.on! ? StatusPill.on(c.status ?? 'Connected') : StatusPill.off(c.status ?? 'Not connected'),
          ]),
          const SizedBox(height: 8),
          Text(c.description, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: Text(locked ? 'Part of the ${c.lock} plan' : c.footer,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.text)),
            ),
            Text(locked ? 'See plans' : (c.on == true ? 'Manage' : 'Set up'),
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
            const Icon(Icons.chevron_right_rounded, color: AppColors.primary, size: 18),
          ]),
        ]),
      ),
    );
  }
}

class _Section {
  final String title;
  final String note;
  final List<_Card> cards;
  const _Section(this.title, this.note, this.cards);
}

class _Card {
  final Widget logo;
  final String name;
  final String category;
  final String description;

  /// Connected or not; null for a card with no status (a settings screen).
  final bool? on;
  final String? status;
  final String footer;

  /// The plan that unlocks it, when the company's plan doesn't.
  final String? lock;
  final VoidCallback onOpen;
  const _Card({
    required this.logo,
    required this.name,
    required this.category,
    required this.description,
    required this.on,
    this.status,
    required this.footer,
    this.lock,
    required this.onOpen,
  });
}

/// Facebook's Graph API can't tell us a Lead Form's own name with the
/// permissions this app has — reading a submitted lead's answers needs a
/// different, narrower scope than reading the form object itself. So instead
/// of waiting on a Meta App Review for a broader permission, admins map each
/// form_id to a friendly name here once; the webhook uses it directly.
/// Mirrors `FormLabelsEditor` in frontend/src/pages/Automation.jsx.
class _FormLabelsEditor extends StatefulWidget {
  final Map<String, dynamic> automation;
  final ValueChanged<List<Map<String, dynamic>>> onUpdated;

  const _FormLabelsEditor({required this.automation, required this.onUpdated});

  @override
  State<_FormLabelsEditor> createState() => _FormLabelsEditorState();
}

class _FormLabelsEditorState extends State<_FormLabelsEditor> {
  final _api = ApiClient.instance;
  final _formIdCtrl = TextEditingController();
  final _labelCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _formIdCtrl.dispose();
    _labelCtrl.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final formId = _formIdCtrl.text.trim();
    final label = _labelCtrl.text.trim();
    if (formId.isEmpty || label.isEmpty) return;
    setState(() => _saving = true);
    try {
      final res = await _api.dio.post(
        '/automations/facebook/${widget.automation['_id']}/form-labels',
        data: {'formId': formId, 'label': label},
      );
      widget.onUpdated(
        (res.data['formLabels'] as List? ?? []).cast<Map<String, dynamic>>(),
      );
      _formIdCtrl.clear();
      _labelCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Form name saved'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to save form name'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(String formId) async {
    try {
      final res = await _api.dio.delete(
        '/automations/facebook/${widget.automation['_id']}/form-labels/${Uri.encodeComponent(formId)}',
      );
      widget.onUpdated(
        (res.data['formLabels'] as List? ?? []).cast<Map<String, dynamic>>(),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to remove form name'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = AppTheme.of(context);
    final labels = (widget.automation['formLabels'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.surfaceLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Form Names',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: theme.text,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            "Facebook can't auto-detect a lead form's name for us. Paste each "
            "form's ID (visible in Meta's Lead Ads tools, next to the form) "
            "and a label so agents know which campaign a lead came from.",
            style: TextStyle(fontSize: 10, color: theme.textSoft, height: 1.3),
          ),
          if (labels.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...labels.map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: theme.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: RichText(
                          overflow: TextOverflow.ellipsis,
                          text: TextSpan(
                            style: TextStyle(fontSize: 11, color: theme.text),
                            children: [
                              TextSpan(
                                text: f['label']?.toString() ?? '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              TextSpan(text: ' · ${f['formId']}'),
                            ],
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () => _remove(f['formId'].toString()),
                        child: Icon(
                          Icons.delete_outline,
                          size: 15,
                          color: theme.textSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: TextField(
                  controller: _formIdCtrl,
                  style: const TextStyle(fontSize: 12),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Form ID',
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 8,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: TextField(
                  controller: _labelCtrl,
                  style: const TextStyle(fontSize: 12),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Name (e.g. Mahalunge NX)',
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 8,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                height: 34,
                width: 34,
                child: IconButton(
                  padding: EdgeInsets.zero,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: _saving ? null : _add,
                  icon: _saving
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.add, size: 16),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
