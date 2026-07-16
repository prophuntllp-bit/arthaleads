import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

const _matchFields = ['form_id', 'campaign_id', 'adset_id', 'ad_id'];

/// Campaign Lead Routing Rules — GET/POST/PATCH/DELETE /routing-rules.
/// Matches a Facebook form_id/campaign_id/adset_id/ad_id to a specific
/// agent; leads that don't match any rule fall back to round-robin.
/// Growth-plan and above only (planGate on the backend).
class RoutingRulesScreen extends StatefulWidget {
  const RoutingRulesScreen({super.key});

  @override
  State<RoutingRulesScreen> createState() => _RoutingRulesScreenState();
}

class _RoutingRulesScreenState extends State<RoutingRulesScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _rules = [];
  List<Map<String, dynamic>> _agents = [];
  bool _loading = true;
  String? _planError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _planError = null;
    });
    try {
      final results = await Future.wait([
        _api.dio.get('/routing-rules'),
        _api.dio.get('/auth/agents'),
      ]);
      setState(() {
        _rules = (results[0].data['rules'] as List? ?? []).cast<Map<String, dynamic>>();
        _agents = (results[1].data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (e) {
      final msg = ApiClient.errorMessage(e, 'Failed to load routing rules');
      if (msg.toLowerCase().contains('plan') || msg.toLowerCase().contains('upgrade')) {
        setState(() => _planError = msg);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppColors.danger));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> rule) async {
    try {
      final res = await _api.dio.patch('/routing-rules/${rule['_id']}', data: {'isActive': !(rule['isActive'] == true)});
      setState(() {
        final i = _rules.indexWhere((r) => r['_id'] == rule['_id']);
        if (i != -1) _rules[i] = (res.data['rule'] as Map).cast<String, dynamic>();
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

  Future<void> _delete(Map<String, dynamic> rule) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove rule?'),
        content: Text('"${rule['label']}" will no longer route matching leads.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/routing-rules/${rule['_id']}');
      setState(() => _rules.remove(rule));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to remove')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _addRule() async {
    final labelCtrl = TextEditingController();
    final valueCtrl = TextEditingController();
    String matchField = _matchFields.first;
    String? assignTo;
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('New Routing Rule', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Label', isDense: true)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: matchField,
                decoration: const InputDecoration(labelText: 'Match Field', isDense: true),
                items: _matchFields.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                onChanged: (v) => setSheet(() => matchField = v ?? _matchFields.first),
              ),
              const SizedBox(height: 8),
              TextField(controller: valueCtrl, decoration: const InputDecoration(labelText: 'Match Value (Facebook ID)', isDense: true)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: assignTo,
                decoration: const InputDecoration(labelText: 'Assign to Agent', isDense: true),
                items: _agents
                    .map((a) => DropdownMenuItem(value: a['_id'] as String, child: Text(a['name'] as String? ?? '')))
                    .toList(),
                onChanged: (v) => setSheet(() => assignTo = v),
              ),
              const SizedBox(height: 16),
              GradientButton(
                fullWidth: true,
                onPressed: () async {
                  if (labelCtrl.text.trim().isEmpty || valueCtrl.text.trim().isEmpty || assignTo == null) {
                    ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('All fields are required')));
                    return;
                  }
                  try {
                    await _api.dio.post('/routing-rules', data: {
                      'label': labelCtrl.text.trim(),
                      'matchField': matchField,
                      'matchValue': valueCtrl.text.trim(),
                      'assignTo': assignTo,
                    });
                    if (ctx.mounted) Navigator.pop(ctx, true);
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                        content: Text(ApiClient.errorMessage(e, 'Failed to create rule')),
                        backgroundColor: AppColors.danger,
                      ));
                    }
                  }
                },
                child: const Text('Create Rule'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lead Routing Rules')),
      floatingActionButton: _planError == null ? GradientFab(onPressed: _addRule) : null,
      body: _loading
          ? const Center(child: AppSpinner(size: 32))
          : _planError != null
              ? Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock_outline, size: 40, color: AppColors.warning),
                        const SizedBox(height: 12),
                        Text(_planError!, textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                )
              : _rules.isEmpty
                  ? const Center(child: Text('No routing rules yet — leads fall back to round-robin.'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _rules.length,
                        itemBuilder: (context, i) {
                          final r = _rules[i];
                          final active = r['isActive'] != false;
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              title: Text(r['label'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${r['matchField']} = ${r['matchValue']} → ${r['assignToName'] ?? ''}'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Switch(value: active, activeThumbColor: AppColors.success, onChanged: (_) => _toggle(r)),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger, size: 20),
                                    onPressed: () => _delete(r),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
