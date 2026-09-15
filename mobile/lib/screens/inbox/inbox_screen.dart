import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import '../automation/automation_screen.dart';
import 'conversation_screen.dart';
import 'wa_theme.dart';

const _filters = [
  {'value': 'all', 'label': 'All'},
  {'value': 'bot', 'label': 'Bot'},
  {'value': 'open', 'label': 'Open'},
  {'value': 'resolved', 'label': 'Done'},
];

// A linked lead's name is the live, editable source of truth; contactName is
// a snapshot taken when the WhatsApp thread was created and never updates
// again on its own. Mirrors frontend/src/pages/Inbox.jsx's displayName().
String _displayName(Map<String, dynamic> c) {
  final lead = c['leadId'];
  final leadName = lead is Map ? lead['name'] as String? : null;
  if (leadName != null && leadName.trim().isNotEmpty) return leadName;
  final contactName = c['contactName'] as String?;
  if (contactName != null && contactName.trim().isNotEmpty) return contactName;
  return c['contactPhone'] as String? ?? '—';
}

int? _leadScore(Map<String, dynamic> c) {
  final lead = c['leadId'];
  if (lead is! Map) return null;
  final score = lead['_score'];
  return score is num ? score.round() : int.tryParse('$score');
}

Color _scoreColor(int score) {
  if (score >= 80) return const Color(0xFFDC2626);
  if (score >= 60) return const Color(0xFFD97706);
  if (score >= 40) return const Color(0xFF2563EB);
  return const Color(0xFF6B7280);
}

