import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/leads/quick_add_lead.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Server implements HttpClientAdapter {
  Map<String, dynamic>? created;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    Object out = {'success': true};
    if (o.path.endsWith('/leads/check-duplicate')) {
      out = {
        'success': true,
        'duplicate': '${o.queryParameters['phone']}'.replaceAll(' ', '') == '9820012345'
            ? {'_id': 'old1', 'name': 'Rahul Shah', 'status': 'Contacted', 'assignedToName': 'Riya', 'createdAt': '2026-10-01T05:00:00Z'}
            : null,
      };
    } else if (o.path.endsWith('/leads') && o.method == 'POST') {
      created = (o.data as Map).cast<String, dynamic>();
      out = {'success': true, 'data': {'_id': 'new1', ...created!}};
    }
    return ResponseBody.fromString(jsonEncode(out), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

Future<void> _settle(WidgetTester t) async {
  for (var i = 0; i < 12; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

Future<(_Server, List<QuickAddResult?>)> _open(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues({});
  await ApiClient.instance.setToken('t');
  final server = _Server();
  ApiClient.instance.dio.httpClientAdapter = server;
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  final results = <QuickAddResult?>[];
  await tester.pumpWidget(MaterialApp(
    theme: buildTheme(Brightness.light),
    home: Builder(
      builder: (ctx) => Scaffold(
        body: TextButton(onPressed: () async => results.add(await showQuickAddLead(ctx)), child: const Text('go')),
      ),
    ),
  ));
  await tester.tap(find.text('go'));
  await _settle(tester);
  return (server, results);
}

void main() {
  testWidgets('a number that is already a lead shows it, and Open hands it back', (tester) async {
    final (_, results) = await _open(tester);
    await tester.enterText(find.byType(TextField).at(1), '98200 12345');
    await _settle(tester);
    expect(find.textContaining('Rahul Shah', findRichText: true), findsOneWidget);
    expect(find.text('Save anyway'), findsOneWidget);
    await tester.tap(find.text('Open'));
    await _settle(tester);
    expect(results.single?.openLeadId, 'old1');
  });

  testWidgets('saves name, phone and the chosen source, then offers the next step', (tester) async {
    final (server, results) = await _open(tester);
    await tester.enterText(find.byType(TextField).at(0), 'Meera Iyer');
    await tester.enterText(find.byType(TextField).at(1), '9876543210');
    await tester.tap(find.text('Walk-in'));
    await _settle(tester);
    expect(find.textContaining('Already a lead', findRichText: true), findsNothing);
    await tester.tap(find.text('Save lead'));
    await _settle(tester);
    expect(server.created?['name'], 'Meera Iyer');
    expect(server.created?['source'], 'Walk-in');
    expect(find.text('Lead added'), findsOneWidget);
    expect(find.text('WhatsApp'), findsWidgets);
    await tester.tap(find.text('Follow-up'));
    await _settle(tester);
    expect(results.single?.saved, isTrue);
    expect(results.single?.openLeadId, 'new1');
  });

  testWidgets('More details hands what was typed to the full form', (tester) async {
    final (_, results) = await _open(tester);
    await tester.enterText(find.byType(TextField).at(0), 'Arjun');
    await tester.tap(find.textContaining('More details'));
    await _settle(tester);
    expect(results.single?.moreDetails?['name'], 'Arjun');
  });
}
