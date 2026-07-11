import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Refer & Earn — GET /referrals/mine. Mirrors frontend/src/pages/ReferEarn.jsx.
class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _list = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/referrals/mine');
      final data = (res.data['data'] as Map).cast<String, dynamic>();
      setState(() {
        _list = (data['list'] as List? ?? []).cast<Map<String, dynamic>>();
        _summary = (data['summary'] as Map?)?.cast<String, dynamic>() ?? {};
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load referrals')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'signed_up': return 'Signed Up';
      case 'subscribed': return 'Subscribed';
      case 'reward_pending': return 'Reward Pending';
      case 'rewarded': return 'Rewarded';
      default: return s ?? '—';
    }
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'rewarded': return AppColors.success;
      case 'reward_pending': return AppColors.warning;
      case 'subscribed': return AppColors.info;
      default: return const Color(0xFF6B7280);
    }
  }

  Widget _statCard(String label, dynamic value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text('${value ?? 0}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: color), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              _statCard('Total', _summary['total'], AppColors.info),
              _statCard('Subscribed', _summary['subscribed'], AppColors.primary),
              _statCard('Rewarded', _summary['rewarded'], AppColors.success),
            ],
          ),
          const SizedBox(height: 20),
          Text('Referred Organisations', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_list.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No referrals yet — share your link to get started')),
            )
          else
            ..._list.map((r) {
              final color = _statusColor(r['status'] as String?);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(r['name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(
                      DateTime.tryParse(r['joinedAt'] as String? ?? '') ?? DateTime.now())),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: color.withValues(alpha: 0.35)),
                    ),
                    child: Text(_statusLabel(r['status'] as String?),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
