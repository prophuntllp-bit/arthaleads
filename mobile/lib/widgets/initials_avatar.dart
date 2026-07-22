import 'dart:convert';

import 'package:flutter/material.dart';

/// CircleAvatar that falls back to initials when [avatarValue] is empty,
/// unparseable, OR the resolved image fails to actually load (e.g. a dead
/// network URL) — plain CircleAvatar only checks the first two cases and
/// renders a blank/black circle when the image itself errors out.
class InitialsAvatar extends StatefulWidget {
  final String? avatarValue;
  final Widget fallback;
  final double? radius;
  final Color? backgroundColor;

  const InitialsAvatar({
    super.key,
    required this.avatarValue,
    required this.fallback,
    this.radius,
    this.backgroundColor,
  });

  @override
  State<InitialsAvatar> createState() => _InitialsAvatarState();
}

class _InitialsAvatarState extends State<InitialsAvatar> {
  bool _failed = false;

  ImageProvider<Object>? get _provider {
    if (_failed) return null;
    final avatar = widget.avatarValue?.trim() ?? '';
    if (avatar.isEmpty) return null;
    if (avatar.startsWith('data:image/') && avatar.contains(',')) {
      try {
        return MemoryImage(
          base64Decode(avatar.substring(avatar.indexOf(',') + 1)),
        );
      } catch (_) {
        return null;
      }
    }
    final uri = Uri.tryParse(avatar);
    return uri != null && uri.hasScheme ? NetworkImage(avatar) : null;
  }

  @override
  void didUpdateWidget(covariant InitialsAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.avatarValue != widget.avatarValue) _failed = false;
  }

  @override
  Widget build(BuildContext context) {
    final provider = _provider;
    return CircleAvatar(
      radius: widget.radius,
      backgroundColor: widget.backgroundColor,
      backgroundImage: provider,
      onBackgroundImageError: provider == null
          ? null
          : (_, _) {
              if (mounted) setState(() => _failed = true);
            },
      child: provider == null ? widget.fallback : null,
    );
  }
}
