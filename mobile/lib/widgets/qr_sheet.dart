import 'dart:convert';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr/qr.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';
import 'motion.dart';

/// Where a QR points (21 Oct 2026), the same rule as the web's
/// publicFormBase() in frontend/src/components/QrModal.jsx: live QRs go to
/// www.arthaleads.com, and the staging app's to staging.arthaleads.com (its
/// tokens only exist on the staging server, so a www link said "expired").
String qrFormBase() => ApiClient.isStaging ? 'https://staging.arthaleads.com' : 'https://www.arthaleads.com';

/// Ports `frontend/src/components/QrModal.jsx` — a lead-capture QR code for
/// either the org's shared form (`/org/me/qr-token`) or a single project's
/// form (`/projects/:id/qr-token`). Renders the QR natively via the `qr`
/// package rather than an image round-trip, same as the pre-existing
/// org-QR sheet this generalizes.
class QrSheet extends StatefulWidget {
  final String endpoint;
  final String title;
  final String description;

  /// A project QR: its name heads the poster.
  final String? projectName;

  const QrSheet({
    super.key,
    required this.endpoint,
    required this.title,
    required this.description,
    this.projectName,
  });

  @override
  State<QrSheet> createState() => _QrSheetState();
}

class _QrSheetState extends State<QrSheet> {
  final _api = ApiClient.instance;
  String? _url;
  String? _problem;
  bool _loading = true;
  bool _sharingPoster = false;

  bool get _isOrg => widget.endpoint.startsWith('/org/');
  String get _who => _isOrg ? 'an admin' : 'an admin or manager';

  @override
  void initState() {
    super.initState();
    _load();
  }

  static bool _forbidden(Object e) => e is DioException && e.response?.statusCode == 403;

