import 'package:arthaleads_mobile/core/dial_numbers.dart';
import 'package:arthaleads_mobile/core/theme.dart';
import 'package:arthaleads_mobile/widgets/call_transcript.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _show(WidgetTester tester, Map meta) => tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Scaffold(body: SingleChildScrollView(child: CallTranscriptView(meta: meta, agentName: 'Riya'))),
    ));

void main() {
  testWidgets('Plivo turns show as a chat: customer and agent, with times', (tester) async {
    await _show(tester, {
      'transcriptTurns': [
        {'speaker': 'customer', 'text': 'Is the 2 BHK available?', 'start': 3},
        {'speaker': 'agent', 'text': 'Yes, on the 7th floor.', 'start': 65},
      ],
    });
    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('Riya'), findsOneWidget);
    expect(find.text('0:03'), findsOneWidget);
    expect(find.text('1:05'), findsOneWidget);
    expect(find.text('Yes, on the 7th floor.'), findsOneWidget);
    expect(find.textContaining('worked out by AI'), findsNothing);
  });

  testWidgets('an AI split says so; old calls show their plain text', (tester) async {
    await _show(tester, {'transcriptMethod': 'ai_split', 'transcriptTurns': [{'speaker': 'agent', 'text': 'Hello'}]});
    expect(find.textContaining('worked out by AI'), findsOneWidget);
    await _show(tester, {'transcript': 'Old plain transcript'});
    expect(find.text('Old plain transcript'), findsOneWidget);
    expect(CallTranscriptView.hasAny({}), isFalse);
  });

  test('missed reasons in words', () {
    expect(missedReason({'cause': 'Country Barred'}), 'International number');
    expect(missedReason({'bLegHangupCause': 'USER_BUSY'}), 'Busy');
    expect(missedReason({'agentAnswered': false}), "Agent didn't answer");
    expect(missedReason(null), '');
  });
}
