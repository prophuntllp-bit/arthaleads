import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../../core/theme.dart';
import '../dashboard/dashboard_widgets.dart' show connectionTitle;

/// One card per lead-source connection on Integrations, laid out like the
/// web's ConnectionCard so a mixed list lines up: a header (logo, name, what
/// it is, live status), a short list of facts that depends on the platform,
/// and a footer of actions with delete kept apart on the right.

String hostOfUrl(String url) {
  final u = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
  return (u?.host ?? url).replaceFirst(RegExp(r'^www\.'), '');
}

String _ago(DateTime d) {
  final sec = DateTime.now().difference(d).inSeconds;
  if (sec < 60) return 'just now';
  if (sec < 3600) return '${sec ~/ 60} min ago';
  if (sec < 86400) return '${sec ~/ 3600} hr ago';
  final days = sec ~/ 86400;
  if (days < 30) return days == 1 ? 'yesterday' : '$days days ago';
  return '${d.day}/${d.month}/${d.year}';
}

String _mask(String t) =>
    t.length > 10 ? '${t.substring(0, 7)}${'•' * 8}${t.substring(t.length - 4)}' : t;

/// The platform's logo in a rounded tile: the Facebook mark, a website's own
/// favicon (falling back to a globe if it can't be fetched), and branded
/// tiles for the rest.
class ConnectionLogo extends StatelessWidget {
  final Map<String, dynamic> item;
  final double size;
  const ConnectionLogo(this.item, {super.key, this.size = 40});

  @override
  Widget build(BuildContext context) {
    final platform = '${item['platform'] ?? ''}';
    final t = AppTheme.of(context);
    Widget inner;
    Color bg = Colors.white;
    switch (platform) {
      case 'Facebook':
        bg = const Color(0xFF1877F2);
        inner = const FaIcon(FontAwesomeIcons.facebook, color: Colors.white, size: 26);
      case 'Vistrow Voice':
        // The brand's own waveform mark on its purple to pink tile, drawn the
        // same way as the web's icon.
        return SizedBox(width: size, height: size, child: CustomPaint(painter: _VistrowPainter()));
      case 'WhatsApp':
        bg = const Color(0x1F25D366);
        inner = const FaIcon(FontAwesomeIcons.whatsapp, color: Color(0xFF25D366), size: 20);
      case 'Google':
        inner = const FaIcon(FontAwesomeIcons.google, color: Color(0xFF4285F4), size: 18);
      case 'Website Form':
        final host = '${item['siteUrl'] ?? ''}'.isNotEmpty ? hostOfUrl('${item['siteUrl']}') : '';
        final fallback = const Icon(Icons.public_rounded, color: AppColors.primary, size: 20);
        inner = host.isEmpty ? fallback : SiteFavicon(host: host, size: size - 14, fallback: fallback);
      default:
        inner = const Icon(Icons.link_rounded, color: AppColors.primary, size: 20);
    }
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.border),
      ),
      child: inner,
    );
  }
}

/// Connections grouped by what they are, so several websites, a Facebook page
/// and a voice agent read as sections. Same groups and wording as the web.
const _groups = [
  ('Website Form', 'Websites', 'Contact forms that send leads straight in'),
  ('Facebook', 'Facebook Lead Ads', 'Pages and forms synced from Meta'),
  ('Google', 'Google Ads', 'Lead form extensions'),
  ('Vistrow Voice', 'Vistrow Voice', 'Leads qualified by the AI calling agent'),
  ('WhatsApp', 'WhatsApp', 'Leads from WhatsApp conversations'),
  ('Custom', 'Custom sources', 'Any other partner, broker or vendor'),
];

class ConnectionGroup {
  final String title;
  final String hint;
  final List<Map<String, dynamic>> rows;
  ConnectionGroup(this.title, this.hint, this.rows);
}

List<ConnectionGroup> groupConnections(List<Map<String, dynamic>> items) {
  final known = _groups.map((g) => g.$1).toSet();
  return [
    for (final g in _groups)
      ConnectionGroup(g.$2, g.$3, items.where((i) => i['platform'] == g.$1).toList()),
    ConnectionGroup('Other sources', '', items.where((i) => !known.contains(i['platform'])).toList()),
  ].where((g) => g.rows.isNotEmpty).toList();
}

