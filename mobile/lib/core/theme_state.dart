import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persisted two-state theme preference matching the web app's ThemeContext.
/// The web defaults to light and remembers the last explicit choice.
class ThemeState extends ChangeNotifier {
  static const _storageKey = 'arthaleads_theme';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  ThemeMode _mode = ThemeMode.light;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> restore() async {
    final saved = await _storage.read(key: _storageKey);
    _mode = saved == 'dark' ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  Future<void> setDark(bool dark) async {
    final next = dark ? ThemeMode.dark : ThemeMode.light;
    if (_mode == next) return;
    _mode = next;
    notifyListeners();
    await _storage.write(key: _storageKey, value: dark ? 'dark' : 'light');
  }

  Future<void> toggle() => setDark(!isDark);
}
