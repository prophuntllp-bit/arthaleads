import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';

/// Manage storage: what is using the company's file space, freeing some up,
/// and buying more. Mirrors frontend/src/components/StorageManageModal.jsx.
/// Everything comes from /api/storage; prices and GST are the server's, so
/// the number on screen is the number charged.
class StorageManageScreen extends StatefulWidget {
  final VoidCallback? onComparePlans;
  const StorageManageScreen({super.key, this.onComparePlans});

  @override
  State<StorageManageScreen> createState() => _StorageManageScreenState();
}

const _categoryLabel = {
  'project_media': 'Project photos, brochures and videos',
  'recordings': 'Call recordings',
  'attendance': 'Attendance photos',
  'logo': 'Logo',
  'other': 'Other files',
};
const _ageChoices = [30, 90, 180, 365];
const _terms = {1: '1 month', 3: '3 months', 12: '12 months'};

String _rupees(num? paise) => '₹${NumberFormat('#,##,##0.##', 'en_IN').format((paise ?? 0) / 100)}';

class _StorageManageScreenState extends State<StorageManageScreen> {
  final _api = ApiClient.instance;
  late final Razorpay _razorpay;
  Map<String, dynamic>? _ov;
  Map<String, dynamic>? _quote;
  int _packs = 1;
  int _months = 12;
  bool _busy = false;
  int _quoteSeq = 0;
  // Freeing up: which category and age, the preview, and whether it's running.
  String? _cleanCat;
  int? _cleanDays;
  Map<String, dynamic>? _cleanPreview;
  bool _cleaning = false;
  bool _showProjects = false;
  List<Map<String, dynamic>>? _projects;
  String? _confirmFile;

