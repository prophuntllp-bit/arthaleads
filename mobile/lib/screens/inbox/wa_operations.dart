import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'wa_ui.dart';

/// Operational WhatsApp settings shown once a number is connected — business
/// hours, conversation auto-assignment, notification recipients, consent
/// compliance, and (Arthaleads-direct connections only) the WhatsApp Business
/// Profile. Mirrors frontend/src/components/WhatsAppOperations.jsx against
/// GET/PATCH /whatsapp/settings, GET /whatsapp/consent-summary and the
/// /whatsapp/business-profile* endpoints.
class WaOperationsSection extends StatefulWidget {
  const WaOperationsSection({super.key});

  @override
  State<WaOperationsSection> createState() => _WaOperationsSectionState();
}

class _WaOperationsSectionState extends State<WaOperationsSection> {
  final _api = ApiClient.instance;
  Map<String, dynamic>? _wa;
  List<Map<String, dynamic>> _agents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _api.dio.get('/whatsapp/settings'),
        _api.dio.get('/auth/agents'),
      ]);
      if (!mounted) return;
      setState(() {
        _wa = ((results[0].data as Map)['whatsapp'] as Map?)?.cast<String, dynamic>() ?? {};
        _agents = ((results[1].data as Map)['agents'] as List? ?? []).cast<Map<String, dynamic>>();
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _patch(Map<String, dynamic> fields) async {
    final res = await _api.dio.patch('/whatsapp/settings', data: fields);
    if (mounted) {
      setState(() => _wa = ((res.data as Map)['whatsapp'] as Map?)?.cast<String, dynamic>() ?? _wa);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 12),
        child: Center(child: AppSpinner(size: 24)),
      );
    }
    final wa = _wa;
    if (wa == null) return const SizedBox.shrink();
    // Business profile first: it is what customers actually see next to your
    // messages, and it is the thing an admin comes here to edit. Hours,
    // routing and notifications are set once and rarely revisited.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        const _BusinessProfileCard(),
        _BusinessHoursCard(wa: wa, patch: _patch),
        _AutoAssignCard(wa: wa, patch: _patch),
        _NotificationsCard(wa: wa, patch: _patch, agents: _agents),
        const _ConsentSnapshotCard(),
      ],
    );
  }
}

const _dayLabel = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'};
// Mon..Sun, matching org.whatsapp.businessHours.schedule's day: 0=Sun..6=Sat
const _dayOrder = [1, 2, 3, 4, 5, 6, 0];

class _DaySchedule {
  final int day;
  bool closed;
  String open;
  String close;
  _DaySchedule({required this.day, required this.closed, required this.open, required this.close});
}

class _BusinessHoursCard extends StatefulWidget {
  final Map<String, dynamic> wa;
  final Future<void> Function(Map<String, dynamic>) patch;
  const _BusinessHoursCard({required this.wa, required this.patch});

  @override
  State<_BusinessHoursCard> createState() => _BusinessHoursCardState();
}

class _BusinessHoursCardState extends State<_BusinessHoursCard> {
  late bool _enabled;
  late final _timezoneCtrl = TextEditingController();
  late final _awayCtrl = TextEditingController();
  late List<_DaySchedule> _schedule;
  bool _saving = false;

  Map<String, dynamic>? get _hours => (widget.wa['businessHours'] as Map?)?.cast<String, dynamic>();

  @override
  void initState() {
    super.initState();
    final hours = _hours;
    _enabled = hours?['enabled'] == true;
    _timezoneCtrl.text = hours?['timezone'] as String? ?? 'Asia/Kolkata';
    _awayCtrl.text = hours?['awayMessage'] as String? ?? '';
    final existing = ((hours?['schedule'] as List?) ?? []).cast<Map>();
    _schedule = _dayOrder.map((day) {
      final found = existing.firstWhere((d) => d['day'] == day, orElse: () => const {});
      return _DaySchedule(
        day: day,
        closed: found['closed'] as bool? ?? (day == 0 || day == 6),
        open: found['open'] as String? ?? '09:00',
        close: found['close'] as String? ?? '18:00',
      );
    }).toList();
  }

