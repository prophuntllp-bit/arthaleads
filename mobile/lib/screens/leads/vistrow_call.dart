import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Vistrow Voice AI calls on a lead: the status the lead sheet shows and the
/// "AI call" button. Mirrors frontend/src/components/VistrowVoicePanel.jsx
/// (useVistrowCall): GET /integrations/vistrow-outbound/leads/:id/status for
/// the newest delivery and whether a call can be requested, POST .../call to
/// ask the AI agent to call now (admins and managers). Pipeline leads only:
/// project copies have no delivery of their own.
class VistrowCall extends ChangeNotifier {
  VistrowCall({required this.leadId, required this.role});

  /// Null for a project lead.
  final String? leadId;
  final String role;

  static const _base = '/integrations/vistrow-outbound/leads';

  Map<String, dynamic>? status;
  bool calling = false;
  bool _disposed = false;

  bool get mayCall => role == 'admin' || role == 'manager' || role == 'super_admin';
  Map<String, dynamic>? get delivery => (status?['lastDelivery'] as Map?)?.cast<String, dynamic>();

  /// A call Vistrow queued and has not made yet.
  DateTime? get queuedUntil {
    final d = delivery;
    if (d == null || d['callQueued'] != true) return null;
    final at = DateTime.tryParse('${d['callQueuedUntil'] ?? ''}');
    return at != null && at.isAfter(DateTime.now()) ? at : null;
  }

  /// The request is still on its way to Vistrow.
  bool get inFlight => const ['pending', 'sending'].contains(delivery?['status']);

  /// The AI is (about to be) calling this lead.
  bool get busy => inFlight || queuedUntil != null;

  bool get canAiCall => leadId != null && mayCall && status?['canCall'] == true;

  /// Who the next AI call comes from (current routing), else the last one.
  String get agentLabel => '${status?['nextAgentLabel'] ?? ''}'.isNotEmpty
      ? '${status!['nextAgentLabel']}'
      : '${delivery?['agentLabel'] ?? ''}';

  Future<void> load() async {
    if (leadId == null) return;
    try {
      final res = await ApiClient.instance.dio.get('$_base/$leadId/status');
      status = (res.data as Map).cast<String, dynamic>();
    } catch (_) {
      status = {'enabled': false, 'canCall': false, 'lastDelivery': null};
    }
    if (!_disposed) notifyListeners();
  }

  /// Asks Vistrow to call now. Vistrow answers within a few seconds; then the
  /// status and the lead (activity, call results) are read again.
  Future<String> requestCall({Future<void> Function()? reloadLead}) async {
    if (leadId == null || calling) return '';
    calling = true;
    notifyListeners();
    try {
      final res = await ApiClient.instance.dio.post('$_base/$leadId/call');
      final data = (res.data as Map).cast<String, dynamic>();
      unawaited(Future<void>.delayed(const Duration(seconds: 4), () async {
        await load();
        await reloadLead?.call();
        calling = false;
        if (!_disposed) notifyListeners();
      }));
      return data['queued'] == true
          ? 'Asked Vistrow Voice to call this lead'
          : '${data['message'] ?? 'A call was already requested in the last minute.'}';
    } catch (e) {
      calling = false;
      if (!_disposed) notifyListeners();
      return ApiClient.errorMessage(e, 'Could not request the call');
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

/// Vistrow's indigo, as on the web's AI-call button and status pill, so an AI
/// call never looks like one of the "you call" buttons.
const vistrowIndigo = Color(0xFF4F46E5);

/// The "AI call · Agent" button, shown to admins and managers when routing
/// would call this lead. "AI calling…" while a call is on its way.
class VistrowCallButton extends StatelessWidget {
  final VistrowCall vc;
  final Future<void> Function()? reloadLead;
  const VistrowCallButton({super.key, required this.vc, this.reloadLead});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: vc,
        builder: (context, _) {
          if (!vc.canAiCall) return const SizedBox.shrink();
          final t = AppTheme.of(context);
          final fg = t.isDark ? const Color(0xFFA5B4FC) : vistrowIndigo;
          final label = vc.busy ? 'AI calling…' : (vc.agentLabel.isNotEmpty ? 'AI call · ${vc.agentLabel}' : 'AI call');
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: vc.calling || vc.busy
                    ? null
                    : () async {
                        final messenger = ScaffoldMessenger.maybeOf(context);
                        final msg = await vc.requestCall(reloadLead: reloadLead);
                        if (msg.isNotEmpty) messenger?.showSnackBar(SnackBar(content: Text(msg)));
                      },
                icon: vc.calling
                    ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
                    : Icon(Icons.phone_forwarded_rounded, size: 18, color: fg),
                label: Text(label, overflow: TextOverflow.ellipsis),
                style: OutlinedButton.styleFrom(
                  foregroundColor: fg,
                  disabledForegroundColor: fg.withValues(alpha: 0.7),
                  backgroundColor: vistrowIndigo.withValues(alpha: t.isDark ? 0.14 : 0.07),
                  side: BorderSide(color: vistrowIndigo.withValues(alpha: 0.35)),
                ),
              ),
            ),
          );
        },
      );
}