  bool get _isAdmin => context.read<AuthState>().role == 'admin';

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaid)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPayError);
    _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _isAdmin) _loadQuote();
    });
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _snack(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? AppColors.danger : null));
  }

  Future<void> _load() async {
    try {
      final r = await _api.dio.get('/storage/overview');
      _ov = (r.data as Map).cast<String, dynamic>();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not load your storage.'), error: true);
    }
    if (mounted) setState(() {});
  }

  Future<void> _loadQuote() async {
    final seq = ++_quoteSeq;
    try {
      final r = await _api.dio.get('/storage/quote', queryParameters: {'packs': _packs, 'months': _months});
      if (seq == _quoteSeq && mounted) setState(() => _quote = (r.data as Map).cast<String, dynamic>());
    } catch (_) {
      if (seq == _quoteSeq && mounted) setState(() => _quote = null);
    }
  }

  Future<void> _pickClean(String cat, int days) async {
    setState(() {
      _cleanCat = cat;
      _cleanDays = days;
      _cleanPreview = null;
    });
    try {
      final r = await _api.dio.post('/storage/free-up/preview', data: {'category': cat, 'olderThanDays': days});
      if (mounted && _cleanCat == cat && _cleanDays == days) setState(() => _cleanPreview = (r.data as Map).cast<String, dynamic>());
    } catch (_) {
      if (mounted) setState(() => _cleanCat = null);
    }
  }

  Future<void> _confirmClean() async {
    if ((_cleanPreview?['files'] ?? 0) == 0) return;
    setState(() => _cleaning = true);
    try {
      final r = await _api.dio.post('/storage/free-up', data: {'category': _cleanCat, 'olderThanDays': _cleanDays});
      final files = ((r.data['files'] as num?) ?? 0).toInt();
      final failed = ((r.data['failed'] as num?) ?? 0).toInt();
      if (failed > 0) _snack('$failed file${failed == 1 ? '' : 's'} could not be deleted. Try again in a moment.', error: true);
      if (files > 0 || failed == 0) _snack('Freed ${formatBytes((r.data['bytes'] as num?) ?? 0)} ($files file${files == 1 ? '' : 's'}).');
      setState(() => _cleanCat = null);
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not free up space.'), error: true);
    } finally {
      if (mounted) setState(() => _cleaning = false);
    }
  }

  Future<void> _loadProjects() async {
    try {
      final r = await _api.dio.get('/storage/project-files');
      _projects = [for (final p in (r.data['projects'] as List?) ?? const []) (p as Map).cast<String, dynamic>()];
    } catch (_) {
      _projects = [];
    }
    if (mounted) setState(() {});
  }

  Future<void> _removeFile(Map<String, dynamic> p, Map f) async {
    try {
      await _api.dio.delete('/storage/project-files', data: {'projectId': p['_id'], 'kind': f['kind'], 'url': f['url']});
      _snack('${f['label']} removed from ${p['name']}.');
      _confirmFile = null;
      _loadProjects();
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not remove it.'), error: true);
    }
  }

  Future<void> _pay() async {
    if (_busy || _quote == null) return;
    setState(() => _busy = true);
    final orgName = '${context.read<AuthState>().org?['name'] ?? ''}';
    try {
      final r = await _api.dio.post('/storage/order', data: {'packs': _packs, 'months': _months});
      final d = (r.data as Map).cast<String, dynamic>();
      _razorpay.open({
        'key': d['keyId'],
        'order_id': d['orderId'],
        'amount': d['amountPaise'],
        'currency': 'INR',
        'name': 'Arthaleads',
        'description': '${d['gb']} GB extra storage, ${_terms[_months] ?? '$_months months'}',
        'prefill': {'name': orgName.isNotEmpty ? orgName : '${d['orgName'] ?? ''}'},
        'theme': {'color': '#FF6B00'},
      });
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not start checkout.'), error: true);
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onPaid(PaymentSuccessResponse r) async {
    try {
      await _api.dio.post('/storage/verify', data: {
        'razorpay_order_id': r.orderId,
        'razorpay_payment_id': r.paymentId,
        'razorpay_signature': r.signature,
      });
      _snack('${_quote?['gb'] ?? ''} GB added to your storage.');
    } catch (_) {
      // The webhook is authoritative; this is only a reporting problem.
      _snack('Payment received. Your space will appear shortly.');
    } finally {
      if (mounted) setState(() => _busy = false);
      _load();
    }
  }

  void _onPayError(PaymentFailureResponse r) {
    _snack(r.message ?? 'Payment failed. You have not been charged.', error: true);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final ov = _ov;
    return Scaffold(
      appBar: AppBar(title: const Text('Manage storage')),
      body: ov == null
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                _meter(ov),
                const SizedBox(height: 14),
                _usage(ov),
                const SizedBox(height: 14),
                if (_isAdmin)
                  _buyMore(ov)
                else
                  Text('Ask your admin to free up or add more space.',
                      style: TextStyle(fontSize: 13, color: AppTheme.of(context).textSoft)),
              ]),
            ),
    );
  }

  Widget _meter(Map<String, dynamic> ov) {
    final t = AppTheme.of(context);
    final pct = (((ov['percent'] as num?) ?? 0).toDouble()).clamp(0, 100).round();
    final full = ov['full'] == true;
    final color = full ? AppColors.danger : (ov['warn'] == true ? const Color(0xFFF59E0B) : AppColors.primary);
    num n(String k) => (ov[k] as num?) ?? 0;
    return PanelCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(formatBytes(n('usedBytes')), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: t.text)),
          Text('  of ${formatBytes(n('limitBytes'))}', style: TextStyle(fontSize: 13, color: t.textSoft)),
          const Spacer(),
          Text('$pct%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.text)),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(value: pct / 100, minHeight: 9, color: color, backgroundColor: t.border),
        ),
        const SizedBox(height: 8),
        Text(
          [
            '${formatBytes(n('baseBytes'))} from your ${ov['plan'] ?? ''} plan',
            if (n('extraBytes') > 0) ' + ${formatBytes(n('extraBytes'))} granted',
            if (n('packBytes') > 0) ' + ${formatBytes(n('packBytes'))} you added',
            '.',
            if (full) ' Uploads are paused until you free some space or add more.',
          ].join(),
          style: TextStyle(fontSize: 12, color: t.textSoft),
        ),
      ]),
    );
  }

  Widget _usage(Map<String, dynamic> ov) {
    final t = AppTheme.of(context);
    final used = (((ov['usedBytes'] as num?) ?? 1).toDouble()).clamp(1, double.infinity);
    final cats = [
      for (final e in ((ov['byCategory'] as Map?) ?? {}).entries)
        if (((e.value as Map)['bytes'] as num? ?? 0) > 0) MapEntry('${e.key}', (e.value as Map).cast<String, dynamic>()),
    ]..sort((a, b) => ((b.value['bytes'] as num)).compareTo(a.value['bytes'] as num));
    return PanelCard(
      title: 'What is using your space',
      child: cats.isEmpty
          ? Text('Nothing stored yet.', style: TextStyle(fontSize: 13, color: t.textSoft))
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final c in cats) ...[
                _category(ov, c.key, c.value, used.toDouble()),
                const SizedBox(height: 14),
              ],
            ]),
    );
  }

  Widget _category(Map<String, dynamic> ov, String key, Map<String, dynamic> v, double used) {
    final t = AppTheme.of(context);
    final files = ((v['files'] as num?) ?? 0).toInt();
    final bytes = ((v['bytes'] as num?) ?? 0).toDouble();
    final canClear = _isAdmin && (key == 'recordings' || key == 'attendance');
    final active = _cleanCat == key;
    final preview = active ? _cleanPreview : null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: Text.rich(TextSpan(style: TextStyle(fontSize: 13, color: t.text), children: [
            TextSpan(text: _categoryLabel[key] ?? key),
            TextSpan(text: ' · $files file${files == 1 ? '' : 's'}', style: TextStyle(color: t.textSoft)),
          ])),
        ),
        Text(formatBytes(bytes), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.text)),
      ]),
      const SizedBox(height: 4),
      ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(
          value: (bytes / used).clamp(0.02, 1.0),
          minHeight: 5,
          color: AppColors.primary.withValues(alpha: 0.75),
          backgroundColor: t.border,
        ),
      ),
      if (key == 'project_media')
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () {
              setState(() => _showProjects = !_showProjects);
              if (_showProjects && _projects == null) _loadProjects();
            },
            child: Text(_showProjects ? 'Hide project files' : 'Review and delete project files'),
          ),
        ),
      if (key == 'project_media' && _showProjects) _projectFiles(),
      if (key == 'recordings')
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text('Recordings are removed on their own after ${ov['recordingDays'] ?? ''} days on your plan.',
              style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        ),
      if (canClear) ...[
        const SizedBox(height: 6),
        Text('Delete ones older than', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        const SizedBox(height: 4),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final d in _ageChoices)
            ChoiceChip(
              label: Text('$d days'),
              selected: active && _cleanDays == d,
              onSelected: (_) => _pickClean(key, d),
            ),
        ]),
      ],
      if (active) ...[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.danger.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
          ),
          child: preview == null
              ? Text('Checking…', style: TextStyle(fontSize: 12, color: t.textSoft))
              : ((preview['files'] as num?) ?? 0) == 0
                  ? Text('Nothing is older than $_cleanDays days.', style: TextStyle(fontSize: 12, color: t.textSoft))
                  : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(
                        'Delete ${preview['files']} file${preview['files'] == 1 ? '' : 's'} (${formatBytes((preview['bytes'] as num?) ?? 0)})? '
                        '${key == 'recordings' ? 'The call, notes and summary stay; only the audio goes.' : 'The attendance records stay; only the photos go.'} '
                        "This can't be undone.",
                        style: TextStyle(fontSize: 12.5, color: t.text),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                          onPressed: _cleaning ? null : _confirmClean,
                          icon: const Icon(Icons.delete_outline_rounded, size: 18),
                          label: Text(_cleaning ? 'Deleting…' : 'Delete'),
                        ),
                      ),
                    ]),
        ),
      ],
    ]);
  }

  Widget _projectFiles() {
    final t = AppTheme.of(context);
    final projects = _projects;
    if (projects == null) return const Padding(padding: EdgeInsets.all(8), child: AppSpinner(size: 18));
    if (projects.isEmpty) return Text('No project files.', style: TextStyle(fontSize: 12, color: t.textSoft));
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: t.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final p in projects) ...[
          Row(children: [
            Expanded(child: Text('${p['name']}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: t.text))),
            Text(formatBytes((p['bytes'] as num?) ?? 0), style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          ]),
          for (final f in (p['files'] as List?) ?? const [])
            if (f is Map)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: f['kind'] == 'image'
                          ? Image.network('${f['url']}', fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: t.surfaceLow))
                          : Container(
                              color: t.surfaceLow,
                              alignment: Alignment.center,
                              child: Text(f['kind'] == 'video' ? 'VID' : 'PDF',
                                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: t.textSoft)),
                            ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text('${f['label']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: t.text))),
                  Text(formatBytes((f['bytes'] as num?) ?? 0), style: TextStyle(fontSize: 11, color: t.textSoft)),
                  if (_confirmFile == '${p['_id']}|${f['url']}') ...[
                    TextButton(
                      onPressed: () => _removeFile(p, f),
                      child: const Text('Delete', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w800)),
                    ),
                    TextButton(onPressed: () => setState(() => _confirmFile = null), child: const Text('Cancel')),
                  ] else
                    IconButton(
                      tooltip: 'Delete ${f['label']}',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => setState(() => _confirmFile = '${p['_id']}|${f['url']}'),
                      icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    ),
                ]),
              ),
          const SizedBox(height: 8),
        ],
        Text("Deleted files can't be brought back. The AI agent and project page stop showing them.",
            style: TextStyle(fontSize: 11, color: t.textSoft)),
      ]),
    );
  }

  Widget _buyMore(Map<String, dynamic> ov) {
    final t = AppTheme.of(context);
    final addon = ((ov['addon'] as Map?) ?? {}).cast<String, dynamic>();
    final gb = ((addon['gb'] as num?) ?? 0).toInt();
    final maxPacks = ((addon['maxPacks'] as num?) ?? 50).toInt();
    final months = [for (final m in (addon['months'] as List?) ?? const [1, 3, 12]) (m as num).toInt()];
    final q = _quote;
    final paymentsOk = ov['paymentsConfigured'] != false;
    final packs = [for (final p in (ov['activePacks'] as List?) ?? const []) if (p is Map) p];
    final next = upgradeTarget(context.read<AuthState>().org?['plan'] as String?);
    return PanelCard(
      title: 'Add more space',
      subtitle: '$gb GB for ${_rupees(((addon['pricePerMonth'] as num?) ?? 0) * 100)} a month, plus GST. Added to your plan\'s space straight away.',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          IconButton(
            tooltip: 'Fewer',
            onPressed: _packs <= 1
                ? null
                : () {
                    setState(() => _packs--);
                    _loadQuote();
                  },
            icon: const Icon(Icons.remove_circle_outline_rounded),
          ),
          SizedBox(
            width: 72,
            child: Text('${_packs * gb} GB',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
          ),
          IconButton(
            tooltip: 'More',
            onPressed: _packs >= maxPacks
                ? null
                : () {
                    setState(() => _packs++);
                    _loadQuote();
                  },
            icon: const Icon(Icons.add_circle_outline_rounded),
          ),
        ]),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final m in months)
            ChoiceChip(
              label: Text(_terms[m] ?? '$m months'),
              selected: _months == m,
              onSelected: (_) {
                setState(() => _months = m);
                _loadQuote();
              },
            ),
        ]),
        if (q != null) ...[
          const SizedBox(height: 10),
          KeyValueList([
            ('${q['gb']} GB for ${_terms[q['months']] ?? ''}', _rupees(q['basePaise'] as num?)),
            ('GST (${q['gstRate']}%)', _rupees(q['gstPaise'] as num?)),
            ('You pay', _rupees(q['amountPaise'] as num?)),
          ]),
        ],
        const SizedBox(height: 10),
        GradientButton(
          fullWidth: true,
          loading: _busy,
          onPressed: _busy || q == null || !paymentsOk ? null : _pay,
          child: Text(_busy ? 'Opening payment…' : (q != null ? 'Pay ${_rupees(q['amountPaise'] as num?)}' : 'Choose an amount')),
        ),
        if (!paymentsOk)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text('Online payment is not set up yet. Write to contact@arthaleads.com.',
                style: TextStyle(fontSize: 12, color: AppColors.danger)),
          ),
        if (packs.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final p in packs)
            Text('${p['gb']} GB added, valid until ${DateFormat('d MMM y').format((DateTime.tryParse('${p['expiresAt']}') ?? DateTime.now()).toUtc().add(const Duration(hours: 5, minutes: 30)))}',
                style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          Text("When a block ends your files stay; you just can't upload more once you are over the limit.",
              style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        ],
        if (next != null && widget.onComparePlans != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(onPressed: widget.onComparePlans, child: const Text('Need a lot more, or other features too? Compare plans')),
          ),
        Row(children: [
          const Icon(Icons.verified_user_rounded, size: 15, color: AppColors.success),
          const SizedBox(width: 6),
          Expanded(
            child: Text('Secure checkout by Razorpay. UPI, cards and net banking.', style: TextStyle(fontSize: 11, color: t.textSoft)),
          ),
        ]),
      ]),
    );
  }
}
