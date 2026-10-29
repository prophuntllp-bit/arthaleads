import 'dart:math';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import 'wa_ui.dart';

/// The last step of an agent's button flow: one question and up to three
/// buttons, each doing whatever the ad needs (book a visit, register for a
/// webinar, send the brochure, ask for a callback). Mirrors the web's
/// ClosingStepEditor in frontend/src/pages/conversations/AgentBuilder.jsx
/// (23 Oct 2026) and the server's ctwaFlowService getClosingButtons /
/// whatsappRoutes sanitizeCtwaFlow. A button saved the old way
/// ({id: advisor | site_visit, label}) keeps its meaning.

const kClosingTitleMax = 20;
const kClosingMax = 3; // WhatsApp's reply-button limit
const kDefaultClosingPrompt = 'Would you like to talk to our advisor, or book a site visit?';
const kCustomClosingPrompt = 'How would you like to continue?';
const kBookImmediately = '__book__';

const closingActions = {
  'handoff': 'Connect them to your team',
  'site_visit': 'Book a site visit',
  'register': 'Register them for your event or webinar',
  'photos': 'Send photos & videos, then finish',
  'docs': 'Send floor plan & brochure, then finish',
  'location': 'Send the project location, then finish',
  'question': 'Ask another question',
  'end': 'Thank them and finish',
};
const _legacyAction = {'advisor': 'handoff', 'site_visit': 'site_visit'};
// Actions that alert the team unless turned off; the others only when on.
const _alertByDefault = ['handoff', 'site_visit', 'register'];
const _saveTo = {
  'name': "Save it as the lead's name",
  'email': "Save it as the lead's email (if empty)",
  'notes': 'Save it as a note on the lead',
};
const closingReplyDefault = {
  'handoff': "Connecting you with our advisor, they'll reach out to you shortly.",
  'site_visit': 'Wonderful! Our team will confirm your visit shortly and take it from here.',
  'register': "You're registered for {{event}} on {{time}}. We'll send you the joining link here {{minutes}} minutes before it starts.",
  'end': 'Thank you! Message us here anytime if you need anything.',
};
const _defaultReminder = 'Hi {{name}}, {{event}} starts in {{minutes}} minutes. Join here: {{link}}';
const _eventTemplateVars = {
  'name': "Customer's first name",
  'link': 'Joining link',
  'event': 'Event name',
  'time': 'Event date and time',
};

Map<String, dynamic> emptyEvent() => {
      'title': '',
      'startsAt': null,
      'link': '',
      'reminderMinutes': 30,
      'reminderText': '',
      'templateName': '',
      'templateLanguage': '',
      'templateVars': <String>[],
    };

String _newClosingId() => 'close_${Random().nextInt(1 << 30).toRadixString(36)}';

Map<String, dynamic> closingButton([Map<String, dynamic> b = const {}]) {
  final ask = b['askText'];
  return {
    'id': '${b['id'] ?? ''}'.isEmpty ? _newClosingId() : '${b['id']}',
    'label': '${b['label'] ?? ''}',
    'action': '${b['action'] ?? 'end'}',
    'reply': '${b['reply'] ?? ''}',
    'tag': '${b['tag'] ?? ''}',
    'status': '${b['status'] ?? ''}',
    if (b['notify'] is bool) 'notify': b['notify'],
    'next': '${b['next'] ?? ''}',
    'askText': ask is Map && ask['prompt'] != null
        ? {'prompt': '${ask['prompt'] ?? ''}', 'saveTo': '${ask['saveTo'] ?? 'notes'}'}
        : null,
  };
}

/// Starting points: each fills in the question and the buttons.
class ClosingPreset {
  final String key;
  final String label;
  final String prompt;
  final List<Map<String, dynamic>> Function() buttons;
  const ClosingPreset(this.key, this.label, this.prompt, this.buttons);
}

