import 'dart:async';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/theme.dart';

/// Hold-to-talk for Artha (Phase 4 design, screen 4). The phone's own speech
/// recogniser turns speech into text; nothing is recorded or sent anywhere by
/// the app itself. What was heard lands in the message box to be read and
/// edited before it is sent, never sent on its own.
class ArthaVoice extends ChangeNotifier {
  ArthaVoice();

  static const _prefKey = 'artha_voice_locale';

  /// en_IN also writes Hinglish in Latin letters ("kal shaam 5 baje"), which
  /// is what Artha reads best; hi_IN writes Devanagari.
  static const locales = {'en_IN': 'English (India)', 'hi_IN': 'हिन्दी'};

  final _stt = SpeechToText();
  bool _ready = false;

  String locale = 'en_IN';
  bool listening = false;
  bool cancelling = false;
  String words = '';
  double level = 0;
  Duration elapsed = Duration.zero;
  Timer? _clock;
  Completer<void>? _final;

  Future<void> loadLocale() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_prefKey);
      if (saved != null && locales.containsKey(saved)) locale = saved;
    } catch (_) {}
    notifyListeners();
  }

  Future<void> setLocale(String id) async {
    locale = id;
    notifyListeners();
    try {
      await (await SharedPreferences.getInstance()).setString(_prefKey, id);
    } catch (_) {}
  }

  /// Starts listening. Returns why it could not, or null when it started.
  /// The first call shows Android's microphone permission prompt.
  Future<VoiceProblem?> start() async {
    if (listening) return null;
    if (!_ready) {
      try {
        _ready = await _stt.initialize(onError: _onError, onStatus: _onStatus);
      } on PlatformException {
        _ready = false;
      }
      if (!_ready) {
        return await _stt.hasPermission ? VoiceProblem.unavailable : VoiceProblem.noPermission;
      }
    }
    words = '';
    level = 0;
    cancelling = false;
    elapsed = Duration.zero;
    listening = true;
    _final = Completer<void>();
    notifyListeners();
    HapticFeedback.mediumImpact();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      elapsed += const Duration(seconds: 1);
      notifyListeners();
    });
    await _stt.listen(
      onResult: (r) {
        words = r.recognizedWords;
        if (r.finalResult && !(_final?.isCompleted ?? true)) _final!.complete();
        notifyListeners();
      },
      onSoundLevelChange: (l) {
        level = l;
        notifyListeners();
      },
      listenOptions: SpeechListenOptions(
        localeId: locale,
        partialResults: true,
        listenMode: ListenMode.dictation,
        cancelOnError: true,
        // A hold can be a long sentence with pauses while thinking.
        listenFor: const Duration(minutes: 2),
        pauseFor: const Duration(seconds: 8),
      ),
    );
    return null;
  }

  /// The finger lifted: stop, and give back what was heard once the
  /// recogniser has sent its final words (it arrives just after stopping).
  Future<String> stop() async {
    if (!listening) return '';
    _clock?.cancel();
    await _stt.stop();
    try {
      await _final?.future.timeout(const Duration(milliseconds: 1500));
    } catch (_) {}
    listening = false;
    level = 0;
    notifyListeners();
    return words.trim();
  }

  /// Slid off the mic: discard what was heard.
  Future<void> cancel() async {
    _clock?.cancel();
    await _stt.cancel();
    listening = false;
    words = '';
    level = 0;
    notifyListeners();
  }

  void markCancelling(bool on) {
    if (cancelling == on) return;
    cancelling = on;
    if (on) HapticFeedback.selectionClick();
    notifyListeners();
  }

  void _onError(SpeechRecognitionError e) {
    // "No match" just means nothing was heard; the panel says so.
    if (!(_final?.isCompleted ?? true)) _final!.complete();
  }

  void _onStatus(String status) {
    if ((status == 'done' || status == 'notListening') && !(_final?.isCompleted ?? true) && !listening) {
      _final!.complete();
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _stt.cancel();
    super.dispose();
  }
}

enum VoiceProblem { noPermission, unavailable }

/// The mic beside the message box: hold to talk, let go to stop, slide
/// away to cancel. A short tap explains that and lets the person pick the
/// language.
class VoiceMicButton extends StatelessWidget {
  final ArthaVoice voice;
  final bool enabled;
  final ValueChanged<String> onHeard;
  const VoiceMicButton({super.key, required this.voice, required this.onHeard, this.enabled = true});

