import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Shared form furniture for the Inbox sub-screens (agents, templates,
/// campaigns, settings). Mirrors the web's "label above the field, real
/// placeholder inside it, muted help text below" pattern instead of a
/// Material floating label, so every field reads the same everywhere and
/// tall multi-line fields never show a label floating in the middle.

/// Card with an optional icon + title + description, like the web's `.card p-5`.
class WaCard extends StatelessWidget {
  final String? title;
  final IconData? icon;
  final String? description;
  final Widget? trailing;
  final List<Widget> children;
  const WaCard({
    super.key,
    this.title,
    this.icon,
    this.description,
    this.trailing,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(title!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                ),
                ?trailing,
              ],
            ),
          if (description != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(description!, style: TextStyle(fontSize: 12.5, height: 1.4, color: t.textSoft)),
            ),
          if (title != null || description != null) const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

/// Bold-ish small label sitting above a field.
class WaLabel extends StatelessWidget {
  final String text;
  final String? note; // e.g. "(optional)"
  const WaLabel(this.text, {super.key, this.note});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          text: text,
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textSoft),
          children: [
            if (note != null)
              TextSpan(text: ' $note', style: const TextStyle(fontWeight: FontWeight.w400)),
          ],
        ),
      ),
    );
  }
}

class WaHelp extends StatelessWidget {
  final String text;
  const WaHelp(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(text,
            style: TextStyle(fontSize: 11.5, height: 1.4, color: AppTheme.of(context).textSoft)),
      );
}

/// Tinted info / warning strip.
class WaNotice extends StatelessWidget {
  final String text;
  final bool warn;
  final bool danger;
  const WaNotice(this.text, {super.key, this.warn = false, this.danger = false});
  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final Color c = danger ? AppColors.danger : (warn ? const Color(0xFFB45309) : AppColors.primary);
    final bg = danger
        ? AppColors.danger.withValues(alpha: 0.10)
        : warn
            ? const Color(0xFFFBBF24).withValues(alpha: 0.14)
            : (warn ? t.surfaceLow : AppColors.primary.withValues(alpha: 0.08));
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: (warn || danger) ? Border.all(color: c.withValues(alpha: 0.35)) : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (warn || danger) ...[
            Icon(Icons.warning_amber_rounded, size: 15, color: c),
            const SizedBox(width: 8),
          ],
          Expanded(child: Text(text, style: TextStyle(fontSize: 12, height: 1.4, color: c))),
        ],
      ),
    );
  }
}

/// Uniform field decoration: hint inside, no floating label.
InputDecoration waDecoration(BuildContext context, {String? hint, Widget? suffix, bool dense = false}) {
  final t = AppTheme.of(context);
  return InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: t.textSoft.withValues(alpha: 0.75), fontSize: 14),
    isDense: dense,
    suffixIcon: suffix,
    filled: true,
    fillColor: t.surfaceSolid,
    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: dense ? 11 : 14),
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
      borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
    ),
  );
}

/// Label + text field (+ help) in one call.
class WaField extends StatelessWidget {
  final String label;
  final String? note;
  final TextEditingController? controller;
  final String? hint;
  final String? help;
  final int maxLines;
  final int? minLines;
  final int? maxLength;
  final TextInputType? keyboardType;
  final bool enabled;
  final bool mono;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String? initialValue;
  final bool obscureText;
  final Widget? suffix;
  const WaField({
    super.key,
    required this.label,
    this.note,
    this.controller,
    this.hint,
    this.help,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.keyboardType,
    this.enabled = true,
    this.mono = false,
    this.onChanged,
    this.onSubmitted,
    this.initialValue,
    this.obscureText = false,
    this.suffix,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WaLabel(label, note: note),
          TextFormField(
            controller: controller,
            initialValue: controller == null ? initialValue : null,
            enabled: enabled,
            maxLines: obscureText ? 1 : maxLines,
            obscureText: obscureText,
            minLines: minLines ?? (maxLines > 1 ? maxLines : null),
            maxLength: maxLength,
            keyboardType: keyboardType ?? (maxLines > 1 ? TextInputType.multiline : null),
            textCapitalization: TextCapitalization.sentences,
            style: TextStyle(fontSize: 14, fontFamily: mono ? 'monospace' : null),
            onChanged: onChanged,
            onFieldSubmitted: onSubmitted,
            decoration: waDecoration(context, hint: hint, suffix: suffix),
          ),
          if (help != null) WaHelp(help!),
        ],
      ),
    );
  }
}

