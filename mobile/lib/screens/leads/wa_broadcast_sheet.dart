import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';

const _waGreen = Color(0xFF25D366);

String _toWaNumber(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 10) return '91$digits';
  if (digits.length == 11 && digits.startsWith('0')) return '91${digits.substring(1)}';
  return digits;
}

String _interpolate(String template, Map<String, dynamic> lead) {
  return template
      .replaceAllMapped(RegExp('{name}', caseSensitive: false), (_) => lead['name'] as String? ?? '')
      .replaceAllMapped(RegExp('{phone}', caseSensitive: false), (_) => lead['phone'] as String? ?? '')
      .replaceAllMapped(
        RegExp('{project}', caseSensitive: false),
        (_) => (lead['projectName'] as String?) ?? (lead['project'] as String?) ?? '',
      );
}

/// Ports Leads.jsx's `WaBroadcastModal` — a 3-step (compose → running → done)
/// bulk-WhatsApp flow. Each step opens the device's WhatsApp via `wa.me` (no
/// server-side sending API exists — this is manual dispatch with progress
/// tracking, same as web), then the user marks Sent/Skip to advance.
Future<void> showWaBroadcastSheet(BuildContext context, List<Map<String, dynamic>> leads) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _WaBroadcastSheet(leads: leads),
  );
}

class _WaBroadcastSheet extends StatefulWidget {
  final List<Map<String, dynamic>> leads;
  const _WaBroadcastSheet({required this.leads});

  @override
  State<_WaBroadcastSheet> createState() => _WaBroadcastSheetState();
}

class _WaBroadcastSheetState extends State<_WaBroadcastSheet> {
  final _msgCtrl = TextEditingController(text: 'Hi {name}, ');
  String _step = 'compose';
  int _idx = 0;
  int _skipped = 0;

  int get _total => widget.leads.length;
  Map<String, dynamic> get _current => widget.leads[_idx];

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _openWhatsApp() async {
    final url = Uri.parse(
      'https://wa.me/${_toWaNumber(_current['phone'] as String? ?? '')}'
      '?text=${Uri.encodeComponent(_interpolate(_msgCtrl.text, _current))}',
    );
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  void _advance(bool wasSkipped) {
    final nextIdx = _idx + 1;
    setState(() {
      if (wasSkipped) _skipped++;
      if (nextIdx >= _total) {
        _step = 'done';
      } else {
        _idx = nextIdx;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: switch (_step) {
            'running' => _runningStep(),
            'done' => _doneStep(),
            _ => _composeStep(),
          },
        ),
      ),
    );
  }

  Widget _composeStep() {
    final t = AppTheme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('WHATSAPP BROADCAST',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _waGreen)),
                  const SizedBox(height: 2),
                  Text('$_total lead${_total != 1 ? 's' : ''} selected',
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
          ],
        ),
        const SizedBox(height: 14),
        Text('MESSAGE TEMPLATE', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.textSoft)),
        const SizedBox(height: 6),
        TextField(
          controller: _msgCtrl,
          maxLines: 5,
          autofocus: true,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(hintText: 'Hi {name}, we have an exciting property update for you…'),
        ),
        const SizedBox(height: 6),
        Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 11, color: t.textSoft),
            children: [
              const TextSpan(text: 'Variables: '),
              TextSpan(text: '{name}  {project}', style: TextStyle(fontFamily: 'monospace', color: t.text)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _waGreen.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _waGreen.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('PREVIEW — ${widget.leads.first['name'] ?? ''}',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _waGreen, letterSpacing: 0.5)),
              const SizedBox(height: 6),
              Text(
                _msgCtrl.text.trim().isEmpty ? 'Type a message above…' : _interpolate(_msgCtrl.text, widget.leads.first),
                style: TextStyle(
                  fontSize: 13.5,
                  fontStyle: _msgCtrl.text.trim().isEmpty ? FontStyle.italic : FontStyle.normal,
                  color: _msgCtrl.text.trim().isEmpty ? t.textSoft : null,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: _waGreen, padding: const EdgeInsets.symmetric(vertical: 14)),
            onPressed: _msgCtrl.text.trim().isEmpty ? null : () => setState(() => _step = 'running'),
            icon: const Icon(Icons.send, size: 18),
            label: const Text('Start Broadcast', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  Widget _runningStep() {
    final t = AppTheme.of(context);
    final progress = _idx / _total;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('BROADCASTING…',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: _waGreen)),
                  const SizedBox(height: 2),
                  Text('${_idx + 1} of $_total', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
          ],
        ),
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(value: progress, minHeight: 6, color: _waGreen, backgroundColor: t.surfaceLow),
        ),
        const SizedBox(height: 14),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(16), border: Border.all(color: t.border)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_current['name'] as String? ?? '—', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
              const SizedBox(height: 2),
              Text(_current['phone'] as String? ?? '', style: TextStyle(fontSize: 13, color: t.textSoft)),
              if ((_current['status'] as String? ?? '').isNotEmpty)
                Text('Status: ${_current['status']}', style: TextStyle(fontSize: 11, color: t.textSoft)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _waGreen.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _waGreen.withValues(alpha: 0.2)),
          ),
          child: Text(_interpolate(_msgCtrl.text, _current), style: const TextStyle(fontSize: 13.5)),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: _waGreen, padding: const EdgeInsets.symmetric(vertical: 14)),
            onPressed: _openWhatsApp,
            icon: const Icon(Icons.chat, size: 18),
            label: const Text('Open WhatsApp', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _advance(true),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                child: const Text('Skip'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: () => _advance(false),
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                child: const Text('Sent ✓  Next →', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _doneStep() {
    final t = AppTheme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: _waGreen.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _waGreen.withValues(alpha: 0.25)),
          ),
          child: const Icon(Icons.check, color: _waGreen, size: 28),
        ),
        const SizedBox(height: 14),
        const Text('Broadcast Complete', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 13, color: t.textSoft),
            children: [
              TextSpan(text: '${_total - _skipped}', style: const TextStyle(fontWeight: FontWeight.w800)),
              const TextSpan(text: ' sent  ·  '),
              TextSpan(text: '$_skipped', style: const TextStyle(fontWeight: FontWeight.w800)),
              const TextSpan(text: ' skipped'),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
            onPressed: () => Navigator.pop(context),
            child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}
