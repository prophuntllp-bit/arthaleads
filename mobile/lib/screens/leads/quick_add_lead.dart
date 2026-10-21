import 'dart:async';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/whatsapp_send_sheet.dart';

/// What the quick-add sheet ended with.
class QuickAddResult {
  /// "More details": open the full form with these filled in.
  final Map<String, dynamic>? moreDetails;

  /// A lead to open: the one just saved, or the existing duplicate.
  final String? openLeadId;

  /// A lead was saved (refresh the list).
  final bool saved;

  const QuickAddResult({this.moreDetails, this.openLeadId, this.saved = false});
}

/// New lead in a few seconds (21 Oct 2026): name, phone and source, saved
/// with POST /leads like the full form. While the number is typed it is
/// checked against existing leads (GET /leads/check-duplicate), and the
/// match can be opened instead. After saving: Call, WhatsApp or open the
/// lead to set a follow-up. "More details" hands over to the full form.
Future<QuickAddResult?> showQuickAddLead(BuildContext context) => showModalBottomSheet<QuickAddResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _QuickAddSheet(),
    );

/// The sources offered as one-tap chips; the rest are under "More".
const quickSources = ['Walk-in', 'Referral', 'Manual', 'WhatsApp', 'Website'];
const _lastSourceKey = 'quick_add_last_source';

class _QuickAddSheet extends StatefulWidget {
  const _QuickAddSheet();

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  String _source = 'Manual';
  bool _saving = false;
  String? _error;
  Map<String, dynamic>? _saved; // the lead, once saved

  Map<String, dynamic>? _duplicate;
  Timer? _dupTimer;
  String _dupFor = '';

