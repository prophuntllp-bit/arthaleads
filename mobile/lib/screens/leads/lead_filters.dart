import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/constants.dart';

/// Filter model for GET /leads/unified — field names match the query params.
class LeadFilters {
  final String status;
  final String source;
  final String priority;
  final String booking;
  final String projectId;
  final String assignedTo;
  final String siteFilter;
  final DateTime? from;
  final DateTime? to;
  final bool myOnly;
  final bool followUpToday;

  const LeadFilters({
    this.status = '',
    this.source = '',
    this.priority = '',
    this.booking = '',
    this.projectId = '',
    this.assignedTo = '',
    this.siteFilter = '',
    this.from,
    this.to,
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
        if (siteFilter.isNotEmpty) 'siteFilter': siteFilter,
        if (from != null) 'from': from!.toIso8601String().substring(0, 10),
        if (to != null) 'to': to!.toIso8601String().substring(0, 10),
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
    String? siteFilter,
    DateTime? from,
    DateTime? to,
    bool clearFrom = false,
    bool clearTo = false,
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
        siteFilter: siteFilter ?? this.siteFilter,
        from: clearFrom ? null : (from ?? this.from),
        to: clearTo ? null : (to ?? this.to),
        myOnly: myOnly ?? this.myOnly,
        followUpToday: followUpToday ?? this.followUpToday,
      );
}

class LeadFiltersSheet extends StatefulWidget {
  final LeadFilters current;
  final List<Map<String, dynamic>> projects;
  final List<Map<String, dynamic>> agents;
  final List<String> domains;
  final bool isAdmin;

  const LeadFiltersSheet({
    super.key,
    required this.current,
    required this.projects,
    required this.agents,
    this.domains = const [],
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
            if (widget.domains.isNotEmpty)
              _dropdown('Website Domain', widget.domains, f.siteFilter,
                  (v) => setState(() => f = f.copyWith(siteFilter: v))),
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
            Row(
              children: [
                Expanded(
                  child: _dateField('From', f.from,
                      (d) => setState(() => f = f.copyWith(from: d, clearFrom: d == null))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _dateField('To', f.to,
                      (d) => setState(() => f = f.copyWith(to: d, clearTo: d == null))),
                ),
              ],
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

  Widget _dateField(String label, DateTime? value, ValueChanged<DateTime?> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: InkWell(
        onTap: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: value ?? now,
            firstDate: now.subtract(const Duration(days: 365 * 3)),
            lastDate: now.add(const Duration(days: 1)),
          );
          if (picked != null) onChanged(picked);
        },
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            isDense: true,
            suffixIcon: value != null
                ? IconButton(icon: const Icon(Icons.clear, size: 16), onPressed: () => onChanged(null))
                : null,
          ),
          child: Text(value == null ? 'Any' : DateFormat('dd MMM yyyy').format(value)),
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
