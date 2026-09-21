import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Brochure PDF, floor-plan PDF and project videos for an existing project.
/// Mirrors the web ProjectForm: each change is saved on the spot through its
/// own endpoint (not with the form's Save button), which is why it only shows
/// once the project exists.
///
/// Video rules (enforced again on the server): up to 10MB is kept as is,
/// 10 to 20MB is compressed to fit 10MB, over 20MB is refused here first.
class ProjectMediaSection extends StatefulWidget {
  final Map<String, dynamic> project;
  const ProjectMediaSection({super.key, required this.project});

  @override
  State<ProjectMediaSection> createState() => _ProjectMediaSectionState();
}

class _ProjectMediaSectionState extends State<ProjectMediaSection> {
  static const _maxVideos = 3;
  static const _mb = 1024 * 1024;

  final _api = ApiClient.instance;
  late String _brochure = widget.project['brochureUrl'] as String? ?? '';
  late String _floorPlan = widget.project['floorPlanUrl'] as String? ?? '';
  late List<Map<String, dynamic>> _videos = _videosOf(widget.project);
  String _busyDoc = ''; // 'brochure' | 'floorplan' | ''
  String _videoStatus = '';

  String get _id => widget.project['_id'].toString();

  static List<Map<String, dynamic>> _videosOf(Map<String, dynamic> p) =>
      ((p['videos'] as List?) ?? []).whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  /// The project map handed to the form can be stale, so pull current files.
  Future<void> _refresh() async {
    try {
      final res = await _api.dio.get('/projects/$_id');
      final p = (res.data['data'] as Map?)?.cast<String, dynamic>();
      if (p == null || !mounted) return;
      setState(() {
        _brochure = p['brochureUrl'] as String? ?? '';
        _floorPlan = p['floorPlanUrl'] as String? ?? '';
        _videos = _videosOf(p);
      });
    } catch (_) {}
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: error ? AppColors.danger : null),
    );
  }

  Future<void> _pickDoc(String kind) async {
    final label = kind == 'brochure' ? 'Brochure' : 'Floor plan';
    final res = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      withData: true,
    );
    final file = res?.files.single;
    if (file == null) return;
    final bytes = file.bytes;
    if (bytes == null) return _snack('Could not read that file.', error: true);
    if (bytes.length > 5 * _mb) return _snack('Max 5MB for a ${label.toLowerCase()}.', error: true);
    setState(() => _busyDoc = kind);
    try {
      final r = await _api.dio.post(
        '/projects/$_id/${kind == 'brochure' ? 'brochure' : 'floorplan'}',
        data: {'dataUri': 'data:application/pdf;base64,${base64Encode(bytes)}'},
      );
      if (!mounted) return;
      setState(() {
        if (kind == 'brochure') {
          _brochure = r.data['brochureUrl'] as String? ?? '';
        } else {
          _floorPlan = r.data['floorPlanUrl'] as String? ?? '';
        }
      });
      _snack('$label uploaded');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Failed to upload ${label.toLowerCase()}'), error: true);
    } finally {
      if (mounted) setState(() => _busyDoc = '');
    }
  }

  Future<void> _removeDoc(String kind) async {
    final label = kind == 'brochure' ? 'Brochure' : 'Floor plan';
    try {
      await _api.dio.delete('/projects/$_id/${kind == 'brochure' ? 'brochure' : 'floorplan'}');
      if (!mounted) return;
      setState(() => kind == 'brochure' ? _brochure = '' : _floorPlan = '');
      _snack('$label removed');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Failed to remove ${label.toLowerCase()}'), error: true);
    }
  }

  Future<void> _pickVideo() async {
    if (_videos.length >= _maxVideos) {
      return _snack('Up to $_maxVideos videos per project. Remove one first.', error: true);
    }
    final res = await FilePicker.platform.pickFiles(type: FileType.video, withData: false);
    final path = res?.files.single.path;
    if (path == null) return;
    final file = File(path);
    final size = await file.length();
    if (size > 20 * _mb) {
      return _snack(
        'This video is ${(size / _mb).toStringAsFixed(1)}MB. Videos over 20MB can\'t be uploaded, please trim or shrink it first.',
        error: true,
      );
    }
    final needsCompression = size > 10 * _mb;
    final ext = path.toLowerCase().split('.').last;
    final mime = ext == 'mov' ? 'video/quicktime' : ext == 'webm' ? 'video/webm' : ext == '3gp' ? 'video/3gpp' : 'video/mp4';
    setState(() => _videoStatus = 'Uploading… 0%');
    try {
      final r = await _api.dio.post(
        '/projects/$_id/videos',
        data: file.openRead(),
        options: Options(
          headers: {Headers.contentLengthHeader: size, Headers.contentTypeHeader: mime},
          sendTimeout: const Duration(minutes: 5),
          receiveTimeout: const Duration(minutes: 5),
        ),
        onSendProgress: (sent, total) {
          if (!mounted || total <= 0) return;
          final pct = (sent / total * 100).round();
          setState(() => _videoStatus = pct >= 100 && needsCompression ? 'Optimizing video, this can take a minute…' : 'Uploading… $pct%');
        },
      );
      if (!mounted) return;
      setState(() => _videos = _videosOf({'videos': r.data['videos']}));
      final compressed = r.data['compressed'] == true;
      _snack(compressed
          ? 'Video optimized from ${((r.data['originalBytes'] as num) / _mb).toStringAsFixed(1)}MB to ${((r.data['sizeBytes'] as num) / _mb).toStringAsFixed(1)}MB'
          : 'Video uploaded');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Failed to upload video'), error: true);
    } finally {
      if (mounted) setState(() => _videoStatus = '');
    }
  }

  Future<void> _removeVideo(String url) async {
    try {
      final r = await _api.dio.delete('/projects/$_id/videos', queryParameters: {'url': url});
      if (!mounted) return;
      setState(() => _videos = _videosOf({'videos': r.data['videos']}));
      _snack('Video removed');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Failed to remove video'), error: true);
    }
  }

  Widget _title(String text) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 5),
    child: Text(
      text,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
    ),
  );

  Widget _docRow(String kind, String label, String url) {
    final busy = _busyDoc == kind;
    if (url.isEmpty) {
      return OutlinedButton.icon(
        onPressed: busy ? null : () => _pickDoc(kind),
        icon: busy
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.upload_file_rounded),
        label: Text(busy ? 'Uploading…' : 'Upload ${label.toLowerCase()} PDF'),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.of(context).border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFDC2626)),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
              child: Text('$label.pdf', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          TextButton(onPressed: busy ? null : () => _pickDoc(kind), child: Text(busy ? '…' : 'Replace')),
          IconButton(
            tooltip: 'Remove ${label.toLowerCase()}',
            onPressed: busy ? null : () => _removeDoc(kind),
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
          ),
        ],
      ),
    );
  }

  Widget _videoTile(Map<String, dynamic> v) {
    final url = v['url'] as String? ?? '';
    final size = (v['sizeBytes'] as num?)?.toDouble();
    final dur = (v['durationSec'] as num?)?.toInt();
    final meta = [if (size != null) '${(size / _mb).toStringAsFixed(1)}MB', if (dur != null) '${dur}s'].join(' · ');
    return Container(
      width: 132,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.of(context).border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
            child: Container(
              height: 64,
              decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(10)),
              alignment: Alignment.center,
              child: const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 30),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(child: Text(meta, style: Theme.of(context).textTheme.bodySmall)),
              InkWell(
                onTap: () => _removeVideo(url),
                child: const Padding(padding: EdgeInsets.all(2), child: Icon(Icons.delete_outline_rounded, size: 18)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _title('Brochure & floor plan'),
        Text(
          'Sent on WhatsApp by the "Floor Plan & Brochure" flow button, or by the AI agent when its permissions are on.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        _docRow('brochure', 'Brochure', _brochure),
        const SizedBox(height: 8),
        _docRow('floorplan', 'Floor plan', _floorPlan),
        _title('Project videos (${_videos.length}/$_maxVideos)'),
        Text(
          'Sent by the "Photos & Videos" flow button. Up to 10MB is kept as is, 10 to 20MB is compressed to fit 10MB, over 20MB can\'t be uploaded.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final v in _videos) _videoTile(v)],
        ),
        if (_videos.length < _maxVideos) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _videoStatus.isNotEmpty ? null : _pickVideo,
            icon: _videoStatus.isNotEmpty
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.video_call_outlined),
            label: Text(_videoStatus.isNotEmpty ? _videoStatus : 'Upload video'),
          ),
        ],
      ],
    );
  }
}
