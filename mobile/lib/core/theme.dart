import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Design tokens ported 1:1 from frontend/src/styles.css + tailwind.config.js.
/// Every value here has a literal counterpart in the web app's CSS custom
/// properties — keep them in sync if the web palette changes.
class AppColors {
  static const primary = Color(0xFFFF6B00);
  static const primaryDeep = Color(0xFFA04100);

  // Dark theme surfaces
  static const darkBg = Color(0xFF111113);
  static const darkSurface = Color(
    0x9E1E1D20,
  ); // rgba(30,29,32,0.62) approx blended for opaque contexts
  static const darkSurfaceSolid = Color(0xFF1E1D20);
  static const darkSurfaceLow = Color(0xAD16151A); // rgba(22,21,24,0.68)
  static const darkSurfaceHigh = Color(0xD62A282E); // rgba(42,40,46,0.84)
  static const darkText = Color(0xFFEDEDED);
  static const darkTextSoft = Color(0xFF969696);
  static const darkBorder = Color(0x1AFFFFFF); // rgba(255,255,255,0.10)
  static const darkBorderStrong = Color(0x47FF6B00); // rgba(255,107,0,0.28)

  // Light theme surfaces
  static const lightBg = Color(0xFFF0EDE8);
  static const lightSurface = Color(0x94FFFFFF); // rgba(255,255,255,0.58)
  static const lightSurfaceSolid = Color(0xFFFFFFFF);
  static const lightSurfaceLow = Color(0x61FFFFFF); // rgba(255,255,255,0.38)
  static const lightSurfaceHigh = Color(0xBFFFFFFF); // rgba(255,255,255,0.75)
  static const lightText = Color(0xFF18181B);
  static const lightTextSoft = Color(0xFF5F5F66);
  static const lightBorder = Color(0x1EA04100); // rgba(160,65,0,0.12)
  static const lightBorderStrong = Color(0x38A04100); // rgba(160,65,0,0.22)

  // Status colors (match web badges)
  static const success = Color(0xFF22C55E);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);
  static const warning = Color(0xFFEAB308);
  static const whatsapp = Color(0xFF25D366);

  // Lead source / status colors, ported from frontend/src/utils/constants
  static const hot = Color(0xFFDC2626);
  static const purple = Color(0xFF8B5CF6);
  static const pink = Color(0xFFEC4899);
}

/// Radii ported from the web's rem-based scale (1rem = 16px baseline).
class AppRadii {
  static const input = 16.0; // rounded-2xl
  static const button = 16.0; // rounded-2xl
  static const card = 24.0; // rounded-[1.5rem]
  static const modal = 24.0; // bottom-sheet rounded-t-3xl
  static const modalLarge = 32.0; // auth-card rounded-[2rem]
  static const pill = 999.0;
}

/// Per-brightness bundle of resolved token values, so widgets can do
/// `AppTheme.of(context).surfaceLow` instead of branching on Brightness everywhere.
class AppTheme {
  final Brightness brightness;
  final Color bg;
  final Color surface;
  final Color surfaceSolid;
  final Color surfaceLow;
  final Color surfaceHigh;
  final Color text;
  final Color textSoft;
  final Color border;
  final Color borderStrong;
  final List<BoxShadow> shadow;
  final List<BoxShadow> shadowLg;

  const AppTheme._({
    required this.brightness,
    required this.bg,
    required this.surface,
    required this.surfaceSolid,
    required this.surfaceLow,
    required this.surfaceHigh,
    required this.text,
    required this.textSoft,
    required this.border,
    required this.borderStrong,
    required this.shadow,
    required this.shadowLg,
  });

  bool get isDark => brightness == Brightness.dark;

  // Flutter's BoxShadow has no `inset` support on this SDK, so the web's
  // subtle inner top-highlight (the second shadow in --app-shadow) is
  // dropped rather than faked with an outer shadow that would look wrong.
  static const _lightShadow = [
    BoxShadow(color: Color(0x1AA04100), blurRadius: 32, offset: Offset(0, 8)),
  ];
  static const _lightShadowLg = [
    BoxShadow(color: Color(0x24A04100), blurRadius: 64, offset: Offset(0, 24)),
  ];
  static const _darkShadow = [
    BoxShadow(color: Color(0x73000000), blurRadius: 32, offset: Offset(0, 8)),
  ];
  static const _darkShadowLg = [
    BoxShadow(color: Color(0x8C000000), blurRadius: 64, offset: Offset(0, 24)),
  ];

  static const light = AppTheme._(
    brightness: Brightness.light,
    bg: AppColors.lightBg,
    surface: AppColors.lightSurface,
    surfaceSolid: AppColors.lightSurfaceSolid,
    surfaceLow: AppColors.lightSurfaceLow,
    surfaceHigh: AppColors.lightSurfaceHigh,
    text: AppColors.lightText,
    textSoft: AppColors.lightTextSoft,
    border: AppColors.lightBorder,
    borderStrong: AppColors.lightBorderStrong,
    shadow: _lightShadow,
    shadowLg: _lightShadowLg,
  );

