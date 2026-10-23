import 'package:flutter/material.dart';
import 'package:skeletonizer/skeletonizer.dart';

/// Loading placeholders drawn from the REAL widgets (23 Oct 2026, owner: the
/// old grey boxes did not look like the screens). A screen passes its own
/// card builder with sample content; skeletonizer paints each text, icon and
/// chip as a shimmering bone in exactly the place the real one appears, so
/// nothing jumps when the data lands.
///
/// [CardsSkeleton] is a whole list of placeholder cards for a first load;
/// [SectionSkeleton] shimmers one section of a screen while the rest shows.

/// The shimmer colours: neutral over the app's warm background in both themes.
ShimmerEffect appShimmer(BuildContext context) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  return ShimmerEffect(
    baseColor: dark ? const Color(0x24FFFFFF) : const Color(0x14000000),
    highlightColor: dark ? const Color(0x3DFFFFFF) : const Color(0x08000000),
    duration: const Duration(milliseconds: 1300),
  );
}

/// Every coloured box (status and source badges, tinted tiles) is painted in
/// the card's own colour while loading, so the placeholder reads as one calm
/// surface instead of bright pills (23 Oct 2026, owner).
Color? _neutralBoxes(BuildContext context) => Theme.of(context).cardTheme.color;

class CardsSkeleton extends StatelessWidget {
  final int count;
  final IndexedWidgetBuilder itemBuilder;
  final EdgeInsetsGeometry? padding;

  /// Space between cards when the cards carry no margin of their own.
  final double gap;

  const CardsSkeleton({super.key, required this.itemBuilder, this.count = 6, this.padding, this.gap = 0});

  @override
  Widget build(BuildContext context) {
    return Skeletonizer(
      effect: appShimmer(context),
      containersColor: _neutralBoxes(context),
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: padding,
        itemCount: count,
        separatorBuilder: (_, _) => SizedBox(height: gap),
        itemBuilder: itemBuilder,
      ),
    );
  }
}

class SectionSkeleton extends StatelessWidget {
  final bool loading;
  final Widget child;
  const SectionSkeleton({super.key, required this.loading, required this.child});

  @override
  Widget build(BuildContext context) => Skeletonizer(
    enabled: loading,
    effect: appShimmer(context),
    containersColor: _neutralBoxes(context),
    child: child,
  );
}

/// Sample content for placeholder cards: plausible lengths, so the bones
/// look like a real list rather than a grid of identical bars.
class SampleData {
  SampleData._();

  static const _names = ['Rahul Sharma', 'Priya Deshpande', 'Amit Kulkarni', 'Sneha Patil', 'Vikram Joshi', 'Anjali Mehta', 'Rohan Gupta', 'Neha Iyer'];
  static String name(int i) => _names[i % _names.length];
  static String phone(int i) => '98${(76543210 + i * 1111).toString().padLeft(8, '0')}';

  static Map<String, dynamic> lead(int i) {
    final now = DateTime.now();
    return {
      '_id': 'sample$i',
      'name': name(i),
      'phone': phone(i),
      'status': ['New', 'Contacted', 'Site Visit'][i % 3],
      'priority': ['Medium', 'High', 'Hot'][i % 3],
      'source': ['Facebook', 'WhatsApp', 'Website'][i % 3],
      'assignedToName': 'Team member',
      'createdAt': now.subtract(Duration(days: i + 1)).toIso8601String(),
      'followUpDate': now.subtract(Duration(days: i + 1)).toIso8601String(),
      'remark': i.isEven ? 'Interested in 2 BHK, wants a site visit' : '',
    };
  }
}
