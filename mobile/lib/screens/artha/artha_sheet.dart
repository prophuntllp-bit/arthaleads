import 'package:dio/dio.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/artha_stream.dart';
import '../../core/auth_state.dart';
import '../../core/copilot_pages.dart';
import '../../core/push_service.dart';
import '../../core/theme.dart';
import '../../widgets/report_message_button.dart';
import 'artha_help.dart';
import 'change_card.dart';
import 'voice_input.dart';

/// The lead Artha is looking at ("summarise this", "log a call").
class ArthaFocus {
  final String id;
  final String kind; // "lead" | "projectLead"
  final String name;
  const ArthaFocus({required this.id, required this.kind, required this.name});

  Map<String, String> toJson() => {'id': id, 'kind': kind, 'name': name};
}

/// Opens Artha as a bottom sheet over the current screen (Phase 4 design,
/// screen 1). Mirrors the web panel, frontend/src/components/HelpBot.jsx:
/// streamed answers from POST /copilot/chat with the lookups shown as steps,
/// names linked to their records, saved chats, starter buttons, ratings.
Future<void> showArthaSheet(BuildContext context,
    {String? navLabel, ArthaFocus? focus, String? ask, void Function(String label)? onNavigate}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.40),
    builder: (_) => ArthaSheet(navLabel: navLabel, focus: focus, ask: ask, onNavigate: onNavigate),
  );
}

class _Step {
  final String id;
  final String label;
  final String status; // running | done | error
  final int? count;
  const _Step(this.id, this.label, this.status, this.count);
}

class _Msg {
  final String role; // user | bot
  String text;
  String prompt;
  List<_Step> steps = [];
  List<Map<String, dynamic>> records = [];
  List<Map<String, dynamic>> choices = [];
  List<ChangeProposal> proposals = [];
  bool writesDisabled = false;
  bool streaming;

  /// Artha could not answer (not a refusal): offer "Raise a ticket".
  bool failed = false;

  /// A common-question answer: the screen its "Go there" opens.
  String? goto;
  String? turnId;
  String? rating;
  _Msg(this.role, this.text, {this.prompt = '', this.streaming = false});
}

class ArthaSheet extends StatefulWidget {
  final String? navLabel;
  final ArthaFocus? focus;

  /// A question to ask as soon as the sheet opens ("Plan my day").
  final String? ask;

  /// Opens a drawer screen by its label (the shell's); "Go there" needs it.
  final void Function(String label)? onNavigate;
  const ArthaSheet({super.key, this.navLabel, this.focus, this.ask, this.onNavigate});

  @override
  State<ArthaSheet> createState() => _ArthaSheetState();
}

class _ArthaSheetState extends State<ArthaSheet> {
  final _sheet = DraggableScrollableController();
  final _input = TextEditingController();
  final _inputFocus = FocusNode();
  final List<_Msg> _msgs = [];
  late final _voice = ArthaVoice(onHeard: _onHeard);
  List<String> _starters = [];
  String? _threadId;
  ArthaFocus? _focus;
  CancelToken? _cancel;
  bool _busy = false;

  bool _showHistory = false;
  bool _loadingHistory = false;
  List<Map<String, dynamic>> _threads = [];
  List<Map<String, dynamic>> _changes = []; // what Artha applied (GET /copilot/actions)

  ScrollController? _scroll;

  String get _page => copilotPageFor(widget.navLabel)?.path ?? '/dashboard';

