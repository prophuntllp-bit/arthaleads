import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Send a project's video, floor plan, brochure or photos into a conversation
/// by hand. Mirrors frontend/src/components/ProjectMediaSendModal.jsx against
/// GET /projects and POST /whatsapp/send-media. Only works while the
/// customer's 24-hour reply window is open; each file is one message.
///
/// Resolves to true when something was sent.
Future<bool> showProjectMediaSendSheet(BuildContext context, {required String conversationId}) async {
  final r = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => _ProjectMediaSendSheet(conversationId: conversationId),
  );
  return r == true;
}

class _ProjectMediaSendSheet extends StatefulWidget {
  final String conversationId;
  const _ProjectMediaSendSheet({required this.conversationId});
  @override
  State<_ProjectMediaSendSheet> createState() => _ProjectMediaSendSheetState();
}

class _ProjectMediaSendSheetState extends State<_ProjectMediaSendSheet> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _projects;
  bool _error = false;
  String _projectId = '';
  final Set<String> _picked = {};
  bool _sending = false;
  final _message = TextEditingController(text: 'Here you go 🙂 Would you like to see it in person? I can check site visit slots for you.');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.dio.get('/projects');
      final list = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
      if (!mounted) return;
      final withFiles = list.where((p) =>
          ((p['videos'] as List?) ?? []).isNotEmpty ||
          (p['floorPlanUrl'] as String? ?? '').isNotEmpty ||
          (p['brochureUrl'] as String? ?? '').isNotEmpty ||
          ((p['images'] as List?) ?? []).isNotEmpty);
      setState(() {
        _projects = list;
        _projectId = ((withFiles.isNotEmpty ? withFiles.first : (list.isNotEmpty ? list.first : null))?['_id'] as String?) ?? '';
      });
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  Map<String, dynamic>? get _project =>
      _projects?.where((p) => p['_id'] == _projectId).firstOrNull;

  List<({String key, IconData icon, String label, bool have, String note})> _items() {
    final p = _project;
    if (p == null) return [];
    final videos = ((p['videos'] as List?) ?? []).length;
    final photos = ((p['images'] as List?) ?? []).where((u) => u.toString().startsWith('http')).length;
    final fp = (p['floorPlanUrl'] as String? ?? '').isNotEmpty;
    final br = (p['brochureUrl'] as String? ?? '').isNotEmpty;
    return [
      (key: 'videos', icon: Icons.movie_outlined, label: 'Video', have: videos > 0, note: videos == 0 ? 'not uploaded' : videos > 1 ? 'all $videos videos sent' : '1 video'),
      (key: 'floorplan', icon: Icons.architecture_rounded, label: 'Floor plan (PDF)', have: fp, note: fp ? 'PDF' : 'not uploaded'),
      (key: 'brochure', icon: Icons.picture_as_pdf_outlined, label: 'Brochure (PDF)', have: br, note: br ? 'PDF' : 'not uploaded'),
      (key: 'photos', icon: Icons.photo_outlined, label: 'Photos', have: photos > 0, note: photos == 0 ? 'not uploaded' : '${photos < 3 ? photos : 3} of $photos sent'),
    ];
  }

  Future<void> _send() async {
    if (_picked.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await _api.dio.post('/whatsapp/send-media', data: {
        'conversationId': widget.conversationId,
        'projectId': _projectId,
        'kinds': _picked.toList(),
        'message': _message.text.trim(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, "Couldn't send the files.")), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    Widget body;
    if (_error) {
      body = const Padding(padding: EdgeInsets.all(24), child: Text("Couldn't load your projects."));
    } else if (_projects == null) {
      body = const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
    } else if (_projects!.isEmpty) {
      body = const Padding(padding: EdgeInsets.all(24), child: Text('Add a project and upload its files first.'));
    } else {
      final items = _items();
      body = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () async {
              final id = await showModalBottomSheet<String>(
                context: context,
                showDragHandle: true,
                builder: (ctx) => SafeArea(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final p in _projects!)
                        ListTile(
                          title: Text(p['name'] as String? ?? ''),
                          trailing: p['_id'] == _projectId ? const Icon(Icons.check_rounded, color: AppColors.primary) : null,
                          onTap: () => Navigator.pop(ctx, p['_id'] as String),
                        ),
                    ],
                  ),
                ),
              );
              if (id != null && id != _projectId) setState(() { _projectId = id; _picked.clear(); });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(border: Border.all(color: t.border), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                Expanded(child: Text(_project?['name'] as String? ?? 'Select project', style: const TextStyle(fontWeight: FontWeight.w700))),
                const Icon(Icons.keyboard_arrow_down_rounded),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          for (final it in items)
            CheckboxListTile(
              value: _picked.contains(it.key) && it.have,
              onChanged: it.have ? (v) => setState(() => v == true ? _picked.add(it.key) : _picked.remove(it.key)) : null,
              secondary: Icon(it.icon),
              title: Text(it.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              subtitle: Text(it.note, style: const TextStyle(fontSize: 12)),
              controlAffinity: ListTileControlAffinity.trailing,
              contentPadding: EdgeInsets.zero,
              dense: true,
            ),
          const SizedBox(height: 8),
          TextField(
            controller: _message,
            minLines: 2,
            maxLines: 4,
            maxLength: 1000,
            decoration: const InputDecoration(labelText: 'Message after the files (optional)', hintText: 'Leave empty to send only the files'),
          ),
          const SizedBox(height: 4),
          Text(
            'Each file goes as its own WhatsApp message and uses one reply from your monthly allowance. Only while the customer\'s 24-hour reply window is open.',
            style: TextStyle(fontSize: 11.5, height: 1.4, color: t.textSoft),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _picked.isEmpty || _sending ? null : _send,
              icon: _sending
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 18),
              label: Text(_sending ? 'Sending…' : 'Send'),
            ),
          ),
        ],
      );
    }
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text('Send project files', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
          body,
        ],
      ),
    );
  }
}
