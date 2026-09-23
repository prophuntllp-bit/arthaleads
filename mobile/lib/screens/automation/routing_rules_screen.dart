import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/app_select.dart';
import '../../widgets/buttons.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/motion.dart';

// Mirrors backend/models/RoutingRule.js MATCH_FIELDS_BY_SOURCE — keep in sync.
const _matchFieldsBySource = {
  'facebook': ['form_id', 'campaign_id', 'adset_id', 'ad_id'],
  'whatsapp': ['ad_id'],
  'google': ['campaign_id'],
  'website': ['domain', 'page_path'],
};
const _sourceLabels = {
  'facebook': 'Facebook Lead Ads',
  'whatsapp': 'WhatsApp (Click-to-WhatsApp Ads)',
  'google': 'Google Ads',
  'website': 'Website',
};
const _matchFieldLabels = {
  'form_id': 'Form ID',
  'campaign_id': 'Campaign ID',
  'adset_id': 'Ad Set ID',
  'ad_id': 'Ad ID',
  'domain': 'Website Domain',
  'page_path': 'Page URL Contains',
};

/// Lead Routing Rules — GET/POST/PATCH/DELETE /routing-rules.
/// Matches attribution data from Facebook, WhatsApp (CTWA), Google Ads, or
/// the website (domain / page URL) to a specific agent; leads that don't
/// match any rule fall back to round-robin.
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
  List<String> _domains = [];
  List<Map<String, dynamic>> _sitePages = [];
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
        // Same endpoint the Leads screen filter uses — real domains/pages
        // leads have already come in from, so a rule can be picked instead
        // of typed.
        _api.dio.get('/leads/domains'),
      ]);
      setState(() {
        _rules = (results[0].data['rules'] as List? ?? []).cast<Map<String, dynamic>>();
        _agents = (results[1].data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
        _domains = (results[2].data['domains'] as List? ?? []).cast<String>();
        _sitePages = (results[2].data['pages'] as List? ?? []).cast<Map<String, dynamic>>();
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

  // Bottom sheet listing real domains (and the pages under each, from actual
  // lead traffic) so a rule can be picked instead of typed. Only shows
  // domains/pages that have already sent at least one lead — a brand-new page
  // won't be listed yet, so the caller's text field stays manually editable.
  // Returns {'field': 'domain'|'page_path', 'value': ...} or null if cancelled.
  Future<Map<String, String>?> _pickWebsiteTarget(BuildContext context) {
    return showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.only(bottom: 16),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text('Pick a domain or page', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
            for (final d in _domains) ...[
              Builder(builder: (_) {
                final pagesOfD = _sitePages.where((p) => p['domain'] == d).toList();
                final total = pagesOfD.fold<int>(0, (n, p) => n + ((p['count'] as num?)?.toInt() ?? 0));
                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.public_rounded, size: 18),
                  title: Text(d),
                  trailing: total > 0 ? Text('$total') : null,
                  onTap: () => Navigator.pop(ctx, {'field': 'domain', 'value': d}),
                );
              }),
              for (final p in _sitePages.where((p) => p['domain'] == d && p['path'] != '/'))
                ListTile(
                  dense: true,
                  contentPadding: const EdgeInsets.only(left: 40, right: 16),
                  leading: const Icon(Icons.insert_drive_file_outlined, size: 16),
                  title: Text(p['path'] as String? ?? ''),
                  trailing: Text('${p['count'] ?? ''}'),
                  onTap: () => Navigator.pop(ctx, {'field': 'page_path', 'value': p['path'] as String? ?? ''}),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _addRule() async {
    final labelCtrl = TextEditingController();
    final valueCtrl = TextEditingController();
    String source = 'facebook';
    String matchField = _matchFieldsBySource[source]!.first;
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
              LabeledField(
                label: 'Label',
                child: TextField(controller: labelCtrl, decoration: const InputDecoration(isDense: true)),
              ),
              const SizedBox(height: 8),
              AppSelect<String>(
                label: 'Source',
                dense: true,
                value: source,
                options: _sourceLabels,
                onChanged: (v) => setSheet(() {
                  source = v ?? 'facebook';
                  matchField = _matchFieldsBySource[source]!.first;
                }),
              ),
              const SizedBox(height: 8),
              // AppSelect reads `value` on every build, unlike a plain
              // DropdownButtonFormField's `initialValue` (read once), so
              // switching source or picking a field via the website
              // quick-pick below just works without a rebuild key.
              AppSelect<String>(
                label: 'Match Field',
                dense: true,
                value: matchField,
                options: {
                  for (final f in _matchFieldsBySource[source]!) f: _matchFieldLabels[f] ?? f,
                },
                onChanged: (v) => setSheet(() => matchField = v ?? _matchFieldsBySource[source]!.first),
              ),
              if (source == 'website' && _domains.isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.travel_explore_rounded, size: 18),
                  label: const Text('Pick from your website\'s actual traffic'),
                  onPressed: () async {
                    final picked = await _pickWebsiteTarget(ctx);
                    if (picked != null) {
                      setSheet(() {
                        matchField = picked['field']!;
                        valueCtrl.text = picked['value']!;
                      });
                    }
                  },
                ),
              ],
              const SizedBox(height: 8),
              LabeledField(
                label: 'Match Value',
                child: TextField(controller: valueCtrl, decoration: const InputDecoration(isDense: true)),
              ),
              const SizedBox(height: 8),
              AppSelect<String?>(
                label: 'Assign to Agent',
                dense: true,
                value: assignTo,
                options: {
                  for (final a in _agents) (a['_id'] as String): (a['name'] as String? ?? ''),
                },
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
                      'source': source,
                      'matchField': matchField,
                      'matchValue': matchField == 'domain'
                          ? valueCtrl.text.trim().toLowerCase()
                          : valueCtrl.text.trim(),
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
      // Bottom-left: the draggable Artha assistant bubble owns the
      // bottom-right corner (see _DraggableArthaFab in shell.dart).
      floatingActionButtonLocation: FloatingActionButtonLocation.startFloat,
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
                              subtitle: Text(
                                '${_sourceLabels[r['source'] ?? 'facebook'] ?? r['source']} · '
                                '${_matchFieldLabels[r['matchField']] ?? r['matchField']} = ${r['matchValue']} → ${r['assignToName'] ?? ''}',
                              ),
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
