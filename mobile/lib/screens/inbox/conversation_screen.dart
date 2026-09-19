import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import '../leads/lead_detail_sheet.dart';
import 'wa_theme.dart';

/// WhatsApp message thread — GET /whatsapp/conversations/:id/messages,
/// POST /whatsapp/send, PATCH /whatsapp/conversations/:id (bot/status).
/// Mirrors the conversation panel in frontend/src/pages/Inbox.jsx.
class ConversationScreen extends StatefulWidget {
  final String conversationId;
  final String contactName;

  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.contactName,
  });

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
    _poll = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _load(silent: true),
    );
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
      final res = await _api.dio.get(
        '/whatsapp/conversations/${widget.conversationId}',
      );
      if (mounted) {
        setState(
          () =>
              _conv = (res.data['conversation'] as Map).cast<String, dynamic>(),
        );
      }
    } catch (_) {}
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await _api.dio.get(
        '/whatsapp/conversations/${widget.conversationId}/messages',
      );
      final fresh = (res.data['messages'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      final wasAtBottom =
          !_scroll.hasClients ||
          _scroll.position.pixels >= _scroll.position.maxScrollExtent - 60;
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(fresh);
      });
      if (wasAtBottom) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            _scroll.jumpTo(_scroll.position.maxScrollExtent);
          }
        });
      }
    } catch (e) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load messages')),
            backgroundColor: AppColors.danger,
          ),
        );
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
      final res = await _api.dio.post(
        '/whatsapp/send',
        data: {'conversationId': widget.conversationId, 'body': text},
      );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to send')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleBot() async {
    final next = !(_conv?['botEnabled'] == true);
    try {
      final res = await _api.dio.patch(
        '/whatsapp/conversations/${widget.conversationId}',
        data: {'botEnabled': next},
      );
      if (mounted) {
        setState(
          () =>
              _conv = (res.data['conversation'] as Map).cast<String, dynamic>(),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to update bot')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _setStatus(String status) async {
    try {
      final res = await _api.dio.patch(
        '/whatsapp/conversations/${widget.conversationId}',
        data: {'status': status},
      );
      if (mounted) {
        setState(
          () =>
              _conv = (res.data['conversation'] as Map).cast<String, dynamic>(),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to update status')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  // Mirrors frontend/src/pages/Inbox.jsx's displayName() — the linked lead's
  // live name wins over the contactName snapshot taken when the thread opened.
  String get _liveDisplayName {
    final lead = _conv?['leadId'];
    final leadName = lead is Map ? lead['name'] as String? : null;
    if (leadName != null && leadName.trim().isNotEmpty) return leadName;
    return widget.contactName;
  }

  int? get _leadScore {
    final lead = _conv?['leadId'];
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

  Future<void> _openMedia(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Widget _mediaContent(Map<String, dynamic> message, WaTheme wa) {
    final type = message['mediaType'] as String?;
    final url = message['mediaUrl'] as String?;
    final body = message['body'] as String? ?? '';
    if (url == null || url.isEmpty) {
      return Text(body, style: TextStyle(color: wa.bubbleText, fontSize: 14.5));
    }

    if (type == 'image') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => _openMedia(url),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                url,
                fit: BoxFit.cover,
                width: 230,
                height: 150,
                errorBuilder: (_, _, _) => Container(
                  width: 230,
                  height: 96,
                  color: Colors.black.withValues(alpha: 0.08),
                  alignment: Alignment.center,
                  child: Icon(Icons.broken_image_outlined, color: wa.timeText),
                ),
              ),
            ),
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(body, style: TextStyle(color: wa.bubbleText, fontSize: 14.5)),
          ],
        ],
      );
    }

    if (type == 'document') {
      return InkWell(
        onTap: () => _openMedia(url),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minWidth: 210),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: wa.isDark ? 0.18 : 0.05),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.picture_as_pdf_rounded,
                color: Color(0xFFDC2626),
                size: 28,
              ),
              const SizedBox(width: 9),
              Flexible(
                child: Text(
                  body.isNotEmpty ? body : 'Open brochure PDF',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: wa.bubbleText,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.open_in_new_rounded, color: wa.timeText, size: 16),
            ],
          ),
        ),
      );
    }

    return Text(body, style: TextStyle(color: wa.bubbleText, fontSize: 14.5));
  }

  // Claiming a thread needs no team picker — same as web's one-tap
  // assign-to-me/release toggle.
  Future<void> _toggleAssignToMe() async {
    final auth = context.read<AuthState>();
    final myId = auth.user?['_id'] as String?;
    if (myId == null) return;
    final assignedTo = _conv?['assignedTo'];
    final currentId = assignedTo is Map ? assignedTo['_id'] as String? : null;
    final mine = currentId == myId;
    try {
      final res = await _api.dio.patch(
        '/whatsapp/conversations/${widget.conversationId}',
        data: {'assignedTo': mine ? null : myId},
      );
      if (mounted) {
        setState(
          () =>
              _conv = (res.data['conversation'] as Map).cast<String, dynamic>(),
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              mine ? 'Released — now unassigned' : 'Assigned to you',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(
                e,
                'Could not change who this is assigned to',
              ),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _openLead() async {
    final rawLead = _conv?['leadId'];
    if (rawLead is! Map) return;
    final lead = rawLead.cast<String, dynamic>();
    try {
      final projectsRes = await _api.dio.get('/projects');
      final projects = (projectsRes.data['data'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      await showModalBottomSheet<dynamic>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => LeadDetailSheet(
          lead: {...lead, '_type': 'lead'},
          projects: projects,
          onUpdated: (updated) {
            if (mounted) {
              setState(() => _conv = {...?_conv, 'leadId': updated});
            }
          },
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to open lead')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  String _fmtTime(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    return dt == null ? '' : DateFormat('hh:mm a').format(dt);
  }

  Widget _statusIcon(String? status) {
    if (status == 'read') {
      return const Icon(Icons.done_all, size: 13, color: Color(0xFF60A5FA));
    }
    if (status == 'delivered') {
      return Icon(
        Icons.done_all,
        size: 13,
        color: Colors.grey.withValues(alpha: 0.7),
      );
    }
    return Icon(
      Icons.done,
      size: 13,
      color: Colors.grey.withValues(alpha: 0.7),
    );
  }

  @override
  Widget build(BuildContext context) {
    final wa = WaTheme.of(context);
    final botEnabled = _conv?['botEnabled'] == true;
    final resolved = _conv?['status'] == 'resolved';
    final lead = _conv?['leadId'] is Map
        ? (_conv!['leadId'] as Map).cast<String, dynamic>()
        : null;
    final assignedTo = _conv?['assignedTo'];
    final assignedName = assignedTo is Map
        ? assignedTo['name'] as String?
        : null;
    final myId = context.watch<AuthState>().user?['_id'] as String?;
    final assignedId = assignedTo is Map ? assignedTo['_id'] as String? : null;
    final assignedToMe = assignedId != null && assignedId == myId;
    final displayName = _liveDisplayName;
    final score = _leadScore;

    return Scaffold(
      backgroundColor: wa.chatBg,
      appBar: AppBar(
        backgroundColor: wa.headerBg,
        foregroundColor: wa.headerFg,
        iconTheme: IconThemeData(color: wa.headerFg),
        titleSpacing: 0,
        title: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                  child: Text(
                    displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                    style: TextStyle(
                      color: wa.headerFg,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (score != null)
                  Positioned(
                    top: -7,
                    left: -7,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 21),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: _scoreColor(score),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: wa.headerBg, width: 2),
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
              ],
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: wa.headerFg,
                    ),
                  ),
                  if (lead != null)
                    Text(
                      '${lead['name'] ?? ''} · ${lead['status'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, color: wa.headerFgSoft),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (lead != null)
            IconButton(
              tooltip: 'Open linked lead',
              onPressed: _openLead,
              icon: Icon(Icons.person_search_rounded, color: wa.headerFg),
            ),
          if (_conv != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: GestureDetector(
                  onTap: _toggleAssignToMe,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(
                        alpha: assignedName != null ? 0.22 : 0.1,
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.assignment_ind_outlined,
                          size: 13,
                          color: wa.headerFg,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          assignedName == null
                              ? 'Unassigned'
                              : (assignedToMe ? 'You' : assignedName),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: wa.headerFg,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          if (_conv != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: GestureDetector(
                  onTap: _toggleBot,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(
                        alpha: botEnabled ? 0.22 : 0.1,
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          botEnabled ? Icons.smart_toy : Icons.person,
                          size: 13,
                          color: wa.headerFg,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          botEnabled ? 'Bot ON' : 'Manual',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: wa.headerFg,
                          ),
                        ),
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
                ? Center(
                    child: Text(
                      'No messages yet',
                      style: TextStyle(color: wa.timeText),
                    ),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 12,
                    ),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) {
                      final m = _messages[i];
                      final outbound = m['direction'] == 'outbound';
                      final isBot = m['sender'] == 'bot';
                      return Align(
                        alignment: outbound
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.78,
                          ),
                          margin: const EdgeInsets.symmetric(vertical: 2),
                          padding: const EdgeInsets.fromLTRB(10, 7, 8, 6),
                          decoration: BoxDecoration(
                            color: outbound
                                ? wa.outgoingBubble
                                : wa.incomingBubble,
                            borderRadius: BorderRadius.only(
                              topLeft: const Radius.circular(10),
                              topRight: const Radius.circular(10),
                              bottomLeft: Radius.circular(outbound ? 10 : 2),
                              bottomRight: Radius.circular(outbound ? 2 : 10),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 1,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (isBot)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.smart_toy,
                                        size: 12,
                                        color: wa.sendGreen,
                                      ),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: Text(
                                          (m['senderName'] as String?)?.isNotEmpty == true
                                              ? '${m['senderName']} (Bot)'
                                              : 'Bot',
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: wa.sendGreen,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else if (outbound &&
                                  m['sender'] == 'agent' &&
                                  (m['senderName'] as String?)?.isNotEmpty == true)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 3),
                                  child: Text(
                                    m['senderName'] as String,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF3A7D1F),
                                    ),
                                  ),
                                ),
                              _mediaContent(m, wa),
                              if (m['interactiveOptions'] is List &&
                                  (m['interactiveOptions'] as List).isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(top: 6),
                                  padding: const EdgeInsets.only(top: 6),
                                  decoration: BoxDecoration(
                                    border: Border(
                                      top: BorderSide(
                                        color: (wa.isDark ? Colors.white : Colors.black)
                                            .withValues(alpha: 0.12),
                                      ),
                                    ),
                                  ),
                                  child: Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: [
                                      for (final o in (m['interactiveOptions'] as List))
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(
                                              color: (wa.isDark ? Colors.white : Colors.black)
                                                  .withValues(alpha: 0.25),
                                            ),
                                          ),
                                          child: Text(
                                            '${(o is Map ? o['title'] : o) ?? ''}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: wa.isDark ? Colors.white : Colors.black87,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              const SizedBox(height: 2),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Text(
                                    _fmtTime(m['timestamp'] as String?),
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: wa.timeText,
                                    ),
                                  ),
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
            child: Container(
              color: wa.composerBg,
              child: resolved
                  ? Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: 14,
                        horizontal: 16,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.check_circle,
                            size: 16,
                            color: wa.sendGreen,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Conversation resolved',
                            style: TextStyle(
                              fontSize: 13,
                              color: wa.isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          const SizedBox(width: 10),
                          TextButton(
                            onPressed: () => _setStatus('open'),
                            child: Text(
                              'Reopen',
                              style: TextStyle(color: wa.sendGreen),
                            ),
                          ),
                        ],
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.check_circle_outline,
                              color: wa.sendGreen,
                            ),
                            tooltip: 'Mark resolved',
                            onPressed: () => _setStatus('resolved'),
                          ),
                          Expanded(
                            child: Container(
                              constraints: const BoxConstraints(minHeight: 44),
                              decoration: BoxDecoration(
                                color: wa.composerPillBg,
                                borderRadius: BorderRadius.circular(24),
                              ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                              child: TextField(
                                controller: _inputCtrl,
                                style: TextStyle(
                                  color: wa.isDark
                                      ? Colors.white
                                      : Colors.black87,
                                  fontSize: 14.5,
                                ),
                                decoration: InputDecoration(
                                  hintText: 'Type a message…',
                                  hintStyle: TextStyle(
                                    color: wa.timeText,
                                    fontSize: 14.5,
                                  ),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  filled: false,
                                  contentPadding: EdgeInsets.zero,
                                  isDense: true,
                                ),
                                minLines: 1,
                                maxLines: 4,
                                onSubmitted: (_) => _send(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: _sending ? null : _send,
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: wa.sendGreen,
                                shape: BoxShape.circle,
                              ),
                              child: _sending
                                  ? const Padding(
                                      padding: EdgeInsets.all(12),
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.send_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
