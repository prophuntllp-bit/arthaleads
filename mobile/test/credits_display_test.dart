import 'package:arthaleads_mobile/screens/inbox/credits_page.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a negative balance reads "−₹45.30", never "₹-45.30"', () {
    expect(signedRupees(-4530), '−₹45.30');
    expect(signedRupees(123456), '₹1,234.56');
    expect(signedRupees(0), '₹0.00');
    expect(signedRupees(null), '₹0.00');
  });

  test('replies: free replies, then credits including the overdraft', () {
    const rate = {'service': 115};
    // Free replies left: always yes.
    expect(canSendReply({'freeService': {'remaining': 3}, 'ratesPaise': rate, 'spendablePaise': 0}), isTrue);
    // In overdraft but still within the limit: yes.
    expect(canSendReply({'freeService': {'remaining': 0}, 'ratesPaise': rate, 'availablePaise': -4530, 'spendablePaise': 45470}), isTrue);
    // Overdraft limit used up: no.
    expect(canSendReply({'freeService': {'remaining': 0}, 'ratesPaise': rate, 'availablePaise': -50000, 'spendablePaise': 0}), isFalse);
    // Older server without spendablePaise: the balance decides.
    expect(canSendReply({'freeService': {'remaining': 0}, 'ratesPaise': rate, 'availablePaise': 50}), isFalse);
    // Billed to their own account, or balance not known: never blocked.
    expect(canSendReply({'billedDirectlyByMeta': true, 'spendablePaise': 0}), isTrue);
    expect(canSendReply(null), isTrue);
  });
}
