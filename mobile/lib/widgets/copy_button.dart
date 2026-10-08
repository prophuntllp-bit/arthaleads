import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Small icon button that copies [value] to the clipboard, ticks for a moment
/// and says what was copied. Same job as the web's CopyButton in Lead Details.
class CopyButton extends StatefulWidget {
  final String value;
  final String label;
  final String done;
  const CopyButton({
    super.key,
    required this.value,
    this.label = 'Copy',
    this.done = 'Copied',
  });

  @override
  State<CopyButton> createState() => _CopyButtonState();
}

class _CopyButtonState extends State<CopyButton> {
  bool _copied = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.value));
    if (!mounted) return;
    setState(() => _copied = true);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _copied = false);
    });
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(widget.done),
        duration: const Duration(seconds: 2),
      ));
  }

  @override
  Widget build(BuildContext context) {
    if (widget.value.trim().isEmpty) return const SizedBox.shrink();
    return IconButton(
      visualDensity: VisualDensity.compact,
      tooltip: _copied ? 'Copied' : widget.label,
      onPressed: _copy,
      icon: Icon(
        _copied ? Icons.check_rounded : Icons.content_copy_rounded,
        size: 19,
        color: _copied ? const Color(0xFF10B981) : null,
      ),
    );
  }
}