/// Label + dropdown, styled to match [WaField]. `options` is value -> label.
class WaSelect<T> extends StatelessWidget {
  final String label;
  final String? note;
  final T? value;
  final Map<T, String> options;
  final ValueChanged<T?> onChanged;
  final String? help;
  final String? hint;
  final bool dense;
  const WaSelect({
    super.key,
    required this.label,
    this.note,
    required this.value,
    required this.options,
    required this.onChanged,
    this.help,
    this.hint,
    this.dense = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label.isNotEmpty) WaLabel(label, note: note),
          Builder(builder: (ctx) {
            final t = AppTheme.of(ctx);
            final has = options.containsKey(value);
            return InkWell(
              borderRadius: BorderRadius.circular(AppRadii.input),
              onTap: () async {
                FocusScope.of(ctx).unfocus();
                final picked = await showModalBottomSheet<_Picked<T>>(
                  context: ctx,
                  isScrollControlled: true,
                  useSafeArea: true,
                  backgroundColor: t.surfaceSolid,
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.modal)),
                  ),
                  builder: (sheetCtx) => _WaSelectSheet<T>(
                    title: label.isNotEmpty ? label : (hint ?? 'Choose'),
                    options: options,
                    value: has ? value : null,
                  ),
                );
                if (picked != null) onChanged(picked.value);
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: dense ? 12 : 15),
                decoration: BoxDecoration(
                  color: t.surfaceSolid,
                  borderRadius: BorderRadius.circular(AppRadii.input),
                  border: Border.all(color: t.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        has ? options[value]! : (hint ?? ''),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14, color: has ? t.text : t.textSoft),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.keyboard_arrow_down_rounded, color: t.textSoft),
                  ],
                ),
              ),
            );
          }),
          if (help != null) WaHelp(help!),
        ],
      ),
    );
  }
}

/// Checkbox row with bold title + soft subtitle, tap target = whole row.
class WaCheckRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final String title;
  final String? subtitle;
  const WaCheckRow({super.key, required this.value, required this.onChanged, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onChanged(!value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: value,
                activeColor: AppColors.primary,
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                onChanged: (v) => onChanged(v == true),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(subtitle!, style: TextStyle(fontSize: 11.5, height: 1.35, color: t.textSoft)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Removable pill (option / ad id / phone).
class WaChip extends StatelessWidget {
  final String label;
  final String? suffix;
  final VoidCallback? onDelete;
  final bool mono;
  const WaChip(this.label, {super.key, this.suffix, this.onDelete, this.mono = false});
  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      padding: const EdgeInsets.only(left: 12, right: 6, top: 5, bottom: 5),
      decoration: BoxDecoration(
        color: t.surfaceLow,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text.rich(
              TextSpan(
                text: label,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, fontFamily: mono ? 'monospace' : null),
                children: [
                  if (suffix != null)
                    TextSpan(text: '  → $suffix', style: TextStyle(fontWeight: FontWeight.w400, color: t.textSoft)),
                ],
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (onDelete != null)
            InkWell(
              onTap: onDelete,
              borderRadius: BorderRadius.circular(99),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(Icons.close, size: 14, color: t.textSoft),
              ),
            ),
        ],
      ),
    );
  }
}

/// Small outlined pill button ("+ Add", quick-add etc.).
class WaPillButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool full;
  const WaPillButton(this.label, {super.key, this.icon, this.onPressed, this.full = false});
  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final on = onPressed != null;
    final child = Row(
      mainAxisSize: full ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[Icon(icon, size: 15, color: on ? t.text : t.textSoft), const SizedBox(width: 6)],
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: on ? t.text : t.textSoft)),
      ],
    );
    return Opacity(
      opacity: on ? 1 : 0.45,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.borderStrong),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Round icon add-button next to a text field.
class WaAddButton extends StatelessWidget {
  final VoidCallback? onPressed;
  const WaAddButton({super.key, this.onPressed});
  @override
  Widget build(BuildContext context) {
    final on = onPressed != null;
    return Opacity(
      opacity: on ? 1 : 0.4,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.of(context).borderStrong),
          ),
          child: const Icon(Icons.add, size: 20),
        ),
      ),
    );
  }
}

/// Wrapper so a null selection is distinguishable from a dismissed sheet.
class _Picked<T> {
  final T value;
  const _Picked(this.value);
}

/// Bottom-sheet option list used by [WaSelect]. A bottom sheet rather than a
/// popup menu: on a phone the popup either hugs the field awkwardly or opens
/// upward at full width and covers the screen.
class _WaSelectSheet<T> extends StatelessWidget {
  final String title;
  final Map<T, String> options;
  final T? value;
  const _WaSelectSheet({required this.title, required this.options, required this.value});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final maxH = MediaQuery.of(context).size.height * 0.62;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxH),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: t.border, borderRadius: BorderRadius.circular(4))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
          Divider(height: 1, color: t.border),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(vertical: 6),
              children: [
                for (final e in options.entries)
                  InkWell(
                    onTap: () => Navigator.pop(context, _Picked<T>(e.key)),
                    child: Container(
                      color: e.key == value ? AppColors.primary.withValues(alpha: 0.08) : null,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              e.value,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: e.key == value ? FontWeight.w700 : FontWeight.w400,
                                color: e.key == value ? AppColors.primary : t.text,
                              ),
                            ),
                          ),
                          if (e.key == value) const Icon(Icons.check_rounded, size: 20, color: AppColors.primary),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 4),
        ],
      ),
    );
  }
}
