import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/artha_stream.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Replies with [chunks] as one streamed body, split exactly as given.
class _Server implements HttpClientAdapter {
  _Server(this.status, this.chunks);
  final int status;
  final List<List<int>> chunks;
  Map<String, dynamic>? sentBody;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    sentBody = o.data as Map<String, dynamic>?;
    return ResponseBody(
      Stream.fromIterable(chunks.map(Uint8List.fromList)),
      status,
      headers: {Headers.contentTypeHeader: [status == 200 ? 'text/event-stream' : 'application/json']},
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await ApiClient.instance.setToken('t');
  });

  test('events split across chunks, including a character split mid-byte, arrive whole', () async {
    final all = utf8.encode(
      'data: {"type":"start","threadId":"abc"}\n\n'
      'data: {"type":"text","delta":"नमस्ते Rahul"}\n\n'
      'data: {"type":"done","turnId":"t1","text":"नमस्ते Rahul"}\n\n',
    );
    // Cut inside the Devanagari bytes and inside an event.
    final server = _Server(200, [all.sublist(0, 20), all.sublist(20, 45), all.sublist(45, 47), all.sublist(47)]);
    ApiClient.instance.dio.httpClientAdapter = server;
    final events = <Map<String, dynamic>>[];
    await streamArtha({'question': 'hi', 'page': '/leads'}, events.add);
    expect(events.map((e) => e['type']), ['start', 'text', 'done']);
    expect(events[1]['delta'], 'नमस्ते Rahul');
    expect(server.sentBody?['page'], '/leads');
  });

  test('a malformed event is skipped, the rest still arrive', () async {
    ApiClient.instance.dio.httpClientAdapter = _Server(200, [
      utf8.encode('data: {broken\n\ndata: {"type":"done"}\n\n'),
    ]);
    final events = <Map<String, dynamic>>[];
    await streamArtha({'question': 'hi'}, events.add);
    expect(events.single['type'], 'done');
  });

  test('a refusal before the stream starts surfaces the server message', () async {
    ApiClient.instance.dio.httpClientAdapter = _Server(429, [
      utf8.encode(jsonEncode({'success': false, 'code': 'ALLOWANCE', 'message': "Your company has used this month's Artha allowance."})),
    ]);
    await expectLater(
      streamArtha({'question': 'hi'}, (_) {}),
      throwsA(isA<ArthaRefused>()
          .having((e) => e.status, 'status', 429)
          .having((e) => e.message, 'message', contains('allowance'))),
    );
  });
}
