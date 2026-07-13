import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:just_audio/just_audio.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Full call history + AI analysis for one lead.
/// GET /calls/lead/:leadId, POST /calls/:leadId/:activityId/summarize,
/// PATCH /calls/:leadId/:activityId/notes, POST /calls/:leadId/followup,
/// POST /calls/lead/:leadId/summary (aggregate pattern across 2+ calls).
/// Mirrors the LeadCallModal / CallDetailPanel on the web app.
class CallHistoryScreen extends StatefulWidget {
  final String leadId;
  final String leadName;
  final String? leadPhone;

  const CallHistoryScreen({super.key, required this.leadId, required this.leadName, this.leadPhone});

  @override
  State<CallHistoryScreen> createState() => _CallHistoryScreenState();
}

const _intentLabels = {
  'interested': 'Interested',
  'site_visit': 'Site Visit',
  'negotiation': 'Negotiation',
  'not_interested': 'Not Interested',
  'follow_up': 'Follow-up',
  'unclear': 'Unclear',
};

const _intentColors = {
  'interested': AppColors.success,
  'site_visit': Color(0xFF8B5CF6),
  'negotiation': Color(0xFFF59E0B),
  'not_interested': AppColors.danger,
  'follow_up': AppColors.info,
  'unclear': Color(0xFF6B7280),
};

const _sentimentColors = {
  'positive': AppColors.success,
  'negative': AppColors.danger,
  'neutral': Color(0xFF6B7280),
};

