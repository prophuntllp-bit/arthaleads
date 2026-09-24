import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_ui.dart';

const _languages = {
  'auto': 'Match the customer',
  'English': 'English',
  'Hindi': 'Hindi',
  'Marathi': 'Marathi',
  'Gujarati': 'Gujarati',
  'Tamil': 'Tamil',
  'Telugu': 'Telugu',
  'Kannada': 'Kannada',
  'Bengali': 'Bengali',
  'Punjabi': 'Punjabi',
};

const _statuses = {
  'active': 'Live — answers customers',
  'paused': 'Paused — does not answer',
  'draft': 'Draft — still being written',
};

const _mapsToOptions = {
  'none': "Don't map — just record the answer",
  'purpose': 'Purpose (Buy / Rent / Invest)',
  'budget': 'Budget range',
  'timeline': 'Timeline',
  'bhk': 'Configuration (BHK)',
  'propertyType': 'Property type',
  'city': 'City',
  'preferredLocation': 'Preferred location',
  'streetAddress': 'Street address',
};

// Per-option action — independent of the question's own "Maps to". Only
// offered on questions that don't map to a real lead field ("none"), since a
// Purpose/Budget/Timeline answer is about capturing structured data, not
// triggering a send or an ending.
const _optionActions = {
  'none': 'Just record the answer, then continue',
  'photos': 'Send photos & videos, then continue',
  'docs': 'Send floor plan & brochure, then continue',
  'location': 'Send the project location, then continue',
  'advisor': 'End here — connect to a human advisor',
  'site_visit': "End here — book a site visit (uses this button's own label as the time)",
};

const _presetPurpose = ['Self Use', 'Investment', 'Buy', 'Rent', 'Just Exploring'];
const _presetTimeline = ['Within 30 Days', '1-3 Months', '3-6 Months', '6-12 Months', 'Just Exploring'];
const _presetBhk = ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Studio'];
const _presetPropertyType = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office', 'Penthouse'];
const _mapsToPresets = {
  'purpose': _presetPurpose,
  'timeline': _presetTimeline,
  'bhk': _presetBhk,
  'propertyType': _presetPropertyType,
};
const _presetBudgetBrackets = [
  {'label': 'Under ₹50L', 'min': 0, 'max': 5000000},
  {'label': '₹50L - ₹75L', 'min': 5000000, 'max': 7500000},
  {'label': '₹75L - ₹1Cr', 'min': 7500000, 'max': 10000000},
  {'label': '₹1Cr - ₹1.5Cr', 'min': 10000000, 'max': 15000000},
  {'label': '₹1.5Cr+', 'min': 15000000, 'max': 0},
  {'label': 'Just Exploring', 'min': 0, 'max': 0},
];
const _presetMenuOptions = [
  {'label': '🖼️ Photos & Videos', 'action': 'photos'},
  {'label': '📄 Floor Plan & Brochure', 'action': 'docs'},
  {'label': '📍 Location Details', 'action': 'location'},
  {'label': '🏡 Book Site Visit', 'action': 'site_visit'},
  {'label': '📞 Talk to Advisor', 'action': 'advisor'},
];

/// Mirrors ctwaFlowService.js's CLOSING_OPTIONS — fixed, not configurable.
const _closingButtons = [
  {'id': 'advisor', 'label': 'Talk to Advisor'},
  {'id': 'site_visit', 'label': 'Book Site Visit'},
];

/// The one non-question value an option's `next` may point to — matches
/// backend whatsappRoutes.js's sanitizeCtwaFlow / ctwaFlowService.js exactly.
const _kNextClosing = '__closing__';

String _slug(String v, int i) {
  final s = v
      .toLowerCase()
      .trim()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  final cut = s.length > 40 ? s.substring(0, 40) : s;
  return '${cut.isEmpty ? 'option' : cut}_$i';
}

Map<String, dynamic> _defaultFlow() => jsonDecode(jsonEncode({
      'enabled': false,
      'welcomeText': 'Hi {{name}} 👋 Thanks for your interest in {{project}}!',
      'qualifyingQuestions': [
        {
          'id': 'purpose',
          'questionText': 'Are you looking for this primarily for:',
          'mapsTo': 'purpose',
          'options': [
            {'id': 'self_use_0', 'label': 'Self Use', 'action': 'none'},
            {'id': 'investment_1', 'label': 'Investment', 'action': 'none'},
          ],
        },
        {
          'id': 'budget',
          'questionText': "Perfect. What's your approximate budget range?",
          'mapsTo': 'budget',
          'options': [
            {'id': 'b0', 'label': 'Under ₹50L', 'min': 0, 'max': 5000000, 'action': 'none'},
            {'id': 'b1', 'label': '₹50L - ₹1Cr', 'min': 5000000, 'max': 10000000, 'action': 'none'},
            {'id': 'b2', 'label': '₹1Cr+', 'min': 10000000, 'max': 0, 'action': 'none'},
            {'id': 'b3', 'label': 'Just Exploring', 'min': 0, 'max': 0, 'action': 'none'},
          ],
        },
        {
          'id': 'timeline',
          'questionText': 'Got it. When are you looking to finalize?',
          'mapsTo': 'timeline',
          'options': [
            {'id': 't0', 'label': 'Within 30 Days', 'action': 'none'},
            {'id': 't1', 'label': '1-3 Months', 'action': 'none'},
            {'id': 't2', 'label': '3-6 Months', 'action': 'none'},
            {'id': 't3', 'label': 'Just Exploring', 'action': 'none'},
          ],
        },
        {
          'id': 'menu',
          'questionText': 'Great, what would you like to see next?',
          'mapsTo': 'none',
          'options': [
            {'id': 'm0', 'label': '🖼️ Photos & Videos', 'action': 'photos'},
            {'id': 'm1', 'label': '📄 Floor Plan & Brochure', 'action': 'docs'},
            // "none" — not "site_visit" — because tapping this should lead
            // into the slot-picker question right below, not book immediately.
            {'id': 'm2', 'label': '🏡 Book Site Visit', 'action': 'none'},
          ],
        },
        {
          'id': 'site_visit_slots',
          'questionText': 'Which time works best for your visit?',
          'mapsTo': 'none',
          'options': [
            {'id': 's0', 'label': 'Morning', 'action': 'site_visit'},
            {'id': 's1', 'label': 'Afternoon', 'action': 'site_visit'},
            {'id': 's2', 'label': 'Evening', 'action': 'site_visit'},
          ],
        },
      ],
      'closingPrompt': 'Would you like to talk to our advisor, or book a site visit?',
      'nudgesEnabled': false,
      'nudgeText': '',
      'testPhones': [],
    }));

/// Agents saved before this change carried purposeOptions / budgetBrackets /
/// timelineOptions instead of one unified qualifyingQuestions list —
/// synthesized into the same question shape they always behaved as.
List<Map<String, dynamic>> _legacyPurposeBudgetTimeline(Map<String, dynamic> f) {
  final qs = <Map<String, dynamic>>[];
  List l(String k) => (f[k] as List?) ?? const [];
  List<Map<String, dynamic>> withNoneAction(List rows) => rows
      .whereType<Map>()
      .map((r) => {...Map<String, dynamic>.from(r), 'action': 'none'})
      .toList();
  if (l('purposeOptions').isNotEmpty) {
    qs.add({
      'id': 'purpose',
      'questionText': f['purposeQuestion'] ?? 'Are you exploring this primarily for:',
      'options': withNoneAction(l('purposeOptions')),
      'mapsTo': 'purpose',
    });
  }
  if (l('budgetBrackets').isNotEmpty) {
    qs.add({
      'id': 'budget',
      'questionText': "Perfect. What's your approximate budget range?",
      'options': withNoneAction(l('budgetBrackets')),
      'mapsTo': 'budget',
    });
  }
  if (l('timelineOptions').isNotEmpty) {
    qs.add({
      'id': 'timeline',
      'questionText': 'Got it. When are you looking to finalize?',
      'options': withNoneAction(l('timelineOptions')),
      'mapsTo': 'timeline',
    });
  }
  return qs;
}

