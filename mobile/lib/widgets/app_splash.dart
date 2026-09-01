import 'package:flutter/material.dart';

/// The Flutter-side continuation of the native launch screen.
///
/// The native splash (see flutter_native_splash in pubspec.yaml) is torn down
/// the moment Flutter paints its first frame, which happens before we know
/// whether there is a stored session. Painting the same mark on the same ground
/// means that handover is invisible: the launch reads as one screen that
/// resolves, rather than a logo replaced by a blank rectangle.
///
/// Deliberately not used for a returning user — _AuthGate shows the dashboard
/// skeleton there instead, so the wait resolves into the layout it is heading
/// for. This is only for the phase where the destination is still unknown.
class AppSplash extends StatelessWidget {
  const AppSplash({super.key});

  /// Matches windowSplashScreenBackground / color_dark in the splash config.
  /// Changing one without the other reintroduces the flash this exists to stop.
  static const _lightGround = Color(0xFFFFFFFF);
  static const _darkGround = Color(0xFF18171C);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: dark ? _darkGround : _lightGround,
      body: Center(
        child: Image.asset(
          'assets/images/logo.png',
          width: 96,
          height: 96,
          // If the asset is ever missing, an empty ground still matches the
          // native splash — better than a broken-image glyph mid-launch.
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }
}
