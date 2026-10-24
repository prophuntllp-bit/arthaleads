import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

/// Background/terminated FCM messages already include a `notification` block
/// (see backend/utils/push.js), so Android displays them automatically — this
/// handler only needs to exist so firebase_messaging doesn't warn about a
/// missing one. Must be a top-level function (isolate entry point).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

/// FCM push notifications (Android): the "leads" channel and the
/// POST/DELETE /push/fcm-token contract (backend/routes/pushRoutes.js).
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _channelId = 'leads';
  static const _channelName = 'Lead Notifications';

  final _api = ApiClient.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  String? _currentToken;

  /// Path from a tapped notification's `data.url` (e.g. "/leads"). Shell
  /// listens for changes and jumps to the matching tab, then clears it.
  final ValueNotifier<String?> pendingRoute = ValueNotifier(null);

  bool _listening = false;

  /// The whole data block of a tapped notification that names a record
  /// (`conversationId` and/or `leadId`, e.g. "AI assistant could not reply").
  /// Shell opens that chat or lead instead of just switching tabs.
  final ValueNotifier<Map<String, String>?> pendingTarget = ValueNotifier(null);

  /// Routes a tapped notification's data: to the record when it names one,
  /// otherwise to the tab its `url` points at.
  void _route(Map<String, dynamic> data) {
    final target = <String, String>{
      for (final e in data.entries)
        if (e.value != null) e.key: e.value.toString(),
    };
    if ((target['conversationId'] ?? '').isNotEmpty || (target['leadId'] ?? '').isNotEmpty) {
      pendingTarget.value = target;
      return;
    }
    final url = target['url'];
    if (url != null && url.isNotEmpty) pendingRoute.value = url;
  }

  Future<void> init() async {
    if (ApiClient.isStaging) return; // no Firebase in the staging app
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Instant alerts when new leads are assigned',
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
      ),
      onDidReceiveNotificationResponse: (details) {
        // Foreground notifications carry the data block as JSON (see
        // _showForeground); older ones carried just the url.
        final payload = details.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final decoded = jsonDecode(payload);
          if (decoded is Map) {
            _route(decoded.cast<String, dynamic>());
            return;
          }
        } catch (_) {}
        pendingRoute.value = payload;
      },
    );

    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[push] Notification permission denied');
      return;
    }

    await _registerToken(await messaging.getToken());
    // init() runs again after signing out and back in: register the token for
    // the new session, but add the listeners only once (they doubled, so a
    // tapped notification opened its chat twice).
    if (_listening) return;
    _listening = true;
    messaging.onTokenRefresh.listen(_registerToken);

    // Foreground: Android doesn't auto-display FCM notifications while the
    // app is open, so show one manually via flutter_local_notifications.
    FirebaseMessaging.onMessage.listen(_showForeground);

    // Tapped while backgrounded, or cold-started by tapping a notification.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);
    final initial = await messaging.getInitialMessage();
    if (initial != null) _handleOpenedMessage(initial);
  }

  void _handleOpenedMessage(RemoteMessage message) => _route(message.data);

  Future<void> _showForeground(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          icon: 'ic_notification',
          color: Color(0xFFFF6B00),
          priority: Priority.high,
          importance: Importance.high,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  Future<void> _registerToken(String? token) async {
    if (token == null || token == _currentToken) return;
    _currentToken = token;
    try {
      await _api.dio.post('/push/fcm-token', data: {'token': token, 'platform': 'android'});
    } catch (e) {
      debugPrint('[push] Token registration failed: $e');
    }
  }

  /// Unregister the current FCM token — call before logout while the auth
  /// token is still valid (the endpoint requires it).
  Future<void> unregister() async {
    if (_currentToken == null) return;
    try {
      await _api.dio.delete('/push/fcm-token', data: {'token': _currentToken});
    } catch (_) {
      // Silently ignore — token will expire naturally
    }
    _currentToken = null;
  }
}
