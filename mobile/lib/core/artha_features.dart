import 'api_client.dart';

/// Which Artha extras this company has (GET /copilot/features): the morning
/// brief, WhatsApp reply drafts, and suggestions read from the chat. Screens
/// only show a button that will work. Asked once per signed-in token and
/// shared; a failed ask means "off" and is tried again next time.
class ArthaFeatures {
  ArthaFeatures._();

  static String? _forToken;
  static Future<Map<String, bool>>? _pending;

  static Future<Map<String, bool>> get() {
    final token = ApiClient.instance.token;
    if (_pending == null || _forToken != token) {
      _forToken = token;
      _pending = _ask();
    }
    return _pending!;
  }

  static Future<Map<String, bool>> _ask() async {
    try {
      final res = await ApiClient.instance.dio.get('/copilot/features');
      final f = (res.data['features'] as Map?) ?? const {};
      return {for (final e in f.entries) '${e.key}': e.value == true};
    } catch (_) {
      _pending = null;
      return const {};
    }
  }

  static Future<bool> drafts() async => (await get())['drafts'] == true;
  static Future<bool> suggestions() async => (await get())['suggestions'] == true;
}