  static const dark = AppTheme._(
    brightness: Brightness.dark,
    bg: AppColors.darkBg,
    surface: AppColors.darkSurface,
    surfaceSolid: AppColors.darkSurfaceSolid,
    surfaceLow: AppColors.darkSurfaceLow,
    surfaceHigh: AppColors.darkSurfaceHigh,
    text: AppColors.darkText,
    textSoft: AppColors.darkTextSoft,
    border: AppColors.darkBorder,
    borderStrong: AppColors.darkBorderStrong,
    shadow: _darkShadow,
    shadowLg: _darkShadowLg,
  );

  static AppTheme of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? dark : light;
}

/// Ad-hoc type scale ported from the web (no formal Tailwind type scale exists
/// there either — these are the specific sizes/weights used across the app).
class AppText {
  static TextStyle kicker(BuildContext context) => TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 2.2,
    color: AppTheme.of(context).textSoft,
  );

  static TextStyle statValue(BuildContext context) => TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    color: AppTheme.of(context).text,
    height: 1.1,
  );

  static TextStyle label(BuildContext context) => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppTheme.of(context).text,
  );

  static TextStyle badge(BuildContext context, {Color? color}) => TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: color ?? AppTheme.of(context).text,
  );

  static TextStyle tableHeader(BuildContext context) => TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.4,
    color: AppTheme.of(context).textSoft,
  );
}

/// Static app canvas matching the layered radial background used by the web.
/// It sits behind the Scaffold and does not add work to scrolling cards.
class AppBackdrop extends StatelessWidget {
  final Widget child;

  const AppBackdrop({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ColoredBox(
      color: t.bg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-0.9, -0.95),
                radius: 1.25,
                colors: [
                  AppColors.primary.withValues(alpha: t.isDark ? 0.12 : 0.18),
                  Colors.transparent,
                ],
                stops: const [0, 0.62],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.95, 1),
                radius: 1.2,
                colors: [
                  AppColors.primaryDeep.withValues(
                    alpha: t.isDark ? 0.13 : 0.14,
                  ),
                  Colors.transparent,
                ],
                stops: const [0, 0.62],
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final t = dark ? AppTheme.dark : AppTheme.light;

  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: brightness,
    primary: AppColors.primary,
    surface: t.surfaceSolid,
  );

  final baseTextTheme =
      (dark ? Typography.whiteMountainView : Typography.blackMountainView)
          .apply(fontFamily: 'Inter', bodyColor: t.text, displayColor: t.text);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'Inter',
    textTheme: baseTextTheme,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.bg,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: t.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      toolbarHeight: 58,
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: t.bg,
        statusBarIconBrightness: brightness == Brightness.dark
            ? Brightness.light
            : Brightness.dark,
        statusBarBrightness: brightness,
        systemNavigationBarColor: t.bg,
        systemNavigationBarDividerColor: t.border,
        systemNavigationBarIconBrightness: brightness == Brightness.dark
            ? Brightness.light
            : Brightness.dark,
        systemNavigationBarContrastEnforced: false,
      ),
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        color: t.text,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
    ),
    cardTheme: CardThemeData(
      // surfaceHigh (translucent) rather than surfaceSolid (opaque): the
      // scaffold sits on a flat single-color background, so a translucent
      // fill just renders as a tinted solid — the same "glass look" as
      // SoftSurface, applied to every Card() app-wide with no per-screen
      // touch, without paying BackdropFilter's per-frame blur cost.
      color: t.surfaceHigh,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
        side: BorderSide(color: t.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surfaceSolid,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: TextStyle(
        color: t.textSoft,
        fontSize: 14,
        fontFamily: 'Inter',
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.input),
        borderSide: BorderSide(color: t.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.input),
        borderSide: BorderSide(color: t.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.input),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.button),
        ),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.primary),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: t.text,
        side: BorderSide(color: t.borderStrong),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.button),
        ),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: t.surfaceHigh,
      selectedColor: AppColors.primary,
      disabledColor: t.surfaceLow,
      side: BorderSide(color: t.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      labelStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: t.text,
      ),
      secondaryLabelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) =>
            states.contains(WidgetState.selected) ? Colors.white : t.textSoft,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primary
            : t.borderStrong,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.primary,
      linearTrackColor: Colors.transparent,
    ),
    dividerTheme: DividerThemeData(color: t.border),
    listTileTheme: ListTileThemeData(iconColor: t.textSoft),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.button),
      ),
    ),
    // Overlay surfaces stay opaque so text never competes with the screen
    // beneath them. Scrolling cards keep the lighter glass-look treatment.
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: t.surfaceSolid,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadii.modal),
        ),
      ),
      modalBackgroundColor: t.surfaceSolid,
      modalElevation: 0,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: t.surfaceSolid,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: t.text,
      ),
      contentTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        color: t.text,
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: t.surfaceSolid,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    drawerTheme: DrawerThemeData(
      backgroundColor: dark ? const Color(0xFF18171C) : Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
    ),
  );
}
