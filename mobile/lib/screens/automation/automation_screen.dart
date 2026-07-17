import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
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
      final res = await _api.dio.get('/automations');
      setState(
        () => _automations = (res.data['automations'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
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

  Future<void> _openForm({Map<String, dynamic>? automation}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AutomationFormScreen(automation: automation),
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

  Future<void> _openTokenManager(String kind) async {
    final website = kind == 'website';
    final google = kind == 'google';
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
                          : connections.isEmpty
                          ? const Center(child: Text('No connections yet'))
                          : ListView.builder(
                              itemCount: connections.length,
                              itemBuilder: (_, index) {
                                final connection = connections[index];
                                final token =
                                    connection['token']?.toString() ?? '';
                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                connection['name']
                                                        ?.toString() ??
                                                    'Connection',
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                            Text(
                                              connection['status']
                                                      ?.toString() ??
                                                  'draft',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.primary,
                                              ),
                                            ),
                                            IconButton(
                                              tooltip: 'Delete',
                                              icon: const Icon(
                                                Icons.delete_outline,
                                                color: AppColors.danger,
                                                size: 20,
                                              ),
                                              onPressed: () async {
                                                await _api.dio.delete(
                                                  '/automations/${connection['id']}',
                                                );
                                                setSheetState(
                                                  () => connections.removeAt(
                                                    index,
                                                  ),
                                                );
                                                _load();
                                              },
                                            ),
                                          ],
                                        ),
                                        SelectableText(
                                          token,
                                          style: const TextStyle(fontSize: 11),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            TextButton.icon(
                                              onPressed: () =>
                                                  Clipboard.setData(
                                                    ClipboardData(text: token),
                                                  ),
                                              icon: const Icon(
                                                Icons.copy,
                                                size: 15,
                                              ),
                                              label: const Text('Copy token'),
                                            ),
                                            TextButton.icon(
                                              onPressed: () =>
                                                  Clipboard.setData(
                                                    ClipboardData(
                                                      text: endpoint,
                                                    ),
                                                  ),
                                              icon: const Icon(
                                                Icons.link,
                                                size: 15,
                                              ),
                                              label: const Text(
                                                'Copy endpoint',
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    GradientButton(
                      fullWidth: true,
                      loading: adding,
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
                                final created = (res.data['connection'] as Map)
                                    .cast<String, dynamic>();
                                setSheetState(() => connections.add(created));
                                _load();
                              } finally {
                                setSheetState(() => adding = false);
                              }
                            },
                      child: Text(
                        connections.isEmpty
                            ? 'Create Connection'
                            : 'Add Another Connection',
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
      final checks = results.isEmpty
          ? <Map<String, dynamic>>[]
          : (results.first['checks'] as List? ?? [])
                .cast<Map<String, dynamic>>();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Facebook Diagnostics'),
          content: SizedBox(
            width: double.maxFinite,
            child: checks.isEmpty
                ? Text(
                    res.data['message']?.toString() ?? 'No diagnostic results',
                  )
                : ListView(
                    shrinkWrap: true,
                    children: checks
                        .map(
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
                        )
                        .toList(),
                  ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        ),
      );
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

  Future<void> _resubscribeFacebook(Map<String, dynamic> automation) async {
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Re-subscribe failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
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

  @override
  Widget build(BuildContext context) {
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
