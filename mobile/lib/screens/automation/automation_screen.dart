import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import '../../widgets/buttons.dart';
import 'automation_form.dart';
import 'routing_rules_screen.dart';

const _serverBase = 'https://api.arthaleads.com';

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
  List<Map<String, dynamic>> _routingRules = [];
  bool _loading = true;

  static final _platformIcons = {
    'Facebook': FontAwesomeIcons.facebookF.data,
    'Google': FontAwesomeIcons.google.data,
    'WhatsApp': FontAwesomeIcons.whatsapp.data,
    'Website Form': FontAwesomeIcons.globe.data,
    'Custom': FontAwesomeIcons.bolt.data,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.dio.get('/automations'),
        _api.dio.get('/routing-rules'),
      ]);
      final routingPayload = results[1].data as Map;
      setState(() {
        _automations = (results[0].data['automations'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        _routingRules =
            (routingPayload['rules'] as List? ??
                    routingPayload['data'] as List? ??
                    [])
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

  Future<void> _toggleActive(Map<String, dynamic> a) async {
    try {
      final res = await _api.dio.patch(
        '/automations/${a['_id']}',
        data: {'isActive': !(a['isActive'] == true)},
      );
      setState(() {
        final idx = _automations.indexWhere((x) => x['_id'] == a['_id']);
        if (idx != -1)
          _automations[idx] = (res.data['automation'] as Map)
              .cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to update')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
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
    final token = _api.token;
    if (token == null) throw Exception('Your session has expired');
    final callback = await FlutterWebAuth2.authenticate(
      url:
          '$_serverBase/api/automations/$provider/connect?mobile=1&token=${Uri.encodeQueryComponent(token)}',
      callbackUrlScheme: 'arthaleads',
    );
    final session = Uri.parse(callback).queryParameters['session'];
    if (session == null || session.isEmpty)
      throw Exception('OAuth did not return a session');
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
                DropdownButtonFormField<String>(
                  initialValue: pageId,
                  decoration: const InputDecoration(labelText: 'Facebook Page'),
                  items: pages
                      .map(
                        (page) => DropdownMenuItem(
                          value: page['id']?.toString(),
                          child: Text(page['name']?.toString() ?? 'Page'),
                        ),
                      )
                      .toList(),
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
                DropdownButtonFormField<String>(
                  key: ValueKey('$pageId-$formId'),
                  initialValue: formId.isEmpty ? null : formId,
                  decoration: const InputDecoration(
                    labelText: 'Lead Form (optional)',
                  ),
                  items: forms
                      .map(
                        (form) => DropdownMenuItem(
                          value: form['id']?.toString(),
                          child: Text(form['name']?.toString() ?? 'Form'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => formId = value ?? ''),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Connection Name',
                  ),
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
      if (customers.isEmpty)
        throw Exception('No Google Ads accounts found for this login');
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
                  DropdownButtonFormField<String>(
                    initialValue: customerId,
                    decoration: const InputDecoration(
                      labelText: 'Google Ads Account',
                    ),
                    items: customers
                        .map(
                          (customer) => DropdownMenuItem(
                            value: customer['id']?.toString(),
                            child: Text(
                              customer['name']?.toString() ??
                                  customer['id']?.toString() ??
                                  'Account',
                            ),
                          ),
                        )
                        .toList(),
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
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Connection Name',
                    ),
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
        content: TextField(
          controller: tokenController,
          obscureText: true,
          maxLines: 1,
          decoration: const InputDecoration(
            labelText: 'Meta System User Token',
            helperText:
                'Use a permanent token with page and leads permissions.',
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
      if (pages.isEmpty)
        throw Exception('No Facebook Pages were found for this token');
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
                DropdownButtonFormField<String>(
                  initialValue: pageId,
                  decoration: const InputDecoration(labelText: 'Facebook Page'),
                  items: pages
                      .map(
                        (page) => DropdownMenuItem(
                          value: page['id']?.toString(),
                          child: Text(page['name']?.toString() ?? 'Page'),
                        ),
                      )
                      .toList(),
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
                DropdownButtonFormField<String>(
                  key: ValueKey('$pageId-$formId'),
                  initialValue: formId.isEmpty ? null : formId,
                  decoration: const InputDecoration(
                    labelText: 'Lead Form (optional)',
                  ),
                  items: forms
                      .map(
                        (form) => DropdownMenuItem(
                          value: form['id']?.toString(),
                          child: Text(form['name']?.toString() ?? 'Form'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => formId = value ?? ''),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Connection Name',
                  ),
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

  Widget? _tokenHealthBadge(Map<String, dynamic> a) {
    final expiresAt = DateTime.tryParse(
      a['userTokenExpiresAt'] as String? ?? '',
    );
    if (expiresAt == null) return null;
    final daysLeft = expiresAt.difference(DateTime.now()).inDays;
    final expired = daysLeft < 0;
    final warn = daysLeft <= 7;
    if (!expired && !warn) return null;
    final color = expired ? AppColors.danger : AppColors.warning;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, size: 14, color: color),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              expired
                  ? 'Facebook token expired'
                  : 'Token expires in $daysLeft day(s)',
              style: TextStyle(
                fontSize: 11,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () => _refreshToken(a),
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 0),
            ),
            child: const Text('Refresh', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
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

  Widget _statCard(String label, int value, String subtitle, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.of(context).surfaceSolid,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
              color: AppTheme.of(context).textSoft,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$value',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 12,
              color: AppTheme.of(context).textSoft,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sourceCard({
    required Widget icon,
    required String title,
    required String description,
    required VoidCallback onTap,
    String? badge,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.of(context).surfaceSolid,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppTheme.of(context).border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: icon,
                ),
                const Spacer(),
                if (badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: .1),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        fontSize: 9,
                        color: AppColors.info,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const Spacer(),
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.of(context).textSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _connectionCard(Map<String, dynamic> a) {
    final active = a['isActive'] != false;
    final platform = a['platform']?.toString() ?? 'Custom';
    final endpoint = platform == 'Facebook'
        ? null
        : '$_serverBase${a['webhookPath'] ?? '/api/leads'}';
    final icon = _platformIcons[platform] ?? FontAwesomeIcons.bolt.data;
    final tokenBadge = platform == 'Facebook' ? _tokenHealthBadge(a) : null;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: .1),
                  child: Icon(icon, color: AppColors.primary, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a['name']?.toString() ?? 'Connection',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        platform,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.of(context).textSoft,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch.adaptive(
                  value: active,
                  onChanged: (_) => _toggleActive(a),
                ),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'edit') _openForm(automation: a);
                    if (value == 'diagnose') _diagnoseFacebook(a);
                    if (value == 'sync') _syncGoogle(a);
                    if (value == 'delete') _delete(a);
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (platform == 'Facebook')
                      const PopupMenuItem(
                        value: 'diagnose',
                        child: Text('Diagnose'),
                      ),
                    if (platform == 'Google' && a['mode'] == 'oauth')
                      const PopupMenuItem(
                        value: 'sync',
                        child: Text('Sync Now'),
                      ),
                    const PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
            if (platform == 'Facebook') ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Page: ${a['pageName'] ?? a['pageId'] ?? 'All pages'}',
                      style: const TextStyle(fontSize: 11),
                    ),
                  ),
                  Text(
                    'Form: ${a['formId'] ?? 'All forms'}',
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
              if (tokenBadge != null) tokenBadge,
            ] else if (endpoint != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      endpoint,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () =>
                        Clipboard.setData(ClipboardData(text: endpoint)),
                    icon: const Icon(Icons.copy, size: 16),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: AppSpinner(size: 32));
    final connected = _automations
        .where(
          (item) => item['isActive'] != false && item['status'] == 'connected',
        )
        .length;
    final facebook = _automations
        .where((item) => item['platform'] == 'Facebook')
        .length;
    final other = _automations.length - facebook;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.of(context).surfaceSolid,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: AppTheme.of(context).border),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: .08),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LEAD SOURCES',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: AppTheme.of(context).textSoft,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Connect Your Accounts',
                  style: TextStyle(
                    fontSize: 29,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Connect Facebook Lead Ads, Google, WhatsApp, and more. Leads flow directly into your CRM automatically.',
                  style: TextStyle(
                    height: 1.4,
                    color: AppTheme.of(context).textSoft,
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: _openFacebookWizard,
                  icon: const FaIcon(FontAwesomeIcons.facebookF, size: 17),
                  label: const Text('Connect Facebook'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => _openForm(initialPlatform: 'Custom'),
                  icon: const Icon(Icons.add),
                  label: const Text('Other Source'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.15,
            children: [
              _statCard(
                'Connected',
                connected,
                'Live channels',
                AppColors.success,
              ),
              _statCard(
                'Total Sources',
                _automations.length,
                'All connections',
                Theme.of(context).colorScheme.onSurface,
              ),
              _statCard('Facebook', facebook, 'Meta Lead Ads', AppColors.info),
              _statCard(
                'Other',
                other,
                'Google · WhatsApp · Web',
                Theme.of(context).colorScheme.onSurface,
              ),
            ],
          ),
          const SizedBox(height: 22),
          const Text(
            'Quick connect',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: .83,
            children: [
              _sourceCard(
                icon: const FaIcon(
                  FontAwesomeIcons.facebookF,
                  color: Color(0xFF1877F2),
                  size: 24,
                ),
                title: 'Facebook',
                description: 'Lead Ads · One click',
                badge: 'Popular',
                onTap: _openFacebookWizard,
              ),
              _sourceCard(
                icon: const FaIcon(
                  FontAwesomeIcons.google,
                  color: Color(0xFFEF4444),
                  size: 23,
                ),
                title: 'Google',
                description:
                    'Google Ads Lead Form — sign in or use a webhook URL and key',
                onTap: _openGoogleWizard,
              ),
              _sourceCard(
                icon: const FaIcon(
                  FontAwesomeIcons.whatsapp,
                  color: AppColors.whatsapp,
                  size: 25,
                ),
                title: 'WhatsApp',
                description:
                    'Route WhatsApp enquiries from a bot or form into the CRM',
                onTap: () => _openForm(initialPlatform: 'WhatsApp'),
              ),
              _sourceCard(
                icon: const FaIcon(
                  FontAwesomeIcons.wordpress,
                  color: Color(0xFF21759B),
                  size: 25,
                ),
                title: 'WordPress / Website Forms',
                description:
                    'Auto-capture leads from any WordPress contact form',
                onTap: () => _openTokenManager('website'),
              ),
              _sourceCard(
                icon: const Icon(
                  Icons.link_rounded,
                  color: AppColors.primary,
                  size: 27,
                ),
                title: 'Custom',
                description:
                    'Connect any other partner, broker, or vendor lead source',
                onTap: () => _openForm(initialPlatform: 'Custom'),
              ),
              _sourceCard(
                icon: const Icon(
                  Icons.mic_none_rounded,
                  color: Color(0xFF8B5CF6),
                  size: 27,
                ),
                title: 'Vistrow Voice',
                description:
                    'Qualified leads from the Vistrow Voice AI calling platform',
                onTap: () => _openTokenManager('voice'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (_automations.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 30,
                ),
                child: Column(
                  children: [
                    const Text(
                      'No connections yet',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      'Connect Facebook Lead Ads in one click — no technical setup needed.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.of(context).textSoft),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _openFacebookWizard,
                      icon: const FaIcon(FontAwesomeIcons.facebookF, size: 16),
                      label: const Text('Connect Facebook'),
                    ),
                  ],
                ),
              ),
            )
          else ...[
            Text(
              'Your connections (${_automations.length})',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            ..._automations.map(_connectionCard),
          ],
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Campaign Routing Rules',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Route leads from specific Facebook campaigns or forms directly to a team member. All other leads follow round-robin.',
                              style: TextStyle(
                                height: 1.4,
                                color: AppTheme.of(context).textSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton.icon(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const RoutingRulesScreen(),
                            ),
                          );
                          _load();
                        },
                        icon: const Icon(Icons.add, size: 17),
                        label: const Text('Add Rule'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_routingRules.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.of(context).border),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        'No routing rules yet. Add one above to route specific campaigns to a team member.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppTheme.of(context).textSoft),
                      ),
                    )
                  else
                    ..._routingRules
                        .take(4)
                        .map(
                          (rule) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(
                              Icons.alt_route,
                              color: AppColors.primary,
                            ),
                            title: Text(
                              rule['name']?.toString() ??
                                  rule['campaignName']?.toString() ??
                                  'Routing rule',
                            ),
                            subtitle: Text(
                              'Assigned to ${rule['assignedToName'] ?? rule['agentName'] ?? 'team member'}',
                            ),
                          ),
                        ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Kept temporarily while the parity UI is exercised against the installed
  // web app; remove after the new screen completes device regression.
  // ignore: unused_element
  Widget _legacyBuild(BuildContext context) {
    return Scaffold(
      floatingActionButton: GradientFab(onPressed: () => _openForm()),
      body: _loading
          ? const Center(child: AppSpinner(size: 32))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      TextButton.icon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const RoutingRulesScreen(),
                          ),
                        ),
                        icon: const Icon(Icons.alt_route, size: 18),
                        label: const Text('Routing Rules'),
                      ),
                      TextButton.icon(
                        onPressed: () => _openTokenManager('website'),
                        icon: const Icon(Icons.language, size: 18),
                        label: const Text('WordPress'),
                      ),
                      TextButton.icon(
                        onPressed: _connectFacebookSystemToken,
                        icon: const FaIcon(
                          FontAwesomeIcons.facebookF,
                          size: 16,
                        ),
                        label: const Text('Facebook'),
                      ),
                      TextButton.icon(
                        onPressed: () => _openTokenManager('google'),
                        icon: const FaIcon(FontAwesomeIcons.google, size: 16),
                        label: const Text('Google Ads'),
                      ),
                      TextButton.icon(
                        onPressed: () => _openTokenManager('voice'),
                        icon: const Icon(Icons.mic_none_rounded, size: 18),
                        label: const Text('Vistrow Voice'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _automations.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'No automations yet — tap + to connect a lead source.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: AppColors.primary,
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                              vertical: 8,
                              horizontal: 4,
                            ),
                            itemCount: _automations.length,
                            itemBuilder: (context, i) {
                              final a = _automations[i];
                              final active = a['isActive'] != false;
                              final icon =
                                  _platformIcons[a['platform']] ??
                                  FontAwesomeIcons.bolt.data;
                              final endpoint =
                                  a['platform'] != 'Facebook' &&
                                      (a['webhookPath'] as String? ?? '')
                                          .isNotEmpty
                                  ? '$_serverBase${a['webhookPath']}'
                                  : null;
                              return Card(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                child: Column(
                                  children: [
                                    ListTile(
                                      onTap: () => _openForm(automation: a),
                                      leading: CircleAvatar(
                                        backgroundColor: AppColors.primary
                                            .withValues(alpha: 0.12),
                                        child: Icon(
                                          icon,
                                          color: AppColors.primary,
                                          size: 20,
                                        ),
                                      ),
                                      title: Text(
                                        a['name'] as String? ?? '—',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      subtitle: Text(
                                        '${a['platform'] ?? ''} · ${a['status'] ?? ''}',
                                      ),
                                      trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Switch(
                                            value: active,
                                            activeThumbColor: AppColors.success,
                                            onChanged: (_) => _toggleActive(a),
                                          ),
                                          PopupMenuButton<String>(
                                            onSelected: (value) {
                                              if (value == 'edit')
                                                _openForm(automation: a);
                                              if (value == 'diagnose')
                                                _diagnoseFacebook(a);
                                              if (value == 'resubscribe')
                                                _resubscribeFacebook(a);
                                              if (value == 'sync')
                                                _syncGoogle(a);
                                              if (value == 'delete') _delete(a);
                                            },
                                            itemBuilder: (_) => [
                                              const PopupMenuItem(
                                                value: 'edit',
                                                child: Text('Edit'),
                                              ),
                                              if (a['platform'] ==
                                                  'Facebook') ...[
                                                const PopupMenuItem(
                                                  value: 'diagnose',
                                                  child: Text(
                                                    'Run Diagnostics',
                                                  ),
                                                ),
                                                const PopupMenuItem(
                                                  value: 'resubscribe',
                                                  child: Text(
                                                    'Re-subscribe Page',
                                                  ),
                                                ),
                                              ],
                                              if (a['platform'] == 'Google' &&
                                                  a['mode'] == 'oauth')
                                                const PopupMenuItem(
                                                  value: 'sync',
                                                  child: Text('Sync Now'),
                                                ),
                                              const PopupMenuItem(
                                                value: 'delete',
                                                child: Text('Delete'),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (endpoint != null)
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          16,
                                          0,
                                          12,
                                          10,
                                        ),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                endpoint,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: AppColors.primary,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            IconButton(
                                              visualDensity:
                                                  VisualDensity.compact,
                                              icon: const Icon(
                                                Icons.copy,
                                                size: 14,
                                              ),
                                              onPressed: () {
                                                Clipboard.setData(
                                                  ClipboardData(text: endpoint),
                                                );
                                                ScaffoldMessenger.of(
                                                  context,
                                                ).showSnackBar(
                                                  const SnackBar(
                                                    content: Text('Copied'),
                                                  ),
                                                );
                                              },
                                            ),
                                          ],
                                        ),
                                      ),
                                    if (a['platform'] == 'Facebook' &&
                                        _tokenHealthBadge(a) != null)
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          16,
                                          0,
                                          12,
                                          10,
                                        ),
                                        child: _tokenHealthBadge(a),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}
