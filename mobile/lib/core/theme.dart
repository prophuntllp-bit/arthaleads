import 'package:flutter/material.dart';

/// Brand palette lifted from frontend/src/styles.css
class AppColors {
  static const primary = Color(0xFFFF6B00);
  static const primaryDeep = Color(0xFFA04100);

  // Dark theme
  static const darkBg = Color(0xFF111113);
  static const darkSurface = Color(0xFF1E1D20);
  static const darkSurfaceHigh = Color(0xFF2A282E);
  static const darkText = Color(0xFFEDEDED);
  static const darkTextSoft = Color(0xFF969696);

  // Light theme
  static const lightBg = Color(0xFFF0EDE8);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightText = Color(0xFF18181B);
  static const lightTextSoft = Color(0xFF5F5F66);

  // Status colors (match web badges)
  static const success = Color(0xFF22C55E);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);
  static const warning = Color(0xFFEAB308);
  static const whatsapp = Color(0xFF25D366);
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final bg = dark ? AppColors.darkBg : AppColors.lightBg;
  final surface = dark ? AppColors.darkSurface : AppColors.lightSurface;
  final text = dark ? AppColors.darkText : AppColors.lightText;
  final textSoft = dark ? AppColors.darkTextSoft : AppColors.lightTextSoft;

  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: brightness,
    primary: AppColors.primary,
    surface: surface,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: text,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: dark ? Colors.white.withValues(alpha: 0.10) : AppColors.primaryDeep.withValues(alpha: 0.12),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: TextStyle(color: textSoft, fontSize: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(
          color: dark ? Colors.white.withValues(alpha: 0.10) : AppColors.primaryDeep.withValues(alpha: 0.12),
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(
          color: dark ? Colors.white.withValues(alpha: 0.10) : AppColors.primaryDeep.withValues(alpha: 0.12),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.primary),
    ),
    dividerTheme: DividerThemeData(
      color: dark ? Colors.white.withValues(alpha: 0.10) : AppColors.primaryDeep.withValues(alpha: 0.12),
    ),
    listTileTheme: ListTileThemeData(iconColor: textSoft),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
