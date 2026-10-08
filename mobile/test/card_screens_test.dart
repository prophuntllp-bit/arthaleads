import 'dart:convert';
import 'dart:io';

import 'package:arthaleads_mobile/core/api_client.dart';
import 'package:arthaleads_mobile/core/auth_state.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/core/theme_state.dart';
import 'package:arthaleads_mobile/screens/bookings/bookings_screen.dart';
import 'package:arthaleads_mobile/screens/followups/followups_screen.dart';
import 'package:arthaleads_mobile/screens/invoices/invoices_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

// The Follow-ups, Bookings and Invoices lists used a plain ListTile, whose
// large default title and fixed trailing column squeezed the content on a
// 360dp phone. These render the real screens with realistic, long data at
// narrow widths and big fonts and fail on any overflow.

class _FakeApi implements HttpClientAdapter {
  final Map<String, Object> routes;
  _FakeApi(this.routes);

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final key = routes.keys.firstWhere((k) => options.path.contains(k), orElse: () => '');
    final body = key.isEmpty ? {'data': []} : routes[key]!;
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

final _lead = {
  '_id': 'l1',
  'name': 'Shantibhushan Subramaniam Venkataraman',
  'phone': '919325241030',
  'source': 'WhatsApp',
  'booking': 'Interested',
  'followUpDate': '2026-10-08T05:30:00.000Z',
  'projectName': 'CTWA Meta Campaign | SP- Khopoli Plots',
  'assignedToName': 'Sheetal Powar Deshmukh',
  'remark1': 'Wants a 2BHK near the station, will visit on Sunday with family and decide.',
};

final _booking = {
  '_id': 'b1',
  'customerName': 'Shantibhushan Subramaniam Venkataraman',
  'jointBuyerName': 'Meenakshi Subramaniam',
  'projectName': 'Kalpataru Blossoms (Sheetal)',
  'unitType': '3BHK',
  'unitNo': '1204',
  'tower': 'Tower B',
  'phase': '2',
  'status': 'new',
  'totalBill': 24500000,
  'totalBrokerage': 612500,
  'bookingDate': '2026-10-05T05:30:00.000Z',
  'developerId': {'name': 'Kalpataru Properties Pvt Ltd'},
};

final _invoice = {
  '_id': 'i1',
  'customerName': 'Shantibhushan Subramaniam Venkataraman',
  'jointBuyerName': 'Meenakshi Subramaniam',
  'projectName': 'Kalpataru Blossoms (Sheetal)',
  'unitType': '3BHK',
  'unitNo': '1204',
  'tower': 'Tower B',
  'developerName': 'Kalpataru Properties Pvt Ltd',
  'status': 'draft',
  'invoiceNumber': 'INV-2026-0042',
  'totalBill': 24500000,
  'totalBrokerage': 612500,
  'invoiceDate': '2026-10-06T05:30:00.000Z',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});

  // The default test font (Ahem) makes every letter a full-width square, so
  // text measures about twice as wide as on a phone. Use a real font.
  setUpAll(() async {
    final root = Platform.environment['FLUTTER_ROOT'] ?? 'E:/dev/flutter';
    final f = File('$root/bin/cache/artifacts/material_fonts/roboto-regular.ttf');
    if (f.existsSync()) {
      final loader = FontLoader('Roboto')..addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
      await loader.load();
    }
  });

  final screens = <String, (Widget, Map<String, Object>)>{
    'follow-ups': (
      const FollowUpsScreen(),
      {'/followups': {'leads': [_lead, _lead], 'total': 2, 'pages': 1}},
    ),
    'bookings': (
      const BookingsScreen(),
      {
        '/bookings': {'data': [_booking, _booking]},
        '/developers': {'data': []},
      },
    ),
    'invoices': (
      const InvoicesScreen(),
      {'/invoices': {'data': [_invoice, _invoice]}},
    ),
  };

  for (final e in screens.entries) {
    for (final w in [320.0, 360.0]) {
      for (final scale in [1.0, 1.3]) {
        testWidgets('${e.key} fits at ${w.toInt()}dp, text x$scale', (tester) async {
          tester.view.physicalSize = Size(w, 800);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          ApiClient.instance.dio.httpClientAdapter = _FakeApi(e.value.$2);
          final errors = <FlutterErrorDetails>[];
          final prev = FlutterError.onError;
          FlutterError.onError = errors.add;
          final auth = AuthState()
            ..user = {'_id': 'u1', 'name': 'Abhishek Ghadge', 'role': 'admin'}
            ..org = {'plan': 'enterprise'}
            ..restoring = false;
          await tester.pumpWidget(MultiProvider(
            providers: [
              ChangeNotifierProvider<AuthState>.value(value: auth),
              ChangeNotifierProvider<ThemeState>(create: (_) => ThemeState()),
            ],
            child: MaterialApp(
              theme: _withFont(buildTheme(Brightness.light)),
              home: MediaQuery(
                data: MediaQueryData(size: Size(w, 800), textScaler: TextScaler.linear(scale)),
                child: Scaffold(body: e.value.$1),
              ),
            ),
          ));
          // The first frames are the loading placeholder; the list itself is
          // what has to fit, so check from the loaded state on.
          await tester.pump(const Duration(milliseconds: 600));
          errors.clear();
          await tester.pump(const Duration(milliseconds: 600));
          await tester.pump(const Duration(milliseconds: 600));
          FlutterError.onError = prev;
          tester.takeException();
          expect(errors.map((d) => d.toDiagnosticsNode().toStringDeep()).toList(), isEmpty);
          expect(find.textContaining('Shantibhushan'), findsWidgets);
        });
      }
    }
  }
}

ThemeData _withFont(ThemeData t) => t.copyWith(
      textTheme: t.textTheme.apply(fontFamily: 'Roboto'),
      primaryTextTheme: t.primaryTextTheme.apply(fontFamily: 'Roboto'),
    );