/// A legacy menu option with action "site_visit" meant "open the slot
/// picker" back when that was a separate hardcoded step — remapped to
/// "none" here, since the equivalent now is simply that the site-visit
/// question comes right after this one in the array, and "none" already
/// means "move to the next question."
List<Map<String, dynamic>> _legacyMenuAndSiteVisit(Map<String, dynamic> f) {
  final qs = <Map<String, dynamic>>[];
  List l(String k) => (f[k] as List?) ?? const [];
  if (l('menuOptions').isNotEmpty) {
    qs.add({
      'id': 'menu',
      'questionText': f['menuPrompt'] ?? 'Great, what would you like to see next?',
      'options': l('menuOptions').whereType<Map>().map((m) {
        final action = m['action'] as String?;
        return {'id': m['id'], 'label': m['label'], 'action': action == 'site_visit' ? 'none' : (action ?? 'none')};
      }).toList(),
      'mapsTo': 'none',
    });
  }
  if (l('siteVisitSlots').isNotEmpty) {
    qs.add({
      'id': 'site_visit_slots',
      'questionText': f['siteVisitPrompt'] ?? 'Which time works best for your visit?',
      'options': l('siteVisitSlots').whereType<Map>().map((s) => {'id': s['id'], 'label': s['label'], 'action': 'site_visit'}).toList(),
      'mapsTo': 'none',
    });
  }
  return qs;
}

/// Handles three states, not just "fully legacy" vs. "fully migrated":
///   1. No qualifyingQuestions at all — everything (purpose/budget/timeline
///      AND menu/site-visit) is synthesized from the old separate fields.
///   2. qualifyingQuestions already has entries (e.g. purpose/budget/
///      timeline were migrated at some point) but menuOptions/
///      siteVisitSlots are STILL separate, un-folded fields — those two
///      questions are appended on top, since otherwise this in-between
///      state silently drops the menu/site-visit steps entirely (a real
///      bug: an agent migrated before menu/site-visit were folded in lost
///      both steps from its live flow, not just this editor — mirrors
///      ctwaFlowService.js's identical getQualifyingQuestions exactly).
///   3. qualifyingQuestions already includes a folded-in "menu" /
///      "site_visit_slots" question (tenant re-saved through the current
///      builder) — nothing appended, no duplicates.
List<Map<String, dynamic>> _resolveQualifyingQuestions(Map<String, dynamic> f) {
  final saved = _mapList(f['qualifyingQuestions']);
  final qs = saved.isNotEmpty ? saved : _legacyPurposeBudgetTimeline(f);
  final hasMenu = qs.any((q) => q['id'] == 'menu');
  final hasSlots = qs.any((q) => q['id'] == 'site_visit_slots');
  if (!hasMenu || !hasSlots) {
    for (final q in _legacyMenuAndSiteVisit(f)) {
      if ((q['id'] == 'menu' && !hasMenu) || (q['id'] == 'site_visit_slots' && !hasSlots)) qs.add(q);
    }
  }
  return qs;
}

