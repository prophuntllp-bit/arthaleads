import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme.dart';

/// Where a lead came from, worked out from the fields every lead already
/// carries: the website and page for form leads, the ad for Click to WhatsApp
/// leads, the campaign or form for Facebook, the integration name for the
/// rest. The web shows the same pieces in its Source column; this puts them
/// on the card so it reads at a glance.
class LeadOrigin {
  /// "Website", "WhatsApp", ...
  final String source;

  /// The strongest single answer to "which one?": a domain, an ad headline,
  /// a campaign or form name.
  final String primary;

  /// The page path on a website lead ("/treetopia-2"), else empty.
  final String page;

  /// Supporting detail: the integration or site name, the form plugin.
  final String secondary;

  final String pageUrl;
  final String adHeadline;
  final String adMessage;
  final String adLink;
  final String adId;
  final bool isWebsite;
  final bool isAd;

  const LeadOrigin({
    required this.source,
    required this.primary,
    required this.page,
    required this.secondary,
    required this.pageUrl,
    required this.adHeadline,
    required this.adMessage,
    required this.adLink,
    required this.adId,
    required this.isWebsite,
    required this.isAd,
  });

  bool get isEmpty => primary.isEmpty && page.isEmpty && secondary.isEmpty;

  static String _s(Object? v) => (v is String) ? v.trim() : '';

  static String _pathOf(String url) {
    if (url.isEmpty) return '';
    final u = Uri.tryParse(url);
    if (u == null) return '';
    final p = u.path.replaceAll(RegExp(r'/+$'), '');
    return p;
  }

  static String _hostOf(String url) {
    final u = Uri.tryParse(url);
    final h = (u?.host ?? '').toLowerCase();
    return h.startsWith('www.') ? h.substring(4) : h;
  }

  factory LeadOrigin.from(Map<String, dynamic> lead) {
    final source = _s(lead['source']);
    final label = _s(lead['leadSourceLabel']);
    final pageUrl = _s(lead['sourcePage']);
    final domain = _s(lead['sourceDomain']).isNotEmpty
        ? _s(lead['sourceDomain'])
        : _hostOf(pageUrl);
    final path = _pathOf(pageUrl);
    final camp = lead['campaignRef'] is Map
        ? (lead['campaignRef'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final headline = _s(camp['headline']);
    final adId = _s(camp['adId']);
    final isAd = headline.isNotEmpty || adId.isNotEmpty;
    final isWebsite = domain.isNotEmpty;

    // "Facebook Ad · headline" is how WhatsApp ad leads label themselves; the
    // headline alone reads better once the source chip already says WhatsApp.
    var primary = '';
    var secondary = '';
    if (isWebsite) {
      primary = domain;
      if (label.isNotEmpty && label != domain) secondary = label;
    } else if (isAd) {
      primary = headline.isNotEmpty ? headline : 'Ad $adId';
      secondary = 'Click to WhatsApp ad';
    } else if (label.isNotEmpty && label != source) {
      primary = label;
    }
    if (secondary.isEmpty && _s(lead['formPlugin']).isNotEmpty && isWebsite) {
      secondary = _s(lead['formPlugin']);
    }

    return LeadOrigin(
      source: source,
      primary: primary,
      page: path,
      secondary: secondary,
      pageUrl: pageUrl.split('?').first,
      adHeadline: headline,
      adMessage: _s(camp['body']),
      adLink: _s(camp['sourceUrl']),
      adId: adId,
      isWebsite: isWebsite,
      isAd: isAd,
    );
  }
}

/// One or two quiet lines for a lead card: icon, the website and page (or ad,
/// campaign, form), then the integration or site name underneath.
class LeadOriginLine extends StatelessWidget {
  final Map<String, dynamic> lead;
  const LeadOriginLine(this.lead, {super.key});

  @override
  Widget build(BuildContext context) {
    final o = LeadOrigin.from(lead);
    if (o.isEmpty) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    final main = o.isWebsite && o.page.isNotEmpty
        ? '${o.primary}  ›  ${o.page}'
        : o.primary;
    final icon = o.isWebsite
        ? Icons.public_rounded
        : o.isAd
            ? Icons.campaign_rounded
            : Icons.label_outline_rounded;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(icon, size: 13, color: AppColors.primary),
          ),
          const SizedBox(width: 5),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (main.isNotEmpty)
                  Text(
                    main,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: t.text,
                    ),
                  ),
                if (o.secondary.isNotEmpty)
                  Text(
                    o.secondary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: t.textSoft),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The full answer, for the lead's Info tab and an empty Notes tab.
class LeadOriginCard extends StatelessWidget {
  final Map<String, dynamic> lead;
  const LeadOriginCard(this.lead, {super.key});

  Widget _row(BuildContext context, String label, String value, {bool copy = false, int maxLines = 2}) {
    if (value.isEmpty) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: InkWell(
        onLongPress: copy
            ? () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$label copied')),
                );
              }
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(),
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: t.textSoft,
                )),
            const SizedBox(height: 2),
            Text(value, maxLines: maxLines, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: t.text)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final o = LeadOrigin.from(lead);
    if (o.isEmpty && o.source.isEmpty) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('WHERE THIS LEAD CAME FROM', style: AppText.kicker(context)),
          _row(context, 'Source', o.source),
          if (o.isWebsite) ...[
            _row(context, 'Website', o.primary),
            _row(context, 'Page', o.page.isEmpty ? '' : o.page),
            _row(context, 'Full page address', o.pageUrl, copy: true),
            _row(context, 'Site or form', o.secondary),
          ] else if (o.isAd) ...[
            _row(context, 'Ad', o.adHeadline),
            _row(context, 'Ad message', o.adMessage, maxLines: 3),
            _row(context, 'Ad link', o.adLink, copy: true),
            _row(context, 'Ad ID', o.adId, copy: true),
          ] else ...[
            _row(context, 'Detail', o.primary),
            _row(context, 'More', o.secondary),
          ],
          if (o.isWebsite || o.isAd || o.primary.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                'Press and hold an address to copy it.',
                style: TextStyle(fontSize: 10.5, color: t.textSoft),
              ),
            ),
        ],
      ),
    );
  }
}
