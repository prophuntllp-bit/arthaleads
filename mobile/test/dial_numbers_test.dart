import 'package:arthaleads_mobile/core/dial_numbers.dart';
import 'package:flutter_test/flutter_test.dart';

// Same cases as the web and server (frontend/src/utils/dialNumbers.js).
void main() {
  test('a plain Indian mobile gets +91', () {
    final n = dialOptions('7020074316');
    expect(n.single.e164, '917020074316');
    expect(n.single.indian, isTrue);
    expect(n.single.shown, '+91 70200 74316');
  });

  test('two numbers in one field, in the order written', () {
    final n = dialOptions('7020074316/8958108809');
    expect(n.map((e) => e.e164), ['917020074316', '918958108809']);
  });

  test('a leading 0 or 00 and duplicates are handled', () {
    expect(dialOptions('07020074316').single.e164, '917020074316');
    expect(dialOptions('0091 70200 74316, +91 7020074316').single.e164, '917020074316');
  });

  test('a UAE number is valid but not Indian', () {
    final n = dialOptions('+971 50 123 4567').single;
    expect(n.indian, isFalse);
    expect(n.valid, isTrue);
    expect(n.country, 'UAE');
  });

  test('junk is not a dialable number', () {
    expect(dialOptions('12345').single.valid, isFalse);
    expect(dialOptions(''), isEmpty);
  });
}
