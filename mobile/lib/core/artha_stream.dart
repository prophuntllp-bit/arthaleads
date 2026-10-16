import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import 'api_client.dart';

/// Thrown when the server refuses before the stream starts: 403 (Artha off),
/// 429 with code ALLOWANCE (monthly allowance used up), 503 (no AI key).
class ArthaRefused implements Exception {
  final int status;
  final String message;
  const ArthaRefused(this.status, this.message);
  @override
  String toString() => message;
}

/// Streams one Artha answer from POST /api/copilot/chat (server-sent events).
///
/// Mirrors frontend/src/services/arthaStream.js. Goes through the shared dio
/// client, so the bearer token and X-Renewed-Token handling are the same as
/// every other request. Each `data: {...}` block is decoded and handed to
/// [onEvent]; the future completes when the stream ends. Cancelling [cancel]
/// stops the answer (the server aborts the model call when the socket closes).
Future<void> streamArtha(
  Map<String, dynamic> body,
  void Function(Map<String, dynamic> event) onEvent, {
  CancelToken? cancel,
}) async {
  Response<ResponseBody> res;
  try {
    res = await ApiClient.instance.dio.post<ResponseBody>(
      '/copilot/chat',
      data: body,
      cancelToken: cancel,
      options: Options(
        responseType: ResponseType.stream,
        headers: {'Accept': 'text/event-stream'},
        // An answer with several lookups can take a while between events.
        receiveTimeout: const Duration(seconds: 90),
      ),
    );
  } on DioException catch (e) {
    if (CancelToken.isCancel(e)) rethrow;
    final r = e.response;
    if (r == null) throw const ArthaRefused(0, "Couldn't reach Artha. Check your internet and try again.");
    throw ArthaRefused(r.statusCode ?? 0, await _refusalMessage(r.data));
  }

  var buffer = '';
  await for (final chunk in res.data!.stream.cast<List<int>>().transform(utf8.decoder)) {
    buffer += chunk;
    int cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      final block = buffer.substring(0, cut);
      buffer = buffer.substring(cut + 2);
      for (final line in block.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          final event = jsonDecode(line.substring(6));
          if (event is Map) onEvent(event.cast<String, dynamic>());
        } catch (_) {
          // A malformed event is skipped, as on the web.
        }
      }
    }
  }
}

/// The JSON message of a refusal. With a stream response type dio leaves the
/// body unread, so it is read here.
Future<String> _refusalMessage(dynamic data) async {
  const fallback = "Artha couldn't answer right now. Please try again.";
  try {
    String text;
    if (data is ResponseBody) {
      text = await data.stream.cast<List<int>>().transform(utf8.decoder).join();
    } else if (data is Map) {
      return (data['message'] as String?) ?? fallback;
    } else {
      text = '$data';
    }
    final j = jsonDecode(text);
    if (j is Map && j['message'] is String) return j['message'] as String;
  } catch (_) {}
  return fallback;
}