  static const _cancelDistance = 90.0;

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        final on = voice.listening;
        return Semantics(
          button: true,
          label: 'Hold to talk to Artha',
          child: GestureDetector(
            onTap: enabled ? () => _showHelp(context) : null,
            onLongPressStart: enabled ? (_) => _start(context) : null,
            onLongPressMoveUpdate: (d) => voice.markCancelling(d.offsetFromOrigin.distance > _cancelDistance),
            onLongPressEnd: (_) async {
              if (voice.cancelling) {
                await voice.cancel();
                return;
              }
              final heard = await voice.stop();
              if (heard.isNotEmpty) onHeard(heard);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: on ? 56 : 48,
              height: on ? 56 : 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: on ? const LinearGradient(colors: [AppColors.primaryDeep, AppColors.primary]) : null,
                color: on ? null : (t.isDark ? const Color(0xFF2A282E) : Colors.white),
                border: on ? null : Border.all(color: t.borderStrong),
                boxShadow: on
                    ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.18), spreadRadius: 6 + voice.level.clamp(0, 10))]
                    : null,
              ),
              child: Icon(Icons.mic_rounded,
                  size: 22, color: on ? Colors.white : (t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C))),
            ),
          ),
        );
      },
    );
  }

  Future<void> _start(BuildContext context) async {
    FocusManager.instance.primaryFocus?.unfocus();
    final problem = await voice.start();
    if (problem == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (problem == VoiceProblem.noPermission) {
      messenger?.showSnackBar(SnackBar(
        content: const Text('Artha needs the microphone to hear you. Allow it in the app settings.'),
        action: SnackBarAction(label: 'Settings', onPressed: _openAppSettings),
      ));
    } else {
      messenger?.showSnackBar(const SnackBar(
        content: Text("Voice typing isn't available on this phone. Install or turn on Google voice typing, or type instead."),
      ));
    }
  }

  static Future<void> _openAppSettings() async {
    try {
      final pkg = (await PackageInfo.fromPlatform()).packageName;
      await AndroidIntent(action: 'android.settings.APPLICATION_DETAILS_SETTINGS', data: 'package:$pkg').launch();
    } catch (_) {
      await const AndroidIntent(action: 'android.settings.SETTINGS').launch();
    }
  }

  Future<void> _showHelp(BuildContext context) async {
    final t = AppTheme.of(context);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: t.surfaceSolid,
      builder: (ctx) => ListenableBuilder(
        listenable: voice,
        builder: (ctx, _) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hold the mic and speak', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text)),
                const SizedBox(height: 6),
                Text(
                  'Let go when you are done. What Artha heard goes into the message box so you can check it before '
                  'sending. Slide your finger away from the mic to cancel.',
                  style: TextStyle(fontSize: 14, height: 1.45, color: t.textSoft),
                ),
                const SizedBox(height: 16),
                Text('LANGUAGE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: t.textSoft)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, children: [
                  for (final e in ArthaVoice.locales.entries)
                    ChoiceChip(
                      label: Text(e.value),
                      selected: voice.locale == e.key,
                      onSelected: (_) => voice.setLocale(e.key),
                      selectedColor: AppColors.primary.withValues(alpha: 0.14),
                      checkmarkColor: t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C),
                      // The theme's selected-chip label is white, made for a
                      // solid orange chip; this one is a light tint.
                      labelStyle: TextStyle(color: t.text, fontWeight: FontWeight.w600),
                    ),
                ]),
                const SizedBox(height: 8),
                Text('English (India) also understands Hinglish, like "kal shaam 5 baje follow up".',
                    style: TextStyle(fontSize: 12, color: t.textSoft)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shown over the message box while the mic is held: what is being heard,
/// live, with the time and how to stop or cancel.
class VoicePanel extends StatelessWidget {
  final ArthaVoice voice;
  const VoicePanel({super.key, required this.voice});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        if (!voice.listening) return const SizedBox.shrink();
        final accent = voice.cancelling ? AppColors.danger : (t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C));
        final secs = voice.elapsed.inSeconds;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: accent, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(
                  voice.cancelling ? 'LET GO TO CANCEL' : 'LISTENING · ${ArthaVoice.locales[voice.locale]!.toUpperCase()}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: accent),
                ),
                const Spacer(),
                Text('${secs ~/ 60}:${(secs % 60).toString().padLeft(2, '0')}',
                    style: TextStyle(fontSize: 12, color: t.textSoft, fontFeatures: const [FontFeature.tabularFigures()])),
              ]),
              const SizedBox(height: 8),
              Semantics(
                liveRegion: true,
                child: Text(
                  voice.words.isEmpty ? 'Speak now…' : voice.words,
                  style: TextStyle(fontSize: 15, height: 1.45, color: voice.words.isEmpty ? t.textSoft : t.text),
                ),
              ),
              const SizedBox(height: 6),
              Text(voice.cancelling ? 'Slide back to keep it' : 'Let go to stop · slide away to cancel',
                  style: TextStyle(fontSize: 12, color: t.textSoft)),
            ],
          ),
        );
      },
    );
  }
}
