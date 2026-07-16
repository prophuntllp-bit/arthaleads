import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import 'help_screen.dart';

/// Ticket thread — GET /tickets/:id, POST /tickets/:id/reply. Both the
/// initial message and replies can carry attachments (image/PDF/doc, ≤600 KB
/// each, base64 data URIs) — mirrors frontend/src/pages/HelpSupport.jsx.
class TicketDetailScreen extends StatefulWidget {
  final String ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  final _api = ApiClient.instance;
  final _replyCtrl = TextEditingController();
  Map<String, dynamic>? _ticket;
  bool _loading = true;
  bool _sending = false;
  List<Attachment> _replyAttachments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/tickets/${widget.ticketId}');
      setState(() => _ticket = (res.data['ticket'] as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load ticket')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reply() async {
    final text = _replyCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final res = await _api.dio.post('/tickets/${widget.ticketId}/reply', data: {
        'body': text,
        'attachments': _replyAttachments.map((a) => a.toJson()).toList(),
      });
      setState(() {
        _ticket = (res.data['ticket'] as Map).cast<String, dynamic>();
        _replyCtrl.clear();
        _replyAttachments = [];
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Reply failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String _fmt(String? iso) {
    final dt = DateTime.tryParse(iso ?? '');
    return dt == null ? '' : DateFormat('dd MMM, hh:mm a').format(dt);
  }

  Widget _attachmentsRow(List? raw) {
    final list = (raw ?? []).cast<Map>();
    if (list.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        children: list
            .map((a) => attachmentChip(Attachment(
                  url: a['url'] as String? ?? '',
                  name: a['name'] as String? ?? 'attachment',
                  size: (a['size'] as num?)?.toInt() ?? 0,
                )))
            .toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final closed = _ticket?['status'] == 'closed';
    final replies = (_ticket?['replies'] as List? ?? []).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(title: Text(_ticket?['subject'] as String? ?? 'Ticket')),
      body: _loading
          ? const Center(child: AppSpinner(size: 32))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_ticket?['description'] as String? ?? ''),
                              _attachmentsRow(_ticket?['attachments'] as List?),
                              const SizedBox(height: 6),
                              Text(_fmt(_ticket?['createdAt'] as String?),
                                  style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ...replies.map((r) {
                        final isAdmin = r['isAdmin'] == true;
                        return Align(
                          alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
                          child: Container(
                            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: isAdmin
                                  ? AppColors.primary.withValues(alpha: 0.12)
                                  : Theme.of(context).cardTheme.color,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r['authorName'] as String? ?? (isAdmin ? 'Support' : 'You'),
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                                const SizedBox(height: 2),
                                Text(r['body'] as String? ?? ''),
                                _attachmentsRow(r['attachments'] as List?),
                                const SizedBox(height: 2),
                                Text(_fmt(r['createdAt'] as String?), style: Theme.of(context).textTheme.bodySmall),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                if (closed)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('This ticket is closed.', style: TextStyle(color: AppColors.danger)),
                  )
                else
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_replyAttachments.isNotEmpty)
                            Wrap(
                              children: _replyAttachments
                                  .map((a) => attachmentChip(a, onRemove: () => setState(() => _replyAttachments.remove(a))))
                                  .toList(),
                            ),
                          Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.attach_file, size: 20),
                                tooltip: 'Attach file',
                                onPressed: () async {
                                  final picked = await pickAttachments(context, _replyAttachments);
                                  setState(() => _replyAttachments = picked);
                                },
                              ),
                              Expanded(
                                child: TextField(
                                  controller: _replyCtrl,
                                  decoration: const InputDecoration(hintText: 'Type a reply…'),
                                  minLines: 1,
                                  maxLines: 4,
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: _sending
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                                    : const Icon(Icons.send_rounded, color: AppColors.primary),
                                onPressed: _sending ? null : _reply,
                              ),
                            ],
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
