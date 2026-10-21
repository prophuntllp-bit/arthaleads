import 'dart:ui' as ui;

import 'package:arthaleads_mobile/widgets/qr_sheet.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a live build points QRs at www.arthaleads.com', () {
    // Tests run with the default API base (the live server).
    expect(qrFormBase(), 'https://www.arthaleads.com');
  });

  testWidgets('the poster is an A4 PNG', (tester) async {
    await tester.runAsync(() async {
      final png = await renderQrPoster(url: 'https://www.arthaleads.com/form/abc123abc123', title: 'Khopoli Plots', subtitle: 'Test Realty');
      expect(png.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);
      final frame = await (await ui.instantiateImageCodec(png)).getNextFrame();
      expect([frame.image.width, frame.image.height], [1240, 1754]);
    });
  });
}
