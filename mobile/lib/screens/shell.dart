import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/auth_state.dart';
import '../core/push_service.dart';
import '../core/theme.dart';
import '../core/theme_state.dart';
import '../widgets/header_actions.dart';
import '../widgets/initials_avatar.dart';
import '../widgets/profile_menu.dart';
import 'help/artha_chat_screen.dart';
import 'attendance/attendance_screen.dart';
import 'automation/automation_screen.dart';
import 'bookings/bookings_screen.dart';
import 'calls/calls_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'developers/developers_screen.dart';
import 'dump/dump_screen.dart';
import 'followups/followups_screen.dart';
import 'help/help_screen.dart';
import 'inbox/inbox_screen.dart';
import 'invoices/invoices_screen.dart';
import 'leads/leads_screen.dart';
import 'performance/performance_screen.dart';
import 'pipeline/pipeline_screen.dart';
import 'projects/projects_screen.dart';
import 'referrals/referrals_screen.dart';
import 'settings/settings_screen.dart';
import 'tasks/tasks_screen.dart';
import 'team/team_screen.dart';

/// Floating button opening the Artha AI help assistant — persistent across
/// every tab, mirrors the web app's floating HelpBot bubble: same 56dp size
/// and the same expanding-ring pulse (web's `animate-ping`) so it doesn't
/// get lost among the rest of the screen.
class _ArthaFab extends StatefulWidget {
  /// Drawer label of the screen underneath, handed to the assistant so it can
  /// look up live data for it. See core/copilot_pages.dart.
  final String? navLabel;

  const _ArthaFab({this.navLabel});

  @override
  State<_ArthaFab> createState() => _ArthaFabState();
}

