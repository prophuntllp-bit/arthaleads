import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../inbox/wa_theme.dart';

/// Read-only WhatsApp conversation for a lead, the app's version of the web
/// Lead Details "Chat" tab. An agent about to call a lead can see what the bot
/// and the team already said. Replies still happen from the Inbox.
class LeadChatPanel extends StatefulWidget {
  final String leadId;
  // Set for a project lead: its chat belongs to the lead it was moved or routed
  // from, which the project endpoint looks up.
  final String? projectId;
  const LeadChatPanel({super.key, required this.leadId, this.projectId});

  @override
  State<LeadChatPanel> createState() => _LeadChatPanelState();
}

class _LeadChatPanelState extends State<LeadChatPanel> {
  List<Map<String, dynamic>>? _messages;
  bool _hasConversation = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _failed = false);
    try {
      final pid = widget.projectId;
      final res = await ApiClient.instance.dio.get(
        pid != null ? '/projects/$pid/leads/${widget.leadId}/whatsapp-messages' : '/leads/${widget.leadId}/whatsapp-messages',
      );
      if (!mounted) return;
      setState(() {
        _hasConversation = res.data['conversation'] != null;
        _messages = (res.data['messages'] as List? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  static String _time(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
    if (d == null) return '';
    // The server stores UTC; show IST like the rest of the app.
    final ist = d.toUtc().add(const Duration(hours: 5, minutes: 30));
    return DateFormat('d MMM, h:mm a').format(ist);
  }

  Widget _empty(IconData icon, String title, [String? sub]) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Icon(icon, size: 30, color: Theme.of(context).hintColor.withValues(alpha: 0.6)),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          if (sub != null) ...[
            const SizedBox(height: 4),
            Text(sub, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }

  Widget _bubble(Map<String, dynamic> m, WaTheme wa) {
    final out = m['direction'] == 'outbound';
    final bot = m['sender'] == 'bot';
    final name = (m['senderName'] as String?) ?? '';
    final type = m['mediaType'] as String?;
    final url = (m['mediaUrl'] as String?) ?? '';
    final body = (m['body'] as String?) ?? '';
    final ink = wa.bubbleText;

    Widget content;
    if (url.isNotEmpty && type == 'image') {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(
              url,
              width: 220,
              height: 140,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                width: 220,
                height: 80,
                color: Colors.black.withValues(alpha: 0.08),
                alignment: Alignment.center,
                child: Icon(Icons.broken_image_outlined, color: wa.timeText),
              ),
            ),
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(body, style: TextStyle(color: ink, fontSize: 14)),
          ],
        ],
      );
    } else if (url.isNotEmpty) {
      content = InkWell(
        onTap: () {
          final uri = Uri.tryParse(url);
          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
        },
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(type == 'video' ? Icons.play_circle_outline_rounded : Icons.description_outlined,
                color: const Color(0xFFEF4444)),
            const SizedBox(width: 8),
            Flexible(
              child: Text(body.isNotEmpty ? body : (type == 'video' ? 'Video' : 'Document'),
                  style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
    } else {
      content = Text(body, style: TextStyle(color: ink, fontSize: 14));
    }

    final options = (m['interactiveOptions'] as List?) ?? const [];
    final line = (wa.isDark ? Colors.white : Colors.black).withValues(alpha: 0.14);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: out ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (bot)
            Padding(
              padding: const EdgeInsets.only(bottom: 3, left: 2, right: 2),
              child: Text(name.isNotEmpty ? '$name (Bot)' : 'Bot',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: wa.sendGreen)),
            )
          else if (out && name.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 3, left: 2, right: 2),
              child: Text(name, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: wa.timeText)),
            ),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: out ? wa.outgoingBubble : wa.incomingBubble,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(out ? 14 : 4),
                  topRight: Radius.circular(out ? 4 : 14),
                  bottomLeft: const Radius.circular(14),
                  bottomRight: const Radius.circular(14),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  content,
                  if (options.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.only(top: 8),
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: line))),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final o in options)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: line),
                              ),
                              child: Text('${(o is Map ? o['title'] : o) ?? ''}',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ink)),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 3, left: 2, right: 2),
            child: Text(_time(m['timestamp']), style: TextStyle(fontSize: 10, color: wa.timeText)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return Column(
        children: [
          _empty(Icons.cloud_off_rounded, 'Could not load the chat'),
          TextButton(onPressed: _load, child: const Text('Try again')),
        ],
      );
    }
    final msgs = _messages;
    if (msgs == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (!_hasConversation) {
      return _empty(Icons.chat_bubble_outline_rounded, 'No WhatsApp conversation',
          "This lead hasn't exchanged any WhatsApp messages yet.");
    }
    if (msgs.isEmpty) return _empty(Icons.chat_bubble_outline_rounded, 'No messages yet');

    final wa = WaTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: wa.chatBg, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              'READ-ONLY. FOR CONTEXT BEFORE YOU CALL. REPLY FROM THE INBOX.',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: wa.timeText),
            ),
          ),
          for (final m in msgs) _bubble(m, wa),
        ],
      ),
    );
  }
}