List<Map<String, dynamic>> _mapList(dynamic v) =>
    (v as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

/// Create/edit one AI assistant, with a live "Try it" console and CTWA flow
/// preview. Mirrors frontend/src/pages/conversations/AgentBuilder.jsx against
/// GET/POST/PATCH /whatsapp/agents[/:id], POST /whatsapp/agents/preview,
/// GET /projects.
class AgentBuilderScreen extends StatefulWidget {
  final String? agentId;
  const AgentBuilderScreen({super.key, this.agentId});

  @override
  State<AgentBuilderScreen> createState() => _AgentBuilderScreenState();
}

class _AgentBuilderScreenState extends State<AgentBuilderScreen> {
  final _api = ApiClient.instance;
  bool get _isNew => widget.agentId == null;
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _readiness;

  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _status = 'draft';
  final _greetingCtrl = TextEditingController();
  final _businessContextCtrl = TextEditingController();
  final _groundRulesCtrl = TextEditingController();
  String _language = 'auto';
  final _systemPromptCtrl = TextEditingController();
  bool _showAdvanced = false;
  bool _shareProjectPhotos = false;
  bool _shareBrochure = false;
  bool _shareVideos = false;
  bool _shareFloorPlan = false;
  final Set<String> _projectIds = {};
  List<Map<String, dynamic>> _projects = [];
  final List<String> _adIds = [];
  final _adIdCtrl = TextEditingController();

  // CTWA flow
  Map<String, dynamic> _flow = _defaultFlow();
  final _welcomeCtrl = TextEditingController();
  final _closingPromptCtrl = TextEditingController();
  final _nudgeTextCtrl = TextEditingController();
  Map<String, dynamic>? _funnel;
  bool _funnelError = false;
  int _funnelDays = 30;
  final _testPhoneCtrl = TextEditingController();

  // Try-it console
  final List<Map<String, dynamic>> _tryLog = [];
  final _tryCtrl = TextEditingController();
  final _tryScroll = ScrollController();
  bool _trying = false;
  Map<String, dynamic>? _tryMeta;
  bool _showPrompt = false;

  @override
  void initState() {
    super.initState();
    _applyFlowToControllers();
    _load();
  }

  Future<void> _loadFunnel() async {
    if (_isNew) return;
    setState(() { _funnel = null; _funnelError = false; });
    try {
      final res = await _api.dio.get('/whatsapp/agents/${widget.agentId}/funnel', queryParameters: {'days': _funnelDays});
      if (mounted) setState(() => _funnel = (res.data as Map).cast<String, dynamic>());
    } catch (_) {
      if (mounted) setState(() => _funnelError = true);
    }
  }

  Widget _funnelCard() {
    final t = AppTheme.of(context);
    final f = _funnel;
    final started = (f?['started'] as num?)?.toInt() ?? 0;
    Widget body;
    if (_funnelError) {
      body = Text("Couldn't load the funnel.", style: TextStyle(fontSize: 12, color: t.textSoft));
    } else if (f == null) {
      body = const Padding(padding: EdgeInsets.all(8), child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))));
    } else if (started == 0) {
      body = Text('No conversations have gone through this flow in the last $_funnelDays days yet.', style: TextStyle(fontSize: 12, color: t.textSoft));
    } else {
      final steps = [
        {'label': 'Started the flow', 'reached': started},
        ...((f['steps'] as List).cast<Map<String, dynamic>>()),
      ];
      final o = (f['outcomes'] as Map).cast<String, dynamic>();
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final st in steps)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(width: 110, child: Text('${st['label']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: t.textSoft))),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: ((st['reached'] as num) / started).clamp(0, 1).toDouble(),
                        minHeight: 8,
                        color: AppColors.primary,
                        backgroundColor: t.border,
                      ),
                    ),
                  ),
                  SizedBox(width: 70, child: Text('${st['reached']} (${((st['reached'] as num) / started * 100).round()}%)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700))),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text(
            '${o['siteVisit']} booked a site visit · ${o['advisor']} asked for an advisor · ${o['exited']} typed instead of tapping · ${o['open']} still open or went quiet',
            style: TextStyle(fontSize: 11.5, height: 1.4, color: t.textSoft),
          ),
          const SizedBox(height: 4),
          Text("Steps a customer skipped because their form already answered them aren't counted.", style: TextStyle(fontSize: 10.5, color: t.textSoft)),
        ],
      );
    }
    return _bordered(
      children: [
        Row(
          children: [
            const Expanded(child: Text('Flow drop-off', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800))),
            for (final d in [7, 30, 90])
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: ChoiceChip(
                  label: Text('${d}d', style: const TextStyle(fontSize: 11)),
                  selected: _funnelDays == d,
                  visualDensity: VisualDensity.compact,
                  onSelected: (_) { _funnelDays = d; _loadFunnel(); },
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        body,
      ],
    );
  }

  @override
  void dispose() {
    for (final c in [
      _nameCtrl, _descCtrl, _greetingCtrl, _businessContextCtrl, _groundRulesCtrl,
      _systemPromptCtrl, _adIdCtrl, _welcomeCtrl,
      _closingPromptCtrl, _nudgeTextCtrl, _testPhoneCtrl, _tryCtrl,
    ]) {
      c.dispose();
    }
    _tryScroll.dispose();
    super.dispose();
  }

  void _applyFlowToControllers() {
    _welcomeCtrl.text = _flow['welcomeText'] as String? ?? '';
    _closingPromptCtrl.text = _flow['closingPrompt'] as String? ?? '';
    _nudgeTextCtrl.text = _flow['nudgeText'] as String? ?? '';
  }

  List<Map<String, dynamic>> get _questions => (_flow['qualifyingQuestions'] as List).cast<Map<String, dynamic>>();
  List<String> get _testPhones => (_flow['testPhones'] as List).cast<String>();
  bool get _ctwaEnabled => _flow['enabled'] == true;

  Future<void> _load() async {
    try {
      final projRes = await _api.dio.get('/projects');
      _projects = _mapList(projRes.data['data']);
    } catch (_) {}

    if (!_isNew) {
      try {
        final res = await _api.dio.get('/whatsapp/agents/${widget.agentId}');
        final a = Map<String, dynamic>.from(res.data['agent'] as Map);
        _nameCtrl.text = a['name'] as String? ?? '';
        _descCtrl.text = a['description'] as String? ?? '';
        _status = a['status'] as String? ?? 'draft';
        _greetingCtrl.text = a['greeting'] as String? ?? '';
        _businessContextCtrl.text = a['businessContext'] as String? ?? '';
        _groundRulesCtrl.text = a['groundRules'] as String? ?? '';
        _language = a['language'] as String? ?? 'auto';
        _systemPromptCtrl.text = a['systemPrompt'] as String? ?? '';
        _showAdvanced = _systemPromptCtrl.text.isNotEmpty;
        _shareProjectPhotos = a['shareProjectPhotos'] == true;
        _shareBrochure = a['shareBrochure'] == true;
        _shareVideos = a['shareVideos'] == true;
        _shareFloorPlan = a['shareFloorPlan'] == true;
        _projectIds.addAll((a['projectIds'] as List? ?? const [])
            .map((p) => (p is Map ? p['_id'] : p).toString()));
        _adIds.addAll((a['adIds'] as List? ?? const []).map((e) => e.toString()));
        _readiness = (a['readiness'] as Map?)?.cast<String, dynamic>();

        final ctwa = a['ctwaFlow'];
        if (ctwa is Map && ctwa['welcomeText'] != null) {
          final c = Map<String, dynamic>.from(ctwa);
          final merged = _defaultFlow()..addAll(c);
          merged['qualifyingQuestions'] = _resolveQualifyingQuestions(c);
          for (final q in (merged['qualifyingQuestions'] as List)) {
            q['options'] = _mapList(q['options'])
                .map((o) => {...o, 'action': o['action'] ?? 'none'})
                .toList();
          }
          merged['testPhones'] = (c['testPhones'] as List? ?? const []).map((e) => e.toString()).toList();
          _flow = merged;
          _applyFlowToControllers();
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not load this assistant'), backgroundColor: AppColors.danger),
          );
        }
      }
    }
    if (mounted) setState(() => _loading = false);
    _loadFunnel();
  }

  Map<String, dynamic> _buildForm() {
    final flow = Map<String, dynamic>.from(_flow)
      ..['welcomeText'] = _welcomeCtrl.text.trim()
      ..['closingPrompt'] = _closingPromptCtrl.text.trim()
      ..['nudgeText'] = _nudgeTextCtrl.text.trim();
    return {
      'name': _nameCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'status': _status,
      'greeting': _greetingCtrl.text.trim(),
      'businessContext': _businessContextCtrl.text.trim(),
      'groundRules': _groundRulesCtrl.text.trim(),
      'projectIds': _projectIds.toList(),
      'systemPrompt': _systemPromptCtrl.text.trim(),
      'language': _language,
      'adIds': _adIds,
      'shareProjectPhotos': _shareProjectPhotos,
      'shareBrochure': _shareBrochure,
      'shareVideos': _shareVideos,
      'shareFloorPlan': _shareFloorPlan,
      'ctwaFlow': flow,
    };
  }

  void _toast(String m, {bool err = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(m), backgroundColor: err ? AppColors.danger : null),
    );
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      _toast('Give the assistant a name first.');
      return;
    }
    setState(() => _saving = true);
    try {
      if (_isNew) {
        final res = await _api.dio.post('/whatsapp/agents', data: _buildForm());
        final agent = Map<String, dynamic>.from(res.data['agent'] as Map);
        _toast('${agent['name']} created');
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => AgentBuilderScreen(agentId: agent['_id'] as String)),
          );
        }
      } else {
        final res = await _api.dio.patch('/whatsapp/agents/${widget.agentId}', data: _buildForm());
        final agent = Map<String, dynamic>.from(res.data['agent'] as Map);
        if (mounted) setState(() => _readiness = (agent['readiness'] as Map?)?.cast<String, dynamic>());
        _toast('Saved');
      }
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Could not save'), err: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete assistant'),
        content: Text('Delete "${_nameCtrl.text}"? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: AppColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/whatsapp/agents/${widget.agentId}');
      _toast('Assistant deleted');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _toast(ApiClient.errorMessage(e, 'Could not delete'), err: true);
    }
  }

  Future<void> _sendTry() async {
    final text = _tryCtrl.text.trim();
    if (text.isEmpty || _trying) return;
    _tryCtrl.clear();
    final history = _tryLog
        .where((m) => m['role'] == 'user' || m['role'] == 'assistant')
        .map((m) => {'role': m['role'], 'body': m['body']})
        .toList();
    setState(() {
      _tryLog.add({'role': 'user', 'body': text});
      _trying = true;
    });
    _scrollTryToEnd();
    try {
      final res = await _api.dio.post('/whatsapp/agents/preview', data: {
        'message': text,
        'history': history,
        'agent': _buildForm(),
      });
      final data = Map<String, dynamic>.from(res.data as Map);
      if (!mounted) return;
      setState(() {
        if ((data['greeting'] as String?)?.isNotEmpty == true) {
          _tryLog.add({'role': 'assistant', 'body': data['greeting'], 'isGreeting': true});
        }
        _tryLog.add({
          'role': 'assistant',
          'body': (data['reply'] as String?)?.isNotEmpty == true ? data['reply'] : '(no reply)',
          'handoff': data['handoff'] == true,
          'wantsPhotos': data['wantsPhotos'] == true,
          'wantsBrochure': data['wantsBrochure'] == true,
          'wantsVideos': data['wantsVideos'] == true,
          'wantsFloorPlan': data['wantsFloorPlan'] == true,
        });
        _tryMeta = data;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _tryLog.add({'role': 'error', 'body': ApiClient.errorMessage(e, 'The assistant could not answer.')}));
      }
    } finally {
      if (mounted) setState(() => _trying = false);
      _scrollTryToEnd();
    }
  }

  void _scrollTryToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_tryScroll.hasClients) {
        _tryScroll.animateTo(_tryScroll.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: AppSpinner()));
    final t = AppTheme.of(context);
    final narrowScope = _projectIds.isNotEmpty && _projectIds.length < _projects.length / 2;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isNew ? 'New AI Agent' : (_nameCtrl.text.trim().isEmpty ? 'AI Agent' : _nameCtrl.text.trim()), overflow: TextOverflow.ellipsis),
        actions: [
          if (!_isNew) IconButton(icon: const Icon(Icons.delete_outline), tooltip: 'Delete', onPressed: _delete),
        ],
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.translucent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 14, left: 2),
              child: Text('What this assistant knows, how it talks, and which messages reach it',
                  style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            ),
            WaCard(
              title: 'Identity',
              icon: Icons.auto_awesome,
              children: [
                WaField(label: 'Name', controller: _nameCtrl, hint: 'e.g. Arohi', onChanged: (_) => setState(() {})),
                WaSelect<String>(
                  label: 'Status',
                  value: _status,
                  options: _statuses,
                  onChanged: (v) => setState(() => _status = v ?? _status),
                ),
                WaField(
                  label: 'What it does',
                  note: '(for your team, never sent to customers)',
                  controller: _descCtrl,
                  hint: 'e.g. Qualifies leads and books site visits for Treetopia',
                ),
                WaSelect<String>(
                  label: 'Reply language',
                  value: _language,
                  options: _languages,
                  onChanged: (v) => setState(() => _language = v ?? _language),
                ),
              ],
            ),
            WaCard(
              title: 'How it talks',
              children: [
                WaField(
                  label: 'Greeting',
                  note: '(optional)',
                  controller: _greetingCtrl,
                  maxLines: 3,
                  hint: 'Hi! Thanks for reaching out — how can I help you find your next home?',
                  help: 'Sent automatically as the first message when someone new writes in.',
                ),
                WaField(
                  label: 'Business context',
                  note: '(optional)',
                  controller: _businessContextCtrl,
                  maxLines: 4,
                  hint: 'Who you are, service area, working hours, anything the assistant should know about your business.',
                ),
                WaField(
                  label: 'Ground rules',
                  note: '(optional)',
                  controller: _groundRulesCtrl,
                  maxLines: 4,
                  hint: "Dos and don'ts — e.g. never discuss competitor pricing, always ask for a preferred visit time before booking a site visit.",
                ),
              ],
            ),
            _discussCard(narrowScope),
            WaCard(
              title: 'What it can send',
              icon: Icons.image_outlined,
              description:
                  'Off by default. Some teams want a human to qualify a lead before anything visual goes out — this is that gate, separate from what the assistant is allowed to talk about.',
              children: [
                WaCheckRow(
                  value: _shareProjectPhotos,
                  onChanged: (v) => setState(() => _shareProjectPhotos = v),
                  title: 'Can send project photos',
                  subtitle: 'Only for projects that actually have photos uploaded — add them on the Projects page.',
                ),
                WaCheckRow(
                  value: _shareBrochure,
                  onChanged: (v) => setState(() => _shareBrochure = v),
                  title: 'Can send the brochure (PDF)',
                  subtitle: 'Only for projects that have a brochure uploaded — add one on the Projects page.',
                ),
                WaCheckRow(
                  value: _shareVideos,
                  onChanged: (v) => setState(() => _shareVideos = v),
                  title: 'Can send the project video',
                  subtitle: 'Only for projects that have a video uploaded (up to 10MB) — add one on the Projects page.',
                ),
                WaCheckRow(
                  value: _shareFloorPlan,
                  onChanged: (v) => setState(() => _shareFloorPlan = v),
                  title: 'Can send the floor plan (PDF)',
                  subtitle: 'Only for projects that have a floor plan uploaded — add one on the Projects page.',
                ),
                const WaNotice(
                  "Works on the direct Arthaleads connection only — not on AiSensy, Wati or Interakt. The assistant only ever sends what's relevant to what was just discussed, never on the first reply.",
                ),
              ],
            ),
            _adsCard(),
            _ctwaCard(),
            _advancedCard(),
            const SizedBox(height: 4),
            GradientButton(
              fullWidth: true,
              loading: _saving,
              onPressed: _saving ? null : _save,
              child: Text(_isNew ? 'Create agent' : 'Save changes'),
            ),
            const SizedBox(height: 24),
            _tryConsole(),
            _CtwaPreview(
              flow: _flowForPreview(),
              projectName: () {
                for (final p in _projects) {
                  if (_projectIds.contains(p['_id'].toString())) return p['name'] as String?;
                }
                return null;
              }(),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, dynamic> _flowForPreview() => Map<String, dynamic>.from(_flow)
    ..['welcomeText'] = _welcomeCtrl.text
    ..['closingPrompt'] = _closingPromptCtrl.text;

  // ── What it can discuss ────────────────────────────────────────────────
  Widget _discussCard(bool narrowScope) {
    final t = AppTheme.of(context);
    return WaCard(
      title: 'What it can discuss',
      icon: Icons.apartment_rounded,
      description:
          'Answers come from your real Projects, not a crawled website. Edit a price on the Projects page and the next reply reflects it — nothing to re-sync.',
      children: [
        Text('Leave everything unchecked to allow all of your active projects.', style: TextStyle(fontSize: 12, color: t.textSoft)),
        const SizedBox(height: 10),
        if (_projects.isEmpty)
          WaNotice('No projects yet — add some on the Projects page first.')
        else
          Container(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
            child: Column(
              children: [
                for (var i = 0; i < _projects.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: t.border),
                  InkWell(
                    onTap: () => setState(() {
                      final id = _projects[i]['_id'].toString();
                      _projectIds.contains(id) ? _projectIds.remove(id) : _projectIds.add(id);
                    }),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 22,
                            height: 22,
                            child: Checkbox(
                              value: _projectIds.contains(_projects[i]['_id'].toString()),
                              activeColor: AppColors.primary,
                              visualDensity: VisualDensity.compact,
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              onChanged: (v) => setState(() {
                                final id = _projects[i]['_id'].toString();
                                v == true ? _projectIds.add(id) : _projectIds.remove(id);
                              }),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_projects[i]['name'] as String? ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                if ((_projects[i]['location'] as String?)?.isNotEmpty == true)
                                  Text(_projects[i]['location'] as String, style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        if (_projectIds.isNotEmpty)
          WaNotice(
            'This assistant can only discuss ${_projectIds.length} of your ${_projects.length} active project${_projects.length == 1 ? '' : 's'}. Ask it about any of the others and it will say your team will follow up. Uncheck everything to allow all ${_projects.length}.',
            warn: narrowScope,
          ),
      ],
    );
  }

  // ── Ads ────────────────────────────────────────────────────────────────
  void _addAd() {
    final v = _adIdCtrl.text.trim();
    if (v.isEmpty) return;
    if (!_adIds.contains(v)) setState(() => _adIds.add(v));
    _adIdCtrl.clear();
  }

  Widget _adsCard() {
    return WaCard(
      title: 'Route ads to this agent',
      icon: Icons.campaign_outlined,
      description:
          'Running a Click-to-WhatsApp ad? Paste its Ad ID (from Ads Manager — the ad, not the campaign). Anyone who messages in from that ad reaches this assistant, whichever one is your default.',
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: TextField(
                controller: _adIdCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                decoration: waDecoration(context, hint: 'Ad ID e.g. 1202101234567890'),
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _addAd(),
              ),
            ),
            const SizedBox(width: 8),
            WaAddButton(onPressed: _adIdCtrl.text.trim().isEmpty ? null : _addAd),
          ],
        ),
        if (_adIds.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final ad in _adIds) WaChip(ad, mono: true, onDelete: () => setState(() => _adIds.remove(ad)))],
            ),
          ),
      ],
    );
  }

  // ── CTWA flow ──────────────────────────────────────────────────────────
  void _addTestPhone() {
    final v = _testPhoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (v.isEmpty) return;
    if (!_testPhones.contains(v) && _testPhones.length < 25) setState(() => _testPhones.add(v));
    _testPhoneCtrl.clear();
  }

  Widget _ctwaCard() {
    final t = AppTheme.of(context);
    final phones = _testPhones.length;
    final String scope = phones > 0
        ? "Locked to testing — only the $phones number${phones > 1 ? 's' : ''} below get this flow right now. Everyone else, including genuine leads, gets the normal conversation. Clear the list below once you're done verifying it."
        : _adIds.isNotEmpty
            ? 'Reserved for leads from the ${_adIds.length} ad${_adIds.length > 1 ? 's' : ''} routed above — anyone else reaching this assistant gets the normal free-text conversation instead.'
            : '"Route ads to this agent" above is empty, so this runs for every conversation this assistant handles — including genuine leads reaching it right now. Add test numbers below to restrict it to just your own team while you verify it, or add an Ad ID above once you\'re ready to restrict it to actual ad clicks.';
    return WaCard(
      title: 'CTWA button flow',
      icon: Icons.touch_app_outlined,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_ctwaEnabled ? 'On' : 'Off', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          Switch(
            value: _ctwaEnabled,
            activeThumbColor: AppColors.primary,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            onChanged: (v) => setState(() => _flow['enabled'] = v),
          ),
        ],
      ),
      description:
          "Replace the first few free-text qualifying questions with real WhatsApp buttons/lists — your own questions, in your own order — followed by what they want next and a site-visit time. Answers write straight onto the lead when they clearly map to a field; anything else is still recorded, just not forced onto the wrong one. Anyone who free-types instead of tapping drops back into this assistant's usual conversation. (Growth plan or higher.)",
      children: [
        WaNotice(scope),
        const SizedBox(height: 14),
        _bordered(
          children: [
            const WaLabel('Test phone numbers', note: '(temporary — for verifying live before real leads see it)'),
            Text(
              "Add your own WhatsApp numbers here. While this list isn't empty, the button flow only replies to these numbers — every other conversation this assistant handles falls back to the normal chat, so you can message the number yourself and watch it work without touching real leads.",
              style: TextStyle(fontSize: 11.5, height: 1.4, color: t.textSoft),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _testPhoneCtrl,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                    decoration: waDecoration(context, hint: 'e.g. 919876543210'),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _addTestPhone(),
                  ),
                ),
                const SizedBox(width: 8),
                WaAddButton(onPressed: _testPhoneCtrl.text.trim().isEmpty ? null : _addTestPhone),
              ],
            ),
            if (_testPhones.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [for (final p in _testPhones) WaChip(p, mono: true, onDelete: () => setState(() => _testPhones.remove(p)))],
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        _bordered(
          children: [
            Text('MESSAGE 1 OF 2 — SENT FIRST, PLAIN TEXT (OPTIONAL)',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: t.textSoft)),
            const SizedBox(height: 10),
            WaField(
              label: 'Welcome message',
              controller: _welcomeCtrl,
              maxLines: 3,
              maxLength: 500,
              hint: 'Hi {{name}} 👋 Thanks for your interest in {{project}}!',
              help:
                  'Use {{name}} and {{project}}. Sent on its own — a greeting bundled into the same message as the first question reads as the bot talking over itself. Leave this blank if the ad\'s own "Automated greeting" (Ads Manager → Conversations) already covers it — the flow then opens straight with the first question below, no double greeting.',
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text('QUALIFYING QUESTIONS — SENT ONE AT A TIME, IN THIS ORDER',
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: t.textSoft)),
        const SizedBox(height: 10),
        for (var i = 0; i < _questions.length; i++)
          _QuestionEditor(
            key: ValueKey(_questions[i]['id']),
            question: _questions[i],
            index: i,
            total: _questions.length,
            allQuestions: _questions,
            onChanged: () => setState(() {}),
            onRemove: () => setState(() => _questions.removeAt(i)),
            onMove: (d) => setState(() {
              final to = i + d;
              if (to < 0 || to >= _questions.length) return;
              final q = _questions.removeAt(i);
              _questions.insert(to, q);
            }),
          ),
        WaPillButton(
          'Add another question',
          icon: Icons.add,
          full: true,
          // Generous headroom above the old fixed 3 (purpose/budget/timeline)
          // now that what used to be the separate "what next?" and "site
          // visit" steps are just more entries in this same list. Mirrors
          // web's MAX_QUALIFYING_QUESTIONS / backend CTWA_MAX_QUESTIONS.
          onPressed: _questions.length >= 8
              ? null
              : () => setState(() => _questions.add({
                    'id': 'q_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}',
                    'questionText': '',
                    'options': <Map<String, dynamic>>[],
                    'mapsTo': 'none',
                  })),
        ),
        const SizedBox(height: 14),
        WaField(
          label: 'Closing prompt',
          controller: _closingPromptCtrl,
          hint: 'Would you like to talk to our advisor, or book a site visit?',
          help: 'The one fixed ending — sent once every question above has been asked (or straight away if the lead already answered all of them elsewhere). Its two buttons, "Talk to Advisor" and "Book Site Visit", are not editable: "Book Site Visit" re-asks whichever question above has every option set to "book a site visit", or books immediately if none do.',
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 14),
        _bordered(
          children: [
            WaCheckRow(
              value: _flow['nudgesEnabled'] == true,
              onChanged: (v) => setState(() => _flow['nudgesEnabled'] = v),
              title: 'Follow up if they go quiet',
              subtitle: 'If someone stops answering mid-flow, send one gentle reminder after about 15 minutes and one last reminder shortly before the 24-hour reply window closes, each with the question and its buttons again. Business hours only, never more than two, and they stop as soon as the customer writes back.',
            ),
            if (_flow['nudgesEnabled'] == true) ...[
              const SizedBox(height: 8),
              WaField(
                label: 'First reminder wording',
                controller: _nudgeTextCtrl,
                hint: 'Just checking in 🙂',
                onChanged: (_) => setState(() {}),
              ),
            ],
          ],
        ),
        if (!_isNew && _ctwaEnabled) ...[
          const SizedBox(height: 14),
          _funnelCard(),
        ],
        Center(
          child: Text('Preview of this flow is at the bottom of the page ↓',
              style: TextStyle(fontSize: 11, color: t.textSoft)),
        ),
      ],
    );
  }

  Widget _bordered({required List<Widget> children}) {
    final t = AppTheme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: t.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }

  Widget _advancedCard() {
    final t = AppTheme.of(context);
    return WaCard(
      children: [
        InkWell(
          onTap: () => setState(() => _showAdvanced = !_showAdvanced),
          child: Row(
            children: [
              Icon(_showAdvanced ? Icons.expand_less : Icons.expand_more, size: 20, color: t.textSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Advanced: replace everything above with one custom prompt',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textSoft)),
              ),
            ],
          ),
        ),
        if (_showAdvanced) ...[
          const SizedBox(height: 12),
          WaField(
            label: '',
            controller: _systemPromptCtrl,
            maxLines: 6,
            hint: 'Leave blank to use the settings above. Writing anything here overrides them entirely.',
            help: 'When this is filled in, the greeting, business context, ground rules and project list are all ignored — you are fully in control of the prompt.',
          ),
        ],
      ],
    );
  }

  // ── Try it ─────────────────────────────────────────────────────────────
  Widget _tryConsole() {
    final t = AppTheme.of(context);
    final r = _readiness;
    final incomplete = r != null && (r['score'] as num) < (r['total'] as num);
    final missing = incomplete
        ? (r['checks'] as List? ?? const []).whereType<Map>().where((c) => c['ok'] != true).map((c) => c['label']).join(' · ')
        : '';
    return WaCard(
      title: 'Try it',
      icon: Icons.chat_bubble_outline_rounded,
      children: [
        if (incomplete) WaNotice('Setup ${r['score']}/${r['total']}. $missing', warn: true),
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 12),
          child: Text(
            'Tries exactly what is on screen now, saved or not. Nothing is sent over WhatsApp and no WhatsApp credit is used.',
            style: TextStyle(fontSize: 12.5, height: 1.4, color: t.textSoft),
          ),
        ),
        Container(
          constraints: BoxConstraints(minHeight: 180, maxHeight: (_tryLog.isEmpty && !_trying) ? 180 : 360),
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: t.surfaceLow,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: t.border),
          ),
          child: _tryLog.isEmpty && !_trying
              ? Center(
                  child: Text('Try “what projects do you have in Pune?” or “price of a 2BHK?”',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12.5, fontStyle: FontStyle.italic, color: t.textSoft)),
                )
              : ListView(
                  controller: _tryScroll,
                  shrinkWrap: true,
                  children: [
                    for (final m in _tryLog) _tryBubble(m),
                    if (_trying)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: t.surfaceSolid,
                            border: Border.all(color: t.border),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _tryCtrl,
                textInputAction: TextInputAction.send,
                decoration: waDecoration(context, hint: 'Ask what a customer would ask…'),
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _sendTry(),
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: (_tryCtrl.text.trim().isEmpty || _trying) ? null : _sendTry,
              borderRadius: BorderRadius.circular(99),
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _tryCtrl.text.trim().isNotEmpty ? AppColors.primary : t.surfaceLow,
                ),
                child: Icon(Icons.send_rounded, size: 18, color: _tryCtrl.text.trim().isNotEmpty ? Colors.white : t.textSoft),
              ),
            ),
          ],
        ),
        if (_tryMeta != null) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  color: (_tryMeta!['projectsInScope'] == 0 && _tryMeta!['usingCustomPrompt'] != true)
                      ? AppColors.danger.withValues(alpha: 0.10)
                      : t.surfaceLow,
                ),
                child: Text(
                  _tryMeta!['usingCustomPrompt'] == true
                      ? 'Using your custom prompt'
                      : 'Knows ${_tryMeta!['projectsInScope']} of ${_tryMeta!['activeProjects']} projects',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: (_tryMeta!['projectsInScope'] == 0 && _tryMeta!['usingCustomPrompt'] != true) ? AppColors.danger : t.textSoft,
                  ),
                ),
              ),
              if (_tryLog.isNotEmpty)
                InkWell(
                  onTap: () => setState(() => _tryLog.clear()),
                  child: Text('Clear', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSoft)),
                ),
              InkWell(
                onTap: () => setState(() => _showPrompt = !_showPrompt),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.visibility_outlined, size: 14, color: t.textSoft),
                    const SizedBox(width: 4),
                    Text('${_showPrompt ? 'Hide' : 'Show'} what it was told',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.textSoft)),
                  ],
                ),
              ),
            ],
          ),
          if (_showPrompt)
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 280),
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: t.surfaceLow,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: t.border),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  '${_tryMeta!['systemPrompt'] ?? ''}',
                  style: TextStyle(fontSize: 11, height: 1.45, color: t.textSoft),
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _tryBubble(Map<String, dynamic> m) {
    final t = AppTheme.of(context);
    final role = m['role'] as String;
    final isUser = role == 'user';
    final isErr = role == 'error';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: isErr
              ? AppColors.danger.withValues(alpha: 0.10)
              : isUser
                  ? AppColors.primary.withValues(alpha: 0.16)
                  : t.surfaceSolid,
          border: Border.all(color: isErr ? AppColors.danger.withValues(alpha: 0.3) : t.border),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(isUser ? 16 : 4),
            topRight: Radius.circular(isUser ? 4 : 16),
            bottomLeft: const Radius.circular(16),
            bottomRight: const Radius.circular(16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (m['isGreeting'] == true)
              const Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Text('Sent automatically — real Greeting text, not generated',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
            Text('${m['body'] ?? ''}',
                style: TextStyle(fontSize: 13.5, height: 1.4, color: isErr ? const Color(0xFFB91C1C) : t.text)),
            if (m['wantsPhotos'] == true || m['wantsBrochure'] == true || m['wantsVideos'] == true || m['wantsFloorPlan'] == true)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '📎 would send ${[if (m['wantsPhotos'] == true) 'project photos', if (m['wantsVideos'] == true) 'the video', if (m['wantsFloorPlan'] == true) 'the floor plan', if (m['wantsBrochure'] == true) 'the brochure'].join(' and ')} here — not sent in Try It',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.primary),
                ),
              ),
            if (m['handoff'] == true)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text('→ would hand this thread to a human',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFFB45309))),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Reorderable removable rows (chips) ───────────────────────────────────

