import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/push_service.dart';
import '../core/theme.dart';
import '../core/theme_state.dart';
import '../widgets/header_actions.dart';
import '../widgets/initials_avatar.dart';
import '../widgets/profile_menu.dart';
import '../widgets/storage_card.dart';
import 'artha/artha_sheet.dart';
import 'attendance/attendance_screen.dart';
import 'automation/automation_screen.dart';
import 'billing/plans_screen.dart';
import 'bookings/bookings_screen.dart';
import 'calls/calls_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'developers/developers_screen.dart';
import 'dump/dump_screen.dart';
import 'followups/followups_screen.dart';
import 'help/help_screen.dart';
import 'inbox/conversations_shell.dart';
import 'invoices/invoices_screen.dart';
import 'leads/leads_screen.dart';
import 'performance/performance_screen.dart';
import 'pipeline/pipeline_screen.dart';
import 'projects/projects_screen.dart';
import 'referrals/referrals_screen.dart';
import 'settings/settings_screen.dart';
import 'tasks/tasks_screen.dart';
import 'team/team_screen.dart';
import 'inbox/conversation_screen.dart';
import '../core/deep_link.dart';
import '../core/api_client.dart';
import 'projects/project_detail_screen.dart';

/// Opens Artha from the top bar. Replaces the floating avatar, which sat
/// over the call and WhatsApp buttons at the bottom of lists (Phase 4 plan,
/// section 5). [navLabel] tells Artha which screen it was opened over.
class _ArthaButton extends StatelessWidget {
  final String navLabel;
  const _ArthaButton({required this.navLabel});

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: 'Ask Artha',
        onPressed: () => showArthaSheet(context, navLabel: navLabel),
        icon: Container(
          padding: const EdgeInsets.all(1.5),
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(colors: [AppColors.primaryDeep, AppColors.primary]),
          ),
          child: const CircleAvatar(radius: 14, backgroundImage: AssetImage('assets/images/ai_avatar.png')),
        ),
      );
}

