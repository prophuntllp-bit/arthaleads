import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'ticket_detail_screen.dart';

const _maxAttachBytes = 600 * 1024;
const _maxAttachments = 3;

const _guideModules = [
  (
    'Understanding the Dashboard', Icons.bar_chart, Color(0xFF6366F1),
    'See real-time lead counts, source breakdowns, and team performance at a glance.',
    [
      'The top row shows live source counters — Facebook, Google, and WhatsApp leads since the date range you set.',
      'Use the date range picker to switch between today, last 7 days, last 30 days, or a custom window.',
      'The Leads by Status bar chart shows where your pipeline is stacked.',
      'The Leads by Source chart shows your acquisition mix.',
      'Top Agents leaderboard updates live.',
    ],
  ),
  (
    'Managing Leads', Icons.location_on_outlined, Color(0xFFF97316),
    'Add, import, filter, assign, and update every lead from one central screen.',
    [
      'Tap + (top right) to manually enter name, phone, source, and status.',
      'To import in bulk, use Import CSV — Name, Phone, Email, Source, Status columns.',
      'Use the filter bar to narrow by status, source, date range, assigned agent, or project.',
      'Tap any lead to open the detail panel — update status, add remarks, attach files, or schedule a follow-up.',
      'Export filtered leads as CSV using the Export button.',
    ],
  ),
  (
    'Sales Pipeline', Icons.account_tree_outlined, Color(0xFF8B5CF6),
    'Visualise every deal stage on a Kanban-style board.',
    [
      'Open Pipeline from the menu. Each column is a stage: New, Contacted, Site Visit, Negotiation, Converted, Lost.',
      'Move a lead between stages — the status updates instantly and syncs with the Leads list.',
      'Tap any card to open the full lead detail without leaving the pipeline view.',
      'Cards show the assigned agent and how long a deal has sat in its current stage.',
    ],
  ),
  (
    'Team Management', Icons.people_outline, Color(0xFF22C55E),
    'Invite agents, set roles, and control who can see and do what.',
    [
      'Go to Team. Tap Add Team Member and enter name, email, and role (Agent, Manager, or Admin).',
      'The new member receives their login credentials by email.',
      'Agents only see their own assigned leads. Managers see all leads and reports. Admins have full access.',
      'To remove a member, open their profile and tap Remove — their leads are unassigned automatically.',
    ],
  ),
  (
    'Automation & Integrations', Icons.bolt_outlined, Color(0xFFF59E0B),
    'Connect Facebook Lead Ads and other channels so every lead flows in automatically.',
    [
      'Go to Automation. Tap Connect Facebook and approve the popup to log in.',
      'Select the Facebook Page and the specific Lead Ad Form you want to capture.',
      'Leads from that form appear in Leads within seconds of submission.',
      'Each connection shows its status (Active / Disconnected) — reconnect if a token expires.',
    ],
  ),
  (
    'Follow-ups & Reminders', Icons.notifications_outlined, Color(0xFF06B6D4),
    'Schedule calls, site visits, and meetings so no prospect is ever forgotten.',
    [
      'Open any lead detail and tap Add Follow-up. Set type (Call, Site Visit, Meeting), date, and time.',
      'The Follow-ups screen shows all upcoming and overdue follow-ups for your team.',
      'Overdue and today\'s follow-ups also appear as a warning on the Dashboard.',
      'Mark a follow-up Done from the list or from inside the lead detail.',
    ],
  ),
];

const _faqs = [
  ('How do I add a new team member?', 'Go to the Team screen, tap Add Team Member, fill in their name and email, set a role (Agent, Manager, or Admin), and save. They will receive their login credentials and can sign in immediately.'),
  ('How do I assign leads faster?', 'Open the Leads list and tap any lead to assign it directly. You can also move leads between stages in the Pipeline view. Use bulk-select to assign multiple leads at once.'),
  ('Who can change user roles?', 'Only Admins can update user roles. Go to Team → tap a member → change their role. Managers can view performance reports but cannot modify roles or remove teammates.'),
  ('How do Facebook leads get into Arthaleads?', 'Connect your Facebook Page via Automation → Connect Facebook. Once connected, any lead submitted through your Facebook Lead Ad forms will automatically appear in Leads within seconds.'),
  ('How do I export leads?', 'Go to the Leads screen and tap Export. You can export filtered leads as CSV for use in WhatsApp campaigns or external reporting.'),
  ('What do the lead statuses mean?', 'New = just arrived, not yet contacted. Contacted = call made or message sent. Site Visit = property visit scheduled or done. Negotiation = price or deal discussion ongoing. Closed Won = sale completed. Closed Lost = lead dropped or unresponsive.'),
];

const _quickActions = [
  ('Need onboarding support?', 'Ask your admin to add your profile, assign your role, and share your login credentials.'),
  ('Need missing lead data?', 'Use Import on the Leads screen to upload a CSV. Export the current list first as a backup before bulk updates.'),
  ('Need admin access?', 'Admins control roles and permissions. Contact your system owner or reach out via WhatsApp support.'),
  ('How do I connect Facebook Lead Ads?', 'Go to Automation, tap Connect Facebook, approve the popup, then select your Page and Lead Ad Form.'),
];

