import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'ticket_detail_screen.dart';

/// Help & Support — GET/POST /tickets. Mirrors frontend/src/pages/HelpSupport.jsx.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _tickets = [];
  bool _loading = true;

  static const _statusColors = {
    'open': AppColors.info,
    'in-progress': AppColors.warning,
    'resolved': AppColors.success,
    'closed': Color(0xFF6B7280),
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/tickets');
      setState(() => _tickets = (res.data['tickets'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load tickets')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openNewTicket() async {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String category = 'general';
    String priority = 'medium';

    final created = await showModalBottomSheet<bool>(
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
                Text('Raise a Ticket', style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 16),
                TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Describe your issue'),
                  maxLines: 4,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: const [
                    DropdownMenuItem(value: 'general', child: Text('General')),
                    DropdownMenuItem(value: 'technical', child: Text('Technical issue')),
                    DropdownMenuItem(value: 'billing', child: Text('Billing')),
                    DropdownMenuItem(value: 'bug', child: Text('Bug report')),
                    DropdownMenuItem(value: 'feature-request', child: Text('Feature request')),
                  ],
                  onChanged: (v) => setSheetState(() => category = v ?? 'general'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (v) => setSheetState(() => priority = v ?? 'medium'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () async {
                    if (subjectCtrl.text.trim().isEmpty || descCtrl.text.trim().isEmpty) return;
                    try {
                      await _api.dio.post('/tickets', data: {
                        'subject': subjectCtrl.text.trim(),
                        'description': descCtrl.text.trim(),
                        'category': category,
                        'priority': priority,
                      });
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Failed to raise ticket')),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: const Text('Submit'),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );

    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _openNewTicket,
        child: const Icon(Icons.add_rounded),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _tickets.isEmpty
              ? const Center(child: Text('No support tickets yet'))
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.only(bottom: 80, top: 8),
                    itemCount: _tickets.length,
                    itemBuilder: (context, i) {
                      final t = _tickets[i];
                      final color = _statusColors[t['status']] ?? const Color(0xFF6B7280);
                      final dt = DateTime.tryParse(t['createdAt'] as String? ?? '');
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        child: ListTile(
                          title: Text(t['subject'] as String? ?? '—',
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(dt == null ? '' : DateFormat('dd MMM yyyy').format(dt)),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: color.withValues(alpha: 0.35)),
                            ),
                            child: Text(t['status'] as String? ?? '',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                          ),
                          onTap: () async {
                            await Navigator.push(context,
                                MaterialPageRoute(builder: (_) => TicketDetailScreen(ticketId: t['_id'] as String)));
                            _load();
                          },
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
