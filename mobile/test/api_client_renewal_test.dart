import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Answers every request with [status] and, when set, an X-Renewed-Token.
class _FakeServer implements HttpClientAdapter {
  _FakeServer(this.status, this.renewed);
  final int status;
  final String? renewed;
  final List<String?> sentAuth = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? body, Future<void>? cancel) async {
    sentAuth.add(options.headers['Authorization'] as String?);
    return ResponseBody.fromString(jsonEncode({'ok': true}), status, headers: {
      Headers.contentTypeHeader: ['application/json'],
      if (renewed != null) 'x-renewed-token': [renewed!],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  final api = ApiClient.instance;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await api.setToken('old');
  });

  Future<String?> stored() async => (await SharedPreferences.getInstance()).getString('auth_token');

  test('a renewed token from a reply replaces the stored one and is sent next', () async {
    final server = _FakeServer(200, 'fresh');
    api.dio.httpClientAdapter = server;
    await api.dio.get('/auth/me');
    expect(api.token, 'fresh');
    expect(await stored(), 'fresh');
    await api.dio.get('/leads');
    expect(server.sentAuth, ['Bearer old', 'Bearer fresh']);
  });

  test('an error reply that carries a renewed token is kept too', () async {
    api.dio.httpClientAdapter = _FakeServer(404, 'fresh');
    await expectLater(api.dio.get('/leads/x'), throwsA(isA<DioException>()));
    expect(api.token, 'fresh');
  });

  test('a reply without the header changes nothing', () async {
    api.dio.httpClientAdapter = _FakeServer(200, null);
    await api.dio.get('/auth/me');
    expect(api.token, 'old');
  });

  test('a renewal for a token no longer in use is ignored', () {
    // Signed out, or switched account, while the request was in flight.
    api.adoptRenewedToken('fresh', sentToken: 'someone-else');
    expect(api.token, 'old');
    api.adoptRenewedToken('fresh', sentToken: null);
    expect(api.token, 'old');
    api.adoptRenewedToken('', sentToken: 'old');
    expect(api.token, 'old');
  });

  test('after sign-out a late renewal does not sign the phone back in', () async {
    await api.clearToken();
    api.adoptRenewedToken('fresh', sentToken: 'old');
    expect(api.token, isNull);
    expect(await stored(), isNull);
  });
}
