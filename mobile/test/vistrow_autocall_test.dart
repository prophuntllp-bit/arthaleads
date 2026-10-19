import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/automation/vistrow_autocall_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> _status() => {
      'enabled': true,
      'enabledAt': '2026-10-19T04:30:00Z',
      'configured': true,
      'config': {'accountId': '42', 'linkedBy': 'vistrow', 'linkedAccountName': 'Vistrow Demo'},
      'routing': {
        'website': {'enabled': false, 'routes': []},
        'facebook': {
          'enabled': true,
          'routes': [
            {'id': 'r1', 'matchKind': 'any', 'matchValue': '*', 'agentRef': 'a1', 'agentLabel': 'Riya', 'unassigned': false},
            {'id': 'r2', 'matchKind': 'project', 'matchValue': 'p1', 'projectId': 'p1', 'projectName': 'Skyline', 'agentRef': 'a2', 'agentLabel': 'Arjun', 'unassigned': false},
          ],
        },
        // An API from before Google existed leaves it out: shown as off.
        'whatsapp': {'enabled': false, 'routes': []},
      },
      'health': {},
      'server': {},
      'stats24h': {'counts': {'delivered': 3, 'failed': 1}, 'callsRequested': 2, 'callsDeclinedByVistrow': 0},
    };

class _Server implements HttpClientAdapter {
  final puts = <Map<String, dynamic>>[];
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    Object out = {'success': true};
    final p = o.path;
    if (p.endsWith('/vistrow-outbound') && o.method == 'GET') out = {'success': true, 'status': _status()};
    if (p.endsWith('/agents')) {
      out = {'success': true, 'agents': [
        {'ref': 'a1', 'name': 'Riya', 'knowledgeBase': 'Skyline KB'},
        {'ref': 'a2', 'name': 'Arjun', 'knowledgeBase': 'General'},
      ]};
    }
    if (p.endsWith('/deliveries')) {
      out = {'success': true, 'deliveries': [
        {'id': 'd1', 'status': 'delivered', 'autoCall': true, 'agentLabel': 'Riya', 'routeLabel': 'Default', 'phone': '98•••••10', 'createdAt': '2026-10-19T05:00:00Z'},
        {'id': 'd2', 'status': 'skipped', 'skipReason': 'invalid_phone', 'phone': '-', 'createdAt': '2026-10-19T05:10:00Z'},
      ]};
    }
    if (p.endsWith('/routing') && o.method == 'PUT') {
      puts.add((o.data as Map).cast<String, dynamic>());
      out = {'success': true, 'status': _status()};
    }
    if (p.endsWith('/projects')) out = {'success': true, 'data': [{'_id': 'p1', 'name': 'Skyline'}]};
    return ResponseBody.fromString(jsonEncode(out), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('drops the automation name every Facebook option shares', () {
    final out = dropSharedPrefix([
      {'value': '1', 'label': 'PropHunt LLP - Lead Ads · Everglades II | Form A'},
      {'value': '2', 'label': 'PropHunt LLP - Lead Ads · Skyline | Form B'},
    ]);
    expect(out.map((o) => o['label']), ['Everglades II | Form A', 'Skyline | Form B']);
  });

  test('leaves a single option or unshared labels alone', () {
    final one = [
      {'value': '1', 'label': 'A · B'},
    ];
    expect(dropSharedPrefix(one), one);
    final mixed = [
      {'value': '1', 'label': 'A · x'},
      {'value': '2', 'label': 'B · y'},
    ];
    expect(dropSharedPrefix(mixed).map((o) => o['label']), ['A · x', 'B · y']);
  });

  testWidgets('shows sources, default agent, rules, summary and activity; removing a rule keeps the others\' agents', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await ApiClient.instance.setToken('t');
    final server = _Server();
    ApiClient.instance.dio.httpClientAdapter = server;
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(theme: buildTheme(Brightness.light), home: const VistrowAutoCallScreen()));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(find.textContaining('Live since 19 Oct'), findsOneWidget);
    expect(find.textContaining('Connected to Vistrow account 42 · Vistrow Demo'), findsOneWidget);
    expect(find.text('Found 2 agents you can use.'), findsOneWidget);
    expect(find.text('Google leads'), findsOneWidget); // filled in as off
    expect(find.text('Call them'), findsOneWidget); // only Facebook
    expect(find.text('Riya · Skyline KB'), findsOneWidget); // default agent
    expect(find.textContaining('Project: Skyline', findRichText: true), findsNWidgets(2)); // rule row + summary // the project rule
    expect(find.text('Arjun · General'), findsOneWidget);
    expect(find.textContaining('Facebook leads: called by Riya; 1 rule sends some'), findsOneWidget);
    expect(find.textContaining('Call → Riya via Default'), findsOneWidget);
    expect(find.text('No dialable phone'), findsOneWidget);

    await tester.tap(find.byTooltip('Remove this rule'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(server.puts, hasLength(1));
    final rows = ((server.puts.single['facebook'] as Map)['routes'] as List).cast<Map>();
    expect(rows, hasLength(1));
    expect(rows.single['_id'], 'r1');
    expect(rows.single.containsKey('agentRef'), isFalse); // server keeps Riya
  });
}
