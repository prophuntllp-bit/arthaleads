import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Invoices — GET /invoices, PATCH /invoices/:id/status. Generation happens
/// from the Bookings screen (POST /invoices needs a bookingId). Mirrors
/// frontend/src/pages/Invoices.jsx list + status update.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _invoices = [];
  bool _loading = true;

  static const _statuses = ['draft', 'sent', 'payment_pending', 'payment_received'];
  static const _statusLabels = {
    'draft': 'Draft',
    'sent': 'Sent',
    'payment_pending': 'Payment Pending',
    'payment_received': 'Payment Received',
  };
  static const _statusColors = {
    'draft': Color(0xFF6B7280),
    'sent': AppColors.info,
    'payment_pending': AppColors.warning,
    'payment_received': AppColors.success,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/invoices', queryParameters: {'limit': 50});
      setState(() => _invoices = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load invoices')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmtMoney(dynamic v) {
    final n = (v as num?)?.toDouble() ?? 0;
    if (n >= 10000000) return '₹${(n / 10000000).toStringAsFixed(2)}Cr';
    if (n >= 100000) return '₹${(n / 100000).toStringAsFixed(1)}L';
    return '₹${n.toStringAsFixed(0)}';
  }

  Future<void> _changeStatus(Map<String, dynamic> inv) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: _statuses.map((s) => ListTile(
                leading: Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: _statusColors[s]),
                ),
                title: Text(_statusLabels[s]!),
                trailing: inv['status'] == s ? const Icon(Icons.check_rounded, color: AppColors.primary) : null,
                onTap: () => Navigator.pop(ctx, s),
              )).toList(),
        ),
      ),
    );
    if (selected == null || selected == inv['status']) return;
    try {
      await _api.dio.patch('/invoices/${inv['_id']}/status', data: {'status': selected});
      setState(() => inv['status'] = selected);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update status')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _invoices.isEmpty
            ? const Center(child: Text('No invoices yet'))
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _invoices.length,
                  itemBuilder: (context, i) {
                    final inv = _invoices[i];
                    final color = _statusColors[inv['status']] ?? const Color(0xFF6B7280);
                    final number = (inv['customInvoiceNumber'] as String?)?.isNotEmpty == true
                        ? inv['customInvoiceNumber']
                        : inv['invoiceNumber'];
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: ListTile(
                        onTap: () => _changeStatus(inv),
                        title: Text(inv['customerName'] as String? ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('Invoice #$number · ${inv['projectName'] ?? ''}'),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(_fmtMoney(inv['totalBill']), style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: color.withValues(alpha: 0.35)),
                              ),
                              child: Text(_statusLabels[inv['status']] ?? inv['status'] as String? ?? '',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              );
  }
}
