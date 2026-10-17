import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/dashboard/morning_brief.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Brief implements HttpClientAdapter {
  _Brief(this.brief);
  final Map<String, dynamic>? brief;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async =>
      ResponseBody.fromString(jsonEncode({'success': true, 'brief': brief}), 200,
          headers: {Headers.contentTypeHeader: ['application/json']});
  @override
  void close({bool force = false}) {}
}

Future<void> _pump(WidgetTester tester, Map<String, dynamic>? brief) async {
  SharedPreferences.setMockInitialValues({});
  ApiClient.instance.dio.httpClientAdapter = _Brief(brief);
  await tester.pumpWidget(MaterialApp(
    theme: buildTheme(Brightness.light),
    home: Scaffold(
      body: SingleChildScrollView(
        child: MorningBrief(
          userId: 'u1',
          refresh: ValueNotifier(0),
          onNavigate: (_) {},
          onCall: ({required phone, name, leadId}) async {},
        ),
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows counts, needs attention, who to call and the team', (tester) async {
    await _pump(tester, {
      'date': '2026-10-17',
      'counts': {'visits': 1, 'chats': 2, 'overdue': 3, 'today': 0, 'fresh': 4},
      'risks': {
        'total': 1,
        'list': [
          {'id': 'r1', 'kind': 'lead', 'name': 'Neha J.', 'phone': '919800001111', 'type': 'hot_cold', 'reason': 'Hot lead, no contact for 4 days'},
        ],
      },
      'items': [
        {'id': 'l1', 'kind': 'lead', 'name': 'Priya S.', 'phone': '919800002222', 'reason': 'Site visit today 11:00 am', 'tag': 'visit'},
        {'id': 'c1', 'kind': 'chat', 'name': 'Rohan K.', 'reason': 'Waiting for your reply', 'tag': 'chat', 'conversationId': 'cv1'},
      ],
      'more': 2,
      'team': [
        {'name': 'Sneha P.', 'atRisk': 2, 'overdue': 3, 'fresh': 4, 'today': 1, 'visits': 0},
      ],
    });
    expect(find.text('ARTHA · SATURDAY 17 OCTOBER'), findsOneWidget);
    expect(find.text('Your day: who to call first'), findsOneWidget);
    expect(find.textContaining('missed follow-ups'), findsOneWidget);
    expect(find.textContaining('due today'), findsNothing); // zero counts are left out
    expect(find.textContaining('Needs attention'), findsOneWidget);
    expect(find.text('Hot lead, no contact for 4 days'), findsOneWidget);
    expect(find.text('Site visit today 11:00 am'), findsOneWidget);
    expect(find.text('2 more in Follow-ups'), findsOneWidget);
    expect(find.text('Plan my day with Artha'), findsOneWidget);
    expect(find.text('TEAM TODAY'), findsOneWidget);
    expect(find.text('Sneha P.'), findsOneWidget);
    expect(find.byTooltip('Call Priya S.'), findsOneWidget);
    expect(find.byTooltip('Call Rohan K.'), findsNothing); // a chat row opens the chat instead
    expect(find.byTooltip('Open the chat'), findsOneWidget);
  });

  testWidgets('nothing to do says so, without a list', (tester) async {
    await _pump(tester, {'date': '2026-10-17', 'counts': {}, 'risks': {'total': 0, 'list': []}, 'items': [], 'more': 0, 'team': []});
    expect(find.text('Nothing urgent today'), findsOneWidget);
    expect(find.text('Plan my day with Artha'), findsNothing);
  });

  testWidgets('a company without the brief sees no card', (tester) async {
    await _pump(tester, null);
    expect(find.textContaining('ARTHA ·'), findsNothing);
  });
}
