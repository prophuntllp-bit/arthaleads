import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../core/theme_state.dart';
import 'campaigns_page.dart';
import 'credits_page.dart';
import 'inbox_screen.dart';
import 'agents_page.dart';
import 'templates_page.dart';
import 'wa_settings_page.dart';

/// Tab shell for everything under Inbox — mirrors
/// frontend/src/pages/conversations/ConversationsLayout.jsx's tab strip
/// (Inbox / Templates / Campaigns / Credits / AI Agents / Settings).
/// AI Agents and Settings are hidden for non-admins, same as web (those
/// endpoints are admin/super_admin-gated server-side; showing the tab to an
/// agent would just produce a 403 on save).
class ConversationsShell extends StatefulWidget {
  const ConversationsShell({super.key});

  @override
  State<ConversationsShell> createState() => _ConversationsShellState();
}

class _ConversationsShellState extends State<ConversationsShell>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<_Tab> _tabs(bool isAdmin) => [
    const _Tab('Inbox', Icons.chat_rounded, InboxScreen()),
    const _Tab('Templates', Icons.description_rounded, TemplatesPage()),
    const _Tab('Campaigns', Icons.campaign_rounded, CampaignsPage()),
    const _Tab('Credits', Icons.account_balance_wallet_rounded, CreditsPage()),
    if (isAdmin)
      const _Tab('AI Agents', Icons.auto_awesome_rounded, AgentsPage()),
    if (isAdmin)
      const _Tab('Settings', Icons.settings_rounded, WaSettingsPage()),
  ];

  @override
  void initState() {
    super.initState();
    final isAdmin = context.read<AuthState>().isWaAdmin;
    _tabController = TabController(length: _tabs(isAdmin).length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthState>().isWaAdmin;
    final tabs = _tabs(isAdmin);
    // Role can only change on a fresh login (new AuthState), so this covers
    // the resize instead of rebuilding the controller mid-session.
    if (_tabController.length != tabs.length) {
      _tabController.dispose();
      _tabController = TabController(length: tabs.length, vsync: this);
    }
    // Embedded inside Shell's own Scaffold/AppBar (shell.dart wraps every
    // top-level screen that way) — no nested Scaffold/AppBar here, just the
    // tab strip + content, matching how InboxScreen's own body used to sit
    // directly under that AppBar.
    // Shell hides its own AppBar on this screen, so this single strip is the
    // only header: drawer button, the tabs, then the theme toggle.
    return Column(
      children: [
        Material(
          color: Colors.transparent,
          child: SafeArea(
            bottom: false,
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Menu',
                  icon: const Icon(Icons.menu_rounded),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
                Expanded(
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    dividerColor: Colors.transparent,
                    tabs: tabs.map((t) => Tab(text: t.label)).toList(),
                  ),
                ),
                Consumer<ThemeState>(
                  builder: (context, theme, _) => IconButton(
                    tooltip: theme.isDark ? 'Switch to light mode' : 'Switch to dark mode',
                    onPressed: theme.toggle,
                    icon: Icon(
                      theme.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: tabs.map((t) => t.child).toList(),
          ),
        ),
      ],
    );
  }
}

class _Tab {
  final String label;
  final IconData icon;
  final Widget child;
  const _Tab(this.label, this.icon, this.child);
}
