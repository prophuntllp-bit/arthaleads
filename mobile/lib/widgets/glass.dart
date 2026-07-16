import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/theme.dart';

/// The web app's two surface treatments, ported for mobile:
///
/// - [SoftSurface]: no real blur — a translucent-but-opaque-enough fill,
///   hairline border, and soft shadow. Used for every card/list-tile that
///   lives inside a scrolling view, since a real `BackdropFilter` per list
///   item would force a `saveLayer` + blur pass per frame and reintroduce
///   the jank the native app exists to avoid.
/// - [GlassSurface]: real `BackdropFilter` blur, matching the web's
///   `--glass-blur` token. Reserved for static chrome that doesn't scroll
///   fast underneath itself — bottom sheets, dialogs, persistent bars.
class SoftSurface extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final Color? color;
  final Border? border;
  final List<BoxShadow>? boxShadow;

  const SoftSurface({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.radius = AppRadii.card,
    this.color,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? t.surfaceHigh,
        borderRadius: BorderRadius.circular(radius),
        border: border ?? Border.all(color: t.border),
        boxShadow: boxShadow ?? t.shadow,
      ),
      child: child,
    );
  }
}

class GlassSurface extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final double blurSigma;
  final Color? color;
  final Border? border;
  final List<BoxShadow>? boxShadow;

  const GlassSurface({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.radius = AppRadii.modal,
    this.blurSigma = 20,
    this.color,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      margin: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              color: color ?? t.surface,
              borderRadius: BorderRadius.circular(radius),
              border: border ?? Border.all(color: t.border),
              boxShadow: boxShadow ?? t.shadowLg,
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Frosted modal/bottom-sheet backdrop — pairs with [GlassSurface] for the
/// sheet content itself. Mirrors the web `Modal`'s `bg-black/50` +
/// `backdropFilter: blur(6px)` overlay.
Widget glassBarrier({double sigma = 6, double opacity = 0.5}) {
  return BackdropFilter(
    filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
    child: Container(color: Colors.black.withValues(alpha: opacity)),
  );
}
