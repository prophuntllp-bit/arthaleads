import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../leads/lead_detail_sheet.dart';

/// Project detail — GET /projects/:id/leads with search + pagination.
/// Lead rows reuse the same detail sheet as the unified list (rows are
/// tagged _type=project so edits hit the project-lead endpoints).
class ProjectDetailScreen extends StatefulWidget {
  final Map<String, dynamic> project;
  const ProjectDetailScreen({super.key, required this.project});

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> {
  final _api = ApiClient.instance;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();

  final List<Map<String, dynamic>> _leads = [];
  List<Map<String, dynamic>> _projects = [];
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  bool _loading = true;

  String get _projectId => widget.project['_id'] as String;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _api.dio.get('/projects').then((res) {
      _projects = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
    }).catchError((_) {});
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading && _page < _pages) {
        _page += 1;
        _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _leads.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/projects/$_projectId/leads', queryParameters: {
        'page': _page,
        'limit': 25,
        if (_searchCtrl.text.trim().isNotEmpty) 'search': _searchCtrl.text.trim(),
      });
      setState(() {
        _leads.addAll((res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>());
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load project leads')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> lead) async {
    // Tag the row the same way /leads/unified does so the shared detail
    // sheet routes edits to the project-lead endpoints.
    final tagged = {
      ...lead,
      '_type': 'project',
      'projectId': _projectId,
      'projectName': widget.project['name'],
      'followUpDate': lead['followUp'],
    };
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: tagged,
        projects: _projects,
        onUpdated: (updated) {
          final i = _leads.indexWhere((l) => l['_id'] == updated['_id']);
          if (i != -1) setState(() => _leads[i] = {..._leads[i], ...updated});
        },
      ),
    );
    if (changed == true) _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.project['name'] as String? ?? 'Project')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              decoration: const InputDecoration(
                hintText: 'Search leads…',
                prefixIcon: Icon(Icons.search, size: 20),
                isDense: true,
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(reset: true),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('$_total leads', style: Theme.of(context).textTheme.bodySmall),
            ),
          ),
          Expanded(
            child: _loading && _leads.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _leads.isEmpty
                    ? const Center(child: Text('No leads in this project'))
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () => _load(reset: true),
                        child: ListView.builder(
                          controller: _scroll,
                          itemCount: _leads.length,
                          itemBuilder: (context, i) {
                            final lead = _leads[i];
                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: ListTile(
                                title: Text(lead['name'] as String? ?? '—',
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(lead['phone'] as String? ?? ''),
                                    if ((lead['booking'] as String? ?? '').isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: BookingChip(lead['booking'] as String?),
                                      ),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.call, size: 20, color: AppColors.primary),
                                      onPressed: () {
                                        final p = lead['phone'] as String?;
                                        if (p != null) launchUrl(Uri.parse('tel:$p'));
                                      },
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.chat, size: 20, color: AppColors.whatsapp),
                                      onPressed: () {
                                        final p = (lead['phone'] as String? ?? '')
                                            .replaceAll(RegExp(r'\D'), '');
                                        if (p.isEmpty) return;
                                        final wa = p.length == 10 ? '91$p' : p;
                                        launchUrl(Uri.parse('https://wa.me/$wa'),
                                            mode: LaunchMode.externalApplication);
                                      },
                                    ),
                                  ],
                                ),
                                onTap: () => _openDetail(lead),
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