class _ArthaFabState extends State<_ArthaFab>
    with SingleTickerProviderStateMixin {
  static const _buttonSize = 56.0;
  static const _boxSize = 84.0;

  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    if (!MediaQuery.of(context).disableAnimations) {
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _boxSize,
      height: _boxSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _pulse,
            builder: (context, child) {
              final t = Curves.easeOut.transform(_pulse.value);
              return Opacity(
                opacity: (1 - t) * 0.45,
                child: Transform.scale(
                  scale: 1 + t * 0.7,
                  child: Container(
                    width: _buttonSize,
                    height: _buttonSize,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFFF6B00),
                    ),
                  ),
                ),
              );
            },
          ),
          SizedBox(
            width: _buttonSize,
            height: _buttonSize,
            child: FloatingActionButton(
              heroTag: 'artha-fab',
              elevation: 8,
              backgroundColor: AppColors.primaryDeep,
              shape: CircleBorder(
                side: BorderSide(color: Colors.white.withValues(alpha: 0.16)),
              ),
              // See GradientFab (widgets/buttons.dart) for why this matters —
              // the theme's default FAB shape is a rounded square, and
              // FloatingActionButton doesn't clip to `shape` unless told to.
              clipBehavior: Clip.antiAlias,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ArthaChatScreen(navLabel: widget.navLabel),
                ),
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/ai_avatar.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Wraps [_ArthaFab] so the user can drag it anywhere on screen — the
/// position is remembered per-device (SharedPreferences — a plain UI
/// coordinate isn't sensitive enough to need the encrypted secure-storage
/// used for the auth token, and avoids that store's Keystore-dependent
/// write path, which proved unreliable for rapid-fire writes on-device)
/// so it stays where they left it next time the app opens.
class _DraggableArthaFab extends StatefulWidget {
  final String? navLabel;

  const _DraggableArthaFab({this.navLabel});

  @override
  State<_DraggableArthaFab> createState() => _DraggableArthaFabState();
}

class _DraggableArthaFabState extends State<_DraggableArthaFab> {
  // _v3: back to bottom-right, which is where the assistant is expected to
  // live. The collision that moved it left in _v2 is now solved from the
  // other side — every screen's own Add/+ FAB sits bottom-LEFT
  // (floatingActionButtonLocation.startFloat), so the two no longer share a
  // corner. Bumping the key repositions existing installs once; dragging and
  // persistence behave exactly as before afterwards.
  static const _xKey = 'artha_fab_x_v3';
  static const _yKey = 'artha_fab_y_v3';
  static const _boxSize = 84.0;

  Offset? _pos;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final x = prefs.getDouble(_xKey);
    final y = prefs.getDouble(_yKey);
    if (!mounted || x == null || y == null) return;
    setState(() => _pos = Offset(x, y));
  }

  Future<void> _persist(Offset pos) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_xKey, pos.dx);
    await prefs.setDouble(_yKey, pos.dy);
  }

  // Bottom-right corner, level with the screen's own Add/+ FAB — which is
  // pinned bottom-LEFT, so the two never share a corner.
  //
  // The old 74px bottom margin was clearing a bottom nav bar this shell does
  // not have (navigation is the drawer), which left the bubble hovering over
  // list rows and covering their call/WhatsApp icons instead of resting in
  // the corner. 24px keeps it clear of the gesture bar.
  Offset _defaultPos(Size area) =>
      Offset(area.width - _boxSize - 6, area.height - _boxSize - 24);

  Offset _clamp(Offset pos, Size area) => Offset(
    pos.dx.clamp(0, (area.width - _boxSize).clamp(0, double.infinity)),
    pos.dy.clamp(0, (area.height - _boxSize).clamp(0, double.infinity)),
  );

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final area = Size(constraints.maxWidth, constraints.maxHeight);
        final pos = _clamp(_pos ?? _defaultPos(area), area);
        return Stack(
          children: [
            Positioned(
              left: pos.dx,
              top: pos.dy,
              child: GestureDetector(
                onPanUpdate: (details) {
                  final next = _clamp((_pos ?? pos) + details.delta, area);
                  setState(() => _pos = next);
                  // Persisted on every update (not just onPanEnd) — some
                  // synthetic/edge-case gesture streams never deliver a
                  // clean pan-end, which silently dropped the save.
                  _persist(next);
                },
                child: _ArthaFab(navLabel: widget.navLabel),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// One entry in the navigation drawer.
class _NavItem {
  final String label;
  final IconData icon;
  final Widget Function() builder;
  final bool adminOnly;
  // Kept in _items so onNavigate('Referrals') from the profile menu still
  // resolves, but hidden from the drawer list itself — web only reaches
  // Referrals through the profile dropdown, not the main sidebar nav.
  final bool showInDrawer;
  const _NavItem(
    this.label,
    this.icon,
    this.builder, {
    this.adminOnly = false,
    this.showInDrawer = true,
  });
}

/// App shell: drawer navigation + role gating.
/// Mirrors the web sidebar (frontend/src/components — Layout/Sidebar).
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _index = 0;
  final Map<String, Widget> _screenCache = {};
  final List<String> _navigationHistory = [];
  DateTime? _lastBackPressed;

  @override
  void initState() {
    super.initState();
    PushService.instance.init();
    PushService.instance.pendingRoute.addListener(_onPendingRoute);
  }

  @override
  void dispose() {
    PushService.instance.pendingRoute.removeListener(_onPendingRoute);
    super.dispose();
  }

  // Jumps to the tab matching a tapped notification's data.url (e.g.
  // "/leads/507f..." → the "Leads" tab). Falls back to doing nothing
  // (staying on the current tab) if no label matches.
  // Paths whose wording no longer matches the tab that serves them. Matching is
  // label-based, so a renamed tab silently stops resolving its own old links —
  // and those links live on: already-delivered notifications keep their original
  // payload forever, and the backend deliberately still sends "/automation"
  // because builds older than this one only know that spelling.
  static const _routeAliases = <String, String>{
    'automation': 'Integrations',
  };

  void _onPendingRoute() {
    final path = PushService.instance.pendingRoute.value;
    if (path == null) return;
    PushService.instance.pendingRoute.value = null;
    final normalized = path.toLowerCase().replaceAll(RegExp(r'[-_ ]'), '');

    String? targetLabel;
    for (final entry in _routeAliases.entries) {
      if (normalized.contains(entry.key)) {
        targetLabel = entry.value;
        break;
      }
    }

    final match = targetLabel != null
        ? _items.indexWhere((i) => i.label == targetLabel)
        : _items.indexWhere(
            (i) => normalized.contains(
              i.label.toLowerCase().replaceAll(RegExp(r'[-_ ]'), ''),
            ),
          );
    if (match != -1) setState(() => _index = match);
  }

  void _navigateToLabel(String label) {
    final auth = context.read<AuthState>();
    final visible = _items
        .where((item) => !item.adminOnly || auth.isAdmin)
        .toList();
    final index = visible.indexWhere((item) => item.label == label);
    if (index != -1 && index != _index) {
      _navigationHistory.add(visible[_index].label);
      setState(() => _index = index);
    }
  }

  void _handleBack(List<_NavItem> visible) {
    while (_navigationHistory.isNotEmpty) {
      final previous = _navigationHistory.removeLast();
      final index = visible.indexWhere((item) => item.label == previous);
      if (index != -1 && index != _index) {
        setState(() => _index = index);
        return;
      }
    }
    if (_index != 0) {
      setState(() => _index = 0);
      return;
    }
    final now = DateTime.now();
    if (_lastBackPressed != null &&
        now.difference(_lastBackPressed!) < const Duration(seconds: 2)) {
      SystemNavigator.pop();
      return;
    }
    _lastBackPressed = now;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Press back again to exit'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  static final List<_NavItem> _items = [
    _NavItem(
      'Dashboard',
      Icons.dashboard_rounded,
      () => const DashboardScreen(),
    ),
    _NavItem('Leads', Icons.people_alt_rounded, () => const LeadsScreen()),
    _NavItem(
      'Follow-ups',
      Icons.event_repeat_rounded,
      () => const FollowUpsScreen(),
    ),
    _NavItem(
      'Pipeline',
      Icons.view_kanban_rounded,
      () => const PipelineScreen(),
    ),
    _NavItem('Projects', Icons.folder_rounded, () => const ProjectsScreen()),
    _NavItem(
      'Developers',
      Icons.apartment_rounded,
      () => const DevelopersScreen(),
    ),
    _NavItem('Tasks', Icons.task_alt_rounded, () => const TasksScreen()),
    _NavItem('Calls', Icons.call_rounded, () => const CallsScreen()),
    _NavItem('Inbox', Icons.chat_rounded, () => const InboxScreen()),
    _NavItem(
      'Attendance',
      Icons.fingerprint_rounded,
      () => const AttendanceScreen(),
    ),
    _NavItem(
      'Bookings',
      Icons.receipt_long_rounded,
      () => const BookingsScreen(),
    ),
    _NavItem('Dump', Icons.delete_sweep_rounded, () => const DumpScreen()),
    _NavItem(
      'Team',
      Icons.groups_rounded,
      () => const TeamScreen(),
      adminOnly: true,
    ),
    _NavItem(
      'Performance',
      Icons.trending_up_rounded,
      () => const PerformanceScreen(),
      adminOnly: true,
    ),
    _NavItem(
      'Invoices',
      Icons.request_quote_rounded,
      () => const InvoicesScreen(),
      adminOnly: true,
    ),
    _NavItem(
      'Integrations',
      Icons.bolt_rounded,
      () => const AutomationScreen(),
      adminOnly: true,
    ),
    _NavItem(
      'Referrals',
      Icons.card_giftcard_rounded,
      () => const ReferralsScreen(),
      showInDrawer: false,
    ),
    _NavItem(
      'Help & Support',
      Icons.support_agent_rounded,
      () => const HelpScreen(),
    ),
    _NavItem('Settings', Icons.settings_rounded, () => const SettingsScreen()),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final visible = _items.where((i) => !i.adminOnly || auth.isAdmin).toList();
    if (_index >= visible.length) _index = 0;
    final current = visible[_index];
    final currentScreen = current.label == 'Dashboard'
        ? DashboardScreen(onNavigate: _navigateToLabel)
        : current.label == 'Bookings'
        ? BookingsScreen(onNavigate: _navigateToLabel)
        : _screenCache.putIfAbsent(current.label, current.builder);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _handleBack(visible);
      },
      child: AppBackdrop(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            title: Text(current.label),
            actions: [
              const HeaderSearchButton(),
              const HeaderAlertsButton(),
              Consumer<ThemeState>(
                builder: (context, theme, _) => IconButton(
                  tooltip: theme.isDark
                      ? 'Switch to light mode'
                      : 'Switch to dark mode',
                  onPressed: theme.toggle,
                  icon: Icon(
                    theme.isDark
                        ? Icons.dark_mode_rounded
                        : Icons.light_mode_rounded,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 6),
            ],
          ),
          drawer: Drawer(
            // Material's default is a flat 304dp, which on a 360dp-wide phone
            // covers ~84% of the screen and reads as a full-page takeover
            // rather than a panel. Scale it instead, so a useful strip of the
            // page stays visible to tap back to, and cap it so it does not
            // sprawl on a tablet.
            width: math.min(300.0, MediaQuery.sizeOf(context).width * 0.76),
            child: SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        InitialsAvatar(
                          avatarValue: auth.user?['avatar'] as String?,
                          backgroundColor: AppColors.primary.withValues(
                            alpha: 0.15,
                          ),
                          fallback: Text(
                            (auth.user?['name'] as String? ?? '?').isNotEmpty
                                ? (auth.user!['name'] as String)[0]
                                      .toUpperCase()
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
                                auth.user?['name'] as String? ?? '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                auth.org?['name'] as String? ?? auth.role,
                                style: Theme.of(context).textTheme.bodySmall,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: Builder(
                      builder: (context) {
                        final drawerItems = visible
                            .where((item) => item.showInDrawer)
                            .toList();
                        return ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: drawerItems.length,
                          itemBuilder: (context, i) {
                            final item = drawerItems[i];
                            final realIndex = visible.indexOf(item);
                            final selected = realIndex == _index;
                            return ListTile(
                              leading: Icon(
                                item.icon,
                                color: selected ? AppColors.primary : null,
                              ),
                              title: Text(
                                item.label,
                                style: TextStyle(
                                  fontWeight: selected
                                      ? FontWeight.w700
                                      : FontWeight.w400,
                                  color: selected ? AppColors.primary : null,
                                ),
                              ),
                              selected: selected,
                              selectedTileColor: AppColors.primary.withValues(
                                alpha: 0.08,
                              ),
                              onTap: () {
                                if (realIndex != _index) {
                                  _navigationHistory.add(
                                    visible[_index].label,
                                  );
                                }
                                setState(() => _index = realIndex);
                                Navigator.pop(context);
                              },
                            );
                          },
                        );
                      },
                    ),
                  ),
                  const Divider(height: 1),
                  ProfileMenu(
                    onNavigate: _navigateToLabel,
                    onClose: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
          ),
          body: Stack(
            children: [
              currentScreen,
              // Persistent, user-draggable AI avatar — defaults to bottom-right
              // (matching the web app's floating HelpBot bubble) but can be
              // dragged anywhere and remembers where it was left.
              // `current.label` is how the assistant learns which screen it
              // was opened over -- the web copilot reads location.pathname on
              // every request, and this is the equivalent handle here.
              Positioned.fill(child: _DraggableArthaFab(navLabel: current.label)),
            ],
          ),
        ),
      ),
    );
  }
}
