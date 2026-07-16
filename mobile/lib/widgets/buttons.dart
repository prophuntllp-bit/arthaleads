import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Primary CTA — ports the web's `.btn-primary`: an orange gradient fill,
/// a glossy top highlight, and a colored glow shadow. Press feedback is a
/// slight scale-down (mobile's equivalent of the web's hover `translateY`).
class GradientButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final IconData? icon;
  final bool loading;
  final bool fullWidth;
  final EdgeInsetsGeometry padding;

  const GradientButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
  });

  @override
  State<GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<GradientButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null || widget.loading;
    final content = Row(
      mainAxisSize: widget.fullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.white,
            ),
          )
        else if (widget.icon != null)
          Icon(widget.icon, size: 18, color: Colors.white),
        if (widget.icon != null || widget.loading) const SizedBox(width: 8),
        DefaultTextStyle(
          style: const TextStyle(
            fontFamily: 'Inter',
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
          child: widget.child,
        ),
      ],
    );

    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _pressed = true),
      onTapUp: disabled ? null : (_) => setState(() => _pressed = false),
      onTapCancel: disabled ? null : () => setState(() => _pressed = false),
      onTap: disabled ? null : widget.onPressed,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: AnimatedOpacity(
          opacity: disabled && !widget.loading ? 0.5 : 1.0,
          duration: const Duration(milliseconds: 150),
          child: Container(
            padding: widget.padding,
            width: widget.fullWidth ? double.infinity : null,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.button),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.primaryDeep, AppColors.primary],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(
                    alpha: _pressed ? 0.25 : 0.35,
                  ),
                  blurRadius: _pressed ? 16 : 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Center(child: content),
          ),
        ),
      ),
    );
  }
}

/// Gradient-filled FAB, replacing the stock solid-color `FloatingActionButton`
/// wherever a screen has one — same brand gradient as [GradientButton].
class GradientFab extends StatelessWidget {
  final VoidCallback onPressed;
  final IconData icon;
  final String? label;

  const GradientFab({
    super.key,
    required this.onPressed,
    this.icon = Icons.add,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = const BoxDecoration(
      shape: BoxShape.circle,
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [AppColors.primaryDeep, AppColors.primary],
      ),
      boxShadow: [
        BoxShadow(
          color: Color(0x59FF6B00),
          blurRadius: 20,
          offset: Offset(0, 8),
        ),
      ],
    );

    if (label == null) {
      return FloatingActionButton(
        onPressed: onPressed,
        backgroundColor: Colors.transparent,
        elevation: 0,
        shape: const CircleBorder(),
        child: Ink(
          decoration: gradient,
          child: Center(child: Icon(icon, color: Colors.white)),
        ),
      );
    }

    return FloatingActionButton.extended(
      onPressed: onPressed,
      backgroundColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      label: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primaryDeep, AppColors.primary],
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x59FF6B00),
              blurRadius: 20,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                label!,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Glass-look secondary button — ports `.btn-secondary`.
class SecondaryButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final IconData? icon;
  final bool fullWidth;

  const SecondaryButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.icon,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Material(
      color: t.surfaceHigh,
      borderRadius: BorderRadius.circular(AppRadii.button),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(AppRadii.button),
        child: Container(
          width: fullWidth ? double.infinity : null,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.button),
            border: Border.all(color: t.border),
          ),
          child: Row(
            mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: t.text),
                const SizedBox(width: 8),
              ],
              DefaultTextStyle(
                style: TextStyle(
                  fontFamily: 'Inter',
                  color: t.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Transparent-to-tinted ghost button — ports `.btn-ghost`.
class GhostButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final IconData? icon;
  final Color? color;

  const GhostButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final c = color ?? t.text;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.button),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(AppRadii.button),
        highlightColor: t.surfaceLow,
        splashColor: t.surfaceLow,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: c),
                const SizedBox(width: 6),
              ],
              DefaultTextStyle(
                style: TextStyle(
                  fontFamily: 'Inter',
                  color: c,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
