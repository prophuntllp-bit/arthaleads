import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/leads/vistrow_call.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Server implements HttpClientAdapter {
  _Server(this.status);
  final Map<String, dynamic> status;
  int calls = 0;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    Map<String, dynamic> out = status;
    if (o.method == 'POST' && o.path.endsWith('/call')) {
      calls++;
      out = {'success': true, 'queued': true};
    }
    return ResponseBody.fromString(jsonEncode(out), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }
  @override
  void close({bool force = false}) {}
}

final _later = DateTime.now().toUtc().add(const Duration(minutes: 30)).toIso8601String();

Future<VistrowCall> _loaded(Map<String, dynamic> status, {String role = 'manager', String? leadId = 'L1'}) async {
  SharedPreferences.setMockInitialValues({});
  await ApiClient.instance.setToken('t');
  ApiClient.instance.dio.httpClientAdapter = _Server(status);
  final vc = VistrowCall(leadId: leadId, role: role);
  await vc.load();
  return vc;
}

void main() {
  test('managers may ask for an AI call when routing would call; agents never', () async {
    final s = {'success': true, 'enabled': true, 'canCall': true, 'nextAgentLabel': 'Riya', 'lastDelivery': null};
    final m = await _loaded(s);
    expect(m.canAiCall, isTrue);
    expect(m.agentLabel, 'Riya');
    expect(m.busy, isFalse);
    final a = await _loaded(s, role: 'agent');
    expect(a.canAiCall, isFalse);
    final project = await _loaded(s, leadId: null);
    expect(project.canAiCall, isFalse);
  });

  test('a queued or in-flight call counts as busy', () async {
    final queued = await _loaded({'enabled': true, 'canCall': true, 'lastDelivery': {'status': 'delivered', 'callQueued': true, 'callQueuedUntil': _later}});
    expect(queued.busy, isTrue);
    expect(queued.queuedUntil, isNotNull);
    final sending = await _loaded({'enabled': true, 'canCall': true, 'lastDelivery': {'status': 'sending'}});
    expect(sending.busy, isTrue);
    final past = await _loaded({'enabled': true, 'canCall': true, 'lastDelivery': {'status': 'delivered', 'callQueued': true, 'callQueuedUntil': '2026-01-01T00:00:00Z'}});
    expect(past.busy, isFalse);
  });

  testWidgets('panel: last call, tries, declined reason; button says AI calling while busy', (tester) async {
    late VistrowCall vc;
    await tester.runAsync(() async {
      vc = await _loaded({
        'enabled': true,
        'canCall': true,
        'nextAgentLabel': 'Riya',
        'lastDelivery': {'status': 'delivered', 'autoCall': true, 'callQueued': false, 'callReasonText': 'Outside calling hours'},
      });
    });
    final lead = {
      '_id': 'L1',
      'voiceCalls': [
        {'result': 'Interested, site visit', 'createdAt': '2026-10-17T06:30:00Z', 'attempts': 2},
        {'result': 'No answer', 'createdAt': '2026-10-16T06:30:00Z'},
      ],
    };
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Scaffold(body: Column(children: [VistrowCallButton(vc: vc), VistrowCallPanel(vc: vc, lead: lead)])),
    ));
    expect(find.text('VISTROW AI CALLS'), findsOneWidget);
    expect(find.textContaining('Interested, site visit · Sat 17 Oct, 12:00 pm'), findsOneWidget);
    expect(find.textContaining('3'), findsWidgets); // 2 + 1 tries
    expect(find.textContaining('Outside calling hours'), findsOneWidget);
    expect(find.text('AI call · Riya'), findsOneWidget);
  });

  testWidgets('a person calling while the AI is busy is asked first', (tester) async {
    late VistrowCall vc;
    await tester.runAsync(() async {
      vc = await _loaded({'enabled': true, 'canCall': true, 'lastDelivery': {'status': 'sending'}});
    });
    bool? answer;
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (ctx) => TextButton(onPressed: () async => answer = await okToCallDespiteAi(ctx, vc), child: const Text('call'))),
    ));
    await tester.tap(find.text('call'));
    await tester.pumpAndSettle();
    expect(find.text('Vistrow AI is calling this lead right now. Call anyway?'), findsOneWidget);
    await tester.tap(find.text('Wait'));
    await tester.pumpAndSettle();
    expect(answer, isFalse);
  });
}
