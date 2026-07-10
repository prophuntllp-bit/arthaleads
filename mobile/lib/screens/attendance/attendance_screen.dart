import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Attendance — GET /attendance/status, POST /attendance/clockin, /clockout,
/// GET /attendance (history). Mirrors frontend/src/pages/Attendance.jsx,
/// minus selfie/geo capture — the backend treats both as optional, so a
/// plain clock in/out already fully works without camera/location plugins.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _api = ApiClient.instance;

  Map<String, dynamic>? _today;
  final List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  bool _acting = false;
  Timer? _ticker;

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
        _api.dio.get('/attendance', queryParameters: {'limit': 30}),
      ]);
      setState(() {
        _today = (results[0].data['data'] as Map?)?.cast<String, dynamic>();
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

  Future<void> _clockIn() async {
    setState(() => _acting = true);
    try {
      await _api.dio.post('/attendance/clockin');
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Clock-in failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _clockOut() async {
    setState(() => _acting = true);
    try {
      await _api.dio.post('/attendance/clockout');
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Clock-out failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _acting = false);
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
    final clockIn = _time(_today?['clockIn']);
    final clockOut = _time(_today?['clockOut']);
    final clockedIn = clockIn != null && clockOut == null;
    final done = clockIn != null && clockOut != null;

    return _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : RefreshIndicator(
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
                        Text(
                          DateFormat('EEEE, d MMMM').format(DateTime.now()),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 12),
                        if (clockedIn) ...[
                          Text(
                            _fmtDuration(DateTime.now().difference(clockIn)),
                            style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Clocked in at ${_fmtTime(clockIn)}',
                              style: Theme.of(context).textTheme.bodySmall),
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
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _acting || done
                                ? null
                                : (clockedIn ? _clockOut : _clockIn),
                            style: clockedIn
                                ? ElevatedButton.styleFrom(backgroundColor: AppColors.danger)
                                : null,
                            icon: Icon(clockedIn ? Icons.logout_rounded : Icons.login_rounded),
                            label: Text(_acting
                                ? 'Please wait…'
                                : done
                                    ? 'Completed'
                                    : (clockedIn ? 'Clock Out' : 'Clock In')),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
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
                        title: Text(r['date'] as String? ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${_fmtTime(inT)} → ${_fmtTime(outT)}'),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(_fmtMinutes(r['totalMinutes'] as int?),
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            if (r['isLate'] == true)
                              const Text('Late', style: TextStyle(color: AppColors.warning, fontSize: 11)),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
  }
}
