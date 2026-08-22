import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Skeleton placeholders for first load.
///
/// A centered spinner tells the user "something is happening" but nothing about
/// what is coming, and the layout snaps into place when data lands. These draw
/// the shape of the real content instead, so the screen looks the same before
/// and after — no jump, and the wait reads as shorter.
///
/// Only for the FIRST load, where there is genuinely nothing to show. Refreshes
/// over existing data keep the old content and use the pull-to-refresh
/// indicator; swapping loaded content back to grey blocks would be a downgrade.

/// One shimmering grey block. The animation is driven by a single controller
/// per [SkeletonGroup] so a screenful of these does not run dozens of
/// independent tickers.
class SkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double radius;

  const SkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = 8,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final shimmer = _SkeletonShimmer.of(context);
    return AnimatedBuilder(
      animation: shimmer,
      builder: (context, _) {
        // Sweep a soft highlight left-to-right across the block.
        final v = shimmer.value;
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              begin: Alignment(-1.0 - 2 * (1 - v), 0),
              end: Alignment(1.0 + 2 * v, 0),
              colors: [
                t.surfaceLow,
                Color.alphaBlend(t.border.withValues(alpha: 0.55), t.surfaceLow),
                t.surfaceLow,
              ],
              stops: const [0.35, 0.5, 0.65],
            ),
          ),
        );
      },
    );
  }
}

/// Drives the shimmer for everything beneath it. Wrap a screen's skeleton in
/// this once; [SkeletonBox] finds it via context.
class SkeletonGroup extends StatefulWidget {
  final Widget child;
  const SkeletonGroup({super.key, required this.child});

  @override
  State<SkeletonGroup> createState() => _SkeletonGroupState();
}

class _SkeletonGroupState extends State<SkeletonGroup>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _SkeletonShimmer(animation: _c, child: widget.child);
}

class _SkeletonShimmer extends InheritedWidget {
  final Animation<double> animation;
  const _SkeletonShimmer({required this.animation, required super.child});

  static Animation<double> of(BuildContext context) {
    final w = context.dependOnInheritedWidgetOfExactType<_SkeletonShimmer>();
    // Falling back to a constant keeps a stray SkeletonBox rendering as a
    // plain grey block rather than throwing.
    return w?.animation ?? const AlwaysStoppedAnimation(0.5);
  }

  @override
  bool updateShouldNotify(_SkeletonShimmer old) => old.animation != animation;
}

/// Card wrapper matching the app's real cards so the skeleton lines up with
/// the content that replaces it.
class _SkeletonCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const _SkeletonCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: t.surfaceHigh,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: t.border),
      ),
      child: child,
    );
  }
}

/// Dashboard: greeting block, then the 2-up stat tiles.
class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _SkeletonCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: 90, height: 12),
                SizedBox(height: 12),
                SkeletonBox(width: 220, height: 26),
                SizedBox(height: 16),
                SkeletonBox(height: 44, radius: 14),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Stat tiles, two per row.
          for (var row = 0; row < 3; row++) ...[
            Row(
              children: const [
                Expanded(child: _StatTileSkeleton()),
                SizedBox(width: 12),
                Expanded(child: _StatTileSkeleton()),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _StatTileSkeleton extends StatelessWidget {
  const _StatTileSkeleton();

  @override
  Widget build(BuildContext context) {
    return _SkeletonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          SkeletonBox(width: 70, height: 10),
          SizedBox(height: 12),
          SkeletonBox(width: 90, height: 22),
          SizedBox(height: 8),
          SkeletonBox(width: 110, height: 10),
        ],
      ),
    );
  }
}

/// Lead / follow-up style rows: name, phone line, then a row of actions.
class LeadListSkeleton extends StatelessWidget {
  final int rows;
  final EdgeInsetsGeometry padding;

  const LeadListSkeleton({
    super.key,
    this.rows = 6,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 24),
  });

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: ListView.separated(
        padding: padding,
        itemCount: rows,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, i) => _SkeletonCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Vary the name width a little so the list doesn't look
                  // like a printed grid.
                  SkeletonBox(width: 150 + (i % 3) * 28, height: 16),
                  const Spacer(),
                  const SkeletonBox(width: 52, height: 20, radius: 10),
                ],
              ),
              const SizedBox(height: 12),
              const SkeletonBox(width: 180, height: 12),
              const SizedBox(height: 12),
              Row(
                children: const [
                  SkeletonBox(width: 130, height: 12),
                  Spacer(),
                  SkeletonBox(width: 26, height: 26, radius: 13),
                  SizedBox(width: 12),
                  SkeletonBox(width: 26, height: 26, radius: 13),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Project / developer cards: a thumbnail block with two lines beside it.
class ProjectListSkeleton extends StatelessWidget {
  final int rows;
  const ProjectListSkeleton({super.key, this.rows = 4});

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: rows,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, _) => _SkeletonCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SkeletonBox(width: 64, height: 64, radius: 12),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonBox(width: 170, height: 16),
                    SizedBox(height: 10),
                    SkeletonBox(width: 120, height: 12),
                    SizedBox(height: 10),
                    SkeletonBox(width: 90, height: 12),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pipeline board: a column header plus a few stacked cards.
class PipelineSkeleton extends StatelessWidget {
  const PipelineSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Row(
            children: const [
              SkeletonBox(width: 110, height: 18),
              SizedBox(width: 10),
              SkeletonBox(width: 30, height: 18, radius: 9),
            ],
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < 5; i++) ...[
            _SkeletonCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 140 + (i % 3) * 30, height: 15),
                  const SizedBox(height: 10),
                  const SkeletonBox(width: 160, height: 12),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

/// Call history: leading avatar circle, two lines, trailing duration.
class CallListSkeleton extends StatelessWidget {
  final int rows;
  const CallListSkeleton({super.key, this.rows = 7});

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: rows,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _SkeletonCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              const SkeletonBox(width: 38, height: 38, radius: 19),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(width: 130 + (i % 3) * 26, height: 15),
                    const SizedBox(height: 9),
                    const SkeletonBox(width: 150, height: 11),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const SkeletonBox(width: 40, height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
