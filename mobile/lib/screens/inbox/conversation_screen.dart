import '../../core/artha_features.dart';
import '../artha/suggest_card.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/day_divider.dart';
import '../../widgets/motion.dart';
import '../leads/lead_detail_sheet.dart';
import 'project_media_send_sheet.dart';
import 'template_send_sheet.dart';
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
  // Long chats: the newest 60 come first; "Load earlier messages" pages back.
  bool _hasOlder = false;
  // Just after a chat opens, images and video previews finish loading and
  // push the content down, so one jump to the bottom ends up partway up.
  // Until this time (or the user scrolls) the thread keeps itself pinned.
  DateTime? _pinToBottomUntil;
  bool _loadingOlder = false;
  final _inputCtrl = TextEditingController();
  final _scroll = ScrollController();
  bool _loading = true;
  bool _sending = false;
  Map<String, dynamic>? _conv;
  Timer? _poll;
  DateTime? _lastInboundAt;
  bool _windowKnown = false;
  Map<String, dynamic>? _credits;
  bool _isMeta = false;

  @override
  void initState() {
    super.initState();
    ArthaFeatures.drafts().then((on) {
      if (mounted) setState(() => _canDraft = on);
    });
    _loadConv();
    _loadChannel();
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

  Future<void> _loadChannel() async {
    try {
      final s = await _api.dio.get('/whatsapp/status');
      final c = await _api.dio.get('/credits/balance');
      if (!mounted) return;
      setState(() {
        _isMeta = s.data['provider'] == 'meta';
        _credits = (c.data as Map).cast<String, dynamic>();
      });
    } catch (_) {}
  }

  Duration get _windowLeft => _lastInboundAt == null
      ? Duration.zero
      : const Duration(hours: 24) - DateTime.now().difference(_lastInboundAt!);

  String _fmtLeft(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }

  Future<void> _openMediaSheet() async {
    final sent = await showProjectMediaSendSheet(context, conversationId: widget.conversationId);
    if (!sent || !mounted) return;
    _load(silent: true);
    _loadChannel();
  }

  Future<void> _openTemplateSheet() async {
    final msg = await showTemplateSendSheet(
      context,
      conversationId: widget.conversationId,
      contactName: _liveDisplayName,
      credits: _credits,
    );
    if (msg == null || !mounted) return;
    if (msg.isNotEmpty) setState(() => _messages.add(msg));
    _load(silent: true);
    _loadChannel();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  Widget _templateOnlyBar(WaTheme wa, String firstName) {
    final who = firstName.isEmpty ? 'They' : firstName;
    return Container(
      margin: const EdgeInsets.all(10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFBBF24).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFBBF24).withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.schedule, size: 16, color: Color(0xFFB45309)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _lastInboundAt != null
                      ? 'More than 24 hours since $who last wrote. WhatsApp only allows an approved template until they reply.'
                      : '$who has not written to you yet. WhatsApp only allows an approved template to start a conversation.',
                  style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFFB45309)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: wa.sendGreen,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: const StadiumBorder(),
              ),
              onPressed: _openTemplateSheet,
              icon: const Icon(Icons.bolt, size: 18),
              label: const Text('Send a template', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
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
      final li = res.data['lastInboundAt'];
      _lastInboundAt = li is String ? DateTime.tryParse(li) : null;
      _windowKnown = res.data is Map && (res.data as Map).containsKey('lastInboundAt');
      final wasAtBottom =
          !_scroll.hasClients ||
          _scroll.position.pixels >= _scroll.position.maxScrollExtent - 60;
      if (!mounted) return;
      setState(() {
        // The 3 s poll returns only the newest page; keep any earlier
        // messages the user already loaded instead of dropping them.
        final kept = <Map<String, dynamic>>[];
        if (silent && fresh.isNotEmpty) {
          final ids = {for (final m in fresh) m['_id']};
          final firstTs = DateTime.tryParse(fresh.first['timestamp']?.toString() ?? '');
          kept.addAll(_messages.where((m) {
            final ts = DateTime.tryParse(m['timestamp']?.toString() ?? '');
            return !ids.contains(m['_id']) && ts != null && firstTs != null && !ts.isAfter(firstTs);
          }));
        }
        if (!silent || kept.isEmpty) _hasOlder = res.data['hasMore'] == true;
        _messages
          ..clear()
          ..addAll(kept)
          ..addAll(fresh);
      });
      if (!silent) {
        _pinToBottomUntil = DateTime.now().add(const Duration(seconds: 3));
        for (final ms in const [0, 300, 800, 1500, 2500]) {
          Future.delayed(Duration(milliseconds: ms), _keepPinned);
        }
      } else if (wasAtBottom) {
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

  // ── Artha reply draft ────────────────────────────────────────────────────
  // POST /copilot/draft-reply writes a reply from the chat so far, in the
  // customer's language, into the box. It is never sent by itself: the person
  // reads it, edits it and presses Send. Offered only when the company has
  // drafts, the 24-hour window is open and the box is empty (as on the web).
  bool _canDraft = false;
  bool _drafting = false;
  bool _drafted = false;

  Future<void> _draftReply() async {
    if (_drafting || _inputCtrl.text.trim().isNotEmpty) return;
    final forId = widget.conversationId;
    setState(() => _drafting = true);
    try {
      final res = await _api.dio.post('/copilot/draft-reply', data: {'conversationId': forId});
      if (!mounted || forId != widget.conversationId) return;
      final text = '${res.data['text'] ?? ''}'.trim();
      if (text.isEmpty) return;
      _inputCtrl.text = text;
      _inputCtrl.selection = TextSelection.collapsed(offset: text.length);
      setState(() => _drafted = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, "Artha couldn't write a reply right now."))),
        );
      }
    } finally {
      if (mounted) setState(() => _drafting = false);
    }
  }

  Widget _draftRow(WaTheme wa) => ValueListenableBuilder<TextEditingValue>(
        valueListenable: _inputCtrl,
        builder: (context, value, _) {
          final empty = value.text.trim().isEmpty;
          if (empty && _drafted) _drafted = false;
          const accent = Color(0xFFC2410C);
          final fg = wa.isDark ? const Color(0xFFFF8A3D) : accent;
          return Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(children: [
              if (_drafted && !empty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.30)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const CircleAvatar(radius: 8, backgroundImage: AssetImage('assets/images/ai_avatar.png')),
                    const SizedBox(width: 6),
                    Text('Draft by Artha · edit, then send', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
                  ]),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () {
                    _inputCtrl.clear();
                    setState(() => _drafted = false);
                  },
                  child: Text('Clear', style: TextStyle(color: wa.timeText, fontWeight: FontWeight.w600)),
                ),
              ] else if (empty)
                OutlinedButton.icon(
                  onPressed: _drafting ? null : _draftReply,
                  icon: _drafting
                      ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
                      : Icon(Icons.auto_awesome_rounded, size: 16, color: fg),
                  label: Text(_drafting ? 'Drafting…' : 'Draft reply with Artha',
                      style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.08),
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.30)),
                    minimumSize: const Size(0, 38),
                    shape: const StadiumBorder(),
                  ),
                ),
            ]),
          );
        },
      );

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

  bool _startingFlow = false;

  // Manual recovery for a lead whose agent's button flow never actually
  // fired for them (test numbers left set, ad id not yet routed, or any
  // other gating condition) — they got the plain chat instead. A human
  // clicking this is a stronger signal than the automatic heuristics, so
  // the backend starts the flow regardless of them. Mirrors Inbox.jsx's
  // startQualificationFlow.
  Future<void> _startQualificationFlow() async {
    if (_conv == null || _startingFlow) return;
    setState(() => _startingFlow = true);
    try {
      await _api.dio.post(
        '/whatsapp/conversations/${widget.conversationId}/start-flow',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Qualification flow started')),
        );
        await _load(silent: true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Could not start the flow')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _startingFlow = false);
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

  // "+91 98230 05959 · Contacted · Medium priority", like the web header.
  String _headerSubtitle(Map<String, dynamic>? lead) {
    final raw = (_conv?['contactPhone'] as String?) ?? (lead?['phone'] as String?) ?? '';
    final phone = raw.isEmpty ? '' : (raw.startsWith('+') ? raw : '+$raw');
    final status = (lead?['status'] as String?) ?? '';
    final priority = (lead?['priority'] as String?) ?? '';
    return [
      phone,
      status,
      if (priority.isNotEmpty) priority,
    ].where((e) => e.isNotEmpty).join(' · ');
  }

  Widget _headerChip(
    WaTheme wa, {
    required IconData icon,
    required String label,
    required bool strong,
    required VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: strong ? 0.24 : 0.12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: wa.headerFg),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: wa.headerFg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
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

    if (type == 'video') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => _openMedia(url),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              width: 230,
              height: 130,
              decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(8)),
              alignment: Alignment.center,
              child: const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 44),
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
    // An agent only sees chats assigned to them, so releasing one hands it
    // back to the team and closes it for them. Say so first.
    final agentReleasing = mine && auth.role == 'agent';
    if (agentReleasing) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Release this chat?'),
          content: const Text(
            'It goes back to the team as unassigned and will leave your Inbox. An admin or manager can assign it again.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Release')),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    try {
      final res = await _api.dio.patch(
        '/whatsapp/conversations/${widget.conversationId}',
        data: {'assignedTo': mine ? null : myId},
      );
      if (mounted && agentReleasing) {
        // No access once released: leave instead of polling into a 404.
        _poll?.cancel();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Released. The chat is back with the team.')),
        );
        Navigator.of(context).pop();
        return;
      }
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

  void _keepPinned() {
    final until = _pinToBottomUntil;
    if (!mounted || until == null || DateTime.now().isAfter(until)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  Future<void> _loadOlder() async {
    if (_loadingOlder || _messages.isEmpty) return;
    final first = _messages.first;
    setState(() => _loadingOlder = true);
    final before = _scroll.hasClients ? _scroll.position.maxScrollExtent : 0.0;
    final at = _scroll.hasClients ? _scroll.position.pixels : 0.0;
    try {
      final res = await _api.dio.get(
        '/whatsapp/conversations/${widget.conversationId}/messages',
        queryParameters: {'before': first['timestamp'], 'beforeId': first['_id']},
      );
      final older = (res.data['messages'] as List? ?? []).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        final ids = {for (final m in _messages) m['_id']};
        _messages.insertAll(0, older.where((m) => !ids.contains(m['_id'])));
        _hasOlder = res.data['hasMore'] == true;
      });
      // Keep the reader's place: the thread grows above them.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.jumpTo(at + _scroll.position.maxScrollExtent - before);
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Could not load earlier messages')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
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
    final windowLeft = _windowLeft;
    final windowOpen = windowLeft > Duration.zero;
    final templateOnly = _windowKnown && !windowOpen && _isMeta;
    final firstName = _liveDisplayName.trim().split(RegExp(r'\s+')).first;
    final freeLeft = ((_credits?['freeService'] as Map?)?['remaining'] as num?)?.toInt() ?? 0;
    final byMeta = _credits?['billedDirectlyByMeta'] == true;
    final serviceRate = ((_credits?['ratesPaise'] as Map?)?['service'] as num?) ?? 0;
    final hint = byMeta
        ? 'Billed directly to your own account, not through credits'
        : freeLeft > 0
            ? '$freeLeft free replies left this month'
            : serviceRate > 0
                ? '₹${(serviceRate / 100).toStringAsFixed(2)} per reply'
                : '';
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
      backgroundColor: AppTheme.of(context).bg,
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
            const SizedBox(width: 12),
            // The name and number get the whole width: the controls live on
            // their own row underneath, so no phone size can squeeze them out.
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
                  if (_headerSubtitle(lead).isNotEmpty)
                    Text(
                      _headerSubtitle(lead),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: wa.headerFgSoft),
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
              icon: Icon(Icons.open_in_new_rounded, color: wa.headerFg),
            ),
          const SizedBox(width: 4),
        ],
        bottom: _conv == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(46),
                child: SizedBox(
                  height: 46,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 0, 12, 8),
                    children: [
                      _headerChip(
                        wa,
                        icon: Icons.assignment_ind_outlined,
                        label: assignedName == null
                            ? 'Unassigned'
                            : (assignedToMe ? 'You' : assignedName),
                        strong: assignedName != null,
                        onTap: _toggleAssignToMe,
                      ),
                      _headerChip(
                        wa,
                        icon: botEnabled ? Icons.smart_toy : Icons.person,
                        label: botEnabled ? 'Bot ON' : 'Manual',
                        strong: botEnabled,
                        onTap: _toggleBot,
                      ),
                      if ((_conv!['flowState'] as Map?)?['step'] == null)
                        _headerChip(
                          wa,
                          icon: Icons.checklist_rounded,
                          label: _startingFlow ? 'Starting…' : 'Start qualification flow',
                          strong: false,
                          onTap: _startingFlow ? null : _startQualificationFlow,
                        ),
                    ],
                  ),
                ),
              ),
      ),
      body: Column(
        children: [
          if (lead != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
              child: ArthaSuggestCard(
                key: ValueKey('${lead['_id']}:${(lead['arthaSuggest'] as Map?)?['at'] ?? ''}'),
                lead: {...lead, '_type': 'lead'},
                onChanged: (updated) {
                  if (updated != null && mounted) {
                    setState(() => _conv = {...?_conv, 'leadId': {...lead, ...updated}});
                  } else {
                    _load(silent: true);
                  }
                },
              ),
            ),
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppTheme.of(context).bg,
                image: DecorationImage(
                  image: AssetImage(wa.isDark ? 'assets/images/wa_bg_dark.webp' : 'assets/images/wa_bg_light.webp'),
                  repeat: ImageRepeat.repeat,
                  alignment: Alignment.topLeft,
                  scale: 4,
                ),
              ),
              child: _loading
                ? const Center(child: AppSpinner(size: 32))
                : _messages.isEmpty
                ? Center(
                    child: Text(
                      'No messages yet',
                      style: TextStyle(color: wa.timeText),
                    ),
                  )
                : NotificationListener<UserScrollNotification>(
                    // The user took over: stop pinning to the bottom.
                    onNotification: (_) {
                      _pinToBottomUntil = null;
                      return false;
                    },
                    child: ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 12,
                    ),
                    itemCount: _messages.length + (_hasOlder ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (_hasOlder && index == 0) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Center(
                            child: _loadingOlder
                                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                                : TextButton.icon(
                                    onPressed: _loadOlder,
                                    icon: const Icon(Icons.history_rounded, size: 16),
                                    label: const Text('Load earlier messages'),
                                  ),
                          ),
                        );
                      }
                      final i = _hasOlder ? index - 1 : index;
                      final m = _messages[i];
                      final outbound = m['direction'] == 'outbound';
                      final isBot = m['sender'] == 'bot';
                      final bubble = Align(
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
                      if (!startsNewDay(_messages, i)) return bubble;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          DayDivider(date: DateTime.parse(m['timestamp'] as String).toLocal()),
                          bubble,
                        ],
                      );
                    },
                  )),
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
                  : templateOnly
                  ? _templateOnlyBar(wa, firstName)
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_windowKnown && !windowOpen)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.schedule, size: 14, color: Color(0xFFB45309)),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    "More than 24 hours since they last wrote — WhatsApp will only deliver an approved template. Send one from your provider's dashboard.",
                                    style: const TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (_canDraft && windowOpen) _draftRow(wa),
                        Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (_isMeta && windowOpen)
                            IconButton(
                              icon: const Icon(Icons.attach_file_rounded),
                              tooltip: 'Send project files',
                              onPressed: _openMediaSheet,
                            ),
                          if (_isMeta)
                            IconButton(
                              icon: const Icon(Icons.bolt, color: Color(0xFFF59E0B)),
                              tooltip: 'Send a template',
                              onPressed: _openTemplateSheet,
                            ),
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
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 2, 16, 6),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text.rich(
                              TextSpan(
                                text: hint,
                                children: [
                                  if (windowOpen)
                                    TextSpan(
                                      text: '${hint.isNotEmpty ? ' · ' : ''}reply window closes in ${_fmtLeft(windowLeft)}',
                                      style: windowLeft < const Duration(hours: 2) ? const TextStyle(color: Color(0xFFB45309)) : null,
                                    ),
                                ],
                              ),
                              style: TextStyle(fontSize: 10.5, color: wa.timeText),
                            ),
                          ),
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
