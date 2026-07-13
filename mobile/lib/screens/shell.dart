import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/push_service.dart';
import '../core/theme.dart';
import 'help/artha_chat_screen.dart';
import 'attendance/attendance_screen.dart';
import 'automation/automation_screen.dart';
import 'bookings/bookings_screen.dart';
import 'calls/calls_screen.dart';
import 'dashboard/dashboard_screen.dart';
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
/// every tab, mirrors the web app's floating HelpBot bubble.
class _ArthaFab extends StatelessWidget {
  const _ArthaFab();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 52,
      height: 52,
      child: FloatingActionButton(
        heroTag: 'artha-fab',
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ArthaChatScreen()),
        ),
        child: ClipOval(
          child: Image.asset('assets/images/ai_avatar.png', fit: BoxFit.cover),
        ),
      ),
    );
  }
}

/// One entry in the navigation drawer.
class _NavItem {
  final String label;
  final IconData icon;
  final Widget Function() builder;
  final bool adminOnly;
  const _NavItem(this.label, this.icon, this.builder, {this.adminOnly = false});
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
  void _onPendingRoute() {
    final path = PushService.instance.pendingRoute.value;
    if (path == null) return;
    PushService.instance.pendingRoute.value = null;
    final normalized = path.toLowerCase().replaceAll(RegExp(r'[-_ ]'), '');
    final match = _items.indexWhere(
      (i) => normalized.contains(i.label.toLowerCase().replaceAll(RegExp(r'[-_ ]'), '')),
    );
    if (match != -1) setState(() => _index = match);
  }

  static final List<_NavItem> _items = [
    _NavItem('Dashboard', Icons.dashboard_rounded, () => const DashboardScreen()),
    _NavItem('Leads', Icons.people_alt_rounded, () => const LeadsScreen()),
    _NavItem('Follow-ups', Icons.event_repeat_rounded, () => const FollowUpsScreen()),
    _NavItem('Pipeline', Icons.view_kanban_rounded, () => const PipelineScreen()),
    _NavItem('Projects', Icons.folder_rounded, () => const ProjectsScreen()),
    _NavItem('Tasks', Icons.task_alt_rounded, () => const TasksScreen()),
    _NavItem('Calls', Icons.call_rounded, () => const CallsScreen()),
    _NavItem('Inbox', Icons.chat_rounded, () => const InboxScreen()),
    _NavItem('Attendance', Icons.fingerprint_rounded, () => const AttendanceScreen()),
    _NavItem('Bookings', Icons.receipt_long_rounded, () => const BookingsScreen()),
    _NavItem('Dump', Icons.delete_sweep_rounded, () => const DumpScreen()),
    _NavItem('Team', Icons.groups_rounded, () => const TeamScreen(), adminOnly: true),
    _NavItem('Performance', Icons.trending_up_rounded, () => const PerformanceScreen(), adminOnly: true),
    _NavItem('Invoices', Icons.request_quote_rounded, () => const InvoicesScreen(), adminOnly: true),
    _NavItem('Automation', Icons.bolt_rounded, () => const AutomationScreen(), adminOnly: true),
    _NavItem('Referrals', Icons.card_giftcard_rounded, () => const ReferralsScreen()),
    _NavItem('Help & Support', Icons.support_agent_rounded, () => const HelpScreen()),
    _NavItem('Settings', Icons.settings_rounded, () => const SettingsScreen()),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final visible = _items.where((i) => !i.adminOnly || auth.isAdmin).toList();
    if (_index >= visible.length) _index = 0;
    final current = visible[_index];

    return Scaffold(
      appBar: AppBar(title: Text(current.label)),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      child: Text(
                        (auth.user?['name'] as String? ?? '?').isNotEmpty
                            ? (auth.user!['name'] as String)[0].toUpperCase()
                            : '?',
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.user?['name'] as String? ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w700),
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
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: visible.length,
                  itemBuilder: (context, i) {
                    final item = visible[i];
                    final selected = i == _index;
                    return ListTile(
                      leading: Icon(item.icon, color: selected ? AppColors.primary : null),
                      title: Text(
                        item.label,
                        style: TextStyle(
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                          color: selected ? AppColors.primary : null,
                        ),
                      ),
                      selected: selected,
                      selectedTileColor: AppColors.primary.withValues(alpha: 0.08),
                      onTap: () {
                        setState(() => _index = i);
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: AppColors.danger),
                title: const Text('Log out', style: TextStyle(color: AppColors.danger)),
                onTap: () async {
                  Navigator.pop(context);
                  await context.read<AuthState>().logout();
                },
              ),
            ],
          ),
        ),
      ),
      body: Stack(
        children: [
          current.builder(),
          // Persistent AI avatar — bottom-LEFT (not bottom-right) so it never
          // overlaps each screen's own "+" FAB, which all sit bottom-right.
          Positioned(
            left: 16,
            bottom: 16,
            child: _ArthaFab(),
          ),
        ],
      ),
    );
  }
}
