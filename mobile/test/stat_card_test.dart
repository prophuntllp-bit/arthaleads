import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/widgets/cards.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Three stat cards across, as on the Performance screen. On a 360dp phone each
// slot is about 100dp wide; the label used to be squeezed to "Total Lea…".
// It must wrap instead, with no overflow, on every width and font size.
void main() {
  for (final w in [320.0, 360.0, 412.0]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('three StatCards fit at ${w.toInt()}dp, text x$scale', (tester) async {
        tester.view.physicalSize = Size(w, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(MaterialApp(
          theme: buildTheme(Brightness.light),
          home: MediaQuery(
            data: MediaQueryData(size: Size(w, 800), textScaler: TextScaler.linear(scale)),
            child: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: const [
                      Expanded(child: StatCard(compact: true, label: 'Total Leads', value: '6879', icon: Icons.people, color: Colors.orange)),
                      SizedBox(width: 8),
                      Expanded(child: StatCard(compact: true, label: 'Site Visits', value: '11', icon: Icons.flag, color: Colors.blue)),
                      SizedBox(width: 8),
                      Expanded(child: StatCard(compact: true, label: 'Closed / Booked', value: '3', icon: Icons.emoji_events, color: Colors.green)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Closed / Booked'), findsOneWidget);
      });
    }
  }
}
