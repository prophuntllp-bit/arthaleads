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
///
/// The recogniser, not the app, decides when listening has ended (silence,
/// an error, its own time limit): every way it stops ends the session here
/// too, so the panel can never be left saying "Listening" over a dead mic.
class ArthaVoice extends ChangeNotifier {
  ArthaVoice({required this.onHeard});

  /// Receives what was heard when a session ends with words.
  final ValueChanged<String> onHeard;

  static const _prefKey = 'artha_voice_locale';

  /// en_IN also writes Hinglish in Latin letters ("kal shaam 5 baje"), which
  /// is what Artha reads best; hi_IN writes Devanagari.
  static const locales = {'en_IN': 'English (India)', 'hi_IN': 'हिन्दी'};

  final _stt = SpeechToText();
  bool _ready = false;
  bool _starting = false;
  bool _ending = false;

  String locale = 'en_IN';
  bool listening = false;
  bool cancelling = false;
  String words = '';
  double level = 0;
  Duration elapsed = Duration.zero;
  Timer? _clock;

  /// A one-line note after a session that produced nothing ("Didn't catch
  /// that"), cleared on the next hold.
  String? notice;

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

  /// Gets the recogniser ready. The first time, Android asks for the
  /// microphone; that hold only asks (the finger has long left the button by
  /// the time the person answers), the next hold talks.
  Future<VoiceStart> _prepare() async {
    if (_ready) return VoiceStart.ok;
    try {
      _ready = await _stt.initialize(onError: _onError, onStatus: _onStatus);
    } on PlatformException {
      _ready = false;
    }
    if (_ready) return VoiceStart.justAllowed;
    return await _stt.hasPermission ? VoiceStart.unavailable : VoiceStart.noPermission;
  }

  /// The finger went down on the mic.
  Future<VoiceStart> start({required bool Function() stillHeld}) async {
    if (listening || _starting) return VoiceStart.ok;
    _starting = true;
    notice = null;
    try {
      final firstTime = !_ready;
      final prep = await _prepare();
      if (prep != VoiceStart.ok && prep != VoiceStart.justAllowed) return prep;
      if (firstTime && !stillHeld()) return VoiceStart.justAllowed;
      if (!stillHeld()) return VoiceStart.ok; // a tap, not a hold

      words = '';
      level = 0;
      cancelling = false;
      elapsed = Duration.zero;
      listening = true;
      _ending = false;
      notifyListeners();
      HapticFeedback.mediumImpact();
      _clock?.cancel();
      _clock = Timer.periodic(const Duration(seconds: 1), (_) {
        elapsed += const Duration(seconds: 1);
        notifyListeners();
      });
      await _stt.listen(
        onResult: (r) {
          words = r.recognizedWords;
          notifyListeners();
          if (r.finalResult && listening && _stt.isNotListening) _finish();
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
          listenFor: const Duration(seconds: 60),
          pauseFor: const Duration(seconds: 6),
        ),
      );
      // Let go while the recogniser was still starting up.
      if (!stillHeld() && listening) await stop();
      return VoiceStart.ok;
    } catch (_) {
      _reset();
      return VoiceStart.unavailable;
    } finally {
      _starting = false;
    }
  }

