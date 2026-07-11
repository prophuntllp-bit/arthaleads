import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Bookings — GET/POST/PUT/DELETE /bookings, GET /developers,
/// POST /invoices (generate). Mirrors frontend/src/pages/Bookings.jsx,
/// scoped to the core fields — advanced brokerage adjustments (FOS/EOI
/// incentives, manual GST split) stay web-only for now.
class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _developers = [];
  bool _loading = true;

  static const _statusColors = {
    'new': AppColors.info,
    'invoiced': AppColors.warning,
    'payment_received': AppColors.success,
  };

  static const _statusLabels = {
    'new': 'New',
    'invoiced': 'Invoiced',
    'payment_received': 'Payment Received',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.dio.get('/bookings', queryParameters: {'limit': 50}),
        _api.dio.get('/developers'),
      ]);
      setState(() {
        _bookings = (results[0].data['data'] as List? ?? []).cast<Map<String, dynamic>>();
        _developers = (results[1].data['data'] as List? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load bookings')),
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

  Future<void> _generateInvoice(Map<String, dynamic> booking) async {
    try {
      await _api.dio.post('/invoices', data: {'bookingId': booking['_id']});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Invoice generated'),
          backgroundColor: AppColors.success,
        ));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to generate invoice')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> booking) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete booking?'),
        content: Text('"${booking['customerName']}" — ${booking['unitNo']} will be permanently deleted.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/bookings/${booking['_id']}');
      setState(() => _bookings.remove(booking));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Delete failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _openForm({Map<String, dynamic>? booking}) async {
    if (_developers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Add a developer on the web app first'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }
    final customerCtrl = TextEditingController(text: booking?['customerName'] as String? ?? '');
    final projectCtrl = TextEditingController(text: booking?['projectName'] as String? ?? '');
    final unitCtrl = TextEditingController(text: booking?['unitNo'] as String? ?? '');
    final valueCtrl = TextEditingController(text: booking?['considerationValue']?.toString() ?? '');
    final brokerageCtrl = TextEditingController(text: booking?['brokeragePercent']?.toString() ?? '2');
    final devIdFromBooking = booking?['developerId'] is Map
        ? (booking!['developerId'] as Map)['_id'] as String?
        : booking?['developerId'] as String?;
    String? developerId = devIdFromBooking ?? (_developers.isNotEmpty ? _developers.first['_id'] as String : null);
    String unitType = booking?['unitType'] as String? ?? 'Flat';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(booking == null ? 'New Booking' : 'Edit Booking', style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 16),
                TextField(controller: customerCtrl, decoration: const InputDecoration(labelText: 'Customer name')),
                const SizedBox(height: 12),
                TextField(controller: projectCtrl, decoration: const InputDecoration(labelText: 'Project name')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: developerId,
                  decoration: const InputDecoration(labelText: 'Developer'),
                  items: _developers
                      .map((d) => DropdownMenuItem(value: d['_id'] as String, child: Text(d['name'] as String? ?? '—')))
                      .toList(),
                  onChanged: booking != null ? null : (v) => setSheetState(() => developerId = v),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: unitType,
                        decoration: const InputDecoration(labelText: 'Type'),
                        items: const [
                          DropdownMenuItem(value: 'Flat', child: Text('Flat')),
                          DropdownMenuItem(value: 'Plot', child: Text('Plot')),
                          DropdownMenuItem(value: 'Villa', child: Text('Villa')),
                          DropdownMenuItem(value: 'Shop', child: Text('Shop')),
                          DropdownMenuItem(value: 'Office', child: Text('Office')),
                          DropdownMenuItem(value: 'Other', child: Text('Other')),
                        ],
                        onChanged: (v) => setSheetState(() => unitType = v ?? 'Flat'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit no.')),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: valueCtrl,
                        decoration: const InputDecoration(labelText: 'Consideration value (₹)'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: brokerageCtrl,
                        decoration: const InputDecoration(labelText: 'Brokerage %'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () async {
                    if (developerId == null) return;
                    final data = {
                      'customerName': customerCtrl.text.trim(),
                      'projectName': projectCtrl.text.trim(),
                      'unitNo': unitCtrl.text.trim(),
                      'unitType': unitType,
                      'developerId': developerId,
                      'considerationValue': double.tryParse(valueCtrl.text) ?? 0,
                      'brokeragePercent': double.tryParse(brokerageCtrl.text) ?? 0,
                    };
                    try {
                      if (booking == null) {
                        await _api.dio.post('/bookings', data: data);
                      } else {
                        await _api.dio.put('/bookings/${booking['_id']}', data: data);
                      }
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Save failed')),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: Text(booking == null ? 'Create Booking' : 'Save Changes'),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );

    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add_rounded),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _bookings.isEmpty
              ? const Center(child: Text('No bookings yet'))
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.only(bottom: 80, top: 8),
                    itemCount: _bookings.length,
                    itemBuilder: (context, i) {
                      final b = _bookings[i];
                      final color = _statusColors[b['status']] ?? const Color(0xFF6B7280);
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        child: ListTile(
                          onTap: () => _openForm(booking: b),
                          title: Text(b['customerName'] as String? ?? '—',
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${b['projectName'] ?? ''} · ${b['unitNo'] ?? ''}'),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: color.withValues(alpha: 0.35)),
                                    ),
                                    child: Text(_statusLabels[b['status']] ?? b['status'] as String? ?? '',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(_fmtMoney(b['totalBill']), style: Theme.of(context).textTheme.bodySmall),
                                ],
                              ),
                            ],
                          ),
                          trailing: PopupMenuButton<String>(
                            onSelected: (v) {
                              if (v == 'invoice') _generateInvoice(b);
                              if (v == 'delete') _delete(b);
                            },
                            itemBuilder: (ctx) => [
                              if (b['status'] == 'new')
                                const PopupMenuItem(value: 'invoice', child: Text('Generate Invoice')),
                              const PopupMenuItem(value: 'delete', child: Text('Delete')),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
