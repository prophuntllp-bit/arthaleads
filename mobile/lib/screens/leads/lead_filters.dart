import 'package:flutter/material.dart';

import '../../core/constants.dart';

/// Filter model for GET /leads/unified — field names match the query params.
class LeadFilters {
  final String status;
  final String source;
  final String priority;
  final String booking;
  final String projectId;
  final String assignedTo;
  final bool myOnly;
  final bool followUpToday;

  const LeadFilters({
    this.status = '',
    this.source = '',
    this.priority = '',
    this.booking = '',
    this.projectId = '',
    this.assignedTo = '',
    this.myOnly = false,
    this.followUpToday = false,
  });

  Map<String, dynamic> toParams() => {
        if (status.isNotEmpty) 'status': status,
        if (source.isNotEmpty) 'source': source,
        if (priority.isNotEmpty) 'priority': priority,
        if (booking.isNotEmpty) 'booking': booking,
        if (projectId.isNotEmpty) 'projectId': projectId,
        if (assignedTo.isNotEmpty) 'assignedTo': assignedTo,
        if (myOnly) 'myOnly': 'true',
        if (followUpToday) 'followUpToday': 'true',
      };

  int get activeCount => toParams().length;

  LeadFilters copyWith({
    String? status,
    String? source,
    String? priority,
    String? booking,
    String? projectId,
    String? assignedTo,
    bool? myOnly,
    bool? followUpToday,
  }) =>
      LeadFilters(
        status: status ?? this.status,
        source: source ?? this.source,
        priority: priority ?? this.priority,
        booking: booking ?? this.booking,
        projectId: projectId ?? this.projectId,
        assignedTo: assignedTo ?? this.assignedTo,
        myOnly: myOnly ?? this.myOnly,
        followUpToday: followUpToday ?? this.followUpToday,
      );
}

class LeadFiltersSheet extends StatefulWidget {
  final LeadFilters current;
  final List<Map<String, dynamic>> projects;
  final List<Map<String, dynamic>> agents;
  final bool isAdmin;

  const LeadFiltersSheet({
    super.key,
    required this.current,
    required this.projects,
    required this.agents,
    required this.isAdmin,
  });

  @override
  State<LeadFiltersSheet> createState() => _LeadFiltersSheetState();
}

class _LeadFiltersSheetState extends State<LeadFiltersSheet> {
  late LeadFilters f = widget.current;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Row(
              children: [
                Text('Filters', style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => f = const LeadFilters()),
                  child: const Text('Reset'),
                ),
              ],
            ),
            _dropdown('Status', statusOptions, f.status, (v) => setState(() => f = f.copyWith(status: v))),
            _dropdown('Source', sourceOptions, f.source, (v) => setState(() => f = f.copyWith(source: v))),
            _dropdown('Priority', priorityOptions, f.priority, (v) => setState(() => f = f.copyWith(priority: v))),
            _dropdown(
              'Booking',
              bookingOptions.where((o) => o.value.isNotEmpty).map((o) => o.value).toList(),
              f.booking,
              (v) => setState(() => f = f.copyWith(booking: v)),
            ),
            _dropdownPairs(
              'Project',
              widget.projects.map((p) => (p['_id'] as String, p['name'] as String? ?? '')).toList(),
              f.projectId,
              (v) => setState(() => f = f.copyWith(projectId: v)),
            ),
            if (widget.isAdmin)
              _dropdownPairs(
                'Agent',
                widget.agents.map((a) => (a['_id'] as String, a['name'] as String? ?? '')).toList(),
                f.assignedTo,
                (v) => setState(() => f = f.copyWith(assignedTo: v)),
              ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('My leads only'),
              value: f.myOnly,
              onChanged: (v) => setState(() => f = f.copyWith(myOnly: v)),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Follow-up today'),
              value: f.followUpToday,
              onChanged: (v) => setState(() => f = f.copyWith(followUpToday: v)),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, f),
              child: const Text('Apply Filters'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dropdown(String label, List<String> options, String value, ValueChanged<String> onChanged) {
    return _dropdownPairs(label, options.map((o) => (o, o)).toList(), value, onChanged);
  }

  Widget _dropdownPairs(
    String label,
    List<(String, String)> options,
    String value,
    ValueChanged<String> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DropdownButtonFormField<String>(
        initialValue: value.isEmpty ? '' : value,
        decoration: InputDecoration(labelText: label, isDense: true),
        items: [
          DropdownMenuItem(value: '', child: Text('All', style: TextStyle(color: Theme.of(context).textTheme.bodySmall?.color))),
          ...options.map((o) => DropdownMenuItem(value: o.$1, child: Text(o.$2, overflow: TextOverflow.ellipsis))),
        ],
        onChanged: (v) => onChanged(v ?? ''),
      ),
    );
  }
}
