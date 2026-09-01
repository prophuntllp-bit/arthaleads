import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// The secret that ties the emailed verification link back to this app.
///
/// Mirrors frontend/src/utils/signupHandoff.js. The signup screen mints a
/// random secret, sends only its SHA-256 to the server, and presents the secret
/// when it polls for the result — so knowing somebody's email address is not
/// enough to collect their signup token.
///
/// Held in memory rather than on disk, unlike the web version's sessionStorage.
/// A signup is one screen's lifetime here; there is no second tab to hand it to,
/// and persisting a credential that only matters for the next few minutes would
/// be storing it for no reason.
class SignupHandoff {
  SignupHandoff._(this.secret);

  final String secret;

  /// SHA-256 of the secret, lowercase hex — the only half the server ever sees.
  String get hash => sha256.convert(utf8.encode(secret)).toString();

  /// Mints a fresh secret. Random.secure() rather than Random(): this is a
  /// credential, and the default generator is seeded predictably enough to
  /// matter.
  factory SignupHandoff.generate() {
    final rng = Random.secure();
    final bytes = List<int>.generate(32, (_) => rng.nextInt(256));
    return SignupHandoff._(
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
    );
  }
}
