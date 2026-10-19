import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/auth_state.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/artha/artha_help.dart';
import 'package:arthaleads_mobile/screens/artha/artha_sheet.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The chat stream ends in an error event; tickets are accepted.
class _Server implements HttpClientAdapter {
  Map<String, dynamic>? ticket;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    if (o.path.endsWith('/copilot/chat')) {
      final sse = 'data: {"type":"start","threadId":"t1"}\n\ndata: {"type":"error","message":"Artha hit a problem."}\n\n';
      return ResponseBody(Stream.value(Uint8List.fromList(utf8.encode(sse))), 200,
          headers: {Headers.contentTypeHeader: ['text/event-stream']});
    }
    Object out = {'success': true, 'starters': [], 'features': {}};
    if (o.path.endsWith('/tickets')) {
      ticket = (o.data as Map).cast<String, dynamic>();
      out = {'success': true, 'ticket': {'ticketNumber': 'TKT-0042'}};
    }
    return ResponseBody.fromString(jsonEncode(out), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

Future<_Server> _open(WidgetTester tester, {void Function(String)? onNavigate, String? navigated}) async {
  SharedPreferences.setMockInitialValues({});
  await ApiClient.instance.setToken('t');
  final server = _Server();
  ApiClient.instance.dio.httpClientAdapter = server;
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  final auth = AuthState()
    ..user = {'_id': 'u1', 'name': 'Riya Shah', 'email': 'riya@example.com', 'role': 'admin'}
    ..restoring = false;
  await tester.pumpWidget(ChangeNotifierProvider<AuthState>.value(
    value: auth,
    child: MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => showArthaSheet(context, navLabel: 'Dashboard', onNavigate: onNavigate),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await _settle(tester);
  return server;
}

void main() {
  testWidgets('common questions answer instantly and Go there opens that screen', (tester) async {
    String? went;
    await _open(tester, onNavigate: (l) => went = l);
    await tester.tap(find.text('Common questions'));
    await _settle(tester);
    await tester.tap(find.text(arthaQuickAnswers.first.q));
    await _settle(tester);
    expect(find.text(arthaQuickAnswers.first.a), findsOneWidget);
    expect(find.text('Report'), findsNothing); // no AI wrote it
    await tester.tap(find.text('Go to Leads'));
    await _settle(tester);
    expect(went, 'Leads');
  });

  testWidgets('a failed answer offers a ticket, sent with the question as subject', (tester) async {
    final server = await _open(tester);
    await tester.enterText(find.byType(TextField).first, 'Why is my report empty?');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await _settle(tester);
    expect(find.text('Artha hit a problem.'), findsOneWidget);
    await tester.tap(find.text('Raise a ticket'));
    await _settle(tester);
    await tester.enterText(find.byType(TextField).last, 'It shows nothing for October.');
    await tester.tap(find.text('Send ticket'));
    await _settle(tester);
    expect(server.ticket?['subject'], 'Why is my report empty?');
    expect(server.ticket?['description'], 'It shows nothing for October.');
    expect(find.textContaining('Ticket TKT-0042 raised'), findsOneWidget);
    expect(find.textContaining('riya@example.com'), findsOneWidget);
    expect(find.text('Raise a ticket'), findsNothing);
  });

  test('every common question opens a real drawer screen', () {
    const labels = {'Dashboard', 'Leads', 'WhatsApp', 'Follow-ups', 'Pipeline', 'Projects', 'Tasks', 'Calls', 'Attendance', 'Bookings', 'Team', 'Integrations', 'Referrals'};
    for (final a in arthaQuickAnswers) {
      expect(labels.contains(a.goto), isTrue, reason: a.q);
      expect(a.a.contains('—'), isFalse, reason: 'no em dashes: ${a.q}');
    }
  });
}