class _ReorderChips extends StatelessWidget {
  final List<Map<String, dynamic>> rows;
  final VoidCallback onChanged;
  const _ReorderChips({required this.rows, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return ReorderableListView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      buildDefaultDragHandles: false,
      onReorderItem: (from, to) {
        final r = rows.removeAt(from);
        rows.insert(to, r);
        onChanged();
      },
      children: [
        for (var i = 0; i < rows.length; i++)
          Container(
            key: ValueKey('${rows[i]['id']}_$i'),
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.only(left: 4, right: 4),
            decoration: BoxDecoration(
              color: t.surfaceLow,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: t.border),
            ),
            child: Row(
              children: [
                ReorderableDragStartListener(
                  index: i,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Icon(Icons.drag_indicator, size: 18, color: t.textSoft),
                  ),
                ),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: '${rows[i]['label']}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      children: [
                        if (rows[i]['min'] != null && rows[i]['max'] != null)
                          TextSpan(
                            text: '  ₹${rows[i]['min']} – ${(rows[i]['max'] == 0 || rows[i]['max'] == '0') ? 'no cap' : '₹${rows[i]['max']}'}',
                            style: TextStyle(fontWeight: FontWeight.w400, fontSize: 11.5, color: t.textSoft),
                          ),
                      ],
                    ),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: Icon(Icons.close, size: 16, color: t.textSoft),
                  onPressed: () {
                    rows.removeAt(i);
                    onChanged();
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Preset dropdown + free text + add, then the reorderable chips.
class _ChipRowEditor extends StatefulWidget {
  final String label;
  final int max;
  final List<String>? presets;
  final List<Map<String, dynamic>> rows;
  final VoidCallback onChanged;
  const _ChipRowEditor({required this.label, required this.max, this.presets, required this.rows, required this.onChanged});

  @override
  State<_ChipRowEditor> createState() => _ChipRowEditorState();
}

class _ChipRowEditorState extends State<_ChipRowEditor> {
  final _ctrl = TextEditingController();
  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  bool _has(String text) => widget.rows.any((r) => '${r['label']}'.toLowerCase() == text.toLowerCase());

  void _add(String text) {
    text = text.trim();
    if (text.isEmpty || widget.rows.length >= widget.max || _has(text)) return;
    widget.rows.add({'id': _slug(text, widget.rows.length), 'label': text});
    _ctrl.clear();
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final full = widget.rows.length >= widget.max;
    final remaining = widget.presets?.where((p) => !_has(p)).toList() ?? const <String>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        WaLabel(widget.label),
        if (remaining.isNotEmpty && !full)
          WaSelect<String>(
            label: '',
            value: null,
            hint: 'Quick add a common option…',
            dense: true,
            options: {for (final p in remaining) p: p},
            onChanged: (v) => v == null ? null : _add(v),
          ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                enabled: !full,
                style: const TextStyle(fontSize: 13),
                decoration: waDecoration(context, hint: 'Or type your own…', dense: true),
                onChanged: (_) => setState(() {}),
                onSubmitted: _add,
              ),
            ),
            const SizedBox(width: 8),
            WaAddButton(onPressed: (_ctrl.text.trim().isEmpty || full) ? null : () => _add(_ctrl.text)),
          ],
        ),
        if (widget.rows.isNotEmpty) _ReorderChips(rows: widget.rows, onChanged: () {
          widget.onChanged();
          setState(() {});
        }),
      ],
    );
  }
}

