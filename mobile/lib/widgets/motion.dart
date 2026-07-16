import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Entrance wrapper — opacity 0→1 + translateY 6→0px, mirroring the web's
/// `fadeSlideIn` keyframe. Wrap list items / stat rows in this (with an
/// increasing [delay] per index) to get the same staggered-reveal feel as
/// the web app, without a persistent AnimationController per item.
class FadeSlideIn extends StatelessWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;

  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 220),
  });

  @override
  Widget build(BuildContext context) {
    final totalMs = duration.inMilliseconds + delay.inMilliseconds;
    final delayFraction = totalMs == 0 ? 0.0 : delay.inMilliseconds / totalMs;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: totalMs),
      curve: Curves.easeOut,
      builder: (context, value, child) {
        final adjusted = delayFraction >= 1
            ? 0.0
            : ((value - delayFraction) / (1 - delayFraction)).clamp(0.0, 1.0);
        return Opacity(
          opacity: adjusted,
          child: Transform.translate(offset: Offset(0, (1 - adjusted) * 6), child: child),
        );
      },
      child: child,
    );
  }
}

/// Fade + slight-slide navigation transition, used in place of the default
/// Material push animation so screen transitions feel like the web's.
class FadeSlidePageRoute<T> extends PageRouteBuilder<T> {
  FadeSlidePageRoute({required WidgetBuilder builder, super.settings})
      : super(
          transitionDuration: const Duration(milliseconds: 220),
          reverseTransitionDuration: const Duration(milliseconds: 180),
          pageBuilder: (context, animation, secondaryAnimation) => builder(context),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curved = CurvedAnimation(parent: animation, curve: Curves.easeOut);
            return FadeTransition(
              opacity: curved,
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0, 0.03), end: Offset.zero).animate(curved),
                child: child,
              ),
            );
          },
        );
}

/// Rotating loading indicator matching the web's `Loader2` + `animate-spin`.
class AppSpinner extends StatelessWidget {
  final double size;
  final Color? color;

  const AppSpinner({super.key, this.size = 18, this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: size < 24 ? 2 : 2.5,
        color: color ?? AppColors.primary,
      ),
    );
  }
}
