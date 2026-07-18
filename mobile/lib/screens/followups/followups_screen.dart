import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/chips.dart';
import '../../widgets/page_header.dart';
import '../leads/lead_detail_sheet.dart';

/// Follow-ups — GET /followups?section=past|present|future.
/// Mirrors frontend/src/pages/FollowUps.jsx (Past / Today / Future tabs).
class FollowUpsScreen extends StatefulWidget {
  const FollowUpsScreen({super.key});

  @override
  State<FollowUpsScreen> createState() => _FollowUpsScreenState();
}

class _FollowUpsScreenState extends State<FollowUpsScreen> {
  final _api = ApiClient.instance;
  String _section = 'present';
  final List<Map<String, dynamic>> _leads = [];
  int _total = 0;
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  bool _sortDesc = false;
  bool _myOnly = false;
  DateTime? _from;
  DateTime? _to;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();
  int _loadGeneration = 0;

  static const _sections = [
    ('past', 'Past', Icons.history, AppColors.danger),
    ('present', 'Today', Icons.today, AppColors.info),
    ('future', 'Future', Icons.event, AppColors.success),
  ];

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading &&
          _page < _pages) {
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
    final generation = reset ? ++_loadGeneration : _loadGeneration;
    if (reset) {
      _page = 1;
      _leads.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get(
        '/followups',
        queryParameters: {
          'section': _section,
          'page': _page,
          'limit': 50,
          'sort': _sortDesc ? 'desc' : 'asc',
          if (_myOnly) 'myOnly': 'true',
          if (_section == 'future' && _from != null)
            'from': DateFormat('yyyy-MM-dd').format(_from!),
          if (_section == 'future' && _to != null)
            'to': DateFormat('yyyy-MM-dd').format(_to!),
          if (_searchCtrl.text.trim().isNotEmpty)
            'search': _searchCtrl.text.trim(),
        },
      );
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _leads.addAll(
          (res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>(),
        );
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load follow-ups'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickRangeDate({required bool from}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (from ? _from : _to) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (picked == null) return;
    setState(() {
      if (from) {
        _from = picked;
        if (_to != null && _to!.isBefore(picked)) _to = picked;
      } else {
        _to = picked;
        if (_from != null && _from!.isAfter(picked)) _from = picked;
      }
    });
    _load(reset: true);
  }

  Future<void> _reschedule(Map<String, dynamic> lead) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
    );
    final dt = DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? 10,
      time?.minute ?? 0,
    );

    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    try {
      if (isProject) {
        await _api.dio.patch(
          '/projects/${lead['projectId']}/leads/${lead['_id']}',
          data: {'followUp': dt.toUtc().toIso8601String()},
        );
      } else {
        await _api.dio.patch(
          '/leads/${lead['_id']}',
          data: {'followUpDate': dt.toUtc().toIso8601String()},
        );
      }
      _load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Reschedule failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _markDone(Map<String, dynamic> lead) async {
    final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
    final field = isProject ? 'followUp' : 'followUpDate';
    try {
      if (isProject) {
        await _api.dio.patch(
          '/projects/${lead['projectId']}/leads/${lead['_id']}',
          data: {field: null, 'followUp2': null},
        );
      } else {
        await _api.dio.patch(
          '/leads/${lead['_id']}',
          data: {field: null, 'followUp2': null},
        );
      }
      setState(() {
        _leads.remove(lead);
        _total -= 1;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Follow-up marked as done')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to mark done')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '—';
    return DateFormat('dd MMM, hh:mm a').format(dt);
  }

  Future<void> _openDetail(Map<String, dynamic> lead) async {
    final result = await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => LeadDetailSheet(
        lead: lead,
        projects: const [],
        onUpdated: (updated) {
          final index = _leads.indexWhere(
            (item) => item['_id'] == updated['_id'],
          );
          if (index != -1 && mounted) setState(() => _leads[index] = updated);
        },
      ),
    );
    if (result == true) _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Column(
      children: [
        PageHeader(
          title: 'Follow-ups',
          subtitle: '$_total scheduled conversations',
          icon: Icons.event_repeat_rounded,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: SegmentedButton<String>(
            segments: _sections
                .map(
                  (s) => ButtonSegment(
                    value: s.$1,
                    label: Text(s.$2, style: const TextStyle(fontSize: 12)),
                    icon: Icon(s.$3, size: 16),
                  ),
                )
                .toList(),
            selected: {_section},
            onSelectionChanged: (sel) {
              _section = sel.first;
              _sortDesc = _section == 'past';
              _load(reset: true);
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Search name, phone…',
                    prefixIcon: Icon(Icons.search, size: 20),
                    isDense: true,
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(reset: true),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              if (auth.isAdmin) ...[
                const Icon(Icons.person_outline, size: 18),
                const SizedBox(width: 4),
                const Text('My Leads'),
                Switch.adaptive(
                  value: _myOnly,
                  onChanged: (value) {
                    setState(() => _myOnly = value);
                    _load(reset: true);
                  },
                ),
              ],
              const Spacer(),
              SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(
                    value: true,
                    icon: Icon(Icons.arrow_downward, size: 15),
                    label: Text('Latest', style: TextStyle(fontSize: 11)),
                  ),
                  ButtonSegment(
                    value: false,
                    icon: Icon(Icons.arrow_upward, size: 15),
                    label: Text('Earliest', style: TextStyle(fontSize: 11)),
                  ),
                ],
                selected: {_sortDesc},
                onSelectionChanged: (value) {
                  setState(() => _sortDesc = value.first);
                  _load(reset: true);
                },
              ),
            ],
          ),
        ),
        if (_section == 'future')
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 2, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: _dateFilter(
                    'From',
                    _from,
                    () => _pickRangeDate(from: true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _dateFilter(
                    'To',
                    _to,
                    () => _pickRangeDate(from: false),
                  ),
                ),
                if (_from != null || _to != null)
                  IconButton(
                    tooltip: 'Clear date range',
                    onPressed: () {
                      setState(() {
                        _from = null;
                        _to = null;
                      });
                      _load(reset: true);
                    },
                    icon: const Icon(Icons.close),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '$_total follow-ups',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ),
        Expanded(
          child: _loading && _leads.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : _leads.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.event_repeat_rounded, size: 40, color: AppColors.primary.withValues(alpha: 0.3)),
                      const SizedBox(height: 8),
                      const Text('No follow-ups here', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(
                        'Nothing to show for this section right now.',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => _load(reset: true),
                  child: ListView.builder(
                    controller: _scroll,
                    itemCount: _leads.length,
                    itemBuilder: (context, i) {
                      final lead = _leads[i];
                      final followUp = lead['followUpDate'] ?? lead['followUp'];
                      return Card(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        child: ListTile(
                          onTap: () => _openDetail(lead),
                          title: Text(
                            lead['name'] as String? ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_fmtDate(followUp as String?)),
                              if ((lead['projectName'] as String? ?? '').isNotEmpty)
                                Text(
                                  lead['projectName'] as String,
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w600),
                                ),
                              if ((lead['assignedToName'] as String? ?? '').isNotEmpty)
                                Text(
                                  'Assigned to ${lead['assignedToName']}',
                                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                ),
                              if ((lead['remark'] as String? ?? lead['remark1'] as String? ?? '').isNotEmpty)
                                Text(
                                  (lead['remark'] ?? lead['remark1']) as String,
                                  style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Wrap(
                                  spacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    if ((lead['source'] as String? ?? '').isNotEmpty)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.blueGrey.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          lead['source'] as String,
                                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.blueGrey),
                                        ),
                                      ),
                                    if ((lead['booking'] as String? ?? '').isNotEmpty)
                                      BookingChip(lead['booking'] as String?),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          isThreeLine: true,
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: Icon(
                                  FontAwesomeIcons.phone.data,
                                  size: 20,
                                  color: AppColors.primary,
                                ),
                                onPressed: () {
                                  final p = lead['phone'] as String?;
                                  if (p != null) launchUrl(Uri.parse('tel:$p'));
                                },
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.edit_calendar,
                                  size: 20,
                                  color: AppColors.info,
                                ),
                                onPressed: () => _reschedule(lead),
                              ),
                              IconButton(
                                tooltip: 'Mark done',
                                icon: const Icon(
                                  Icons.check_circle_outline,
                                  size: 20,
                                  color: AppColors.success,
                                ),
                                onPressed: () => _markDone(lead),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _dateFilter(String label, DateTime? value, VoidCallback onTap) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.calendar_month, size: 17),
      label: Text(
        value == null ? label : DateFormat('dd MMM yyyy').format(value),
      ),
    );
  }
}