class _CallHistoryScreenState extends State<CallHistoryScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _calls = [];
  bool _loading = true;
  Map<String, dynamic>? _pattern;
  bool _patternLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/calls/lead/${widget.leadId}');
      setState(() => _calls = (res.data['calls'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load call history')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generatePattern() async {
    setState(() => _patternLoading = true);
    try {
      final res = await _api.dio.post('/calls/lead/${widget.leadId}/summary');
      setState(() => _pattern = (res.data as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Pattern analysis failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _patternLoading = false);
    }
  }

  Future<void> _callBack() async {
    final phone = widget.leadPhone;
    if (phone == null || phone.isEmpty) return;
    try {
      final res = await _api.dio.post('/calls/initiate', data: {'leadId': widget.leadId});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res.data['message'] as String? ?? 'Calling…'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Call failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.leadName),
        actions: [
          IconButton(icon: const Icon(Icons.call), onPressed: _callBack),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_calls.length >= 2) ...[
                    _patternCard(),
                    const SizedBox(height: 16),
                  ],
                  if (_calls.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: Text('No calls yet')),
                    )
                  else
                    ..._calls.asMap().entries.map((e) => _CallCard(
                          leadId: widget.leadId,
                          index: _calls.length - e.key,
                          call: e.value,
                          onChanged: (updated) => setState(() => _calls[e.key] = updated),
                        )),
                ],
              ),
            ),
    );
  }

  Widget _patternCard() {
    if (_pattern == null) {
      return OutlinedButton.icon(
        onPressed: _patternLoading ? null : _generatePattern,
        icon: _patternLoading
            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.auto_awesome, size: 18),
        label: Text(_patternLoading ? 'Analysing…' : 'Analyse call pattern (${_calls.length} calls)'),
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_pattern!['headline'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(_pattern!['summary'] as String? ?? '', style: Theme.of(context).textTheme.bodySmall),
          if ((_pattern!['recommendation'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.lightbulb_outline, size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(_pattern!['recommendation'] as String,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CallCard extends StatefulWidget {
  final String leadId;
  final int index;
  final Map<String, dynamic> call;
  final void Function(Map<String, dynamic>) onChanged;

  const _CallCard({required this.leadId, required this.index, required this.call, required this.onChanged});

  @override
  State<_CallCard> createState() => _CallCardState();
}

class _CallCardState extends State<_CallCard> {
  final _api = ApiClient.instance;
  late final _notesCtrl = TextEditingController(text: (widget.call['meta'] as Map?)?['notes'] as String? ?? '');
  bool _analysing = false;
  bool _transcriptOpen = false;
  bool _savingNotes = false;
  AudioPlayer? _player;
  bool _playerReady = false;
  bool _playing = false;

  Map get _meta => (widget.call['meta'] as Map?) ?? {};

  @override
  void dispose() {
    _notesCtrl.dispose();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    final url = _meta['recordingUrl'] as String?;
    if (url == null) return;
    if (_player == null) {
      _player = AudioPlayer();
      try {
        await _player!.setUrl(url);
        _player!.playerStateStream.listen((s) {
          if (mounted) setState(() => _playing = s.playing);
        });
        if (mounted) setState(() => _playerReady = true);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Could not play recording: $e'),
            backgroundColor: AppColors.danger,
          ));
        }
        return;
      }
    }
    if (_playing) {
      await _player!.pause();
    } else {
      await _player!.play();
    }
  }

  Future<void> _analyse() async {
    setState(() => _analysing = true);
    try {
      final res = await _api.dio.post('/calls/${widget.leadId}/${widget.call['activityId']}/summarize');
      final meta = (res.data['meta'] as Map? ?? {}).cast<String, dynamic>();
      widget.onChanged({...widget.call, 'meta': meta});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Analysis failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _analysing = false);
    }
  }

  Future<void> _saveNotes() async {
    setState(() => _savingNotes = true);
    try {
      await _api.dio.patch(
        '/calls/${widget.leadId}/${widget.call['activityId']}/notes',
        data: {'notes': _notesCtrl.text.trim()},
      );
      widget.onChanged({
        ...widget.call,
        'meta': {..._meta, 'notes': _notesCtrl.text.trim()},
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Note saved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to save note')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _savingNotes = false);
    }
  }

  Future<void> _scheduleFollowUp() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    final dt = DateTime(date.year, date.month, date.day, time?.hour ?? 10, time?.minute ?? 0);
    try {
      await _api.dio.post('/calls/${widget.leadId}/followup', data: {'dueDate': dt.toIso8601String()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Follow-up task created')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to create follow-up')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'answered':
        return AppColors.success;
      case 'missed':
      case 'no-answer':
      case 'failed':
        return AppColors.danger;
      default:
        return AppColors.info;
    }
  }

  String _fmtDate(String? iso) {
    final dt = DateTime.tryParse(iso ?? '')?.toLocal();
    if (dt == null) return '—';
    return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
  }

  String _fmtDuration(dynamic secs) {
    final s = secs is num ? secs.toInt() : 0;
    if (s <= 0) return '';
    return '${s ~/ 60}m ${s % 60}s';
  }

  @override
  Widget build(BuildContext context) {
    final status = _meta['status'] as String?;
    final color = _statusColor(status);
    final isMissed = status == 'missed' || status == 'no-answer';
    final intent = _meta['intent'] as String?;
    final sentiment = _meta['sentiment'] as String?;
    final hasAnalysis = _meta['summary'] != null;
    final recordingUrl = _meta['recordingUrl'] as String?;
    final transcript = _meta['transcript'] as String?;
    final keyPoints = (_meta['keyPoints'] as List?)?.cast<String>() ?? [];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Call ${widget.index}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: color.withValues(alpha: 0.35)),
                  ),
                  child: Text(status ?? '—', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                ),
                const Spacer(),
                if (isMissed)
                  TextButton.icon(
                    onPressed: () async {
                      try {
                        await _api.dio.post('/calls/initiate', data: {'leadId': widget.leadId});
                      } catch (_) {}
                    },
                    icon: const Icon(Icons.call, size: 16),
                    label: const Text('Call Back'),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [_fmtDate(widget.call['createdAt'] as String?), _fmtDuration(_meta['duration'])]
                  .where((s) => s.isNotEmpty)
                  .join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),

            if (recordingUrl != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  IconButton.filledTonal(
                    onPressed: _togglePlay,
                    icon: Icon(_playing ? Icons.pause : Icons.play_arrow, size: 20),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _playerReady && _player != null
                        ? StreamBuilder<Duration>(
                            stream: _player!.positionStream,
                            builder: (context, snap) {
                              final pos = snap.data ?? Duration.zero;
                              final dur = _player!.duration ?? Duration.zero;
                              return Slider(
                                value: dur.inMilliseconds > 0
                                    ? pos.inMilliseconds.clamp(0, dur.inMilliseconds).toDouble()
                                    : 0,
                                max: dur.inMilliseconds > 0 ? dur.inMilliseconds.toDouble() : 1,
                                onChanged: (v) => _player!.seek(Duration(milliseconds: v.toInt())),
                              );
                            },
                          )
                        : const Text('Tap play to load recording', style: TextStyle(fontSize: 12)),
                  ),
                  IconButton(
                    tooltip: 'Open externally',
                    icon: const Icon(Icons.open_in_new, size: 18),
                    onPressed: () => launchUrl(Uri.parse(recordingUrl), mode: LaunchMode.externalApplication),
                  ),
                ],
              ),
            ],

            if (transcript != null && transcript.isNotEmpty) ...[
              const SizedBox(height: 8),
              InkWell(
                onTap: () => setState(() => _transcriptOpen = !_transcriptOpen),
                child: Row(
                  children: [
                    Icon(_transcriptOpen ? Icons.expand_less : Icons.expand_more, size: 18),
                    const SizedBox(width: 4),
                    const Text('Transcript', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              if (_transcriptOpen)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(transcript, style: Theme.of(context).textTheme.bodySmall),
                ),
            ],

            const SizedBox(height: 10),
            if (hasAnalysis) ...[
              Row(
                children: [
                  if (intent != null)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (_intentColors[intent] ?? Colors.grey).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(_intentLabels[intent] ?? intent,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _intentColors[intent])),
                    ),
                  if (sentiment != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (_sentimentColors[sentiment] ?? Colors.grey).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(sentiment,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _sentimentColors[sentiment])),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(_meta['summary'] as String? ?? '', style: Theme.of(context).textTheme.bodySmall),
              if (keyPoints.isNotEmpty) ...[
                const SizedBox(height: 6),
                ...keyPoints.map((k) => Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text('•  $k', style: Theme.of(context).textTheme.bodySmall),
                    )),
              ],
              if ((_meta['nextAction'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(_meta['nextAction'] as String,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              TextButton.icon(
                onPressed: _analysing ? null : _analyse,
                icon: _analysing
                    ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.refresh, size: 14),
                label: const Text('Regenerate', style: TextStyle(fontSize: 12)),
              ),
            ] else if (recordingUrl != null) ...[
              OutlinedButton.icon(
                onPressed: _analysing ? null : _analyse,
                icon: _analysing
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.auto_awesome, size: 16),
                label: Text(_analysing ? 'Analysing…' : 'Generate AI Analysis'),
              ),
            ],

            const SizedBox(height: 10),
            TextField(
              controller: _notesCtrl,
              minLines: 1,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add call notes…',
                isDense: true,
                suffixIcon: IconButton(
                  icon: _savingNotes
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save_outlined, size: 18),
                  onPressed: _savingNotes ? null : _saveNotes,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _scheduleFollowUp,
                icon: const Icon(Icons.event_available, size: 16),
                label: const Text('Schedule Follow-up', style: TextStyle(fontSize: 12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
