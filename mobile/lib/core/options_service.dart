import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'constants.dart';

/// Keeps the lead dropdown options in step with the backend.
///
/// backend/constants/leadOptions.js is the single source of truth: the Mongoose
/// enums and the Joi validators both derive from it, and it is published at
/// GET /api/public/options. Fetching it here means this app can never offer a
/// value the API would reject with a 400 — the exact bug that made "Other
/// Location", "Commercial", "QR Code" and "Vistrow Voice" fail to save.
///
/// This matters more on Android than on web: the APK is distributed privately,
/// so an install can be months old. Hydrating at launch lets a stale build pick
/// up new options without being reinstalled.
///
/// Order of preference on startup:
///   1. cached values from the last successful fetch (instant, works offline)
///   2. fresh values from the API (overwrites the cache)
///   3. the compiled-in defaults in constants.dart (if both above fail)
class OptionsService {
  OptionsService._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _cacheKey = 'lead_options_cache';

  /// Loads the cache immediately, then refreshes from the API in the background.
  /// Never throws — option lists are not worth blocking app start for.
  static Future<void> hydrate() async {
    await _applyCached();
    await _refresh();
  }

  static Future<void> _applyCached() async {
    try {
      final raw = await _storage.read(key: _cacheKey);
      if (raw == null) return;
      _apply(jsonDecode(raw));
    } catch (_) {
      // Corrupt cache — defaults stay in place.
    }
  }

  static Future<void> _refresh() async {
    try {
      final res = await ApiClient.instance.dio.get(
        '/public/options',
        options: Options(
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 8),
        ),
      );
      final opts = (res.data is Map) ? res.data['options'] : null;
      if (opts is! Map) return;
      _apply(opts);
      await _storage.write(key: _cacheKey, value: jsonEncode(opts));
    } catch (_) {
      // Offline or backend down — cached/default values remain in use.
    }
  }

  /// Replaces list CONTENTS in place so widgets already holding a reference
  /// (and any list built from one) observe the new values.
  static void _apply(dynamic opts) {
    if (opts is! Map) return;

    void set(String key, List<String> target) {
      final incoming = _stringList(opts[key]);
      // A malformed or empty payload must never blank out a dropdown.
      if (incoming.isEmpty) return;
      target
        ..clear()
        ..addAll(incoming);
    }

    set('status', statusOptions);
    set('priority', priorityOptions);
    set('source', sourceOptions);
    set('propertyType', propertyTypes);
    set('bhk', bhkOptions);
    set('purpose', purposeOptions);

    // Booking carries a colour per value, so rebuild the objects rather than
    // copying strings, looking each colour up by value.
    final booking = _stringList(opts['booking'], allowEmptyEntries: true);
    if (booking.isNotEmpty) {
      bookingOptions
        ..clear()
        ..addAll(booking.map((v) => BookingOption(
              v,
              v.isEmpty ? '- None -' : v,
              v.isEmpty ? null : (bookingColors[v] ?? const Color(0xFF6B7280)),
            )));
    }
  }

  static List<String> _stringList(dynamic v, {bool allowEmptyEntries = false}) {
    if (v is! List) return const [];
    final out = <String>[];
    for (final e in v) {
      if (e is! String) return const []; // reject mixed/garbage payloads wholesale
      if (e.isEmpty && !allowEmptyEntries) continue;
      out.add(e);
    }
    return out;
  }
}
