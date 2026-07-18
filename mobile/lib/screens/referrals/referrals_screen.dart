import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';

const _steps = [
  (
    'Share your link',
    'Send your unique referral link to other real estate teams, brokers, or channel partners.',
    Icons.ios_share,
  ),
  (
    'They sign up',
    'When they create an Arthaleads account using your link, we tag them as your referral.',
    Icons.person_add_alt,
  ),
  (
    'They subscribe',
    'Once they upgrade to any paid plan and complete their first payment, the reward unlocks.',
    Icons.credit_card,
  ),
  (
    'You both earn',
    'You get 1 free month added to your plan — and they get 1 free month too.',
    Icons.card_giftcard,
  ),
];

/// Refer & Earn — code/link derived client-side from org identity (matches
/// frontend/src/pages/Referrals.jsx, which computes it the same way with no
/// dedicated backend endpoint), GET /referrals/mine for status tracking.
class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _list = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  bool _copied = false;
  double _calcCount = 3;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/referrals/mine');
      final data = (res.data['data'] as Map).cast<String, dynamic>();
      setState(() {
        _list = (data['list'] as List? ?? []).cast<Map<String, dynamic>>();
        _summary = (data['summary'] as Map?)?.cast<String, dynamic>() ?? {};
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load referrals'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _code(Map<String, dynamic>? org) {
    if (org == null) return null;
    final id = org['_id'] as String?;
    if (id != null && id.isNotEmpty) {
      return id.substring(id.length - 6).toUpperCase();
    }
    final name = org['name'] as String?;
    if (name != null && name.isNotEmpty) {
      final cleaned = name.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
      return cleaned
          .substring(0, cleaned.length < 6 ? cleaned.length : 6)
          .toUpperCase();
    }
    return null;
  }

  Future<void> _copyLink(String link) async {
    await Clipboard.setData(ClipboardData(text: link));
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _shareLink(String link, String userName) async {
    final msg =
        "I use Arthaleads to manage my real estate leads — it's brilliant. "
        "Sign up with my link and we both get a free month: $link";
    await Share.share(msg);
  }

  Future<void> _shareWhatsApp(String link) async {
    final message = Uri.encodeComponent(
      "I use Arthaleads to manage my real estate leads — it's brilliant. "
      'Sign up with my link and we both get a free month: $link',
    );
    await launchUrl(
      Uri.parse('https://wa.me/?text=$message'),
      mode: LaunchMode.externalApplication,
    );
  }

  Future<void> _shareEmail(String link, String userName) async {
    await launchUrl(
      Uri(
        scheme: 'mailto',
        queryParameters: {
          'subject': 'Try Arthaleads CRM — we both get a free month',
          'body':
              'Hi,\n\nI use Arthaleads to manage my real estate leads and thought you would find it useful.\n'
              'Sign up with my link and we both get a free month:\n\n$link\n\nCheers,\n$userName',
        },
      ),
      mode: LaunchMode.externalApplication,
    );
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'signed_up':
        return 'Signed Up';
      case 'subscribed':
        return 'Subscribed';
      case 'reward_pending':
        return 'Reward Pending';
      case 'rewarded':
        return 'Rewarded ✓';
      default:
        return s ?? '—';
    }
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'rewarded':
        return AppColors.primary;
      case 'reward_pending':
        return AppColors.warning;
      case 'subscribed':
        return AppColors.success;
      default:
        return const Color(0xFF6B7280);
    }
  }

  String _timeAgo(String? iso) {
    final dt = DateTime.tryParse(iso ?? '');
    if (dt == null) return '—';
    final days = DateTime.now().difference(dt).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    if (days < 30) return '${days}d ago';
    return DateFormat('dd MMM').format(dt);
  }

  int _daysUntil(String? iso) {
    final dt = DateTime.tryParse(iso ?? '');
    if (dt == null) return 0;
    return dt.difference(DateTime.now()).inDays.clamp(0, 9999);
  }

  Widget _statCard(String label, dynamic value, Color color, IconData icon) {
    final theme = AppTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.surfaceSolid,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 6),
          Text(
            '${value ?? '—'}',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(fontSize: 10, color: theme.textSoft),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final code = _code(auth.org);
    final link = code != null ? 'https://arthaleads.com/signup?ref=$code' : '';

    return Column(
      children: [
        PageHeader(
          title: 'Refer & Earn',
          subtitle: 'Invite other teams and earn free months together',
          icon: Icons.card_giftcard,
          trailing: _loading
              ? const Padding(
                  padding: EdgeInsets.all(8),
                  child: AppSpinner(size: 18),
                )
              : IconButton(
                  tooltip: 'Refresh',
                  icon: const Icon(Icons.refresh_rounded),
                  onPressed: _load,
                ),
        ),
        Expanded(
          child: RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.7,
            children: [
              _statCard(
                'Total Referred',
                _summary['total'],
                const Color(0xFF6B7280),
                Icons.people_outline,
              ),
              _statCard(
                'Subscribed',
                _summary['subscribed'],
                AppColors.success,
                Icons.credit_card,
              ),
              _statCard(
                'Reward Pending',
                _summary['rewardPending'],
                AppColors.warning,
                Icons.access_time,
              ),
              _statCard(
                'Rewards Earned',
                _summary['rewarded'],
                AppColors.primary,
                Icons.star_border,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── Referral link card ──
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.auto_awesome,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Your referral link',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Share this link — when they subscribe you both get 1 free month.',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                  if (code != null) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          'Your code: ',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            code,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              letterSpacing: 2,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Theme.of(context).dividerColor),
                    ),
                    child: Text(
                      link.isEmpty ? 'No link available' : link,
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (link.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _copyLink(link),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _copied
                                  ? AppColors.success
                                  : AppColors.primary,
                            ),
                            icon: Icon(
                              _copied ? Icons.check : Icons.copy,
                              size: 16,
                            ),
                            label: Text(_copied ? 'Copied!' : 'Copy'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _shareLink(
                              link,
                              auth.user?['name'] as String? ?? '',
                            ),
                            icon: const Icon(Icons.share, size: 16),
                            label: const Text('Share'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _shareWhatsApp(link),
                            icon: const FaIcon(
                              FontAwesomeIcons.whatsapp,
                              size: 16,
                            ),
                            label: const Text('WhatsApp'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _shareEmail(
                              link,
                              auth.user?['name'] as String? ?? '',
                            ),
                            icon: const Icon(Icons.email_outlined, size: 16),
                            label: const Text('Email'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── My referrals list ──
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'How much can you earn?',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Drag to estimate free months based on referrals who subscribe.',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Text(
                        'Referrals who subscribe',
                        style: TextStyle(fontSize: 12),
                      ),
                      const Spacer(),
                      Text(
                        '${_calcCount.round()}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  Slider(
                    value: _calcCount,
                    min: 1,
                    max: 12,
                    divisions: 11,
                    label: '${_calcCount.round()}',
                    onChanged: (value) => setState(() => _calcCount = value),
                  ),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'You could earn',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          '${_calcCount.round().clamp(1, 6)} free month${_calcCount.round().clamp(1, 6) == 1 ? '' : 's'}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                        if (_calcCount > 6)
                          Text(
                            'Capped at 6 per year — resets annually',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade600,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Text(
                'My Referrals',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const Spacer(),
              if (_list.isNotEmpty)
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
                    '${_list.length} team${_list.length != 1 ? 's' : ''}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_list.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(
                    Icons.card_giftcard,
                    size: 36,
                    color: AppColors.primary.withValues(alpha: 0.3),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'No referrals yet',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "Share your referral link above. When someone signs up using "
                    "your link, they'll appear here with their status.",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            )
          else
            ..._list.map((r) {
              final color = _statusColor(r['status'] as String?);
              final plan = r['plan'] as String?;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary,
                    child: Text(
                      (r['name'] as String? ?? '?').isNotEmpty
                          ? (r['name'] as String)[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  title: Text(
                    r['name'] as String? ?? '—',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    'Joined ${_timeAgo(r['joinedAt'] as String?)}${plan != null ? ' · ${plan == 'trial' ? 'Free Trial' : plan}' : ''}',
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: color.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Text(
                          _statusLabel(r['status'] as String?),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: color,
                          ),
                        ),
                      ),
                      if (r['status'] == 'reward_pending' &&
                          r['referralRewardAt'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text(
                            '${_daysUntil(r['referralRewardAt'] as String?)}d remaining',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 20),

          // ── How it works ──
          Text('How it works', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.1,
            children: [
              for (var i = 0; i < _steps.length; i++)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Theme.of(context).dividerColor),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              _steps[i].$3,
                              size: 14,
                              color: AppColors.primary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${i + 1}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary.withValues(alpha: 0.2),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _steps[i].$1,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _steps[i].$2,
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey.shade600,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
          ),
        ),
      ],
    );
  }
}
