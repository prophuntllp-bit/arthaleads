import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme.dart';
import '../core/update_service.dart';

/// Wraps the app and, once on launch, offers a newer APK if one exists.
///
/// The Android build is distributed privately rather than through the Play
/// Store, so nothing updates it on its own. Without this, a user stays on the
/// build they were first given — indefinitely.
///
/// Two modes:
///  - optional  → dismissible ("Later" remembers this build and stops nagging)
///  - mandatory → blocking; the installed build is older than the backend's
///                minBuild, so it cannot be dismissed or back-buttoned away.
class UpdateGate extends StatefulWidget {
  final Widget child;
  const UpdateGate({super.key, required this.child});

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> {
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  Future<void> _run() async {
    if (_checked) return;
    _checked = true;

    final info = await UpdateService.check();
    if (info == null || !mounted) return;

    await showDialog<void>(
      context: context,
      barrierDismissible: !info.mandatory,
      builder: (_) => _UpdateDialog(info: info),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _UpdateDialog extends StatelessWidget {
  final UpdateInfo info;
  const _UpdateDialog({required this.info});

  Future<void> _download(BuildContext context) async {
    final uri = Uri.tryParse(info.downloadUrl);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open the download link.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final version = info.latestVersion.isNotEmpty
        ? info.latestVersion
        : 'build ${info.latestBuild}';

    // A mandatory update must survive the Android back button too.
    return PopScope(
      canPop: !info.mandatory,
      child: AlertDialog(
        icon: const Icon(
          Icons.system_update_rounded,
          size: 40,
          color: AppColors.primary,
        ),
        title: Text(
          info.mandatory ? 'Update required' : 'Update available',
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              info.mandatory
                  ? 'This version of Arthaleads is no longer supported. '
                      'Please install version $version to continue.'
                  : 'Arthaleads $version is available.',
              textAlign: TextAlign.center,
            ),
            if (info.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                info.releaseNotes,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          if (!info.mandatory)
            TextButton(
              onPressed: () {
                UpdateService.skip(info.latestBuild);
                Navigator.of(context).pop();
              },
              child: const Text('Later'),
            ),
          ElevatedButton.icon(
            onPressed: () => _download(context),
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Update now'),
          ),
        ],
      ),
    );
  }
}
