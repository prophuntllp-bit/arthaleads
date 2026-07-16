import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import 'invoice_pdf.dart';

/// Invoices — GET /invoices, PATCH /invoices/:id/status, PATCH /invoices/:id/number.
/// Generation happens from the Bookings screen (POST /invoices needs a bookingId).
/// Mirrors frontend/src/pages/Invoices.jsx including stats, status filter and
/// branded PDF export.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _invoices = [];
  bool _loading = true;
  String _statusFilter = 'all';
  String? _generatingId;

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

  Future<void> _editNumber(Map<String, dynamic> inv) async {
    final ctrl = TextEditingController(
      text: (inv['customInvoiceNumber'] as String?)?.isNotEmpty == true
          ? inv['customInvoiceNumber'] as String
          : '${inv['invoiceNumber'] ?? ''}',
    );
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invoice Number'),
        content: TextField(controller: ctrl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    final trimmed = v?.trim();
    if (trimmed == null || trimmed.isEmpty) return;
    try {
      final res = await _api.dio.patch('/invoices/${inv['_id']}/number', data: {'invoiceNumber': trimmed});
      setState(() {
        final i = _invoices.indexWhere((x) => x['_id'] == inv['_id']);
        if (i != -1) _invoices[i] = (res.data['data'] as Map).cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update invoice number')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _downloadPdf(Map<String, dynamic> inv) async {
    setState(() => _generatingId = inv['_id'] as String);
    try {
      final org = context.read<AuthState>().org;
      final bytes = await buildInvoicePdf(inv: inv, org: org);
      final number = (inv['customInvoiceNumber'] as String?)?.isNotEmpty == true
          ? inv['customInvoiceNumber']
          : inv['invoiceNumber'];
      final customer = (inv['customerName'] as String? ?? 'invoice').replaceAll(RegExp(r'\s+'), '_');
      await Printing.sharePdf(bytes: bytes, filename: 'Invoice-$number-$customer.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to generate PDF: $e'),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _generatingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _statusFilter == 'all' ? _invoices : _invoices.where((i) => i['status'] == _statusFilter).toList();
    final totalBill = _invoices.fold<num>(0, (s, i) => s + ((i['totalBill'] as num?) ?? 0));
    final totalRecv = _invoices
        .where((i) => i['status'] == 'payment_received')
        .fold<num>(0, (s, i) => s + ((i['totalBill'] as num?) ?? 0));
    final totalPend = totalBill - totalRecv;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Row(
            children: [
              _statCard('Total Raised', _fmtMoney(totalBill), const Color(0xFF6366F1)),
              const SizedBox(width: 8),
              _statCard('Received', _fmtMoney(totalRecv), AppColors.success),
              const SizedBox(width: 8),
              _statCard('Pending', _fmtMoney(totalPend), AppColors.warning),
            ],
          ),
        ),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              _filterChip('all', 'All'),
              ..._statuses.map((s) => _filterChip(s, _statusLabels[s]!)),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: _loading
              ? const Center(child: AppSpinner(size: 32))
              : filtered.isEmpty
                  ? const Center(child: Text('No invoices yet'))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: filtered.length,
                        itemBuilder: (context, i) {
                          final inv = filtered[i];
                          final color = _statusColors[inv['status']] ?? const Color(0xFF6B7280);
                          final number = (inv['customInvoiceNumber'] as String?)?.isNotEmpty == true
                              ? inv['customInvoiceNumber']
                              : inv['invoiceNumber'];
                          final generating = _generatingId == inv['_id'];
                          return FadeSlideIn(
                            delay: Duration(milliseconds: 20 * (i % 12)),
                            child: Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ListTile(
                                    onTap: () => _changeStatus(inv),
                                    title: Text(inv['customerName'] as String? ?? '—',
                                        style: const TextStyle(fontWeight: FontWeight.w600)),
                                    subtitle: Row(
                                      children: [
                                        Expanded(child: Text('${inv['projectName'] ?? ''}')),
                                      ],
                                    ),
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
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(16, 0, 12, 8),
                                    child: Row(
                                      children: [
                                        InkWell(
                                          onTap: () => _editNumber(inv),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text('Invoice #$number',
                                                  style: Theme.of(context).textTheme.bodySmall),
                                              const SizedBox(width: 4),
                                              const Icon(Icons.edit, size: 12),
                                            ],
                                          ),
                                        ),
                                        const Spacer(),
                                        TextButton.icon(
                                          onPressed: generating ? null : () => _downloadPdf(inv),
                                          icon: generating
                                              ? const SizedBox(
                                                  width: 14, height: 14,
                                                  child: CircularProgressIndicator(strokeWidth: 2),
                                                )
                                              : const Icon(Icons.picture_as_pdf_outlined, size: 16),
                                          label: Text(generating ? 'Generating…' : 'Download PDF',
                                              style: const TextStyle(fontSize: 12)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _filterChip(String value, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ChoiceChip(
        label: Text(label),
        selected: _statusFilter == value,
        onSelected: (_) => setState(() => _statusFilter = value),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: color)),
            Text(label, style: TextStyle(fontSize: 10, color: color), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