  @override
  void dispose() {
    _timezoneCtrl.dispose();
    _awayCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.patch({
        'businessHours': {
          'enabled': _enabled,
          'timezone': _timezoneCtrl.text.trim(),
          'awayMessage': _awayCtrl.text.trim(),
          'schedule': _schedule
              .map((d) => {'day': d.day, 'closed': d.closed, 'open': d.open, 'close': d.close})
              .toList(),
        },
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Business hours saved')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to save')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickTime(_DaySchedule d, bool isOpen) async {
    final parts = (isOpen ? d.open : d.close).split(':');
    final initial = TimeOfDay(hour: int.tryParse(parts.first) ?? 9, minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked == null) return;
    setState(() {
      final s = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      if (isOpen) {
        d.open = s;
      } else {
        d.close = s;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return WaCard(
      title: 'Business hours',
      icon: Icons.access_time_rounded,
      description:
          "Outside these hours the assistant stops replying and sends an away message instead. Leave off to keep replying around the clock.",
      children: [
        WaCheckRow(
          value: _enabled,
          onChanged: (v) => setState(() => _enabled = v),
          title: 'Restrict to business hours',
        ),
        if (_enabled) ...[
          const SizedBox(height: 10),
          WaField(label: 'Timezone', controller: _timezoneCtrl, hint: 'Asia/Kolkata'),
          for (final d in _schedule)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  SizedBox(width: 40, child: Text(_dayLabel[d.day]!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  Checkbox(
                    value: d.closed,
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    onChanged: (v) => setState(() => d.closed = v == true),
                  ),
                  const Text('Closed', style: TextStyle(fontSize: 12)),
                  if (!d.closed) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _pickTime(d, true),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 6)),
                        child: Text(d.open, style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Text('to', style: TextStyle(fontSize: 11))),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _pickTime(d, false),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 6)),
                        child: Text(d.close, style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          WaField(
            label: 'Away message',
            controller: _awayCtrl,
            maxLines: 2,
            hint: "Thanks for reaching out! We're closed right now — back at 9am, and we'll reply first thing.",
            help: "Sent at most once a day per conversation, not on every message.",
          ),
        ],
        SecondaryButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save business hours'),
        ),
      ],
    );
  }
}

class _AutoAssignCard extends StatefulWidget {
  final Map<String, dynamic> wa;
  final Future<void> Function(Map<String, dynamic>) patch;
  const _AutoAssignCard({required this.wa, required this.patch});

  @override
  State<_AutoAssignCard> createState() => _AutoAssignCardState();
}

class _AutoAssignCardState extends State<_AutoAssignCard> {
  late bool _enabled = widget.wa['autoAssignConversations'] == true;
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.patch({'autoAssignConversations': _enabled});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to save')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return WaCard(
      title: 'Conversation auto-assignment',
      icon: Icons.groups_rounded,
      description:
          "When the assistant hands off to a human (or starts a conversation with the bot off), round-robin it to an agent automatically — same as new Leads already do.",
      children: [
        WaCheckRow(
          value: _enabled,
          onChanged: (v) => setState(() => _enabled = v),
          title: 'Auto-assign handed-off conversations',
        ),
        SecondaryButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _NotificationsCard extends StatefulWidget {
  final Map<String, dynamic> wa;
  final Future<void> Function(Map<String, dynamic>) patch;
  final List<Map<String, dynamic>> agents;
  const _NotificationsCard({required this.wa, required this.patch, required this.agents});

  @override
  State<_NotificationsCard> createState() => _NotificationsCardState();
}

class _NotificationsCardState extends State<_NotificationsCard> {
  late List<String> _newConversation;
  late List<String> _lowCredits;
  late List<String> _qualityDrop;
  bool _saving = false;

  List<String> _idsOf(String key) =>
      (((widget.wa['notifyOn'] as Map?)?[key] as List?) ?? []).map((e) => e.toString()).toList();

  @override
  void initState() {
    super.initState();
    _newConversation = _idsOf('newConversation');
    _lowCredits = _idsOf('lowCredits');
    _qualityDrop = _idsOf('qualityDrop');
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.patch({
        'notifyOn': {
          'newConversation': _newConversation,
          'lowCredits': _lowCredits,
          'qualityDrop': _qualityDrop,
        },
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to save')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _picker(String label, List<Map<String, dynamic>> agents, List<String> selected, ValueChanged<String> onToggle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WaLabel(label),
          if (agents.isEmpty)
            Text('No team members yet.', style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: AppTheme.of(context).textSoft))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: agents.map((a) {
                final id = a['_id'] as String;
                return _SelectableChip(
                  label: a['name'] as String? ?? '',
                  selected: selected.contains(id),
                  onTap: () => onToggle(id),
                );
              }).toList(),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              selected.isNotEmpty
                  ? '${selected.length} selected — only they get pinged.'
                  : 'Nobody selected — everyone (or the assigned agent) gets pinged, same as today.',
              style: TextStyle(fontSize: 11, color: AppTheme.of(context).textSoft),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WaCard(
      title: 'Notification recipients',
      icon: Icons.notifications_rounded,
      description: 'Choose who gets pinged for each event. Leave a category empty to keep the current default.',
      children: [
        _picker('New WhatsApp conversation', widget.agents, _newConversation,
            (id) => setState(() => _newConversation.contains(id) ? _newConversation.remove(id) : _newConversation.add(id))),
        _picker(
            'Low WhatsApp credits (admins only)',
            widget.agents.where((a) => a['role'] == 'admin').toList(),
            _lowCredits,
            (id) => setState(() => _lowCredits.contains(id) ? _lowCredits.remove(id) : _lowCredits.add(id))),
        _picker('Quality rating drop', widget.agents, _qualityDrop,
            (id) => setState(() => _qualityDrop.contains(id) ? _qualityDrop.remove(id) : _qualityDrop.add(id))),
        SecondaryButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save notification settings'),
        ),
      ],
    );
  }
}

/// Small filled/outlined toggle pill — [WaPillButton] doesn't carry a
/// selected state, which this needs for the agent multi-pick above.
class _SelectableChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SelectableChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppTheme.of(context).surfaceLow,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? Colors.white : AppTheme.of(context).textSoft),
        ),
      ),
    );
  }
}

