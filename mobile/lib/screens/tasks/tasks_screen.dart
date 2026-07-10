import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';

/// Tasks — GET /tasks, POST /tasks, PATCH /tasks/:id, PATCH /tasks/:id/complete,
/// DELETE /tasks/:id. Mirrors frontend/src/pages/Tasks.jsx. Agents see only
/// their own tasks (enforced server-side) and can complete them; only
/// admin/manager can create, edit or delete (also enforced server-side).
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final _api = ApiClient.instance;

  final List<Map<String, dynamic>> _tasks = [];
  Map<String, dynamic> _summary = {};
  List<Map<String, dynamic>> _agents = [];
  String _filter = 'pending'; // pending | completed | all
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthState>();
      final futures = <Future>[
        _api.dio.get('/tasks', queryParameters: _filter == 'all' ? null : {'status': _filter}),
      ];
      if (auth.isAdmin) futures.add(_api.dio.get('/auth/agents'));

      final results = await Future.wait(futures);
      setState(() {
        _tasks
          ..clear()
          ..addAll((results[0].data['tasks'] as List? ?? []).cast<Map<String, dynamic>>());
        _summary = (results[0].data['summary'] as Map?)?.cast<String, dynamic>() ?? {};
        if (results.length > 1) {
          _agents = (results[1].data['agents'] as List? ?? []).cast<Map<String, dynamic>>();
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
    try {
      await _api.dio.patch('/tasks/${task['_id']}/complete');
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
      case 'critical':
        return AppColors.danger;
      case 'high':
        return const Color(0xFFEA580C);
      case 'medium':
        return AppColors.info;
      default:
        return const Color(0xFF6B7280);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? task}) async {
    final titleCtrl = TextEditingController(text: task?['title'] as String? ?? '');
    final descCtrl = TextEditingController(text: task?['description'] as String? ?? '');
    String priority = task?['priority'] as String? ?? 'medium';
    DateTime dueDate = task?['dueDate'] != null
        ? DateTime.parse(task!['dueDate'] as String).toLocal()
        : DateTime.now().add(const Duration(days: 1));
    String? assignedTo = task?['assignedTo'] is String
        ? task!['assignedTo'] as String
        : (task?['assignedTo'] as Map?)?['_id'] as String?;
    assignedTo ??= _agents.isNotEmpty ? _agents.first['_id'] as String : null;

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
                    if (date == null) return;
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
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () async {
                    final agentName = _agents
                        .where((a) => a['_id'] == assignedTo)
                        .map((a) => a['name'] as String? ?? '')
                        .firstOrNull;
                    final data = {
                      'title': titleCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'priority': priority,
                      'dueDate': dueDate.toUtc().toIso8601String(),
                      if (assignedTo != null) 'assignedTo': assignedTo,
                      if (agentName != null) 'assignedToName': agentName,
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

    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      floatingActionButton: auth.isAdmin
          ? FloatingActionButton(
              onPressed: () => _openForm(),
              child: const Icon(Icons.add_rounded),
            )
          : null,
      body: Column(
        children: [
          if (_summary.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  _summaryChip('Today', _summary['today'], AppColors.info),
                  const SizedBox(width: 8),
                  _summaryChip('Overdue', _summary['overdue'], AppColors.danger),
                  const SizedBox(width: 8),
                  _summaryChip('Upcoming', _summary['upcoming'], AppColors.success),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'pending', label: Text('Pending')),
                ButtonSegment(value: 'completed', label: Text('Completed')),
                ButtonSegment(value: 'all', label: Text('All')),
              ],
              selected: {_filter},
              onSelectionChanged: (sel) {
                setState(() => _filter = sel.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _tasks.isEmpty
                    ? const Center(child: Text('No tasks here'))
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 80),
                          itemCount: _tasks.length,
                          itemBuilder: (context, i) {
                            final t = _tasks[i];
                            final completed = t['status'] == 'completed';
                            final due = DateTime.tryParse(t['dueDate'] as String? ?? '')?.toLocal();
                            return Dismissible(
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

  Widget _summaryChip(String label, dynamic count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text('${count ?? 0}',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: color)),
          ],
        ),
      ),
    );
  }
}
