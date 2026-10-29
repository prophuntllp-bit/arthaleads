import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/plan.dart';
import '../core/theme.dart';
import '../core/theme_state.dart';
import '../screens/attendance/attendance_capture_sheet.dart';
import 'initials_avatar.dart';
import '../core/constants.dart';

/// The drawer's bottom profile button — tapping it expands a card upward
/// with the user's details, clock in/out, live date & time, and quick
/// actions (My Profile, Referrals, theme toggle, Sign Out). Mirrors
/// Sidebar.jsx's mobile-only inline profile dropdown.
class ProfileMenu extends StatefulWidget {
  final ValueChanged<String> onNavigate;
  final VoidCallback onClose;

  const ProfileMenu({
    super.key,
    required this.onNavigate,
    required this.onClose,
  });

  @override
  State<ProfileMenu> createState() => _ProfileMenuState();
}

class _ProfileMenuState extends State<ProfileMenu> {
  final _api = ApiClient.instance;
  bool _open = false;
  bool _loaded = false;
  bool _requireSelfie = true;
  Map<String, dynamic>? _today;
  bool _acting = false;
  Timer? _ticker;

  bool get _clockedIn =>
      _today?['clockIn'] != null && _today?['clockOut'] == null;
  bool get _clockedOut =>
      _today?['clockIn'] != null && _today?['clockOut'] != null;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _toggleOpen(bool attendanceEnabled) {
    setState(() => _open = !_open);
    if (_open) {
      if (!_loaded && attendanceEnabled) _loadStatus();
      _ticker ??= Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    } else {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  Future<void> _loadStatus() async {
    try {
      final res = await _api.dio.get('/attendance/status');
      if (mounted) {
        setState(() {
          _today = (res.data['data'] as Map?)?.cast<String, dynamic>();
          _requireSelfie = res.data['requireSelfie'] as bool? ?? true;
          _loaded = true;
        });
      }
    } catch (_) {
      // Clock widget is a convenience here — silently skip if unavailable.
    }
  }

  Future<void> _punch(bool clockIn) async {
    final path = clockIn ? '/attendance/clockin' : '/attendance/clockout';
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
      await _loadStatus();
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

  String get _elapsed {
    final clockIn = DateTime.tryParse(_today?['clockIn']?.toString() ?? '');
    if (clockIn == null) return '';
    final d = DateTime.now().difference(clockIn);
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.inHours)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';
  }

  String get _wallClock {
    final now = DateTime.now();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final day =
        '${now.day.toString().padLeft(2, '0')} ${months[now.month - 1]} ${now.year}';
    final hour12 = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final ampm = now.hour >= 12 ? 'PM' : 'AM';
    final time =
        '${hour12.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')} $ampm';
    return '$day | $time';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final themeState = context.watch<ThemeState>();
    final t = AppTheme.of(context);
    final user = auth.user;
    final attendanceEnabled = canAccess(auth.org, 'growth');

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_open)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 8),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: t.surfaceSolid,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: t.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: t.border)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      InitialsAvatar(
                        avatarValue: user?['avatar'] as String?,
                        radius: 22,
                        backgroundColor: AppColors.primary.withValues(
                          alpha: 0.12,
                        ),
                        fallback: Text(
                          (user?['name'] as String? ?? '?').isNotEmpty
                              ? (user!['name'] as String)[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?['name'] as String? ?? '',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                roleLabel(auth.role),
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            if ((user?['phone'] as String? ?? '')
                                .isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Row(
                                children: [
                                  Icon(
                                    Icons.phone,
                                    size: 11,
                                    color: t.textSoft,
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    user!['phone'] as String,
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: t.textSoft,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if ((user?['email'] as String? ?? '')
                                .isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Icon(
                                    Icons.mail_outline,
                                    size: 11,
                                    color: t.textSoft,
                                  ),
                                  const SizedBox(width: 5),
                                  Expanded(
                                    child: Text(
                                      user!['email'] as String,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: t.textSoft,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (attendanceEnabled)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                    child: _clockedOut
                        ? Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: t.surfaceLow,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.check_circle_outline,
                                  size: 14,
                                  color: t.textSoft,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Done for today',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: t.textSoft,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : _clockedIn
                        ? InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: _acting ? null : () => _punch(false),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: const BoxDecoration(
                                      color: AppColors.success,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    '${_elapsed.isEmpty ? "Active" : _elapsed} · Clock Out',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.danger,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : InkWell(
                            borderRadius: BorderRadius.circular(99),
                            onTap: _acting ? null : () => _punch(true),
                            // Orange pill, like Clock In on Home and Attendance
                            // (30 Oct 2026: it was green and square-cornered).
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              decoration: const ShapeDecoration(
                                color: AppColors.primary,
                                shape: StadiumBorder(),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.login_rounded,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                                  SizedBox(width: 6),
                                  Text(
                                    'Clock In',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                  ),
                Container(
                  margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: t.surfaceLow,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: t.border),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'Date & Time',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                          color: t.textSoft,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _wallClock,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: t.text,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Column(
                    children: [
                      _actionRow(
                        context,
                        icon: Icons.person_outline,
                        label: 'My Profile',
                        onTap: () {
                          _toggleOpen(attendanceEnabled);
                          widget.onNavigate('Settings');
                          widget.onClose();
                        },
                      ),
                      // Admins: sign in as a teammate for up to 2 hours (web: AccountSwitcher).
                      if (context.read<AuthState>().role == 'admin' && context.read<AuthState>().switchedFrom == null)
                        _actionRow(
                          context,
                          icon: Icons.swap_horiz_rounded,
                          label: 'Switch account',
                          onTap: () {
                            // The drawer closes first, so the sheet opens from
                            // the app's own navigator, not this menu.
                            final rootContext = Navigator.of(context, rootNavigator: true).context;
                            _toggleOpen(attendanceEnabled);
                            widget.onClose();
                            showSwitchAccountSheet(rootContext);
                          },
                        ),
                      _actionRow(
                        context,
                        icon: Icons.card_giftcard_rounded,
                        iconColor: AppColors.primary,
                        label: 'Referrals',
                        onTap: () {
                          _toggleOpen(attendanceEnabled);
                          widget.onNavigate('Referrals');
                          widget.onClose();
                        },
                      ),
                      _actionRow(
                        context,
                        icon: themeState.isDark
                            ? Icons.dark_mode_rounded
                            : Icons.light_mode_rounded,
                        iconColor: AppColors.primary,
                        label: themeState.isDark ? 'Dark Mode' : 'Light Mode',
                        onTap: () {
                          themeState.toggle();
                          _toggleOpen(attendanceEnabled);
                        },
                      ),
                    ],
                  ),
                ),
                Container(
                  margin: const EdgeInsets.fromLTRB(8, 4, 8, 8),
                  decoration: BoxDecoration(
                    border: Border(top: BorderSide(color: t.border)),
                  ),
                  child: _actionRow(
                    context,
                    icon: Icons.logout_rounded,
                    iconColor: AppColors.danger,
                    label: 'Sign Out',
                    labelColor: AppColors.danger,
                    onTap: () {
                      widget.onClose();
                      context.read<AuthState>().logout();
                    },
                    topPad: 6,
                  ),
                ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => _toggleOpen(attendanceEnabled),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  InitialsAvatar(
                    avatarValue: user?['avatar'] as String?,
                    radius: 18,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    fallback: Text(
                      (user?['name'] as String? ?? '?').isNotEmpty
                          ? (user!['name'] as String)[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?['name'] as String? ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          roleLabel(auth.role),
                          style: TextStyle(fontSize: 12, color: t.textSoft),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _open ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
                    size: 18,
                    color: t.textSoft,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _actionRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? iconColor,
    Color? labelColor,
    double topPad = 0,
  }) {
    final t = AppTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(top: topPad),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
          child: Row(
            children: [
              Icon(icon, size: 15, color: iconColor ?? t.textSoft),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  color: labelColor ?? t.text,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}


/// Pick a teammate to view the CRM as, for up to 2 hours.
Future<void> showSwitchAccountSheet(BuildContext context) async {
  final auth = context.read<AuthState>();
  final messenger = ScaffoldMessenger.of(context);
  List<Map<String, dynamic>> people;
  try {
    final r = await ApiClient.instance.dio.get('/auth/users');
    final me = '${auth.user?['_id']}';
    people = [
      for (final u in (r.data['users'] as List?) ?? const [])
        if (u is Map && u['isActive'] != false && u['role'] != 'super_admin' && '${u['_id']}' != me) u.cast<String, dynamic>(),
    ]..sort((a, b) => '${a['name']}'.compareTo('${b['name']}'));
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e, "Couldn't load your team")), backgroundColor: AppColors.danger));
    return;
  }
  if (!context.mounted) return;
  if (people.isEmpty) {
    messenger.showSnackBar(const SnackBar(content: Text('There is no one else on your team to switch to.')));
    return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (ctx) {
      var query = '';
      var busy = '';
      return StatefulBuilder(builder: (ctx, setSheet) {
        final t = AppTheme.of(ctx);
        final shown = people
            .where((p) => query.isEmpty || '${p['name']} ${p['email']}'.toLowerCase().contains(query.toLowerCase()))
            .toList();
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(ctx).bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Switch account', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.text)),
            const SizedBox(height: 4),
            Text('See the CRM as this person sees it, for up to 2 hours. An orange bar at the top takes you back.',
                style: TextStyle(fontSize: 12.5, color: t.textSoft)),
            if (people.length > 4) ...[
              const SizedBox(height: 10),
              TextField(
                decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Find a teammate', isDense: true),
                onChanged: (v) => setSheet(() => query = v),
              ),
            ],
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(ctx).height * 0.5),
              child: ListView(shrinkWrap: true, children: [
                for (final p in shown)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                      child: Text(
                        '${p['name'] ?? ''}'.trim().isEmpty ? '?' : '${p['name']}'.trim()[0].toUpperCase(),
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                      ),
                    ),
                    title: Text('${p['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(busy == '${p['_id']}' ? 'Switching…' : '${p['role'] ?? ''}'.replaceAll('_', ' ')),
                    onTap: busy.isNotEmpty
                        ? null
                        : () async {
                            setSheet(() => busy = '${p['_id']}');
                            try {
                              await auth.switchTo('${p['_id']}');
                              if (ctx.mounted) Navigator.pop(ctx);
                            } catch (e) {
                              setSheet(() => busy = '');
                              messenger.showSnackBar(SnackBar(
                                content: Text(ApiClient.errorMessage(e, "Couldn't switch account")),
                                backgroundColor: AppColors.danger,
                              ));
                            }
                          },
                  ),
              ]),
            ),
          ]),
        );
      });
    },
  );
}
