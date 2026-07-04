import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'project_detail_screen.dart';

/// Projects list — GET /projects. Tap → ProjectDetailScreen.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _projects = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/projects');
      _projects = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load projects')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_projects.isEmpty) {
      return const Center(child: Text('No projects yet'));
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _projects.length,
        itemBuilder: (context, i) {
          final p = _projects[i];
          final assigned = (p['assignedTo'] as List? ?? [])
              .map((u) => u is Map ? u['name'] as String? ?? '' : '')
              .where((n) => n.isNotEmpty)
              .join(', ');
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.folder, color: AppColors.primary, size: 20),
              ),
              title: Text(p['name'] as String? ?? '—',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                [
                  if ((p['location'] as String? ?? '').isNotEmpty) p['location'] as String,
                  if (assigned.isNotEmpty) 'Agents: $assigned',
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Text(
                '${p['leadCount'] ?? p['totalLeads'] ?? ''}',
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
              ),
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: p)),
                );
                _load();
              },
            ),
          );
        },
      ),
    );
  }
}
