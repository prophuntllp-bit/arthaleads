import 'dart:convert';
import 'dart:typed_data';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/screens/inbox/credits_usage.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Server implements HttpClientAdapter {
  _Server(this.body);
  final Map<String, dynamic> body;
  final asked = <Map<String, dynamic>>[];
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? b, Future<void>? cancel) async {
    asked.add(o.queryParameters);
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }
  @override
  void close({bool force = false}) {}
}

final _usage = {
  'billedDirectlyByMeta': false,
  'totals': {'messages': 140, 'free': 100, 'paid': 40, 'spentPaise': 92310, 'estMetaPaise': 0},
  'days': [
    {'date': '2026-10-15', 'service': 30, 'marketing': 10, 'other': 2},
    {'date': '2026-10-16', 'service': 40, 'marketing': 0, 'other': 0},
    {'date': '2026-10-17', 'service': 30, 'marketing': 25, 'other': 3},
  ],
  'categories': [
    {'category': 'service', 'label': 'Replies', 'messages': 100, 'free': 100, 'paid': 0, 'ratePaise': 115, 'spentPaise': 0},
    {'category': 'marketing', 'label': 'Marketing', 'messages': 35, 'free': 0, 'paid': 35, 'ratePaise': 2500, 'spentPaise': 87500},
  ],
  'sources': {'bot': 60, 'team': 45, 'campaigns': [{'name': 'Diwali offer', 'messages': 35}]},
};

Future<_Server> _pump(WidgetTester tester, Map<String, dynamic> body) async {
  SharedPreferences.setMockInitialValues({});
  await ApiClient.instance.setToken('t');
  final s = _Server(body);
  ApiClient.instance.dio.httpClientAdapter = s;
  await tester.pumpWidget(MaterialApp(
    theme: buildTheme(Brightness.light),
    home: const Scaffold(body: SingleChildScrollView(child: CreditsUsageSection())),
  ));
  await tester.pumpAndSettle();
  return s;
}

void main() {
  testWidgets('totals, chart, types, who sent them and campaigns for the last 30 days', (tester) async {
    final s = await _pump(tester, _usage);
    expect(s.asked.single, {'dateRange': 'last30days'});
    expect(find.text('Credits utilization'), findsOneWidget);
    expect(find.text('Last 30 days'), findsOneWidget);
    expect(find.text('140'), findsOneWidget);
    expect(find.text('₹923.10'), findsOneWidget);
    expect(find.text('Messages sent per day'), findsOneWidget);
    expect(find.textContaining('35 sent · 0 free · 35 paid · ₹25.00 each'), findsOneWidget);
    expect(find.text('₹875.00'), findsOneWidget);
    expect(find.text('Your team'), findsOneWidget);
    expect(find.text('45 · 32%'), findsOneWidget);
    expect(find.text('Diwali offer'), findsOneWidget);
  });

  testWidgets('a period with nothing sent says so', (tester) async {
    await _pump(tester, {
      ..._usage,
      'totals': {'messages': 0, 'free': 0, 'paid': 0, 'spentPaise': 0},
      'days': [],
      'categories': [],
      'sources': {'bot': 0, 'team': 0, 'campaigns': []},
    });
    expect(find.text('No messages were sent in this period.'), findsOneWidget);
    expect(find.text('Messages sent per day'), findsNothing);
  });

  test('Maximum asks for all time, a custom range sends from/to', () {
    expect(creditRangeParams(''), {'dateRange': 'all'});
    expect(creditRangeParams('thismonth'), {'dateRange': 'thismonth'});
    expect(creditRangeParams({'preset': 'custom', 'from': '2026-10-01', 'to': '2026-10-17'}), {'from': '2026-10-01', 'to': '2026-10-17'});
  });
}
