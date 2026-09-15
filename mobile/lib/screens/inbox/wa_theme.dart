import 'package:flutter/material.dart';

/// Color tokens modeled on WhatsApp's own chat UI — functional palette and
/// layout only, no wallpaper artwork or wordmark reproduced — so the Inbox
/// list and conversation screen feel like a native WhatsApp client instead
/// of a generic chat UI. Used only by screens under lib/screens/inbox/.
class WaTheme {
  final bool isDark;
  const WaTheme(this.isDark);

  static WaTheme of(BuildContext context) =>
      WaTheme(Theme.of(context).brightness == Brightness.dark);

  Color get chatBg =>
      isDark ? const Color(0xFF0B141A) : const Color(0xFFEFEAE2);
  Color get headerBg =>
      isDark ? const Color(0xFF202C33) : const Color(0xFF008069);
  Color get headerFg => Colors.white;
  Color get headerFgSoft => Colors.white.withValues(alpha: 0.75);
  Color get listBg => isDark ? const Color(0xFF111B21) : Colors.white;
  Color get searchPillBg =>
      isDark ? const Color(0xFF202C33) : const Color(0xFFF0F2F5);
  Color get searchPillFg =>
      isDark ? const Color(0xFF8696A0) : const Color(0xFF54656F);
  Color get chipBg =>
      isDark ? const Color(0xFF202C33) : const Color(0xFFF0F2F5);
  Color get chipSelectedBg =>
      isDark ? const Color(0xFF00A884) : const Color(0xFF008069);
  Color get chipFg =>
      isDark ? const Color(0xFFE9EDEF) : const Color(0xFF3B4A54);
  Color get outgoingBubble =>
      isDark ? const Color(0xFF005C4B) : const Color(0xFFD9FDD3);
  Color get incomingBubble =>
      isDark ? const Color(0xFF202C33) : Colors.white;
  Color get bubbleText =>
      isDark ? const Color(0xFFE9EDEF) : const Color(0xFF111B21);
  Color get timeText =>
      isDark ? const Color(0xFF8696A0) : const Color(0xFF667781);
  Color get unreadBadge => const Color(0xFF25D366);
  Color get composerBg =>
      isDark ? const Color(0xFF202C33) : const Color(0xFFF0F2F5);
  Color get composerPillBg =>
      isDark ? const Color(0xFF2A3942) : Colors.white;
  Color get sendGreen => const Color(0xFF00A884);
  Color get divider =>
      isDark ? const Color(0xFF222D34) : const Color(0xFFE9EDEF);
}
