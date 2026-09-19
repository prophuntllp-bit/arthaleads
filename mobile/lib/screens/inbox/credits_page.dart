import 'dart:convert';
import 'dart:typed_data';

import 'package:csv/csv.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

String _rupees(num? paise) {
  final v = (paise ?? 0) / 100;
  return '₹${NumberFormat('#,##0.00', 'en_IN').format(v)}';
}

/// Credits tab — balance, ledger statement, auto-recharge, top-up.
/// Mirrors frontend/src/pages/conversations/CreditsPage.jsx against
/// GET/PATCH /credits/*.
class CreditsPage extends StatefulWidget {
  const CreditsPage({super.key});

  @override
  State<CreditsPage> createState() => _CreditsPageState();
}

class _CreditsPageState extends State<CreditsPage> {
  final _api = ApiClient.instance;
  Map<String, dynamic>? _credits;
  final List<Map<String, dynamic>> _rows = [];
  int _page = 1;
  int _total = 0;
  bool _loadingBalance = true;
  bool _loadingLedger = true;
  bool _exporting = false;

  Map<String, dynamic>? _ar; // local copy of autoRecharge, editable
  bool _savingAr = false;

  @override
  void initState() {
    super.initState();
    _loadBalance();
    _loadLedger(1);
  }

  Future<void> _loadBalance() async {
    setState(() => _loadingBalance = true);
    try {
      final res = await _api.dio.get('/credits/balance');
      if (!mounted) return;
      setState(() {
        _credits = (res.data as Map).cast<String, dynamic>();
        _ar ??= (_credits!['autoRecharge'] as Map?)?.cast<String, dynamic>() ??
            {'enabled': false};
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingBalance = false);
    }
  }

  Future<void> _loadLedger(int page) async {
    setState(() => _loadingLedger = true);
    try {
      final res = await _api.dio.get(
        '/credits/ledger',
        queryParameters: {'page': page, 'limit': 25},
      );
      if (!mounted) return;
      setState(() {
        _rows
          ..clear()
          ..addAll((res.data['rows'] as List? ?? []).cast<Map<String, dynamic>>());
        _total = res.data['total'] as int? ?? 0;
        _page = page;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingLedger = false);
    }
  }

  Future<void> _refreshCredits() => _loadBalance();

  Future<void> _saveAutoRecharge(Map<String, dynamic> patch) async {
    setState(() => _savingAr = true);
    try {
      final res = await _api.dio.patch('/credits/auto-recharge', data: patch);
      if (!mounted) return;
      setState(() => _ar = (res.data['autoRecharge'] as Map).cast<String, dynamic>());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Auto-recharge updated')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Could not save')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingAr = false);
    }
  }

  String _fmtWhen(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '';
    final now = DateTime.now();
    final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday =
        dt.year == yesterday.year && dt.month == yesterday.month && dt.day == yesterday.day;
    if (isToday) return 'Today, ${DateFormat('h:mm a').format(dt)}';
    if (isYesterday) return 'Yesterday, ${DateFormat('h:mm a').format(dt)}';
    return DateFormat('d MMM, h:mm a').format(dt);
  }

  static const _categoryText = {
    'marketing': 'Marketing message',
    'utility': 'Utility message',
    'authentication': 'Authentication message',
    'service': 'Reply',
  };