class ConnectionGroupHeader extends StatelessWidget {
  final ConnectionGroup group;
  const ConnectionGroupHeader(this.group, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 8),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 2,
        children: [
          Text(group.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: t.border),
            ),
            child: Text('${group.rows.length}',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: t.textSoft)),
          ),
          if (group.hint.isNotEmpty)
            Text(group.hint, style: TextStyle(fontSize: 12, color: t.textSoft)),
        ],
      ),
    );
  }
}

class ConnectionCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final String serverBase;
  final String endpointPath;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<String> onCopy;
  final VoidCallback? onDiagnose;
  final VoidCallback? onSync;
  final VoidCallback? onRefreshToken;
  final VoidCallback? onToggleActive;
  final bool toggling;
  final Widget? formNamesEditor;

  const ConnectionCard({
    super.key,
    required this.item,
    required this.serverBase,
    required this.endpointPath,
    required this.onEdit,
    required this.onDelete,
    required this.onCopy,
    this.onDiagnose,
    this.onSync,
    this.onRefreshToken,
    this.onToggleActive,
    this.toggling = false,
    this.formNamesEditor,
  });

  Widget _row(BuildContext context, String label, Widget value) {
    final t = AppTheme.of(context);
    return Container(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 84,
            child: Text(label, style: TextStyle(fontSize: 12, color: t.textSoft)),
          ),
          Expanded(child: value),
        ],
      ),
    );
  }

  Widget _copyValue(BuildContext context, String value, String shown) {
    final t = AppTheme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(shown,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, fontFamily: 'monospace', color: t.text)),
        ),
        const SizedBox(width: 8),
        InkWell(
          onTap: () {
            Clipboard.setData(ClipboardData(text: value));
            onCopy(value);
          },
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: t.border),
            ),
            child: Icon(Icons.copy_rounded, size: 15, color: t.textSoft),
          ),
        ),
      ],
    );
  }

  Widget _muted(BuildContext context, String text) =>
      Text(text, style: TextStyle(fontSize: 13, color: AppTheme.of(context).textSoft));

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final platform = '${item['platform'] ?? 'Custom'}';
    final paused = item['isActive'] == false || item['status'] == 'paused';
    final status = '${item['status'] ?? 'draft'}';
    final (statusColor, statusLabel) = paused
        ? (const Color(0xFFF59E0B), 'Paused')
        : switch (status) {
            'connected' => (const Color(0xFF10B981), 'Connected'),
            _ => (const Color(0xFF94A3B8), 'Not connected yet'),
          };
    final isFb = platform == 'Facebook';
    final isWebsite = platform == 'Website Form';
    final isGoogle = platform == 'Google';
    final isTokenSource = const ['Custom', 'Vistrow Voice', 'WhatsApp'].contains(platform);
    final siteUrl = '${item['siteUrl'] ?? ''}';
    final host = isWebsite && siteUrl.isNotEmpty ? hostOfUrl(siteUrl) : '';
    final title = connectionTitle(item);
    final subtitle = isWebsite && host.isNotEmpty ? host : platform;
    final showSubtitle = subtitle.isNotEmpty && subtitle.toLowerCase() != title.toLowerCase();
    final token = '${item['verifyToken'] ?? ''}';
    final lastSync = DateTime.tryParse('${item['lastSyncAt'] ?? ''}');

    // Facebook token health, same thresholds and wording as the web.
    final expiresAt = DateTime.tryParse('${item['userTokenExpiresAt'] ?? ''}');
    final daysLeft = expiresAt == null ? null : expiresAt.difference(DateTime.now()).inHours ~/ 24 + 1;
    final permanent = daysLeft != null && daysLeft > 365 * 5;
    final expired = !permanent && daysLeft != null && daysLeft <= 0;
    final urgent = !permanent && daysLeft != null && daysLeft > 0 && daysLeft <= 5;
    final soon = !permanent && daysLeft != null && daysLeft > 5 && daysLeft <= 20;
    final tokenColor = (expired || urgent)
        ? AppColors.danger
        : soon
            ? AppColors.warning
            : const Color(0xFF10B981);
    final tokenText = permanent
        ? 'Never expires'
        : daysLeft == null
            ? 'Unknown, press Refresh'
            : expired
                ? 'Expired, reconnect to resume leads'
                : '$daysLeft day${daysLeft == 1 ? '' : 's'} left';

    final rows = <Widget>[];
    if (isFb) {
      rows.add(_row(context, 'Page', Text('${(item['pageName'] ?? '').toString().isNotEmpty ? item['pageName'] : ((item['pageId'] ?? '').toString().isNotEmpty ? item['pageId'] : 'All pages')}', style: const TextStyle(fontSize: 13))));
      rows.add(_row(context, 'Forms', Text('${(item['formId'] ?? '').toString().isNotEmpty ? item['formId'] : 'All forms'}', style: const TextStyle(fontSize: 13))));
      rows.add(_row(
        context,
        'Token',
        Row(
          children: [
            Icon(expired || urgent || soon ? Icons.warning_amber_rounded : Icons.verified_user_outlined,
                size: 15, color: tokenColor),
            const SizedBox(width: 6),
            Expanded(child: Text(tokenText, style: TextStyle(fontSize: 13, color: tokenColor))),
            if (!permanent && onRefreshToken != null)
              OutlinedButton(
                onPressed: onRefreshToken,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 30),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(expired ? 'Reconnect' : 'Refresh', style: const TextStyle(fontSize: 12)),
              ),
          ],
        ),
      ));
      if (formNamesEditor != null) {
        rows.add(Container(
          decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
          child: Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: 8),
              title: Text('Name your lead forms', style: TextStyle(fontSize: 12, color: t.textSoft)),
              children: [formNamesEditor!],
            ),
          ),
        ));
      }
    }
    if (isWebsite) {
      rows.add(_row(
        context,
        'Website',
        host.isEmpty
            ? _muted(context, 'Appears after the first lead')
            : Text(host, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
      ));
      final forms = (item['connectedForms'] as List?) ?? const [];
      rows.add(_row(
        context,
        'Forms',
        forms.isEmpty
            ? _muted(context, 'None seen yet')
            : Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  for (final f in forms)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
                      ),
                      child: Text('$f',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success)),
                    ),
                ],
              ),
      ));
      rows.add(_row(context, 'Last lead',
          lastSync != null ? Text(_ago(lastSync.toLocal()), style: const TextStyle(fontSize: 13)) : _muted(context, 'No leads yet')));
      rows.add(_row(context, 'Endpoint', _copyValue(context, '$serverBase$endpointPath', endpointPath)));
    }
    if (isGoogle && item['mode'] == 'oauth') {
      final name = '${item['googleCustomerName'] ?? ''}';
      rows.add(_row(
        context,
        'Account',
        Text(name.isNotEmpty ? name : 'Not selected', style: const TextStyle(fontSize: 13)),
      ));
      rows.add(_row(context, 'Last sync',
          lastSync != null ? Text(_ago(lastSync.toLocal()), style: const TextStyle(fontSize: 13)) : _muted(context, 'Not synced yet')));
    } else if (isGoogle) {
      rows.add(_row(context, 'Webhook', _copyValue(context, '$serverBase/webhook/google', '/webhook/google')));
      rows.add(_row(
        context,
        'Key',
        token.isNotEmpty
            ? _copyValue(context, token, _mask(token))
            : const Text('Press Edit, then Update to create one', style: TextStyle(fontSize: 13, color: AppColors.warning)),
      ));
    }
    if (isTokenSource) {
      rows.add(_row(context, 'Endpoint', _copyValue(context, '$serverBase/webhook/lead', '/webhook/lead')));
      rows.add(_row(
        context,
        'Token',
        token.isNotEmpty
            ? _copyValue(context, token, _mask(token))
            : const Text('Press Edit, then Update to create one', style: TextStyle(fontSize: 13, color: AppColors.warning)),
      ));
      rows.add(_row(context, 'Last lead',
          lastSync != null ? Text(_ago(lastSync.toLocal()), style: const TextStyle(fontSize: 13)) : _muted(context, 'No leads yet')));
    }
    if (!isFb && !isWebsite && !isGoogle && !isTokenSource) {
      rows.add(_row(context, 'Endpoint', _copyValue(context, '$serverBase$endpointPath', endpointPath)));
    }

    return Align(
      alignment: Alignment.topLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 660),
        child: Opacity(
          opacity: paused ? 0.8 : 1,
          child: Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ConnectionLogo(item),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                            if (showSubtitle)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(subtitle,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 12, color: t.textSoft)),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 6),
                            Text(statusLabel,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: statusColor)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...rows,
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.only(top: 12),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
                    child: Row(
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: onEdit,
                                icon: const Icon(Icons.edit_outlined, size: 15),
                                label: const Text('Edit'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 38),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                              if (onDiagnose != null)
                                OutlinedButton.icon(
                                  onPressed: onDiagnose,
                                  icon: const Icon(Icons.search_rounded, size: 15),
                                  label: const Text('Diagnose'),
                                  style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(0, 38),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                              if (onSync != null)
                                OutlinedButton.icon(
                                  onPressed: onSync,
                                  icon: const Icon(Icons.sync_rounded, size: 15),
                                  label: const Text('Sync now'),
                                  style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(0, 38),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (onToggleActive != null)
                          Tooltip(
                            message: paused
                                ? 'Resume: new leads from this connection are accepted again'
                                : 'Pause: new leads from this connection are ignored until you resume it',
                            child: IconButton.outlined(
                              onPressed: toggling ? null : onToggleActive,
                              icon: Icon(paused ? Icons.play_arrow_rounded : Icons.pause_rounded, size: 18),
                            ),
                          ),
                        const SizedBox(width: 4),
                        IconButton.outlined(
                          onPressed: onDelete,
                          tooltip: 'Delete connection',
                          style: IconButton.styleFrom(
                            foregroundColor: AppColors.danger,
                            side: BorderSide(color: AppColors.danger.withValues(alpha: 0.4)),
                          ),
                          icon: const Icon(Icons.delete_outline_rounded, size: 18),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}


/// Vistrow Voice's logo: a rounded square with a purple to pink gradient and a
/// white waveform, the same 40 by 40 drawing the web uses.
class _VistrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 40;
    canvas.save();
    canvas.scale(k);
    final rect = RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 40, 40), const Radius.circular(9));
    canvas.drawRRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.bottomLeft,
          end: Alignment.topRight,
          colors: [Color(0xFF4C1D95), Color(0xFF9333EA), Color(0xFFEC4899)],
          stops: [0, 0.5, 1],
        ).createShader(const Rect.fromLTWH(0, 0, 40, 40)),
    );
    final path = Path()
      ..moveTo(6, 20)
      ..lineTo(11, 20)
      ..cubicTo(12.5, 20, 13, 15.5, 14.5, 15.5)
      ..cubicTo(16, 15.5, 16.5, 24.5, 18, 24.5)
      ..cubicTo(19.2, 24.5, 19.8, 10, 21.5, 10)
      ..cubicTo(23.2, 10, 23.8, 24.5, 25, 24.5)
      ..cubicTo(26.2, 24.5, 26.8, 20, 28, 20)
      ..lineTo(31, 20)
      ..cubicTo(32, 20, 32, 17, 34, 17);
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}


