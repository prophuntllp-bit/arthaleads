import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Mirrors frontend/src/services/api.js:
/// - base URL from --dart-define=API_BASE_URL (defaults to prod)
/// - Bearer token on every request
/// - 401 → clear session + notify listener (session expired)
/// - 403 ORGANISATION_INACTIVE / TRIAL_EXPIRED / ORG_PENDING_DELETION surfaced
///   as typed events
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.arthaleads.com/api',
  );

  String? _token;
  bool authInProgress = false;

  /// Called when a 401 lands outside of login — the app should log out.
  void Function()? onSessionExpired;

  /// Called on org-level 403 blocks ("ORGANISATION_INACTIVE" | "TRIAL_EXPIRED").
  void Function(String reason)? onOrgBlocked;

  late final Dio dio = Dio(
    BaseOptions(
      baseUrl: _baseUrl,
      // Railway cold start can take 20-30s — same 45s budget as the web app.
      connectTimeout: const Duration(seconds: 45),
      receiveTimeout: const Duration(seconds: 45),
      headers: {
        'Accept': 'application/json',
      },
    ),
  )..interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          handler.next(options);
        },
        onError: (err, handler) {
          final status = err.response?.statusCode;
          final path = err.requestOptions.path;
          final msg = _messageOf(err.response?.data);

          if (status == 401) {
            final isAuthEndpoint = RegExp(r'/auth/(login|signup|google|phone-login)')
                .hasMatch(path);
            if (!isAuthEndpoint && !authInProgress) {
              clearToken();
              onSessionExpired?.call();
            }
          } else if (status == 403 &&
              (msg == 'ORGANISATION_INACTIVE' ||
                 msg == 'TRIAL_EXPIRED' ||
                 msg == 'ORG_PENDING_DELETION')) {
            onOrgBlocked?.call(msg!);
          }
          handler.next(err);
        },
      ),
    );

  static String? _messageOf(dynamic data) {
    if (data is Map && data['message'] is String) return data['message'] as String;
    return null;
  }

  /// Human-readable error from a DioException — falls back to a generic string.
  static String errorMessage(Object e, [String fallback = 'Something went wrong']) {
    if (e is DioException) {
      final msg = _messageOf(e.response?.data);
      if (msg != null && msg.isNotEmpty) return msg;
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Server is waking up — please try again in a moment.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'No internet connection.';
      }
    }
    return fallback;
  }

  // Plain SharedPreferences, deliberately not flutter_secure_storage.
  //
  // The token used to live behind an Android Keystore-wrapped key (first via
  // Jetpack's EncryptedSharedPreferences, then via the plugin's own AES-GCM
  // cipher after a version bump meant to fix this) — but on at least one real
  // device in the field, BOTH implementations lost or invalidated that key
  // across ordinary background/process-restart cycles, silently signing
  // people out of a still-valid session with no server round trip involved
  // (confirmed via Railway's HTTP logs: no /auth/me request at all at the
  // moment a logout was observed — the token was gone locally before
  // anything was ever sent). That is an OS/OEM-level Keystore reliability
  // issue, not something either cipher choice can paper over.
  //
  // A bearer JWT sitting unencrypted in this app's private storage is a
  // materially smaller risk than the alternative (already true for every
  // other value this app persists, all of which use SharedPreferences) — it
  // is HTTPS-only in transit, sandboxed to this app by Android on a
  // non-rooted device, and expires server-side regardless. Reliability wins.
  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  bool get hasToken => _token != null;
  String? get token => _token;

  Future<void> setToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }
}
