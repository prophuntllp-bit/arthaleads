import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';

/// Lead quick-detail bottom sheet with inline edits.
/// Plain leads PATCH /leads/:id; project leads PATCH /projects/:pid/leads/:id
/// — same split the web app uses for inline cells.
/// Pops with `true` when something changed that requires a list refresh
/// (transfer, dump, booking = Not Interested).
class LeadDetailSheet extends StatefulWidget {
  final Map<String, dynamic> lead;
  final List<Map<String, dynamic>> projects;
  final void Function(Map<String, dynamic>) onUpdated;

  const LeadDetailSheet({
    super.key,
    required this.lead,
    required this.projects,
    required this.onUpdated,
  });

  @override
  State<LeadDetailSheet> createState() => _LeadDetailSheetState();
}

class _LeadDetailSheetState extends State<LeadDetailSheet> {
  final _api = ApiClient.instance;
  late Map<String, dynamic> lead = {...widget.lead};
  bool _saving = false;

  bool get _isProject => lead['_type'] == 'project' && lead['projectId'] != null;

  Future<void> _patch(Map<String, dynamic> updates, {bool refreshList = false}) async {
    setState(() => _saving = true);
    try {
      final res = _isProject
          ? await _api.dio.patch('/projects/${lead['projectId']}/leads/${lead['_id']}', data: updates)
          : await _api.dio.patch('/leads/${lead['_id']}', data: updates);
      final fresh = (res.data['data'] as Map? ?? {}).cast<String, dynamic>();
      setState(() => lead = {...lead, ...updates, ...fresh});
      widget.onUpdated(lead);
      if (refreshList && mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Save failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Project leads use `followUp`; plain leads use `followUpDate` — same as web.
  String get _followUpField => _isProject ? 'followUp' : 'followUpDate';

  Future<void> _editText(String field, String label) async {
    final ctrl = TextEditingController(text: lead[field] as String? ?? '');
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: TextField(controller: ctrl, autofocus: true, maxLines: 3),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    if (v != null && v != (lead[field] ?? '')) {
      // Plain-lead remark note maps to `remarkNote` on the PATCH route
      final key = (!_isProject && field == 'remark') ? 'remarkNote' : field;
      await _patch({key: v});
      setState(() => lead[field] = v);
    }
  }

  Future<void> _pickFollowUp(String field) async {
    final now = DateTime.now();
    final existing = DateTime.tryParse(lead[field] as String? ?? '');
    final date = await showDatePicker(
      context: context,
      initialDate: existing ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: existing != null ? TimeOfDay.fromDateTime(existing) : const TimeOfDay(hour: 10, minute: 0),
    );
    final dt = DateTime(date.year, date.month, date.day, time?.hour ?? 10, time?.minute ?? 0);
    await _patch({field: dt.toUtc().toIso8601String()});
  }

  Future<void> _transfer() async {
    final projectId = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Transfer to project', style: Theme.of(ctx).textTheme.titleMedium),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: widget.projects
                    .map((p) => ListTile(
                          title: Text(p['name'] as String? ?? ''),
                          onTap: () => Navigator.pop(ctx, p['_id'] as String),
                        ))
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
    if (projectId == null) return;
    try {
      if (_isProject) {
        await _api.dio.post(
          '/projects/${lead['projectId']}/leads/${lead['_id']}/transfer',
          data: {'toProjectId': projectId},
        );
      } else {
        await _api.dio.post('/leads/${lead['_id']}/transfer', data: {'toProjectId': projectId});
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lead transferred')));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Transfer failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final budget = lead['budget'] as Map?;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => Stack(
        children: [
          ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      lead['name'] as String? ?? '—',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  StatusChip(lead['status'] as String?),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  lead['phone'] as String? ?? '',
                  if ((lead['email'] as String? ?? '').isNotEmpty) lead['email'] as String,
                ].join('  ·  '),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if ((lead['projectName'] as String? ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Project: ${lead['projectName']}',
                    style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              const SizedBox(height: 16),

              // ── Booking ──
              Text('Booking', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: bookingOptions
                    .map((o) => ChoiceChip(
                          label: Text(o.label, style: const TextStyle(fontSize: 12)),
                          selected: (lead['booking'] as String? ?? '') == o.value,
                          selectedColor: (o.color ?? Colors.grey).withValues(alpha: 0.2),
                          onSelected: (_) =>
                              _patch({'booking': o.value}, refreshList: o.value == 'Not Interested'),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 16),

              // ── Follow-ups ──
              _row(
                'Follow-up',
                _fmtDate(lead[_followUpField] as String?),
                onTap: () => _pickFollowUp(_followUpField),
                icon: Icons.alarm,
              ),
              _row(
                'Follow-up 2',
                _fmtDate(lead['followUp2'] as String?),
                onTap: () => _pickFollowUp('followUp2'),
                icon: Icons.alarm_add,
              ),

              // ── Remarks ──
              _row('Remark', lead['remark'] as String? ?? '—',
                  onTap: () => _editText('remark', 'Remark'), icon: Icons.notes),
              _row('Remark 1', lead['remark1'] as String? ?? '—',
                  onTap: () => _editText('remark1', 'Remark 1'), icon: Icons.notes),
              _row('Remark 2', lead['remark2'] as String? ?? '—',
                  onTap: () => _editText('remark2', 'Remark 2'), icon: Icons.notes),

              // ── Read-only info ──
              if (!_isProject) ...[
                _row('Source', lead['source'] as String? ?? '—', icon: Icons.language),
                if (budget != null && (budget['min'] != null || budget['max'] != null))
                  _row(
                    'Budget',
                    '${fmtBudget(budget['min'] as num?)} – ${fmtBudget(budget['max'] as num?)}',
                    icon: Icons.currency_rupee,
                  ),
                if ((lead['requirements'] as String? ?? '').isNotEmpty)
                  _row('Requirements', lead['requirements'] as String, icon: Icons.list_alt),
              ],
              if ((lead['assignedToName'] as String? ?? '').isNotEmpty)
                _row('Assigned to', lead['assignedToName'] as String, icon: Icons.person),

              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _transfer,
                      icon: const Icon(Icons.drive_file_move, size: 18),
                      label: const Text('Transfer'),
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (_saving)
            const Positioned(
              top: 4,
              right: 16,
              child: SizedBox(
                width: 18, height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
            ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {VoidCallback? onTap, IconData? icon}) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: icon != null ? Icon(icon, size: 20) : null,
      title: Text(label, style: Theme.of(context).textTheme.bodySmall),
      subtitle: Text(value, style: Theme.of(context).textTheme.bodyMedium),
      trailing: onTap != null ? const Icon(Icons.edit, size: 16) : null,
      onTap: onTap,
    );
  }
}