  @override
  void initState() {
    super.initState();
    _focus = widget.focus;
    _inputFocus.addListener(() {
      // Typing wants room: the keyboard takes half the screen.
      if (_inputFocus.hasFocus && _sheet.isAttached && _sheet.size < 0.9) {
        _sheet.animateTo(0.94, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      }
    });
    _loadStarters();
    _voice.loadLocale();
    if (widget.ask != null) WidgetsBinding.instance.addPostFrameCallback((_) => _ask(widget.ask));
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _voice.dispose();
    _sheet.dispose();
    _input.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  Future<void> _loadStarters() async {
    try {
      final res = await ApiClient.instance.dio.get('/copilot/starters', queryParameters: {'page': _page});
      final list = (res.data['starters'] as List?)?.whereType<String>().toList() ?? [];
      if (mounted) setState(() => _starters = list);
    } catch (_) {
      // Starters are a convenience; the box still works without them.
    }
  }

  // ── Asking ───────────────────────────────────────────────────────────────

  Future<void> _ask([String? override]) async {
    final q = (override ?? _input.text).trim();
    if (q.isEmpty || _busy) return;
    if (override == null) _input.clear();
    // The answer (and any change card) needs the room the keyboard takes.
    _inputFocus.unfocus();
    final bot = _Msg('bot', '', prompt: q, streaming: true);
    setState(() {
      _showHistory = false;
      _msgs.add(_Msg('user', q));
      _msgs.add(bot);
      _busy = true;
    });
    _toBottom();
    final cancel = CancelToken();
    _cancel = cancel;
    try {
      await streamArtha({
        'question': q,
        'page': _page,
        if (_threadId != null) 'threadId': _threadId,
        if (_focus != null) 'focus': _focus!.toJson(),
      }, (ev) => _onEvent(bot, ev), cancel: cancel);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        bot.text = bot.text.isEmpty ? 'Stopped.' : '${bot.text}\n\n(Stopped.)';
      } else {
        bot.text = "Couldn't reach Artha. Check your internet and try again.";
        bot.failed = true;
      }
    } on ArthaRefused catch (e) {
      bot.text = e.message;
    } catch (_) {
      bot.text = bot.text.isEmpty ? "Sorry, I couldn't reach Artha. Please try again." : bot.text;
      bot.failed = true;
    } finally {
      bot.streaming = false;
      // A step still "running" when the stream ended did not finish.
      bot.steps = [for (final s in bot.steps) s.status == 'running' ? _Step(s.id, s.label, 'error', s.count) : s];
      if (mounted) setState(() => _busy = false);
      _cancel = null;
    }
  }

  void _onEvent(_Msg bot, Map<String, dynamic> ev) {
    if (!mounted) return;
    setState(() {
      switch (ev['type']) {
        case 'start':
          _threadId = ev['threadId'] as String? ?? _threadId;
        case 'step':
          final id = '${ev['id']}';
          final step = _Step(id, '${ev['label'] ?? ''}', '${ev['status'] ?? 'running'}', (ev['count'] as num?)?.toInt());
          final i = bot.steps.indexWhere((s) => s.id == id);
          if (i >= 0) {
            bot.steps[i] = step;
          } else {
            bot.steps.add(step);
          }
        case 'text':
          bot.text = _tidy('${bot.text}${ev['delta'] ?? ''}');
        case 'records':
          bot.records = _maps(ev['records']);
        case 'choice':
          final c = ev['choice'];
          if (c is Map) bot.choices.add(c.cast<String, dynamic>());
        case 'proposal':
          final p = ev['proposal'];
          if (p is Map && p['type'] is String) {
            final card = ChangeProposal(
              type: p['type'] as String,
              params: ((p['params'] as Map?) ?? const {}).cast<String, dynamic>(),
              page: _page,
              prompt: bot.prompt,
              threadId: _threadId,
            );
            bot.proposals.add(card);
            card.loadPreview();
          }
        case 'done':
          bot.streaming = false;
          bot.turnId = ev['turnId'] as String?;
          final text = ev['text'] as String?;
          if (text != null && text.isNotEmpty) bot.text = _tidy(text);
          if (ev['records'] is List) bot.records = _maps(ev['records']);
          if (ev['writesDisabled'] == true) {
            bot.writesDisabled = true;
            bot.proposals = [
              for (final c in bot.proposals)
                ChangeProposal(type: c.type, params: c.params, page: c.page, prompt: c.prompt, threadId: c.threadId, writesDisabled: true)
                  ..loadPreview(),
            ];
          }
        case 'error':
          bot.streaming = false;
          bot.text = '${ev['message'] ?? 'Something went wrong. Please try again.'}';
          bot.failed = true;
      }
    });
    _toBottom();
  }

  void _stop() => _cancel?.cancel();

  /// What the mic heard goes into the box, after anything already typed, to
  /// be read and sent by the person; it is never sent by itself.
  void _onHeard(String heard) {
    final before = _input.text.trimRight();
    _input.text = before.isEmpty ? heard : '$before $heard';
    _input.selection = TextSelection.collapsed(offset: _input.text.length);
    setState(() {});
  }

  static List<Map<String, dynamic>> _maps(dynamic v) =>
      v is List ? [for (final x in v) if (x is Map) x.cast<String, dynamic>()] : [];

  /// Same clean-up as the web: no markdown stars, no em or en dashes.
  static String _tidy(String t) => t
      .replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => m[1]!)
      .replaceAllMapped(RegExp(r'\*(.+?)\*'), (m) => m[1]!)
      .replaceAll('—', '-')
      .replaceAll('–', '-')
      .replaceAll(RegExp(r'[ \t]+,'), ',')
      .replaceAll(RegExp(r',[ \t]{2,}'), ', ');

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final s = _scroll;
      if (s != null && s.hasClients) {
        s.animateTo(s.position.maxScrollExtent, duration: const Duration(milliseconds: 180), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _rate(_Msg m, String value) async {
    if (_threadId == null || m.turnId == null) return;
    final next = m.rating == value ? null : value;
    setState(() => m.rating = next);
    try {
      await ApiClient.instance.dio.post('/copilot/threads/$_threadId/turns/${m.turnId}/rating', data: {'rating': next});
    } catch (_) {}
  }

  // ── Saved chats ──────────────────────────────────────────────────────────

  Future<void> _openHistory() async {
    setState(() {
      _showHistory = true;
      _loadingHistory = true;
    });
    try {
      final res = await ApiClient.instance.dio.get('/copilot/threads');
      _threads = _maps(res.data['threads']);
    } catch (_) {
      _threads = [];
    }
    try {
      final res = await ApiClient.instance.dio.get('/copilot/actions', queryParameters: {'limit': 30});
      _changes = _maps(res.data['actions']);
    } catch (_) {
      _changes = [];
    }
    if (mounted) setState(() => _loadingHistory = false);
  }

  Future<void> _loadThread(String id) async {
    try {
      final res = await ApiClient.instance.dio.get('/copilot/threads/$id');
      final t = (res.data['thread'] as Map?)?.cast<String, dynamic>();
      if (t == null || !mounted) return;
      final turns = _maps(t['turns']);
      final msgs = <_Msg>[];
      var lastQ = '';
      for (final x in turns) {
        if (x['role'] == 'user') {
          lastQ = '${x['text'] ?? ''}';
          msgs.add(_Msg('user', lastQ));
        } else {
          final m = _Msg('bot', _tidy('${x['text'] ?? ''}'), prompt: lastQ)
            ..turnId = x['id'] as String?
            ..rating = x['rating'] as String?
            ..records = _maps(x['records']);
          final steps = x['steps'];
          if (steps is List) {
            var k = 0;
            for (final s in steps) {
              m.steps.add(_Step('${k++}', s is Map ? '${s['label'] ?? ''}' : '$s', 'done', null));
            }
          }
          msgs.add(m);
        }
      }
      setState(() {
        _threadId = id;
        _msgs
          ..clear()
          ..addAll(msgs);
        _showHistory = false;
      });
      _toBottom();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't open that chat.")));
    }
  }

  Future<void> _deleteThread(String id) async {
    setState(() => _threads.removeWhere((t) => t['id'] == id));
    if (_threadId == id) _newChat();
    try {
      await ApiClient.instance.dio.delete('/copilot/threads/$id');
    } catch (_) {}
  }

  void _newChat() {
    _cancel?.cancel();
    setState(() {
      _msgs.clear();
      _threadId = null;
      _showHistory = false;
    });
  }

  // ── Opening a linked record ──────────────────────────────────────────────

  Future<void> _openRecord(Map<String, dynamic> r) async {
    final kind = r['kind'];
    final id = '${r['id'] ?? ''}';
    final nav = Navigator.of(context);
    if (kind == 'task') {
      nav.pop();
      PushService.instance.pendingRoute.value = '/tasks';
      return;
    }
    if (kind == 'projectLead') {
      try {
        final res = await ApiClient.instance.dio.get('/projects/lead/$id');
        final pid = '${(res.data['data'] as Map?)?['projectId'] ?? ''}';
        if (pid.isEmpty) return;
        nav.pop();
        PushService.instance.pendingRoute.value = '/projects/$pid';
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't open that lead.")));
      }
      return;
    }
    nav.pop();
    PushService.instance.pendingTarget.value = {'leadId': id};
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return DraggableScrollableSheet(
      controller: _sheet,
      initialChildSize: widget.focus != null ? 0.62 : 0.86,
      minChildSize: 0.35,
      maxChildSize: 0.94,
      snap: true,
      snapSizes: const [0.62, 0.94],
      expand: false,
      builder: (context, scroll) {
        _scroll = scroll;
        return Container(
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.modal)),
            border: t.isDark ? Border(top: BorderSide(color: t.border)) : null,
          ),
          child: Padding(
            padding: EdgeInsets.only(bottom: bottomInset),
            child: Column(
              children: [
                _grabber(t),
                _header(t),
                Divider(height: 1, color: t.border),
                Expanded(child: _showHistory ? _history(t, scroll) : _conversation(t, scroll)),
                _composer(t),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _grabber(AppTheme t) => Padding(
        padding: const EdgeInsets.only(top: 10, bottom: 4),
        child: Container(
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: t.isDark ? Colors.white.withValues(alpha: 0.22) : const Color(0xFFD9D3CB),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      );

  Color _link(AppTheme t) => t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C);

  Widget _header(AppTheme t) {
    final pageLabel = copilotPageFor(widget.navLabel)?.label;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 2, 4, 8),
      child: Row(
        children: [
          const CircleAvatar(radius: 18, backgroundImage: AssetImage('assets/images/ai_avatar.png')),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Artha', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: t.text)),
                const SizedBox(height: 2),
                if (_focus != null)
                  _contextPill(t, 'Lead · ${_focus!.name}', onClear: () => setState(() => _focus = null))
                else if (pageLabel != null)
                  _contextPill(t, 'Page · $pageLabel', muted: true),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Chat history',
            onPressed: _showHistory ? () => setState(() => _showHistory = false) : _openHistory,
            icon: Icon(Icons.history_rounded, color: _showHistory ? AppColors.primary : t.textSoft),
          ),
          IconButton(
            tooltip: 'New chat',
            onPressed: _newChat,
            icon: Icon(Icons.add_rounded, color: t.textSoft),
          ),
        ],
      ),
    );
  }

  Widget _contextPill(AppTheme t, String label, {VoidCallback? onClear, bool muted = false}) {
    final fg = muted ? t.textSoft : _link(t);
    return Container(
      padding: EdgeInsets.fromLTRB(8, 1, onClear != null ? 2 : 8, 1),
      decoration: BoxDecoration(
        color: muted ? (t.isDark ? const Color(0xFF2A282E) : const Color(0xFFF4F1EC)) : AppColors.primary.withValues(alpha: 0.10),
        border: Border.all(color: muted ? t.border : AppColors.primary.withValues(alpha: 0.30)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
          ),
          if (onClear != null)
            Semantics(
              button: true,
              label: 'Stop focusing on this lead',
              child: InkWell(
                onTap: onClear,
                customBorder: const CircleBorder(),
                child: Padding(padding: const EdgeInsets.all(3), child: Icon(Icons.close_rounded, size: 12, color: fg)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _conversation(AppTheme t, ScrollController scroll) {
    if (_msgs.isEmpty) return _empty(t, scroll);
    return ListView.builder(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      itemCount: _msgs.length,
      itemBuilder: (_, i) {
        final m = _msgs[i];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: m.role == 'user' ? _userBubble(m) : _botMessage(t, m),
        );
      },
    );
  }

  Widget _empty(AppTheme t, ScrollController scroll) {
    final name = (context.read<AuthState>().user?['name'] as String? ?? '').split(' ').first.trim();
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      children: [
        Text(name.isEmpty ? 'Hi! What should we work on?' : 'Hi $name! What should we work on?',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: t.text)),
        const SizedBox(height: 6),
        Text(
          _focus != null
              ? 'Ask about ${_focus!.name}, or tell me what happened on the call.'
              : 'I can look up your leads, follow-ups and chats, and get changes ready for you to check.',
          style: TextStyle(fontSize: 14, height: 1.45, color: t.textSoft),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (_focus != null) ...[
              _chip(t, 'Summarise this lead', () => _ask('Summarise this lead')),
              _chip(t, 'Suggest the next step', () => _ask('What should I do next with this lead?')),
              _chip(t, 'Log a call', _startCallLog),
            ] else
              for (final s in _starters) _chip(t, s, () => _ask(s)),
          ],
        ),
        if (_focus == null) ...[
          const SizedBox(height: 18),
          _commonQuestions(t),
        ],
      ],
    );
  }

  bool _showCommon = false;

  /// "Common questions": instant answers, no AI call, as on the web.
  Widget _commonQuestions(AppTheme t) => Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: t.border)),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          InkWell(
            onTap: () => setState(() => _showCommon = !_showCommon),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(children: [
                  Icon(Icons.help_outline_rounded, size: 18, color: t.textSoft),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Common questions', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: t.textSoft))),
                  Icon(_showCommon ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: t.textSoft),
                ]),
              ),
            ),
          ),
          if (_showCommon)
            for (final item in arthaQuickAnswers) ...[
              Divider(height: 1, color: t.border),
              InkWell(
                onTap: () => _quick(item),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 46),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(children: [
                      Expanded(child: Text(item.q, style: TextStyle(fontSize: 13.5, color: t.text))),
                      Icon(Icons.arrow_forward_rounded, size: 16, color: t.textSoft),
                    ]),
                  ),
                ),
              ),
            ],
        ]),
      );

  void _quick(ArthaQuickAnswer item) {
    setState(() {
      _msgs.add(_Msg('user', item.q));
      _msgs.add(_Msg('bot', item.a)..goto = item.goto);
    });
    _toBottom();
  }

  Widget _helpActions(AppTheme t, _Msg m) {
    Widget button(IconData icon, String label, Color color, VoidCallback onTap) => Padding(
          padding: const EdgeInsets.only(top: 8, right: 8),
          child: OutlinedButton.icon(
            onPressed: onTap,
            icon: Icon(icon, size: 16),
            label: Text(label),
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              side: BorderSide(color: color.withValues(alpha: 0.35)),
              minimumSize: const Size(0, 40),
              shape: const StadiumBorder(),
            ),
          ),
        );
    return Wrap(children: [
      if (m.goto != null && widget.onNavigate != null)
        button(Icons.arrow_forward_rounded, 'Go to ${m.goto}', AppColors.primary, () {
          final label = m.goto!;
          Navigator.of(context).pop();
          widget.onNavigate!(label);
        }),
      if (m.failed) button(Icons.confirmation_number_outlined, 'Raise a ticket', AppColors.danger, () => _raiseTicket(m)),
    ]);
  }

  Future<void> _raiseTicket(_Msg m) async {
    final email = context.read<AuthState>().user?['email'] as String?;
    final number = await showArthaTicketSheet(context, subject: m.prompt);
    if (number == null || !mounted) return;
    setState(() {
      m.failed = false;
      final who = email ?? 'your email';
      final no = number.isEmpty ? '' : '$number ';
      _msgs.add(_Msg('bot', "Ticket ${no}raised. We'll get back to you at $who within 24 hours. You can follow it in Help & Support, under Contact & Tickets."));
    });
    _toBottom();
  }

  /// "Log a call" needs the person's own words ("interested in 2 BHK, visit
  /// Saturday 11"), so it starts the sentence instead of sending it.
  void _startCallLog() {
    _input.text = 'Called ${_focus?.name ?? 'them'}, ';
    _input.selection = TextSelection.collapsed(offset: _input.text.length);
    _inputFocus.requestFocus();
  }

  Widget _chip(AppTheme t, String label, VoidCallback onTap) => Material(
        color: t.isDark ? const Color(0xFF2A282E) : Colors.white,
        shape: StadiumBorder(side: BorderSide(color: t.borderStrong)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: _busy ? null : onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_awesome_rounded, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Flexible(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: t.text))),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _userBubble(_Msg m) => Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
            decoration: const BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(4),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Text(m.text,
                style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.5, fontWeight: FontWeight.w500)),
          ),
        ),
      );

  Widget _botMessage(AppTheme t, _Msg m) {
    final bubble = t.isDark ? const Color(0xFF2A282E) : const Color(0xFFF4F1EC);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CircleAvatar(radius: 14, backgroundImage: AssetImage('assets/images/ai_avatar.png')),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (m.steps.isNotEmpty) ...[
                Semantics(
                  label: 'What Artha checked',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [for (final s in m.steps) _stepLine(t, s)],
                  ),
                ),
                const SizedBox(height: 6),
              ],
              if (m.text.isNotEmpty || m.steps.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: bubble,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  child: m.text.isEmpty
                      ? const _TypingDots()
                      : Text.rich(_answerSpans(t, m), style: TextStyle(fontSize: 14, height: 1.5, color: t.text)),
                ),
              for (final c in m.choices) _choices(t, c),
              for (final p in m.proposals) ChangeCard(key: ObjectKey(p), p: p),
              if (m.proposals.length >= 2 && !m.writesDisabled) _applyAll(t, m),
              if (m.failed || (m.goto != null && widget.onNavigate != null)) _helpActions(t, m),
              // Not on the instant answers or the ticket note: no AI wrote those.
              if (!m.streaming && m.text.isNotEmpty && (m.turnId != null || m.prompt.isNotEmpty)) _feedbackRow(t, m),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stepLine(AppTheme t, _Step s) {
    final Widget icon = switch (s.status) {
      'running' => const SizedBox(
          width: 11, height: 11, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
      'error' => const Icon(Icons.error_outline_rounded, size: 13, color: AppColors.danger),
      _ => Icon(Icons.check_rounded, size: 14, color: t.isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A)),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        children: [
          SizedBox(width: 14, child: Center(child: icon)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              s.count != null ? '${s.label} · ${s.count}' : s.label,
              style: TextStyle(fontSize: 12, color: s.status == 'running' ? t.text : t.textSoft),
            ),
          ),
        ],
      ),
    );
  }

  /// The answer with every record name it mentions made tappable.
  TextSpan _answerSpans(AppTheme t, _Msg m) {
    final named = m.records.where((r) => ('${r['name'] ?? ''}').length > 1).toList()
      ..sort((a, b) => '${b['name']}'.length.compareTo('${a['name']}'.length));
    if (named.isEmpty) return TextSpan(text: m.text);
    final pattern = RegExp(named.map((r) => RegExp.escape('${r['name']}')).join('|'));
    final spans = <InlineSpan>[];
    var at = 0;
    for (final match in pattern.allMatches(m.text)) {
      if (match.start > at) spans.add(TextSpan(text: m.text.substring(at, match.start)));
      final r = named.firstWhere((x) => x['name'] == match[0]);
      spans.add(TextSpan(
        text: match[0],
        style: TextStyle(
          color: _link(t),
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
          decorationStyle: TextDecorationStyle.dotted,
          decorationColor: _link(t),
        ),
        recognizer: TapGestureRecognizer()..onTap = () => _openRecord(r),
      ));
      at = match.end;
    }
    if (at < m.text.length) spans.add(TextSpan(text: m.text.substring(at)));
    return TextSpan(children: spans);
  }

  /// "Which Rahul?": tapping one sends "name (detail)" as the next
  /// question, as on the web.
  Widget _choices(AppTheme t, Map<String, dynamic> c) {
    final options = _maps(c['options']);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final o in options)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Material(
                color: t.isDark ? const Color(0xFF18171A) : Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: t.borderStrong),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: _busy ? null : () => _ask('${o['name']} (${o['detail']})'),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 52),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('${o['name'] ?? ''}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text)),
                          if ('${o['detail'] ?? ''}'.isNotEmpty)
                            Text('${o['detail']}', style: TextStyle(fontSize: 12, color: t.textSoft)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Several changes in one answer: one tap applies the ones still waiting,
  /// one after another, each with its own receipt and Undo.
  Widget _applyAll(AppTheme t, _Msg m) => ListenableBuilder(
        listenable: Listenable.merge(m.proposals),
        builder: (context, _) {
          final waiting = m.proposals.where((p) => p.pending && !p.busy).toList();
          if (waiting.length < 2) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: OutlinedButton.icon(
              onPressed: () async {
                final messenger = ScaffoldMessenger.maybeOf(context);
                for (final p in waiting) {
                  final err = await p.apply();
                  if (err != null) {
                    messenger?.showSnackBar(SnackBar(content: Text(err)));
                    break;
                  }
                }
              },
              icon: const Icon(Icons.done_all_rounded, size: 18),
              label: Text('Apply all ${waiting.length} changes'),
              style: OutlinedButton.styleFrom(
                foregroundColor: _link(t),
                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.40)),
                minimumSize: const Size(0, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          );
        },
      );

  Widget _feedbackRow(AppTheme t, _Msg m) => Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Row(
          children: [
            if (m.turnId != null) ...[
              IconButton(
                tooltip: 'Helpful',
                visualDensity: VisualDensity.compact,
                onPressed: () => _rate(m, 'up'),
                icon: Icon(m.rating == 'up' ? Icons.thumb_up_alt_rounded : Icons.thumb_up_alt_outlined,
                    size: 16, color: m.rating == 'up' ? const Color(0xFF16A34A) : t.textSoft),
              ),
              IconButton(
                tooltip: 'Not helpful',
                visualDensity: VisualDensity.compact,
                onPressed: () => _rate(m, 'down'),
                icon: Icon(m.rating == 'down' ? Icons.thumb_down_alt_rounded : Icons.thumb_down_alt_outlined,
                    size: 16, color: m.rating == 'down' ? AppColors.danger : t.textSoft),
              ),
            ],
            // Play's AI-generated content policy: every answer can be flagged
            // without leaving the app.
            ReportMessageButton(reportedText: m.text, prompt: m.prompt, page: _page),
          ],
        ),
      );

  Widget _history(AppTheme t, ScrollController scroll) {
    if (_loadingHistory) return const Center(child: CircularProgressIndicator(strokeWidth: 2.4));
    final agent = context.read<AuthState>().role == 'agent';
    Widget heading(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(text.toUpperCase(),
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: t.textSoft)),
        );
    Widget divider() => Divider(height: 1, indent: 16, endIndent: 16, color: t.border);
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.only(bottom: 16),
      children: [
        heading('Past chats'),
        if (_threads.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text('No saved chats yet. Chats are kept for 90 days.', style: TextStyle(fontSize: 13, color: t.textSoft)),
          ),
        for (final (i, th) in _threads.indexed) ...[
          if (i > 0) divider(),
          ListTile(
            minVerticalPadding: 10,
            title: Text('${th['title'] ?? 'Chat'}',
                maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: t.text)),
            subtitle: Text(_when(th['lastMessageAt']), style: TextStyle(fontSize: 12, color: t.textSoft)),
            trailing: IconButton(
              tooltip: 'Delete this chat',
              onPressed: () => _deleteThread('${th['id']}'),
              icon: Icon(Icons.delete_outline_rounded, size: 20, color: t.textSoft),
            ),
            onTap: () => _loadThread('${th['id']}'),
          ),
        ],
        // The change log, as on the web: what was applied through Artha, by
        // whom. Agents see their own; managers and admins the team's.
        if (_changes.isNotEmpty) ...[
          const SizedBox(height: 8),
          heading(agent ? 'Changes Artha made for you' : 'Changes Artha made for your team'),
          for (final (i, c) in _changes.indexed) ...[
            if (i > 0) divider(),
            _changeRow(t, c),
          ],
        ],
      ],
    );
  }

  Widget _changeRow(AppTheme t, Map<String, dynamic> c) {
    final undone = c['undone'] == true;
    final text = '${c['message'] ?? ''}'.isNotEmpty ? '${c['message']}' : '${c['what'] ?? ''}';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(undone ? Icons.undo_rounded : Icons.check_circle_outline_rounded,
              size: 18, color: undone ? t.textSoft : AppColors.primary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.35,
                  color: undone ? t.textSoft : t.text,
                  decoration: undone ? TextDecoration.lineThrough : null,
                  decorationColor: t.textSoft,
                )),
            const SizedBox(height: 2),
            Text(
              [if ('${c['by'] ?? ''}'.isNotEmpty) '${c['by']}', _when(c['at']), if (undone) 'undone'].join(' · '),
              style: TextStyle(fontSize: 12, color: t.textSoft),
            ),
          ]),
        ),
      ]),
    );
  }

  /// "Thu 15 Oct, 5:00 pm" in IST, the way every date in Artha is shown.
  static String _when(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}');
    if (d == null) return '';
    final ist = d.toUtc().add(const Duration(hours: 5, minutes: 30));
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    final mm = ist.minute.toString().padLeft(2, '0');
    return '${days[ist.weekday - 1]} ${ist.day} ${months[ist.month - 1]}, $h:$mm ${ist.hour < 12 ? 'am' : 'pm'}';
  }

  Widget _composer(AppTheme t) => Column(mainAxisSize: MainAxisSize.min, children: [
        VoicePanel(voice: _voice),
        _composerBox(t),
      ]);

  Widget _composerBox(AppTheme t) => Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      focusNode: _inputFocus,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _ask(),
                      decoration: const InputDecoration(hintText: 'Ask or tell Artha what to do…'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  VoiceMicButton(voice: _voice, enabled: !_busy),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 48,
                    height: 48,
                    child: _busy
                        ? IconButton.filled(
                            tooltip: 'Stop the answer',
                            style: IconButton.styleFrom(backgroundColor: t.isDark ? const Color(0xFF2A282E) : const Color(0xFF18181B)),
                            onPressed: _stop,
                            icon: const Icon(Icons.stop_rounded, color: Colors.white),
                          )
                        : DecoratedBox(
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(colors: [AppColors.primaryDeep, AppColors.primary]),
                            ),
                            child: IconButton(
                              tooltip: 'Send',
                              onPressed: () => _ask(),
                              icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                            ),
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text('Artha can make mistakes. Check every change before applying.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: t.textSoft)),
            ],
          ),
        ),
      );
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();
  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = AppTheme.of(context).textSoft;
    return Semantics(
      label: 'Artha is writing',
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, _) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Opacity(
                  opacity: 0.3 + 0.7 * (((_c.value * 3) - i).abs() < 0.5 ? 1 : 0),
                  child: Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
