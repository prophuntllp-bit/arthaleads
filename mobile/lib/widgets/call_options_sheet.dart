import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Bottom sheet offering how to place a call — mirrors the web app's
/// PhoneActions dial-choice popup ("Call via EnableX IVR" vs "Dial Personal
/// Number"). Returns 'enablex', 'native', or null if the user backed out.
Future<String?> pickCallMethod(
  BuildContext context, {
  String? name,
  String? phone,
}) {
  return showModalBottomSheet<String>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Call ${name ?? phone ?? ''}',
                style: Theme.of(
                  ctx,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0x1AFF6B00),
              child: Icon(Icons.dialpad_rounded, color: AppColors.primary),
            ),
            title: const Text(
              'Call via EnableX',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: const Text(
              'Rings your phone first, then bridges to the lead',
            ),
            onTap: () => Navigator.pop(ctx, 'enablex'),
          ),
          ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0x1AFF6B00),
              child: Icon(
                Icons.phone_android_rounded,
                color: AppColors.primary,
              ),
            ),
            title: const Text(
              'Use Phone App',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: const Text('Dial directly from your device'),
            onTap: () => Navigator.pop(ctx, 'native'),
          ),
          const SizedBox(height: 10),
        ],
      ),
    ),
  );
}