  /// Making the QR (and a new one) is for admins on the company QR, admins and
  /// managers on a project QR; anyone else is told who can, not "Failed".
  Future<void> _load({bool regenerate = false}) async {
    setState(() {
      _loading = true;
      _problem = null;
    });
    try {
      var response = regenerate ? await _api.dio.post(widget.endpoint) : await _api.dio.get(widget.endpoint);
      var token = response.data['qrToken']?.toString();
      if ((token == null || token.isEmpty) && !regenerate) {
        try {
          response = await _api.dio.post(widget.endpoint);
          token = response.data['qrToken']?.toString();
        } catch (e) {
          if (!_forbidden(e)) rethrow;
          if (mounted) setState(() => _problem = 'No QR code yet. Ask $_who to open this once to create it.');
          return;
        }
      }
      if (mounted) {
        setState(() => _url = token == null || token.isEmpty ? null : '${qrFormBase()}/form/$token');
        if (regenerate) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('New QR code made. Old printed copies no longer work.')),
          );
        }
      }
    } catch (error) {
      if (!mounted) return;
      if (_forbidden(error)) {
        if (regenerate) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Only $_who can make a new QR code.')));
        } else {
          setState(() => _problem = 'Only $_who can see this QR code.');
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(error, "Couldn't load the QR code. Check your connection.")),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmRegen() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Make a new QR code?'),
        content: const Text('Every printed copy of the old one will stop working.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Make new code')),
        ],
      ),
    );
    if (ok == true) _load(regenerate: true);
  }

  /// The A4 poster as a picture to send to a print shop or WhatsApp: logo,
  /// the project (or company) name, a big QR, the link written out, and what
  /// to do. Same layout as the web's Print poster.
  Future<void> _sharePoster() async {
    final url = _url;
    if (url == null || _sharingPoster) return;
    setState(() => _sharingPoster = true);
    try {
      final org = context.read<AuthState>().org;
      final orgName = '${org?['name'] ?? ''}';
      final logo = await _orgLogo('${org?['logo'] ?? ''}');
      final png = await renderQrPoster(
        url: url,
        title: widget.projectName?.isNotEmpty == true ? widget.projectName! : (orgName.isNotEmpty ? orgName : 'Enquire now'),
        subtitle: widget.projectName?.isNotEmpty == true ? orgName : '',
        logo: logo,
      );
      final slug = (widget.projectName ?? orgName).toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-');
      await Share.shareXFiles(
        [XFile.fromData(png, name: 'enquiry-poster-${slug.isEmpty ? 'qr' : slug}.png', mimeType: 'image/png')],
        text: 'Enquiry poster (A4). Print at full size.',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't make the poster. Try again.")));
      }
    } finally {
      if (mounted) setState(() => _sharingPoster = false);
    }
  }

  /// The company logo when it is stored in the org record (a data: URL).
  static Future<ui.Image?> _orgLogo(String logo) async {
    if (!logo.startsWith('data:image')) return null;
    try {
      final bytes = base64Decode(logo.substring(logo.indexOf(',') + 1));
      final codec = await ui.instantiateImageCodec(bytes);
      return (await codec.getNextFrame()).image;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final url = _url;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 4, 22, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              widget.description,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),
            Container(
              width: 260,
              height: 260,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 18)],
              ),
              child: _loading
                  ? const Center(child: AppSpinner(size: 32))
                  : url == null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(
                              _problem ?? 'QR code unavailable',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Color(0xFF4B5563), fontSize: 14),
                            ),
                          ),
                        )
                      : CustomPaint(painter: QrPainter(url)),
            ),
            if (url != null && !_loading) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.only(left: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Theme.of(context).dividerColor),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        url,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Copy link',
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: url));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Lead form link copied')),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy_rounded, size: 18),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _sharingPoster ? null : _sharePoster,
                  icon: _sharingPoster
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.print_rounded, size: 18),
                  label: const Text('Share A4 poster'),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Share.share(url),
                      icon: const Icon(Icons.share_rounded, size: 18),
                      label: const Text('Share link'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _confirmRegen,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('New code'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Draws the A4 enquiry poster (1240 x 1754 px, 150 dpi) and returns a PNG.
Future<Uint8List> renderQrPoster({required String url, required String title, String subtitle = '', ui.Image? logo}) async {
  const w = 1240.0, h = 1754.0;
  const orange = Color(0xFFFF6B00), ink = Color(0xFF111827), soft = Color(0xFF4B5563);
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, w, h));
  canvas.drawRect(const Rect.fromLTWH(0, 0, w, h), Paint()..color = Colors.white);
  canvas.drawRect(const Rect.fromLTWH(0, 0, w, 60), Paint()..color = orange);

  double y = 130;
  if (logo != null) {
    const maxW = 520.0, maxH = 130.0;
    final scale = [maxW / logo.width, maxH / logo.height, 1.0].reduce((a, b) => a < b ? a : b);
    final lw = logo.width * scale, lh = logo.height * scale;
    paintImage(canvas: canvas, rect: Rect.fromLTWH((w - lw) / 2, y, lw, lh), image: logo, fit: BoxFit.contain);
    y += lh + 50;
  }

  double text(String s, double size, Color color, {FontWeight weight = FontWeight.w400, double spacing = 0, double width = 1050}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, color: color, fontWeight: weight, letterSpacing: spacing, height: 1.15)),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 3,
      ellipsis: '…',
    )..layout(maxWidth: width);
    tp.paint(canvas, Offset((w - tp.width) / 2, y));
    return tp.height;
  }

  y += text('SCAN TO ENQUIRE', 38, orange, weight: FontWeight.w700, spacing: 8) + 22;
  y += text(title, 92, ink, weight: FontWeight.w800) + 14;
  if (subtitle.isNotEmpty) y += text(subtitle, 44, soft);
  y += 60;

  const qrSize = 680.0;
  final qrLeft = (w - qrSize) / 2;
  final frame = RRect.fromRectAndRadius(Rect.fromLTWH(qrLeft - 30, y - 30, qrSize + 60, qrSize + 60), const Radius.circular(40));
  canvas.drawRRect(frame, Paint()..color = ink..style = PaintingStyle.stroke..strokeWidth = 8);
  canvas.save();
  canvas.translate(qrLeft, y);
  QrPainter(url).paint(canvas, const Size(qrSize, qrSize));
  canvas.restore();
  y += qrSize + 90;

  y += text('Point your phone camera here', 60, ink, weight: FontWeight.w800) + 14;
  y += text('Share your name and number in 30 seconds. Our team will call you back.', 36, soft) + 30;
  text('Or open $url', 28, const Color(0xFF374151));
  y = h - 70;
  text('Powered by ArthaLeads', 24, const Color(0xFF9CA3AF));

  final image = await recorder.endRecording().toImage(w.toInt(), h.toInt());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return bytes!.buffer.asUint8List();
}

class QrPainter extends CustomPainter {
  QrPainter(String data)
      : image = QrImage(QrCode.fromData(data: data, errorCorrectLevel: QrErrorCorrectLevel.M));

  final QrImage image;

  @override
  void paint(Canvas canvas, Size size) {
    final module = size.shortestSide / image.moduleCount;
    final paint = Paint()..color = const Color(0xFF111827);
    for (var row = 0; row < image.moduleCount; row++) {
      for (var column = 0; column < image.moduleCount; column++) {
        if (image.isDark(row, column)) {
          canvas.drawRect(
            Rect.fromLTWH(column * module, row * module, module + .2, module + .2),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant QrPainter oldDelegate) => false;
}
