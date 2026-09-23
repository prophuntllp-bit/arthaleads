import 'package:flutter/material.dart';

import '../core/theme.dart';

/// App-wide dropdown replacement: a tap-to-open bottom sheet instead of
/// Flutter's built-in popup menu. `DropdownButtonFormField`'s popup either
/// hugs the field awkwardly or opens upward at full screen width, which on a
/// phone can cover the whole screen or spill off the top — this was first
/// fixed for the Inbox screens (as `WaSelect`) and is now the one dropdown
/// every screen in the app should use. `options` is value -> label.
class AppSelect<T> extends StatelessWidget {
  final String label;
  final String? note;
  final T? value;
  final Map<T, String> options;
  final ValueChanged<T?> onChanged;
  final String? help;
  final String? hint;
  final bool dense;
  final bool enabled;
  const AppSelect({
    super.key,
    required this.label,
    this.note,
    required this.value,
    required this.options,
    required this.onChanged,
    this.help,
    this.hint,
    this.dense = false,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text.rich(
                TextSpan(
                  text: label,
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.of(context).textSoft),
                  children: [
                    if (note != null)
                      TextSpan(text: ' $note', style: const TextStyle(fontWeight: FontWeight.w400)),
                  ],
                ),
              ),
            ),
          Builder(builder: (ctx) {
            final t = AppTheme.of(ctx);
            final has = options.containsKey(value);
            return InkWell(
              borderRadius: BorderRadius.circular(AppRadii.input),
              onTap: !enabled
                  ? null
                  : () async {
                FocusScope.of(ctx).unfocus();
                final picked = await showModalBottomSheet<_Picked<T>>(
                  context: ctx,
                  isScrollControlled: true,
                  useSafeArea: true,
                  backgroundColor: t.surfaceSolid,
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.modal)),
                  ),
                  builder: (sheetCtx) => _AppSelectSheet<T>(
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
          if (help != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(help!, style: TextStyle(fontSize: 11.5, height: 1.4, color: AppTheme.of(context).textSoft)),
            ),
        ],
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

/// Bottom-sheet option list used by [AppSelect]. A bottom sheet rather than a
/// popup menu: on a phone the popup either hugs the field awkwardly or opens
/// upward at full width and covers the screen.
class _AppSelectSheet<T> extends StatelessWidget {
  final String title;
  final Map<T, String> options;
  final T? value;
  const _AppSelectSheet({required this.title, required this.options, required this.value});

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
