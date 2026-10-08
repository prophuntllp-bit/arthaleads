import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/plan.dart';
import '../core/theme.dart';

/// How much of the org's file allowance (project photos, brochures, videos and
/// call recordings) is used. Real figures from GET /org/storage, the same call
/// the web's "Used space" card and warning popup make.
class StorageInfo {
  final int usedBytes;
  final int limitBytes;
  final double percent;
  final bool warn;
  final bool full;
  const StorageInfo({
    required this.usedBytes,
    required this.limitBytes,
    required this.percent,
    required this.warn,
    required this.full,
  });

  factory StorageInfo.fromJson(Map j) => StorageInfo(
        usedBytes: (j['usedBytes'] as num?)?.toInt() ?? 0,
        limitBytes: (j['limitBytes'] as num?)?.toInt() ?? 0,
        percent: (j['percent'] as num?)?.toDouble() ?? 0,
        warn: j['warn'] == true,
        full: j['full'] == true,
      );

  int get pct => percent.clamp(0, 100).round();

  static StorageInfo? _cached;
  static DateTime? _at;

  /// Cached for five minutes so opening the menu does not hit the server
  /// every time. `force` skips the cache.
  static Future<StorageInfo?> load({bool force = false}) async {
    final at = _at;
    if (!force && _cached != null && at != null && DateTime.now().difference(at).inMinutes < 5) {
      return _cached;
    }
    try {
      final res = await ApiClient.instance.dio.get('/org/storage');
      final s = res.data['storage'];
      if (s is Map) {
        _cached = StorageInfo.fromJson(s);
        _at = DateTime.now();
      }
    } catch (_) {}
    return _cached;
  }
}

const _dismissKey = 'storage_card_dismissed';
const _popupKey = 'storage_popup_seen';

Future<void> _mailForSpace() => launchUrl(
      Uri(scheme: 'mailto', path: 'contact@arthaleads.com', queryParameters: {'subject': 'More file space'}),
      mode: LaunchMode.externalApplication,
    );

/// The "Storage" card at the foot of the menu: a quiet meter always, and from
/// 80% the fuller card that says how much is left. Same behaviour as the web's
/// sidebar StorageCard (dismissed for a day, never while the space is full).
class StorageCard extends StatefulWidget {
  final bool isAdmin;
  final String? plan;
  final VoidCallback? onUpgrade;
  const StorageCard({super.key, required this.isAdmin, this.plan, this.onUpgrade});

  @override
  State<StorageCard> createState() => _StorageCardState();
}

class _StorageCardState extends State<StorageCard> {
  StorageInfo? _s;
  bool _hidden = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final t = prefs.getInt(_dismissKey) ?? 0;
      _hidden = DateTime.now().millisecondsSinceEpoch - t < 24 * 60 * 60 * 1000;
    } catch (_) {}
    final s = await StorageInfo.load();
    if (mounted) setState(() => _s = s);
  }

  Future<void> _dismiss() async {
    setState(() => _hidden = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_dismissKey, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final s = _s;
    if (s == null || s.limitBytes <= 0) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    final next = upgradeTarget(widget.plan);

    Widget bar(double h, Color c) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: SizedBox(
            height: h,
            child: Stack(children: [
              Container(color: t.border),
              FractionallySizedBox(
                widthFactor: (s.pct / 100).clamp(s.usedBytes > 0 ? 0.02 : 0.0, 1.0),
                child: Container(color: c),
              ),
            ]),
          ),
        );

    final box = BoxDecoration(
      color: t.surfaceSolid,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.border),
    );

    if (!s.warn) {
      return Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: box,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Text('Storage', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const Spacer(),
              // Admins always get the link, like the web card: "Upgrade" while
              // there is a higher plan, "Get more" once on the top one. Both
              // open Plan & Billing.
              if (widget.isAdmin && widget.onUpgrade != null)
                InkWell(
                  onTap: widget.onUpgrade,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(next != null ? 'Upgrade' : 'Get more',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  ),
                ),
            ]),
            const SizedBox(height: 6),
            bar(6, AppColors.primary),
            const SizedBox(height: 5),
            Text('${formatBytes(s.usedBytes)} of ${formatBytes(s.limitBytes)} used',
                style: TextStyle(fontSize: 11, color: t.textSoft)),
          ],
        ),
      );
    }

    if (_hidden && !s.full) return const SizedBox.shrink();
    final color = s.full ? const Color(0xFFDC2626) : AppColors.primary;
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      padding: const EdgeInsets.all(12),
      decoration: box,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Expanded(child: Text('Used space', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
            if (!s.full)
              InkWell(onTap: _dismiss, child: Icon(Icons.close_rounded, size: 16, color: t.textSoft)),
          ]),
          const SizedBox(height: 4),
          Text(
            s.full
                ? 'Your file space is full. New uploads are blocked until you free some up or add more.'
                : "You've used ${s.pct}% of your file space (${formatBytes(s.usedBytes)} of ${formatBytes(s.limitBytes)}).",
            style: TextStyle(fontSize: 12, color: t.textSoft, height: 1.3),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: bar(8, color)),
            const SizedBox(width: 8),
            Text('${s.pct}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          if (widget.isAdmin)
            InkWell(
              onTap: next != null && widget.onUpgrade != null ? widget.onUpgrade : _mailForSpace,
              child: Text(
                next != null && widget.onUpgrade != null ? 'Upgrade plan' : 'Get more space',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary),
              ),
            )
          else
            Text('Ask your admin for more space', style: TextStyle(fontSize: 12, color: t.textSoft)),
        ],
      ),
    );
  }
}

