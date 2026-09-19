import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'agent_builder.dart';
import 'wa_ui.dart';

/// AI Agents tab — list of assistants configured on the org's WhatsApp
/// number. Mirrors frontend/src/pages/conversations/AgentsPage.jsx against
/// GET/PATCH/DELETE /whatsapp/agents and POST /whatsapp/agents/:id/default.
class AgentsPage extends StatefulWidget {
  const AgentsPage({super.key});

  @override
  State<AgentsPage> createState() => _AgentsPageState();
}

class _AgentsPageState extends State<AgentsPage> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _agents;
  bool? _connected;
  bool _botEnabled = true;
  String _search = '';
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.dio.get('/whatsapp/agents');
      if (!mounted) return;
      setState(() => _agents = (res.data['agents'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (_) {
      if (mounted) setState(() => _agents = []);
    }
    try {
      final res = await _api.dio.get('/whatsapp/settings');
      if (mounted) {
        setState(() {
          _connected = res.data['connected'] == true;
          _botEnabled = res.data['whatsapp']?['botEnabled'] != false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  Future<void> _toggleStatus(Map<String, dynamic> agent) async {
    final next = agent['status'] == 'active' ? 'paused' : 'active';
    try {
      final res = await _api.dio.patch('/whatsapp/agents/${agent['_id']}', data: {'status': next});
      if (!mounted) return;
      setState(() {
        final i = _agents!.indexWhere((a) => a['_id'] == agent['_id']);
        if (i >= 0) _agents![i] = (res.data['agent'] as Map).cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _makeDefault(Map<String, dynamic> agent) async {
    try {
      await _api.dio.post('/whatsapp/agents/${agent['_id']}/default');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> agent) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete assistant'),
        content: Text('Delete "${agent['name']}"? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/whatsapp/agents/${agent['_id']}');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _toggleBot(bool v) async {
    setState(() => _botEnabled = v);
    try {
      await _api.dio.patch('/whatsapp/settings', data: {'botEnabled': v});
    } catch (e) {
      if (mounted) {
        setState(() => _botEnabled = !v);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _openBuilder({Map<String, dynamic>? agent}) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => AgentBuilderScreen(agentId: agent?['_id'] as String?)),
    );
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    if (_connected == false) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: WaCard(
            children: [
              Icon(Icons.wifi_off_rounded, size: 34, color: t.textSoft),
              const SizedBox(height: 10),
              const Text('Connect WhatsApp first', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                "Your assistants reply over your WhatsApp number, so it needs one connected before there's anything for them to do. Open the Settings tab to connect it.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.4, color: t.textSoft),
              ),
            ],
          ),
        ),
      );
    }
    if (_agents == null) {
      return const Center(child: AppSpinner());
    }
    final all = _agents!;
    bool incomplete(Map<String, dynamic> a) {
      final r = (a['readiness'] as Map?)?.cast<String, dynamic>();
      return ((r?['score'] as num?) ?? 0) < ((r?['total'] as num?) ?? 6);
    }

    final counts = {
      'all': all.length,
      'active': all.where((a) => a['status'] == 'active').length,
      'incomplete': all.where(incomplete).length,
      'paused': all.where((a) => a['status'] == 'paused').length,
      'draft': all.where((a) => a['status'] == 'draft').length,
    };
    var shown = all;
    if (_filter == 'incomplete') {
      shown = shown.where(incomplete).toList();
    } else if (_filter != 'all') {
      shown = shown.where((a) => a['status'] == _filter).toList();
    }
    final q = _search.trim().toLowerCase();
    if (q.isNotEmpty) {
      shown = shown
          .where((a) =>
              (a['name'] as String? ?? '').toLowerCase().contains(q) ||
              (a['description'] as String? ?? '').toLowerCase().contains(q) ||
              ((a['projectIds'] as List? ?? const [])).any((p) => p is Map && '${p['name'] ?? ''}'.toLowerCase().contains(q)))
          .toList();
    }

    const filters = [
      ['all', 'All'],
      ['active', 'Active'],
      ['incomplete', 'Setup incomplete'],
      ['paused', 'Paused'],
      ['draft', 'Draft'],
    ];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('AI Agents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    Text(
                      '${all.length} assistant${all.length == 1 ? '' : 's'}${all.isNotEmpty ? ' · ${counts['active']} live' : ''}',
                      style: TextStyle(fontSize: 12, color: t.textSoft),
                    ),
                  ],
                ),
              ),
              GradientButton(icon: Icons.add, onPressed: () => _openBuilder(), child: const Text('New agent')),
            ],
          ),
          const SizedBox(height: 16),
          // Org-wide kill switch — stops every assistant without editing any.
          WaCard(
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _botEnabled ? AppColors.success.withValues(alpha: 0.12) : t.surfaceLow,
                      border: _botEnabled ? null : Border.all(color: t.border),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(Icons.power_settings_new, size: 18, color: _botEnabled ? const Color(0xFF15803D) : t.textSoft),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_botEnabled ? 'Auto-replies are on' : 'Auto-replies are off everywhere',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          _botEnabled
                              ? 'Your live assistants answer new messages automatically.'
                              : "Nothing is auto-answered, whatever each assistant's own status says.",
                          style: TextStyle(fontSize: 12, height: 1.35, color: t.textSoft),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _botEnabled,
                    activeTrackColor: AppColors.success,
                    activeThumbColor: Colors.white,
                    onChanged: _toggleBot,
                  ),
                ],
              ),
            ],
          ),
          TextField(
            style: const TextStyle(fontSize: 14),
            decoration: waDecoration(context, hint: 'Search assistants, description or project').copyWith(
              prefixIcon: Icon(Icons.search, size: 20, color: t.textSoft),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final f in filters)
                  _Chip(f[1], counts[f[0]] ?? 0, _filter == f[0], () => setState(() => _filter = f[0])),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (all.isEmpty)
            WaCard(
              children: [
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                        child: const Icon(Icons.auto_awesome, color: AppColors.primary),
                      ),
                      const SizedBox(height: 12),
                      const Text('No assistants yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(
                        'An assistant answers WhatsApp messages from your real project data. Build one per campaign, per language or per project — whatever matches how you sell.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.5, height: 1.4, color: t.textSoft),
                      ),
                      const SizedBox(height: 14),
                      GradientButton(icon: Icons.add, onPressed: () => _openBuilder(), child: const Text('Create your first agent')),
                    ],
                  ),
                ),
              ],
            )
          else if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('No assistants match ${_search.isNotEmpty ? '"$_search"' : 'that filter'}.',
                    style: TextStyle(color: t.textSoft)),
              ),
            )
          else
            ...shown.map((a) => _AgentCard(
                  agent: a,
                  onOpen: () => _openBuilder(agent: a),
                  onToggle: () => _toggleStatus(a),
                  onDefault: () => _makeDefault(a),
                  onDelete: () => _delete(a),
                )),
          if (all.isNotEmpty && counts['active'] == 0)
            const WaNotice(
              'None of your assistants are live, so nothing is auto-answering. Press play on the one you want handling messages.',
              warn: true,
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  const _Chip(this.label, this.count, this.selected, this.onTap);

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : t.surfaceSolid,
            borderRadius: BorderRadius.circular(999),
            border: selected ? null : Border.all(color: t.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: selected ? Colors.white : t.textSoft)),
              const SizedBox(width: 6),
              Text('$count', style: TextStyle(fontSize: 12, color: (selected ? Colors.white : t.textSoft).withValues(alpha: 0.75))),
            ],
          ),
        ),
      ),
    );
  }
}

