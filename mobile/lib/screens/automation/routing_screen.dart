import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/upgrade_wall.dart';
import 'routing_section.dart';

/// Integrations → Lead routing rules (Growth, admins and managers) on its own
/// screen, as frontend/src/pages/integrations/RoutingRulesPage.jsx (27 Oct
/// 2026). The rules editor is the app's LeadRoutingSection.
class RoutingScreen extends StatefulWidget {
  const RoutingScreen({super.key});

  @override
  State<RoutingScreen> createState() => _RoutingScreenState();
}

const _description =
    'Leads from a chosen Facebook or Google campaign, WhatsApp ad or website page go straight to a team member or project. Everything else follows the round-robin rotation.';

class _RoutingScreenState extends State<RoutingScreen> {
  List<dynamic>? _rules;
  String _tab = 'Rules';

  bool get _allowed {
    final a = context.read<AuthState>();
    return a.role == 'super_admin' || ((a.role == 'admin' || a.role == 'manager') && canAccess(a.org, 'growth'));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _allowed) _loadCounts();
    });
  }

  /// Counts for the tiles; the editor loads its own copy.
  Future<void> _loadCounts() async {
    try {
      final r = await ApiClient.instance.dio.get('/routing-rules');
      final data = r.data;
      _rules = data is Map ? (data['rules'] as List? ?? []) : (data as List? ?? []);
    } catch (_) {
      _rules = [];
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final t = AppTheme.of(context);
    if (!_allowed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lead routing rules')),
        body: auth.role == 'admin'
            ? UpgradeWall(org: auth.org, feature: 'Lead routing rules', description: _description, needs: 'growth')
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Only an admin or manager can change routing rules.',
                      textAlign: TextAlign.center, style: TextStyle(color: t.textSoft)),
                ),
              ),
      );
    }
    final rules = _rules;
    final active = (rules ?? const []).where((r) => r is Map && r['isActive'] != false).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Lead routing rules')),
      body: RefreshIndicator(
        onRefresh: _loadCounts,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
          IntegrationHeader(
            logo: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.alt_route_rounded, color: AppColors.primary),
            ),
            title: 'Lead routing rules',
            subtitle: _description,
            status: rules == null ? null : (active > 0 ? StatusPill.on('$active active') : StatusPill.off('No rules yet')),
          ),
          const SizedBox(height: 14),
          MiniStatGrid([
            MiniStat('Rules', rules == null ? '-' : '${rules.length}'),
            MiniStat('Active', rules == null ? '-' : '$active'),
            MiniStat('Everything else', auth.org?['autoAssign'] == false ? 'Unassigned' : 'Round-robin'),
          ]),
          const SizedBox(height: 14),
          ChipTabs(tabs: const ['Rules', 'Setup help'], value: _tab, onChanged: (v) => setState(() => _tab = v)),
          const SizedBox(height: 12),
          if (_tab == 'Rules')
            // The editor saves on its own; the tiles catch up a moment later.
            Listener(
              onPointerUp: (_) => Future.delayed(const Duration(milliseconds: 1500), _loadCounts),
              child: const LeadRoutingSection(),
            ),
          if (_tab == 'Setup help') ...[
            const PanelCard(
              title: 'Add a rule',
              child: SetupSteps([
                ('Pick the source', 'Tap Add Rule and pick where the leads come from: Facebook Lead Ads, WhatsApp ads, Google Ads or your website.'),
                ('Pick what to match', 'Choose the form, campaign, ad, domain or page to match. The lists show the ones your leads already came from.'),
                ('Pick where they go', 'Pick the team member, the project, or both. Save.'),
                ('Done', 'From the next lead on, matching leads skip the rotation and go straight there.'),
              ]),
            ),
            const SizedBox(height: 12),
            PanelCard(
              title: 'Good to know',
              child: Text(
                'If the chosen team member has left or is switched off, the lead goes to the next person in rotation instead of being lost. Rules never move leads you already have.',
                style: TextStyle(fontSize: 12.5, color: t.textSoft),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
