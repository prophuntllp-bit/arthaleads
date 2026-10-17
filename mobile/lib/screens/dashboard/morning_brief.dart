import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api_client.dart';
import '../../core/deep_link.dart';
import '../../core/push_service.dart';
import '../../core/theme.dart';
import '../../widgets/whatsapp_send_sheet.dart';
import '../artha/artha_sheet.dart';
import '../artha/change_card.dart';

/// Artha's morning brief at the top of the Dashboard (Phase 4 design,
/// screen 5). Mirrors frontend/src/components/dashboard/MorningBrief.jsx:
/// GET /copilot/brief, worked out by the server from follow-ups, site visits,
/// unread chats and new leads, no AI call. `brief: null` means this company
/// does not get one, and the card is not shown.
///
/// The last brief is kept on the phone per person, so the card shows at once
/// and still shows (marked as saved) when the network is poor.
class MorningBrief extends StatefulWidget {
  final String userId;

  /// Ticks when the Dashboard is pulled to refresh.
  final Listenable refresh;
  final void Function(String label) onNavigate;
  final Future<void> Function({required String? phone, String? name, String? leadId}) onCall;

  const MorningBrief({
    super.key,
    required this.userId,
    required this.refresh,
    required this.onNavigate,
    required this.onCall,
  });

  @override
  State<MorningBrief> createState() => _MorningBriefState();
}

class _MorningBriefState extends State<MorningBrief> {
  Map<String, dynamic>? _brief;
  DateTime? _savedAt;
  bool _loading = true;
  bool _stale = false; // showing the saved copy because the refresh failed
  bool _collapsed = false;

  /// On a phone the lists are cut short (the web shows them in two columns);
  /// "Show all" opens the rest in place.
  static const _risksShown = 3;
  static const _itemsShown = 4;
  bool _allRisks = false;
  bool _allItems = false;

  String get _cacheKey => 'artha_brief_${widget.userId}';

  @override
  void initState() {
    super.initState();
    widget.refresh.addListener(_onRefresh);
    ArthaEvents.changed.addListener(_load);
    _restore().then((_) => _load());
  }

