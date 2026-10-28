import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/dial_numbers.dart';
import '../core/theme.dart';

/// What the person picked in the call menu.
class CallChoice {
  /// true: the phone's own dialler. false: the company's phone service
  /// (POST /calls/initiate rings the agent first, then the lead).
  final bool native;

  /// The number picked when the phone field holds more than one (digits with
  /// country code, no plus). Null: the server or the dialler takes the field.
  final String? number;
  const CallChoice({required this.native, this.number});

  /// What the dialler gets.
  String dial(String phone) => number != null ? '+$number' : phone;

  /// The /calls/initiate body, with the picked number when there is one.
  Map<String, dynamic> body(Map<String, dynamic> base) => number == null ? base : {...base, 'phone': number};
}

/// Bottom sheet offering how to place a call. Mirrors the web's dial-choice
/// popup (frontend/src/components/UI.jsx, 28 Oct 2026): it names the
/// company's phone service (Telephony: EnableX, Plivo or off), lists each
/// number when the field holds two, and says why a foreign number can't go
/// through the company line (Plivo only reaches Indian numbers).
Future<CallChoice?> pickCallMethod(
  BuildContext context, {
  String? name,
  String? phone,
}) {
  final org = context.read<AuthState>().org;
  final provider = '${(org?['telephony'] as Map?)?['provider'] ?? 'enablex'}';
  final nums = dialOptions(phone);
  final indian = nums.where((n) => n.indian).toList();
  final foreign = nums.where((n) => !n.indian && n.valid).firstOrNull;
  final plivo = provider == 'plivo';

  return showModalBottomSheet<CallChoice>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      final t = AppTheme.of(ctx);
      Widget note(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(text, style: TextStyle(fontSize: 12.5, color: t.textSoft)),
        ),
      );
      Widget option(IconData icon, String title, String subtitle, CallChoice value) => ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0x1AFF6B00),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        onTap: () => Navigator.pop(ctx, value),
      );

      final company = <Widget>[
        if (provider == 'none')
          note('Calling through the company number is switched off.')
        else if (plivo && indian.isEmpty)
          note(foreign != null
              ? '${foreign.country.isEmpty ? 'Foreign' : foreign.country} number: company calling only reaches Indian numbers.'
              : "This number can't be dialled through the company line. Correct it on the lead.")
        else if (plivo && indian.length > 1)
          for (final n in indian)
            option(Icons.dialpad_rounded, 'Company number → ${n.shown}', 'Rings your phone first, then the lead',
                CallChoice(native: false, number: n.e164))
        else
          option(Icons.dialpad_rounded, plivo ? 'Call via company number' : 'Call via EnableX',
              'Rings your phone first, then bridges to the lead', const CallChoice(native: false)),
      ];
      final valid = nums.where((n) => n.valid).toList();
      final personal = <Widget>[
        if (valid.length > 1)
          for (final n in valid)
            option(Icons.phone_android_rounded, 'My phone → ${n.shown}', 'Dial directly from your device',
                CallChoice(native: true, number: n.e164))
        else
          option(Icons.phone_android_rounded, 'Use Phone App', 'Dial directly from your device',
              CallChoice(native: true, number: valid.length == 1 ? valid.first.e164 : null)),
      ];

      return SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Call ${name ?? phone ?? ''}',
                    style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              ...company,
              ...personal,
              const SizedBox(height: 10),
            ],
          ),
        ),
      );
    },
  );
}
