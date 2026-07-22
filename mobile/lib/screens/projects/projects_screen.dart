import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import '../../widgets/qr_sheet.dart';
import 'project_detail_screen.dart';
import 'project_form.dart';

/// Projects list — GET /projects, POST/PUT/DELETE for CRUD. Tap → ProjectDetailScreen.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _projects = [];
  List<Map<String, dynamic>> _agents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    _loadAgents();
  }

  Future<void> _loadAgents() async {
    try {
      final res = await _api.dio.get('/auth/agents');
      if (mounted) {
        setState(
          () => _agents = (res.data['agents'] as List? ?? [])
              .cast<Map<String, dynamic>>(),
        );
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/projects');
      _projects = (res.data['data'] as List? ?? [])
          .cast<Map<String, dynamic>>();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load projects')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? project}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProjectFormScreen(project: project, agents: _agents),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Project'),
        content: Text(
          'Are you sure you want to delete "${p['name']}"? '
          'All imported leads will remain but the project will be removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/projects/${p['_id']}');
      setState(() => _projects.remove(p));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to delete project'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _showQrCode(Map<String, dynamic> p) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => QrSheet(
        endpoint: '/projects/${p['_id']}/qr-token',
        title: 'QR Code',
        description: p['name'] as String? ?? '',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canManage = context.watch<AuthState>().isAdmin;
    return Scaffold(
      floatingActionButton: canManage
          ? GradientFab(onPressed: () => _openForm())
          : null,
      body: Column(
        children: [
          PageHeader(
            title: 'Projects',
            subtitle: '${_projects.length} active property workspaces',
            icon: Icons.apartment_rounded,
          ),
          Expanded(
            child: _loading
                ? const Center(child: AppSpinner(size: 32))
                : _projects.isEmpty
                ? const Center(
                    child: Text('No projects yet — tap + to add one'),
                  )
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _load,
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: _projects.length,
                      itemBuilder: (context, i) {
                        final p = _projects[i];
                        final assigned = (p['assignedTo'] as List? ?? [])
                            .map(
                              (u) => u is Map ? u['name'] as String? ?? '' : '',
                            )
                            .where((n) => n.isNotEmpty)
                            .join(', ');
                        final priceMin = p['priceMin'] as num?;
                        final priceMax = p['priceMax'] as num?;
                        final priceLabel = (priceMin == null && priceMax == null)
                            ? ''
                            : [
                                if (priceMin != null) fmtBudget(priceMin),
                                if (priceMax != null) fmtBudget(priceMax),
                              ].join(' – ');
                        final bhk = (p['bhkTypes'] as List?)?.cast<String>() ?? [];
                        return FadeSlideIn(
                          delay: Duration(milliseconds: 20 * (i % 12)),
                          child: Card(
                            margin: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.12,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.folder,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                              ),
                              title: Text(
                                p['name'] as String? ?? '—',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    [
                                      if ((p['location'] as String? ?? '')
                                          .isNotEmpty)
                                        p['location'] as String,
                                      if (assigned.isNotEmpty)
                                        'Agents: $assigned',
                                    ].join(' · '),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (priceLabel.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        priceLabel,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  if (bhk.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Wrap(
                                        spacing: 4,
                                        runSpacing: 4,
                                        children: bhk
                                            .map(
                                              (b) => Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 2,
                                                    ),
                                                decoration: BoxDecoration(
                                                  border: Border.all(
                                                    color: Theme.of(context)
                                                        .dividerColor,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                        999,
                                                      ),
                                                ),
                                                child: Text(
                                                  b,
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                      ),
                                    ),
                                ],
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${p['leadCount'] ?? p['totalLeads'] ?? ''}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  if (canManage)
                                    PopupMenuButton<String>(
                                      icon: const Icon(
                                        Icons.more_vert,
                                        size: 20,
                                      ),
                                      onSelected: (v) => switch (v) {
                                        'edit' => _openForm(project: p),
                                        'qr' => _showQrCode(p),
                                        _ => _delete(p),
                                      },
                                      itemBuilder: (ctx) => const [
                                        PopupMenuItem(
                                          value: 'edit',
                                          child: Text('Edit'),
                                        ),
                                        PopupMenuItem(
                                          value: 'qr',
                                          child: Text('QR Code'),
                                        ),
                                        PopupMenuItem(
                                          value: 'delete',
                                          child: Text('Delete'),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        ProjectDetailScreen(project: p),
                                  ),
                                );
                                _load();
                              },
                            ),
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
