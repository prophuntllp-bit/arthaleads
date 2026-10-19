import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/labeled_field.dart';

/// "Common questions" in Artha: instant answers, no AI call, each with a "Go
/// there" button to the screen it talks about. The web's QUICK_ANSWERS
/// (frontend/src/data/helpData.js), worded for the app's own screens.
class ArthaQuickAnswer {
  final String q, a;

  /// Drawer label of the screen to open (shell's _navigateToLabel).
  final String? goto;
  const ArthaQuickAnswer(this.q, this.a, [this.goto]);
}

const arthaQuickAnswers = [
  ArthaQuickAnswer('How do I add a new lead?',
      'Open Leads and tap + at the top. You can also import a CSV from the same screen, or connect Facebook under Integrations so new leads arrive by themselves.', 'Leads'),
  ArthaQuickAnswer('How do I connect Facebook lead ads?',
      'Open Integrations (admins and managers), tap Facebook, sign in with Meta and pick your page and lead form. Every new form submission then comes into the CRM automatically.',
      'Integrations'),
  ArthaQuickAnswer('How do I assign leads to my team?',
      'Open a lead and change who it is assigned to. To assign several at once, press and hold a lead in the Leads list, tick the others, then use Assign. The agent gets a notification straight away.',
      'Leads'),
  ArthaQuickAnswer('How do I set and track follow-ups?',
      'Open any lead and set a follow-up date. Follow-ups lists them all, with overdue ones in red and today\'s in amber, each with Call and WhatsApp buttons.', 'Follow-ups'),
  ArthaQuickAnswer('What is the Pipeline?',
      'Pipeline shows your leads as columns by stage (New, Contacted, Site Visit, Negotiation, Closed). Moving a lead to another column updates its status. It is a quick way to spot deals that are stuck.',
      'Pipeline'),
  ArthaQuickAnswer('How do I get Artha to write a WhatsApp reply?',
      'Open a chat in WhatsApp and tap the sparkle button in the message box. Artha writes a reply from the chat; edit it if you like, then send. Artha never sends anything by itself.',
      'WhatsApp'),
  ArthaQuickAnswer('Can I edit or delete a note?',
      'Yes. Open the lead, go to Notes and use the three-dot menu on the note. You can always change your own notes; admins and managers can change anyone\'s. Every edit and deletion is kept in the lead\'s activity.',
      'Leads'),
  ArthaQuickAnswer('Why do Not Interested leads stay in my list?',
      'Because that is where they belong: marking a lead Not Interested no longer moves it away. Dump now holds only deleted leads and ones marked Closed Lost.', 'Leads'),
  ArthaQuickAnswer('How do I add team members?',
      'Admins open Team and add a person with their name, email and role (Agent, Manager or Admin). They get their own sign-in by email.', 'Team'),
  ArthaQuickAnswer('How do I clock in and out?',
      'Open Attendance and tap Clock In. Your admin may ask for a selfie. Tap Clock Out when you finish; your hours are counted for you.', 'Attendance'),
  ArthaQuickAnswer('How do I create a booking?',
      'Open Bookings and add a new booking with the project, unit, customer and payment plan. From the booking you can then make an invoice with your company letterhead.', 'Bookings'),
  ArthaQuickAnswer('How do I manage projects?',
      'Projects lists your real-estate projects. Open one to see its own leads. You can add leads straight into a project, or file a lead under a project from the lead.', 'Projects'),
  ArthaQuickAnswer('Where do I see call history and recordings?',
      'Open Calls. Each row is a lead; open it for every call made to them, with the recording, summary and notes. A lead\'s own Calls tab shows the same.', 'Calls'),
  ArthaQuickAnswer('How does Refer & Earn work?',
      'Open Referrals for your link and code. When another real-estate team you referred takes a paid plan, you both get a free month.', 'Referrals'),
];

/// Raise a support ticket from Artha (when it could not answer). The subject
/// starts as the person's question. Same POST /tickets the Help screen uses.
/// Returns the ticket number, or null if not sent.
Future<String?> showArthaTicketSheet(BuildContext context, {String subject = ''}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _TicketSheet(subject: subject),
  );
}

class _TicketSheet extends StatefulWidget {
  final String subject;
  const _TicketSheet({required this.subject});

  @override
  State<_TicketSheet> createState() => _TicketSheetState();
}

class _TicketSheetState extends State<_TicketSheet> {
  late final _subject = TextEditingController(text: widget.subject.length > 200 ? widget.subject.substring(0, 200) : widget.subject);
  final _desc = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _subject.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_subject.text.trim().isEmpty || _desc.text.trim().isEmpty) {
      setState(() => _error = 'Add a subject and say what went wrong');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.dio.post('/tickets', data: {
        'subject': _subject.text.trim(),
        'description': _desc.text.trim(),
        'category': 'general',
        'priority': 'medium',
        'attachments': const [],
      });
      if (mounted) Navigator.pop(context, '${res.data['ticket']?['ticketNumber'] ?? ''}');
    } catch (e) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = ApiClient.errorMessage(e, "Couldn't raise the ticket right now. Please try again in a moment.");
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text('Raise a ticket', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: t.text)),
            const SizedBox(height: 4),
            Text('Our team replies by email, usually within 24 hours.', style: TextStyle(fontSize: 13, color: t.textSoft)),
            const SizedBox(height: 14),
            LabeledField(label: 'Subject', child: TextField(controller: _subject, maxLength: 200)),
            const SizedBox(height: 6),
            LabeledField(
              label: 'What went wrong?',
              child: TextField(
                controller: _desc,
                minLines: 3,
                maxLines: 6,
                autofocus: true,
                decoration: const InputDecoration(hintText: 'What you asked Artha and what happened'),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.danger)),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _sending ? null : _send,
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                child: Text(_sending ? 'Sending…' : 'Send ticket'),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
