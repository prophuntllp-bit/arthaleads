import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import 'help_screen.dart';

class _ChatMessage {
  final String role; // 'user' | 'bot'
  final String text;
  final bool suggestTicket;
  final bool comingSoon;
  final Map<String, dynamic>? action;
  final bool actionDone;
  _ChatMessage({
    required this.role,
    required this.text,
    this.suggestTicket = false,
    this.comingSoon = false,
    this.action,
    this.actionDone = false,
  });
}

/// Artha — the AI help assistant. Mirrors frontend/src/components/HelpBot.jsx
/// (same /help/ask contract, same avatar, same "Artha" persona) — the tour/
/// Includes quick questions, ticket escalation, and confirmed CRM actions.
class ArthaChatScreen extends StatefulWidget {
  const ArthaChatScreen({super.key});

  @override
  State<ArthaChatScreen> createState() => _ArthaChatScreenState();
}

class _ArthaChatScreenState extends State<ArthaChatScreen> {
  final _api = ApiClient.instance;
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _loading = false;
  bool _actionLoading = false;

  static const _quickQuestions = [
    'What needs my attention today?',
    'Show my overdue follow-ups',
    'How is my pipeline performing?',
    'How do I add and assign a lead?',
  ];

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _ask([String? overrideText]) async {
    final q = (overrideText ?? _input.text).trim();
    if (q.isEmpty || _loading) return;
    if (overrideText == null) _input.clear();

    final history = _messages
        .skip(_messages.length > 6 ? _messages.length - 6 : 0)
        .map(
          (m) => {
            'role': m.role == 'bot' ? 'assistant' : 'user',
            'text': m.text,
          },
        )
        .toList();

    setState(() {
      _messages.add(_ChatMessage(role: 'user', text: q));
      _loading = true;
    });
    _scrollToBottom();

    try {
      final res = await _api.dio.post(
        '/help/ask',
        data: {'question': q, 'page': 'mobile', 'history': history},
      );
      setState(() {
        _messages.add(
          _ChatMessage(
            role: 'bot',
            text: (res.data['answer'] as String?) ?? "I'm not sure about that.",
            suggestTicket: res.data['suggestTicket'] == true,
            comingSoon: res.data['comingSoon'] == true,
            action: (res.data['action'] as Map?)?.cast<String, dynamic>(),
          ),
        );
      });
    } catch (e) {
      setState(() {
        _messages.add(
          _ChatMessage(
            role: 'bot',
            text: ApiClient.errorMessage(
              e,
              "Sorry, I couldn't reach the assistant. Try raising a support ticket.",
            ),
            suggestTicket: true,
          ),
        );
      });
    } finally {
      if (mounted) setState(() => _loading = false);
      _scrollToBottom();
    }
  }

  Future<void> _confirmAction(_ChatMessage message) async {
    final action = message.action;
    if (action == null || _actionLoading) return;
    setState(() => _actionLoading = true);
    try {
      final res = await _api.dio.post(
        '/help/action',
        data: {
          'type': action['type'],
          'params': action['params'] ?? <String, dynamic>{},
        },
      );
      final index = _messages.indexOf(message);
      if (index != -1) {
        setState(() {
          _messages[index] = _ChatMessage(
            role: message.role,
            text: message.text,
            suggestTicket: message.suggestTicket,
            comingSoon: message.comingSoon,
            action: message.action,
            actionDone: true,
          );
          _messages.add(
            _ChatMessage(
              role: 'bot',
              text: res.data['message']?.toString() ?? 'Done.',
            ),
          );
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Action failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _actionLoading = false);
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    final firstName = (user?['name'] as String? ?? '').split(' ').first;
    final greeting = firstName.isNotEmpty
        ? "Hi $firstName! I'm Artha, your CRM assistant. How can I help you today?"
        : "Hi! I'm Artha, your CRM assistant. How can I help you today?";

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            const CircleAvatar(
              radius: 18,
              backgroundImage: AssetImage('assets/images/ai_avatar.png'),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Artha',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
                Text(
                  'Help Assistant',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.all(12),
              children: [
                _BotBubble(text: greeting),
                if (_messages.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(36, 8, 4, 10),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _quickQuestions
                          .map(
                            (question) => ActionChip(
                              avatar: const Icon(Icons.auto_awesome, size: 14),
                              label: Text(
                                question,
                                style: const TextStyle(fontSize: 11),
                              ),
                              onPressed: _loading ? null : () => _ask(question),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                for (final m in _messages)
                  m.role == 'user'
                      ? _UserBubble(text: m.text)
                      : _BotBubble(
                          message: m,
                          actionLoading: _actionLoading,
                          onAction: () => _confirmAction(m),
                        ),
                if (_loading) const _TypingBubble(),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      enabled: !_loading,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _ask(),
                      decoration: const InputDecoration(
                        hintText: 'Ask anything about the CRM...',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _loading ? null : () => _ask(),
                    icon: const Icon(Icons.send_rounded),
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

class _UserBubble extends StatelessWidget {
  final String text;
  const _UserBubble({required this.text});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(2),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
        ),
        child: Text(text, style: const TextStyle(color: Colors.white)),
      ),
    );
  }
}

class _BotBubble extends StatelessWidget {
  final String? text;
  final _ChatMessage? message;
  final bool actionLoading;
  final VoidCallback? onAction;
  const _BotBubble({
    this.text,
    this.message,
    this.actionLoading = false,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final m = message;
    final body = text ?? m!.text;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CircleAvatar(
            radius: 14,
            backgroundImage: AssetImage('assets/images/ai_avatar.png'),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (m?.comingSoon == true)
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Text(
                      'COMING SOON',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).colorScheme.surfaceContainerHighest,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(2),
                      topRight: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  child: Text(body),
                ),
                if (m?.suggestTicket == true)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const HelpScreen()),
                      ),
                      icon: const Icon(
                        Icons.confirmation_number_outlined,
                        size: 16,
                      ),
                      label: const Text('Raise a ticket'),
                      style: OutlinedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                      ),
                    ),
                  ),
                if (m?.action != null && m?.actionDone != true)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: FilledButton.icon(
                      onPressed: actionLoading ? null : onAction,
                      icon: actionLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.check_circle_outline, size: 16),
                      label: Text(
                        actionLoading
                            ? 'Working...'
                            : 'Do it — ${m?.action?['label'] ?? 'Confirm action'}',
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CircleAvatar(
            radius: 14,
            backgroundImage: AssetImage('assets/images/ai_avatar.png'),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(2),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: const SizedBox(
              width: 24,
              height: 12,
              child: Center(
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
