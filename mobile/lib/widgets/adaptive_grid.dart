import 'dart:math' as math;

import 'package:flutter/material.dart';

/// A grid whose rows are as tall as their tallest card.
///
/// Flutter's GridView gives every cell a height of width / childAspectRatio.
/// That only looks right on the phone it was tuned on: on a narrower screen,
/// or with a bigger system font, the same text wraps onto more lines, needs
/// more height than the cell has, and spills out of the card. Here each row
/// takes the height its content needs and every card in it stretches to match,
/// so cards line up and nothing is clipped on any screen size or font size.
///
/// Give it either a fixed [columns] or a [minTileWidth] (columns then follow
/// the available width). It lays itself out inside a scrolling parent, like a
/// shrink-wrapped GridView.
class AdaptiveGrid extends StatelessWidget {
  final List<Widget> children;
  final int columns;
  final double? minTileWidth;
  final double spacing;
  final double? runSpacing;

  const AdaptiveGrid({
    super.key,
    required this.children,
    this.columns = 2,
    this.minTileWidth,
    this.spacing = 10,
    this.runSpacing,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      var cols = columns;
      final min = minTileWidth;
      if (min != null && box.maxWidth.isFinite) {
        cols = ((box.maxWidth + spacing) / (min + spacing)).floor();
      }
      cols = math.max(1, math.min(cols, math.max(1, children.length)));
      final rowGap = runSpacing ?? spacing;

      final rows = <Widget>[];
      for (var i = 0; i < children.length; i += cols) {
        final slice = children.skip(i).take(cols).toList();
        rows.add(
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var c = 0; c < cols; c++) ...[
                  if (c > 0) SizedBox(width: spacing),
                  Expanded(child: c < slice.length ? slice[c] : const SizedBox.shrink()),
                ],
              ],
            ),
          ),
        );
        if (i + cols < children.length) rows.add(SizedBox(height: rowGap));
      }
      return Column(mainAxisSize: MainAxisSize.min, children: rows);
    });
  }
}