/// "Vistrow AI calls": last AI call and its result, tries, the next AI call
/// (queued, or a follow-up Vistrow set), and why a call was not made.
class VistrowCallPanel extends StatelessWidget {
  final VistrowCall vc;
  final Map<String, dynamic> lead;
  const VistrowCallPanel({super.key, required this.vc, required this.lead});

  static const _kind = {'callback': 'Scheduled call-back', 'visit_reminder': 'Site-visit reminder', 'nurture': 'Follow-up call'};

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: vc,
        builder: (context, _) {
          final t = AppTheme.of(context);
          final calls = [
            for (final c in (lead['voiceCalls'] as List?) ?? const [])
              if (c is Map) c.cast<String, dynamic>(),
          ]..sort((a, b) => '${b['createdAt'] ?? ''}'.compareTo('${a['createdAt'] ?? ''}'));
          final d = vc.delivery;
          final st = vc.status;
          if (calls.isEmpty && d == null && st?['enabled'] != true) return const SizedBox.shrink();

          final last = calls.isEmpty ? null : calls.first;
          final tries = calls.fold<int>(0, (n, c) => n + (((c['attempts'] as num?) ?? 0) > 0 ? (c['attempts'] as num).toInt() : 1));
          final followUpAt = DateTime.tryParse('${lead['followUpDate'] ?? ''}');
          final vistrowFollowUp = lead['followUpSetByName'] == 'Vistrow Voice' && followUpAt != null && followUpAt.isAfter(DateTime.now())
              ? followUpAt
              : null;
          final next = vc.queuedUntil ?? vistrowFollowUp;
          final declined = d?['autoCall'] == true && d?['callQueued'] == false
              ? '${(d?['callReasonText'] as String?)?.isNotEmpty == true ? d!['callReasonText'] : 'Vistrow did not queue the call'}'
              : '';
          final whyNot = '${st?['whyNot'] ?? ''}';
          final fg = t.isDark ? const Color(0xFFA5B4FC) : vistrowIndigo;

          final lastLine = last == null
              ? 'No call yet'
              : [
                  (last['result'] as String?)?.isNotEmpty == true ? last['result'] : (_kind[last['followUpKind']] ?? 'Call made'),
                  if (last['createdAt'] != null) _when('${last['createdAt']}'),
                ].join(' · ');

          Widget line(String label, String value, {Color? color}) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '$label  ', style: TextStyle(color: t.textSoft)),
                    TextSpan(text: value, style: TextStyle(color: color ?? t.text, fontWeight: FontWeight.w500)),
                  ]),
                  style: const TextStyle(fontSize: 13, height: 1.4),
                ),
              );

          return Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            decoration: BoxDecoration(
              color: vistrowIndigo.withValues(alpha: t.isDark ? 0.10 : 0.05),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: vistrowIndigo.withValues(alpha: 0.18)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.phone_forwarded_rounded, size: 15, color: fg),
                const SizedBox(width: 6),
                Text('VISTROW AI CALLS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: t.textSoft)),
              ]),
              line('Last AI call', lastLine),
              if (calls.isNotEmpty) line('Tries', '$tries'),
              if (next != null) line('Next AI call', _when(next.toIso8601String()), color: fg),
              if (vc.inFlight) line('Now', 'Sending to Vistrow…'),
              if (declined.isNotEmpty) line('Not called', declined, color: const Color(0xFFB45309)),
              if (st != null && st['canCall'] != true && whyNot.isNotEmpty && vc.mayCall && declined.isEmpty && next == null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(whyNot, style: TextStyle(fontSize: 12, color: t.textSoft)),
                ),
            ]),
          );
        },
      );

  /// "Sat 17 Oct, 6:00 pm" in IST.
  static String _when(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final ist = d.toUtc().add(const Duration(hours: 5, minutes: 30));
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    return '${days[ist.weekday - 1]} ${ist.day} ${months[ist.month - 1]}, $h:${ist.minute.toString().padLeft(2, '0')} ${ist.hour < 12 ? 'am' : 'pm'}';
  }
}

/// Before a person calls a lead the AI is calling right now: ask, so the
/// customer is not rung twice (the web's "Call anyway?").
Future<bool> okToCallDespiteAi(BuildContext context, VistrowCall vc) async {
  if (!vc.busy) return true;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('AI is calling this lead'),
      content: const Text('Vistrow AI is calling this lead right now. Call anyway?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Wait')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Call anyway')),
      ],
    ),
  );
  return ok == true;
}
