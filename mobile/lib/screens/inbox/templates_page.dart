import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../data/template_gallery.dart' as gallery_data;
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'template_builder.dart';
import 'wa_settings_page.dart';

/// Templates tab — "Your templates" (Meta-hosted, live) + "Explore" (static
/// gallery of starting points). Mirrors
/// frontend/src/pages/conversations/TemplatesPage.jsx against
/// GET/DELETE /whatsapp/templates.
class TemplatesPage extends StatefulWidget {
  const TemplatesPage({super.key});

  @override
  State<TemplatesPage> createState() => _TemplatesPageState();
}

class _TemplatesPageState extends State<TemplatesPage> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _rows;
  Map<String, dynamic>? _err;
  bool _loading = true;
  String _filter = 'ALL';
  int _view = 0; // 0 = explore, 1 = yours

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/whatsapp/templates');
      if (!mounted) return;
      setState(() {
        _rows = (res.data['templates'] as List? ?? []).cast<Map<String, dynamic>>();
        _err = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _rows = [];
        _err = {'message': ApiClient.errorMessage(e, 'Could not load templates')};
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          if (_err != null || (_rows?.isEmpty ?? true)) _view = 0;
        });
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete template'),
        content: Text('Delete the template "${t['name']}"? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/whatsapp/templates/${Uri.encodeComponent(t['name'] as String)}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template deleted')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not delete')), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _openBuilder({Map<String, dynamic>? preset, String? editId}) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => TemplateBuilderScreen(preset: preset, editId: editId)),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<AuthState>().isWaAdmin;

    return DefaultTabController(
      length: 2,
      initialIndex: _view,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).scaffoldBackgroundColor,
            child: TabBar(
              tabs: [
                const Tab(text: 'Explore'),
                Tab(text: 'Your templates (${_rows?.length ?? 0})'),
              ],
              onTap: (i) => setState(() => _view = i),
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _view,
              children: [
                _explore(canEdit),
                _yours(canEdit),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _explore(bool canEdit) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_err != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: Text(
              'You can browse and build templates here, but submitting one needs a working WhatsApp connection.',
              style: const TextStyle(fontSize: 12.5),
            ),
          ),
        for (final stage in gallery_data.stages)
          if (gallery_data.byStage(stage.key).isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 8),
              child: Text(stage.label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            ),
            Text(stage.blurb, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 8),
            ...gallery_data.byStage(stage.key).map((t) => _GalleryCard(
                  template: t,
                  canEdit: canEdit,
                  onUse: () => _openBuilder(preset: t),
                )),
            const SizedBox(height: 8),
          ],
      ],
    );
  }

  Widget _yours(bool canEdit) {
    if (_loading && (_rows == null)) {
      return const Center(child: AppSpinner());
    }
    if (_err != null) {
      final isAdmin = context.read<AuthState>().isWaAdmin;
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 40, color: Colors.grey),
            const SizedBox(height: 12),
            Text(_err!['message'] as String? ?? 'Could not load templates', textAlign: TextAlign.center),
            if (_err?['settingsFix'] == true && isAdmin) ...[
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const Scaffold(body: WaSettingsPage())),
                ),
                child: const Text('Open settings'),
              ),
            ],
          ],
        ),
      );
    }
    final rows = _rows ?? [];
    if (rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.description_outlined, size: 40, color: Colors.grey),
            const SizedBox(height: 12),
            const Text('No templates yet'),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => setState(() => _view = 0),
              child: const Text('Browse ready-made templates'),
            ),
          ],
        ),
      );
    }

    final counts = {
      'ALL': rows.length,
      'APPROVED': rows.where((t) => t['status'] == 'APPROVED').length,
      'PENDING': rows.where((t) => t['status'] == 'PENDING').length,
      'REJECTED': rows.where((t) => t['status'] == 'REJECTED').length,
    };
    final shown = _filter == 'ALL' ? rows : rows.where((t) => t['status'] == _filter).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _FilterChip('All (${counts['ALL']})', _filter == 'ALL', () => setState(() => _filter = 'ALL')),
                _FilterChip('Approved (${counts['APPROVED']})', _filter == 'APPROVED', () => setState(() => _filter = 'APPROVED')),
                _FilterChip('In review (${counts['PENDING']})', _filter == 'PENDING', () => setState(() => _filter = 'PENDING')),
                _FilterChip('Rejected (${counts['REJECTED']})', _filter == 'REJECTED', () => setState(() => _filter = 'REJECTED')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (shown.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Nothing in this status.', style: TextStyle(color: Colors.grey))),
            )
          else
            ...shown.map((t) => _YourTemplateCard(
                  template: t,
                  canEdit: canEdit,
                  onTap: t['id'] != null ? () => _openBuilder(editId: t['id'] as String) : null,
                  onDelete: () => _delete(t),
                )),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip(this.label, this.selected, this.onTap);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
    );
  }
}

Color _statusColor(String? status) {
  switch (status) {
    case 'APPROVED':
      return AppColors.success;
    case 'PENDING':
      return AppColors.warning;
    case 'REJECTED':
      return AppColors.danger;
    default:
      return Colors.grey;
  }
}

String _statusLabel(String? status) {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'PENDING':
      return 'In review';
    case 'REJECTED':
      return 'Rejected';
    case 'PAUSED':
      return 'Paused';
    default:
      return status ?? '—';
  }
}

class _YourTemplateCard extends StatelessWidget {
  final Map<String, dynamic> template;
  final bool canEdit;
  final VoidCallback? onTap;
  final VoidCallback onDelete;
  const _YourTemplateCard({required this.template, required this.canEdit, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final components = (template['components'] as List? ?? []).cast<Map>();
    final body = components.firstWhere((c) => c['type'] == 'BODY', orElse: () => {})['text'] as String?;
    final status = template['status'] as String?;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(template['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(status).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(_statusLabel(status), style: TextStyle(fontSize: 10, color: _statusColor(status), fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '${(template['category'] as String? ?? '').toLowerCase()} · ${template['language'] ?? ''}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              Text(
                body ?? 'No body text',
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13),
              ),
              if (status == 'REJECTED' && template['rejected_reason'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'reason: ${(template['rejected_reason'] as String).toLowerCase().replaceAll('_', ' ')}',
                    style: const TextStyle(fontSize: 11, color: AppColors.danger),
                  ),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text('ID: ${template['id'] ?? '—'}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                  ),
                  if (canEdit)
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.danger),
                      onPressed: onDelete,
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GalleryCard extends StatelessWidget {
  final Map<String, dynamic> template;
  final bool canEdit;
  final VoidCallback onUse;
  const _GalleryCard({required this.template, required this.canEdit, required this.onUse});

  @override
  Widget build(BuildContext context) {
    final varMap = (template['varMap'] as List? ?? []).cast<String>();
    var body = template['body'] as String? ?? '';
    for (var i = 0; i < varMap.length; i++) {
      final label = gallery_data.varLabels[varMap[i]] ?? varMap[i];
      body = body.replaceAll('{{${i + 1}}}', '[$label]');
    }
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(template['title'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (template['category'] == 'MARKETING' ? AppColors.purple : AppColors.info).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    (template['category'] as String).toLowerCase(),
                    style: TextStyle(fontSize: 10, color: template['category'] == 'MARKETING' ? AppColors.purple : AppColors.info),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(template['description'] as String, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(fontSize: 13)),
            if (template['footer'] != null) ...[
              const SizedBox(height: 6),
              Text(template['footer'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
            if (canEdit) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: SecondaryButton(onPressed: onUse, child: const Text('Use this')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
