import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api_client.dart';

/// Result of an update check. `mandatory` means the installed build is older
/// than the backend's minBuild and must be replaced before the app is usable.
class UpdateInfo {
  final int latestBuild;
  final String latestVersion;
  final String downloadUrl;
  final String releaseNotes;
  final bool mandatory;

  const UpdateInfo({
    required this.latestBuild,
    required this.latestVersion,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.mandatory,
  });
}

/// Checks whether a newer APK exists.
///
/// The Android app is distributed privately (not through the Play Store), so
/// nothing updates it automatically — without this check users would silently
/// stay on stale builds forever. On launch the app asks the backend for the
/// current release and compares build numbers.
///
/// Comparison uses the integer build number (versionCode), not the version
/// string: it is monotonic and avoids fragile semver parsing.
///
/// Every failure path is silent. If the backend is unreachable, misconfigured,
/// or returns junk, `check()` returns null and the app proceeds as normal — a
/// broken update check must never stop someone using the CRM.
class UpdateService {
  UpdateService._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _skippedKey = 'update_skipped_build';
  static const _skippedAtKey = 'update_skipped_at';
  // A "Later" used to suppress the prompt for that build forever — someone
  // taps it once, absent-mindedly, and silently stops hearing about updates
  // indefinitely, including ones that ship after real fixes. Re-prompting
  // after a few days costs one dismissible dialog and guarantees no one is
  // permanently stuck on a stale build by accident.
  static const _skipCooldown = Duration(days: 3);

  static Future<UpdateInfo?> check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(info.buildNumber) ?? 0;
      if (currentBuild == 0) return null; // unknown build — don't guess

      final res = await ApiClient.instance.dio.get(
        '/public/app-version',
        queryParameters: {'platform': 'android'},
        options: Options(
          // A slow/hanging check must not delay app start.
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
        ),
      );

      final data = res.data;
      if (data is! Map) return null;

      final latestBuild = _int(data['latestBuild']);
      final minBuild = _int(data['minBuild']);
      final downloadUrl = (data['downloadUrl'] ?? '').toString();

      // Nothing newer than what's installed.
      if (latestBuild <= currentBuild) return null;
      // An update we can't point the user to is worse than no prompt at all.
      if (downloadUrl.isEmpty) return null;

      final mandatory = currentBuild < minBuild;

      // Respect a previous "Later" for this exact build, but only for
      // _skipCooldown — after that it re-prompts even if nothing changed on
      // the backend, so a one-time dismissal can never turn into forever. A
      // mandatory update always shows regardless of any prior dismissal.
      if (!mandatory) {
        final skipped = int.tryParse(await _storage.read(key: _skippedKey) ?? '');
        if (skipped == latestBuild) {
          final skippedAtRaw = await _storage.read(key: _skippedAtKey);
          final skippedAt = skippedAtRaw != null ? DateTime.tryParse(skippedAtRaw) : null;
          if (skippedAt != null && DateTime.now().difference(skippedAt) < _skipCooldown) {
            return null;
          }
        }
      }

      return UpdateInfo(
        latestBuild: latestBuild,
        latestVersion: (data['latestVersion'] ?? '').toString(),
        downloadUrl: downloadUrl,
        releaseNotes: (data['releaseNotes'] ?? '').toString(),
        mandatory: mandatory,
      );
    } catch (_) {
      return null; // offline / server down / bad payload — never block the app
    }
  }

  /// Remember that the user chose "Later" for this build so they aren't
  /// re-prompted on every launch for the same version — only until
  /// _skipCooldown elapses, then it asks again.
  static Future<void> skip(int build) async {
    try {
      await _storage.write(key: _skippedKey, value: '$build');
      await _storage.write(key: _skippedAtKey, value: DateTime.now().toIso8601String());
    } catch (_) {
      // Storage failure just means they get prompted again — harmless.
    }
  }

  static int _int(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }

  /// Explicit, user-triggered check (Settings → Check for Updates). Unlike
  /// [check], this always reports the true state — it ignores any prior
  /// "Later" dismissal (the user asked directly, so "you skipped this
  /// already" is not a useful answer) and distinguishes "you're current"
  /// from "the check itself failed", which the silent [check] intentionally
  /// can't (both return null there, correctly, since neither should ever
  /// block app launch). Longer timeout too: nothing here is blocking startup,
  /// so it's worth waiting out a cold Railway backend rather than giving up.
  static Future<ManualCheckOutcome> checkManual() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(info.buildNumber) ?? 0;
      if (currentBuild == 0) return const ManualCheckOutcome(ManualCheckResult.error);

      final res = await ApiClient.instance.dio.get(
        '/public/app-version',
        queryParameters: {'platform': 'android'},
        options: Options(
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 15),
        ),
      );

      final data = res.data;
      if (data is! Map) return const ManualCheckOutcome(ManualCheckResult.error);

      final latestBuild = _int(data['latestBuild']);
      final minBuild = _int(data['minBuild']);
      final downloadUrl = (data['downloadUrl'] ?? '').toString();

      if (latestBuild <= currentBuild || downloadUrl.isEmpty) {
        return const ManualCheckOutcome(ManualCheckResult.upToDate);
      }

      return ManualCheckOutcome(
        ManualCheckResult.updateAvailable,
        UpdateInfo(
          latestBuild: latestBuild,
          latestVersion: (data['latestVersion'] ?? '').toString(),
          downloadUrl: downloadUrl,
          releaseNotes: (data['releaseNotes'] ?? '').toString(),
          mandatory: currentBuild < minBuild,
        ),
      );
    } catch (_) {
      return const ManualCheckOutcome(ManualCheckResult.error);
    }
  }
}

enum ManualCheckResult { upToDate, updateAvailable, error }

class ManualCheckOutcome {
  final ManualCheckResult result;
  final UpdateInfo? info;
  const ManualCheckOutcome(this.result, [this.info]);
}
