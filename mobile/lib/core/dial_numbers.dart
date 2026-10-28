// The numbers a lead's phone field holds, ready to dial (28 Oct 2026).
// Mirrors frontend/src/utils/dialNumbers.js and backend/utils/dialNumbers.js:
// a field can hold two numbers ("7020074316/8958108809") or a foreign one
// (+971 UAE), and company calling through Plivo's India account only reaches
// Indian numbers.

const _countries = {
  '971': 'UAE', '966': 'Saudi Arabia', '974': 'Qatar', '968': 'Oman', '973': 'Bahrain', '965': 'Kuwait',
  '1': 'US / Canada', '44': 'UK', '61': 'Australia', '64': 'New Zealand', '65': 'Singapore', '60': 'Malaysia',
  '49': 'Germany', '33': 'France', '31': 'Netherlands', '41': 'Switzerland', '353': 'Ireland', '977': 'Nepal', '880': 'Bangladesh',
};

String _countryOf(String digits) {
  for (final len in const [3, 2, 1]) {
    if (digits.length < len) continue;
    final c = _countries[digits.substring(0, len)];
    if (c != null) return c;
  }
  return '';
}

class DialNumber {
  /// Digits with the country code, no plus ("917020074316").
  final String e164;
  final bool indian;
  final bool valid;
  final String country;
  const DialNumber(this.e164, {required this.indian, required this.valid, required this.country});

  /// "+91 70200 74316" for Indian numbers, "+" and the digits for others.
  String get shown => indian ? '+91 ${e164.substring(2, 7)} ${e164.substring(7)}' : '+$e164';
}

DialNumber _classify(String part) {
  var d = part.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00')) d = d.substring(2);
  if (RegExp(r'^[1-9]\d{9}$').hasMatch(d)) {
    d = '91$d';
  } else if (RegExp(r'^0[1-9]\d{9}$').hasMatch(d)) {
    d = '91${d.substring(1)}';
  }
  final indian = RegExp(r'^91\d{10}$').hasMatch(d);
  final country = indian ? 'India' : _countryOf(d);
  final valid = indian || (d.length >= 8 && d.length <= 15 && !d.startsWith('91') && country.isNotEmpty);
  return DialNumber(d, indian: indian, valid: valid, country: country);
}

/// Every number in a phone field, in the order written; duplicates dropped.
List<DialNumber> dialOptions(String? raw) {
  final text = raw ?? '';
  final parts = text
      .split(RegExp(r'[/,;|]|\bor\b|\band\b', caseSensitive: false))
      .map((p) => p.trim())
      .where((p) => p.isNotEmpty)
      .toList();
  final seen = <String>{};
  final out = <DialNumber>[];
  for (final p in parts.isEmpty ? [text] : parts) {
    final o = _classify(p);
    if (o.e164.isEmpty || !seen.add(o.e164)) continue;
    out.add(o);
  }
  return out;
}

/// Why a call failed, in words, from what Plivo or EnableX reported. Empty
/// when unknown. Mirrors missedReason in frontend/src/utils/dialNumbers.js.
String missedReason(Map? meta) {
  final m = meta ?? const {};
  final cause = '${m['cause'] ?? m['bLegHangupCause'] ?? ''}'.toLowerCase();
  if (cause.contains('country barred')) return 'International number';
  if (cause.contains('invalid destination') || cause.contains('unallocated')) return 'Invalid number';
  if (cause.contains('busy')) return 'Busy';
  if (cause.contains('reject') || cause.contains('declin')) return 'Declined';
  if (cause.contains('no answer') || cause.contains('not answered') || cause.contains('timeout')) return 'No answer';
  if (m['agentAnswered'] == false || m['agentLegStatus'] == 'no-answer') return "Agent didn't answer";
  if (m['customerAnswered'] == true) return 'Picked up briefly or voicemail';
  return '';
}
