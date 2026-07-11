import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Automation — GET/PATCH/DELETE /automations. Scoped to viewing and
/// managing existing connections (toggle active, delete); creating a new
/// connection (Facebook OAuth redirect flow, WordPress token setup) stays
/// web-only since it needs a browser redirect round-trip.
class AutomationScreen extends StatefulWidget {
  const AutomationScreen({super.key});

  @override
  State<AutomationScreen> createState() => _AutomationScreenState();
}

class _AutomationScreenState extends State<AutomationScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _automations = [];
  bool _loading = true;

  static const _platformIcons = {
    'Facebook': Icons.facebook_rounded,
    'Google': Icons.g_mobiledata_rounded,
    'WhatsApp': Icons.chat_rounded,
    'Website Form': Icons.language_rounded,
    'Custom': Icons.bolt_rounded,
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
      setState(() => _automations = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>());
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
        if (idx != -1) _automations[idx] = (res.data['data'] as Map).cast<String, dynamic>();
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

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _automations.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No automations yet — set up a new connection on the web app.',
                      textAlign: TextAlign.center),
                ),
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _automations.length,
                  itemBuilder: (context, i) {
                    final a = _automations[i];
                    final active = a['isActive'] != false;
                    final icon = _platformIcons[a['platform']] ?? Icons.bolt_rounded;
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: ListTile(
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
                    );
                  },
                ),
              );
  }
}