final closingPresets = <ClosingPreset>[
  ClosingPreset('site_visit', 'Site visit', kDefaultClosingPrompt, () => [
        {'id': 'advisor', 'label': 'Talk to Advisor', 'action': 'handoff'},
        {'id': 'site_visit', 'label': 'Book Site Visit', 'action': 'site_visit'},
      ]),
  ClosingPreset('event', 'Webinar or event', 'Shall I reserve your seat for the {{event}} on {{time}}?', () => [
        {
          'label': 'Reserve my seat',
          'action': 'register',
          'tag': 'Webinar registered',
          'notify': true,
          'askText': {'prompt': 'May I have your full name for the registration?', 'saveTo': 'name'},
          'reply': "Thanks {{name}}, your seat is reserved for {{event}} on {{time}}. We'll send the joining link here {{minutes}} minutes before it starts.",
        },
        {'label': 'Not now', 'action': 'end', 'tag': 'Webinar not now', 'notify': false, 'reply': 'No problem! Message us here anytime if you change your mind.'},
      ]),
  ClosingPreset('brochure', 'Brochure', 'Would you like the brochure and floor plan here on WhatsApp?', () => [
        {'label': 'Send brochure', 'action': 'docs', 'reply': 'Here you go! Ask me anything about the project.'},
        {'label': 'Talk to Advisor', 'action': 'handoff'},
      ]),
  ClosingPreset('callback', 'Callback', 'Would you like a call from our team?', () => [
        {'label': 'Call me now', 'action': 'handoff', 'tag': 'Callback requested', 'reply': 'Sure! Our team will call you shortly.'},
        {
          'label': 'Call me later',
          'action': 'handoff',
          'tag': 'Callback requested',
          'reply': 'Noted, {{name}}. Our team will call you then.',
          'askText': {'prompt': 'What day and time suits you for a call?', 'saveTo': 'notes'},
        },
        {'label': 'Not now', 'action': 'end', 'notify': false},
      ]),
];

/// The saved buttons, cleaned the way the server reads them; the Site visit
/// starter when there are none.
List<Map<String, dynamic>> resolveClosingButtons(Map flow) {
  final seen = <String>{};
  final out = <Map<String, dynamic>>[];
  for (final raw in (flow['closingButtons'] as List?) ?? const []) {
    if (raw is! Map) continue;
    final b = raw.cast<String, dynamic>();
    final action = closingActions.containsKey(b['action']) ? '${b['action']}' : _legacyAction['${b['id']}'];
    final label = '${b['label'] ?? ''}'.trim();
    if ('${b['id'] ?? ''}'.isEmpty || action == null || label.isEmpty || !seen.add('${b['id']}')) continue;
    final ask = b['askText'];
    out.add(closingButton({
      ...b,
      'action': action,
      'label': label.length > kClosingTitleMax ? label.substring(0, kClosingTitleMax) : label,
      'askText': ask is Map && '${ask['prompt'] ?? ''}'.isNotEmpty ? ask : null,
    }));
    if (out.length >= kClosingMax) break;
  }
  return out.isNotEmpty ? out : closingPresets.first.buttons().map(closingButton).toList();
}

/// {{event}}, {{time}}, {{link}}, {{minutes}} as the server words them (IST).
Map<String, String> closingEventVars(Map? ev) {
  if (ev == null || ('${ev['title'] ?? ''}'.isEmpty && ev['startsAt'] == null)) return {};
  var time = '';
  final at = DateTime.tryParse('${ev['startsAt'] ?? ''}');
  if (at != null) {
    time = DateFormat('d MMM, h:mm a').format(at.toUtc().add(const Duration(hours: 5, minutes: 30)));
  }
  return {
    'event': '${ev['title'] ?? ''}'.isEmpty ? 'the event' : '${ev['title']}',
    'time': time,
    'link': '${ev['link'] ?? ''}',
    'minutes': '${ev['reminderMinutes'] ?? 30}',
  };
}

