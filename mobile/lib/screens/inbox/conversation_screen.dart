import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';

/// WhatsApp message thread — GET /whatsapp/conversations/:id/messages,
/// POST /whatsapp/send, PATCH /whatsapp/conversations/:id (bot/status).
/// Mirrors the conversation panel in frontend/src/pages/Inbox.jsx.
class ConversationScreen extends StatefulWidget {
  final String conversationId;
  final String contactName;

  const ConversationScreen({super.key, required this.conversationId, required this.contactName});

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _api = ApiClient.instance;
  final List<Map<String, dynamic>> _messages = [];
  final _inputCtrl = TextEditingController();
  final _scroll = ScrollController();
  bool _loading = true;
  bool _sending = false;
  Map<String, dynamic>? _conv;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _loadConv();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _inputCtrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadConv() async {
    try {
      final res = await _api.dio.get('/whatsapp/conversations/${widget.conversationId}');
      if (mounted) setState(() => _conv = (res.data['conversation'] as Map).cast<String, dynamic>());
    } catch (_) {}
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/whatsapp/conversations/${widget.conversationId}/messages');
      final fresh = (res.data['messages'] as List? ?? []).cast<Map<String, dynamic>>();
      final wasAtBottom = !_scroll.hasClients ||
          _scroll.position.pixels >= _scroll.position.maxScrollExtent - 60;
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(fresh);
      });
      if (wasAtBottom) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
        });
      }
    } catch (e) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load messages')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final res = await _api.dio.post('/whatsapp/send', data: {
        'conversationId': widget.conversationId,
        'body': text,
      });
      setState(() {
        _messages.add((res.data['message'] as Map).cast<String, dynamic>());
        _inputCtrl.clear();
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to send')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleBot() async {
    final next = !(_conv?['botEnabled'] == true);
    try {
      final res = await _api.dio.patch('/whatsapp/conversations/${widget.conversationId}', data: {'botEnabled': next});
      if (mounted) setState(() => _conv = (res.data['conversation'] as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update bot')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _setStatus(String status) async {
    try {
      final res = await _api.dio.patch('/whatsapp/conversations/${widget.conversationId}', data: {'status': status});
      if (mounted) setState(() => _conv = (res.data['conversation'] as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update status')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  String _fmtTime(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    return dt == null ? '' : DateFormat('hh:mm a').format(dt);
  }

  Widget _statusIcon(String? status) {
    if (status == 'read') return const Icon(Icons.done_all, size: 13, color: Color(0xFF60A5FA));
    if (status == 'delivered') return Icon(Icons.done_all, size: 13, color: Colors.grey.withValues(alpha: 0.7));
    return Icon(Icons.done, size: 13, color: Colors.grey.withValues(alpha: 0.7));
  }

  @override
  Widget build(BuildContext context) {
    final botEnabled = _conv?['botEnabled'] == true;
    final resolved = _conv?['status'] == 'resolved';
    final lead = _conv?['leadId'] is Map ? (_conv!['leadId'] as Map).cast<String, dynamic>() : null;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.contactName, style: const TextStyle(fontSize: 16)),
            if (lead != null)
              Text('${lead['name'] ?? ''} · ${lead['status'] ?? ''}',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.normal, color: AppColors.primary)),
          ],
        ),
        actions: [
          if (_conv != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: GestureDetector(
                  onTap: _toggleBot,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: botEnabled ? AppColors.success.withValues(alpha: 0.12) : Theme.of(context).cardColor,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: botEnabled ? AppColors.success.withValues(alpha: 0.3) : Theme.of(context).dividerColor),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(botEnabled ? Icons.smart_toy : Icons.person, size: 13, color: botEnabled ? AppColors.success : null),
                        const SizedBox(width: 4),
                        Text(botEnabled ? 'Bot ON' : 'Manual',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: botEnabled ? AppColors.success : null)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: AppSpinner(size: 32))
                : _messages.isEmpty
                    ? const Center(child: Text('No messages yet'))
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(12),
                        itemCount: _messages.length,
                        itemBuilder: (context, i) {
                          final m = _messages[i];
                          final outbound = m['direction'] == 'outbound';
                          final isBot = m['sender'] == 'bot';
                          return Align(
                            alignment: outbound ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                              margin: const EdgeInsets.symmetric(vertical: 3),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: outbound
                                    ? (isBot ? AppColors.success.withValues(alpha: 0.15) : AppColors.whatsapp.withValues(alpha: 0.18))
                                    : Theme.of(context).cardTheme.color,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (isBot)
                                    const Padding(
                                      padding: EdgeInsets.only(bottom: 2),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.smart_toy, size: 10, color: AppColors.success),
                                          SizedBox(width: 3),
                                          Text('Bot', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.success)),
                                        ],
                                      ),
                                    ),
                                  Text(m['body'] as String? ?? ''),
                                  const SizedBox(height: 3),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(_fmtTime(m['timestamp'] as String?),
                                          style: Theme.of(context).textTheme.bodySmall),
                                      if (outbound) ...[
                                        const SizedBox(width: 4),
                                        _statusIcon(m['status'] as String?),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          SafeArea(
            top: false,
            child: resolved
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle, size: 16, color: AppColors.success),
                        const SizedBox(width: 6),
                        const Text('Conversation resolved', style: TextStyle(fontSize: 13)),
                        const SizedBox(width: 10),
                        TextButton(onPressed: () => _setStatus('open'), child: const Text('Reopen')),
                      ],
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.check_circle_outline, color: AppColors.success),
                          tooltip: 'Mark resolved',
                          onPressed: () => _setStatus('resolved'),
                        ),
                        Expanded(
                          child: TextField(
                            controller: _inputCtrl,
                            decoration: const InputDecoration(hintText: 'Type a message…'),
                            minLines: 1,
                            maxLines: 4,
                            onSubmitted: (_) => _send(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: _sending
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                              : const Icon(Icons.send_rounded, color: AppColors.primary),
                          onPressed: _sending ? null : _send,
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