  @override
  void initState() {
    super.initState();
    _phone.addListener(_onPhone);
    SharedPreferences.getInstance().then((p) {
      final last = p.getString(_lastSourceKey);
      if (mounted && last != null && sourceOptions.contains(last)) setState(() => _source = last);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _dupTimer?.cancel();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  /// Same rule as the full form: once 10 digits are in, look for a lead with
  /// that number. A warning only; a repeat enquiry can still be saved.
  void _onPhone() {
    final phone = _phone.text.trim();
    if (phone == _dupFor) return;
    _dupFor = phone;
    _dupTimer?.cancel();
    if (phone.replaceAll(RegExp(r'\D'), '').length < 10) {
      if (_duplicate != null) setState(() => _duplicate = null);
      return;
    }
    _dupTimer = Timer(const Duration(milliseconds: 500), () async {
      try {
        final res = await ApiClient.instance.dio.get('/leads/check-duplicate', queryParameters: {'phone': phone});
        if (!mounted || _phone.text.trim() != phone) return;
        setState(() => _duplicate = (res.data['duplicate'] as Map?)?.cast<String, dynamic>());
      } catch (_) {
        // A Growth feature on the server; without it there is simply no warning.
      }
    });
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    if (name.isEmpty || phone.isEmpty) {
      setState(() => _error = name.isEmpty ? 'Enter a name' : 'Enter a phone number');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.dio.post('/leads', data: {
        'name': name,
        'phone': phone,
        'source': _source,
        'status': 'New',
        'priority': 'Medium',
        'whatsappConsent': {'status': 'unknown'},
      });
      try {
        (await SharedPreferences.getInstance()).setString(_lastSourceKey, _source);
      } catch (_) {}
      final lead = (res.data['data'] as Map?)?.cast<String, dynamic>() ?? {'name': name, 'phone': phone};
      if (mounted) setState(() => _saved = lead);
    } catch (e) {
      if (mounted) setState(() => _error = ApiClient.errorMessage(e, "Couldn't save the lead. Try again."));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickOtherSource() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.62),
        child: SafeArea(
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(vertical: 12), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text('Source', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.of(ctx).text)),
            ),
            for (final s in sourceOptions)
              ListTile(title: Text(s), selected: s == _source, onTap: () => Navigator.pop(ctx, s)),
          ]),
        ),
      ),
    );
    if (picked != null) setState(() => _source = picked);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: _saved != null ? _done(t, _saved!) : _form(t),
        ),
      ),
    );
  }

  Widget _form(AppTheme t) {
    final chips = {...quickSources, if (!quickSources.contains(_source)) _source};
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text('New lead', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.text)),
      const SizedBox(height: 2),
      Text('Name and number now; add the rest any time.', style: TextStyle(fontSize: 12.5, color: t.textSoft)),
      const SizedBox(height: 16),
      LabeledField(
        label: 'Name',
        child: TextField(
          controller: _name,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(hintText: 'Rahul Sharma'),
          onChanged: (_) => _error == null ? null : setState(() => _error = null),
        ),
      ),
      const SizedBox(height: 12),
      LabeledField(
        label: 'Phone',
        child: TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(hintText: '98200 12345'),
          onChanged: (_) => _error == null ? null : setState(() => _error = null),
          onSubmitted: (_) => _save(),
        ),
      ),
      if (_duplicate != null) _duplicateCard(t, _duplicate!),
      const SizedBox(height: 14),
      Text('Source', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: t.text)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final s in chips)
          ChoiceChip(
            label: Text(s),
            selected: _source == s,
            showCheckmark: false,
            onSelected: (_) => setState(() => _source = s),
          ),
        ActionChip(
          avatar: const Icon(Icons.expand_more_rounded, size: 18),
          label: const Text('More'),
          onPressed: _pickOtherSource,
        ),
      ]),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.danger)),
        ),
      const SizedBox(height: 18),
      GradientButton(
        fullWidth: true,
        loading: _saving,
        onPressed: _saving ? null : _save,
        child: Text(_duplicate != null ? 'Save anyway' : 'Save lead'),
      ),
      const SizedBox(height: 6),
      Center(
        child: TextButton.icon(
          onPressed: _saving
              ? null
              : () => Navigator.pop(
                    context,
                    QuickAddResult(moreDetails: {'name': _name.text.trim(), 'phone': _phone.text.trim(), 'source': _source}),
                  ),
          icon: const Icon(Icons.tune_rounded, size: 18),
          label: const Text('More details (budget, BHK, project, notes)'),
        ),
      ),
    ]);
  }

  Widget _duplicateCard(AppTheme t, Map<String, dynamic> d) {
    const ink = Color(0xFFC2410C);
    final added = DateTime.tryParse('${d['createdAt'] ?? ''}');
    final line = [
      if ('${d['status'] ?? ''}'.isNotEmpty) '${d['status']}',
      if ('${d['assignedToName'] ?? ''}'.isNotEmpty) '${d['assignedToName']}' else 'Unassigned',
      if (added != null) 'added ${DateFormat('d MMM yyyy').format(added.toLocal())}',
    ].join(' · ');
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(children: [
        const Icon(Icons.person_search_rounded, size: 20, color: ink),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(
              TextSpan(children: [
                const TextSpan(text: 'Already a lead: '),
                TextSpan(text: '${d['name'] ?? 'Unnamed'}', style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
              style: const TextStyle(fontSize: 13, color: ink),
            ),
            Text(line, style: const TextStyle(fontSize: 12, color: ink)),
          ]),
        ),
        if (d['_id'] != null)
          TextButton(
            onPressed: () => Navigator.pop(context, QuickAddResult(openLeadId: '${d['_id']}')),
            child: const Text('Open'),
          ),
      ]),
    );
  }

  /// Saved: the first contact is one tap away.
  Widget _done(AppTheme t, Map<String, dynamic> lead) {
    final id = '${lead['_id'] ?? ''}';
    final phone = '${lead['phone'] ?? ''}';
    final name = '${lead['name'] ?? ''}';
    Widget action(IconData icon, String label, Color color, VoidCallback onTap) => Expanded(
          child: OutlinedButton(
            onPressed: onTap,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 64),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              side: BorderSide(color: t.border),
              foregroundColor: t.text,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
            ]),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 26),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Lead added', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.text)),
            Text('$name · $phone', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: t.textSoft)),
          ]),
        ),
      ]),
      const SizedBox(height: 16),
      Text('Reach them now', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.textSoft)),
      const SizedBox(height: 8),
      Row(children: [
        action(Icons.call_rounded, 'Call', AppColors.success, () => launchUrl(Uri.parse('tel:$phone'))),
        const SizedBox(width: 8),
        action(FontAwesomeIcons.whatsapp.data, 'WhatsApp', AppColors.whatsapp,
            () => showWhatsAppSendSheet(context, phone: phone, name: name, leadId: id.isEmpty ? null : id)),
        const SizedBox(width: 8),
        action(Icons.event_repeat_rounded, 'Follow-up', AppColors.primary,
            () => Navigator.pop(context, QuickAddResult(saved: true, openLeadId: id.isEmpty ? null : id))),
      ]),
      const SizedBox(height: 14),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: () => Navigator.pop(context, const QuickAddResult(saved: true)),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
          child: const Text('Done'),
        ),
      ),
    ]);
  }
}
