import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'conversation_screen.dart';

/// WhatsApp Inbox — GET /whatsapp/conversations. Mirrors
/// frontend/src/pages/Inbox.jsx conversation list.
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  final _api = ApiClient.instance;
  final List<Map<String, dynamic>> _conversations = [];
  bool _loading = true;
  int _page = 1;
  int _pages = 1;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
          !_loading && _page < _pages) {
        _page += 1;
        _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _conversations.clear();
    }
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/whatsapp/conversations', queryParameters: {'page': _page, 'limit': 30});
      final total = res.data['total'] as int? ?? 0;
      setState(() {
        _conversations.addAll((res.data['conversations'] as List? ?? []).cast<Map<String, dynamic>>());
        _pages = (total / 30).ceil().clamp(1, 999999);
      });
    } catch (e) {
      if (mounted) {
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
    return _loading && _conversations.isEmpty
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _conversations.isEmpty
            ? const Center(child: Text('No WhatsApp conversations yet'))
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
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.whatsapp.withValues(alpha: 0.15),
                        child: Text(
                          contactName.isNotEmpty ? contactName[0].toUpperCase() : '?',
                          style: const TextStyle(color: AppColors.whatsapp, fontWeight: FontWeight.w700),
                        ),
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
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ConversationScreen(
                              conversationId: c['_id'] as String,
                              contactName: contactName,
                            ),
                          ),
                        );
                        _load(reset: true);
                      },
                    );
                  },
                ),
              );
  }
}
