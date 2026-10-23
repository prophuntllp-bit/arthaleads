import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/card_skeleton.dart';
import '../../widgets/call_options_sheet.dart';
import '../../widgets/chips.dart';
import '../../widgets/whatsapp_send_sheet.dart';
import '../leads/lead_detail_sheet.dart';

/// Follow-ups — GET /followups?section=past|present|future.
/// Mirrors frontend/src/pages/FollowUps.jsx (Past / Today / Future tabs).
///
/// Redesigned 23 Oct 2026 (owner: "doesn't match our other screens, the
/// buttons are not proper"): the three sections are count tiles like the home
/// screen's Today's priorities (Overdue / Today / Upcoming), search and a
/// filter button like Leads, and cards with a coloured due line and labelled
/// actions (Call, WhatsApp, Later, Done with Undo).
class FollowUpsScreen extends StatefulWidget {
  const FollowUpsScreen({super.key});

  @override
  State<FollowUpsScreen> createState() => _FollowUpsScreenState();
}

class _Section {
  final String key, label, empty, emptySub;
  final IconData icon;
  final Color color;
  const _Section(this.key, this.label, this.icon, this.color, this.empty, this.emptySub);
}

const _sections = [
  _Section('past', 'Overdue', Icons.alarm_rounded, AppColors.danger, 'Nothing overdue', 'Every follow-up that was due has been handled.'),
  _Section('present', 'Today', Icons.today_rounded, Color(0xFFD97706), 'Nothing due today', 'Follow-ups set for today show up here.'),
  _Section('future', 'Upcoming', Icons.event_rounded, Color(0xFF2563EB), 'Nothing planned ahead', 'Set a follow-up on a lead and it appears here.'),
];

class _FollowUpsScreenState extends State<FollowUpsScreen> {
  final _api = ApiClient.instance;

  Future<void> _call(Map<String, dynamic> lead) async {
    final phone = lead['phone'] as String?;
    if (phone == null || phone.isEmpty) return;
    final choice = await pickCallMethod(context, name: lead['name'] as String?, phone: phone);
    if (!mounted || choice == null) return;
    if (choice == 'native') {
      await launchUrl(Uri.parse('tel:$phone'));
      return;
    }
    try {
      final res = await _api.dio.post('/calls/initiate', data: callTargetPayload(lead));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] as String? ?? 'Call initiated — check your phone.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Call failed. Check EnableX settings.')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  String _section = 'present';
  final List<Map<String, dynamic>> _leads = [];
  final Map<String, int> _counts = {};
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