class _BudgetBracketEditor extends StatefulWidget {
  final List<Map<String, dynamic>> rows;
  final VoidCallback onChanged;
  const _BudgetBracketEditor({required this.rows, required this.onChanged});
  @override
  State<_BudgetBracketEditor> createState() => _BudgetBracketEditorState();
}

class _BudgetBracketEditorState extends State<_BudgetBracketEditor> {
  final _label = TextEditingController();
  final _min = TextEditingController();
  final _max = TextEditingController();
  @override
  void dispose() {
    _label.dispose();
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  bool _has(String l) => widget.rows.any((r) => '${r['label']}'.toLowerCase() == l.toLowerCase());

  void _addRow(String label, num min, num max) {
    if (widget.rows.length >= 10 || _has(label)) return;
    widget.rows.add({'id': _slug(label, widget.rows.length), 'label': label, 'min': min, 'max': max});
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final full = widget.rows.length >= 10;
    final remaining = _presetBudgetBrackets.where((p) => !_has(p['label'] as String)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const WaLabel('Budget brackets — up to 10, shown as a list'),
        if (remaining.isNotEmpty && !full)
          WaSelect<String>(
            label: '',
            value: null,
            hint: 'Quick add a common bracket…',
            dense: true,
            options: {for (final p in remaining) p['label'] as String: p['label'] as String},
            onChanged: (v) {
              if (v == null) return;
              final p = remaining.firstWhere((x) => x['label'] == v);
              _addRow(v, p['min'] as num, p['max'] as num);
            },
          ),
        TextField(
          controller: _label,
          enabled: !full,
          style: const TextStyle(fontSize: 13),
          decoration: waDecoration(context, hint: 'Label, e.g. ₹50L – ₹1Cr', dense: true),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _min,
                enabled: !full,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 13),
                decoration: waDecoration(context, hint: 'Min ₹', dense: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _max,
                enabled: !full,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 13),
                decoration: waDecoration(context, hint: 'Max ₹ (0 = no cap)', dense: true),
              ),
            ),
            const SizedBox(width: 8),
            WaAddButton(
              onPressed: (_label.text.trim().isEmpty || full)
                  ? null
                  : () {
                      _addRow(_label.text.trim(), num.tryParse(_min.text) ?? 0, num.tryParse(_max.text) ?? 0);
                      _label.clear();
                      _min.clear();
                      _max.clear();
                    },
            ),
          ],
        ),
        if (widget.rows.isNotEmpty) _ReorderChips(rows: widget.rows, onChanged: () {
          widget.onChanged();
          setState(() {});
        }),
      ],
    );
  }
}