  String _describe(Map<String, dynamic> r) {
    final type = r['type'] as String?;
    final conv = r['conversationId'];
    final name = conv is Map ? conv['contactName'] as String? : null;
    final phone = conv is Map ? conv['contactPhone'] as String? : null;
    final who = (name != null && name.trim().isNotEmpty) ? name : '+${phone ?? ''}';
    switch (type) {
      case 'topup':
        return r['razorpayPaymentId'] != null
            ? 'Credits added · ${r['razorpayPaymentId']}'
            : (r['note'] as String? ?? 'Credits added');
      case 'refund':
        return 'Refund · $who';
      case 'adjustment':
        return r['note'] as String? ?? 'Adjustment';
      default:
        final cat = r['category'] as String?;
        return '${_categoryText[cat] ?? 'Message'} to $who';
    }
  }

  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    try {
      final all = <Map<String, dynamic>>[];
      for (var p = 1; p <= 50; p++) {
        final res = await _api.dio.get(
          '/credits/ledger',
          queryParameters: {'page': p, 'limit': 200},
        );
        final rows = (res.data['rows'] as List? ?? []).cast<Map<String, dynamic>>();
        final total = res.data['total'] as int? ?? 0;
        all.addAll(rows);
        if (rows.isEmpty || all.length >= total) break;
      }
      final data = <List<dynamic>>[
        ['Date (IST)', 'Type', 'Description', 'Amount excl. GST (INR)', 'Balance after (INR)', 'Free tier', 'Razorpay payment'],
        ...all.map((r) => [
          _fmtWhen(r['createdAt'] as String?),
          r['type'],
          _describe(r),
          ((r['amountPaise'] as num? ?? 0) / 100).toStringAsFixed(2),
          ((r['balanceAfterPaise'] as num? ?? 0) / 100).toStringAsFixed(2),
          r['freeTierApplied'] == true ? 'Yes' : '',
          r['razorpayPaymentId'] ?? '',
        ]),
      ];
      final csv = const ListToCsvConverter().convert(data);
      final bytes = Uint8List.fromList(utf8.encode('﻿$csv'));
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await Share.shareXFiles([
        XFile.fromData(
          bytes,
          name: 'whatsapp-credits-statement-$today.csv',
          mimeType: 'text/csv',
        ),
      ]);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not export the statement'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _openTopUp() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TopUpSheet(onSuccess: () {
        _refreshCredits();
        _loadLedger(1);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthState>().isWaAdmin;
    final c = _credits;
    final billedByMeta = c?['billedDirectlyByMeta'] == true;
    final rates = (c?['ratesPaise'] as Map?)?.cast<String, dynamic>();
    final freeService = (c?['freeService'] as Map?)?.cast<String, dynamic>();
    final pages = (_total / 25).ceil().clamp(1, 999999);

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadBalance(), _loadLedger(1)]);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'WhatsApp Credits',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (isAdmin)
                GradientButton(icon: Icons.add, onPressed: _openTopUp, child: const Text('Add credits')),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Prepaid wallet', style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 16),

          if (_loadingBalance)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: AppSpinner()))
          else if (c != null) ...[
            _StatCard(
              title: 'Available balance',
              value: _rupees(c['availablePaise']),
              positive: ((c['availablePaise'] as num?) ?? 0) > 0,
              note: ((c['reservedPaise'] as num?) ?? 0) > 0
                  ? '${_rupees(c['reservedPaise'])} held for messages in flight'
                  : 'Nothing held right now',
            ),
            const SizedBox(height: 10),
            _StatCard(
              title: 'Free replies left this month',
              value: '${freeService?['remaining'] ?? 1000} of ${freeService?['limit'] ?? 1000}',
              note: 'Resets on the 1st',
            ),
            const SizedBox(height: 10),
            _StatCard(
              title: 'Your rates',
              value: billedByMeta
                  ? 'Billed directly by Meta'
                  : '${_rupees(rates?['service'])} / reply',
              note: billedByMeta
                  ? 'Charged directly to your own Meta account, not through Arthaleads credits.'
                  : 'Marketing ${_rupees(rates?['marketing'])} · Utility ${_rupees(rates?['utility'])} · excl. GST',
            ),
            const SizedBox(height: 10),

            if (isAdmin && _ar != null)
              _AutoRechargeCard(
                ar: _ar!,
                saving: _savingAr,
                onToggle: (v) {
                  setState(() => _ar = {..._ar!, 'enabled': v});
                  _saveAutoRecharge({'enabled': v});
                },
                onThresholdChanged: (paise) {
                  setState(() => _ar = {..._ar!, 'thresholdPaise': paise});
                  _saveAutoRecharge({'thresholdPaise': paise});
                },
                onRechargeChanged: (paise) {
                  setState(() => _ar = {..._ar!, 'rechargePaise': paise});
                  _saveAutoRecharge({'rechargePaise': paise});
                },
              ),
          ],

          const SizedBox(height: 18),
          Row(
            children: [
              const Expanded(
                child: Text('Statement', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              if (_total > 0)
                TextButton.icon(
                  onPressed: _exporting ? null : _exportCsv,
                  icon: _exporting
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download, size: 16),
                  label: const Text('Export CSV'),
                ),
            ],
          ),
          const SizedBox(height: 8),

          if (_loadingLedger && _rows.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: AppSpinner()))
          else if (_rows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Nothing yet.', style: TextStyle(color: Colors.grey))),
            )
          else ...[
            ..._rows.map((r) => _LedgerRow(
                  row: r,
                  when: _fmtWhen(r['createdAt'] as String?),
                  description: _describe(r),
                )),
            if (pages > 1)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: _page > 1 ? () => _loadLedger(_page - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('Page $_page of $pages'),
                    IconButton(
                      onPressed: _page < pages ? () => _loadLedger(_page + 1) : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String note;
  final bool? positive;
  const _StatCard({required this.title, required this.value, required this.note, this.positive});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            if (positive != null)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 10),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: positive! ? AppColors.success : AppColors.danger,
                ),
              ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(note, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AutoRechargeCard extends StatelessWidget {
  final Map<String, dynamic> ar;
  final bool saving;
  final ValueChanged<bool> onToggle;
  final ValueChanged<int> onThresholdChanged;
  final ValueChanged<int> onRechargeChanged;
  const _AutoRechargeCard({
    required this.ar,
    required this.saving,
    required this.onToggle,
    required this.onThresholdChanged,
    required this.onRechargeChanged,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = ar['enabled'] == true;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.bolt, size: 18),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text('Auto-recharge', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                Switch(value: enabled, onChanged: saving ? null : onToggle),
              ],
            ),
            const Text(
              'Emails admins to top up when the balance drops low. Does not auto-debit anything.',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
            if (enabled) ...[
              const SizedBox(height: 10),
              _MoneyField(
                label: 'When balance drops below',
                initialPaise: (ar['thresholdPaise'] as num?)?.toInt() ?? 10000,
                onChanged: onThresholdChanged,
              ),
              const SizedBox(height: 8),
              _MoneyField(
                label: 'Top up by',
                initialPaise: (ar['rechargePaise'] as num?)?.toInt() ?? 50000,
                onChanged: onRechargeChanged,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MoneyField extends StatefulWidget {
  final String label;
  final int initialPaise;
  final ValueChanged<int> onChanged;
  const _MoneyField({required this.label, required this.initialPaise, required this.onChanged});

  @override
  State<_MoneyField> createState() => _MoneyFieldState();
}

class _MoneyFieldState extends State<_MoneyField> {
  late final TextEditingController _ctrl =
      TextEditingController(text: (widget.initialPaise / 100).toStringAsFixed(0));

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _ctrl,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: widget.label,
        prefixText: '₹ ',
        isDense: true,
      ),
      onTapOutside: (_) => FocusScope.of(context).unfocus(),
      onEditingComplete: () {
        final rupees = int.tryParse(_ctrl.text.trim());
        if (rupees != null) widget.onChanged(rupees * 100);
        FocusScope.of(context).unfocus();
      },
    );
  }
}

class _LedgerRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final String when;
  final String description;
  const _LedgerRow({required this.row, required this.when, required this.description});

  @override
  Widget build(BuildContext context) {
    final amount = (row['amountPaise'] as num?) ?? 0;
    final isCredit = amount > 0;
    final isTopup = row['type'] == 'topup';
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isTopup ? AppColors.success.withValues(alpha: 0.08) : null,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: Row(
        children: [
          Icon(
            isCredit ? Icons.arrow_downward : Icons.arrow_upward,
            size: 16,
            color: isCredit ? AppColors.success : AppColors.danger,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(description, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(when, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                    if (row['freeTierApplied'] == true) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.info.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('free', style: TextStyle(fontSize: 9, color: AppColors.info)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : ''}${_rupees(amount)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isCredit ? AppColors.success : null,
                ),
              ),
              Text(_rupees(row['balanceAfterPaise']), style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Top-up bottom sheet — quote → Razorpay order → native Checkout → verify.
class _TopUpSheet extends StatefulWidget {
  final VoidCallback onSuccess;
  const _TopUpSheet({required this.onSuccess});

  @override
  State<_TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends State<_TopUpSheet> {
  final _api = ApiClient.instance;
  final _amountCtrl = TextEditingController(text: '1000');
  Map<String, dynamic>? _quote;
  bool _quoting = false;
  bool _paying = false;
  String? _error;
  late final Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _quoteAmount();
  }

  @override
  void dispose() {
    _razorpay.clear();
    _amountCtrl.dispose();
    super.dispose();
  }

  int get _creditPaise {
    final rupees = int.tryParse(_amountCtrl.text.trim()) ?? 0;
    return rupees * 100;
  }

  Future<void> _quoteAmount() async {
    if (_creditPaise < 50000) {
      setState(() {
        _quote = null;
        _error = 'Minimum top-up is ₹500';
      });
      return;
    }
    setState(() {
      _quoting = true;
      _error = null;
    });
    try {
      final res = await _api.dio.get(
        '/credits/topup/quote',
        queryParameters: {'creditPaise': _creditPaise},
      );
      if (mounted) setState(() => _quote = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) setState(() => _error = ApiClient.errorMessage(e, 'Could not get a quote'));
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  Future<void> _startPayment() async {
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      final res = await _api.dio.post(
        '/credits/topup/order',
        data: {'creditPaise': _creditPaise},
      );
      final order = (res.data as Map).cast<String, dynamic>();
      final options = {
        'key': order['keyId'],
        'amount': order['amountPaise'],
        'order_id': order['orderId'],
        'currency': 'INR',
        'name': order['orgName'] ?? 'Arthaleads',
        'description': 'WhatsApp credits top-up',
      };
      _razorpay.open(options);
    } catch (e) {
      setState(() {
        _paying = false;
        _error = ApiClient.errorMessage(e, 'Could not start payment');
      });
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse r) async {
    try {
      await _api.dio.post('/credits/topup/verify', data: {
        'razorpay_order_id': r.orderId,
        'razorpay_payment_id': r.paymentId,
        'razorpay_signature': r.signature,
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onSuccess();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Credits added')),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _paying = false;
          _error = ApiClient.errorMessage(e, 'Payment could not be verified');
        });
      }
    }
  }

  void _onPaymentError(PaymentFailureResponse r) {
    if (mounted) {
      setState(() {
        _paying = false;
        _error = r.message ?? 'Payment failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Add credits', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          TextField(
            controller: _amountCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount to add (₹)', prefixText: '₹ '),
            onChanged: (_) => _quoteAmount(),
          ),
          const SizedBox(height: 12),
          if (_quoting)
            const Padding(padding: EdgeInsets.all(8), child: AppSpinner(size: 20))
          else if (_quote != null) ...[
            _QuoteRow('Credits', _rupees(_quote!['creditPaise'])),
            _QuoteRow('GST (${_quote!['gstRate']}%)', _rupees(_quote!['gstPaise'])),
            const Divider(),
            _QuoteRow('You pay', _rupees(_quote!['amountPaise']), bold: true),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
            ),
          const SizedBox(height: 16),
          GradientButton(
            fullWidth: true,
            loading: _paying,
            onPressed: _quote == null || _paying ? null : _startPayment,
            child: Text('Pay ${_quote != null ? _rupees(_quote!['amountPaise']) : ''}'),
          ),
        ],
      ),
    );
  }
}

class _QuoteRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _QuoteRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.normal, fontSize: bold ? 15 : 13);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}
