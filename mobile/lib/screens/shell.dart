import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/theme.dart';
import 'attendance/attendance_screen.dart';
import 'calls/calls_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'dump/dump_screen.dart';
import 'followups/followups_screen.dart';
import 'inbox/inbox_screen.dart';
import 'leads/leads_screen.dart';
import 'pipeline/pipeline_screen.dart';
import 'placeholder_screen.dart';
import 'projects/projects_screen.dart';
import 'settings/settings_screen.dart';
import 'tasks/tasks_screen.dart';
import 'team/team_screen.dart';

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
    _NavItem('Bookings', Icons.receipt_long_rounded, () => const PlaceholderScreen(title: 'Bookings')),
    _NavItem('Dump', Icons.delete_sweep_rounded, () => const DumpScreen()),
    _NavItem('Team', Icons.groups_rounded, () => const TeamScreen(), adminOnly: true),
    _NavItem('Performance', Icons.trending_up_rounded, () => const PlaceholderScreen(title: 'Performance'), adminOnly: true),
    _NavItem('Invoices', Icons.request_quote_rounded, () => const PlaceholderScreen(title: 'Invoices'), adminOnly: true),
    _NavItem('Automation', Icons.bolt_rounded, () => const PlaceholderScreen(title: 'Automation'), adminOnly: true),
    _NavItem('Referrals', Icons.card_giftcard_rounded, () => const PlaceholderScreen(title: 'Refer & Earn')),
    _NavItem('Help & Support', Icons.support_agent_rounded, () => const PlaceholderScreen(title: 'Help & Support')),
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
      body: current.builder(),
    );
  }
}
