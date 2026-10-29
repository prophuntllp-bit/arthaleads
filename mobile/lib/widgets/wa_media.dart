import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

/// What a WhatsApp message carries besides text, shared by the WhatsApp chat
/// and the lead's WhatsApp tab. Mirrors frontend/src/components/
/// WaMessageMedia.jsx (22-23 Oct 2026): customer files are saved on arrival,
/// voice notes are written out (msg.transcript), and older files that were
/// never saved say so instead of leaving an empty bubble.

const _labels = {'image': 'Image', 'video': 'Video', 'audio': 'Voice note', 'document': 'Document', 'sticker': 'Sticker'};
const _missing = {
  'image': 'Photo (not saved). Ask them to send it again.',
  'video': 'Video (not saved). Ask them to send it again.',
  'audio': 'Voice note (not saved). Ask them to send it again.',
  'document': 'Document (not saved). Ask them to send it again.',
};

/// The text under the media: the caption, without the "[Image]" tag the
/// server keeps in front of it. Plain text messages are unchanged.
String waMessageText(Map message) {
  final body = '${message['body'] ?? ''}';
  final label = _labels[message['mediaType']];
  if (label == null) return body;
  return body.replaceFirst(RegExp('^\\[${RegExp.escape(label)}\\]\\s*'), '').trim();
}

/// "Voice note (not saved)…" for a media message whose file was never kept,
/// else null.
String? waMissingMedia(Map message) {
  final url = '${message['mediaUrl'] ?? ''}';
  if (url.isNotEmpty) return null;
  return _missing[message['mediaType']];
}

/// A voice note: play/pause, a progress bar, and what was said underneath.
class WaVoiceNote extends StatefulWidget {
  final String url;
  final String? transcript;
  final Color ink;
  final Color soft;
  const WaVoiceNote({super.key, required this.url, this.transcript, required this.ink, required this.soft});

  @override
  State<WaVoiceNote> createState() => _WaVoiceNoteState();
}

class _WaVoiceNoteState extends State<WaVoiceNote> {
  AudioPlayer? _player;
  bool _loading = false;
  bool _failed = false;

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_player == null) {
      setState(() {
        _loading = true;
        _failed = false;
      });
      final p = AudioPlayer();
      try {
        await p.setUrl(widget.url);
        _player = p;
      } catch (_) {
        await p.dispose();
        if (mounted) setState(() => _failed = true);
        return;
      } finally {
        if (mounted) setState(() => _loading = false);
      }
      p.playerStateStream.listen((s) {
        if (s.processingState == ProcessingState.completed) {
          p.pause();
          p.seek(Duration.zero);
        }
        if (mounted) setState(() {});
      });
    }
    final p = _player!;
    p.playing ? await p.pause() : await p.play();
    if (mounted) setState(() {});
  }

  static String _mmss(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final p = _player;
    final transcript = (widget.transcript ?? '').trim();
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 240),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(
            width: 38,
            height: 38,
            child: _loading
                ? Padding(padding: const EdgeInsets.all(9), child: CircularProgressIndicator(strokeWidth: 2, color: widget.ink))
                : IconButton(
                    padding: EdgeInsets.zero,
                    tooltip: p?.playing == true ? 'Pause' : 'Play voice note',
                    icon: Icon(p?.playing == true ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                        size: 34, color: widget.ink),
                    onPressed: _toggle,
                  ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: p == null
                ? Text(_failed ? "Couldn't play. Tap to try again." : 'Voice note',
                    style: TextStyle(fontSize: 12.5, color: widget.soft))
                : StreamBuilder<Duration>(
                    stream: p.positionStream,
                    builder: (context, snap) {
                      final total = p.duration ?? Duration.zero;
                      final pos = snap.data ?? Duration.zero;
                      final v = total.inMilliseconds == 0 ? 0.0 : (pos.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
                      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        LinearProgressIndicator(
                          value: v,
                          minHeight: 3,
                          color: widget.ink,
                          backgroundColor: widget.soft.withValues(alpha: 0.3),
                        ),
                        const SizedBox(height: 3),
                        Text('${_mmss(pos)} / ${_mmss(total)}', style: TextStyle(fontSize: 10.5, color: widget.soft)),
                      ]);
                    },
                  ),
          ),
        ]),
        // What was said, written out on arrival (backend utils/transcribe.js).
        if (transcript.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('"$transcript"', style: TextStyle(fontSize: 12.5, fontStyle: FontStyle.italic, color: widget.ink.withValues(alpha: 0.85))),
        ],
      ]),
    );
  }
}
