import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../core/theme_state.dart';
import 'campaigns_page.dart';
import 'credits_page.dart';
import 'inbox_screen.dart';
import 'agents_page.dart';
import 'templates_page.dart';
import 'wa_settings_page.dart';
import '../../core/plan.dart';
import '../../widgets/plan_only.dart';

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
  final _api = ApiClient.instance;
  late TabController _tabController;

  // Glance-at signals on the tab strip — mirrors ConversationsLayout.jsx's
  // unread pill (polled every 20s, same cadence as web) and the credits
  // empty-balance dot (fetched once on mount, same as web's one-shot
  // refreshCredits() — child tabs refresh their own balance after topping up).
  int _unread = 0;
  bool _creditsEmpty = false;
  Timer? _unreadTimer;

  bool _planOk(String min) {
    final a = context.read<AuthState>();
    return a.role == 'super_admin' || canAccess(a.org, min);
  }

  List<_Tab> _tabs(bool isAdmin) => [
    _Tab('Inbox', Icons.chat_rounded, const InboxScreen(), badge: _unread > 0 ? (_unread > 99 ? '99+' : '$_unread') : null),
    const _Tab('Templates', Icons.description_rounded, TemplatesPage(), minPlan: 'growth', feature: 'WhatsApp templates'),
    const _Tab('Campaigns', Icons.campaign_rounded, CampaignsPage(), minPlan: 'growth', feature: 'WhatsApp campaigns'),
    _Tab('Credits', Icons.account_balance_wallet_rounded, const CreditsPage(), dot: _creditsEmpty),
    if (isAdmin)
      const _Tab('AI Agents', Icons.auto_awesome_rounded, AgentsPage(), minPlan: 'growth', feature: 'The WhatsApp AI agent'),
    if (isAdmin)
      const _Tab('Settings', Icons.settings_rounded, WaSettingsPage()),
  ];

  @override
  void initState() {
    super.initState();
    final isAdmin = context.read<AuthState>().isWaAdmin;
    _tabController = TabController(length: _tabs(isAdmin).length, vsync: this);
    _pollUnread();
    _unreadTimer = Timer.periodic(const Duration(seconds: 20), (_) => _pollUnread());
    _loadCreditsBalance();
  }

  Future<void> _pollUnread() async {
    try {
      final res = await _api.dio.get('/whatsapp/unread');
      if (mounted) setState(() => _unread = (res.data['unread'] as num?)?.toInt() ?? 0);
    } catch (_) {}
  }

  Future<void> _loadCreditsBalance() async {
    try {
      final res = await _api.dio.get('/credits/balance');
      final available = (res.data['availablePaise'] as num?) ?? 0;
      if (mounted) setState(() => _creditsEmpty = available <= 0);
    } catch (_) {}
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
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
            child: SizedBox(
              height: 66,
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
                    labelPadding: const EdgeInsets.symmetric(horizontal: 9),
                    tabs: tabs.map((t) {
                      return Tab(
                        height: 62,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Icon(t.icon, size: 20),
                                if (t.dot)
                                  Positioned(
                                    top: -2,
                                    right: -3,
                                    child: Container(
                                      width: 7,
                                      height: 7,
                                      decoration: const BoxDecoration(color: Color(0xFFB91C1C), shape: BoxShape.circle),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(t.label, style: const TextStyle(fontSize: 13)),
                                if (t.minPlan != null && !_planOk(t.minPlan!)) ...[
                                  const SizedBox(width: 4),
                                  const Icon(Icons.lock_rounded, size: 12),
                                ],
                                if (t.badge != null) ...[
                                  const SizedBox(width: 5),
                                  Container(
                                    constraints: const BoxConstraints(minWidth: 20),
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(alpha: 0.16),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      t.badge!,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),
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
        ),
        Expanded(
          // The header above already sat inside the status-bar inset; without
          // this every ListView below re-applies it as a blank band at its top.
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: TabBarView(
              controller: _tabController,
              children: tabs
                  .map((t) => t.minPlan == null
                      ? t.child
                      : PlanOnly(min: t.minPlan!, feature: t.feature ?? t.label, child: t.child))
                  .toList(),
            ),
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
  final String? badge;
  final bool dot;
  // Growth-and-up features: a lock on the tab and an upgrade wall inside.
  final String? minPlan;
  final String? feature;
  const _Tab(this.label, this.icon, this.child, {this.badge, this.dot = false, this.minPlan, this.feature});
}
