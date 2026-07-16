import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

/// Tasks — GET /tasks, POST /tasks, PATCH /tasks/:id, PATCH /tasks/:id/complete,
/// DELETE /tasks/:id. Mirrors frontend/src/pages/Tasks.jsx: clickable summary
/// cards, lead/project linking (debounced lead search, project dropdown), and
/// an optional completion note captured when marking a task done. Agents see
/// only their own tasks (enforced server-side) and can complete them; only
/// admin/manager can create, edit, delete, or link a lead/project.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final _api = ApiClient.instance;

  List<Map<String, dynamic>> _allTasks = [];
  Map<String, dynamic> _summary = {};
  List<Map<String, dynamic>> _agents = [];
  List<Map<String, dynamic>> _projects = [];
  String _activeCard = 'all'; // all | today | upcoming | overdue | completed
  String _priorityFilter = '';
  bool _myOnly = false;
  bool _loading = true;

  List<Map<String, dynamic>> get _tasks {
    if (_activeCard == 'completed') return _allTasks.where((t) => t['status'] == 'completed').toList();
    if (_activeCard == 'all') return _allTasks;
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final todayEnd = todayStart.add(const Duration(days: 1)).subtract(const Duration(milliseconds: 1));
    return _allTasks.where((t) {
      if (t['status'] == 'completed') return false;
      final due = DateTime.tryParse(t['dueDate'] as String? ?? '')?.toLocal();
      if (due == null) return false;
      if (_activeCard == 'today') return !due.isBefore(todayStart) && !due.isAfter(todayEnd);
      if (_activeCard == 'upcoming') return due.isAfter(todayEnd);
      if (_activeCard == 'overdue') return due.isBefore(todayStart);
      return true;
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthState>();
      final params = <String, dynamic>{};
      if (_myOnly) params['myOnly'] = 'true';
      if (_priorityFilter.isNotEmpty) params['priority'] = _priorityFilter;

      final futures = <Future>[
        _api.dio.get('/tasks', queryParameters: params.isEmpty ? null : params),
      ];
      if (auth.isAdmin) {
        futures.add(_api.dio.get('/auth/agents'));
        futures.add(_api.dio.get('/projects'));
      }

      final results = await Future.wait(futures);
      setState(() {
        _allTasks = (results[0].data['tasks'] as List? ?? []).cast<Map<String, dynamic>>();
        _summary = (results[0].data['summary'] as Map?)?.cast<String, dynamic>() ?? {};
        if (results.length > 1) {
          _agents = (results[1].data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
        }
        if (results.length > 2) {
          _projects = (results[2].data['data'] as List? ?? []).cast<Map<String, dynamic>>();
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load tasks')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _complete(Map<String, dynamic> task) async {
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark as Completed'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Marking "${task['title']}" as completed.', style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(labelText: 'Completion note (optional)'),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            child: const Text('Mark Complete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.patch('/tasks/${task['_id']}/complete', data: {'note': noteCtrl.text.trim()});
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to complete task')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> task) async {
    try {
      await _api.dio.delete('/tasks/${task['_id']}');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to delete task')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Color _priorityColor(String? p) {
    switch (p) {
      case 'critical': return AppColors.danger;
      case 'high': return const Color(0xFFEA580C);
      case 'medium': return AppColors.info;
      default: return const Color(0xFF6B7280);
    }
  }

  Future<Map<String, dynamic>?> _searchLead(String query) async {
    if (query.trim().length < 2) return null;
    try {
      final res = await _api.dio.get('/leads', queryParameters: {'search': query.trim(), 'limit': 8});
      return {'leads': (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>()};
    } catch (_) {
      return null;
    }
  }

  Future<void> _openForm({Map<String, dynamic>? task}) async {
    final titleCtrl = TextEditingController(text: task?['title'] as String? ?? '');
    final descCtrl = TextEditingController(text: task?['description'] as String? ?? '');
    final leadSearchCtrl = TextEditingController(text: task?['leadName'] as String? ?? '');
    String priority = task?['priority'] as String? ?? 'medium';
    DateTime dueDate = task?['dueDate'] != null
        ? DateTime.parse(task!['dueDate'] as String).toLocal()
        : DateTime.now().add(const Duration(days: 1));
    String? assignedTo = task?['assignedTo'] is String
        ? task!['assignedTo'] as String
        : (task?['assignedTo'] as Map?)?['_id'] as String?;
    assignedTo ??= _agents.isNotEmpty ? _agents.first['_id'] as String : null;
    String? projectId = task?['project'] is String
        ? task!['project'] as String
        : (task?['project'] as Map?)?['_id'] as String?;
    String? leadId = task?['lead'] is String
        ? task!['lead'] as String
        : (task?['lead'] as Map?)?['_id'] as String?;
    String? leadName = task?['leadName'] as String?;
    List<Map<String, dynamic>> leadResults = [];
    Timer? debounce;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(task == null ? 'New Task' : 'Edit Task',
                    style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 16),
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title')),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(value: 'critical', child: Text('Critical')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                  ],
                  onChanged: (v) => setSheetState(() => priority = v ?? 'medium'),
                ),
                const SizedBox(height: 12),
                if (_agents.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: assignedTo,
                    decoration: const InputDecoration(labelText: 'Assign to'),
                    items: _agents
                        .map((a) => DropdownMenuItem(
                              value: a['_id'] as String,
                              child: Text(a['name'] as String? ?? '—'),
                            ))
                        .toList(),
                    onChanged: (v) => setSheetState(() => assignedTo = v),
                  ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Due date'),
                  subtitle: Text(DateFormat('dd MMM yyyy, hh:mm a').format(dueDate)),
                  trailing: const Icon(Icons.edit_calendar_rounded),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: ctx,
                      initialDate: dueDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                    );
                    if (date == null || !ctx.mounted) return;
                    final time = await showTimePicker(
                      context: ctx,
                      initialTime: TimeOfDay.fromDateTime(dueDate),
                    );
                    setSheetState(() {
                      dueDate = DateTime(date.year, date.month, date.day,
                          time?.hour ?? 18, time?.minute ?? 0);
                    });
                  },
                ),
                const SizedBox(height: 16),
                const Text('Link to Project (optional)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8B5CF6))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: projectId,
                  decoration: const InputDecoration(hintText: 'Select project'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('— None —')),
                    ..._projects.map((p) => DropdownMenuItem(value: p['_id'] as String, child: Text(p['name'] as String? ?? '—'))),
                  ],
                  onChanged: (v) => setSheetState(() => projectId = v),
                ),
                const SizedBox(height: 16),
                const Text('Link to Lead (optional)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.blue)),
                const SizedBox(height: 6),
                TextField(
                  controller: leadSearchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search lead by name or phone…',
                    suffixIcon: leadSearchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () => setSheetState(() {
                              leadSearchCtrl.clear();
                              leadId = null;
                              leadName = null;
                              leadResults = [];
                            }),
                          )
                        : null,
                  ),
                  onChanged: (v) {
                    leadId = null;
                    debounce?.cancel();
                    debounce = Timer(const Duration(milliseconds: 300), () async {
                      final res = await _searchLead(v);
                      if (res != null) setSheetState(() => leadResults = res['leads'] as List<Map<String, dynamic>>);
                    });
                  },
                ),
                if (leadResults.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    constraints: const BoxConstraints(maxHeight: 180),
                    decoration: BoxDecoration(border: Border.all(color: Theme.of(ctx).dividerColor), borderRadius: BorderRadius.circular(10)),
                    child: ListView(
                      shrinkWrap: true,
                      children: leadResults.map((l) => ListTile(
                            dense: true,
                            title: Text(l['name'] as String? ?? '—', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            subtitle: Text(l['phone'] as String? ?? '', style: const TextStyle(fontSize: 11)),
                            onTap: () => setSheetState(() {
                              leadId = l['_id'] as String;
                              leadName = l['name'] as String?;
                              leadSearchCtrl.text = leadName ?? '';
                              leadResults = [];
                            }),
                          )).toList(),
                    ),
                  ),
                const SizedBox(height: 16),
                GradientButton(
                  fullWidth: true,
                  onPressed: () async {
                    final agentName = _agents
                        .where((a) => a['_id'] == assignedTo)
                        .map((a) => a['name'] as String? ?? '')
                        .firstOrNull;
                    final projectName = _projects
                        .where((p) => p['_id'] == projectId)
                        .map((p) => p['name'] as String? ?? '')
                        .firstOrNull;
                    final data = {
                      'title': titleCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'priority': priority,
                      'dueDate': dueDate.toUtc().toIso8601String(),
                      'assignedTo': ?assignedTo,
                      'assignedToName': ?agentName,
                      'project': projectId ?? '',
                      'projectName': projectName ?? '',
                      'lead': leadId ?? '',
                      'leadName': leadId != null ? (leadName ?? '') : '',
                    };
                    try {
                      if (task == null) {
                        await _api.dio.post('/tasks', data: data);
                      } else {
                        await _api.dio.patch('/tasks/${task['_id']}', data: data);
                      }
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Save failed')),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: Text(task == null ? 'Create Task' : 'Save Changes'),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );

    debounce?.cancel();
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      floatingActionButton: auth.isAdmin ? GradientFab(onPressed: () => _openForm()) : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: SizedBox(
              height: 74,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _summaryCard('all', 'All', _summary['all'], const Color(0xFF6366F1)),
                  _summaryCard('today', 'Today', _summary['today'], const Color(0xFFF59E0B)),
                  _summaryCard('upcoming', 'Upcoming', _summary['upcoming'], const Color(0xFF10B981)),
                  _summaryCard('overdue', 'Overdue', _summary['overdue'], AppColors.danger),
                  _summaryCard('completed', 'Completed', _summary['completed'], const Color(0xFF64748B)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
            child: Row(
              children: [
                if (auth.isAdmin)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_myOnly ? 'My Tasks' : 'All Tasks', style: const TextStyle(fontSize: 11)),
                      selected: _myOnly,
                      onSelected: (v) {
                        setState(() => _myOnly = v);
                        _load();
                      },
                    ),
                  ),
                Expanded(
                  child: SizedBox(
                    height: 34,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final p in [['', 'All Priorities'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(p[1], style: const TextStyle(fontSize: 11)),
                              selected: _priorityFilter == p[0],
                              onSelected: (_) {
                                setState(() => _priorityFilter = p[0]);
                                _load();
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: AppSpinner(size: 32))
                : _tasks.isEmpty
                    ? const Center(child: Text('No tasks here'))
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 80, top: 4),
                          itemCount: _tasks.length,
                          itemBuilder: (context, i) {
                            final t = _tasks[i];
                            final completed = t['status'] == 'completed';
                            final due = DateTime.tryParse(t['dueDate'] as String? ?? '')?.toLocal();
                            final leadName = t['leadName'] as String?;
                            final projectName = t['projectName'] as String?;
                            return FadeSlideIn(
                              delay: Duration(milliseconds: 20 * (i % 12)),
                              child: Dismissible(
                              key: ValueKey(t['_id']),
                              direction: auth.isAdmin
                                  ? DismissDirection.endToStart
                                  : DismissDirection.none,
                              background: Container(
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                color: AppColors.danger,
                                child: const Icon(Icons.delete_rounded, color: Colors.white),
                              ),
                              confirmDismiss: (_) async {
                                _delete(t);
                                return true;
                              },
                              child: Card(
                                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                child: ListTile(
                                  onTap: auth.isAdmin ? () => _openForm(task: t) : null,
                                  leading: Checkbox(
                                    value: completed,
                                    activeColor: AppColors.success,
                                    onChanged: completed ? null : (_) => _complete(t),
                                  ),
                                  title: Text(
                                    t['title'] as String? ?? '—',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      decoration: completed ? TextDecoration.lineThrough : null,
                                    ),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (due != null)
                                        Text(DateFormat('dd MMM, hh:mm a').format(due)),
                                      if ((t['assignedToName'] as String? ?? '').isNotEmpty)
                                        Text('Assigned to ${t['assignedToName']}',
                                            style: Theme.of(context).textTheme.bodySmall),
                                      if ((leadName ?? '').isNotEmpty || (projectName ?? '').isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 3),
                                          child: Wrap(
                                            spacing: 8,
                                            children: [
                                              if ((leadName ?? '').isNotEmpty)
                                                Row(mainAxisSize: MainAxisSize.min, children: [
                                                  const Icon(Icons.person, size: 11, color: Colors.blue),
                                                  const SizedBox(width: 2),
                                                  Text(leadName!, style: const TextStyle(fontSize: 10, color: Colors.blue)),
                                                ]),
                                              if ((projectName ?? '').isNotEmpty)
                                                Row(mainAxisSize: MainAxisSize.min, children: [
                                                  const Icon(Icons.folder, size: 11, color: Color(0xFF8B5CF6)),
                                                  const SizedBox(width: 2),
                                                  Text(projectName!, style: const TextStyle(fontSize: 10, color: Color(0xFF8B5CF6))),
                                                ]),
                                            ],
                                          ),
                                        ),
                                      if (completed && (t['completionNote'] as String? ?? '').isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 3),
                                          child: Text('Note: ${t['completionNote']}',
                                              style: const TextStyle(fontSize: 10, fontStyle: FontStyle.italic, color: Colors.grey)),
                                        ),
                                    ],
                                  ),
                                  trailing: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: _priorityColor(t['priority'] as String?),
                                    ),
                                  ),
                                  isThreeLine: (leadName ?? '').isNotEmpty || (projectName ?? '').isNotEmpty,
                                ),
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

  Widget _summaryCard(String key, String label, dynamic count, Color color) {
    final active = _activeCard == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => _activeCard = key),
        child: Container(
          width: 92,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(14),
            border: active ? Border.all(color: Colors.white, width: 2) : null,
            boxShadow: active ? [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 8)] : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${count ?? 0}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Colors.white)),
              Text(label, style: const TextStyle(fontSize: 10.5, color: Colors.white, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
