import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
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

    await showUpdateDialog(context, info);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Shared with the manual "Check for Updates" action in Settings — same
/// dialog either way, whether the app found it on launch or a person asked.
Future<void> showUpdateDialog(BuildContext context, UpdateInfo info) {
  return showDialog<void>(
    context: context,
    barrierDismissible: !info.mandatory,
    builder: (_) => _UpdateDialog(info: info),
  );
}

enum _Stage { idle, downloading, installing, failed }

class _UpdateDialog extends StatefulWidget {
  final UpdateInfo info;
  const _UpdateDialog({required this.info});

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  _Stage _stage = _Stage.idle;
  double _progress = 0;
  String? _error;

  UpdateInfo get info => widget.info;

  /// Downloads the APK ourselves and hands it straight to the system
  /// installer — no browser round-trip. Falls back to the old
  /// open-in-browser behaviour on any failure (network, storage, a GitHub
  /// hiccup) so this can only add a better path, never remove the old one.
  Future<void> _installInApp() async {
    setState(() {
      _stage = _Stage.downloading;
      _progress = 0;
      _error = null;
    });
    try {
      final path = await UpdateService.downloadApk(
        info.downloadUrl,
        onProgress: (received, total) {
          if (total > 0 && mounted) {
            setState(() => _progress = received / total);
          }
        },
      );
      if (!mounted) return;
      setState(() => _stage = _Stage.installing);
      final result = await OpenFile.open(path);
      if (result.type != ResultType.done && mounted) {
        setState(() {
          _stage = _Stage.failed;
          _error = result.message.isNotEmpty
              ? result.message
              : 'Could not open the installer.';
        });
      }
      // ResultType.done just means Android accepted the install intent —
      // the system installer takes over the screen from here. Whatever the
      // user does in it (install / cancel) is theirs to decide; we don't
      // need to react to it, and the app may be backgrounded while it shows.
    } catch (e) {
      if (mounted) {
        setState(() {
          _stage = _Stage.failed;
          _error = 'Download failed — check your connection and try again.';
        });
      }
    }
  }

  Future<void> _openInBrowser() async {
    final uri = Uri.tryParse(info.downloadUrl);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
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
    final busy = _stage == _Stage.downloading || _stage == _Stage.installing;

    // A mandatory update must survive the Android back button too, and a
    // download in progress must not be interruptible either way — there is
    // nowhere useful for "back" to go mid-download.
    return PopScope(
      canPop: !info.mandatory && !busy,
      child: AlertDialog(
        icon: Icon(
          busy ? Icons.download_rounded : Icons.system_update_rounded,
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
            if (info.releaseNotes.isNotEmpty && !busy && _stage != _Stage.failed) ...[
              const SizedBox(height: 12),
              Text(
                info.releaseNotes,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (_stage == _Stage.downloading) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: _progress > 0 ? _progress : null,
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _progress > 0 ? '${(_progress * 100).round()}%' : 'Starting…',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (_stage == _Stage.installing) ...[
              const SizedBox(height: 16),
              const SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
              const SizedBox(height: 8),
              Text('Opening installer…', style: Theme.of(context).textTheme.bodySmall),
            ],
            if (_stage == _Stage.failed) ...[
              const SizedBox(height: 12),
              Text(
                _error ?? 'Something went wrong.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.danger, fontSize: 13),
              ),
            ],
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: busy
            ? const []
            : [
                if (!info.mandatory && _stage != _Stage.failed)
                  TextButton(
                    onPressed: () {
                      UpdateService.skip(info.latestBuild);
                      Navigator.of(context).pop();
                    },
                    child: const Text('Later'),
                  ),
                if (_stage == _Stage.failed)
                  TextButton(
                    onPressed: _openInBrowser,
                    child: const Text('Open in browser'),
                  ),
                ElevatedButton.icon(
                  onPressed: _installInApp,
                  icon: Icon(
                    _stage == _Stage.failed ? Icons.refresh_rounded : Icons.download_rounded,
                    size: 18,
                  ),
                  label: Text(_stage == _Stage.failed ? 'Try again' : 'Update now'),
                ),
              ],
      ),
    );
  }
}