  /// Let go, Done, or a tap on the mic while listening: stop and keep what
  /// was heard. The recogniser sends its last words just after stopping.
  Future<void> stop() async {
    if (!listening || _ending) return;
    _ending = true;
    try {
      await _stt.stop();
    } catch (_) {}
    // Wait briefly for the final result, then end regardless.
    for (var i = 0; i < 15 && listening && !_stt.isNotListening; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    await Future<void>.delayed(const Duration(milliseconds: 250));
    _finish();
  }

  /// Slid away, or Cancel: drop what was heard.
  Future<void> cancel() async {
    _ending = true;
    try {
      await _stt.cancel();
    } catch (_) {}
    words = '';
    _reset();
  }

  void markCancelling(bool on) {
    if (!listening || cancelling == on) return;
    cancelling = on;
    if (on) HapticFeedback.selectionClick();
    notifyListeners();
  }

  void _finish() {
    if (!listening) return;
    final heard = words.trim();
    if (cancelling) {
      words = '';
      _reset();
      return;
    }
    notice = heard.isEmpty ? "Didn't catch that. Hold the mic and speak, then let go." : null;
    _reset();
    if (heard.isNotEmpty) onHeard(heard);
  }

  void _reset() {
    _clock?.cancel();
    listening = false;
    cancelling = false;
    _ending = false;
    level = 0;
    notifyListeners();
  }

  void _onError(SpeechRecognitionError e) {
    if (!listening) return;
    if (e.errorMsg.contains('permission')) notice = 'Artha needs the microphone. Allow it in the app settings.';
    _finish();
    if (e.errorMsg == 'error_network' || e.errorMsg == 'error_network_timeout') {
      notice = 'Voice typing needs the internet. Check the connection, or type instead.';
      notifyListeners();
    }
  }

  void _onStatus(String status) {
    // "done" / "notListening": the recogniser has stopped, for whatever
    // reason. End here too, with whatever it heard.
    if ((status == 'done' || status == 'notListening') && listening) {
      Future<void>.delayed(const Duration(milliseconds: 300), _finish);
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _stt.cancel();
    super.dispose();
  }
}

enum VoiceStart { ok, justAllowed, noPermission, unavailable }

/// The mic beside the message box: hold to talk, let go to stop, slide
/// away to cancel. While listening a tap stops it too. A short tap when idle
/// explains the gesture and picks the language.
class VoiceMicButton extends StatefulWidget {
  final ArthaVoice voice;
  final bool enabled;
  const VoiceMicButton({super.key, required this.voice, this.enabled = true});

  @override
  State<VoiceMicButton> createState() => _VoiceMicButtonState();
}

class _VoiceMicButtonState extends State<VoiceMicButton> {
  static const _cancelDistance = 90.0;
  bool _held = false;

  ArthaVoice get voice => widget.voice;

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        final on = voice.listening;
        return Semantics(
          button: true,
          label: on ? 'Stop listening' : 'Hold to talk to Artha',
          child: GestureDetector(
            onTap: !widget.enabled ? null : (on ? voice.stop : () => _showHelp(context)),
            onLongPressStart: widget.enabled && !on ? (_) => _begin(context) : null,
            onLongPressMoveUpdate: (d) => voice.markCancelling(d.offsetFromOrigin.distance > _cancelDistance),
            onLongPressEnd: (_) => _release(),
            onLongPressCancel: _release,
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
              child: Icon(on ? Icons.stop_rounded : Icons.mic_rounded,
                  size: 22, color: on ? Colors.white : (t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C))),
            ),
          ),
        );
      },
    );
  }

  Future<void> _begin(BuildContext context) async {
    _held = true;
    FocusManager.instance.primaryFocus?.unfocus();
    final messenger = ScaffoldMessenger.maybeOf(context);
    final result = await voice.start(stillHeld: () => _held);
    switch (result) {
      case VoiceStart.ok:
        break;
      case VoiceStart.justAllowed:
        messenger?.showSnackBar(const SnackBar(content: Text('Microphone ready. Hold the mic again and speak.')));
      case VoiceStart.noPermission:
        messenger?.showSnackBar(SnackBar(
          content: const Text('Artha needs the microphone to hear you. Allow it in the app settings.'),
          action: SnackBarAction(label: 'Settings', onPressed: _openAppSettings),
        ));
      case VoiceStart.unavailable:
        messenger?.showSnackBar(const SnackBar(
          content: Text("Voice typing isn't available on this phone. Turn on Google voice typing, or type instead."),
        ));
    }
  }

  Future<void> _release() async {
    _held = false;
    if (!voice.listening) return;
    if (voice.cancelling) {
      await voice.cancel();
    } else {
      await voice.stop();
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
                  'Keep your finger on the mic while you talk and let go when you are done. What Artha heard goes '
                  'into the message box so you can check it before sending. Slide your finger away, or tap Cancel, '
                  'to throw it away.',
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

/// Shown over the message box while listening: what is being heard, live,
/// with the time, and Cancel / Done so it can always be ended. After a
/// session that heard nothing it shows a one-line note instead.
class VoicePanel extends StatelessWidget {
  final ArthaVoice voice;
  const VoicePanel({super.key, required this.voice});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ListenableBuilder(
      listenable: voice,
      builder: (context, _) {
        if (!voice.listening) {
          if (voice.notice == null) return const SizedBox.shrink();
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
            child: Text(voice.notice!, style: TextStyle(fontSize: 13, color: t.textSoft)),
          );
        }
        final accent = voice.cancelling ? AppColors.danger : (t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C));
        final secs = voice.elapsed.inSeconds;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 6),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: accent, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    voice.cancelling ? 'LET GO TO CANCEL' : 'LISTENING · ${ArthaVoice.locales[voice.locale]!.toUpperCase()}',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1, color: accent),
                  ),
                ),
                Text('${secs ~/ 60}:${(secs % 60).toString().padLeft(2, '0')}',
                    style: TextStyle(fontSize: 12, color: t.textSoft, fontFeatures: const [FontFeature.tabularFigures()])),
                const SizedBox(width: 8),
              ]),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    voice.words.isEmpty ? 'Speak now…' : voice.words,
                    style: TextStyle(fontSize: 15, height: 1.45, color: voice.words.isEmpty ? t.textSoft : t.text),
                  ),
                ),
              ),
              Row(children: [
                Expanded(
                  child: Text(voice.cancelling ? 'Slide back to keep it' : 'Let go to stop · slide away to cancel',
                      style: TextStyle(fontSize: 12, color: t.textSoft)),
                ),
                TextButton(onPressed: voice.cancel, child: Text('Cancel', style: TextStyle(color: t.textSoft))),
                TextButton(
                  onPressed: voice.stop,
                  child: Text('Done', style: TextStyle(color: accent, fontWeight: FontWeight.w600)),
                ),
              ]),
            ],
          ),
        );
      },
    );
  }
}
