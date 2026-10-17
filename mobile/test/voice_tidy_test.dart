import 'package:arthaleads_mobile/screens/artha/voice_input.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('BHK as the recogniser hears it becomes "N BHK"', () {
    expect(tidySpokenCrm('interested in to BHK'), 'interested in 2 BHK');
    expect(tidySpokenCrm('wants two b h k in Wakad'), 'wants 2 BHK in Wakad');
    expect(tidySpokenCrm('3bhk flat'), '3 BHK flat');
    expect(tidySpokenCrm('do bhk chahiye'), '2 BHK chahiye');
    expect(tidySpokenCrm('looking for bhk options'), 'looking for BHK options');
    expect(tidySpokenCrm('budget 2 B.H.K.'), 'budget 2 BHK');
  });

  test('site visit, follow up, lakh and crore', () {
    expect(tidySpokenCrm('side visit on Saturday'), 'site visit on Saturday');
    expect(tidySpokenCrm('followup kal shaam 5 baje'), 'follow up kal shaam 5 baje');
    expect(tidySpokenCrm('follow-up tomorrow'), 'follow up tomorrow');
    expect(tidySpokenCrm('budget 80 lacs'), 'budget 80 lakh');
    expect(tidySpokenCrm('around 1.2 crores'), 'around 1.2 crore');
  });

  test('everything else is left exactly as heard', () {
    expect(tidySpokenCrm('Called Rahul, he will come tomorrow'), 'Called Rahul, he will come tomorrow');
    expect(tidySpokenCrm('send him to the site'), 'send him to the site');
    expect(tidySpokenCrm('do it today'), 'do it today');
    expect(tidySpokenCrm('  extra   spaces  '), 'extra spaces');
    expect(tidySpokenCrm(''), '');
  });
}