/// What's wrong before saving, or null: a registration button needs the
/// event's name and time (the server refuses it otherwise).
String? closingProblem(Map flow) {
  final buttons = (flow['closingButtons'] as List?) ?? const [];
  if (buttons.any((b) => b is Map && '${b['label'] ?? ''}'.trim().isEmpty)) return 'Give every closing button a name.';
  final register = buttons.any((b) => b is Map && b['action'] == 'register');
  final ev = flow['event'] as Map?;
  if (register && ('${ev?['title'] ?? ''}'.trim().isEmpty || ev?['startsAt'] == null)) {
    return "Add the event's name and date and time. A registration button can't be saved without them.";
  }
  final link = '${ev?['link'] ?? ''}'.trim();
  if (register && link.isNotEmpty && !RegExp(r'^https?://', caseSensitive: false).hasMatch(link)) {
    return 'The joining link has to start with https://';
  }
  return null;
}

class ClosingStepEditor extends StatefulWidget {
  /// The agent's ctwaFlow, edited in place.
  final Map<String, dynamic> flow;
  final TextEditingController promptCtrl;
  final List<Map<String, dynamic>> questions;
  final VoidCallback onChanged;
  const ClosingStepEditor({
    super.key,
    required this.flow,
    required this.promptCtrl,
    required this.questions,
    required this.onChanged,
  });

  @override
  State<ClosingStepEditor> createState() => _ClosingStepEditorState();
}

class _ClosingStepEditorState extends State<ClosingStepEditor> {
  final Map<String, TextEditingController> _ctrls = {};
  final Set<String> _more = {};
  List<Map<String, dynamic>>? _templates;
  String _templatesError = '';

  Map<String, dynamic> get _flow => widget.flow;
  List<Map<String, dynamic>> get _buttons =>
      [for (final b in (_flow['closingButtons'] as List?) ?? const []) (b as Map).cast<String, dynamic>()];
  Map<String, dynamic> get _event => {...emptyEvent(), ...((_flow['event'] as Map?)?.cast<String, dynamic>() ?? {})};
  bool get _hasRegister => _buttons.any((b) => b['action'] == 'register');

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _ctrl(String key, String text) => _ctrls.putIfAbsent(key, () => TextEditingController(text: text));

  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  void _setButtons(List<Map<String, dynamic>> next) {
    _flow['closingButtons'] = next;
    _flow['closingTemplate'] = 'custom';
    _changed();
  }

  void _update(int i, Map<String, dynamic> patch) {
    final list = _buttons;
    list[i] = {...list[i], ...patch};
    _setButtons(list);
  }

  void _setEvent(Map<String, dynamic> patch) {
    _flow['event'] = {..._event, ...patch};
    _changed();
  }

  String get _activePreset {
    final t = '${_flow['closingTemplate'] ?? ''}';
    if (t.isNotEmpty) return t;
    final onlyStock = _buttons.every((b) => _legacyAction[b['id']] == b['action']);
    return onlyStock ? 'site_visit' : 'custom';
  }