class _ConsentSnapshotCard extends StatefulWidget {
  const _ConsentSnapshotCard();

  @override
  State<_ConsentSnapshotCard> createState() => _ConsentSnapshotCardState();
}

class _ConsentSnapshotCardState extends State<_ConsentSnapshotCard> {
  Map<String, dynamic>? _counts;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.dio.get('/whatsapp/consent-summary').then((r) {
      if (mounted) setState(() => _counts = ((r.data as Map)['counts'] as Map?)?.cast<String, dynamic>());
    }).catchError((_) {}).whenComplete(() {
      if (mounted) setState(() => _loading = false);
    });
  }

  Widget _stat(String label, int n, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$n', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: TextStyle(fontSize: 11, color: AppTheme.of(context).textSoft)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final counts = _counts;
    final granted = (counts?['granted'] as num?)?.toInt() ?? 0;
    final denied = (counts?['denied'] as num?)?.toInt() ?? 0;
    final unknown = (counts?['unknown'] as num?)?.toInt() ?? 0;
    final total = granted + denied + unknown;
    return WaCard(
      title: 'Consent & compliance',
      icon: Icons.verified_user_rounded,
      description: 'WhatsApp marketing consent recorded across your leads. Campaigns only ever send to Granted.',
      children: [
        if (_loading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: AppSpinner(size: 20))
        else if (counts == null)
          Text('Could not load consent counts.', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: AppTheme.of(context).textSoft))
        else ...[
          Row(
            children: [
              _stat('Granted', granted, AppColors.success),
              _stat('Denied', denied, AppColors.danger),
              _stat('Unrecorded', unknown, AppTheme.of(context).textSoft),
            ],
          ),
          if (total > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '${(granted / total * 100).round()}% of leads have given consent.',
                style: TextStyle(fontSize: 11.5, color: AppTheme.of(context).textSoft),
              ),
            ),
        ],
      ],
    );
  }
}

