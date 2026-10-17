import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/artha_features.dart';
import '../../core/theme.dart';
import 'change_card.dart';

/// Details the customer stated on WhatsApp (or on a Vistrow Voice call) that
/// differ from what the lead holds (lead.arthaSuggest.fields, filled by the
/// server's chat reader). Nothing changes until someone taps Save; Dismiss
/// stops that value coming back. Mirrors frontend/src/components/
/// ArthaSuggestCard.jsx and POST /copilot/suggestions/:leadId.
class ArthaSuggestCard extends StatefulWidget {
  final Map<String, dynamic> lead;

  /// After Save or Dismiss, with the server's updated lead when it sent one.
  final void Function(Map<String, dynamic>? updated)? onChanged;
  const ArthaSuggestCard({super.key, required this.lead, this.onChanged});

  @override
  State<ArthaSuggestCard> createState() => _ArthaSuggestCardState();
}

class _ArthaSuggestCardState extends State<ArthaSuggestCard> {
  static const _label = {
    'preferredLocation': 'Location',
    'bhk': 'BHK',
    'budget': 'Budget',
    'propertyType': 'Property type',
    'purpose': 'Purpose',
  };
  static const _order = ['preferredLocation', 'bhk', 'budget', 'propertyType', 'purpose'];

  bool _on = false;
  final Set<String> _handled = {};
  final Set<String> _picked = {..._order};
  String? _busy;

  @override
  void initState() {
    super.initState();
    ArthaFeatures.suggestions().then((on) {
      if (mounted) setState(() => _on = on);
    });
  }

  Map<String, dynamic> get _fields => ((widget.lead['arthaSuggest'] as Map?)?['fields'] as Map?)?.cast<String, dynamic>() ?? const {};

  List<String> get _keys => _order.where((k) => _fields[k] != null && !_handled.contains(k)).toList();

  static String _lakhs(num n) => n >= 1e7 ? '${_trim(n / 1e7, 2)} Cr' : '${_trim(n / 1e5, 1)} L';
  static String _trim(num v, int places) {
    final s = v.toStringAsFixed(places);
    return s.contains('.') ? s.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '') : s;
  }

  static String _show(String key, dynamic v) {
    if (key == 'budget') {
      if (v is! Map) return 'empty';
      final min = (v['min'] as num?) ?? 0, max = (v['max'] as num?) ?? 0;
      if (min == 0 && max == 0) return 'empty';
      return min > 0 && max > 0 && min != max ? '₹${_lakhs(min)} to ₹${_lakhs(max)}' : '₹${_lakhs(max > 0 ? max : min)}';
    }
    return v != null && '$v'.isNotEmpty && v != 'N/A' ? '$v' : 'empty';
  }

  Future<void> _act(String action) async {
    final chosen = action == 'save' ? _keys.where(_picked.contains).toList() : _keys;
    if (chosen.isEmpty || _busy != null) return;
    setState(() => _busy = action);
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      final res = await ApiClient.instance.dio.post('/copilot/suggestions/${widget.lead['_id']}', data: {'action': action, 'fields': chosen});
      setState(() => _handled.addAll(chosen));
      messenger?.showSnackBar(SnackBar(
        content: Text(action == 'save' ? 'Saved ${chosen.map((k) => _label[k]).join(', ')}' : 'Dismissed'),
      ));
      final data = res.data;
      final updated = data is Map ? (data['lead'] ?? data['data']) : null;
      widget.onChanged?.call(updated is Map ? updated.cast<String, dynamic>() : null);
      ArthaEvents.changed.value++;
    } catch (e) {
      messenger?.showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e, "Couldn't do that right now."))));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final keys = _keys;
    if (!_on || widget.lead['_id'] == null || widget.lead['_type'] == 'project' || keys.isEmpty) {
      return const SizedBox.shrink();
    }
    final t = AppTheme.of(context);
    final accent = t.isDark ? const Color(0xFFFF8A3D) : const Color(0xFFC2410C);
    final canSave = keys.any(_picked.contains);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: t.isDark ? 0.10 : 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Row(children: [
              Icon(Icons.auto_awesome_rounded, size: 15, color: accent),
              const SizedBox(width: 6),
              Text('Artha found in the WhatsApp chat', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: accent)),
            ]),
          ),
          const SizedBox(height: 4),
          for (final k in keys)
            InkWell(
              onTap: _busy != null ? null : () => setState(() => _picked.contains(k) ? _picked.remove(k) : _picked.add(k)),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 40),
                child: Row(children: [
                  SizedBox(
                    width: 32,
                    child: Checkbox(
                      value: _picked.contains(k),
                      activeColor: AppColors.primary,
                      onChanged: _busy != null ? null : (v) => setState(() => v == true ? _picked.add(k) : _picked.remove(k)),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${_label[k]}: ', style: TextStyle(color: t.textSoft)),
                        TextSpan(
                          text: _show(k, widget.lead[k]),
                          style: TextStyle(color: t.textSoft, decoration: TextDecoration.lineThrough, decorationColor: t.textSoft),
                        ),
                        TextSpan(text: '  →  ', style: TextStyle(color: t.textSoft)),
                        TextSpan(text: _show(k, _fields[k]), style: TextStyle(fontWeight: FontWeight.w700, color: t.text)),
                      ]),
                      style: const TextStyle(fontSize: 13, height: 1.4),
                    ),
                  ),
                ]),
              ),
            ),
          const SizedBox(height: 6),
          Row(children: [
            FilledButton.icon(
              onPressed: _busy != null || !canSave ? null : () => _act('save'),
              icon: const Icon(Icons.check_rounded, size: 16),
              label: Text(_busy == 'save' ? 'Saving…' : 'Save ${keys.where(_picked.contains).length}'),
              style: FilledButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 40),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: _busy != null ? null : () => _act('dismiss'),
              style: OutlinedButton.styleFrom(
                foregroundColor: t.textSoft,
                side: BorderSide(color: t.borderStrong),
                minimumSize: const Size(0, 40),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(_busy == 'dismiss' ? '…' : 'Dismiss'),
            ),
          ]),
        ],
      ),
    );
  }
}