class Attachment {
  final String url;
  final String name;
  final int size;
  Attachment({required this.url, required this.name, required this.size});
  Map<String, dynamic> toJson() => {'url': url, 'name': name, 'size': size};
}

Future<List<Attachment>> pickAttachments(BuildContext context, List<Attachment> existing) async {
  final remaining = _maxAttachments - existing.length;
  if (remaining <= 0) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Maximum 3 attachments allowed'),
      backgroundColor: AppColors.danger,
    ));
    return existing;
  }
  final result = await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx'],
    allowMultiple: true,
  );
  if (result == null) return existing;
  final picked = <Attachment>[];
  for (final f in result.files.take(remaining)) {
    if (f.path == null) continue;
    final bytes = await File(f.path!).readAsBytes();
    if (bytes.lengthInBytes > _maxAttachBytes) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${f.name} is too large (max 600 KB)'),
          backgroundColor: AppColors.danger,
        ));
      }
      continue;
    }
    final ext = f.extension?.toLowerCase() ?? '';
    const mimeMap = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 'webp': 'image/webp', 'pdf': 'application/pdf',
      'txt': 'text/plain', 'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    final mime = mimeMap[ext] ?? 'application/octet-stream';
    picked.add(Attachment(url: 'data:$mime;base64,${base64Encode(bytes)}', name: f.name, size: bytes.lengthInBytes));
  }
  return [...existing, ...picked];
}

Widget attachmentChip(Attachment a, {VoidCallback? onRemove}) {
  final ext = a.name.split('.').last.toLowerCase();
  final isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    margin: const EdgeInsets.only(right: 6, bottom: 6),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(isImg ? Icons.image_outlined : Icons.description_outlined, size: 14, color: AppColors.primary),
        const SizedBox(width: 5),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 120),
          child: Text(a.name, style: const TextStyle(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        if (onRemove != null) ...[
          const SizedBox(width: 4),
          GestureDetector(onTap: onRemove, child: const Icon(Icons.close, size: 14, color: AppColors.danger)),
        ],
      ],
    ),
  );
}

