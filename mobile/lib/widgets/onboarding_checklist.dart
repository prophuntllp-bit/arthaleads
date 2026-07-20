import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';

class _Step {
  final String id;
  final String title;
  final String desc;
  final String navLabel;
  final IconData icon;
  final bool manualOnly;
  const _Step(this.id, this.title, this.desc, this.navLabel, this.icon, {this.manualOnly = false});
}

const _steps = [
  _Step('first_lead', 'Add your first lead',
      'Import from Facebook, upload a CSV, or add manually from Leads.', 'Leads', Icons.dashboard_rounded),
  _Step('connect_facebook', 'Connect Facebook Lead Ads',
      'Auto-capture every Meta ad form submission straight into the CRM.', 'Automation', Icons.bolt_rounded),
  _Step('add_teammate', 'Add a team member',
      'Invite agents or managers so leads can be assigned and tracked.', 'Team', Icons.groups_rounded),
  _Step('view_pipeline', 'Explore the Kanban pipeline',
      'See every lead move from New to Converted in one visual board.', 'Pipeline', Icons.view_kanban_rounded,
      manualOnly: true),
  _Step('create_followup', 'Schedule your first follow-up',
      'Set a call or visit reminder so no prospect falls through the cracks.', 'Follow-ups',
      Icons.notifications_rounded, manualOnly: true),
];

/// Ports `frontend/src/components/OnboardingChecklist.jsx` — a dismissible
/// setup checklist on the Dashboard. "Mark done" / permanent-dismiss persist
/// via [FlutterSecureStorage] (same house pattern as `theme_state.dart`);
/// "Skip for now" only hides it for this in-memory session, same as the
/// web's sessionStorage-backed skip.
class OnboardingChecklist extends StatefulWidget {
  final int totalLeads;
  final void Function(String label) onNavigate;

  const OnboardingChecklist({super.key, required this.totalLeads, required this.onNavigate});

  @override
  State<OnboardingChecklist> createState() => _OnboardingChecklistState();
}

class _OnboardingChecklistState extends State<OnboardingChecklist> {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  final _api = ApiClient.instance;

  bool _loaded = false;
  bool _dismissed = false;
  bool _skippedThisSession = false;
  Set<String> _manualDone = {};
  bool _expanded = true;
  bool _facebookConnected = false;
  int _agentsCount = 1;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  String get _orgId => context.read<AuthState>().org?['_id'] as String? ?? 'guest';

  Future<void> _restore() async {
    final orgId = _orgId;
    final doneRaw = await _storage.read(key: 'ol_done_$orgId');
    final dismissedRaw = await _storage.read(key: 'ol_dismissed_$orgId');
    if (!mounted) return;
    setState(() {
      _manualDone = (doneRaw?.split(',') ?? const []).where((s) => s.isNotEmpty).toSet();
      _dismissed = dismissedRaw == '1';
      _loaded = true;
    });
    if (!_dismissed) _fetchStatus();
  }

  Future<void> _fetchStatus() async {
    try {
      final res = await _api.dio.get('/automations');
      final list = ((res.data['automations'] as List?) ?? []).cast<Map>();
      final active = list.where((a) => a['status'] == 'connected' && a['isActive'] != false);
      if (mounted) {
        setState(() => _facebookConnected = active.any((a) => a['platform'] == 'Facebook'));
      }
    } catch (_) {}
    try {
      final res = await _api.dio.get('/auth/agents');
      final agents = (res.data['agents'] as List?) ?? [];
      if (mounted) setState(() => _agentsCount = agents.length);
    } catch (_) {}
  }

  bool _isComplete(_Step step) {
    if (_manualDone.contains(step.id)) return true;
    if (step.id == 'first_lead') return widget.totalLeads > 0;
    if (step.id == 'connect_facebook') return _facebookConnected;
    if (step.id == 'add_teammate') return _agentsCount > 1;
    return false;
  }

  Future<void> _markDone(String id) async {
    setState(() => _manualDone = {..._manualDone, id});
    await _storage.write(key: 'ol_done_$_orgId', value: _manualDone.join(','));
  }

  Future<void> _dismiss() async {
    setState(() => _dismissed = true);
    await _storage.write(key: 'ol_dismissed_$_orgId', value: '1');
  }

  void _skip() => setState(() => _skippedThisSession = true);

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _dismissed || _skippedThisSession) return const SizedBox.shrink();
    final t = AppTheme.of(context);
    final completedCount = _steps.where(_isComplete).length;
    final allDone = completedCount == _steps.length;
    final pct = ((completedCount / _steps.length) * 100).round();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: t.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.rocket_launch_rounded, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          allDone ? "Setup complete! You're all set!" : 'Get started with Arthaleads',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          allDone ? 'All onboarding steps are complete.' : '$completedCount of ${_steps.length} steps complete',
                          style: TextStyle(fontSize: 11.5, color: t.textSoft),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: allDone
                          ? AppColors.success.withValues(alpha: 0.12)
                          : AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$pct%',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: allDone ? AppColors.success : AppColors.primary,
                      ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: Icon(Icons.close, size: 18, color: t.textSoft),
                    onPressed: _dismiss,
                    tooltip: "Don't show again",
                  ),
                ],
              ),
            ),
          ),
          SizedBox(
            height: 3,
            child: Stack(
              children: [
                Container(color: t.border),
                AnimatedFractionallySizedBox(
                  duration: const Duration(milliseconds: 400),
                  alignment: Alignment.centerLeft,
                  widthFactor: pct / 100,
                  child: Container(color: allDone ? AppColors.success : AppColors.primary),
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            for (final step in _steps) _stepTile(step, t),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 12, 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
              child: Row(
                children: [
                  Expanded(
                    child: Wrap(
                      children: [
                        Text('Need detailed guidance? ', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                        InkWell(
                          onTap: () => widget.onNavigate('Help & Support'),
                          child: const Text(
                            'Open the Getting Started guide',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: allDone ? _dismiss : _skip,
                    child: Text(allDone ? 'Dismiss' : 'Skip for now', style: const TextStyle(fontSize: 11.5)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _stepTile(_Step step, AppTheme t) {
    final done = _isComplete(step);
    return Opacity(
      opacity: done ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: t.border))),
        child: Row(
          children: [
            Icon(
              done ? Icons.check_circle : Icons.circle_outlined,
              size: 19,
              color: done ? AppColors.success : t.textSoft.withValues(alpha: 0.4),
            ),
            const SizedBox(width: 8),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: (done ? AppColors.success : AppColors.primary).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(step.icon, size: 14, color: done ? AppColors.success : AppColors.primary),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      decoration: done ? TextDecoration.lineThrough : null,
                      color: done ? t.textSoft : null,
                    ),
                  ),
                  Text(
                    step.desc,
                    style: TextStyle(fontSize: 11, color: t.textSoft),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (!done) ...[
              if (step.manualOnly)
                TextButton(
                  onPressed: () => _markDone(step.id),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Mark done', style: TextStyle(fontSize: 10.5)),
                ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: () => widget.onNavigate(step.navLabel),
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Go', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
