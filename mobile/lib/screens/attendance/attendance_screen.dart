import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/file_output.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/card_skeleton.dart';
import '../../widgets/app_select.dart';
import '../../widgets/buttons.dart';
import '../../widgets/labeled_field.dart';
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
  // The server's own totals for the loaded range (28 Oct 2026): it counts
  // every entry, not just the page the app has, plus auto-closed,
  // never-clocked-out and outside-shift entries.
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _team = [];
  bool _loading = true;
  bool _acting = false;
  bool _teamLoading = false;
  String _view = 'my';
  String? _recordUserId;
  Timer? _ticker;
  DateTime? _from;
  DateTime? _to;
  Map<String, dynamic>? _shiftSettings;

  @override
  void initState() {
    super.initState();
    _load();
    _loadShiftSettings();
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
        _summary = ((results[1].data['total'] as num?) ?? 0) > 0
            ? (results[1].data['summary'] as Map?)?.cast<String, dynamic>()
            : null;
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

  Future<void> _loadShiftSettings() async {
    try {
      final res = await _api.dio.get('/org/me/attendance-settings');
      final s = (res.data['settings'] as Map? ?? res.data as Map)
          .cast<String, dynamic>();
      if (mounted) setState(() => _shiftSettings = s);
    } catch (_) {
      // Header summary is optional — silently skip if unavailable.
    }
  }

  String? get _shiftSummary {
    final s = _shiftSettings;
    if (s == null) return null;
    final start = s['shiftStartTime'] as String? ?? '09:30';
    final end = s['shiftEndTime'] as String? ?? '19:00';
    final buffer = s['bufferMinutes'] ?? 15;
    // Short enough for the header's one line; half and full day lengths are
    // in Shift settings.
    return 'Shift $start to $end · $buffer min grace';
  }

  /// The record's day ("2026-07-25") as "Sat, 25 Jul 2026".
  String _fmtDay(Object? date) {
    final d = DateTime.tryParse(date?.toString() ?? '');
    return d == null ? (date?.toString() ?? '—') : DateFormat('EEE, d MMM yyyy').format(d);
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
          // No photo (camera unavailable): tell the server it was declared, as the web does.
          if (proof.selfie == null && _requireSelfie) 'proofUnavailable': true,
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
      // An Excel report in the ArthaLeads look, with a summary per member and
      // the selfies in it, as the web's (29 Oct 2026).
      final res = await _api.dio.get(
        '/attendance/export',
        options: Options(responseType: ResponseType.bytes, receiveTimeout: const Duration(minutes: 2)),
        queryParameters: {
          'format': 'xlsx',
          if (_view == 'records' && _recordUserId != null)
            'userId': _recordUserId,
          if (_from != null) 'from': DateFormat('yyyy-MM-dd').format(_from!),
          if (_to != null) 'to': DateFormat('yyyy-MM-dd').format(_to!),
        },
      );
      final bytes = res.data as List<int>;
      if (!mounted) return;
      final label = _from != null && _to != null
          ? '${DateFormat('yyyy-MM-dd').format(_from!)}_to_${DateFormat('yyyy-MM-dd').format(_to!)}'
          : 'all';
      await FileOutput.saveAndOpen(context, Uint8List.fromList(bytes), 'attendance_$label.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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

  /// India time of an ISO timestamp, whatever the phone's own time zone.
  static DateTime _ist(String iso) => DateTime.parse(iso).toUtc().add(const Duration(hours: 5, minutes: 30));

  /// "2026-10-28" + "09:30" in India time, as the UTC instant the server wants
  /// (web: new Date(`${date}T${time}:00+05:30`)).
  static String _istIso(DateTime date, int hour, int minute) =>
      DateTime.utc(date.year, date.month, date.day, hour, minute)
          .subtract(const Duration(hours: 5, minutes: 30))
          .toIso8601String();

  /// Add an entry, or with [entry] correct or delete one (28 Oct 2026, as the
  /// web): a missing or automatic clock-out can be set to the real time.
  Future<void> _addAttendanceEntry([Map<String, dynamic>? entry]) async {
    if (_team.isEmpty) await _loadTeam();
    if (!mounted || _team.isEmpty) return;
    final members = _team
        .map((row) => (row['user'] as Map).cast<String, dynamic>())
        .toList();
    final editing = entry != null && entry['_id'] != null;
    final entryUser = entry?['userId'] is Map ? '${(entry!['userId'] as Map)['_id']}' : '${entry?['userId'] ?? ''}';
    String selectedUser = members.any((m) => '${m['_id']}' == entryUser) ? entryUser : members.first['_id'].toString();
    final inIso = '${entry?['clockIn'] ?? ''}';
    final outIso = '${entry?['clockOut'] ?? ''}';
    final inIst = inIso.isEmpty ? null : _ist(inIso);
    final outIst = outIso.isEmpty ? null : _ist(outIso);
    final dateCtrl = TextEditingController(
      text: editing && '${entry['date'] ?? ''}'.length >= 10
          ? '${entry['date']}'.substring(0, 10)
          : DateFormat('yyyy-MM-dd').format(DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30))),
    );
    final inCtrl = TextEditingController(text: inIst != null ? DateFormat('HH:mm').format(inIst) : (editing ? '' : '09:30'));
    // An automatic clock-out is a guess: leave it for the real time.
    final outCtrl = TextEditingController(
        text: outIst != null && entry?['autoClosed'] != true ? DateFormat('HH:mm').format(outIst) : (editing ? '' : '19:00'));
    final noteCtrl = TextEditingController(text: '${entry?['note'] ?? ''}');
    var nextDay = inIst != null && outIst != null && outIst.day != inIst.day;
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
                      editing ? 'Edit Attendance Entry' : 'Add Attendance Entry',
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
                AppSelect<String>(
                  label: 'Team member',
                  value: selectedUser,
                  options: {
                    for (final user in members)
                      user['_id'].toString(): user['name']?.toString() ?? 'Member',
                  },
                  onChanged: (value) {
                    if (value != null) setSheet(() => selectedUser = value);
                  },
                ),
                const SizedBox(height: 10),
                LabeledField(
                  label: 'Date',
                  child: TextField(
                    controller: dateCtrl,
                    keyboardType: TextInputType.datetime,
                    decoration: const InputDecoration(hintText: 'YYYY-MM-DD'),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: LabeledField(
                        label: 'Clock In',
                        child: TextField(
                          controller: inCtrl,
                          keyboardType: TextInputType.datetime,
                          decoration: const InputDecoration(hintText: 'HH:MM'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: LabeledField(
                        label: 'Clock Out (optional)',
                        child: TextField(
                          controller: outCtrl,
                          keyboardType: TextInputType.datetime,
                          decoration: const InputDecoration(hintText: 'HH:MM'),
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
                LabeledField(
                  label: 'Note (optional)',
                  child: TextField(controller: noteCtrl, maxLines: 2),
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
                          // No clock-out yet is allowed (still at work, or
                          // to be set later); the server says when it isn't.
                          final noOut = outCtrl.text.trim().isEmpty;
                          final outParts = noOut ? ['0', '0'] : outCtrl.text.trim().split(':');
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
                          final outDate = nextDay
                              ? date.add(const Duration(days: 1))
                              : date;
                          setSheet(() => saving = true);
                          try {
                            await _api.dio.post(
                              '/attendance/admin-entry',
                              data: {
                                if (editing) 'id': entry['_id'],
                                'userId': selectedUser,
                                'date': DateFormat('yyyy-MM-dd').format(date),
                                'clockIn': _istIso(date, inHour, inMinute),
                                'clockOut': noOut ? null : _istIso(outDate, outHour, outMinute),
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
                if (editing) ...[
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              final ok = await showDialog<bool>(
                                context: sheetContext,
                                builder: (d) => AlertDialog(
                                  title: const Text('Delete this entry?'),
                                  content: const Text('The clock-in and clock-out for this day are removed.'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
                                    TextButton(
                                      onPressed: () => Navigator.pop(d, true),
                                      child: const Text('Delete', style: TextStyle(color: AppColors.danger)),
                                    ),
                                  ],
                                ),
                              );
                              if (ok != true) return;
                              setSheet(() => saving = true);
                              try {
                                await _api.dio.delete('/attendance/${entry['_id']}');
                                if (sheetContext.mounted) Navigator.pop(sheetContext);
                                await _load();
                                await _loadTeam();
                              } catch (error) {
                                if (sheetContext.mounted) {
                                  ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(
                                    content: Text(ApiClient.errorMessage(error, 'Could not delete the entry')),
                                    backgroundColor: AppColors.danger,
                                  ));
                                  setSheet(() => saving = false);
                                }
                              }
                            },
                      icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
                      label: const Text('Delete entry', style: TextStyle(color: AppColors.danger)),
                    ),
                  ),
                ],
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
                LabeledField(
                  label: 'Shift Start (HH:MM)',
                  child: TextField(
                    controller: startCtrl,
                    decoration: const InputDecoration(isDense: true),
                  ),
                ),
                const SizedBox(height: 8),
                LabeledField(
                  label: 'Shift End (HH:MM)',
                  child: TextField(
                    controller: endCtrl,
                    decoration: const InputDecoration(isDense: true),
                  ),
                ),
                const SizedBox(height: 8),
                LabeledField(
                  label: 'Grace/Buffer Minutes',
                  child: TextField(
                    controller: bufferCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(isDense: true),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: LabeledField(
                        label: 'Half Day Minutes',
                        child: TextField(
                          controller: halfDayCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(isDense: true),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: LabeledField(
                        label: 'Full Day Minutes',
                        child: TextField(
                          controller: fullDayCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(isDense: true),
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
                      _loadShiftSettings();
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

  /// Clocked in over a day ago and never out (web: neverClosed).
  bool _neverClosed(Map<String, dynamic> r) {
    final inn = DateTime.tryParse('${r['clockIn'] ?? ''}');
    return inn != null && r['clockOut'] == null && DateTime.now().difference(inn) > const Duration(hours: 24);
  }

  /// The clock-out time, or what went wrong with it.
  String _outText(Map<String, dynamic> r, DateTime? outT) {
    if (outT != null) return r['autoClosed'] == true ? '${_fmtTime(outT)} (closed automatically)' : _fmtTime(outT);
    if (_neverClosed(r)) return 'Not clocked out';
    return _fmtTime(outT);
  }

  String _fmtMinutes(int? mins) {
    if (mins == null) return '—';
    return '${mins ~/ 60}h ${mins % 60}m';
  }

  /// While loading: sample days drawn by the real history list, shimmering.
  List<Map<String, dynamic>> get _historyRows {
    if (!_loading) return _history;
    final now = DateTime.now();
    return [
      for (var i = 1; i <= 5; i++)
        {
          '_id': 'sample$i',
          'date': now.subtract(Duration(days: i)).toIso8601String(),
          'clockIn': DateTime(now.year, now.month, now.day - i, 9, 30).toIso8601String(),
          'clockOut': DateTime(now.year, now.month, now.day - i, 18, 45).toIso8601String(),
          'dayType': 'full',
        },
    ];
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final clockIn = _time(_today?['clockIn']);
    final clockOut = _time(_today?['clockOut']);
    final clockedIn = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;

    return SectionSkeleton(loading: _loading, child: Column(
      children: [
        // Same header as Leads and Follow-ups (30 Oct 2026, owner): title
        // and a one-line note, the main action and a menu on the right, the
        // views as chips underneath.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Attendance',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                Text(_shiftSummary ?? 'Clock-ins, hours and selfies',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
            if (auth.isAdmin) ...[
              const SizedBox(width: 8),
              // Compact, so the title and shift note keep the room.
              GradientButton(
                onPressed: _addAttendanceEntry,
                icon: Icons.add_rounded,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: const Text('Add'),
              ),
              const SizedBox(width: 6),
              PopupMenuButton<String>(
                tooltip: 'Shift settings and report',
                onSelected: (v) {
                  switch (v) {
                    case 'shift':
                      _editShiftSettings();
                    case 'report':
                      _exportCsv();
                  }
                },
                itemBuilder: (_) => [
                  // Only admins can save shift settings (PATCH is admin-only).
                  if (auth.isWaAdmin)
                    const PopupMenuItem(
                      value: 'shift',
                      child: ListTile(leading: Icon(Icons.schedule_rounded), title: Text('Shift settings'), dense: true),
                    ),
                  const PopupMenuItem(
                    value: 'report',
                    child: ListTile(leading: Icon(Icons.table_chart_outlined), title: Text('Download report'), dense: true),
                  ),
                ],
                child: IgnorePointer(
                  child: IconButton.outlined(onPressed: () {}, icon: const Icon(Icons.more_horiz_rounded, size: 20)),
                ),
              ),
            ],
          ]),
        ),
        if (auth.isAdmin)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              children: [
                for (final (value, label) in const [('my', 'My'), ('team', 'Team today'), ('records', 'All records')])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      selected: _view == value,
                      showCheckmark: false,
                      visualDensity: VisualDensity.compact,
                      label: Text(label),
                      onSelected: (_) {
                        if (_view == value) return;
                        setState(() => _view = value);
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
    ));
  }

  Widget _teamTodayView() {
    final clockIn = _time(_today?['clockIn']);
    final clockOut = _time(_today?['clockOut']);
    final clockedIn = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;

    if (_teamLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadTeam,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _statusCard(clockIn, clockOut, clockedIn, done),
          const SizedBox(height: 16),
          if (_team.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(
                    Icons.groups_outlined,
                    size: 40,
                    color: AppColors.primary.withValues(alpha: 0.3),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'No team members found',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          else
            ..._team.map((row) {
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
                      if (att?['overtimeMinutes'] != null &&
                          (att!['overtimeMinutes'] as num) > 0)
                        _badge('OT', AppColors.info),
                      if (att?['dayType'] != null)
                        _badge(att!['dayType'] as String, const Color(0xFF6B7280)),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _statusCard(
    DateTime? clockIn,
    DateTime? clockOut,
    bool clockedIn,
    bool done,
  ) {
    return Card(
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
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
              ),
            ],
            const SizedBox(height: 20),
            Center(
              // The same rounded pill as Home's Clock In, sized to its label
              // rather than the card's width (30 Oct 2026, owner).
              child: FilledButton.icon(
                onPressed: _acting || done
                    ? null
                    : (clockedIn ? _clockOut : _clockIn),
                style: FilledButton.styleFrom(
                  backgroundColor: clockedIn ? AppColors.danger : AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 36),
                  shape: const StadiumBorder(),
                  textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
                icon: _acting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(clockedIn ? Icons.logout_rounded : Icons.login_rounded),
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
                if (attendance['autoClosed'] == true) ...[
                  const SizedBox(height: 8),
                  const Text(
                    "Nobody clocked out, so it was closed at the shift's end. Edit the entry to set the real time.",
                    style: TextStyle(fontSize: 12, color: Color(0xFFD97706)),
                  ),
                ],
                if (context.read<AuthState>().isAdmin && attendance['_id'] != null) ...[
                  const SizedBox(height: 12),
                  SecondaryButton(
                    fullWidth: true,
                    icon: Icons.edit_rounded,
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      _addAttendanceEntry({...attendance, 'userId': attendance['userId'] ?? user['_id']});
                    },
                    child: const Text('Edit entry'),
                  ),
                ],
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
    final sum = _loading ? null : _summary;
    int n(String k) => ((sum?[k] as num?) ?? 0).toInt();
    final totalMins = sum != null
        ? n('totalMinutes')
        : _historyRows.fold<int>(0, (s, r) => s + ((r['totalMinutes'] as int?) ?? 0));
    final daysPresent = sum != null ? n('daysPresent') : _historyRows.where((r) => r['clockIn'] != null).length;
    final avgMins = sum != null ? n('avgMinutes') : (daysPresent > 0 ? totalMins ~/ daysPresent : 0);
    final lateCount = sum != null ? n('late') : _historyRows.where((r) => r['isLate'] == true).length;
    final fullDays = sum != null ? n('fullDays') : _historyRows.where((r) => r['dayType'] == 'full').length;
    final halfDays = sum != null ? n('halfDays') : _historyRows.where((r) => r['dayType'] == 'half').length;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _statusCard(clockIn, clockOut, clockedIn, done),
          const SizedBox(height: 16),
          if (recordsOnly) ...[
            AppSelect<String?>(
              label: 'Team member',
              value: _recordUserId,
              options: {
                null: 'All members',
                for (final row in _team)
                  ((row['user'] as Map).cast<String, dynamic>()['_id'].toString()):
                      ((row['user'] as Map).cast<String, dynamic>()['name']?.toString() ?? 'Member'),
              },
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
          if (sum != null && (n('autoClosed') > 0 || n('notClockedOut') > 0 || n('outsideShift') > 0)) ...[
            const SizedBox(height: 10),
            Text(
              [
                if (n('autoClosed') > 0) '${n('autoClosed')} closed automatically (no clock-out)',
                if (n('notClockedOut') > 0) '${n('notClockedOut')} never clocked out',
                if (n('outsideShift') > 0) '${n('outsideShift')} clocked in after the shift',
              ].join(' · '),
              style: TextStyle(fontSize: 12, color: AppTheme.of(context).textSoft),
            ),
          ],
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'History',
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          if (_historyRows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No attendance records yet')),
            )
          else
            ..._historyRows.map((r) {
              final inT = _time(r['clockIn']);
              final outT = _time(r['clockOut']);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  onTap: () {
                    final user = recordsOnly
                        ? ((r['userId'] as Map?)?.cast<String, dynamic>() ??
                              const <String, dynamic>{})
                        : (auth.user ?? const <String, dynamic>{});
                    _showTeamMember({'user': user, 'attendance': r});
                  },
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
                        : _fmtDay(r['date']),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        recordsOnly
                            ? '${_fmtDay(r['date'])}  ·  ${_fmtTime(inT)} → ${_outText(r, outT)}'
                            : '${_fmtTime(inT)} → ${_outText(r, outT)}',
                      ),
                      if ((r['note'] as String? ?? '').isNotEmpty)
                        Text(
                          r['note'] as String,
                          style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                  isThreeLine: (r['note'] as String? ?? '').isNotEmpty,
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
                          if (r['autoClosed'] == true)
                            _badge('Auto closed', const Color(0xFFD97706))
                          else if (_neverClosed(r))
                            _badge('No clock-out', AppColors.danger),
                          if (r['outsideShift'] == true)
                            _badge('Outside shift', const Color(0xFF6366F1))
                          else if (r['isLate'] == true)
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