  Future<void> _applyPreset(ClosingPreset p) async {
    if (p.key == _activePreset) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text('Use the "${p.label}" starter?'),
        content: const Text('It replaces the closing question and buttons. You can edit everything after.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Replace')),
        ],
      ),
    );
    if (ok != true) return;
    for (final c in _ctrls.values) {
      c.dispose();
    }
    _ctrls.clear();
    _flow['closingTemplate'] = p.key;
    widget.promptCtrl.text = p.prompt;
    _flow['closingPrompt'] = p.prompt;
    _flow['closingSiteVisitNext'] = '';
    _flow['closingButtons'] = p.buttons().map(closingButton).toList();
    if (p.key == 'event' && _flow['event'] == null) _flow['event'] = emptyEvent();
    _changed();
  }

  Future<void> _loadTemplates() async {
    if (_templates != null) return;
    _templates = const [];
    try {
      final r = await ApiClient.instance.dio.get('/whatsapp/templates');
      _templates = [
        for (final t in (r.data['templates'] as List?) ?? const [])
          if (t is Map && t['status'] == 'APPROVED') t.cast<String, dynamic>(),
      ];
    } catch (e) {
      _templatesError = ApiClient.errorMessage(e, 'Could not load your WhatsApp templates.');
    }
    if (mounted) setState(() {});
  }

  Future<void> _pickEventTime() async {
    final cur = DateTime.tryParse('${_event['startsAt'] ?? ''}')?.toUtc().add(const Duration(hours: 5, minutes: 30));
    final nowIst = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
    final date = await showDatePicker(
      context: context,
      initialDate: cur ?? nowIst,
      firstDate: DateTime(nowIst.year - 1),
      lastDate: DateTime(nowIst.year + 2),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: cur != null ? TimeOfDay(hour: cur.hour, minute: cur.minute) : const TimeOfDay(hour: 18, minute: 0),
    );
    if (time == null) return;
    // The picked wall-clock time is India time.
    final utc = DateTime.utc(date.year, date.month, date.day, time.hour, time.minute).subtract(const Duration(hours: 5, minutes: 30));
    _setEvent({'startsAt': utc.toIso8601String()});
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final buttons = _buttons;
    final questions = [for (final q in widget.questions) if (((q['options'] as List?) ?? const []).isNotEmpty) q];
    String qLabel(Map q) {
      final s = '${q['questionText'] ?? ''}';
      return s.isEmpty ? '(untitled question)' : (s.length > 50 ? '${s.substring(0, 50)}…' : s);
    }

    if (_hasRegister) _loadTemplates();
    final active = _activePreset;
    final onlyStock = buttons.every((b) => _legacyAction[b['id']] == b['action']);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Start from what this ad is for, then change anything.', style: TextStyle(fontSize: 12, color: t.textSoft)),
      const SizedBox(height: 8),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final p in closingPresets)
          ChoiceChip(label: Text(p.label), selected: active == p.key, onSelected: (_) => _applyPreset(p)),
        ChoiceChip(
          label: const Text('Custom'),
          selected: active == 'custom',
          onSelected: (_) {
            _flow['closingTemplate'] = 'custom';
            _changed();
          },
        ),
      ]),
      const SizedBox(height: 12),
      WaField(
        label: 'Closing question',
        controller: widget.promptCtrl,
        hint: onlyStock ? kDefaultClosingPrompt : kCustomClosingPrompt,
        help: 'Sent once every question above has been asked. You can use {{name}}${_hasRegister ? ', {{event}}, {{time}} and {{link}}' : ''}.',
        onChanged: (_) => widget.onChanged(),
      ),
      const SizedBox(height: 10),
      for (final (i, b) in buttons.indexed) ...[
        _buttonCard(i, b, buttons.length, questions, qLabel),
        const SizedBox(height: 10),
      ],
      OutlinedButton.icon(
        onPressed: buttons.length >= kClosingMax ? null : () => _setButtons([...buttons, closingButton({'label': '', 'action': 'end'})]),
        icon: const Icon(Icons.add_rounded, size: 18),
        label: Text(buttons.length >= kClosingMax ? 'WhatsApp allows three buttons' : 'Add a button'),
      ),
      const SizedBox(height: 4),
      Text('Button names are limited to $kClosingTitleMax characters, the most WhatsApp allows. Every tap is logged on the lead.',
          style: TextStyle(fontSize: 11, color: t.textSoft)),
      if (_hasRegister) ...[const SizedBox(height: 12), _eventCard()],
    ]);
  }

  Widget _buttonCard(int i, Map<String, dynamic> b, int count, List<Map<String, dynamic>> questions, String Function(Map) qLabel) {
    final t = AppTheme.of(context);
    final id = '${b['id']}';
    final action = '${b['action']}';
    final ask = b['askText'] as Map?;
    final alertOn = b['notify'] is bool ? b['notify'] as bool : _alertByDefault.contains(action);
    final isMore = _more.contains(id);
    final warn = TextStyle(fontSize: 11, color: Colors.amber.shade800);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.surfaceLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('Button ${i + 1}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: t.textSoft)),
          const Spacer(),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Move up',
            onPressed: i == 0
                ? null
                : () {
                    final l = _buttons;
                    final x = l.removeAt(i);
                    l.insert(i - 1, x);
                    _setButtons(l);
                  },
            icon: const Icon(Icons.keyboard_arrow_up_rounded),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Move down',
            onPressed: i == count - 1
                ? null
                : () {
                    final l = _buttons;
                    final x = l.removeAt(i);
                    l.insert(i + 1, x);
                    _setButtons(l);
                  },
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: count == 1 ? 'At least one button has to stay' : 'Remove this button',
            onPressed: count == 1 ? null : () => _setButtons(_buttons..removeAt(i)),
            icon: const Icon(Icons.close_rounded),
          ),
        ]),
        WaField(
          label: 'Button name',
          controller: _ctrl('$id.label', '${b['label']}'),
          hint: 'e.g. Reserve my seat',
          maxLength: kClosingTitleMax,
          onChanged: (v) => _update(i, {'label': v}),
        ),
        WaSelect<String>(
          label: 'When tapped',
          value: action,
          options: closingActions,
          onChanged: (v) {
            if (v == null) return;
            _update(i, {'action': v, 'next': '', if (v == 'question') 'askText': null});
          },
        ),
        if (action == 'question') ...[
          const SizedBox(height: 8),
          WaSelect<String>(
            label: 'Which question',
            value: questions.any((q) => q['id'] == b['next']) ? '${b['next']}' : '',
            options: {'': 'Choose a question', for (final q in questions) '${q['id']}': qLabel(q)},
            onChanged: (v) => _update(i, {'next': v ?? ''}),
          ),
          if ('${b['next'] ?? ''}'.isEmpty) Text('Pick a question, or this button just thanks them and finishes.', style: warn),
        ],
        if (action == 'site_visit') ...[
          const SizedBox(height: 8),
          WaSelect<String>(
            label: 'Before booking',
            value: () {
              final v = '${b['next'] ?? ''}'.isNotEmpty ? '${b['next']}' : '${_flow['closingSiteVisitNext'] ?? ''}';
              return v == kBookImmediately || questions.any((q) => q['id'] == v) ? v : '';
            }(),
            options: {
              '': 'Ask the time question, if there is one',
              kBookImmediately: 'Book straight away, no question',
              for (final q in questions) '${q['id']}': 'Ask: ${qLabel(q)}',
            },
            onChanged: (v) {
              _flow['closingSiteVisitNext'] = '';
              _update(i, {'next': v ?? ''});
            },
          ),
        ],
        if (action != 'question') ...[
          const SizedBox(height: 4),
          WaCheckRow(
            value: ask != null,
            onChanged: (on) => _update(i, {
              'askText': on ? {'prompt': '', 'saveTo': action == 'register' ? 'name' : 'notes'} : null,
            }),
            title: 'Ask them to type something first',
          ),
          if (ask != null) ...[
            WaField(
              label: 'Question',
              controller: _ctrl('$id.ask', '${ask['prompt'] ?? ''}'),
              hint: 'e.g. May I have your full name?',
              onChanged: (v) => _update(i, {'askText': {...ask, 'prompt': v}}),
            ),
            WaSelect<String>(
              label: 'Save the answer',
              value: _saveTo.containsKey(ask['saveTo']) ? '${ask['saveTo']}' : 'notes',
              options: _saveTo,
              onChanged: (v) => _update(i, {'askText': {...ask, 'saveTo': v ?? 'notes'}}),
            ),
            if ('${ask['prompt'] ?? ''}'.trim().isEmpty) Text('Write the question, or it is skipped.', style: warn),
          ],
          const SizedBox(height: 6),
          WaField(
            label: 'Reply',
            controller: _ctrl('$id.reply', '${b['reply'] ?? ''}'),
            hint: closingReplyDefault[action] != null
                ? 'Leave blank for: ${closingReplyDefault[action]}'
                : 'Optional: a line sent after the files',
            maxLines: 3,
            minLines: 2,
            onChanged: (v) => _update(i, {'reply': v}),
          ),
        ],
        TextButton.icon(
          style: TextButton.styleFrom(alignment: Alignment.centerLeft, padding: EdgeInsets.zero),
          onPressed: () => setState(() => isMore ? _more.remove(id) : _more.add(id)),
          icon: Icon(isMore ? Icons.expand_less_rounded : Icons.expand_more_rounded, size: 18),
          label: Text(
            'Tag, status and alert${[b['tag'], b['status']].where((v) => '${v ?? ''}'.isNotEmpty).isEmpty ? '' : ': ${[b['tag'], b['status']].where((v) => '${v ?? ''}'.isNotEmpty).join(', ')}'}',
            style: const TextStyle(fontSize: 12),
          ),
        ),
        if (isMore) ...[
          WaField(
            label: 'Tag the lead',
            controller: _ctrl('$id.tag', '${b['tag'] ?? ''}'),
            hint: 'e.g. Webinar 31 Oct',
            maxLength: 40,
            onChanged: (v) => _update(i, {'tag': v}),
          ),
          WaSelect<String>(
            label: "Set the lead's status",
            value: statusOptions.contains(b['status']) ? '${b['status']}' : '',
            options: {'': "Don't change it", for (final s in statusOptions) s: s},
            onChanged: (v) => _update(i, {'status': v ?? ''}),
          ),
          WaCheckRow(
            value: alertOn,
            onChanged: (v) => _update(i, {'notify': v}),
            title: 'Alert your team when someone taps this',
          ),
        ],
      ]),
    );
  }

  Widget _eventCard() {
    final t = AppTheme.of(context);
    final ev = _event;
    final at = DateTime.tryParse('${ev['startsAt'] ?? ''}');
    final link = '${ev['link'] ?? ''}'.trim();
    final linkOk = link.isEmpty || RegExp(r'^https?://', caseSensitive: false).hasMatch(link);
    final reminder = '${ev['reminderText'] ?? ''}';
    final red = TextStyle(fontSize: 11, color: Colors.red.shade700);
    final templates = _templates;
    final chosen = (templates ?? const []).where((x) =>
        x['name'] == ev['templateName'] && ('${ev['templateLanguage'] ?? ''}'.isEmpty || x['language'] == ev['templateLanguage']));
    final body = chosen.isEmpty
        ? ''
        : '${((chosen.first['components'] as List?) ?? const []).cast<Map>().where((c) => c['type'] == 'BODY').map((c) => c['text']).firstOrNull ?? ''}';
    final slots = (RegExp(r'\{\{\s*(\d+)\s*\}\}').allMatches(body).map((m) => int.parse(m.group(1)!)).toSet().toList()..sort());
    final vars = [for (final v in (ev['templateVars'] as List?) ?? const []) '$v'];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: t.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('YOUR EVENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: t.textSoft)),
        const SizedBox(height: 8),
        WaField(
          label: 'Event name',
          controller: _ctrl('event.title', '${ev['title'] ?? ''}'),
          hint: 'e.g. Green Valley Launch Webinar',
          maxLength: 120,
          onChanged: (v) => _setEvent({'title': v}),
        ),
        const SizedBox(height: 4),
        Text('Date and time (IST)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.text)),
        const SizedBox(height: 4),
        OutlinedButton.icon(
          onPressed: _pickEventTime,
          icon: const Icon(Icons.event_rounded, size: 18),
          label: Text(at == null ? 'Pick the date and time' : closingEventVars(ev)['time'] ?? ''),
        ),
        if (at != null && at.isBefore(DateTime.now()))
          Text('This time has passed. Nobody new gets a reminder.', style: TextStyle(fontSize: 11, color: Colors.amber.shade800)),
        if ('${ev['title'] ?? ''}'.trim().isEmpty || at == null)
          Text("Add the event's name and date and time. A registration button can't be saved without them.", style: red),
        const SizedBox(height: 8),
        WaField(
          label: 'Joining link',
          controller: _ctrl('event.link', '${ev['link'] ?? ''}'),
          hint: 'https://meet.google.com/...',
          keyboardType: TextInputType.url,
          onChanged: (v) => _setEvent({'link': v}),
        ),
        if (!linkOk) Text('The link has to start with https://', style: red),
        if (link.isEmpty && (reminder.trim().isEmpty || RegExp(r'\{\{\s*link\s*\}\}').hasMatch(reminder)))
          Text('Add the joining link, or the reminder goes out with "Join here:" and nothing after it. For an event with no link, write a reminder without {{link}}.',
              style: red),
        WaField(
          label: 'Send it (minutes before)',
          controller: _ctrl('event.minutes', '${ev['reminderMinutes'] ?? 30}'),
          keyboardType: TextInputType.number,
          onChanged: (v) => _setEvent({'reminderMinutes': (int.tryParse(v) ?? 30).clamp(5, 1440)}),
        ),
        WaField(
          label: 'Reminder message',
          controller: _ctrl('event.reminder', reminder),
          hint: _defaultReminder,
          maxLines: 3,
          minLines: 2,
          help: 'Use {{name}}, {{event}}, {{time}}, {{minutes}} and {{link}}. The reminder goes once to everyone who registered. If you move the event, saved reminders move with it.',
          onChanged: (v) => _setEvent({'reminderText': v}),
        ),
        const SizedBox(height: 6),
        Text("Approved template, for people who haven't written in 24 hours",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.text)),
        Text(
          "WhatsApp only lets a business send a normal message within 24 hours of the customer's last message. After that, the link can only go as an approved template. Without one, those people don't get the reminder.",
          style: TextStyle(fontSize: 11, color: t.textSoft),
        ),
        const SizedBox(height: 6),
        if (templates == null)
          Text('Loading your templates…', style: TextStyle(fontSize: 12, color: t.textSoft))
        else if (_templatesError.isNotEmpty)
          Text(_templatesError, style: red)
        else
          WaSelect<String>(
            label: '',
            value: '${ev['templateName'] ?? ''}'.isEmpty ? '' : '${ev['templateName']}|${ev['templateLanguage'] ?? ''}',
            options: {
              '': templates.isEmpty ? 'No approved templates yet' : 'None: skip people outside the 24 hours',
              for (final tp in templates) '${tp['name']}|${tp['language']}': '${tp['name']} (${tp['language']})',
            },
            onChanged: (v) {
              if (v == null || v.isEmpty) {
                _setEvent({'templateName': '', 'templateLanguage': '', 'templateVars': <String>[]});
                return;
              }
              final parts = v.split('|');
              final tp = templates.where((x) => x['name'] == parts[0] && x['language'] == parts[1]).firstOrNull;
              final b = '${((tp?['components'] as List?) ?? const []).cast<Map>().where((c) => c['type'] == 'BODY').map((c) => c['text']).firstOrNull ?? ''}';
              final n = RegExp(r'\{\{\s*\d+\s*\}\}').allMatches(b).map((m) => m.group(0)).toSet().length;
              _setEvent({'templateName': parts[0], 'templateLanguage': parts[1], 'templateVars': const ['name', 'link', 'event', 'time'].take(n).toList()});
            },
          ),
        if (body.isNotEmpty) ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(12)),
            child: Text(body, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          ),
          for (final (k, n) in slots.indexed)
            WaSelect<String>(
              label: '{{$n}}',
              value: k < vars.length && _eventTemplateVars.containsKey(vars[k]) ? vars[k] : 'name',
              options: _eventTemplateVars,
              onChanged: (v) {
                final next = [...vars];
                while (next.length <= k) {
                  next.add('name');
                }
                next[k] = v ?? 'name';
                _setEvent({'templateVars': next});
              },
            ),
        ],
      ]),
    );
  }
}