class _AgentCard extends StatelessWidget {
  final Map<String, dynamic> agent;
  final VoidCallback onOpen;
  final VoidCallback onToggle;
  final VoidCallback onDefault;
  final VoidCallback onDelete;
  const _AgentCard({required this.agent, required this.onOpen, required this.onToggle, required this.onDefault, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final status = agent['status'] as String? ?? 'draft';
    final statusColor = status == 'active' ? const Color(0xFF15803D) : (status == 'paused' ? const Color(0xFFB45309) : t.textSoft);
    final statusBg = status == 'active'
        ? AppColors.success.withValues(alpha: 0.12)
        : (status == 'paused' ? const Color(0xFFFBBF24).withValues(alpha: 0.18) : t.surfaceLow);
    final readiness = (agent['readiness'] as Map?)?.cast<String, dynamic>();
    final score = (readiness?['score'] as num?)?.toInt() ?? 0;
    final total = (readiness?['total'] as num?)?.toInt() ?? 6;
    final complete = score == total;
    final checks = (readiness?['checks'] as List? ?? []).cast<Map>();
    final failed = checks.where((c) => c['ok'] != true).map((c) => c['label'] as String).join(' · ');
    final projectIds = (agent['projectIds'] as List? ?? []);
    final updatedAt = DateTime.tryParse(agent['updatedAt'] as String? ?? '')?.toLocal();
    final name = agent['name'] as String? ?? '';
    final desc = agent['description'] as String? ?? '';
    final rColor = complete ? const Color(0xFF15803D) : const Color(0xFFB45309);
    final adCount = (agent['adIds'] as List? ?? []).length;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                child: Text(name.isEmpty ? '?' : name.substring(0, name.length < 2 ? name.length : 2).toUpperCase(),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                        if (agent['isDefault'] == true)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.star, size: 10, color: AppColors.primary),
                                SizedBox(width: 3),
                                Text('DEFAULT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.primary)),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(999)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 6, height: 6, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
                          const SizedBox(width: 5),
                          Text(status[0].toUpperCase() + status.substring(1),
                              style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.delete_outline, size: 20, color: t.textSoft),
                tooltip: 'Delete this assistant',
                onPressed: onDelete,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            desc.isEmpty ? 'No description yet.' : desc,
            style: TextStyle(fontSize: 12.5, height: 1.4, fontStyle: desc.isEmpty ? FontStyle.italic : FontStyle.normal, color: t.textSoft.withValues(alpha: desc.isEmpty ? 0.7 : 1)),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
            child: Column(
              children: [
                _MetaRow(
                  Icons.apartment_rounded,
                  'Knows',
                  (agent['systemPrompt'] as String? ?? '').isNotEmpty
                      ? 'Custom prompt'
                      : projectIds.length == 1
                          ? (projectIds.first is Map ? ((projectIds.first as Map)['name'] as String? ?? '1 project') : '1 project')
                          : projectIds.length > 1
                              ? '${projectIds.length} projects'
                              : 'All ${agent['activeProjects'] ?? 0}',
                ),
                _MetaRow(Icons.translate, 'Language',
                    (agent['language'] == 'auto' || agent['language'] == null) ? 'Matches customer' : agent['language'] as String),
                _MetaRow(Icons.campaign_outlined, 'Ads routed', adCount == 0 ? '—' : '$adCount'),
                _MetaRow(Icons.schedule, 'Updated', updatedAt == null ? '—' : DateFormat('d MMM, h:mm a').format(updatedAt), last: true),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: (complete ? AppColors.success : const Color(0xFFFBBF24)).withValues(alpha: complete ? 0.09 : 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: (complete ? AppColors.success : const Color(0xFFFBBF24)).withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Setup ${complete ? 'complete' : 'incomplete'}',
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: rColor)),
                    Text('$score/$total', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: rColor)),
                  ],
                ),
                const SizedBox(height: 3),
                Text(complete ? 'Ready to handle conversations.' : failed,
                    style: TextStyle(fontSize: 11.5, height: 1.35, color: rColor)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: GradientButton(icon: Icons.auto_awesome, onPressed: onOpen, child: const Text('Open & test')),
              ),
              const SizedBox(width: 8),
              _RoundBtn(Icons.edit_outlined, 'Edit', onOpen),
              const SizedBox(width: 8),
              _RoundBtn(status == 'active' ? Icons.pause : Icons.play_arrow,
                  status == 'active' ? 'Pause this assistant' : 'Make this assistant live', onToggle),
              if (agent['isDefault'] != true && status == 'active') ...[
                const SizedBox(width: 8),
                _RoundBtn(Icons.star_border, 'Make this the default assistant', onDefault),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const _RoundBtn(this.icon, this.tooltip, this.onTap);
  @override
  Widget build(BuildContext context) => Tooltip(
        message: tooltip,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTheme.of(context).borderStrong)),
            child: Icon(icon, size: 19),
          ),
        ),
      );
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool last;
  const _MetaRow(this.icon, this.label, this.value, {this.last = false});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 9),
      child: Row(
        children: [
          Icon(icon, size: 15, color: t.textSoft),
          const SizedBox(width: 7),
          Text(label, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                textAlign: TextAlign.right,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