/// The File storage meter inside the Plans screen's current-plan card.
class StorageMeter extends StatelessWidget {
  final StorageInfo s;
  const StorageMeter(this.s, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          const Text('File storage', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const Spacer(),
          Text('${formatBytes(s.usedBytes)} of ${formatBytes(s.limitBytes)} used',
              style: TextStyle(fontSize: 12, color: t.textSoft)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: (s.percent / 100).clamp(0.0, 1.0),
            minHeight: 8,
            backgroundColor: t.border,
            color: s.full ? const Color(0xFFDC2626) : AppColors.primary,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Photos, brochures, videos and call recordings. Need more? Write to contact@arthaleads.com.',
          style: TextStyle(fontSize: 11, color: t.textSoft),
        ),
      ],
    );
  }
}

/// Once a day (IST), tells an admin their file space is at 80% or full. The
/// menu card is the quiet reminder; this makes sure somebody who can act on it
/// has seen it. Mirrors the web's StorageWarningPopup.
Future<void> maybeShowStorageWarning(BuildContext context, {String? plan, VoidCallback? onUpgrade}) async {
  final s = await StorageInfo.load(force: true);
  if (s == null || !s.warn || !context.mounted) return;
  final level = s.full ? 100 : 80;
  final ist = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
  final day = '${ist.year}-${ist.month.toString().padLeft(2, '0')}-${ist.day.toString().padLeft(2, '0')}';
  final stamp = '$day:$level';
  try {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(_popupKey) == stamp) return;
    await prefs.setString(_popupKey, stamp);
  } catch (_) {}
  if (!context.mounted) return;

  final next = upgradeTarget(plan);
  final accent = s.full ? const Color(0xFFDC2626) : const Color(0xFFD97706);
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: Icon(Icons.storage_rounded, color: accent, size: 30),
      title: Text(s.full ? 'Your file space is full' : 'Your file space is almost full',
          textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            s.full
                ? "New photos, brochures, floor plans and videos can't be uploaded until you free some space or add more. Your leads and everything already stored are safe."
                : "Project photos, brochures, videos and call recordings are close to your plan's limit. Once it's full, new uploads stop.",
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 14),
          Row(children: [
            Text('${formatBytes(s.usedBytes)} of ${formatBytes(s.limitBytes)}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text('${s.pct}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: (s.percent / 100).clamp(0.0, 1.0),
              minHeight: 9,
              color: accent,
            ),
          ),
          const SizedBox(height: 10),
          const Text('Removing unused project videos and old photos frees the most space.',
              style: TextStyle(fontSize: 12)),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Remind me tomorrow')),
        FilledButton(
          onPressed: () {
            Navigator.pop(ctx);
            if (next != null && onUpgrade != null) {
              onUpgrade();
            } else {
              _mailForSpace();
            }
          },
          child: Text(next != null && onUpgrade != null ? 'Upgrade plan' : 'Get more space'),
        ),
      ],
    ),
  );
}