/// A website's own favicon, fetched the way a browser's image tag does: the
/// favicon service answers 404 with its default globe picture for a site it
/// has no icon for, and a browser still shows that picture, while Flutter's
/// Image.network treats the 404 as a failure. So the bytes are read whatever
/// the status is (and kept for the session), and the plain fallback only
/// shows when nothing at all can be loaded.
class SiteFavicon extends StatefulWidget {
  final String host;
  final double size;
  final Widget fallback;
  const SiteFavicon({super.key, required this.host, required this.size, required this.fallback});

  static final Map<String, Uint8List?> _cache = {};
  static final Dio _dio = Dio(BaseOptions(
    responseType: ResponseType.bytes,
    validateStatus: (_) => true,
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 8),
  ));

  static Future<Uint8List?> load(String host) async {
    if (_cache.containsKey(host)) return _cache[host];
    Uint8List? bytes;
    try {
      final r = await _dio.get<List<int>>(
        'https://www.google.com/s2/favicons?domain=${Uri.encodeComponent(host)}&sz=64',
      );
      final data = r.data;
      final type = r.headers.value('content-type') ?? '';
      if (data != null && data.length > 80 && type.startsWith('image/')) {
        bytes = Uint8List.fromList(data);
      }
    } catch (_) {}
    _cache[host] = bytes;
    return bytes;
  }

  @override
  State<SiteFavicon> createState() => _SiteFaviconState();
}

class _SiteFaviconState extends State<SiteFavicon> {
  late Future<Uint8List?> _future = SiteFavicon.load(widget.host);

  @override
  void didUpdateWidget(covariant SiteFavicon old) {
    super.didUpdateWidget(old);
    if (old.host != widget.host) _future = SiteFavicon.load(widget.host);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List?>(
      future: _future,
      builder: (context, snap) {
        final bytes = snap.data;
        if (bytes == null) return widget.fallback;
        return Image.memory(
          bytes,
          width: widget.size,
          height: widget.size,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => widget.fallback,
        );
      },
    );
  }
}