/// Help & Support — Getting Started guide, FAQs, and ticket support with
/// attachments. Mirrors frontend/src/pages/HelpSupport.jsx's three tabs.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _api = ApiClient.instance;
  String _tab = 'guide';
  List<Map<String, dynamic>> _tickets = [];
  bool _loadingTickets = true;
  final Set<int> _expandedModules = {};
  final Set<int> _expandedFaqs = {};

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() => _loadingTickets = true);
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
      if (mounted) setState(() => _loadingTickets = false);
    }
  }

  Future<void> _openNewTicket() async {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String category = 'general';
    String priority = 'medium';
    List<Attachment> attachments = [];

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
                const Text('We\'ll respond within 24 hours', style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 16),
                TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject *')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: category,
                        decoration: const InputDecoration(labelText: 'Category'),
                        items: const [
                          DropdownMenuItem(value: 'general', child: Text('General')),
                          DropdownMenuItem(value: 'technical', child: Text('Technical')),
                          DropdownMenuItem(value: 'billing', child: Text('Billing')),
                          DropdownMenuItem(value: 'bug', child: Text('Bug report')),
                          DropdownMenuItem(value: 'feature-request', child: Text('Feature request')),
                        ],
                        onChanged: (v) => setSheetState(() => category = v ?? 'general'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
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
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Describe your issue * (min 20 chars)'),
                  maxLines: 4,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text('Attachments (${attachments.length}/3)', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text('max 600 KB each', style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                  ],
                ),
                const SizedBox(height: 6),
                if (attachments.isNotEmpty)
                  Wrap(
                    children: attachments
                        .map((a) => attachmentChip(a, onRemove: () => setSheetState(() => attachments.remove(a))))
                        .toList(),
                  ),
                if (attachments.length < 3)
                  OutlinedButton.icon(
                    onPressed: () async {
                      final picked = await pickAttachments(ctx, attachments);
                      setSheetState(() => attachments = picked);
                    },
                    icon: const Icon(Icons.attach_file, size: 16),
                    label: const Text('Attach screenshot or file'),
                  ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () async {
                    if (subjectCtrl.text.trim().isEmpty) return;
                    if (descCtrl.text.trim().length < 20) {
                      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                        content: Text('Please describe the issue in more detail (min 20 characters)'),
                        backgroundColor: AppColors.danger,
                      ));
                      return;
                    }
                    try {
                      final res = await _api.dio.post('/tickets', data: {
                        'subject': subjectCtrl.text.trim(),
                        'description': descCtrl.text.trim(),
                        'category': category,
                        'priority': priority,
                        'attachments': attachments.map((a) => a.toJson()).toList(),
                      });
                      if (ctx.mounted) Navigator.pop(ctx, true);
                      final ticketNumber = res.data['ticket']?['ticketNumber'];
                      if (mounted && ticketNumber != null) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text('Ticket $ticketNumber submitted!'),
                          backgroundColor: AppColors.success,
                        ));
                      }
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Failed to raise ticket')),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: const Text('Submit Ticket'),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );

    if (created == true) _loadTickets();
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'open': return AppColors.info;
      case 'in-progress': return AppColors.warning;
      case 'resolved': return AppColors.success;
      default: return const Color(0xFF6B7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _tabChip('guide', 'Getting Started', Icons.menu_book_outlined),
                _tabChip('faq', 'Help & FAQ', Icons.help_outline),
                _tabChip('support', 'Contact & Tickets', Icons.confirmation_num_outlined),
              ],
            ),
          ),
        ),
        Expanded(
          child: _tab == 'guide'
              ? _guideTab()
              : _tab == 'faq'
                  ? _faqTab()
                  : _supportTab(),
        ),
      ],
    );
  }

  Widget _tabChip(String value, String label, IconData icon) {
    final selected = _tab == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        avatar: Icon(icon, size: 15, color: selected ? Colors.white : null),
        label: Text(label, style: const TextStyle(fontSize: 12)),
        selected: selected,
        onSelected: (_) => setState(() => _tab = value),
      ),
    );
  }

  Widget _guideTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.menu_book, size: 28, color: AppColors.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Getting Started Guide', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(
                      'Follow the six modules below to set up Arthaleads CRM from scratch. Expand any module for the full walkthrough.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < _guideModules.length; i++) _moduleCard(i),
      ],
    );
  }

  Widget _moduleCard(int i) {
    final (title, icon, color, summary, steps) = _guideModules[i];
    final open = _expandedModules.contains(i);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => open ? _expandedModules.remove(i) : _expandedModules.add(i)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, size: 18, color: color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        const SizedBox(height: 3),
                        Text(summary, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                  Icon(open ? Icons.expand_less : Icons.expand_more, size: 20, color: Colors.grey),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var s = 0; s < steps.length; s++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 18, height: 18,
                            margin: const EdgeInsets.only(top: 1),
                            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
                            child: Center(child: Text('${s + 1}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color))),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(steps[s], style: TextStyle(fontSize: 12, color: Colors.grey.shade700, height: 1.4))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _faqTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          const Icon(Icons.help_outline, size: 18, color: AppColors.primary),
          const SizedBox(width: 6),
          Text('Frequently Asked Questions', style: Theme.of(context).textTheme.titleSmall),
        ]),
        const SizedBox(height: 10),
        for (var i = 0; i < _faqs.length; i++) _faqCard(i),
        const SizedBox(height: 20),
        Row(children: [
          const Icon(Icons.support_agent, size: 18, color: AppColors.primary),
          const SizedBox(width: 6),
          Text('Quick Actions', style: Theme.of(context).textTheme.titleSmall),
        ]),
        const SizedBox(height: 10),
        for (final (title, body) in _quickActions)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(body, style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.4)),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.headset_mic_outlined, size: 18, color: AppColors.primary),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('Support hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _faqCard(int i) {
    final (q, a) = _faqs[i];
    final open = _expandedFaqs.contains(i);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => setState(() => open ? _expandedFaqs.remove(i) : _expandedFaqs.add(i)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(q, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                  Icon(open ? Icons.expand_less : Icons.chevron_right, size: 18, color: Colors.grey),
                ],
              ),
              if (open)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(a, style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.4)),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _supportTab() {
    const supportCards = [
      (Icons.phone_outlined, 'Call Support', '+91 80801 97945', 'For urgent CRM access or lead routing issues.'),
      (Icons.email_outlined, 'Email Support', 'support@arthaleads.com', 'Share screenshots or export files for faster debugging.'),
      (Icons.chat_outlined, 'WhatsApp Help', '+91 80801 97945', 'Quick help for day-to-day sales team questions.'),
    ];
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadTickets,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final (icon, title, detail, note) in supportCards)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                      child: Icon(icon, size: 18, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          Text(detail, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
                          Text(note, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: Text('My Tickets', style: Theme.of(context).textTheme.titleSmall)),
              TextButton.icon(
                onPressed: _openNewTicket,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('New Ticket', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          if (_loadingTickets)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            )
          else if (_tickets.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No support tickets yet')),
            )
          else
            for (final t in _tickets)
              Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  title: Text(t['subject'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${t['ticketNumber'] ?? ''} · ${DateFormat('dd MMM yyyy').format(DateTime.tryParse(t['createdAt'] as String? ?? '') ?? DateTime.now())}',
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(t['status'] as String?).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: _statusColor(t['status'] as String?).withValues(alpha: 0.35)),
                    ),
                    child: Text(t['status'] as String? ?? '',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _statusColor(t['status'] as String?))),
                  ),
                  onTap: () async {
                    await Navigator.push(context,
                        MaterialPageRoute(builder: (_) => TicketDetailScreen(ticketId: t['_id'] as String)));
                    _loadTickets();
                  },
                ),
              ),
        ],
      ),
    );
  }
}