  _Section get _current => _sections.firstWhere((s) => s.key == _section);
  int get _activeFilters => (_myOnly ? 1 : 0) + (_from != null || _to != null ? 1 : 0);

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 && !_loading && _page < _pages) {
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

  Map<String, dynamic> _params(String section) => {
        'section': section,
        'sort': _sortDesc ? 'desc' : 'asc',
        if (_myOnly) 'myOnly': 'true',
        if (section == 'future' && _from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
        if (section == 'future' && _to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
        if (_searchCtrl.text.trim().isNotEmpty) 'search': _searchCtrl.text.trim(),
      };

  Future<void> _load({bool reset = false}) async {
    final generation = reset ? ++_loadGeneration : _loadGeneration;
    if (reset) {
      _page = 1;
      _leads.clear();
      _loadCounts(generation);
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/followups', queryParameters: {..._params(_section), 'page': _page, 'limit': 50});
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _leads.addAll((res.data['leads'] as List? ?? []).cast<Map<String, dynamic>>());
        _total = res.data['total'] as int? ?? 0;
        _pages = res.data['pages'] as int? ?? 1;
        _counts[_section] = _total;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to load follow-ups')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// The count on each tile: one tiny request per section (the list API has
  /// no per-section totals), with the same search and filters.
  Future<void> _loadCounts(int generation) async {
    await Future.wait([
      for (final s in _sections)
        _api.dio.get('/followups', queryParameters: {..._params(s.key), 'page': 1, 'limit': 1}).then((r) {
          if (!mounted || generation != _loadGeneration) return;
          setState(() => _counts[s.key] = r.data['total'] as int? ?? 0);
        }).catchError((_) {}),
    ]);
  }

  // ── Changing a follow-up ─────────────────────────────────────────────────

  bool _isProject(Map<String, dynamic> lead) => lead['_type'] == 'project' && lead['projectId'] != null;

  Future<void> _patch(Map<String, dynamic> lead, Map<String, dynamic> data) => _isProject(lead)
      ? _api.dio.patch('/projects/${lead['projectId']}/leads/${lead['_id']}', data: data)
      : _api.dio.patch('/leads/${lead['_id']}', data: data);

  Future<void> _setDate(Map<String, dynamic> lead, DateTime dt) async {
    final field = _isProject(lead) ? 'followUp' : 'followUpDate';
    try {
      await _patch(lead, {field: dt.toUtc().toIso8601String()});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Moved to ${DateFormat('EEE d MMM, h:mm a').format(dt)}'),
      ));
      _load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Reschedule failed')), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  /// "Later": the usual choices one tap away, or any date and time.
  Future<void> _later(Map<String, dynamic> lead) async {
    final now = DateTime.now();
    DateTime at(int days, [int hour = 11]) => DateTime(now.year, now.month, now.day + days, hour);
    final options = [
      if (now.hour < 17) ('This evening, 6 PM', DateTime(now.year, now.month, now.day, 18)),
      ('Tomorrow, 11 AM', at(1)),
      ('In 3 days, 11 AM', at(3)),
      ('Next week, 11 AM', at(7)),
    ];
    final picked = await showModalBottomSheet<Object>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        final t = AppTheme.of(ctx);
        return SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('Follow up with ${lead['name'] ?? 'this lead'}…',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: t.text)),
            ),
            for (final (label, dt) in options)
              ListTile(
                leading: const Icon(Icons.schedule_rounded, color: AppColors.primary),
                title: Text(label),
                subtitle: Text(DateFormat('EEE d MMM').format(dt)),
                onTap: () => Navigator.pop(ctx, dt),
              ),
            ListTile(
              leading: const Icon(Icons.edit_calendar_rounded, color: AppColors.primary),
              title: const Text('Pick a date and time'),
              onTap: () => Navigator.pop(ctx, 'pick'),
            ),
            const SizedBox(height: 8),
          ]),
        );
      },
    );
    if (!mounted || picked == null) return;
    if (picked is DateTime) return _setDate(lead, picked);
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 11, minute: 0));
    await _setDate(lead, DateTime(date.year, date.month, date.day, time?.hour ?? 11, time?.minute ?? 0));
  }

  /// Done clears the follow-up; Undo on the note puts it back as it was.
  Future<void> _markDone(Map<String, dynamic> lead) async {
    final field = _isProject(lead) ? 'followUp' : 'followUpDate';
    final before = {field: lead[field], 'followUp2': lead['followUp2']};
    final index = _leads.indexOf(lead);
    try {
      await _patch(lead, {field: null, 'followUp2': null});
      if (!mounted) return;
      setState(() {
        _leads.remove(lead);
        _total -= 1;
        _counts[_section] = _total;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${lead['name'] ?? 'Follow-up'} done'),
        duration: const Duration(seconds: 5),
        persist: false,
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () async {
            try {
              await _patch(lead, before);
              if (!mounted) return;
              setState(() {
                _leads.insert(index.clamp(0, _leads.length), lead);
                _total += 1;
                _counts[_section] = _total;
              });
            } catch (_) {}
          },
        ),
      ));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to mark done')), backgroundColor: AppColors.danger),
        );
      }
    }
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
          final index = _leads.indexWhere((item) => item['_id'] == updated['_id']);
          if (index != -1 && mounted) setState(() => _leads[index] = updated);
        },
      ),
    );
    if (result == true) _load(reset: true);
  }

  Future<void> _openFilters(bool isAdmin) async {
    var myOnly = _myOnly, sortDesc = _sortDesc;
    DateTime? from = _from, to = _to;
    final apply = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        final t = AppTheme.of(ctx);
        final df = DateFormat('d MMM yyyy');
        Future<void> pick(bool isFrom) async {
          final d = await showDatePicker(
            context: ctx,
            initialDate: (isFrom ? from : to) ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now().add(const Duration(days: 3650)),
          );
          if (d == null) return;
          setSheet(() {
            if (isFrom) {
              from = d;
              if (to != null && to!.isBefore(d)) to = d;
            } else {
              to = d;
              if (from != null && from!.isAfter(d)) from = d;
            }
          });
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Filters', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text)),
              const SizedBox(height: 12),
              if (isAdmin)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Only my leads'),
                  subtitle: const Text('Hide follow-ups assigned to others'),
                  value: myOnly,
                  onChanged: (v) => setSheet(() => myOnly = v),
                ),
              Text('Order', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                ChoiceChip(label: const Text('Soonest first'), selected: !sortDesc, showCheckmark: false, onSelected: (_) => setSheet(() => sortDesc = false)),
                ChoiceChip(label: const Text('Latest first'), selected: sortDesc, showCheckmark: false, onSelected: (_) => setSheet(() => sortDesc = true)),
              ]),
              if (_section == 'future') ...[
                const SizedBox(height: 16),
                Text('Upcoming between', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => pick(true),
                      icon: const Icon(Icons.calendar_month_rounded, size: 17),
                      label: Text(from == null ? 'From' : df.format(from!)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => pick(false),
                      icon: const Icon(Icons.calendar_month_rounded, size: 17),
                      label: Text(to == null ? 'To' : df.format(to!)),
                    ),
                  ),
                ]),
              ],
              const SizedBox(height: 20),
              Row(children: [
                TextButton(
                  onPressed: () => setSheet(() {
                    myOnly = false;
                    sortDesc = _section == 'past';
                    from = null;
                    to = null;
                  }),
                  child: const Text('Reset'),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: FilledButton.styleFrom(minimumSize: const Size(120, 46)),
                  child: const Text('Apply'),
                ),
              ]),
            ]),
          ),
        );
      }),
    );
    if (apply != true) return;
    setState(() {
      _myOnly = myOnly;
      _sortDesc = sortDesc;
      _from = from;
      _to = to;
    });
    _load(reset: true);
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final t = AppTheme.of(context);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Follow-ups', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                Text('Calls and site visits you have planned', maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
          ]),
        ),
        // The three sections as count tiles, like the home screen.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: Row(children: [
            for (final (i, s) in _sections.indexed) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(child: _sectionTile(t, s)),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _searchCtrl,
                decoration: const InputDecoration(hintText: 'Search name, phone…', prefixIcon: Icon(Icons.search, size: 20), isDense: true),
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _load(reset: true),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              tooltip: 'Filters',
              onPressed: () => _openFilters(auth.isAdmin),
              icon: Badge(
                isLabelVisible: _activeFilters > 0,
                label: Text('$_activeFilters'),
                child: const Icon(Icons.filter_list),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 2, 16, 2),
          child: Row(children: [
            Text(plural(_total, 'follow-up'), style: Theme.of(context).textTheme.bodySmall),
            Text(_sortDesc ? ' · latest first' : ' · soonest first', style: Theme.of(context).textTheme.bodySmall),
            if (_myOnly) Text(' · only mine', style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
        Expanded(
          child: _loading && _leads.isEmpty
              // Guarded on _leads.isEmpty, so a refresh with rows already on
              // screen keeps them rather than flashing back to placeholders.
              ? CardsSkeleton(padding: const EdgeInsets.only(top: 4), itemBuilder: (_, i) => _card(t, SampleData.lead(i)))
              : _leads.isEmpty
                  ? _empty(t)
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () => _load(reset: true),
                      child: ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.only(top: 4, bottom: 24),
                        itemCount: _leads.length,
                        itemBuilder: (context, i) => _card(t, _leads[i]),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _sectionTile(AppTheme t, _Section s) {
    final on = s.key == _section;
    final n = _counts[s.key];
    return Material(
      color: on ? s.color.withValues(alpha: t.isDark ? 0.18 : 0.09) : t.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: on ? s.color.withValues(alpha: 0.55) : t.border, width: on ? 1.4 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: on
            ? null
            : () {
                setState(() {
                  _section = s.key;
                  _sortDesc = s.key == 'past';
                });
                _load(reset: true);
              },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 9, 8, 9),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(s.icon, size: 17, color: on ? s.color : t.textSoft),
              const SizedBox(width: 5),
              Text(n == null ? '–' : '$n',
                  style: TextStyle(fontSize: 19, height: 1.1, fontWeight: FontWeight.w800, color: (n ?? 0) > 0 || on ? s.color : t.text)),
            ]),
            const SizedBox(height: 3),
            Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: on ? FontWeight.w700 : FontWeight.w600, color: t.text)),
          ]),
        ),
      ),
    );
  }

  Widget _empty(AppTheme t) {
    final s = _current;
    return ListView(
      // Scrollable so pull-to-refresh still works on an empty list.
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 90),
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: s.color.withValues(alpha: 0.10), shape: BoxShape.circle),
            child: Icon(s.key == 'past' ? Icons.check_circle_outline_rounded : s.icon, size: 30, color: s.color),
          ),
        ),
        const SizedBox(height: 12),
        Text(s.empty, textAlign: TextAlign.center, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: t.text)),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(s.emptySub, textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: t.textSoft)),
        ),
      ],
    );
  }

  /// "3 days late · 20 Oct, 10:35 AM", "Today, 4:00 PM", "Fri 24 Oct, 11:00 AM".
  ///
  /// The Overdue list also holds new leads from earlier days that nobody has
  /// contacted yet (no follow-up date; the server's "past" section): those
  /// say so, with the day they came in.
  (String, Color, IconData) _due(dynamic iso, {dynamic createdAt}) {
    final dt = DateTime.tryParse('${iso ?? ''}')?.toLocal();
    if (dt == null) {
      final added = DateTime.tryParse('${createdAt ?? ''}')?.toLocal();
      return (
        added == null ? 'Not contacted yet' : 'Not contacted yet · added ${DateFormat('d MMM').format(added)}',
        const Color(0xFFD97706),
        Icons.phone_missed_rounded,
      );
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(dt.year, dt.month, dt.day);
    final diff = day.difference(today).inDays;
    final time = DateFormat('h:mm a').format(dt);
    if (diff < 0) {
      final late = -diff;
      return ('${late == 1 ? '1 day' : '$late days'} late · ${DateFormat('d MMM').format(dt)}, $time', AppColors.danger, Icons.alarm_rounded);
    }
    if (diff == 0) {
      return (dt.isBefore(now) ? 'Today, $time · missed' : 'Today, $time', const Color(0xFFD97706), Icons.today_rounded);
    }
    if (diff == 1) return ('Tomorrow, $time', const Color(0xFF2563EB), Icons.event_rounded);
    return ('${DateFormat('EEE d MMM').format(dt)}, $time', const Color(0xFF2563EB), Icons.event_rounded);
  }

  Widget _card(AppTheme t, Map<String, dynamic> lead) {
    final (dueText, dueColor, dueIcon) = _due(lead['followUpDate'] ?? lead['followUp'], createdAt: lead['createdAt']);
    final note = '${lead['followUpNote'] ?? ''}'.trim().isNotEmpty
        ? '${lead['followUpNote']}'.trim()
        : '${lead['remark'] ?? lead['remark1'] ?? ''}'.trim();
    final assigned = '${lead['assignedToName'] ?? ''}'.trim();
    final project = '${lead['projectName'] ?? ''}'.trim();
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openDetail(lead),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(lead['name'] as String? ?? '—',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: t.text)),
              ),
              if ('${lead['status'] ?? ''}'.isNotEmpty) StatusChip(lead['status'] as String?),
              if ((lead['booking'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(width: 6),
                BookingChip(lead['booking'] as String?),
              ],
            ]),
            const SizedBox(height: 8),
            // When it is due, in the section's colour.
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(color: dueColor.withValues(alpha: t.isDark ? 0.18 : 0.09), borderRadius: BorderRadius.circular(10)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(dueIcon, size: 15, color: dueColor),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(dueText, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: dueColor)),
                ),
              ]),
            ),
            const SizedBox(height: 8),
            Wrap(spacing: 10, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              if ('${lead['source'] ?? ''}'.isNotEmpty) SourceChip(lead['source'] as String?),
              if (project.isNotEmpty)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.folder_rounded, size: 14, color: Color(0xFF8B5CF6)),
                  const SizedBox(width: 3),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 160),
                    child: Text(project, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w600)),
                  ),
                ]),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.person_rounded, size: 14, color: t.textSoft),
                const SizedBox(width: 3),
                Text(assigned.isEmpty ? 'Unassigned' : assigned,
                    style: TextStyle(fontSize: 12, color: assigned.isEmpty ? AppColors.warning : t.textSoft, fontWeight: assigned.isEmpty ? FontWeight.w600 : FontWeight.w400)),
              ]),
            ]),
            if (note.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.35, color: t.textSoft)),
            ],
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _action(t, FontAwesomeIcons.phone.data, 'Call', AppColors.success, () => _call(lead))),
              const SizedBox(width: 6),
              Expanded(
                child: _action(t, FontAwesomeIcons.whatsapp.data, 'WhatsApp', AppColors.whatsapp, () => showWhatsAppSendSheet(
                      context,
                      phone: lead['phone'] as String?,
                      name: lead['name'] as String?,
                      leadId: _isProject(lead) ? null : lead['_id'] as String?,
                      projectId: _isProject(lead) ? lead['projectId'] as String? : null,
                    )),
              ),
              const SizedBox(width: 6),
              Expanded(child: _action(t, Icons.update_rounded, 'Later', AppColors.primary, () => _later(lead))),
              const SizedBox(width: 6),
              Expanded(child: _action(t, Icons.check_rounded, 'Done', AppColors.success, () => _markDone(lead), filled: true)),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _action(AppTheme t, IconData icon, String label, Color color, VoidCallback onTap, {bool filled = false}) {
    final child = FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: filled ? Colors.white : color),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: filled ? Colors.white : t.text)),
      ]),
    );
    const shape = RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12)));
    return filled
        ? FilledButton(
            onPressed: onTap,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              shape: shape,
            ),
            child: child,
          )
        : OutlinedButton(
            onPressed: onTap,
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: t.border),
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              shape: shape,
            ),
            child: child,
          );
  }
}
