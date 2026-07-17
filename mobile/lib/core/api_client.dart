import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Mirrors frontend/src/services/api.js:
/// - base URL from --dart-define=API_BASE_URL (defaults to prod)
/// - Bearer token on every request
/// - 401 → clear session + notify listener (session expired)
/// - 403 ORGANISATION_INACTIVE / TRIAL_EXPIRED surfaced as typed events
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.arthaleads.com/api',
  );

  // Identifies genuine mobile-app requests to the backend so it can skip the
  // browser-only reCAPTCHA check on /auth/login (must match the backend's
  // MOBILE_APP_SECRET env var).
  static const _mobileAppSecret = String.fromEnvironment(
    'MOBILE_APP_SECRET',
    defaultValue: '202b0e2769ca92352bb029a92e1ae308593809cf0e9d46ff706c3f921bbdae5c',
  );

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
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
        'X-Mobile-App-Secret': _mobileAppSecret,
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
            final isAuthEndpoint = RegExp(r'/auth/(login|signup|otp/verify|google|phone-login)')
                .hasMatch(path);
            if (!isAuthEndpoint && !authInProgress) {
              clearToken();
              onSessionExpired?.call();
            }
          } else if (status == 403 &&
              (msg == 'ORGANISATION_INACTIVE' || msg == 'TRIAL_EXPIRED')) {
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

  Future<void> loadToken() async {
    _token = await _storage.read(key: 'auth_token');
  }

  bool get hasToken => _token != null;
  String? get token => _token;

  Future<void> setToken(String token) async {
    _token = token;
    await _storage.write(key: 'auth_token', value: token);
  }

  Future<void> clearToken() async {
    _token = null;
    await _storage.delete(key: 'auth_token');
  }
}
