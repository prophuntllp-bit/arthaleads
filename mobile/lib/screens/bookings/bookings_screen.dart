import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

const _unitTypes = ['Flat', 'Plot', 'Villa', 'Shop', 'Office', 'Other'];

/// Bookings — GET/POST/PUT/DELETE /bookings, GET /developers,
/// POST /invoices (generate). Mirrors frontend/src/pages/Bookings.jsx,
/// including the full brokerage calculation fields (adjustment, FOS/EOI
/// incentives, manual amount override, GST split) and summary stats.
class BookingsScreen extends StatefulWidget {
  final void Function(String label)? onNavigate;

  const BookingsScreen({super.key, this.onNavigate});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _bookings = [];
  List<Map<String, dynamic>> _developers = [];
  bool _loading = true;
  String _filter = 'all';

  static const _statusColors = {
    'new': Color(0xFF6366F1),
    'invoiced': AppColors.primary,
    'payment_received': AppColors.success,
  };

  static const _statusLabels = {
    'new': 'New',
    'invoiced': 'Invoiced',
    'payment_received': 'Paid',
  };

  List<Map<String, dynamic>> get _filtered => _filter == 'all'
      ? _bookings
      : _bookings.where((b) => b['status'] == _filter).toList();

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
        _bookings = (results[0].data['data'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        _developers = (results[1].data['data'] as List? ?? [])
            .cast<Map<String, dynamic>>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load bookings')),
            backgroundColor: AppColors.danger,
          ),
        );
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

