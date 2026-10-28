import 'package:flutter/material.dart';

import '../core/theme.dart';

/// A call transcript as a chat: customer on the left, agent on the right.
/// Mirrors frontend/src/components/CallTranscript.jsx (28 Oct 2026): turns
/// come from the server (exact speakers for stereo Plivo recordings, an AI
/// split for mono ones); older calls only have plain text, shown as before.
class CallTranscriptView extends StatelessWidget {
  final Map meta;
  final String? agentName;
  const CallTranscriptView({super.key, required this.meta, this.agentName});

  static bool hasAny(Map meta) =>
      (meta['transcriptTurns'] is List && (meta['transcriptTurns'] as List).isNotEmpty) ||
      '${meta['transcript'] ?? ''}'.trim().isNotEmpty;

  static String _mmss(num s) => '${s ~/ 60}:${(s.floor() % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final turns = [
      for (final x in (meta['transcriptTurns'] as List?) ?? const [])
        if (x is Map) x.cast<String, dynamic>(),
    ];
    if (turns.isEmpty) {
      final text = '${meta['transcript'] ?? ''}'.trim();
      if (text.isEmpty) return const SizedBox.shrink();
      return Text(text, style: Theme.of(context).textTheme.bodySmall);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final turn in turns)
        Builder(builder: (context) {
          final agent = turn['speaker'] == 'agent';
          final start = turn['start'];
          return Align(
            alignment: agent ? Alignment.centerRight : Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.72),
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: agent ? AppColors.primary.withValues(alpha: 0.10) : t.surfaceHigh,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: agent ? AppColors.primary.withValues(alpha: 0.22) : t.border),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(
                      agent ? (agentName?.isNotEmpty == true ? agentName! : 'Agent') : 'Customer',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                        color: agent ? AppColors.primary : t.textSoft,
                      ),
                    ),
                    if (start is num) ...[
                      const SizedBox(width: 6),
                      Text(_mmss(start), style: TextStyle(fontSize: 10, color: t.textSoft)),
                    ],
                  ]),
                  const SizedBox(height: 2),
                  Text('${turn['text'] ?? ''}', style: TextStyle(fontSize: 13, color: t.text)),
                ]),
              ),
            ),
          );
        }),
      if (meta['transcriptMethod'] == 'ai_split')
        Text(
          'Who said what is worked out by AI from a single-track recording, so a line can occasionally be on the wrong side.',
          style: TextStyle(fontSize: 11, color: t.textSoft),
        ),
    ]);
  }
}
