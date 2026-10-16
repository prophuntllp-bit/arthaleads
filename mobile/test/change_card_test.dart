import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/screens/artha/change_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Answers /help/* the way the server does and records every call.
class _Help implements HttpClientAdapter {
  final calls = <(String, Map<String, dynamic>)>[];
  int actionStatus = 200;
  bool scope = false;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    final data = (o.data as Map).cast<String, dynamic>();
    calls.add((o.path, data));
    Map<String, dynamic> out;
    var status = 200;
    switch (o.path) {
      case '/help/preview':
        if (scope && data['scopeConfirmed'] != true) {
          status = 409;
          out = {'success': false, 'needsScopeChange': true, 'message': 'This works on Leads.', 'scopeLabel': 'Leads'};
        } else {
          out = {
            'success': true,
            'subject': 'Rahul Sharma',
            'fields': [
              {'label': 'Status', 'param': 'status', 'from': 'Contacted', 'to': data['params']['status'], 'editor': {'type': 'select', 'options': ['Contacted', 'Site Visit']}},
            ],
          };
        }
      case '/help/action':
        status = actionStatus;
        out = status == 200
            ? {'success': true, 'message': 'Rahul Sharma updated.', 'undoable': true, 'undoKey': data['idempotencyKey']}
            : {'success': false, 'message': 'Network blip'};
      default:
        out = {'success': true, 'message': 'Put back.'};
    }
    return ResponseBody.fromString(jsonEncode(out), status, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

ChangeProposal _card() => ChangeProposal(
      type: 'update_lead_status',
      params: {'leadId': 'L1', 'status': 'Site Visit'},
      page: '/leads',
      prompt: 'move Rahul to site visit',
      threadId: 'T1',
    );

void main() {
  late _Help server;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await ApiClient.instance.setToken('t');
    server = _Help();
    ApiClient.instance.dio.httpClientAdapter = server;
  });

  test('preview, then apply with the source, thread and an idempotency key; Undo puts it back', () async {
    final c = _card();
    final before = ArthaEvents.changed.value;
    await c.loadPreview();
    expect(c.pending, isTrue);
    expect(c.fields.single['to'], 'Site Visit');

    expect(await c.apply(), isNull);
    final action = server.calls.firstWhere((x) => x.$1 == '/help/action').$2;
    expect(action['source'], 'artha');
    expect(action['threadId'], 'T1');
    expect(action['scopeConfirmed'], isTrue);
    expect(action['idempotencyKey'], startsWith('update_lead_status-'));
    expect(c.doneMessage, 'Rahul Sharma updated.');
    expect(c.undoKey, action['idempotencyKey']);
    expect(ArthaEvents.changed.value, before + 1);

    expect(await c.undo(), isNull);
    expect(c.undone, isTrue);
    expect(server.calls.last.$1, '/help/undo');
    expect(server.calls.last.$2['undoKey'], action['idempotencyKey']);
  });

  test('a failed apply keeps the card and retries with the same key', () async {
    final c = _card();
    await c.loadPreview();
    server.actionStatus = 500;
    expect(await c.apply(), isNotNull);
    expect(c.pending, isTrue);
    server.actionStatus = 200;
    expect(await c.apply(), isNull);
    final keys = server.calls.where((x) => x.$1 == '/help/action').map((x) => x.$2['idempotencyKey']).toList();
    expect(keys, hasLength(2));
    expect(keys[0], keys[1]);
  });

  test('editing a value asks for a new preview with the new params', () async {
    final c = _card();
    await c.loadPreview();
    await c.edit('status', 'Contacted');
    final previews = server.calls.where((x) => x.$1 == '/help/preview').toList();
    expect(previews, hasLength(2));
    expect(previews.last.$2['params']['status'], 'Contacted');
    expect(c.fields.single['to'], 'Contacted');
  });

  test('a page-scope refusal asks first, and "Yes" previews with scope confirmed', () async {
    server.scope = true;
    final c = _card()..scopeConfirmed = false;
    await c.loadPreview();
    expect(c.scopePrompt?['scopeLabel'], 'Leads');
    expect(c.pending, isFalse);
    await c.allowScope();
    expect(c.scopePrompt, isNull);
    expect(c.pending, isTrue);
  });

  test('bulk rows: unticking removes the lead from leadIds', () async {
    final c = ChangeProposal(type: 'bulk_assign', params: {'leadIds': ['a', 'b']}, page: '/leads', prompt: '', threadId: null)
      ..preview = {
        'rows': [
          {'id': 'a', 'name': 'A', 'from': 'X'},
          {'id': 'b', 'name': 'B', 'from': 'X'},
        ],
      };
    expect(c.chosenCount, 2);
    c.toggleRow('b', false);
    expect(c.params['leadIds'], ['a']);
    expect(c.chosenCount, 1);
  });
}
