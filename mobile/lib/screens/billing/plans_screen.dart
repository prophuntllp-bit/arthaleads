import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

const String _whatsappNumber = '918080197945';
const String _upgradeMessage = "Hi, I'd like to upgrade my Arthaleads plan.";

Future<void> _openWhatsApp() => launchUrl(
      Uri.parse('https://wa.me/$_whatsappNumber?text=${Uri.encodeComponent(_upgradeMessage)}'),
      mode: LaunchMode.externalApplication,
    );

Future<void> _openEmail() => launchUrl(
      Uri(
        scheme: 'mailto',
        path: 'sales@arthaleads.com',
        query: 'subject=${Uri.encodeComponent('Plan Upgrade Request')}'
            '&body=${Uri.encodeComponent("Hi, I'd like to upgrade my Arthaleads plan.")}',
      ),
    );

// Indian digit grouping: last 3 digits, then pairs of 2 (e.g. 12,34,567).
String _formatINR(num n) {
  final str = n.round().toString();
  if (str.length <= 3) return '₹$str';
  final last3 = str.substring(str.length - 3);
  var rest = str.substring(0, str.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '₹${parts.join(',')},$last3';
}

class _PlanGroup {
  final String label;
  final List<String> items;
  const _PlanGroup(this.label, this.items);
}

class _PlanDef {
  final String id;
  final String name;
  final Color color;
  final String userLimit;
  final String tagline;
  final List<_PlanGroup> groups;
  final bool enterprise;
  const _PlanDef({
    required this.id,
    required this.name,
    required this.color,
    required this.userLimit,
    required this.tagline,
    required this.groups,
    this.enterprise = false,
  });
}

const _plans = <_PlanDef>[
  _PlanDef(
    id: 'starter',
    name: 'Starter',
    color: Color(0xFF3B82F6),
    userLimit: '5 to 10 members',
    tagline: 'For solo brokers and small channel partner teams',
    groups: [
      _PlanGroup('Lead Management', [
        'Unlimited lead imports (CSV / Excel)',
        'Lead pipeline - Kanban (6 stages)',
        'Follow-up scheduling & reminders',
        'Lead source tracking',
        'Push notifications & new lead alerts',
      ]),
      _PlanGroup('Integrations', [
        'Facebook Lead Ads auto-import',
        'WhatsApp capture',
        'Website / WordPress plugin',
      ]),
      _PlanGroup('Team', ['Role-based access (Admin / Manager / Agent)']),
      _PlanGroup('Support', ['Email support']),
    ],
  ),
  _PlanDef(
    id: 'growth',
    name: 'Growth',
    color: Color(0xFFFF6B00),
    userLimit: '5 to 30 members',
    tagline: 'For active real estate teams that need automation and insights',
    groups: [
      _PlanGroup('Everything in Starter, plus', [
        'Multiple project pipelines',
        'Duplicate lead detection',
        'Auto round-robin lead assignment',
        'Bulk lead export',
        'Campaign routing rules',
      ]),
      _PlanGroup('Team', ['Attendance tracking', 'Team performance dashboard']),
      _PlanGroup('Analytics', [
        'Advanced analytics & conversion reports',
        'Booking rate & call-back metrics',
        'Individual agent response tracking',
      ]),
      _PlanGroup('Support', ['Priority support']),
    ],
  ),
  _PlanDef(
    id: 'enterprise',
    name: 'Enterprise',
    color: Color(0xFFA855F7),
    userLimit: '25+ members, unlimited',
    tagline: 'For large developers, franchise networks and multi-branch orgs',
    enterprise: true,
    groups: [
      _PlanGroup('Everything in Growth, plus', [
        'Google Ads integration',
        'Custom webhook & API access',
        'Multi-org management',
        'Advanced automation management',
      ]),
      _PlanGroup('Customisation', [
        'Custom branding & white-label',
        'Custom reporting',
        'On-site onboarding & training',
      ]),
      _PlanGroup('Account', ['Dedicated account manager', 'SLA-backed uptime']),
    ],
  ),
];

/// Plan & Billing screen — mirrors frontend/src/pages/Plans.jsx.
/// Admin-only (matches Sidebar.jsx's `roles: ["admin"]`).
class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  final _api = ApiClient.instance;
  Map<String, dynamic>? _sub;
  bool _subBusy = false;

  @override
  void initState() {
    super.initState();
    _loadSubscription();
  }

  Future<void> _loadSubscription() async {
    try {
      final res = await _api.dio.get('/billing/me');
      if (mounted) {
        setState(() => _sub = (res.data['subscription'] as Map?)?.cast<String, dynamic>());
      }
    } catch (_) {
      if (mounted) setState(() => _sub = null);
    }
  }

  Future<void> _setRenewal(bool cancel) async {
    if (_subBusy) return;
    setState(() => _subBusy = true);
    try {
      final res = await _api.dio.post(cancel ? '/billing/cancel' : '/billing/resume');
      setState(() => _sub = (res.data['subscription'] as Map?)?.cast<String, dynamic>());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text((res.data['message'] as String?) ??
                (cancel ? 'Subscription cancelled.' : 'Subscription resumed.')),
          ),
        );
      }
      if (mounted) context.read<AuthState>().refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Could not update the subscription.')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _subBusy = false);
    }
  }

  String _fmtDate(String? iso) {
    final d = DateTime.tryParse(iso ?? '')?.toLocal();
    if (d == null) return '';
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  void _openCheckout(String planId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CheckoutSheet(
        planId: planId,
        onSuccess: () {
          _loadSubscription();
          context.read<AuthState>().refresh();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final org = auth.org;
    final t = AppTheme.of(context);
    final rawPlan = org?['plan'] as String?;
    final currentPlanId = rawPlan == 'pro' ? 'growth' : (rawPlan ?? 'starter');
    final isPaidPlan = ['starter', 'growth', 'pro', 'enterprise'].contains(rawPlan);
    final next = upgradeTarget(rawPlan);

    int? trialDaysLeft;
    if (rawPlan == 'trial' && org?['trialEndsAt'] != null) {
      final ends = DateTime.tryParse(org!['trialEndsAt'].toString());
      if (ends != null) {
        trialDaysLeft = ends.difference(DateTime.now()).inHours ~/ 24 + 1;
        if (trialDaysLeft < 0) trialDaysLeft = 0;
      }
    }

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Header ──────────────────────────────────────────────
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PLANS & BILLING',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('Your Plan', style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text.rich(
                    TextSpan(
                      style: TextStyle(fontSize: 13, color: t.textSoft),
                      children: [
                        const TextSpan(text: 'Currently on '),
                        TextSpan(
                          text: planLabel(rawPlan),
                          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                        ),
                        if (trialDaysLeft != null)
                          TextSpan(
                            text: ' · $trialDaysLeft day${trialDaysLeft == 1 ? '' : 's'} left in trial',
                            style: const TextStyle(color: Color(0xFFD97706)),
                          ),
                      ],
                    ),
                  ),
                  if (next != null) ...[
                    const SizedBox(height: 12),
                    GradientButton(
                      icon: Icons.arrow_forward_rounded,
                      onPressed: next == 'Enterprise' ? _openWhatsApp : () => _openCheckout(next.toLowerCase()),
                      child: Text(next == 'Enterprise' ? 'Upgrade to $next' : 'Subscribe to $next'),
                    ),
                  ],

                  if (_sub != null && _sub!['status'] != 'none') ...[
                    const SizedBox(height: 16),
                    _SubscriptionBanner(
                      sub: _sub!,
                      busy: _subBusy,
                      fmtDate: _fmtDate,
                      onToggleRenewal: () => _setRenewal(_sub!['cancelAtPeriodEnd'] != true),
                    ),
                  ],

                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.bolt_rounded, size: 18, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${planLabel(rawPlan)} Plan',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                currentPlanId == 'starter'
                                    ? 'Up to 10 team members · Core features'
                                    : currentPlanId == 'enterprise'
                                        ? 'Unlimited members · All features'
                                        : 'Up to 30 team members · Full automation & analytics',
                                style: TextStyle(fontSize: 11, color: t.textSoft),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text('Active',
                              style: TextStyle(
                                  fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // ── Plan cards ──────────────────────────────────────────
          ..._plans.map((plan) {
            final isCurrent = isPaidPlan && plan.id == currentPlanId;
            final isBuyable = !plan.enterprise && !isCurrent;
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _PlanCard(
                plan: plan,
                isCurrent: isCurrent,
                isBuyable: isBuyable,
                onSubscribe: () => _openCheckout(plan.id),
                onTalkToSales: _openWhatsApp,
              ),
            );
          }),

          // ── Included in every plan ──────────────────────────────
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'INCLUDED IN EVERY PLAN',
                    style: TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: t.textSoft),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 16,
                    runSpacing: 10,
                    children: const [
                      _IncludedItem('Mobile-friendly', Icons.shield_outlined),
                      _IncludedItem('Facebook Lead Ads', Icons.facebook),
                      _IncludedItem('WhatsApp capture', Icons.chat_bubble_outline),
                      _IncludedItem('Kanban pipeline', Icons.view_kanban_outlined),
                      _IncludedItem('Push notifications', Icons.notifications_none_rounded),
                      _IncludedItem('WordPress plugin', Icons.bolt_outlined),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // ── Contact ─────────────────────────────────────────────
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Need help choosing a plan?',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 4),
                  Text("Talk to us - we'll find the right fit for your team size and workflow.",
                      style: TextStyle(fontSize: 12.5, color: t.textSoft)),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: GradientButton(
                          icon: Icons.chat_rounded,
                          fullWidth: true,
                          onPressed: _openWhatsApp,
                          child: const Text('WhatsApp Us'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SecondaryButton(
                          icon: Icons.mail_outline_rounded,
                          fullWidth: true,
                          onPressed: _openEmail,
                          child: const Text('Email Us'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IncludedItem extends StatelessWidget {
  final String label;
  final IconData icon;
  const _IncludedItem(this.label, this.icon);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 14, color: AppColors.primary),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label,
                style: TextStyle(fontSize: 12, color: AppTheme.of(context).textSoft)),
          ),
        ],
      ),
    );
  }
}

class _SubscriptionBanner extends StatelessWidget {
  final Map<String, dynamic> sub;
  final bool busy;
  final String Function(String?) fmtDate;
  final VoidCallback onToggleRenewal;
  const _SubscriptionBanner({
    required this.sub,
    required this.busy,
    required this.fmtDate,
    required this.onToggleRenewal,
  });

  @override
  Widget build(BuildContext context) {
    final status = sub['status'] as String?;
    final cancelAtPeriodEnd = sub['cancelAtPeriodEnd'] == true;
    final paidUntil = sub['paidUntil'] as String?;
    final daysLeft = sub['daysLeft'] as num? ?? 0;
    final lapsesTo = sub['lapsesTo'] as String?;

    Color bg;
    Color border;
    Color titleColor;
    String title;
    String desc;

    switch (status) {
      case 'active':
        bg = const Color(0x0F22C55E);
        border = const Color(0x3822C55E);
        titleColor = AppColors.success;
        title = cancelAtPeriodEnd
            ? 'Cancelled — access until ${fmtDate(paidUntil)}'
            : 'Renews ${fmtDate(paidUntil)}';
        desc = cancelAtPeriodEnd
            ? 'Your plan will change to ${planLabel(lapsesTo)} after that. You can resume any time before then.'
            : '$daysLeft day${daysLeft == 1 ? '' : 's'} remaining. Renewal is not automatic — we\'ll remind you.';
        break;
      case 'grace':
        bg = const Color(0x14F59E0B);
        border = const Color(0x59F59E0B);
        titleColor = const Color(0xFFB45309);
        title = 'Your plan expired on ${fmtDate(paidUntil)}';
        desc = 'You still have full access for $daysLeft more day${daysLeft == 1 ? '' : 's'}. '
            'After that this workspace moves to ${planLabel(lapsesTo)} — your leads stay, but paid features stop.';
        break;
      case 'lapsed':
        bg = const Color(0x14EF4444);
        border = const Color(0x59EF4444);
        titleColor = const Color(0xFFB91C1C);
        title = 'Subscription lapsed on ${fmtDate(paidUntil)}';
        desc = 'This workspace is on ${planLabel(lapsesTo)}. All your data is intact — renew to restore paid features.';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: titleColor)),
          const SizedBox(height: 4),
          Text(desc, style: TextStyle(fontSize: 11.5, color: AppTheme.of(context).textSoft)),
          if (status == 'active') ...[
            const SizedBox(height: 10),
            GhostButton(
              onPressed: busy ? null : onToggleRenewal,
              child: Text(busy ? 'Saving…' : (cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel subscription')),
            ),
          ],
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final _PlanDef plan;
  final bool isCurrent;
  final bool isBuyable;
  final VoidCallback onSubscribe;
  final VoidCallback onTalkToSales;
  const _PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.isBuyable,
    required this.onSubscribe,
    required this.onTalkToSales,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: isCurrent ? AppColors.primary.withValues(alpha: 0.5) : t.border,
          width: isCurrent ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 4, color: plan.color),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: plan.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.bolt_rounded, size: 17, color: plan.color),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(plan.name,
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                          const SizedBox(height: 2),
                          Text(plan.tagline, style: TextStyle(fontSize: 10.5, color: t.textSoft)),
                        ],
                      ),
                    ),
                    if (isCurrent)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('Current',
                            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      )
                    else if (plan.id == 'growth')
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('Popular',
                            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.white)),
                      )
                    else if (plan.enterprise)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: plan.color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.lock_outline_rounded, size: 10, color: plan.color),
                            const SizedBox(width: 3),
                            Text('Upgrade',
                                style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: plan.color)),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: plan.color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: plan.color.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.people_alt_outlined, size: 13, color: plan.color),
                      const SizedBox(width: 6),
                      Text(plan.userLimit,
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: plan.color)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (plan.enterprise)
                  Text('Custom',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: t.text))
                else
                  Text(
                    plan.id == 'starter' ? '₹599 / user / mo' : '₹999 / user / mo',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: t.text),
                  ),
                const SizedBox(height: 14),
                ...plan.groups.map((g) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g.label.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: t.textSoft)),
                          const SizedBox(height: 4),
                          ...g.items.map((item) => Padding(
                                padding: const EdgeInsets.only(top: 3),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      margin: const EdgeInsets.only(top: 2),
                                      width: 13,
                                      height: 13,
                                      decoration: BoxDecoration(
                                        color: plan.color.withValues(alpha: 0.15),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(Icons.check, size: 9, color: plan.color),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(item,
                                          style: TextStyle(fontSize: 12, color: t.textSoft, height: 1.35)),
                                    ),
                                  ],
                                ),
                              )),
                        ],
                      ),
                    )),
                const SizedBox(height: 4),
                if (isCurrent)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(AppRadii.button),
                    ),
                    child: const Text('Your Current Plan',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.primary)),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: plan.color,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadii.button)),
                      ),
                      onPressed: isBuyable ? onSubscribe : onTalkToSales,
                      child: Text(isBuyable ? 'Subscribe to ${plan.name} →' : 'Talk to sales →'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Checkout sheet — quote → Razorpay order → native Checkout → verify.
/// Mirrors CheckoutModal.jsx, using the same native flow already proven in
/// credits_page.dart's `_TopUpSheet`.
class _CheckoutSheet extends StatefulWidget {
  final String planId;
  final VoidCallback onSuccess;
  const _CheckoutSheet({required this.planId, required this.onSuccess});

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  final _api = ApiClient.instance;
  late final Razorpay _razorpay;

  Map<String, dynamic>? _config;
  Map<String, dynamic>? _plan;
  String _cycle = 'annual';
  int _seats = 5;
  bool _busy = false;
  bool _testMode = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _loadPricing();
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _loadPricing() async {
    try {
      final res = await _api.dio.get('/billing/plans');
      final plans = (res.data['plans'] as List? ?? []).cast<Map>();
      final match = plans.firstWhere(
        (p) => p['id'] == widget.planId,
        orElse: () => {},
      );
      if (!mounted) return;
      setState(() {
        _config = (res.data as Map).cast<String, dynamic>();
        _testMode = res.data['testMode'] == true;
        if (match.isNotEmpty) {
          _plan = match.cast<String, dynamic>();
          final minSeats = (_plan!['minSeats'] as num?)?.toInt() ?? 5;
          final maxSeats = (_plan!['maxSeats'] as num?)?.toInt() ?? 30;
          _seats = _seats.clamp(minSeats, maxSeats);
        }
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load pricing. Please try again.');
    }
  }

  int _clampSeats(int n) {
    if (_plan == null) return n;
    final minSeats = (_plan!['minSeats'] as num?)?.toInt() ?? 5;
    final maxSeats = (_plan!['maxSeats'] as num?)?.toInt() ?? 30;
    return n.clamp(minSeats, maxSeats);
  }

  num get _rate => _cycle == 'annual'
      ? (_plan?['annual'] as num? ?? 0)
      : (_plan?['monthly'] as num? ?? 0);
  num get _total => _rate * _seats;

  int? _freeMonths() {
    final monthly = _plan?['monthly'] as num?;
    final annual = _plan?['annual'] as num?;
    if (monthly == null || annual == null || monthly == 0) return null;
    return (((monthly * 12 - annual) / monthly) * 10).round() ~/ 10;
  }

  Future<void> _pay() async {
    if (_plan == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await _api.dio.post('/billing/order', data: {
        'plan': widget.planId,
        'seats': _seats,
        'cycle': _cycle,
      });
      final order = (res.data['order'] as Map).cast<String, dynamic>();
      final quote = (res.data['quote'] as Map).cast<String, dynamic>();
      final keyId = res.data['keyId'] as String?;
      final options = {
        'key': keyId,
        'order_id': order['id'],
        'amount': order['amount'],
        'currency': order['currency'],
        'name': 'Arthaleads',
        'description': '${widget.planId == 'growth' ? 'Growth' : 'Starter'} · '
            '${quote['seats']} seats · ${quote['cycle']}',
        'theme': {'color': '#FF6B00'},
      };
      _razorpay.open(options);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = ApiClient.errorMessage(e, 'Could not start checkout.');
        });
      }
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse r) async {
    try {
      await _api.dio.post('/billing/verify', data: {
        'razorpay_order_id': r.orderId,
        'razorpay_payment_id': r.paymentId,
        'razorpay_signature': r.signature,
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onSuccess();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment received. Your plan is active.')),
      );
    } catch (_) {
      if (!mounted) return;
      Navigator.pop(context);
      widget.onSuccess();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment received. Your plan will activate shortly.')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse r) {
    if (mounted) {
      setState(() {
        _busy = false;
        _error = r.message ?? 'Payment failed. You have not been charged.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final free = _freeMonths();
    final planName = widget.planId == 'growth' ? 'Growth' : 'Starter';

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Subscribe to $planName',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
            ],
          ),
          if (_testMode)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0x1FEAB308),
                border: Border.all(color: const Color(0x66EAB308)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('Test mode — no real payment will be taken.',
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFFA16207))),
            ),
          if (_error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0x1AEF4444),
                border: Border.all(color: const Color(0x59EF4444)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_error!, style: const TextStyle(fontSize: 11.5, color: Color(0xFFB91C1C))),
            ),
          if (_config == null && _error == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(child: AppSpinner()),
            ),
          if (_plan != null) ...[
            Text('BILLING',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: t.textSoft)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _CycleOption(
                  label: 'Monthly',
                  sub: 'Pay as you go',
                  selected: _cycle == 'monthly',
                  onTap: () => setState(() => _cycle = 'monthly'),
                )),
                const SizedBox(width: 8),
                Expanded(child: _CycleOption(
                  label: 'Annual',
                  sub: free != null ? '$free months free' : 'Pay as you go',
                  selected: _cycle == 'annual',
                  onTap: () => setState(() => _cycle = 'annual'),
                )),
              ],
            ),
            const SizedBox(height: 16),
            Text('TEAM MEMBERS',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: t.textSoft)),
            const SizedBox(height: 8),
            Row(
              children: [
                _StepperButton(
                  icon: Icons.remove_rounded,
                  onTap: _seats > ((_plan!['minSeats'] as num?)?.toInt() ?? 5)
                      ? () => setState(() => _seats = _clampSeats(_seats - 1))
                      : null,
                ),
                Expanded(
                  child: Container(
                    alignment: Alignment.center,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: t.border),
                    ),
                    child: Text('$_seats', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),
                _StepperButton(
                  icon: Icons.add_rounded,
                  onTap: _seats < ((_plan!['maxSeats'] as num?)?.toInt() ?? 30)
                      ? () => setState(() => _seats = _clampSeats(_seats + 1))
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Minimum ${(_plan!['minSeats'] as num?)?.toInt() ?? 5}, '
              'up to ${(_plan!['maxSeats'] as num?)?.toInt() ?? 30} on this plan.',
              style: TextStyle(fontSize: 11, color: t.textSoft),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: t.surfaceLow,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text('${_formatINR(_rate)} × $_seats member${_seats == 1 ? '' : 's'}',
                            style: TextStyle(fontSize: 12.5, color: t.textSoft)),
                      ),
                      Text(_formatINR(_total),
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Billed ${_cycle == 'annual' ? 'yearly' : 'monthly'}. Taxes extra where applicable.',
                    style: TextStyle(fontSize: 10.5, color: t.textSoft),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            GradientButton(
              fullWidth: true,
              loading: _busy,
              onPressed: _busy ? null : _pay,
              child: Text(_busy ? 'Opening checkout…' : 'Pay ${_formatINR(_total)}'),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.verified_user_outlined, size: 13, color: t.textSoft),
                const SizedBox(width: 5),
                Text('Secured by Razorpay · UPI, cards and net banking',
                    style: TextStyle(fontSize: 10.5, color: t.textSoft)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CycleOption extends StatelessWidget {
  final String label;
  final String sub;
  final bool selected;
  final VoidCallback onTap;
  const _CycleOption({required this.label, required this.sub, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : t.border),
          color: selected ? AppColors.primary.withValues(alpha: 0.08) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? AppColors.primary : t.text)),
            const SizedBox(height: 2),
            Text(sub,
                style: TextStyle(
                    fontSize: 10, color: selected ? AppColors.primary.withValues(alpha: 0.8) : t.textSoft)),
          ],
        ),
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _StepperButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.border),
        ),
        child: Icon(icon, size: 18, color: onTap == null ? t.textSoft.withValues(alpha: 0.4) : t.text),
      ),
    );
  }
}
