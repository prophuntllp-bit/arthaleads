import 'package:arthaleads_mobile/widgets/adaptive_grid.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The Integrations cards overflowed on a 360dp phone because a fixed-ratio
// GridView gave every card the same height whatever its text needed. These
// cards carry the longest real descriptions in the app; the grid must fit them
// on every screen width and font size without an overflow, and cards in a row
// must end at the same height.
const _texts = [
  'Connected · manage provider & profile',
  'Google Ads Lead Form — sign in or use a webhook URL and key',
  'Auto-capture leads from any WordPress contact form',
  'Connect any other partner, broker, or vendor lead source',
  'Qualified leads from the Vistrow Voice AI calling platform',
  'Connect EnableX so agents can call leads straight from the CRM',
];

Widget _card(String t) => Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(border: Border.all()),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.link, size: 42),
          const SizedBox(height: 10),
          Text(t.split(' ').take(2).join(' '), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          Text(t, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );

void main() {
  const sizes = {
    'small 320x640': Size(320, 640),
    'common 360x800': Size(360, 800),
    'large 412x915': Size(412, 915),
    'tablet 800x1280': Size(800, 1280),
  };
  for (final scale in [0.9, 1.0, 1.3]) {
    for (final e in sizes.entries) {
      testWidgets('fits at ${e.key}, text x$scale', (tester) async {
        tester.view.physicalSize = e.value;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(size: e.value, textScaler: TextScaler.linear(scale)),
            child: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: AdaptiveGrid(
                  columns: e.value.width >= 600 ? 3 : 2,
                  spacing: 10,
                  children: [for (final t in _texts) _card(t)],
                ),
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        // Cards in the same row end at the same height.
        final boxes = tester.widgetList<Container>(find.byType(Container)).length;
        expect(boxes, greaterThan(0));
        final rects = [
          for (final f in find.byType(Container).evaluate())
            if ((f.widget as Container).decoration != null) tester.getRect(find.byWidget(f.widget)),
        ];
        expect(rects.length, _texts.length);
        for (final r in rects) {
          final sameRow = rects.where((o) => (o.top - r.top).abs() < 1);
          for (final o in sameRow) {
            expect((o.height - r.height).abs() < 1, isTrue, reason: 'row cards differ in height');
          }
          expect(r.right <= e.value.width, isTrue, reason: 'card runs off the screen');
        }
      });
    }
  }
}
