import 'package:flutter/material.dart';

import '../core/theme.dart';

/// A caption label sitting above its field — mirrors the web app's
/// `<label className="label">` + `<input className="input">` pattern.
/// Use this instead of `InputDecoration(labelText: ...)`, whose floating
/// label docks inside the filled box's top edge instead of sitting clearly
/// above it.
class LabeledField extends StatelessWidget {
  final String label;
  final Widget child;

  const LabeledField({super.key, required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, left: 2),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: t.text,
            ),
          ),
        ),
        child,
      ],
    );
  }
}
