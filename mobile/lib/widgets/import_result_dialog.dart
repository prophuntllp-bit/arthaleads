import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Persistent (no auto-dismiss) import-result summary — mirrors
/// frontend/src/components/UI.jsx's ImportResultModal. Replaces a SnackBar
/// that vanished in a few seconds before anyone could read the duplicate
/// count. Call via [showImportResultDialog].
Future<void> showImportResultDialog(
  BuildContext context, {
  int inserted = 0,
  int duplicates = 0,
  int skippedInvalid = 0,
  String? notice,
}) {
  return showDialog(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => _ImportResultDialog(
      inserted: inserted,
      duplicates: duplicates,
      skippedInvalid: skippedInvalid,
      notice: notice,
    ),
  );
}

class _ImportResultDialog extends StatelessWidget {
  final int inserted;
  final int duplicates;
  final int skippedInvalid;
  final String? notice;

  const _ImportResultDialog({
    required this.inserted,
    required this.duplicates,
    required this.skippedInvalid,
    this.notice,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final failed = inserted == 0;
    final stats = <(String, int, Color)>[
      ('Imported', inserted, AppColors.success),
      if (duplicates > 0) ('Duplicates skipped', duplicates, AppColors.warning),
      if (skippedInvalid > 0) ('Invalid rows ignored', skippedInvalid, AppColors.danger),
    ];

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 360),
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: t.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ResultIcon(failed: failed),
            const SizedBox(height: 16),
            Text(
              failed ? 'Nothing imported' : 'Import complete',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: t.text),
            ),
            if (notice != null) ...[
              const SizedBox(height: 4),
              Text(
                notice!,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: t.textSoft),
              ),
            ],
            const SizedBox(height: 16),
            for (var i = 0; i < stats.length; i++)
              _StatRow(label: stats[i].$1, value: stats[i].$2, color: stats[i].$3, delayMs: 150 + i * 90),
            if (failed && stats.isEmpty)
              Text(
                'All rows already existed or were invalid.',
                style: TextStyle(fontSize: 12, color: t.textSoft),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultIcon extends StatelessWidget {
  final bool failed;
  const _ResultIcon({required this.failed});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 450),
      curve: Curves.elasticOut,
      builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
      child: SizedBox(
        width: 64,
        height: 64,
        child: failed
            ? Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.danger.withValues(alpha: 0.12),
                ),
                child: const Icon(Icons.close_rounded, color: AppColors.danger, size: 32),
              )
            : Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.success.withValues(alpha: 0.12),
                    ),
                  ),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOutCubic,
                    builder: (context, t, _) => CustomPaint(
                      size: const Size(64, 64),
                      painter: _CheckPainter(progress: t),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Draws the success ring first, then the checkmark stroke — same two-stage
/// draw-in as the web modal's SVG stroke-dashoffset animation.
class _CheckPainter extends CustomPainter {
  final double progress; // 0..1
  _CheckPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 2;
    final ringPaint = Paint()
      ..color = AppColors.success
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    // Ring draws over the first 70% of the animation.
    final ringProgress = (progress / 0.7).clamp(0.0, 1.0);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * ringProgress,
      false,
      ringPaint,
    );

    // Checkmark draws over the remaining 30%.
    final checkProgress = ((progress - 0.6) / 0.4).clamp(0.0, 1.0);
    if (checkProgress <= 0) return;
    final checkPaint = Paint()
      ..color = AppColors.success
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final p1 = Offset(size.width * 0.30, size.height * 0.52);
    final p2 = Offset(size.width * 0.44, size.height * 0.66);
    final p3 = Offset(size.width * 0.72, size.height * 0.36);
    final path = Path()..moveTo(p1.dx, p1.dy);
    if (checkProgress < 0.5) {
      final localT = checkProgress / 0.5;
      path.lineTo(_lerp(p1, p2, localT).dx, _lerp(p1, p2, localT).dy);
    } else {
      path.lineTo(p2.dx, p2.dy);
      final localT = (checkProgress - 0.5) / 0.5;
      path.lineTo(_lerp(p2, p3, localT).dx, _lerp(p2, p3, localT).dy);
    }
    canvas.drawPath(path, checkPaint);
  }

  Offset _lerp(Offset a, Offset b, double t) => Offset.lerp(a, b, t)!;

  @override
  bool shouldRepaint(covariant _CheckPainter oldDelegate) => oldDelegate.progress != progress;
}

class _StatRow extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final int delayMs;
  const _StatRow({required this.label, required this.value, required this.color, required this.delayMs});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 350 + delayMs),
      curve: Curves.easeOutCubic,
      builder: (context, v, child) {
        // Simple stagger: hold at 0 opacity until this row's delay has
        // elapsed relative to the shared duration, then ease in.
        final localStart = delayMs / (350 + delayMs);
        final localT = ((v - localStart) / (1 - localStart)).clamp(0.0, 1.0);
        return Opacity(
          opacity: localT,
          child: Transform.translate(offset: Offset(0, (1 - localT) * 6), child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: t.surfaceLow,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textSoft)),
            Text('$value', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color)),
          ],
        ),
      ),
    );
  }
}
