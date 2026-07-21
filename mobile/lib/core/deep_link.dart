import 'package:flutter/foundation.dart';

/// In-app deep-link bus. Shell caches each tab's screen instance
/// (see shell.dart's `_screenCache`), so a widget like Dashboard can't just
/// pass a constructor argument to open a specific record on another tab —
/// the target screen is already built. Instead it sets one of these
/// ValueNotifiers before switching tabs; the target screen listens for it,
/// acts on it, then clears it back to null. Mirrors the same pattern
/// PushService already uses for push-notification routing.
class DeepLink {
  DeepLink._();

  /// Set to a lead `_id` to ask the Leads tab to open that lead's detail
  /// sheet as soon as it's visible.
  static final ValueNotifier<String?> openLeadId = ValueNotifier(null);

  /// Set to a user `_id` to ask the Performance tab to scroll to and
  /// highlight that agent's card.
  static final ValueNotifier<String?> focusAgentId = ValueNotifier(null);
}
