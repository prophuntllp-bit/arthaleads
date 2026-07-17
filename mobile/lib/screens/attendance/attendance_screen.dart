import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';
import 'attendance_capture_sheet.dart';

/// Attendance — GET /attendance/status, POST /attendance/clockin, /clockout,
/// GET /attendance (history), GET /attendance/team-today, GET /attendance/export,
/// GET+PATCH /org/me/attendance-settings. Mirrors frontend/src/pages/Attendance.jsx
/// including camera-selfie + GPS capture (org-configurable), team visibility for
/// admins/managers, and shift settings.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _api = ApiClient.instance;

  Map<String, dynamic>? _today;
  bool _requireSelfie = true;
  final List<Map<String, dynamic>> _history = [];
  List<Map<String, dynamic>> _team = [];
  bool _loading = true;
  bool _acting = false;
  bool _teamLoading = false;
  String _view = 'my';
  String? _recordUserId;
  Timer? _ticker;
  DateTime? _from;
  DateTime? _to;

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          _today?['clockIn'] != null &&
          _today?['clockOut'] == null) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = Provider.of<AuthState>(context, listen: false);
      final currentUserId = auth.user?['_id']?.toString();
      final results = await Future.wait([
        _api.dio.get('/attendance/status'),
        _api.dio.get(
          '/attendance',
          queryParameters: {
            'limit': 30,
            if (_view == 'my' && currentUserId != null) 'userId': currentUserId,
            if (_view == 'records' && _recordUserId != null)
              'userId': _recordUserId,
            if (_from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
            if (_to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
          },
        ),
      ]);
      setState(() {
        _today = (results[0].data['data'] as Map?)?.cast<String, dynamic>();
        _requireSelfie = results[0].data['requireSelfie'] as bool? ?? true;
        _history
          ..clear()
          ..addAll(
            (results[1].data['data'] as List? ?? [])
                .cast<Map<String, dynamic>>(),
          );
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load attendance'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTeam() async {
    setState(() => _teamLoading = true);
    try {
      final res = await _api.dio.get('/attendance/team-today');
      setState(
        () => _team = (res.data['data'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load team status'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _teamLoading = false);
    }
  }

  Future<void> _clockIn() => _startPunch('/attendance/clockin', true);
  Future<void> _clockOut() => _startPunch('/attendance/clockout', false);

  Future<void> _startPunch(String path, bool clockIn) async {
    AttendanceCaptureResult proof = const AttendanceCaptureResult();
    if (_requireSelfie) {
      final captured = await showModalBottomSheet<AttendanceCaptureResult>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: AppTheme.of(context).surfaceSolid,
        barrierColor: Colors.black.withValues(alpha: .78),
        builder: (_) => FractionallySizedBox(
          heightFactor: .94,
          child: AttendanceCaptureSheet(
            clockIn: clockIn,
            requiredProof: _requireSelfie,
          ),
        ),
      );
      if (captured == null) return;
      proof = captured;
    }
    await _punch(path, proof);
  }

  Future<void> _punch(String path, AttendanceCaptureResult proof) async {
    setState(() => _acting = true);
    try {
      await _api.dio.post(
        path,
        data: {
          if (proof.selfie != null) 'selfie': proof.selfie,
          if (proof.latitude != null) 'lat': proof.latitude,
          if (proof.longitude != null) 'lng': proof.longitude,
          if (proof.accuracy != null) 'accuracy': proof.accuracy,
        },
      );
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Action failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
      initialDateRange: _from != null && _to != null
          ? DateTimeRange(start: _from!, end: _to!)
          : null,
    );
    if (range == null) return;
    setState(() {
      _from = range.start;
      _to = range.end;
    });
    _load();
  }

  Future<void> _exportCsv() async {
    try {
      final res = await _api.dio.get(
        '/attendance/export',
        options: Options(responseType: ResponseType.bytes),
        queryParameters: {
          if (_view == 'records' && _recordUserId != null)
            'userId': _recordUserId,
          if (_from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
          if (_to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
        },
      );
      final bytes = res.data as List<int>;
      await Share.shareXFiles([
        XFile.fromData(
          Uint8List.fromList(bytes),
          name: 'attendance.csv',
          mimeType: 'text/csv',
        ),
      ]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Export failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _addAttendanceEntry() async {
    if (_team.isEmpty) await _loadTeam();
    if (!mounted || _team.isEmpty) return;
    final members = _team
        .map((row) => (row['user'] as Map).cast<String, dynamic>())
        .toList();
    String selectedUser = members.first['_id'].toString();
    final dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );
    final inCtrl = TextEditingController(text: '09:30');
    final outCtrl = TextEditingController(text: '19:00');
    final noteCtrl = TextEditingController();
    var nextDay = false;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.of(context).surfaceSolid,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheet) => SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              16,
              12,
              16,
              MediaQuery.of(sheetContext).viewInsets.bottom + 18,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Add Attendance Entry',
                      style: Theme.of(sheetContext).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: selectedUser,
                  decoration: const InputDecoration(labelText: 'Team member'),
                  items: members
                      .map(
                        (user) => DropdownMenuItem(
                          value: user['_id'].toString(),
                          child: Text(user['name']?.toString() ?? 'Member'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value != null) selectedUser = value;
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: dateCtrl,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Date',
                    hintText: 'YYYY-MM-DD',
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: inCtrl,
                        keyboardType: TextInputType.datetime,
                        decoration: const InputDecoration(
                          labelText: 'Clock In',
                          hintText: 'HH:MM',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: outCtrl,
                        keyboardType: TextInputType.datetime,
                        decoration: const InputDecoration(
                          labelText: 'Clock Out',
                          hintText: 'HH:MM',
                        ),
                      ),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Clock-out is next day'),
                  value: nextDay,
                  onChanged: (value) => setSheet(() => nextDay = value),
                ),
                TextField(
                  controller: noteCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Note (optional)',
                  ),
                ),
                const SizedBox(height: 14),
                GradientButton(
                  fullWidth: true,
                  loading: saving,
                  onPressed: saving
                      ? null
                      : () async {
                          final date = DateTime.tryParse(dateCtrl.text.trim());
                          final inParts = inCtrl.text.trim().split(':');
                          final outParts = outCtrl.text.trim().split(':');
                          if (date == null ||
                              inParts.length != 2 ||
                              outParts.length != 2) {
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Enter a valid date and times in HH:MM format.',
                                ),
                              ),
                            );
                            return;
                          }
                          final inHour = int.tryParse(inParts[0]);
                          final inMinute = int.tryParse(inParts[1]);
                          final outHour = int.tryParse(outParts[0]);
                          final outMinute = int.tryParse(outParts[1]);
                          if (inHour == null ||
                              inMinute == null ||
                              outHour == null ||
                              outMinute == null ||
                              inHour < 0 ||
                              outHour < 0 ||
                              inMinute < 0 ||
                              outMinute < 0 ||
                              inHour > 23 ||
                              outHour > 23 ||
                              inMinute > 59 ||
                              outMinute > 59) {
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              const SnackBar(content: Text('Invalid time.')),
                            );
                            return;
                          }
                          final clockIn = DateTime(
                            date.year,
                            date.month,
                            date.day,
                            inHour,
                            inMinute,
                          );
                          final outDate = nextDay
                              ? date.add(const Duration(days: 1))
                              : date;
                          final clockOut = DateTime(
                            outDate.year,
                            outDate.month,
                            outDate.day,
                            outHour,
                            outMinute,
                          );
                          setSheet(() => saving = true);
                          try {
                            await _api.dio.post(
                              '/attendance/admin-entry',
                              data: {
                                'userId': selectedUser,
                                'date': DateFormat('yyyy-MM-dd').format(date),
                                'clockIn': clockIn.toUtc().toIso8601String(),
                                'clockOut': clockOut.toUtc().toIso8601String(),
                                'note': noteCtrl.text.trim(),
                              },
                            );
                            if (sheetContext.mounted) {
                              Navigator.pop(sheetContext);
                            }
                            await _load();
                            await _loadTeam();
                          } catch (error) {
                            if (sheetContext.mounted) {
                              ScaffoldMessenger.of(sheetContext).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    ApiClient.errorMessage(
                                      error,
                                      'Failed to save attendance entry',
                                    ),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              setSheet(() => saving = false);
                            }
                          }
                        },
                  icon: Icons.save_outlined,
                  child: const Text('Save Entry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _editShiftSettings() async {
    try {
      final res = await _api.dio.get('/org/me/attendance-settings');
      final s = (res.data['settings'] as Map? ?? res.data as Map)
          .cast<String, dynamic>();
      if (!mounted) return;
      final startCtrl = TextEditingController(
        text: s['shiftStartTime'] as String? ?? '09:30',
      );
      final endCtrl = TextEditingController(
        text: s['shiftEndTime'] as String? ?? '19:00',
      );
      final bufferCtrl = TextEditingController(
        text: '${s['bufferMinutes'] ?? 15}',
      );
      final halfDayCtrl = TextEditingController(
        text: '${s['halfDayMinutes'] ?? 240}',
      );
      final fullDayCtrl = TextEditingController(
        text: '${s['fullDayMinutes'] ?? 480}',
      );
      bool requireSelfie = s['requireSelfie'] as bool? ?? true;
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setSheet) => Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
              left: 16,
              right: 16,
              top: 8,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Shift Settings',
                  style: Theme.of(ctx).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: startCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Shift Start (HH:MM)',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: endCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Shift End (HH:MM)',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: bufferCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Grace/Buffer Minutes',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: halfDayCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Half Day Minutes',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: fullDayCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Full Day Minutes',
                          isDense: true,
                        ),
                      ),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Require selfie & GPS'),
                  value: requireSelfie,
                  onChanged: (v) => setSheet(() => requireSelfie = v),
                ),
                const SizedBox(height: 8),
                GradientButton(
                  fullWidth: true,
                  onPressed: () async {
                    try {
                      await _api.dio.patch(
                        '/org/me/attendance-settings',
                        data: {
                          'shiftStartTime': startCtrl.text.trim(),
                          'shiftEndTime': endCtrl.text.trim(),
                          'bufferMinutes': int.tryParse(bufferCtrl.text) ?? 15,
                          'halfDayMinutes':
                              int.tryParse(halfDayCtrl.text) ?? 240,
                          'fullDayMinutes':
                              int.tryParse(fullDayCtrl.text) ?? 480,
                          'requireSelfie': requireSelfie,
                        },
                      );
                      if (ctx.mounted) Navigator.pop(ctx);
                      _load();
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(
                            content: Text(
                              ApiClient.errorMessage(e, 'Failed to save'),
                            ),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                      }
                    }
                  },
                  child: const Text('Save'),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load settings')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  DateTime? _time(dynamic v) =>
      v == null ? null : DateTime.tryParse(v as String)?.toLocal();

  String _fmtTime(DateTime? dt) =>
      dt == null ? '—' : DateFormat('hh:mm a').format(dt);

  String _fmtDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _fmtMinutes(int? mins) {
    if (mins == null) return '—';
    return '${mins ~/ 60}h ${mins % 60}m';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final clockIn = _time(_today?['clockIn']);
    final clockOut = _time(_today?['clockOut']);
    final clockedIn = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;

    if (_loading) {
      return const Center(child: AppSpinner(size: 32));
    }

    return Column(
      children: [
        if (auth.isAdmin)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'my', label: Text('My')),
                      ButtonSegment(value: 'team', label: Text('Team Today')),
                      ButtonSegment(
                        value: 'records',
                        label: Text('All Records'),
                      ),
                    ],
                    selected: {_view},
                    onSelectionChanged: (sel) {
                      setState(() => _view = sel.first);
                      if (_view == 'team' && _team.isEmpty) _loadTeam();
                      if (_view == 'records') {
                        if (_team.isEmpty) _loadTeam();
                        _load();
                      } else if (_view == 'my') {
                        _load();
                      }
                    },
                  ),
                ),
                IconButton(
                  tooltip: 'Add attendance entry',
                  icon: const Icon(Icons.add_circle_outline_rounded),
                  onPressed: _addAttendanceEntry,
                ),
                IconButton(
                  tooltip: 'Shift settings',
                  icon: const Icon(Icons.settings_outlined),
                  onPressed: _editShiftSettings,
                ),
              ],
            ),
          ),
        Expanded(
          child: _view == 'team'
              ? _teamTodayView()
              : _myAttendanceView(
                  auth,
                  clockIn,
                  clockOut,
                  clockedIn,
                  done,
                  recordsOnly: _view == 'records',
                ),
        ),
      ],
    );
  }

  Widget _teamTodayView() {
    if (_teamLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadTeam,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _team.length,
        itemBuilder: (context, i) {
          final row = _team[i];
          final user = (row['user'] as Map).cast<String, dynamic>();
          final att = (row['attendance'] as Map?)?.cast<String, dynamic>();
          final inT = _time(att?['clockIn']);
          final outT = _time(att?['clockOut']);
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              onTap: () => _showTeamMember(row),
              title: Text(
                user['name'] as String? ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                att == null
                    ? 'Not clocked in'
                    : '${_fmtTime(inT)} → ${_fmtTime(outT)}',
              ),
              trailing: Wrap(
                spacing: 4,
                children: [
                  if (att?['isLate'] == true) _badge('Late', AppColors.warning),
                  if (att?['isEarlyLeave'] == true)
                    _badge('Early leave', AppColors.danger),
                  if (att != null && outT == null && inT != null)
                    _badge('Working', AppColors.success),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
    ),
  );

  double? _coordinate(dynamic value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '');

  Future<void> _openMap(dynamic latValue, dynamic lngValue) async {
    final lat = _coordinate(latValue);
    final lng = _coordinate(lngValue);
    if (lat == null || lng == null) return;
    final uri = Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': '$lat,$lng',
    });
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No maps app is available.')),
      );
    }
  }

  void _showSelfie(String url, String title) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .84),
      builder: (dialogContext) => Dialog(
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Flexible(
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('The selfie could not be loaded.'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showTeamMember(Map<String, dynamic> row) async {
    final user = (row['user'] as Map?)?.cast<String, dynamic>() ?? const {};
    final attendance = (row['attendance'] as Map?)?.cast<String, dynamic>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.of(context).surfaceSolid,
      barrierColor: Colors.black.withValues(alpha: .78),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.of(context).border,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: .14),
                    child: Text(
                      (user['name']?.toString().trim().isNotEmpty == true
                              ? user['name'].toString().trim()[0]
                              : '?')
                          .toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user['name']?.toString() ?? 'Team member',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          user['email']?.toString() ?? '',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (attendance == null)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Text('Not clocked in today'),
                  ),
                )
              else ...[
                _proofCard(
                  'Clock In',
                  attendance['clockIn'],
                  attendance['clockInSelfie'],
                  attendance['clockInLat'],
                  attendance['clockInLng'],
                ),
                const SizedBox(height: 10),
                _proofCard(
                  'Clock Out',
                  attendance['clockOut'],
                  attendance['clockOutSelfie'],
                  attendance['clockOutLat'],
                  attendance['clockOutLng'],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _proofCard(
    String label,
    dynamic timeValue,
    dynamic selfieValue,
    dynamic latValue,
    dynamic lngValue,
  ) {
    final selfie = selfieValue?.toString() ?? '';
    final hasSelfie = selfie.isNotEmpty;
    final hasLocation =
        _coordinate(latValue) != null && _coordinate(lngValue) != null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.of(context).surfaceLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(
                _fmtTime(_time(timeValue)),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: hasSelfie
                      ? () => _showSelfie(selfie, '$label selfie')
                      : null,
                  icon: const Icon(Icons.face_rounded, size: 18),
                  label: Text(hasSelfie ? 'View selfie' : 'No selfie'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: hasLocation
                      ? () => _openMap(latValue, lngValue)
                      : null,
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: Text(hasLocation ? 'Open map' : 'No location'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _myAttendanceView(
    AuthState auth,
    DateTime? clockIn,
    DateTime? clockOut,
    bool clockedIn,
    bool done, {
    bool recordsOnly = false,
  }) {
    final totalMins = _history.fold<int>(
      0,
      (s, r) => s + ((r['totalMinutes'] as int?) ?? 0),
    );
    final daysPresent = _history.where((r) => r['clockIn'] != null).length;
    final avgMins = daysPresent > 0 ? totalMins ~/ daysPresent : 0;
    final lateCount = _history.where((r) => r['isLate'] == true).length;
    final fullDays = _history.where((r) => r['dayType'] == 'full').length;
    final halfDays = _history.where((r) => r['dayType'] == 'half').length;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (!recordsOnly)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      DateFormat('EEEE, d MMMM').format(DateTime.now()),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    if (clockedIn) ...[
                      Text(
                        _fmtDuration(DateTime.now().difference(clockIn!)),
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Clocked in at ${_fmtTime(clockIn)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ] else if (done) ...[
                      Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.success,
                        size: 40,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Done for today',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_fmtTime(clockIn)} → ${_fmtTime(clockOut)}  ·  ${_fmtMinutes(_today?['totalMinutes'] as int?)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ] else ...[
                      Icon(
                        Icons.schedule_rounded,
                        color: Theme.of(context).disabledColor,
                        size: 40,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Not clocked in yet',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                    if (_requireSelfie && !done) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Selfie + location required to clock ${clockedIn ? 'out' : 'in'}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _acting || done
                            ? null
                            : (clockedIn ? _clockOut : _clockIn),
                        style: clockedIn
                            ? ElevatedButton.styleFrom(
                                backgroundColor: AppColors.danger,
                              )
                            : null,
                        icon: _acting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Icon(
                                clockedIn
                                    ? Icons.logout_rounded
                                    : Icons.login_rounded,
                              ),
                        label: Text(
                          _acting
                              ? 'Please wait…'
                              : done
                              ? 'Completed'
                              : (clockedIn ? 'Clock Out' : 'Clock In'),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          if (recordsOnly) ...[
            DropdownButtonFormField<String>(
              initialValue: _recordUserId,
              decoration: const InputDecoration(
                labelText: 'Team member',
                prefixIcon: Icon(Icons.person_search_outlined),
              ),
              items: [
                const DropdownMenuItem<String>(
                  value: null,
                  child: Text('All members'),
                ),
                ..._team.map((row) {
                  final user = (row['user'] as Map).cast<String, dynamic>();
                  return DropdownMenuItem<String>(
                    value: user['_id'].toString(),
                    child: Text(user['name']?.toString() ?? 'Member'),
                  );
                }),
              ],
              onChanged: (value) {
                setState(() => _recordUserId = value);
                _load();
              },
            ),
            const SizedBox(height: 12),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: (MediaQuery.sizeOf(context).width - 48) / 2,
                child: _statTile('Total Hours', _fmtMinutes(totalMins)),
              ),
              SizedBox(
                width: (MediaQuery.sizeOf(context).width - 48) / 2,
                child: _statTile('Days Present', '$daysPresent'),
              ),
              SizedBox(
                width: (MediaQuery.sizeOf(context).width - 48) / 2,
                child: _statTile('Avg Hours / Day', _fmtMinutes(avgMins)),
              ),
              if (recordsOnly) ...[
                SizedBox(
                  width: (MediaQuery.sizeOf(context).width - 48) / 2,
                  child: _statTile('Full Days', '$fullDays'),
                ),
                SizedBox(
                  width: (MediaQuery.sizeOf(context).width - 48) / 2,
                  child: _statTile('Half Days', '$halfDays'),
                ),
              ],
              SizedBox(
                width: (MediaQuery.sizeOf(context).width - 48) / 2,
                child: _statTile('Late', '$lateCount'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: const Icon(Icons.date_range, size: 16),
                  label: Text(
                    _from == null
                        ? 'Filter by date'
                        : '${DateFormat('dd MMM').format(_from!)} – ${DateFormat('dd MMM').format(_to!)}',
                  ),
                ),
              ),
              if (auth.isAdmin && recordsOnly) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _exportCsv,
                  icon: const Icon(Icons.download, size: 16),
                  label: const Text('Download Report'),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'History',
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          if (_history.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No attendance records yet')),
            )
          else
            ..._history.map((r) {
              final inT = _time(r['clockIn']);
              final outT = _time(r['clockOut']);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  onTap: recordsOnly
                      ? () {
                          final user =
                              (r['userId'] as Map?)?.cast<String, dynamic>() ??
                              const <String, dynamic>{};
                          _showTeamMember({'user': user, 'attendance': r});
                        }
                      : null,
                  leading: recordsOnly && r['userId'] is Map
                      ? CircleAvatar(
                          child: Text(
                            ((r['userId'] as Map)['name']?.toString() ?? '?')
                                .substring(0, 1)
                                .toUpperCase(),
                          ),
                        )
                      : null,
                  title: Text(
                    recordsOnly && r['userId'] is Map
                        ? (r['userId'] as Map)['name']?.toString() ??
                              'Team member'
                        : r['date']?.toString() ?? '—',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    recordsOnly
                        ? '${r['date'] ?? ''}  ·  ${_fmtTime(inT)} → ${_fmtTime(outT)}'
                        : '${_fmtTime(inT)} → ${_fmtTime(outT)}',
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _fmtMinutes(r['totalMinutes'] as int?),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 4,
                        children: [
                          if (r['isLate'] == true)
                            _badge('Late', AppColors.warning),
                          if (r['isEarlyLeave'] == true)
                            _badge('Early leave', AppColors.danger),
                          if (r['overtimeMinutes'] != null &&
                              (r['overtimeMinutes'] as num) > 0)
                            _badge('OT', AppColors.info),
                          if (r['dayType'] != null)
                            _badge(
                              r['dayType'] as String,
                              const Color(0xFF6B7280),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).dividerTheme.color ?? Colors.transparent,
        ),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
