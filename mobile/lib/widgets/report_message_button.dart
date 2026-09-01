import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/theme.dart';

/// Flags something the assistant said, without leaving the app.
///
/// Google Play's AI-Generated Content policy requires this on any app showing
/// AI-generated output, and requires it to work in-app — a mailto: or a link to
/// a support page does not satisfy it.
///
/// Mirrors frontend/src/components/ReportMessageButton.jsx. Sits quiet until
/// used: it has to appear on every answer to meet the policy, and an alarming
/// control on every message would read as though we expect the assistant to
/// misbehave.
class ReportMessageButton extends StatefulWidget {
  final String reportedText;
  final String prompt;
  final String page;

  const ReportMessageButton({
    super.key,
    required this.reportedText,
    this.prompt = '',
    this.page = '',
  });

  @override
  State<ReportMessageButton> createState() => _ReportMessageButtonState();
}

class _ReportMessageButtonState extends State<ReportMessageButton> {
  static const _reasons = <String, String>{
    'offensive': 'Offensive',
    'inaccurate': 'Wrong or misleading',
    'harmful': 'Harmful advice',
    'privacy': 'Exposed private data',
    'other': 'Something else',
  };

  bool _sent = false;

  Future<void> _openSheet() async {
    var reason = 'offensive';
    final detail = TextEditingController();
    var sending = false;
    String? error;

    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          left: 20, right: 20, top: 20,
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
        ),
        child: StatefulBuilder(
          builder: (sheetContext, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("What's wrong with this response?",
                  style: Theme.of(sheetContext).textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _reasons.entries.map((e) {
                  final selected = reason == e.key;
                  return ChoiceChip(
                    label: Text(e.value, style: const TextStyle(fontSize: 12)),
                    selected: selected,
                    onSelected: (_) => setSheetState(() => reason = e.key),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: detail,
                maxLines: 3,
                maxLength: 1000,
                decoration: const InputDecoration(
                  hintText: 'Anything else we should know? (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 4),
                Text(error!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
              ],
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: sending ? null : () => Navigator.pop(sheetContext, false),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: sending
                        ? null
                        : () async {
                            setSheetState(() { sending = true; error = null; });
                            try {
                              await ApiClient.instance.dio.post('/help/report', data: {
                                'reportedText': widget.reportedText,
                                'prompt': widget.prompt,
                                'page': widget.page,
                                'surface': 'mobile',
                                'reason': reason,
                                'detail': detail.text.trim(),
                              });
                              if (sheetContext.mounted) Navigator.pop(sheetContext, true);
                            } catch (e) {
                              setSheetState(() {
                                sending = false;
                                error = ApiClient.errorMessage(e, "Couldn't send that. Please try again.");
                              });
                            }
                          },
                    child: sending
                        ? const SizedBox(
                            width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Send report'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (sent == true && mounted) setState(() => _sent = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_rounded, size: 12, color: Theme.of(context).hintColor),
            const SizedBox(width: 4),
            Text("Thanks — we'll review this.",
                style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
          ],
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _openSheet,
        icon: const Icon(Icons.flag_outlined, size: 12),
        label: const Text('Report', style: TextStyle(fontSize: 11)),
        style: TextButton.styleFrom(
          visualDensity: VisualDensity.compact,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
          foregroundColor: Theme.of(context).hintColor,
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