  @override
  void dispose() {
    widget.refresh.removeListener(_onRefresh);
    ArthaEvents.changed.removeListener(_load);
    super.dispose();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null) return;
      final saved = jsonDecode(raw) as Map<String, dynamic>;
      final brief = (saved['brief'] as Map?)?.cast<String, dynamic>();
      if (brief == null || !mounted) return;
      setState(() {
        _brief = brief;
        _savedAt = DateTime.tryParse('${saved['at']}');
        _collapsed = prefs.getBool('${_cacheKey}_hidden_${brief['date']}') ?? false;
      });
    } catch (_) {}
  }

  /// The Dashboard reloads itself every minute; the brief is a heavier ask
  /// for the server and changes slowly, so it follows at most every 2
  /// minutes (Artha changing something reloads it at once).
  DateTime? _lastAsked;
  void _onRefresh() {
    final last = _lastAsked;
    if (last == null || DateTime.now().difference(last) > const Duration(minutes: 2)) _load();
  }

  Future<void> _load() async {
    _lastAsked = DateTime.now();
    try {
      final res = await ApiClient.instance.dio.get('/copilot/brief');
      final brief = (res.data['brief'] as Map?)?.cast<String, dynamic>();
      final prefs = await SharedPreferences.getInstance();
      if (brief == null) {
        await prefs.remove(_cacheKey);
      } else {
        await prefs.setString(_cacheKey, jsonEncode({'brief': brief, 'at': DateTime.now().toIso8601String()}));
      }
      if (!mounted) return;
      setState(() {
        _brief = brief;
        _savedAt = DateTime.now();
        _stale = false;
        _loading = false;
        if (brief != null) _collapsed = prefs.getBool('${_cacheKey}_hidden_${brief['date']}') ?? false;
      });
    } catch (e) {
      debugPrint('[brief] could not load: $e');
      if (mounted) {
        setState(() {
          _loading = false;
          _stale = _brief != null;
        });
      }
    }
  }

  Future<void> _toggle() async {
    final next = !_collapsed;
    setState(() => _collapsed = next);
    try {
      (await SharedPreferences.getInstance()).setBool('${_cacheKey}_hidden_${_brief?['date']}', next);
    } catch (_) {}
  }

  // ── Opening what a row points at ─────────────────────────────────────────

  void _open(Map<String, dynamic> it) {
    final kind = it['kind'];
    final convo = '${it['conversationId'] ?? ''}';
    if (kind == 'summary') {
      widget.onNavigate('Leads');
    } else if ((it['tag'] == 'chat' || it['type'] == 'chat_closing' || kind == 'chat') && convo.isNotEmpty) {
      PushService.instance.pendingTarget.value = {'conversationId': convo};
    } else if (kind == 'projectLead' && '${it['projectId'] ?? ''}'.isNotEmpty) {
      PushService.instance.pendingRoute.value = '/projects/${it['projectId']}';
    } else {
      DeepLink.openLeadId.value = '${it['id']}';
      widget.onNavigate('Leads');
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  static const _tags = {
    'visit': (label: 'Site visit', icon: Icons.event_available_rounded, color: Color(0xFF16A34A)),
    'chat': (label: 'WhatsApp', icon: Icons.chat_bubble_outline_rounded, color: Color(0xFF16A34A)),
    'overdue': (label: 'Missed', icon: Icons.alarm_rounded, color: Color(0xFFDC2626)),
    'new': (label: 'New lead', icon: Icons.auto_awesome_rounded, color: Color(0xFFEA580C)),
    'today': (label: 'Due today', icon: Icons.schedule_rounded, color: Color(0xFF2563EB)),
  };

  static const _risks = {
    'chat_closing': (label: 'Reply window closing', icon: Icons.hourglass_bottom_rounded),
    'unassigned_waiting': (label: 'No owner', icon: Icons.person_off_outlined),
    'visit_missed': (label: 'Visit not updated', icon: Icons.event_busy_rounded),
    'hot_cold': (label: 'Hot lead gone quiet', icon: Icons.local_fire_department_outlined),
    'visit_silent': (label: 'No follow-up after visit', icon: Icons.event_available_rounded),
    'new_waiting': (label: 'New lead waiting', icon: Icons.alarm_rounded),
  };

  static const _counts = [
    ('visits', 'site visits today'),
    ('chats', 'unread chats'),
    ('overdue', 'missed follow-ups'),
    ('today', 'due today'),
    ('fresh', 'new, not contacted'),
  ];

  static List<Map<String, dynamic>> _maps(dynamic v) =>
      v is List ? [for (final x in v) if (x is Map) x.cast<String, dynamic>()] : [];

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final brief = _brief;
    if (brief == null) return _loading ? _placeholder(t) : const SizedBox.shrink();

    final items = _maps(brief['items']);
    final risks = _maps((brief['risks'] as Map?)?['list']);
    final team = _maps(brief['team']);
    final counts = (brief['counts'] as Map?) ?? const {};
    final shownCounts = _counts.where((c) => ((counts[c.$1] as num?) ?? 0) > 0).toList();
    final nothing = items.isEmpty && risks.isEmpty && team.isEmpty;
    final more = (brief['more'] as num?)?.toInt() ?? 0;
    final riskTotal = ((brief['risks'] as Map?)?['total'] as num?)?.toInt() ?? risks.length;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: t.border),
        boxShadow: t.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('ARTHA · ${_dateLabel('${brief['date']}').toUpperCase()}', style: AppText.kicker(context)),
                const SizedBox(height: 4),
                Text(nothing ? 'Nothing urgent today' : 'Your day: who to call first',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: t.text, height: 1.25)),
                if (shownCounts.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text.rich(
                    TextSpan(children: [
                      for (var i = 0; i < shownCounts.length; i++) ...[
                        if (i > 0) const TextSpan(text: ' · '),
                        TextSpan(
                          text: '${counts[shownCounts[i].$1]}',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, color: shownCounts[i].$1 == 'overdue' ? AppColors.danger : t.text),
                        ),
                        TextSpan(text: ' ${shownCounts[i].$2}'),
                      ],
                    ]),
                    style: TextStyle(fontSize: 12, height: 1.45, color: t.textSoft),
                  ),
                ],
              ]),
            ),
            if (!nothing)
              IconButton(
                tooltip: _collapsed ? 'Show the list' : 'Hide the list',
                onPressed: _toggle,
                icon: Icon(_collapsed ? Icons.expand_more_rounded : Icons.expand_less_rounded, color: t.textSoft),
              ),
          ]),
          if (!_collapsed) ...[
            if (risks.isNotEmpty) ...[
              const SizedBox(height: 12),
              _riskPanel(t, risks, riskTotal),
            ],
            if (items.isNotEmpty) ...[
              const SizedBox(height: 10),
              for (final it in _allItems ? items : items.take(_itemsShown))
                _row(context, t, it, tag: _tags[it['tag']] ?? _tags['today']!),
              if (!_allItems && items.length > _itemsShown)
                _showAll(t, items.length, () => setState(() => _allItems = true)),
            ],
            if (!nothing) ...[
              const SizedBox(height: 6),
              Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                OutlinedButton.icon(
                  onPressed: () => showArthaSheet(context, navLabel: 'Dashboard', ask: 'Who should I call first today?'),
                  icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                  label: const Text('Plan my day with Artha'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.08),
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.30)),
                    minimumSize: const Size(0, 44),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
                if (more > 0)
                  TextButton(
                    onPressed: () => widget.onNavigate('Follow-ups'),
                    child: Text('$more more in Follow-ups',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, color: t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C))),
                  ),
              ]),
            ],
            if (team.isNotEmpty) ...[
              const SizedBox(height: 12),
              _teamTable(t, team),
            ],
          ],
          const SizedBox(height: 8),
          Text(
            _stale
                ? 'Saved ${_when(_savedAt)} · could not refresh, pull down to try again'
                : 'Updated ${_when(_savedAt)}',
            style: TextStyle(fontSize: 11, color: _stale ? AppColors.warning : t.textSoft),
          ),
        ],
      ),
    );
  }

  Widget _placeholder(AppTheme t) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        height: 120,
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: t.border),
        ),
      );

  Widget _riskPanel(AppTheme t, List<Map<String, dynamic>> risks, int total) => Container(
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.20)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFDC2626)),
            const SizedBox(width: 6),
            Flexible(
              child: Text.rich(
                TextSpan(children: [
                  const TextSpan(text: 'Needs attention', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFDC2626))),
                  TextSpan(
                    text: ' · $total ${total == 1 ? 'deal' : 'deals'} slipping${total > risks.length ? ', top ${risks.length} shown' : ''}',
                    style: TextStyle(color: t.textSoft, fontWeight: FontWeight.w500),
                  ),
                ]),
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          for (final r in _allRisks ? risks : risks.take(_risksShown))
            _row(context, t, r,
                tag: (
                  label: (_risks[r['type']] ?? _risks['hot_cold']!).label,
                  icon: (_risks[r['type']] ?? _risks['hot_cold']!).icon,
                  color: const Color(0xFFDC2626),
                ),
                solid: true),
          if (!_allRisks && risks.length > _risksShown)
            _showAll(t, risks.length, () => setState(() => _allRisks = true)),
        ]),
      );

  Widget _showAll(AppTheme t, int n, VoidCallback onTap) => Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: onTap,
          child: Text('Show all $n',
              style: TextStyle(fontWeight: FontWeight.w600, color: t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C))),
        ),
      );

  Widget _row(BuildContext context, AppTheme t, Map<String, dynamic> it,
      {required ({String label, IconData icon, Color color}) tag, bool solid = false}) {
    final name = '${it['name'] ?? ''}';
    final phone = '${it['phone'] ?? ''}';
    final project = '${it['projectName'] ?? ''}';
    final owner = '${it['owner'] ?? ''}';
    final isChat = it['tag'] == 'chat' || it['kind'] == 'chat';
    final canDial = phone.isNotEmpty && it['kind'] != 'summary' && !isChat;
    final waColor = t.isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: solid ? t.surfaceSolid : t.surfaceLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: t.border)),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _open(it),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 2, 6),
            child: Row(children: [
              Tooltip(
                message: tag.label,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(color: tag.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                  child: Icon(tag.icon, size: 16, color: tag.color),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: name, style: TextStyle(fontWeight: FontWeight.w600, color: t.text)),
                      if (project.isNotEmpty) TextSpan(text: ' · $project', style: TextStyle(color: t.textSoft)),
                      if (owner.isNotEmpty) TextSpan(text: ' · $owner', style: TextStyle(color: t.textSoft)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14),
                  ),
                  Text('${it['reason'] ?? tag.label}',
                      maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.textSoft)),
                ]),
              ),
              if (canDial)
                IconButton(
                  tooltip: 'Call $name',
                  onPressed: () => widget.onCall(phone: phone, name: name, leadId: it['kind'] == 'lead' ? '${it['id']}' : null),
                  icon: const Icon(Icons.call_rounded, size: 20, color: AppColors.primary),
                ),
              if (isChat || canDial)
                IconButton(
                  tooltip: isChat ? 'Open the chat' : 'WhatsApp $name',
                  onPressed: isChat
                      ? () => _open(it)
                      : () => showWhatsAppSendSheet(
                            context,
                            phone: phone,
                            name: name,
                            leadId: '${it['id']}',
                            projectId: it['kind'] == 'projectLead' ? '${it['projectId'] ?? ''}' : null,
                          ),
                  icon: FaIcon(FontAwesomeIcons.whatsapp, size: 19, color: waColor),
                ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _teamTable(AppTheme t, List<Map<String, dynamic>> team) {
    TextStyle head = TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.textSoft);
    Widget cell(dynamic v, {Color? color, bool bold = false}) => SizedBox(
          width: 46,
          child: Text('${v ?? 0}',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 13,
                color: ((v as num?) ?? 0) > 0 && color != null ? color : t.text,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
                fontFeatures: const [FontFeature.tabularFigures()],
              )),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(Icons.groups_2_outlined, size: 15, color: t.textSoft),
        const SizedBox(width: 6),
        Text('TEAM TODAY', style: AppText.kicker(context)),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: Text('Person', style: head)),
        for (final h in ['At risk', 'Missed', 'New', 'Today', 'Visits'])
          SizedBox(width: 46, child: Text(h, textAlign: TextAlign.right, style: head)),
      ]),
      for (final r in team)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Row(children: [
            Expanded(
              child: Text('${r['name'] ?? ''}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.text)),
            ),
            cell(r['atRisk'], color: AppColors.danger, bold: true),
            cell(r['overdue'], color: AppColors.danger),
            cell(r['fresh'], color: const Color(0xFFEA580C)),
            cell(r['today']),
            cell(r['visits']),
          ]),
        ),
    ]);
  }

  static String _dateLabel(String ymd) {
    final d = DateTime.tryParse(ymd);
    if (d == null) return 'Today';
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }

  /// "9:05 am" today, "Thu 15 Oct, 6:40 pm" otherwise, in IST.
  static String _when(DateTime? at) {
    if (at == null) return 'just now';
    final ist = at.toUtc().add(const Duration(hours: 5, minutes: 30));
    final now = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
    final h = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    final time = '$h:${ist.minute.toString().padLeft(2, '0')} ${ist.hour < 12 ? 'am' : 'pm'}';
    if (ist.year == now.year && ist.month == now.month && ist.day == now.day) return time;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[ist.weekday - 1]} ${ist.day} ${months[ist.month - 1]}, $time';
  }
}
