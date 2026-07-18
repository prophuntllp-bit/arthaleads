import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import '../automation/automation_screen.dart';
import 'conversation_screen.dart';

const _filters = [
  {'value': 'all', 'label': 'All'},
  {'value': 'bot', 'label': 'Bot'},
  {'value': 'open', 'label': 'Open'},
  {'value': 'resolved', 'label': 'Done'},
];

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
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _checkConnected();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading && _page < _pages) {
        _page += 1;
        _load();
      }
    });
    _poll = Timer.periodic(const Duration(seconds: 4), (_) => _load(reset: true, silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _scroll.dispose();
    super.dispose();
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
      final res = await _api.dio.get('/whatsapp/conversations', queryParameters: params);
      final total = res.data['total'] as int? ?? 0;
      final fresh = (res.data['conversations'] as List? ?? []).cast<Map<String, dynamic>>();
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load conversations')),
          backgroundColor: AppColors.danger,
        ));
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
                child: const Icon(Icons.wechat, size: 32, color: AppColors.whatsapp),
              ),
              const SizedBox(height: 14),
              const Text('WhatsApp not connected', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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
                        appBar: AppBar(title: const Text('Automation')),
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

    return Column(
      children: [
        // ── Filter tabs ──
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: _filters.map((f) {
              final selected = _filter == f['value'];
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _filter = f['value']!);
                      _load(reset: true);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        f['label']!,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: selected ? Colors.white : Theme.of(context).textTheme.bodySmall?.color,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: _loading && _conversations.isEmpty
              ? const Center(child: AppSpinner(size: 32))
              : _conversations.isEmpty
                  ? const Center(child: Text('No conversations yet'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () => _load(reset: true),
                      child: ListView.builder(
                        controller: _scroll,
                        itemCount: _conversations.length,
                        itemBuilder: (context, i) {
                          final c = _conversations[i];
                          final unread = (c['unreadCount'] as num?)?.toInt() ?? 0;
                          final contactName = c['contactName'] as String? ?? c['contactPhone'] as String? ?? '—';
                          final botEnabled = c['botEnabled'] == true;
                          return FadeSlideIn(
                            delay: Duration(milliseconds: 15 * (i % 15)),
                            child: ListTile(
                            leading: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                CircleAvatar(
                                  backgroundColor: AppColors.whatsapp.withValues(alpha: 0.15),
                                  child: Text(
                                    contactName.isNotEmpty ? contactName[0].toUpperCase() : '?',
                                    style: const TextStyle(color: AppColors.whatsapp, fontWeight: FontWeight.w700),
                                  ),
                                ),
                                if (botEnabled)
                                  Positioned(
                                    bottom: -2,
                                    right: -2,
                                    child: Container(
                                      padding: const EdgeInsets.all(2),
                                      decoration: BoxDecoration(
                                        color: AppColors.success,
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 2),
                                      ),
                                      child: const Icon(Icons.smart_toy, size: 9, color: Colors.white),
                                    ),
                                  ),
                              ],
                            ),
                            title: Text(contactName,
                                style: TextStyle(fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w600)),
                            subtitle: Text(
                              c['lastMessagePreview'] as String? ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: unread > 0 ? null : Theme.of(context).textTheme.bodySmall?.color,
                                fontWeight: unread > 0 ? FontWeight.w500 : FontWeight.normal,
                              ),
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(_fmtTime(c['lastMessageAt'] as String?),
                                    style: Theme.of(context).textTheme.bodySmall),
                                if (unread > 0) ...[
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.whatsapp,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text('$unread',
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                                  ),
                                ],
                              ],
                            ),
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
                          ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
