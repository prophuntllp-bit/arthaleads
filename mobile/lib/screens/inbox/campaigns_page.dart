import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'campaign_builder.dart';

String _rupees(num? paise) {
  final v = (paise ?? 0) / 100;
  return '₹${NumberFormat('#,##0.00', 'en_IN').format(v)}';
}

const _statusMeta = {
  'draft': (Icons.schedule, Colors.grey),
  'sending': (Icons.autorenew, AppColors.warning),
  'sent': (Icons.check_circle, AppColors.success),
  'failed': (Icons.cancel, AppColors.danger),
  'cancelled': (Icons.cancel, Colors.grey),
};

/// Campaigns tab — list of WhatsApp broadcast campaigns. Mirrors
/// frontend/src/pages/conversations/CampaignsPage.jsx against
/// GET /whatsapp/campaigns, polled while any row is "sending".
class CampaignsPage extends StatefulWidget {
  const CampaignsPage({super.key});

  @override
  State<CampaignsPage> createState() => _CampaignsPageState();
}

class _CampaignsPageState extends State<CampaignsPage> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _rows;
  bool _loading = true;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/whatsapp/campaigns');
      if (!mounted) return;
      final rows = (res.data['campaigns'] as List? ?? []).cast<Map<String, dynamic>>();
      setState(() => _rows = rows);
      final anySending = rows.any((c) => c['status'] == 'sending');
      _poll?.cancel();
      if (anySending) {
        _poll = Timer(const Duration(seconds: 4), () => _load(silent: true));
      }
    } catch (_) {
    } finally {
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  Future<void> _openBuilder({String? id}) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => CampaignBuilderScreen(campaignId: id)),
    );
    if (changed == true) _load();
  }

  String _etaText(Map<String, dynamic> c) {
    final stats = (c['stats'] as Map?)?.cast<String, dynamic>() ?? {};
    final done = ((stats['sent'] as num?) ?? 0) + ((stats['failed'] as num?) ?? 0);
    final startedAt = DateTime.tryParse(c['startedAt'] as String? ?? '');
    if (done < 3 || startedAt == null) return 'Broadcasting in progress';
    final elapsed = DateTime.now().difference(startedAt).inSeconds;
    if (elapsed <= 0) return 'Broadcasting in progress';
    final rate = done / elapsed;
    final queued = (stats['queued'] as num?) ?? 0;
    final remaining = queued - done;
    if (rate <= 0 || remaining <= 0) return 'Broadcasting in progress';
    final secsLeft = (remaining / rate).round();
    if (secsLeft < 60) return '(~${secsLeft}s left)';
    return '(~${(secsLeft / 60).round()} min left)';
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<AuthState>().isWaAdmin;
    if (_loading && _rows == null) {
      return const Center(child: AppSpinner());
    }
    final rows = _rows ?? [];
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Campaigns', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ),
              if (canEdit)
                GradientButton(icon: Icons.add, onPressed: () => _openBuilder(), child: const Text('New')),
            ],
          ),
          const SizedBox(height: 16),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  const Icon(Icons.campaign_outlined, size: 40, color: Colors.grey),
                  const SizedBox(height: 12),
                  const Text('No campaigns yet'),
                  if (canEdit) ...[
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: () => _openBuilder(), child: const Text('Create a campaign')),
                  ],
                ],
              ),
            )
          else
            ...rows.map((c) => _CampaignCard(
                  campaign: c,
                  canEdit: canEdit,
                  etaText: _etaText,
                  onTap: c['status'] == 'draft' && canEdit ? () => _openBuilder(id: c['_id'] as String) : null,
                )),
        ],
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  final Map<String, dynamic> campaign;
  final bool canEdit;
  final String Function(Map<String, dynamic>) etaText;
  final VoidCallback? onTap;
  const _CampaignCard({required this.campaign, required this.canEdit, required this.etaText, this.onTap});

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '';
    return DateFormat('d MMM, h:mm a').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final status = campaign['status'] as String? ?? 'draft';
    final meta = _statusMeta[status] ?? _statusMeta['draft']!;
    final stats = (campaign['stats'] as Map?)?.cast<String, dynamic>() ?? {};
    final sending = status == 'sending';
    final failureReason = campaign['failureReason'] as String?;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(meta.$1, size: 16, color: meta.$2),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(campaign['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  ),
                  if (status == 'draft' && canEdit)
                    const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '${campaign['templateName'] ?? ''} · ${_fmtDate(campaign['createdAt'] as String?)} · ${campaign['createdByName'] ?? ''}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
              if (sending) ...[
                const SizedBox(height: 4),
                Text(etaText(campaign), style: const TextStyle(fontSize: 11, color: AppColors.warning)),
              ],
              if (status == 'sent' && campaign['finishedAt'] != null) ...[
                const SizedBox(height: 4),
                Text('Completed ${_fmtDate(campaign['finishedAt'] as String?)}', style: const TextStyle(fontSize: 11, color: AppColors.success)),
              ],
              if ((status == 'failed' || ((stats['failed'] as num?) ?? 0) > 0) && failureReason != null) ...[
                const SizedBox(height: 4),
                Text(failureReason, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.danger)),
              ],
              if (status != 'draft') ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    _Stat('Sent', '${stats['sent'] ?? 0}${sending ? '/${stats['queued'] ?? 0}' : ''}'),
                    _Stat('Failed', '${stats['failed'] ?? 0}'),
                    _Stat('No consent', '${stats['skippedNoConsent'] ?? 0}'),
                    _Stat(sending ? 'Est. cost' : 'Cost', _rupees(sending ? campaign['reservedPaise'] : campaign['spentPaise'])),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey)),
        ],
      ),
    );
  }
}
