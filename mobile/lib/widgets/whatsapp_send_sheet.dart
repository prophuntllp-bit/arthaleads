import 'dart:io' show Platform;

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';

/// Green "Chat on WhatsApp" bottom sheet — pre-filled message (editable),
/// an AI Draft button, and a choice of personal vs Business WhatsApp.
/// Mirrors frontend/src/components/UI.jsx's WhatsAppLink exactly.
///
/// `leadId` + optional `projectId` enable the AI Draft button (calls the same
/// /leads/:id/draft-message or /projects/:pid/leads/:id/draft-message the web
/// app uses). Without a leadId the sheet still works — just no AI Draft chip,
/// same as web when leadId is absent.
Future<void> showWhatsAppSendSheet(
  BuildContext context, {
  required String? phone,
  String? name,
  String? leadId,
  String? projectId,
  VoidCallback? onSent,
}) async {
  if (phone == null || phone.isEmpty) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _WhatsAppSendSheet(
      phone: phone,
      name: name,
      leadId: leadId,
      projectId: projectId,
      onSent: onSent,
    ),
  );
}

String _toWaNumber(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  return digits.length == 10 ? '91$digits' : digits;
}

// Mirrors buildWAMessage() in frontend/src/components/UI.jsx exactly.
String _buildDefaultMessage(BuildContext context, String? leadName) {
  final auth = context.read<AuthState>();
  final agentName = (auth.user?['name'] as String? ?? '').trim();
  final orgName = (auth.org?['name'] as String? ?? '').trim();
  final firstName = (leadName ?? '').split(' ').first.trim();
  final greeting = firstName.isNotEmpty ? 'Hi $firstName! 👋' : 'Hi! 👋';
  final from = agentName.isNotEmpty && orgName.isNotEmpty
      ? " I'm $agentName from $orgName."
      : agentName.isNotEmpty
          ? " I'm $agentName."
          : orgName.isNotEmpty
              ? " I'm from $orgName."
              : '';
  return "$greeting$from I'm following up on your property enquiry. Are you still looking? 🏠";
}

// Explicit package-targeted intent so Android opens the specific app, not a
// chooser — falls back to a generic launch (whatever's registered) if that
// exact package can't handle it. Returns false only when a *targeted*
// package launch (WhatsApp Business) genuinely failed, so the caller can
// offer the Play Store link.
Future<bool> _launchWhatsApp(String package, String waNumber, String text) async {
  final query = text.isNotEmpty ? '?text=${Uri.encodeComponent(text)}' : '';
  final url = 'https://wa.me/$waNumber$query';
  if (Platform.isAndroid) {
    try {
      await AndroidIntent(
        action: 'action_view',
        data: url,
        package: package,
      ).launch();
      return true;
    } catch (_) {
      return false;
    }
  }
  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  return true;
}

class _WhatsAppSendSheet extends StatefulWidget {
  final String phone;
  final String? name;
  final String? leadId;
  final String? projectId;
  final VoidCallback? onSent;

  const _WhatsAppSendSheet({
    required this.phone,
    this.name,
    this.leadId,
    this.projectId,
    this.onSent,
  });

  @override
  State<_WhatsAppSendSheet> createState() => _WhatsAppSendSheetState();
}

class _WhatsAppSendSheetState extends State<_WhatsAppSendSheet> {
  final _api = ApiClient.instance;
  late final _ctrl = TextEditingController(text: _buildDefaultMessage(context, widget.name));
  bool _drafting = false;
  bool _wabNotInstalled = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _aiDraft() async {
    if (widget.leadId == null || _drafting) return;
    setState(() => _drafting = true);
    try {
      final res = widget.projectId != null
          ? await _api.dio.post('/projects/${widget.projectId}/leads/${widget.leadId}/draft-message')
          : await _api.dio.post('/leads/${widget.leadId}/draft-message');
      final msg = res.data['message'] as String?;
      if (msg != null && msg.isNotEmpty && mounted) _ctrl.text = msg;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'AI draft failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _drafting = false);
    }
  }

  void _sendPersonal() {
    Navigator.pop(context);
    widget.onSent?.call();
    _launchWhatsApp('com.whatsapp', _toWaNumber(widget.phone), _ctrl.text);
  }

  Future<void> _sendBusiness() async {
    final ok = await _launchWhatsApp('com.whatsapp.w4b', _toWaNumber(widget.phone), _ctrl.text);
    if (!mounted) return;
    if (ok) {
      widget.onSent?.call();
      Navigator.pop(context);
    } else {
      setState(() => _wabNotInstalled = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'MESSAGE — EDIT BEFORE SENDING',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: t.textSoft,
                        ),
                      ),
                      if (widget.leadId != null)
                        InkWell(
                          onTap: _drafting ? null : _aiDraft,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _drafting
                                    ? SizedBox(
                                        width: 11,
                                        height: 11,
                                        child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
                                      )
                                    : Icon(Icons.auto_awesome, size: 12, color: AppColors.primary),
                                const SizedBox(width: 4),
                                Text(
                                  _drafting ? 'Drafting…' : 'AI Draft',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _ctrl,
                    maxLines: 3,
                    minLines: 3,
                    style: const TextStyle(fontSize: 13, height: 1.4),
                    decoration: const InputDecoration(isDense: true, hintText: 'Type a message…'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.green.withValues(alpha: 0.15),
                child: Icon(FontAwesomeIcons.whatsapp.data, color: Colors.green, size: 18),
              ),
              title: const Text('Send via WhatsApp', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              subtitle: const Text('Personal account', style: TextStyle(fontSize: 11)),
              onTap: _sendPersonal,
            ),
            ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.green.shade700.withValues(alpha: 0.15),
                child: Icon(FontAwesomeIcons.whatsapp.data, color: Colors.green.shade700, size: 18),
              ),
              title: const Text('Send via WhatsApp Business', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              subtitle: const Text('Business account', style: TextStyle(fontSize: 11)),
              onTap: _sendBusiness,
            ),
            if (_wabNotInstalled)
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Icon(FontAwesomeIcons.whatsapp.data, color: AppColors.primary, size: 18),
                ),
                title: const Text('Download WA Business', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                subtitle: const Text('App not found on device', style: TextStyle(fontSize: 11)),
                onTap: () {
                  Navigator.pop(context);
                  launchUrl(
                    Uri.parse('https://play.google.com/store/apps/details?id=com.whatsapp.w4b'),
                    mode: LaunchMode.externalApplication,
                  );
                },
              ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }
}
