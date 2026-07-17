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
/// Adding/editing Google, WhatsApp, Website Form and Custom sources is fully
/// supported; Facebook still requires the browser OAuth round-trip on web,
/// but its token health (expiry/refresh) and name/page/form are editable here.
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
      setState(() => _automations = (res.data['automations'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load automations')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> a) async {
    try {
      final res = await _api.dio.patch('/automations/${a['_id']}', data: {'isActive': !(a['isActive'] == true)});
      setState(() {
        final idx = _automations.indexWhere((x) => x['_id'] == a['_id']);
        if (idx != -1) _automations[idx] = (res.data['automation'] as Map).cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update')),
          backgroundColor: AppColors.danger,
        ));
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
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove', style: TextStyle(color: AppColors.danger)),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to remove')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _openForm({Map<String, dynamic>? automation}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AutomationFormScreen(automation: automation)),
    );
    if (saved == true) _load();
  }

  Future<void> _refreshToken(Map<String, dynamic> a) async {
    try {
      final res = await _api.dio.post('/automations/facebook/refresh-tokens', data: {'automationId': a['_id']});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res.data['message'] as String? ?? 'Refreshed'),
          backgroundColor: AppColors.success,
        ));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Refresh failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Widget? _tokenHealthBadge(Map<String, dynamic> a) {
    final expiresAt = DateTime.tryParse(a['userTokenExpiresAt'] as String? ?? '');
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
              expired ? 'Facebook token expired' : 'Token expires in $daysLeft day(s)',
              style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
            ),
          ),
          TextButton(
            onPressed: () => _refreshToken(a),
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 0)),
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
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const RoutingRulesScreen())),
                    icon: const Icon(Icons.alt_route, size: 18),
                    label: const Text('Lead Routing Rules'),
                  ),
                ),
              ),
              Expanded(
                child: _automations.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('No automations yet — tap + to connect a lead source.',
                              textAlign: TextAlign.center),
                        ),
                      )
                    : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  itemCount: _automations.length,
                  itemBuilder: (context, i) {
                    final a = _automations[i];
                    final active = a['isActive'] != false;
                    final icon = _platformIcons[a['platform']] ?? FontAwesomeIcons.bolt.data;
                    final endpoint = a['platform'] != 'Facebook' && (a['webhookPath'] as String? ?? '').isNotEmpty
                        ? '$_serverBase${a['webhookPath']}'
                        : null;
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      child: Column(
                        children: [
                          ListTile(
                            onTap: () => _openForm(automation: a),
                            leading: CircleAvatar(
                              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                              child: Icon(icon, color: AppColors.primary, size: 20),
                            ),
                            title: Text(a['name'] as String? ?? '—',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('${a['platform'] ?? ''} · ${a['status'] ?? ''}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Switch(
                                  value: active,
                                  activeThumbColor: AppColors.success,
                                  onChanged: (_) => _toggleActive(a),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger, size: 20),
                                  onPressed: () => _delete(a),
                                ),
                              ],
                            ),
                          ),
                          if (endpoint != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 0, 12, 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(endpoint,
                                        style: const TextStyle(fontSize: 11, color: AppColors.primary),
                                        overflow: TextOverflow.ellipsis),
                                  ),
                                  IconButton(
                                    visualDensity: VisualDensity.compact,
                                    icon: const Icon(Icons.copy, size: 14),
                                    onPressed: () {
                                      Clipboard.setData(ClipboardData(text: endpoint));
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(content: Text('Copied')));
                                    },
                                  ),
                                ],
                              ),
                            ),
                          if (a['platform'] == 'Facebook' && _tokenHealthBadge(a) != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 0, 12, 10),
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
