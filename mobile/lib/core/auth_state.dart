import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Session state — mirrors frontend/src/context/AuthContext.jsx.
/// `user` and `org` are kept as raw maps (the backend is schema-flexible and
/// the web app treats them the same way).
class AuthState extends ChangeNotifier {
  Map<String, dynamic>? user;
  Map<String, dynamic>? org;
  bool restoring = true;

  /// "ORGANISATION_INACTIVE" | "TRIAL_EXPIRED" | null
  String? orgBlockReason;

  final _api = ApiClient.instance;

  bool get loggedIn => user != null;
  String get role => (user?['role'] as String?) ?? 'agent';
  bool get isAdmin => role != 'agent';

  AuthState() {
    _api.onSessionExpired = () {
      if (user != null) {
        user = null;
        org = null;
        notifyListeners();
      }
    };
    _api.onOrgBlocked = (reason) {
      orgBlockReason = reason;
      notifyListeners();
    };
  }

  /// App-launch session restore: stored token → GET /auth/me.
  Future<void> restore() async {
    await _api.loadToken();
    if (_api.hasToken) {
      try {
        final res = await _api.dio.get('/auth/me');
        user = (res.data['user'] as Map?)?.cast<String, dynamic>();
        org = (res.data['org'] as Map?)?.cast<String, dynamic>();
      } catch (_) {
        // 401 already cleared the token via the interceptor; network errors
        // leave the token in place so a later retry can restore the session.
      }
    }
    restoring = false;
    notifyListeners();
  }

  /// Email-or-phone + password login. Throws with a readable message on failure.
  Future<void> login(String identifier, String password) async {
    _api.authInProgress = true;
    try {
      final res = await _api.dio.post('/auth/login', data: {
        'email': identifier.trim(),
        'password': password,
      });
      final token = res.data['token'] as String?;
      if (token == null) throw Exception('No token in response');
      await _api.setToken(token);
      user = (res.data['user'] as Map?)?.cast<String, dynamic>();
      org = (res.data['org'] as Map?)?.cast<String, dynamic>();
      orgBlockReason = null;
      notifyListeners();
    } finally {
      _api.authInProgress = false;
    }
  }

  Future<void> logout() async {
    try {
      await _api.dio.post('/auth/logout');
    } catch (_) {
      // proceed even if offline — token is cleared locally regardless
    }
    await _api.clearToken();
    user = null;
    org = null;
    notifyListeners();
  }

  /// Re-fetch user+org (e.g. after profile/org settings change).
  Future<void> refresh() async {
    final res = await _api.dio.get('/auth/me');
    user = (res.data['user'] as Map?)?.cast<String, dynamic>();
    org = (res.data['org'] as Map?)?.cast<String, dynamic>();
    notifyListeners();
  }
}
