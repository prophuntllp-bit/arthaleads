import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';

/// "Delete my account", for the Settings screen.
///
/// Mirrors frontend/src/components/DeleteAccountSection.jsx. Two outcomes, and
/// which one applies is not obvious from where the person is standing, so the
/// server is asked first and the dialog says plainly what will happen:
///
///   * Most people are removed straight away and their organisation carries on.
///   * The last admin is closing the whole workspace, so that is scheduled with
///     a notice period and has to be confirmed by typing the organisation name.
///
/// The typed confirmation is only on the destructive branch. Asking everyone to
/// type a company name to leave a job they no longer have is friction for its
/// own sake; asking for it before destroying a company's CRM is the point.
class DeleteAccountTile extends StatefulWidget {
  const DeleteAccountTile({super.key});

  @override
  State<DeleteAccountTile> createState() => _DeleteAccountTileState();
}

class _DeleteAccountTileState extends State<DeleteAccountTile> {
  Map<String, dynamic>? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.dio.get('/auth/account/deletion');
      if (!mounted) return;
      setState(() => _status = Map<String, dynamic>.from(res.data as Map));
    } catch (_) {
      if (!mounted) return;
      setState(() => _status = {'willCloseOrganisation': false});
    }
  }

  Future<void> _confirmAndDelete() async {
    final closesOrg = _status?['willCloseOrganisation'] == true;
    final orgName = (_status?['orgName'] as String?)?.trim() ?? '';
    final graceDays = _status?['graceDays'] ?? 30;

    final typed = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(closesOrg ? 'Delete workspace?' : 'Delete your account?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                closesOrg
                    ? 'You are the only admin of $orgName, so this closes the workspace. '
                      'Every lead, project, booking and invoice is deleted permanently after '
                      '$graceDays days. Signing in before then cancels it.'
                    : 'Your account and personal data are deleted right away. Your organisation '
                      'and its records stay with your colleagues, and your name is removed from them.',
              ),
              if (closesOrg) ...[
                const SizedBox(height: 16),
                Text('Type $orgName to confirm',
                    style: Theme.of(dialogContext).textTheme.bodySmall),
                const SizedBox(height: 6),
                TextField(
                  controller: typed,
                  autofocus: true,
                  decoration: InputDecoration(hintText: orgName),
                  onChanged: (_) => setDialogState(() {}),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: (!closesOrg || typed.text.trim() == orgName)
                  ? () => Navigator.pop(dialogContext, true)
                  : null,
              child: Text(
                closesOrg ? 'Delete everything' : 'Delete my account',
                style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );

    if (ok != true || !mounted) return;

    setState(() => _busy = true);
    try {
      final res = await ApiClient.instance.dio.post('/auth/account/deletion');
      if (!mounted) return;
      final outcome = (res.data as Map)['outcome'];
      if (outcome == 'scheduled') {
        // The org is frozen from here; refreshing drops us onto the screen that
        // offers to cancel.
        await context.read<AuthState>().refresh();
      } else {
        await context.read<AuthState>().logout();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiClient.errorMessage(e, 'Could not delete the account.'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_status == null) return const SizedBox.shrink();
    final closesOrg = _status?['willCloseOrganisation'] == true;

    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _busy ? null : _confirmAndDelete,
        icon: _busy
            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.danger),
        label: Text(
          closesOrg ? 'Delete workspace and account' : 'Delete my account',
          style: const TextStyle(color: AppColors.danger),
        ),
      ),
    );
  }
}