/// WhatsApp Business Profile — only applicable to the direct Arthaleads
/// (Meta Cloud API) connection; the backend reports `applicable: false` for
/// AiSensy/Wati/Interakt and this renders a short explanation instead.
class _BusinessProfileCard extends StatefulWidget {
  const _BusinessProfileCard();

  @override
  State<_BusinessProfileCard> createState() => _BusinessProfileCardState();
}

class _BusinessProfileCardState extends State<_BusinessProfileCard> {
  bool _loading = true;
  bool _applicable = true;
  String? _loadMessage;
  List<String> _verticals = [];
  final _aboutCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _website1Ctrl = TextEditingController();
  final _website2Ctrl = TextEditingController();
  String? _vertical;
  String? _photoUrl;
  bool _uploadingPhoto = false;
  bool _saving = false;
  final _pinCtrl = TextEditingController();
  bool _settingPin = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _aboutCtrl.dispose();
    _descriptionCtrl.dispose();
    _addressCtrl.dispose();
    _emailCtrl.dispose();
    _website1Ctrl.dispose();
    _website2Ctrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.dio.get('/whatsapp/business-profile');
      final data = (res.data as Map).cast<String, dynamic>();
      if (data['applicable'] != true) {
        if (mounted) setState(() => _applicable = false);
        return;
      }
      if (data['ok'] != true) {
        if (mounted) setState(() => _loadMessage = data['message'] as String? ?? 'Could not load.');
        return;
      }
      final p = (data['profile'] as Map?)?.cast<String, dynamic>() ?? {};
      final websites = ((p['websites'] as List?) ?? []).cast<String>();
      if (mounted) {
        setState(() {
          _aboutCtrl.text = p['about'] as String? ?? '';
          _descriptionCtrl.text = p['description'] as String? ?? '';
          _addressCtrl.text = p['address'] as String? ?? '';
          _emailCtrl.text = p['email'] as String? ?? '';
          _website1Ctrl.text = websites.isNotEmpty ? websites[0] : '';
          _website2Ctrl.text = websites.length > 1 ? websites[1] : '';
          _vertical = p['vertical'] as String?;
          _photoUrl = p['profile_picture_url'] as String?;
          _verticals = ((data['verticals'] as List?) ?? []).cast<String>();
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadMessage = 'Could not load your Business Profile.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickPhoto() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 640,
      maxHeight: 640,
    );
    if (file == null) return;
    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await file.readAsBytes();
      final dataUri = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      await ApiClient.instance.dio.post('/whatsapp/business-profile/photo', data: {'photo': dataUri});
      if (mounted) {
        setState(() => _photoUrl = dataUri);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile photo updated — may take a minute to appear on WhatsApp')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Upload failed')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.dio.patch('/whatsapp/business-profile', data: {
        'about': _aboutCtrl.text.trim(),
        'description': _descriptionCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'vertical': _vertical,
        'websites': [_website1Ctrl.text.trim(), _website2Ctrl.text.trim()].where((s) => s.isNotEmpty).toList(),
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Business Profile saved')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to save')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _setPin() async {
    if (!RegExp(r'^\d{6}$').hasMatch(_pinCtrl.text)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN must be exactly 6 digits')));
      return;
    }
    setState(() => _settingPin = true);
    try {
      await ApiClient.instance.dio.post('/whatsapp/business-profile/pin', data: {'pin': _pinCtrl.text});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('2-step verification PIN set')));
        _pinCtrl.clear();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Failed to set PIN')), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _settingPin = false);
    }
  }

  ImageProvider? get _photoProvider {
    final url = _photoUrl;
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('data:image/') && url.contains(',')) {
      try {
        return MemoryImage(base64Decode(url.substring(url.indexOf(',') + 1)));
      } catch (_) {
        return null;
      }
    }
    return NetworkImage(url);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const WaCard(
        title: 'Business Profile',
        icon: Icons.business_rounded,
        children: [Padding(padding: EdgeInsets.symmetric(vertical: 8), child: AppSpinner(size: 20))],
      );
    }
    if (!_applicable) {
      return const WaCard(
        title: 'Business Profile',
        icon: Icons.business_rounded,
        description:
            "Only available on the direct Arthaleads connection — manage your profile in your provider's own dashboard for other connections.",
        children: [],
      );
    }
    return WaCard(
      title: 'Business Profile',
      icon: Icons.business_rounded,
      description: 'What customers see about your business on WhatsApp — no need to open WhatsApp Manager for these.',
      children: [
        if (_loadMessage != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(_loadMessage!, style: const TextStyle(fontSize: 12, color: Color(0xFFB45309))),
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppTheme.of(context).surfaceLow,
              backgroundImage: _photoProvider,
              child: _photoProvider == null ? Icon(Icons.business_rounded, color: AppTheme.of(context).textSoft) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: WaPillButton(
                _uploadingPhoto ? 'Uploading…' : 'Change photo',
                icon: Icons.photo_camera_outlined,
                onPressed: _uploadingPhoto ? null : _pickPhoto,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        WaHelp('Square images work best. Up to 8MB — resized automatically.'),
        const SizedBox(height: 12),
        WaField(label: 'About', controller: _aboutCtrl, hint: 'A short one-liner shown near your name', maxLength: 139),
        WaField(label: 'Description', controller: _descriptionCtrl, hint: 'What your business does', maxLines: 2, maxLength: 256),
        WaField(label: 'Address', controller: _addressCtrl),
        WaField(label: 'Email', controller: _emailCtrl, keyboardType: TextInputType.emailAddress),
        Row(
          children: [
            Expanded(child: WaField(label: 'Website', controller: _website1Ctrl, hint: 'https://…', keyboardType: TextInputType.url)),
            const SizedBox(width: 12),
            Expanded(child: WaField(label: 'Website (2nd, optional)', controller: _website2Ctrl, hint: 'https://…', keyboardType: TextInputType.url)),
          ],
        ),
        AppSelect<String?>(
          label: 'Category',
          hint: 'Select a category',
          value: _vertical,
          options: {for (final v in _verticals) v: v.replaceAll('_', ' ')},
          onChanged: (v) => setState(() => _vertical = v),
        ),
        SecondaryButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save profile'),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.only(top: 12),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: AppTheme.of(context).border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.lock_outline_rounded, size: 14, color: AppTheme.of(context).textSoft),
                  const SizedBox(width: 6),
                  Text('Two-step verification PIN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.of(context).textSoft)),
                ],
              ),
              const SizedBox(height: 4),
              WaHelp("WhatsApp asks for this if the number is ever re-registered. Setting a new PIN replaces the old one — there's nothing to display here for security."),
              const SizedBox(height: 8),
              Row(
                children: [
                  SizedBox(
                    width: 110,
                    child: WaField(
                      label: '',
                      controller: _pinCtrl,
                      hint: '6 digits',
                      mono: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                    ),
                  ),
                  const SizedBox(width: 8),
                  SecondaryButton(
                    onPressed: (_settingPin || _pinCtrl.text.length != 6) ? null : _setPin,
                    child: _settingPin
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Set PIN'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