class _NavItem {
  final String label;
  final IconData icon;
  final Widget Function() builder;
  final bool adminOnly;
  // Kept in _items so onNavigate('Referrals') from the profile menu still
  // resolves, but hidden from the drawer list itself — web only reaches
  // Referrals through the profile dropdown, not the main sidebar nav.
  final bool showInDrawer;
  // Stricter than adminOnly (auth.isAdmin, i.e. role != 'agent'): some items
  // — Plan & Billing mirrors Sidebar.jsx's `roles: ["admin"]` — are for the
  // literal admin role only, excluding manager and super_admin too.
  final bool Function(AuthState auth)? extraGate;
  const _NavItem(
    this.label,
    this.icon,
    this.builder, {
    this.adminOnly = false,
    this.showInDrawer = true,
    this.extraGate,
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
    PushService.instance.pendingTarget.addListener(_onPendingTarget);
    // A cold start from a tapped notification can set it before we listen.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (PushService.instance.pendingTarget.value != null) _onPendingTarget();
      if (PushService.instance.pendingRoute.value != null) _onPendingRoute();
    });
    // Admins get the once-a-day file space warning, a few seconds after the
    // app settles.
    Future.delayed(const Duration(seconds: 4), () {
      if (!mounted) return;
      final auth = context.read<AuthState>();
      if (auth.role != 'admin') return;
      maybeShowStorageWarning(
        context,
        plan: auth.org?['plan'] as String?,
        onUpgrade: () => _navigateToLabel('Plan & Billing'),
      );
    });
  }

  @override
  void dispose() {
    PushService.instance.pendingRoute.removeListener(_onPendingRoute);
    PushService.instance.pendingTarget.removeListener(_onPendingTarget);
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
    // The web calls the Inbox "Conversations" and Plan & Billing "Plans"; push
    // links use the web paths, which matched no tab here, so taps did nothing.
    'conversations': 'Inbox',
    'plans': 'Plan & Billing',
  };

  void _onPendingRoute() {
    final path = PushService.instance.pendingRoute.value;
    if (path == null) return;
    PushService.instance.pendingRoute.value = null;
    // "/projects/<id>" (new leads in a project): open that project itself.
    final project = RegExp(r'^/projects/([a-f0-9]{24})').firstMatch(path);
    if (project != null) {
      _navigateToLabel('Projects');
      _openProject(project.group(1)!);
      return;
    }
    final normalized = path.toLowerCase().replaceAll(RegExp(r'[-_ ]'), '');

    String? targetLabel;
    for (final entry in _routeAliases.entries) {
      if (normalized.contains(entry.key)) {
        targetLabel = entry.value;
        break;
      }
    }

    targetLabel ??= _items
        .where(
          (i) => normalized.contains(
            i.label.toLowerCase().replaceAll(RegExp(r'[-_ ]'), ''),
          ),
        )
        .map((i) => i.label)
        .firstOrNull;
    // Through _navigateToLabel: _index counts only the tabs this user can
    // see, so an index into the full _items list landed agents on the wrong tab.
    if (targetLabel != null) _navigateToLabel(targetLabel);
  }

  Future<void> _openProject(String id) async {
    try {
      final res = await ApiClient.instance.dio.get('/projects/$id');
      final project = (res.data['data'] as Map?)?.cast<String, dynamic>();
      if (project == null || !mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: project)),
      );
    } catch (_) {
      // No access or gone: staying on the Projects list is the fallback.
    }
  }

  /// A tapped notification that names a record ("AI assistant could not
  /// reply", a new WhatsApp lead): open that WhatsApp chat, or the lead's
  /// detail when there is no chat.
  void _onPendingTarget() {
    final target = PushService.instance.pendingTarget.value;
    if (target == null || !mounted) return;
    PushService.instance.pendingTarget.value = null;
    final conversationId = target['conversationId'] ?? '';
    final leadId = target['leadId'] ?? '';
    if (conversationId.isNotEmpty) {
      _navigateToLabel('Inbox');
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConversationScreen(conversationId: conversationId, contactName: ''),
        ),
      );
    } else if (leadId.isNotEmpty) {
      DeepLink.openLeadId.value = leadId;
      _navigateToLabel('Leads');
    }
  }

  void _navigateToLabel(String label) {
    final auth = context.read<AuthState>();
    final visible = _items
        .where((item) =>
            (!item.adminOnly || auth.isAdmin) && (item.extraGate?.call(auth) ?? true))
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
    _NavItem('Inbox', Icons.chat_rounded, () => const ConversationsShell()),
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
      adminOnly: true,
    ),
    _NavItem('Tasks', Icons.task_alt_rounded, () => const TasksScreen()),
    _NavItem('Calls', Icons.call_rounded, () => const CallsScreen()),
    _NavItem(
      'Attendance',
      Icons.fingerprint_rounded,
      () => const AttendanceScreen(),
    ),
    _NavItem(
      'Bookings',
      Icons.receipt_long_rounded,
      () => const BookingsScreen(),
      adminOnly: true,
    ),
    _NavItem(
      'Dump',
      Icons.delete_sweep_rounded,
      () => const DumpScreen(),
      adminOnly: true,
    ),
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
      'Plan & Billing',
      Icons.bolt_rounded,
      () => const PlansScreen(),
      extraGate: (auth) => auth.role == 'admin',
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
    final visible = _items
        .where((i) => (!i.adminOnly || auth.isAdmin) && (i.extraGate?.call(auth) ?? true))
        .toList();
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
          // Inbox carries its own single header strip (drawer button, tabs,
          // theme toggle) — a second AppBar above it just doubled the chrome.
          appBar: current.label == 'Inbox' ? null : AppBar(
            title: Text(current.label),
            actions: [
              _ArthaButton(navLabel: current.label),
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
            width: math.min(272.0, MediaQuery.sizeOf(context).width * 0.68),
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
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          itemCount: drawerItems.length,
                          itemBuilder: (context, i) {
                            final item = drawerItems[i];
                            final realIndex = visible.indexOf(item);
                            final selected = realIndex == _index;
                            return ListTile(
                              dense: false,
                              visualDensity: const VisualDensity(vertical: -2),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                              horizontalTitleGap: 14,
                              leading: Icon(
                                item.icon,
                                size: 23,
                                color: selected ? AppColors.primary : null,
                              ),
                              title: Text(
                                item.label,
                                style: TextStyle(
                                  fontSize: 15.5,
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
                  if (auth.role != 'super_admin')
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: StorageCard(
                        isAdmin: auth.role == 'admin',
                        plan: auth.org?['plan'] as String?,
                        onUpgrade: () {
                          Navigator.pop(context);
                          _navigateToLabel('Plan & Billing');
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
          body: currentScreen,
        ),
      ),
    );
  }
}
