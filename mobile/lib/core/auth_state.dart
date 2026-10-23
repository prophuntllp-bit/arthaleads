import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'push_service.dart';

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
  /// Web's Inbox sub-sections (Agents, Settings, template/credit edits) are
  /// admin/super_admin only; the backend rejects managers, so mirror that.
  bool get isWaAdmin => role == 'admin' || role == 'super_admin';

  AuthState() {
    _api.onSessionExpired = () {
      if (user != null) {
        user = null;
        org = null;
        _forget();
        notifyListeners();
      }
    };
    _api.onOrgBlocked = (reason) {
      orgBlockReason = reason;
      notifyListeners();
    };
  }

  /// True once restore() has found a stored token, i.e. this launch is
  /// almost certainly heading for the dashboard rather than the login screen.
  ///
  /// Reading the token is a fast local call; the slow part is the /auth/me
  /// round trip after it. Publishing this in between lets the launch screen
  /// show the dashboard skeleton during that wait, instead of a spinner that
  /// says nothing — and without showing a dashboard skeleton to someone who
  /// is about to land on the login screen.
  bool restoringKnownSession = false;

  /// App-launch session restore: stored token → GET /auth/me.
  ///
  /// `restoring` is cleared in a finally block: this runs fire-and-forget from
  /// main(), so anything thrown here would otherwise be an unhandled async
  /// error that leaves the flag set and the app parked on the launch screen
  /// permanently. Whatever goes wrong, the gate has to be released — worst
  /// case the user sees the login screen.
  Future<void> restore() async {
    try {
      await _restore();
    } catch (e) {
      debugPrint('[auth] session restore failed: $e');
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  /// The signed-in user and org as last confirmed by the server, kept on the
  /// phone so a returning user goes straight into the app (23 Oct 2026,
  /// owner: launch sat on a placeholder for the whole /auth/me wait). The
  /// server still checks every request; /auth/me runs right after and
  /// replaces this, and a 401 signs out as before.
  static const _profileKey = 'auth_profile_v1';

  Future<void> _remember() async {
    if (user == null) return;
    try {
      (await SharedPreferences.getInstance()).setString(_profileKey, jsonEncode({'user': user, 'org': org}));
    } catch (_) {}
  }

  Future<void> _forget() async {
    try {
      (await SharedPreferences.getInstance()).remove(_profileKey);
    } catch (_) {}
  }

  Future<bool> _openFromSaved() async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_profileKey);
      if (raw == null) return false;
      final saved = (jsonDecode(raw) as Map).cast<String, dynamic>();
      final u = (saved['user'] as Map?)?.cast<String, dynamic>();
      if (u == null) return false;
      user = u;
      org = (saved['org'] as Map?)?.cast<String, dynamic>();
      restoring = false;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _restore() async {
    await _api.loadToken();
    if (_api.hasToken) {
      final openedFromSaved = await _openFromSaved();
      restoringKnownSession = true;
      if (!openedFromSaved) notifyListeners();
      // Up to 3 attempts with backoff. A single failed /auth/me here used to
      // drop straight to the login screen even though the token was still
      // valid and untouched — indistinguishable from a real logout to
      // _AuthGate (main.dart), which only looks at `loggedIn`. That is what
      // was reported as the app "logging out" 2-3 times: a Railway cold
      // start or a transient connection blip failed the one restore
      // attempt, and only relaunching (a fresh attempt) got back in. A 401
      // already cleared the token via the interceptor and won't succeed on
      // retry, so it still fails fast.
      for (var attempt = 0; attempt < 3; attempt++) {
        try {
          final res = await _api.dio.get('/auth/me');
          user = (res.data['user'] as Map?)?.cast<String, dynamic>();
          org = (res.data['org'] as Map?)?.cast<String, dynamic>();
          _remember();
          if (openedFromSaved) notifyListeners();
          break;
        } on DioException catch (e) {
          if (e.response?.statusCode == 401) {
            // Signed out on the server: leave the saved profile too.
            if (user != null) {
              user = null;
              org = null;
              _forget();
              notifyListeners();
            }
            break;
          }
          // Offline after opening from the saved profile: stay in the app;
          // each screen shows its own load error and retries.
          if (attempt == 2) break;
          await Future.delayed(Duration(milliseconds: 1500 * (attempt + 1)));
        }
      }
    }
    // `restoring` is cleared by restore()'s finally block, so it is released
    // even if anything above throws.
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
      _remember();
      notifyListeners();
    } finally {
      _api.authInProgress = false;
    }
  }

  /// Google Sign-In. Sends the OAuth access_token to the same /auth/google
  /// endpoint the web app uses (backend/services/authService.js googleAuth)
  /// — it verifies the token directly against Google's userinfo API, so it
  /// doesn't matter which client (web or Android) issued it.
  Future<void> googleLogin(String accessToken) async {
    _api.authInProgress = true;
    try {
      final res = await _api.dio.post('/auth/google', data: {'credential': accessToken});
      final token = res.data['token'] as String?;
      if (token == null) throw Exception('No token in response');
      await _api.setToken(token);
      user = (res.data['user'] as Map?)?.cast<String, dynamic>();
      org = (res.data['org'] as Map?)?.cast<String, dynamic>();
      orgBlockReason = null;
      _remember();
      notifyListeners();
    } finally {
      _api.authInProgress = false;
    }
  }

  Future<void> logout() async {
    await PushService.instance.unregister(); // needs the auth token, so before clearToken
    try {
      await _api.dio.post('/auth/logout');
    } catch (_) {
      // proceed even if offline — token is cleared locally regardless
    }
    await _api.clearToken();
    await _forget();
    user = null;
    org = null;
    notifyListeners();
  }

  /// Re-fetch user+org (e.g. after profile/org settings change).
  Future<void> refresh() async {
    final res = await _api.dio.get('/auth/me');
    user = (res.data['user'] as Map?)?.cast<String, dynamic>();
    org = (res.data['org'] as Map?)?.cast<String, dynamic>();
    _remember();
    notifyListeners();
  }
}