/// WhatsApp Inbox — GET /whatsapp/conversations, live-polled every 4s.
/// Mirrors frontend/src/pages/Inbox.jsx conversation list.
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  final _api = ApiClient.instance;
  final List<Map<String, dynamic>> _conversations = [];
  bool _loading = true;
  bool? _connected;
  int _page = 1;
  int _pages = 1;
  String _filter = 'all';
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();
  Timer? _poll;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _checkConnected();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading &&
          _page < _pages) {
        _page += 1;
        _load();
      }
    });
    _poll = Timer.periodic(
      const Duration(seconds: 4),
      (_) => _load(reset: true, silent: true),
    );
    _searchCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _searchDebounce?.cancel();
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _load(reset: true);
    });
  }

  Future<void> _checkConnected() async {
    try {
      final res = await _api.dio.get('/whatsapp/settings');
      if (mounted) setState(() => _connected = res.data['connected'] == true);
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  Future<void> _load({bool reset = false, bool silent = false}) async {
    if (reset) _page = 1;
    if (!silent) setState(() => _loading = true);
    try {
      final params = <String, dynamic>{'page': _page, 'limit': 30};
      if (_filter != 'all') params['status'] = _filter;
      final query = _searchCtrl.text.trim();
      if (query.isNotEmpty) params['search'] = query;
      final res = await _api.dio.get(
        '/whatsapp/conversations',
        queryParameters: params,
      );
      final total = res.data['total'] as int? ?? 0;
      final fresh = (res.data['conversations'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        if (reset) {
          _conversations
            ..clear()
            ..addAll(fresh);
        } else {
          _conversations.addAll(fresh);
        }
        _pages = (total / 30).ceil().clamp(1, 999999);
      });
    } catch (e) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load conversations'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmtTime(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '';
    final now = DateTime.now();
    if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
      return DateFormat('hh:mm a').format(dt);
    }
    return DateFormat('dd MMM').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    if (_connected == false) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.whatsapp.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  Icons.wechat,
                  size: 32,
                  color: AppColors.whatsapp,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'WhatsApp not connected',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              const SizedBox(height: 6),
              const Text(
                'Connect your number to start receiving and sending messages here.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 18),
              GradientButton(
                icon: Icons.link_rounded,
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => Scaffold(
                        appBar: AppBar(title: const Text('Integrations')),
                        body: const AutomationScreen(),
                      ),
                    ),
                  );
                  _checkConnected();
                },
                child: const Text('Connect WhatsApp'),
              ),
            ],
          ),
        ),
      );
    }

    final wa = WaTheme.of(context);

    return ColoredBox(
      color: wa.listBg,
      child: Column(
        children: [
          // ── Search — WhatsApp's rounded search pill ──
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Container(
              decoration: BoxDecoration(
                color: wa.searchPillBg,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _searchCtrl,
                onChanged: _onSearchChanged,
                style: TextStyle(
                  color: wa.isDark ? Colors.white : Colors.black87,
                  fontSize: 14,
                ),
                decoration: InputDecoration(
                  hintText: 'Search by name or phone…',
                  hintStyle: TextStyle(color: wa.searchPillFg, fontSize: 14),
                  prefixIcon: Icon(
                    Icons.search,
                    size: 20,
                    color: wa.searchPillFg,
                  ),
                  isDense: true,
                  filled: true,
                  fillColor: Colors.transparent,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  suffixIcon: _searchCtrl.text.isEmpty
                      ? null
                      : IconButton(
                          icon: Icon(
                            Icons.close,
                            size: 18,
                            color: wa.searchPillFg,
                          ),
                          onPressed: () {
                            _searchCtrl.clear();
                            _onSearchChanged('');
                          },
                        ),
                ),
                onTapOutside: (_) => FocusScope.of(context).unfocus(),
              ),
            ),
          ),
          // ── Filter chips — WhatsApp's rounded pill tabs ──
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: _filters.map((f) {
                final selected = _filter == f['value'];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _filter = f['value']!);
                      _load(reset: true);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: selected ? wa.chipSelectedBg : wa.chipBg,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        f['label']!,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: selected ? Colors.white : wa.chipFg,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: _loading && _conversations.isEmpty
                ? const Center(child: AppSpinner(size: 32))
                : _conversations.isEmpty
                ? const Center(child: Text('No conversations yet'))
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => _load(reset: true),
                    child: ListView.separated(
                      controller: _scroll,
                      itemCount: _conversations.length,
                      separatorBuilder: (_, _) => Padding(
                        padding: const EdgeInsets.only(left: 82),
                        child: Divider(
                          height: 1,
                          thickness: 0.5,
                          color: wa.divider,
                        ),
                      ),
                      itemBuilder: (context, i) {
                        final c = _conversations[i];
                        final unread = (c['unreadCount'] as num?)?.toInt() ?? 0;
                        final contactName = _displayName(c);
                        final score = _leadScore(c);
                        final botEnabled = c['botEnabled'] == true;
                        final assignedTo = c['assignedTo'];
                        final assignedName = assignedTo is Map
                            ? assignedTo['name'] as String?
                            : null;
                        return FadeSlideIn(
                          delay: Duration(milliseconds: 15 * (i % 15)),
                          child: InkWell(
                            onTap: () async {
                              // Optimistic read-receipt — mirrors the web's immediate unread-clear on open.
                              setState(() => c['unreadCount'] = 0);
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => ConversationScreen(
                                    conversationId: c['_id'] as String,
                                    contactName: contactName,
                                  ),
                                ),
                              );
                              _load(reset: true, silent: true);
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      CircleAvatar(
                                        radius: 26,
                                        backgroundColor: wa.chipBg,
                                        child: Text(
                                          contactName.isNotEmpty
                                              ? contactName[0].toUpperCase()
                                              : '?',
                                          style: TextStyle(
                                            color: wa.chipFg,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 18,
                                          ),
                                        ),
                                      ),
                                      if (score != null)
                                        Positioned(
                                          top: -4,
                                          left: -4,
                                          child: Container(
                                            constraints: const BoxConstraints(
                                              minWidth: 21,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 5,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _scoreColor(score),
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                              border: Border.all(
                                                color: wa.listBg,
                                                width: 2,
                                              ),
                                            ),
                                            child: Text(
                                              '$score',
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                        ),
                                      if (botEnabled)
                                        Positioned(
                                          bottom: -2,
                                          right: -2,
                                          child: Container(
                                            padding: const EdgeInsets.all(3),
                                            decoration: BoxDecoration(
                                              color: AppColors.success,
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: wa.listBg,
                                                width: 2,
                                              ),
                                            ),
                                            child: const Icon(
                                              Icons.smart_toy,
                                              size: 9,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          contactName,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 16.5,
                                            fontWeight: FontWeight.w600,
                                            color: wa.isDark
                                                ? Colors.white
                                                : Colors.black87,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          c['lastMessagePreview'] as String? ??
                                              '',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            color: unread > 0
                                                ? (wa.isDark
                                                      ? Colors.white70
                                                      : Colors.black87)
                                                : wa.timeText,
                                            fontWeight: unread > 0
                                                ? FontWeight.w500
                                                : FontWeight.normal,
                                          ),
                                        ),
                                        if (assignedName != null &&
                                            assignedName.isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 2,
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  Icons.assignment_ind_outlined,
                                                  size: 11,
                                                  color: wa.timeText,
                                                ),
                                                const SizedBox(width: 3),
                                                Text(
                                                  assignedName,
                                                  style: TextStyle(
                                                    fontSize: 10.5,
                                                    color: wa.timeText,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.start,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        _fmtTime(c['lastMessageAt'] as String?),
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: unread > 0
                                              ? wa.unreadBadge
                                              : wa.timeText,
                                          fontWeight: unread > 0
                                              ? FontWeight.w600
                                              : FontWeight.normal,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      if (unread > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 7,
                                            vertical: 2,
                                          ),
                                          constraints: const BoxConstraints(
                                            minWidth: 20,
                                          ),
                                          decoration: BoxDecoration(
                                            color: wa.unreadBadge,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: Text(
                                            '$unread',
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        )
                                      else
                                        const SizedBox(height: 20),
                                    ],
                                  ),
                                ],
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
}
