import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

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
  bool _showTeam = false;
  Timer? _ticker;
  DateTime? _from;
  DateTime? _to;

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _today?['clockIn'] != null && _today?['clockOut'] == null) {
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
      final results = await Future.wait([
        _api.dio.get('/attendance/status'),
        _api.dio.get('/attendance', queryParameters: {
          'limit': 30,
          if (_from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
          if (_to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
        }),
      ]);
      setState(() {
        _today = (results[0].data['data'] as Map?)?.cast<String, dynamic>();
        _requireSelfie = results[0].data['requireSelfie'] as bool? ?? true;
        _history
          ..clear()
          ..addAll((results[1].data['data'] as List? ?? []).cast<Map<String, dynamic>>());
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load attendance')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTeam() async {
    setState(() => _teamLoading = true);
    try {
      final res = await _api.dio.get('/attendance/team-today');
      setState(() => _team = (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load team status')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _teamLoading = false);
    }
  }

  /// Captures a selfie via the device camera and returns a `data:` URI, or
  /// null if the user cancels — matching the org's requireSelfie contract.
  Future<String?> _captureSelfie() async {
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, imageQuality: 70);
      if (photo == null) return null;
      final bytes = await File(photo.path).readAsBytes();
      return 'data:image/jpeg;base64,${base64Encode(bytes)}';
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Camera unavailable: $e'),
          backgroundColor: AppColors.danger,
        ));
      }
      return null;
    }
  }

  /// Gets current GPS position, requesting permission if needed. Returns
  /// null (not blocking) if location is unavailable — the backend treats
  /// lat/lng as optional so attendance still records without it.
  Future<Position?> _getLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Turn on location services for GPS-verified attendance.'),
            backgroundColor: AppColors.warning,
          ));
        }
        return null;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(permission == LocationPermission.deniedForever
                ? 'Location permission permanently denied — enable it in Settings > Apps > Arthaleads > Permissions.'
                : 'Location permission denied — attendance will be recorded without GPS.'),
            backgroundColor: AppColors.warning,
          ));
        }
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _clockIn() => _punch('/attendance/clockin');
  Future<void> _clockOut() => _punch('/attendance/clockout');

  Future<void> _punch(String path) async {
    setState(() => _acting = true);
    try {
      String? selfie;
      if (_requireSelfie) {
        selfie = await _captureSelfie();
        if (selfie == null) {
          setState(() => _acting = false);
          return; // org requires a selfie and the user cancelled — don't punch silently
        }
      }
      final pos = await _getLocation();
      await _api.dio.post(path, data: {
        if (selfie != null) 'selfie': selfie,
        if (pos != null) 'lat': pos.latitude,
        if (pos != null) 'lng': pos.longitude,
      });
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Action failed')),
          backgroundColor: AppColors.danger,
        ));
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
      initialDateRange: _from != null && _to != null ? DateTimeRange(start: _from!, end: _to!) : null,
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
      final res = await _api.dio.get('/attendance/export', options: Options(responseType: ResponseType.bytes),
          queryParameters: {
            if (_from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
            if (_to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
          });
      final bytes = res.data as List<int>;
      await Share.shareXFiles([
        XFile.fromData(Uint8List.fromList(bytes), name: 'attendance.csv', mimeType: 'text/csv'),
      ]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Export failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  Future<void> _editShiftSettings() async {
    try {
      final res = await _api.dio.get('/org/me/attendance-settings');
      final s = (res.data['settings'] as Map? ?? res.data as Map).cast<String, dynamic>();
      if (!mounted) return;
      final startCtrl = TextEditingController(text: s['shiftStartTime'] as String? ?? '09:30');
      final endCtrl = TextEditingController(text: s['shiftEndTime'] as String? ?? '19:00');
      final bufferCtrl = TextEditingController(text: '${s['bufferMinutes'] ?? 15}');
      bool requireSelfie = s['requireSelfie'] as bool? ?? true;
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setSheet) => Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Shift Settings', style: Theme.of(ctx).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextField(controller: startCtrl, decoration: const InputDecoration(labelText: 'Shift Start (HH:MM)', isDense: true)),
                const SizedBox(height: 8),
                TextField(controller: endCtrl, decoration: const InputDecoration(labelText: 'Shift End (HH:MM)', isDense: true)),
                const SizedBox(height: 8),
                TextField(controller: bufferCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Grace/Buffer Minutes', isDense: true)),
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
                      await _api.dio.patch('/org/me/attendance-settings', data: {
                        'shiftStartTime': startCtrl.text.trim(),
                        'shiftEndTime': endCtrl.text.trim(),
                        'bufferMinutes': int.tryParse(bufferCtrl.text) ?? 15,
                        'requireSelfie': requireSelfie,
                      });
                      if (ctx.mounted) Navigator.pop(ctx);
                      _load();
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Failed to save')),
                          backgroundColor: AppColors.danger,
                        ));
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load settings')),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  DateTime? _time(dynamic v) => v == null ? null : DateTime.tryParse(v as String)?.toLocal();

  String _fmtTime(DateTime? dt) => dt == null ? '—' : DateFormat('hh:mm a').format(dt);

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
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('My Attendance')),
                      ButtonSegment(value: true, label: Text('Team Today')),
                    ],
                    selected: {_showTeam},
                    onSelectionChanged: (sel) {
                      setState(() => _showTeam = sel.first);
                      if (_showTeam && _team.isEmpty) _loadTeam();
                    },
                  ),
                ),
                IconButton(icon: const Icon(Icons.settings_outlined), onPressed: _editShiftSettings),
              ],
            ),
          ),
        Expanded(
          child: _showTeam ? _teamTodayView() : _myAttendanceView(auth, clockIn, clockOut, clockedIn, done),
        ),
      ],
    );
  }

  Widget _teamTodayView() {
    if (_teamLoading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
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
              title: Text(user['name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(att == null ? 'Not clocked in' : '${_fmtTime(inT)} → ${_fmtTime(outT)}'),
              trailing: Wrap(spacing: 4, children: [
                if (att?['isLate'] == true) _badge('Late', AppColors.warning),
                if (att?['isEarlyLeave'] == true) _badge('Early leave', AppColors.danger),
                if (att != null && outT == null && inT != null) _badge('Working', AppColors.success),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
      );

  Widget _myAttendanceView(AuthState auth, DateTime? clockIn, DateTime? clockOut, bool clockedIn, bool done) {
    final totalMins = _history.fold<int>(0, (s, r) => s + ((r['totalMinutes'] as int?) ?? 0));
    final daysPresent = _history.where((r) => r['clockIn'] != null).length;
    final avgMins = daysPresent > 0 ? totalMins ~/ daysPresent : 0;
    final lateCount = _history.where((r) => r['isLate'] == true).length;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(DateFormat('EEEE, d MMMM').format(DateTime.now()), style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 12),
                  if (clockedIn) ...[
                    Text(
                      _fmtDuration(DateTime.now().difference(clockIn!)),
                      style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                    const SizedBox(height: 4),
                    Text('Clocked in at ${_fmtTime(clockIn)}', style: Theme.of(context).textTheme.bodySmall),
                  ] else if (done) ...[
                    Icon(Icons.check_circle_rounded, color: AppColors.success, size: 40),
                    const SizedBox(height: 8),
                    Text('Done for today', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      '${_fmtTime(clockIn)} → ${_fmtTime(clockOut)}  ·  ${_fmtMinutes(_today?['totalMinutes'] as int?)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ] else ...[
                    Icon(Icons.schedule_rounded, color: Theme.of(context).disabledColor, size: 40),
                    const SizedBox(height: 8),
                    Text('Not clocked in yet', style: Theme.of(context).textTheme.titleMedium),
                  ],
                  if (_requireSelfie && !done) ...[
                    const SizedBox(height: 6),
                    Text('Selfie + location required to clock ${clockedIn ? 'out' : 'in'}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _acting || done ? null : (clockedIn ? _clockOut : _clockIn),
                      style: clockedIn ? ElevatedButton.styleFrom(backgroundColor: AppColors.danger) : null,
                      icon: _acting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Icon(clockedIn ? Icons.logout_rounded : Icons.login_rounded),
                      label: Text(_acting ? 'Please wait…' : done ? 'Completed' : (clockedIn ? 'Clock Out' : 'Clock In')),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _statTile('Days Present', '$daysPresent')),
              const SizedBox(width: 8),
              Expanded(child: _statTile('Avg Hours', _fmtMinutes(avgMins))),
              const SizedBox(width: 8),
              Expanded(child: _statTile('Late', '$lateCount')),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: const Icon(Icons.date_range, size: 16),
                  label: Text(_from == null
                      ? 'Filter by date'
                      : '${DateFormat('dd MMM').format(_from!)} – ${DateFormat('dd MMM').format(_to!)}'),
                ),
              ),
              if (auth.isAdmin) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(onPressed: _exportCsv, icon: const Icon(Icons.download, size: 16), label: const Text('CSV')),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text('History', style: Theme.of(context).textTheme.titleSmall),
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
                  title: Text(r['date'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${_fmtTime(inT)} → ${_fmtTime(outT)}'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_fmtMinutes(r['totalMinutes'] as int?), style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Wrap(spacing: 4, children: [
                        if (r['isLate'] == true) _badge('Late', AppColors.warning),
                        if (r['isEarlyLeave'] == true) _badge('Early leave', AppColors.danger),
                        if (r['overtimeMinutes'] != null && (r['overtimeMinutes'] as num) > 0) _badge('OT', AppColors.info),
                        if (r['dayType'] != null) _badge(r['dayType'] as String, const Color(0xFF6B7280)),
                      ]),
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
        border: Border.all(color: Theme.of(context).dividerTheme.color ?? Colors.transparent),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
