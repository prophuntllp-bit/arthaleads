import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/artha/suggest_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Server implements HttpClientAdapter {
  _Server(this.suggestionsOn);
  final bool suggestionsOn;
  Map<String, dynamic>? saved;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    Map<String, dynamic> out = {'success': true};
    if (o.path == '/copilot/features') out = {'success': true, 'features': {'suggestions': suggestionsOn}};
    if (o.path.startsWith('/copilot/suggestions/')) {
      saved = (o.data as Map).cast<String, dynamic>();
      out = {'success': true, 'applied': saved!['fields']};
    }
    return ResponseBody.fromString(jsonEncode(out), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }
  @override
  void close({bool force = false}) {}
}

final _lead = {
  '_id': 'L1',
  'preferredLocation': 'Kharghar',
  'budget': {'min': 0, 'max': 6000000},
  'arthaSuggest': {
    'fields': {'preferredLocation': 'Wakad', 'budget': {'min': 7500000, 'max': 8500000}},
  },
};

Future<_Server> _pump(WidgetTester tester, {bool on = true}) async {
  SharedPreferences.setMockInitialValues({});
  await ApiClient.instance.setToken('t-${DateTime.now().microsecondsSinceEpoch}'); // fresh features ask
  final server = _Server(on);
  ApiClient.instance.dio.httpClientAdapter = server;
  await tester.pumpWidget(MaterialApp(
    theme: buildTheme(Brightness.light),
    home: Scaffold(body: ArthaSuggestCard(lead: _lead)),
  ));
  await tester.pumpAndSettle();
  return server;
}

void main() {
  testWidgets('shows what the chat said against the lead, and saves only the ticked ones', (tester) async {
    final server = await _pump(tester);
    expect(find.text('Artha found in the WhatsApp chat'), findsOneWidget);
    expect(find.textContaining('Wakad'), findsOneWidget);
    expect(find.textContaining('₹75 L to ₹85 L'), findsOneWidget);
    expect(find.textContaining('₹60 L'), findsOneWidget);
    await tester.tap(find.byType(Checkbox).last); // untick Budget
    await tester.pump();
    expect(find.text('Save 1'), findsOneWidget);
    await tester.tap(find.text('Save 1'));
    await tester.pumpAndSettle();
    expect(server.saved, {'action': 'save', 'fields': ['preferredLocation']});
    expect(find.textContaining('Wakad'), findsNothing); // handled, gone from the card
    expect(find.textContaining('₹75 L to ₹85 L'), findsOneWidget);
  });

  testWidgets('in a chat it is one line that opens into the card', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await ApiClient.instance.setToken('t-compact-${DateTime.now().microsecondsSinceEpoch}');
    ApiClient.instance.dio.httpClientAdapter = _Server(true);
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Scaffold(body: ArthaSuggestCard(lead: _lead, compact: true)),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Artha found 2 details in this chat'), findsOneWidget);
    expect(find.byType(Checkbox), findsNothing);
    await tester.tap(find.text('Review'));
    await tester.pumpAndSettle();
    expect(find.text('Artha found in the WhatsApp chat'), findsOneWidget);
    expect(find.byType(Checkbox), findsNWidgets(2));
  });

  testWidgets('hidden when the company does not have suggestions', (tester) async {
    await _pump(tester, on: false);
    expect(find.text('Artha found in the WhatsApp chat'), findsNothing);
  });
}
