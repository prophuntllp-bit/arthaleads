import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr/qr.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import 'motion.dart';

/// Ports `frontend/src/components/QrModal.jsx` — a lead-capture QR code for
/// either the org's shared form (`/org/me/qr-token`) or a single project's
/// form (`/projects/:id/qr-token`). Renders the QR natively via the `qr`
/// package rather than an image round-trip, same as the pre-existing
/// org-QR sheet this generalizes.
class QrSheet extends StatefulWidget {
  final String endpoint;
  final String title;
  final String description;

  const QrSheet({
    super.key,
    required this.endpoint,
    required this.title,
    required this.description,
  });

  @override
  State<QrSheet> createState() => _QrSheetState();
}

class _QrSheetState extends State<QrSheet> {
  final _api = ApiClient.instance;
  String? _url;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool regenerate = false}) async {
    setState(() => _loading = true);
    try {
      var response = regenerate
          ? await _api.dio.post(widget.endpoint)
          : await _api.dio.get(widget.endpoint);
      var token = response.data['qrToken']?.toString();
      if ((token == null || token.isEmpty) && !regenerate) {
        response = await _api.dio.post(widget.endpoint);
        token = response.data['qrToken']?.toString();
      }
      if (mounted) {
        setState(() {
          _url = token == null || token.isEmpty
              ? null
              : 'https://www.arthaleads.com/form/$token';
        });
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(error, 'Failed to load QR code')),
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
        title: const Text('Generate a new QR code?'),
        content: const Text('The old one will stop working.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Regenerate')),
        ],
      ),
    );
    if (ok == true) _load(regenerate: true);
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
                      ? const Center(child: Text('QR code unavailable'))
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
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Share.share(url),
                      icon: const Icon(Icons.share_rounded, size: 18),
                      label: const Text('Share'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _confirmRegen,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Regenerate'),
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