  String _fmtDate(dynamic v) {
    final dt = DateTime.tryParse(v?.toString() ?? '');
    if (dt == null) return '-';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  Future<void> _generateInvoice(Map<String, dynamic> booking) async {
    try {
      await _api.dio.post('/invoices', data: {'bookingId': booking['_id']});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invoice generated'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      _load();
      widget.onNavigate?.call('Invoices');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to generate invoice'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> booking) async {
    final hasInvoice = booking['invoiceId'] != null;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete booking?'),
        content: Text(
          hasInvoice
              ? 'Delete this booking and its linked invoice? This cannot be undone.'
              : '"${booking['customerName']}" — ${booking['unitNo']} will be permanently deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Delete failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _openForm({Map<String, dynamic>? booking}) async {
    if (_developers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add a developer from the Developers screen first'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    final editing = booking != null;
    final customerCtrl = TextEditingController(
      text: booking?['customerName'] as String? ?? '',
    );
    final jointBuyerCtrl = TextEditingController(
      text: booking?['jointBuyerName'] as String? ?? '',
    );
    final projectCtrl = TextEditingController(
      text: booking?['projectName'] as String? ?? '',
    );
    final phaseCtrl = TextEditingController(
      text: booking?['phase'] as String? ?? '',
    );
    final unitCtrl = TextEditingController(
      text: booking?['unitNo'] as String? ?? '',
    );
    final towerCtrl = TextEditingController(
      text: booking?['tower'] as String? ?? '',
    );
    final valueCtrl = TextEditingController(
      text: booking?['considerationValue']?.toString() ?? '',
    );
    final brokeragePctCtrl = TextEditingController(
      text: booking?['brokeragePercent']?.toString() ?? '2',
    );
    final brokerageAmtCtrl = TextEditingController(
      text: booking?['brokerageAmount']?.toString() ?? '',
    );
    final adjustmentCtrl = TextEditingController(
      text: booking?['brokerageAdjustment']?.toString() ?? '0',
    );
    final fosCtrl = TextEditingController(
      text: booking?['fosIncentive']?.toString() ?? '0',
    );
    final eoiCtrl = TextEditingController(
      text: booking?['eoiIncentive']?.toString() ?? '0',
    );
    final notesCtrl = TextEditingController(
      text: booking?['notes'] as String? ?? '',
    );

    final devIdFromBooking = booking?['developerId'] is Map
        ? (booking!['developerId'] as Map)['_id'] as String?
        : booking?['developerId'] as String?;
    String? developerId =
        devIdFromBooking ??
        (_developers.isNotEmpty ? _developers.first['_id'] as String : null);
    String unitType = booking?['unitType'] as String? ?? 'Flat';
    String gstType = booking?['gstType'] as String? ?? 'CGST_SGST';
    bool manualBrokerage = false;
    DateTime bookingDate =
        DateTime.tryParse(booking?['bookingDate']?.toString() ?? '') ??
        DateTime.now();

    double parseNum(String s) => double.tryParse(s.trim()) ?? 0;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          void applyDeveloperDefaults(String? devId) {
            if (editing || devId == null) return;
            final dev = _developers.firstWhere(
              (d) => d['_id'] == devId,
              orElse: () => {},
            );
            if (dev.isEmpty) return;
            setSheetState(() {
              brokeragePctCtrl.text = (dev['defaultBrokeragePercent'] ?? 2)
                  .toString();
              fosCtrl.text = (dev['defaultFosIncentive'] ?? 0).toString();
              eoiCtrl.text = (dev['defaultEoiIncentive'] ?? 0).toString();
            });
          }

          final cv = parseNum(valueCtrl.text);
          final pct = parseNum(brokeragePctCtrl.text);
          final brok = manualBrokerage
              ? parseNum(brokerageAmtCtrl.text)
              : (cv * pct / 100);
          final adj = parseNum(adjustmentCtrl.text);
          final fos = parseNum(fosCtrl.text);
          final eoi = parseNum(eoiCtrl.text);
          final total = brok - adj + fos + eoi;
          final isIgst = gstType == 'IGST';
          final cgst = isIgst ? 0.0 : total * 0.09;
          final sgst = cgst;
          final igst = isIgst ? total * 0.18 : 0.0;
          final bill = total + cgst + sgst + igst;

          Widget calcRow(
            String label,
            String value, {
            bool bold = false,
            Color? color,
          }) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: bold ? null : Colors.grey,
                    fontWeight: bold ? FontWeight.w700 : FontWeight.normal,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          );

          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    editing ? 'Edit Booking' : 'New Booking',
                    style: Theme.of(ctx).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Customer Details',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: customerCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Customer name *',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: jointBuyerCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Joint buyer (optional)',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Unit Details',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: developerId,
                    decoration: const InputDecoration(labelText: 'Developer *'),
                    items: _developers
                        .map(
                          (d) => DropdownMenuItem(
                            value: d['_id'] as String,
                            child: Text(d['name'] as String? ?? '—'),
                          ),
                        )
                        .toList(),
                    onChanged: editing
                        ? null
                        : (v) {
                            developerId = v;
                            applyDeveloperDefaults(v);
                          },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: projectCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Project name *',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: phaseCtrl,
                          decoration: const InputDecoration(labelText: 'Phase'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: unitType,
                          decoration: const InputDecoration(labelText: 'Type'),
                          items: _unitTypes
                              .map(
                                (t) =>
                                    DropdownMenuItem(value: t, child: Text(t)),
                              )
                              .toList(),
                          onChanged: (v) =>
                              setSheetState(() => unitType = v ?? 'Flat'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: unitCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Unit / Plot no. *',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: towerCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Tower / Block',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: bookingDate,
                        firstDate: DateTime(2015),
                        lastDate: DateTime(2100),
                      );
                      if (picked != null)
                        setSheetState(() => bookingDate = picked);
                    },
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Booking date',
                      ),
                      child: Text(_fmtDate(bookingDate.toIso8601String())),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Brokerage Details',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: valueCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Consideration value (₹)',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setSheetState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: manualBrokerage
                            ? TextField(
                                controller: brokerageAmtCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Brokerage amount (₹)',
                                ),
                                keyboardType: TextInputType.number,
                                onChanged: (_) => setSheetState(() {}),
                              )
                            : TextField(
                                controller: brokeragePctCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Brokerage %',
                                ),
                                keyboardType: TextInputType.number,
                                onChanged: (_) => setSheetState(() {}),
                              ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Switch(
                            value: manualBrokerage,
                            onChanged: (v) =>
                                setSheetState(() => manualBrokerage = v),
                          ),
                          const Text('Manual', style: TextStyle(fontSize: 9)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: adjustmentCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Brokerage adjustment (-) (₹)',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setSheetState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: fosCtrl,
                          decoration: const InputDecoration(
                            labelText: 'FOS incentive (₹)',
                          ),
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setSheetState(() {}),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: eoiCtrl,
                          decoration: const InputDecoration(
                            labelText: 'EOI incentive (₹)',
                          ),
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setSheetState(() {}),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              setSheetState(() => gstType = 'CGST_SGST'),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: gstType == 'CGST_SGST'
                                ? AppColors.primary
                                : null,
                            foregroundColor: gstType == 'CGST_SGST'
                                ? Colors.white
                                : null,
                          ),
                          child: const Text(
                            'CGST + SGST',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              setSheetState(() => gstType = 'IGST'),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: gstType == 'IGST'
                                ? AppColors.primary
                                : null,
                            foregroundColor: gstType == 'IGST'
                                ? Colors.white
                                : null,
                          ),
                          child: const Text(
                            'IGST (Interstate)',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Notes (internal)',
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(ctx).cardColor,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Theme.of(ctx).dividerColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'LIVE CALCULATION',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        calcRow('Brokerage Amount', _fmtMoney(brok)),
                        if (adj > 0)
                          calcRow(
                            'Adjustment (-)',
                            '-${_fmtMoney(adj)}',
                            color: AppColors.danger,
                          ),
                        if (fos > 0)
                          calcRow(
                            'FOS Incentive',
                            _fmtMoney(fos),
                            color: const Color(0xFF6366F1),
                          ),
                        if (eoi > 0)
                          calcRow(
                            'EOI Incentive',
                            _fmtMoney(eoi),
                            color: AppColors.success,
                          ),
                        calcRow(
                          'Total Brokerage',
                          _fmtMoney(total),
                          bold: true,
                        ),
                        if (cgst > 0) calcRow('CGST @9%', _fmtMoney(cgst)),
                        if (sgst > 0) calcRow('SGST @9%', _fmtMoney(sgst)),
                        if (igst > 0) calcRow('IGST @18%', _fmtMoney(igst)),
                        const Divider(height: 14),
                        calcRow('Total Bill', _fmtMoney(bill), bold: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  GradientButton(
                    fullWidth: true,
                    onPressed: () async {
                      if (customerCtrl.text.trim().isEmpty) return;
                      if (projectCtrl.text.trim().isEmpty) return;
                      if (unitCtrl.text.trim().isEmpty) return;
                      if (developerId == null) return;
                      final data = {
                        'customerName': customerCtrl.text.trim(),
                        'jointBuyerName': jointBuyerCtrl.text.trim(),
                        'projectName': projectCtrl.text.trim(),
                        'phase': phaseCtrl.text.trim(),
                        'unitNo': unitCtrl.text.trim(),
                        'tower': towerCtrl.text.trim(),
                        'unitType': unitType,
                        'developerId': developerId,
                        'bookingDate': bookingDate.toIso8601String(),
                        'considerationValue': parseNum(valueCtrl.text),
                        'brokeragePercent': parseNum(brokeragePctCtrl.text),
                        if (manualBrokerage)
                          'brokerageAmount': parseNum(brokerageAmtCtrl.text),
                        'brokerageAdjustment': parseNum(adjustmentCtrl.text),
                        'fosIncentive': parseNum(fosCtrl.text),
                        'eoiIncentive': parseNum(eoiCtrl.text),
                        'gstType': gstType,
                        'notes': notesCtrl.text.trim(),
                      };
                      try {
                        if (!editing) {
                          await _api.dio.post('/bookings', data: data);
                        } else {
                          await _api.dio.put(
                            '/bookings/${booking['_id']}',
                            data: data,
                          );
                        }
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(
                              content: Text(
                                ApiClient.errorMessage(e, 'Save failed'),
                              ),
                              backgroundColor: AppColors.danger,
                            ),
                          );
                        }
                      }
                    },
                    child: Text(editing ? 'Save Changes' : 'Create Booking'),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          );
        },
      ),
    );

    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final totalBill = _bookings.fold<num>(
      0,
      (s, b) => s + ((b['totalBill'] as num?) ?? 0),
    );
    final countPending = _bookings.where((b) => b['status'] == 'new').length;
    final countPaid = _bookings
        .where((b) => b['status'] == 'payment_received')
        .length;

    return Scaffold(
      floatingActionButton: GradientFab(onPressed: () => _openForm()),
      body: _loading
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                children: [
                  // ── Stats ──
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 2.1,
                    children: [
                      _statCard(
                        'Total Bookings',
                        '${_bookings.length}',
                        const Color(0xFF6366F1),
                      ),
                      _statCard(
                        'Total Brokerage',
                        _fmtMoney(totalBill),
                        AppColors.primary,
                      ),
                      _statCard(
                        'Invoice Pending',
                        '$countPending',
                        AppColors.warning,
                      ),
                      _statCard(
                        'Payment Received',
                        '$countPaid',
                        AppColors.success,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // ── Filter tabs ──
                  SizedBox(
                    height: 34,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final f in [
                          ['all', 'All'],
                          ['new', 'New'],
                          ['invoiced', 'Invoiced'],
                          ['payment_received', 'Paid'],
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(
                                f[1],
                                style: const TextStyle(fontSize: 11.5),
                              ),
                              selected: _filter == f[0],
                              onSelected: (_) => setState(() => _filter = f[0]),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: Text('No bookings yet')),
                    )
                  else
                    for (final (i, b) in _filtered.indexed)
                      FadeSlideIn(
                        delay: Duration(milliseconds: 20 * (i % 12)),
                        child: _bookingCard(b),
                      ),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, String value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Theme.of(context).dividerColor),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(label, style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    ),
  );

  Widget _bookingCard(Map<String, dynamic> b) {
    final color = _statusColors[b['status']] ?? const Color(0xFF6B7280);
    final dev = b['developerId'] is Map
        ? (b['developerId'] as Map)['name'] as String?
        : null;
    final unitBits = [
      b['unitType'],
      b['unitNo'],
      if ((b['tower'] as String? ?? '').isNotEmpty) '• ${b['tower']}',
      if ((b['phase'] as String? ?? '').isNotEmpty) '• Ph.${b['phase']}',
    ].where((e) => e != null && e.toString().isNotEmpty).join(' ');

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        onTap: () => _openForm(booking: b),
        title: Text(
          b['customerName'] as String? ?? '—',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if ((b['jointBuyerName'] as String? ?? '').isNotEmpty)
              Text(
                b['jointBuyerName'] as String,
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            Text('${b['projectName'] ?? ''} · $unitBits'),
            if (dev != null)
              Text(
                dev,
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            Text(
              _fmtDate(b['bookingDate']),
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: color.withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    _statusLabels[b['status']] ?? b['status'] as String? ?? '',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _fmtMoney(b['totalBill']),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      'Brok: ${_fmtMoney(b['totalBrokerage'])}',
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        isThreeLine: true,
        trailing: PopupMenuButton<String>(
          onSelected: (v) {
            if (v == 'invoice') _generateInvoice(b);
            if (v == 'view_invoice') widget.onNavigate?.call('Invoices');
            if (v == 'delete') _delete(b);
          },
          itemBuilder: (ctx) => [
            if (b['status'] == 'new')
              const PopupMenuItem(
                value: 'invoice',
                child: Text('Generate Invoice'),
              ),
            if (b['invoiceId'] != null)
              const PopupMenuItem(
                value: 'view_invoice',
                child: Text('View Invoice'),
              ),
            const PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
      ),
    );
  }
}