// Used on any question that doesn't map to a real lead field ("Maps to" =
// "none") — this is what a "what next?" menu or a "which time works for
// you" slot picker actually is now: an ordinary question whose options
// happen to carry an action. Each option gets its own action dropdown,
// editable any time — not fixed at add-time the way it used to be.
class _OptionActionEditor extends StatefulWidget {
  final List<Map<String, dynamic>> rows;
  final VoidCallback onChanged;
  final List<Map<String, dynamic>> otherQuestions;
  const _OptionActionEditor({required this.rows, required this.onChanged, this.otherQuestions = const []});
  @override
  State<_OptionActionEditor> createState() => _OptionActionEditorState();
}

class _OptionActionEditorState extends State<_OptionActionEditor> {
  final _ctrl = TextEditingController();
  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  bool _has(String l) => widget.rows.any((r) => '${r['label']}'.toLowerCase() == l.toLowerCase());

  void _addRow(String label, String action) {
    if (widget.rows.length >= 10 || _has(label)) return;
    widget.rows.add({'id': _slug(label, widget.rows.length), 'label': label, 'action': action, 'next': ''});
    widget.onChanged();
    setState(() {});
  }

  Map<String, String> get _nextOptions => {
        '': 'Continue automatically (default)',
        for (final q in widget.otherQuestions)
          if ((q['questionText'] as String? ?? '').trim().isNotEmpty)
            q['id'] as String:
                'Skip to: ${(q['questionText'] as String).substring(0, (q['questionText'] as String).length > 40 ? 40 : (q['questionText'] as String).length)}',
        _kNextClosing: 'Skip straight to closing',
      };

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final full = widget.rows.length >= 10;
    final remaining = _presetMenuOptions.where((p) => !_has(p['label']!)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const WaLabel('Options — up to 10, shown as buttons if 3 or fewer, a list if more'),
        const Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: WaHelp('Each option can just record the answer and move to the next question, send something and still keep going (never a dead end), or end the flow outright.'),
        ),
        if (remaining.isNotEmpty && !full)
          WaSelect<String>(
            label: '',
            value: null,
            hint: 'Quick add a common option…',
            dense: true,
            options: {for (final p in remaining) p['label']!: p['label']!},
            onChanged: (v) {
              if (v == null) return;
              final p = remaining.firstWhere((x) => x['label'] == v);
              _addRow(v, p['action']!);
            },
          ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                enabled: !full,
                style: const TextStyle(fontSize: 13),
                decoration: waDecoration(context, hint: 'Or type your own…', dense: true),
                onChanged: (_) => setState(() {}),
                onSubmitted: (v) {
                  if (v.trim().isNotEmpty) {
                    _addRow(v.trim(), 'none');
                    _ctrl.clear();
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            WaAddButton(
              onPressed: (_ctrl.text.trim().isEmpty || full)
                  ? null
                  : () {
                      _addRow(_ctrl.text.trim(), 'none');
                      _ctrl.clear();
                    },
            ),
          ],
        ),
        if (widget.rows.isNotEmpty)
          ReorderableListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            onReorderItem: (from, to) {
              final r = widget.rows.removeAt(from);
              widget.rows.insert(to, r);
              widget.onChanged();
              setState(() {});
            },
            children: [
              for (var i = 0; i < widget.rows.length; i++)
                Container(
                  key: ValueKey('${widget.rows[i]['id']}_$i'),
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(14), border: Border.all(color: t.border)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          ReorderableDragStartListener(
                            index: i,
                            child: Padding(padding: const EdgeInsets.all(8), child: Icon(Icons.drag_indicator, size: 18, color: t.textSoft)),
                          ),
                          Expanded(
                            child: Text('${widget.rows[i]['label']}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                          ),
                          SizedBox(
                            width: 150,
                            child: WaSelect<String>(
                              label: '',
                              dense: true,
                              value: (widget.rows[i]['action'] as String?) ?? 'none',
                              options: _optionActions,
                              onChanged: (v) {
                                widget.rows[i]['action'] = v ?? 'none';
                                widget.onChanged();
                                setState(() {});
                              },
                            ),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            icon: Icon(Icons.close, size: 16, color: t.textSoft),
                            onPressed: () {
                              widget.rows.removeAt(i);
                              widget.onChanged();
                              setState(() {});
                            },
                          ),
                        ],
                      ),
                      if (!['advisor', 'site_visit'].contains(widget.rows[i]['action']))
                        Padding(
                          padding: const EdgeInsets.only(left: 34, right: 8, bottom: 6),
                          child: Row(
                            children: [
                              Text('Then', style: TextStyle(fontSize: 10.5, color: t.textSoft)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: WaSelect<String>(
                                  label: '',
                                  dense: true,
                                  value: (widget.rows[i]['next'] as String?) ?? '',
                                  options: _nextOptions,
                                  onChanged: (v) {
                                    widget.rows[i]['next'] = v ?? '';
                                    widget.onChanged();
                                    setState(() {});
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

class _QuestionEditor extends StatefulWidget {
  final Map<String, dynamic> question;
  final int index;
  final int total;
  final List<Map<String, dynamic>> allQuestions;
  final VoidCallback onChanged;
  final VoidCallback onRemove;
  final void Function(int dir) onMove;
  const _QuestionEditor({
    super.key,
    required this.question,
    required this.index,
    required this.total,
    this.allQuestions = const [],
    required this.onChanged,
    required this.onRemove,
    required this.onMove,
  });
  @override
  State<_QuestionEditor> createState() => _QuestionEditorState();
}

class _QuestionEditorState extends State<_QuestionEditor> {
  late final TextEditingController _text = TextEditingController(text: widget.question['questionText'] as String? ?? '');
  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final q = widget.question;
    final mapsTo = q['mapsTo'] as String? ?? 'none';
    final options = (q['options'] as List).cast<Map<String, dynamic>>();
    final presets = _mapsToPresets[mapsTo];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: t.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('QUESTION ${widget.index + 1} OF ${widget.total}',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: t.textSoft)),
              ),
              _iconBtn(Icons.keyboard_arrow_up, widget.index == 0 ? null : () => widget.onMove(-1)),
              _iconBtn(Icons.keyboard_arrow_down, widget.index == widget.total - 1 ? null : () => widget.onMove(1)),
              _iconBtn(Icons.delete_outline, widget.total <= 1 ? null : widget.onRemove, danger: true),
            ],
          ),
          const SizedBox(height: 10),
          WaField(
            label: 'Question text',
            controller: _text,
            hint: 'e.g. Are you looking for this primarily for:',
            onChanged: (v) {
              q['questionText'] = v;
              widget.onChanged();
            },
          ),
          WaSelect<String>(
            label: 'Maps to',
            value: mapsTo,
            options: _mapsToOptions,
            help: mapsTo == 'none'
                ? "The answer is just recorded and shown on the lead's Info tab — nothing is forced onto a specific field."
                : 'Only written to this field when the tapped option actually resolves to something real for it — anything else is recorded instead of guessed at.',
            onChanged: (v) {
              q['mapsTo'] = v ?? 'none';
              widget.onChanged();
            },
          ),
          if (mapsTo == 'budget')
            _BudgetBracketEditor(rows: options, onChanged: widget.onChanged)
          else if (mapsTo == 'none')
            _OptionActionEditor(
              rows: options,
              onChanged: widget.onChanged,
              otherQuestions: widget.allQuestions.where((oq) => oq['id'] != q['id']).toList(),
            )
          else
            _ChipRowEditor(
              label: 'Options — up to 10, shown as buttons if 3 or fewer, a list if more',
              max: 10,
              presets: presets,
              rows: options,
              onChanged: widget.onChanged,
            ),
        ],
      ),
    );
  }

  Widget _iconBtn(IconData i, VoidCallback? onTap, {bool danger = false}) => IconButton(
        visualDensity: VisualDensity.compact,
        constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
        padding: EdgeInsets.zero,
        icon: Icon(i, size: 20, color: onTap == null ? null : (danger ? AppColors.danger : null)),
        onPressed: onTap,
      );
}

// ── CTWA flow preview ─────────────────────────────────────────────────────
// Client-side simulation of ctwaFlowService.js: same branching, same order.
// Nothing here touches the API.

String _fillVars(String? text, Map<String, String> vars) =>
    (text ?? '').replaceAllMapped(RegExp(r'\{\{\s*(\w+)\s*\}\}'), (m) => vars[m[1]] ?? '');

class _CtwaPreview extends StatefulWidget {
  final Map<String, dynamic> flow;
  final String? projectName;
  const _CtwaPreview({required this.flow, required this.projectName});
  @override
  State<_CtwaPreview> createState() => _CtwaPreviewState();
}

class _CtwaPreviewState extends State<_CtwaPreview> {
  final List<Map<String, dynamic>> _log = [];
  String? _step;
  final _free = TextEditingController();
  bool _started = false;

  Map<String, String> get _vars => {'name': 'Ananya', 'project': widget.projectName ?? 'this project'};
  Map<String, dynamic> get _f => widget.flow;
  List<Map<String, dynamic>> get _qs => _mapList(_f['qualifyingQuestions']);

  @override
  void dispose() {
    _free.dispose();
    super.dispose();
  }

  void _push(Map<String, dynamic> e) => _log.add(e);

  void _restart() {
    setState(() {
      _log.clear();
      _free.clear();
      _started = true;
      if (_f['enabled'] != true) {
        _step = null;
        return;
      }
      final welcome = (_f['welcomeText'] as String? ?? '').trim();
      if (welcome.isNotEmpty) _push({'from': 'bot', 'text': _fillVars(welcome, _vars)});
      final qs = _qs;
      if (qs.isEmpty || _mapList(qs.first['options']).isEmpty) {
        _push({'from': 'bot', 'warn': true, 'text': 'No qualifying questions configured yet — add at least one above to preview past this step.'});
        _step = null;
        return;
      }
      final first = qs.first;
      final qt = _fillVars(first['questionText'] as String?, _vars);
      _push({'from': 'bot', 'text': qt.isEmpty ? '(question text is empty)' : qt, 'buttons': _mapList(first['options'])});
      _step = first['id'] as String?;
    });
  }

  // Sends one question, or a warning if it has no options yet (can happen
  // on an unsaved, still-being-edited question).
  void _sendQuestion(Map<String, dynamic> q) {
    final options = _mapList(q['options']);
    if (options.isEmpty) {
      _push({'from': 'bot', 'warn': true, 'text': 'This question has no options yet — add at least one above to preview past this step.'});
      _step = null;
      return;
    }
    final qt = _fillVars(q['questionText'] as String?, _vars);
    _push({'from': 'bot', 'text': qt.isEmpty ? '(question text is empty)' : qt, 'buttons': options});
    _step = q['id'] as String?;
  }

  void _sendClosing() {
    final c = (_f['closingPrompt'] as String? ?? '');
    _push({'from': 'bot', 'text': c.isEmpty ? 'Would you like to talk to our advisor, or book a site visit?' : c, 'buttons': _closingButtons});
    _step = 'closing';
  }

  void _bookSiteVisit() {
    _push({'from': 'bot', 'text': 'Wonderful! Our team will confirm your visit shortly and take it from here.'});
    _push({'from': 'bot', 'note': true, 'text': '✅ Lead updated: status → Site Visit, booking → Site Visit Booked, activity logged. Bot pauses and a human on your team is assigned and notified.'});
    _step = null;
  }

  // Matched by button id across every question, not by whatever step is
  // currently recorded — mirrors ctwaFlowService.advanceFlow exactly. A real
  // WhatsApp message's buttons never stop being tappable once a newer one is
  // sent, so every button in this preview stays live too, for as long as the
  // flow hasn't reached a true ending (advisor connected, or a site visit
  // booked).
  void _tap(Map<String, dynamic> opt) {
    setState(() {
      _push({'from': 'user', 'text': opt['label']});
      final qs = _qs;
      final qIndex = qs.indexWhere((q) => _mapList(q['options']).any((o) => o['id'] == opt['id']));
      final inClosing = _closingButtons.any((o) => o['id'] == opt['id']);

      if (qIndex != -1) {
        final action = (opt['action'] as String?) ?? 'none';
        if (action == 'advisor') {
          _push({'from': 'bot', 'text': "Connecting you with our advisor, they'll reach out to you shortly. You can also reach them directly on <their phone number>."});
          _push({'from': 'bot', 'note': true, 'text': '✅ Uses this project\'s "Talk to Advisor" contact if one is set (Projects page) — real name and phone number included so the lead can call directly; otherwise falls back to normal round-robin assignment with no number shown. Bot pauses and that person is notified.'});
          _step = null;
          return;
        }
        if (action == 'site_visit') {
          _bookSiteVisit();
          return;
        }
        // Informational — never a dead end, and never retires this
        // question's own buttons: they (and this one) stay tappable after.
        if (action == 'docs') {
          _push({'from': 'bot', 'note': true, 'text': '📄 Sends the floor plan PDF and the brochure PDF, whatever is uploaded for this project.'});
        } else if (action == 'photos') {
          _push({'from': 'bot', 'note': true, 'text': '🖼️ Sends up to 3 project photos and all uploaded videos, whatever is uploaded for this project.'});
        } else if (action == 'location') {
          _push({'from': 'bot', 'text': 'This project is located at: ${widget.projectName != null ? "(the project's saved location)" : "(no single project — assign one above to resolve this)"}'});
        }
        // An explicit "then go to" wins over the default array-order
        // progression — mirrors ctwaFlowService.advanceFlow exactly.
        final nextTarget = opt['next'] as String?;
        if (nextTarget == _kNextClosing) {
          _sendClosing();
        } else if (nextTarget != null && nextTarget.isNotEmpty) {
          final target = qs.cast<Map<String, dynamic>?>().firstWhere((q) => q!['id'] == nextTarget, orElse: () => null);
          if (target != null) {
            _sendQuestion(target);
          } else {
            _sendClosing();
          }
        } else if (qIndex + 1 < qs.length) {
          _sendQuestion(qs[qIndex + 1]);
        } else {
          _sendClosing();
        }
        return;
      }

      if (inClosing) {
        if (opt['id'] == 'advisor') {
          _push({'from': 'bot', 'text': "Connecting you with our advisor, they'll reach out to you shortly. You can also reach them directly on <their phone number>."});
          _push({'from': 'bot', 'note': true, 'text': '✅ Uses this project\'s "Talk to Advisor" contact if one is set (Projects page) — real name and phone number included so the lead can call directly; otherwise falls back to normal round-robin assignment with no number shown. Bot pauses and that person is notified.'});
          _step = null;
          return;
        }
        // "Book Site Visit" from the closing prompt — hand off to a
        // dedicated slot-picking question if one exists (every option books
        // a visit), otherwise book immediately.
        final slotsQuestion = qs.cast<Map<String, dynamic>?>().firstWhere(
              (q) {
                final options = _mapList(q!['options']);
                return options.isNotEmpty && options.every((o) => o['action'] == 'site_visit');
              },
              orElse: () => null,
            );
        if (slotsQuestion != null) {
          _sendQuestion(slotsQuestion);
        } else {
          _bookSiteVisit();
        }
      }
    });
  }

  void _sendFree() {
    final text = _free.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _push({'from': 'user', 'text': text});
      _push({'from': 'bot', 'note': true, 'text': "→ No button was tapped, so the flow exits here — this assistant's normal AI conversation answers this message instead."});
      _free.clear();
      _step = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final enabled = _f['enabled'] == true;
    if (enabled && !_started) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_started) _restart();
      });
    }
    return WaCard(
      title: 'Preview: CTWA button flow',
      icon: Icons.touch_app_outlined,
      description:
          'Simulated on your phone — nothing is sent, no credit is spent, no lead is touched. Uses whatever is on screen now, saved or not, the same way "Try it" above does.',
      children: [
        if (!enabled)
          WaNotice('Turn on the CTWA button flow above to preview it here.')
        else ...[
          Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxHeight: 460),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: t.surfaceLow, borderRadius: BorderRadius.circular(18)),
            child: SingleChildScrollView(
              reverse: true,
              child: Column(
                children: [for (final m in _log) _bubble(m)],
              ),
            ),
          ),
          if (_step != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _free,
                    style: const TextStyle(fontSize: 12.5),
                    decoration: waDecoration(context, hint: 'Or type something instead of tapping a button…', dense: true),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _sendFree(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _free.text.trim().isEmpty ? null : _sendFree,
                  icon: const Icon(Icons.send_rounded, size: 18),
                ),
              ],
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(_step != null ? 'Currently at: $_step' : 'Flow finished — restart to try a different path.',
                    style: TextStyle(fontSize: 11, color: t.textSoft)),
              ),
              TextButton(onPressed: _restart, child: const Text('Restart')),
            ],
          ),
        ],
      ],
    );
  }

  Widget _bubble(Map<String, dynamic> m) {
    final t = AppTheme.of(context);
    final isUser = m['from'] == 'user';
    final warn = m['warn'] == true;
    final note = m['note'] == true;
    final buttons = (m['buttons'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Container(
                padding: note ? const EdgeInsets.symmetric(horizontal: 4, vertical: 2) : const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: warn
                      ? AppColors.danger.withValues(alpha: 0.12)
                      : note
                          ? Colors.transparent
                          : isUser
                              ? AppColors.primary
                              : t.surfaceSolid,
                  border: (note || isUser) ? null : Border.all(color: warn ? AppColors.danger.withValues(alpha: 0.3) : t.border),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  '${m['text']}',
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    fontStyle: note ? FontStyle.italic : null,
                    color: warn
                        ? const Color(0xFFB91C1C)
                        : note
                            ? t.textSoft
                            : isUser
                                ? Colors.white
                                : t.text,
                  ),
                ),
              ),
              if (buttons.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final o in buttons)
                        InkWell(
                          onTap: () => _tap(o),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: t.surfaceSolid,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.primary),
                            ),
                            child: Text('${o['label']}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
