import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/plan.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';
import '../../widgets/upgrade_wall.dart';

/// Integrations → Property portals: 99acres, Housing.com and MagicBricks
/// leads (Growth, admins). Mirrors frontend/src/pages/integrations/
/// PortalsPage.jsx (27 Oct 2026). The portals can't be signed into like
/// Facebook: each portal's account manager points enquiries at the company's
/// private link, and Housing.com can also be fetched with the ID and key it
/// issues. Backend: /api/portal-leads (routes/portalRoutes.js).
class PortalsScreen extends StatefulWidget {
  const PortalsScreen({super.key});

  @override
  State<PortalsScreen> createState() => _PortalsScreenState();
}

String _managerMessage(String label, String link) => '''Hi,
Please send our $label enquiries to our CRM (ArthaLeads) as they come in.
Webhook URL: $link
It accepts POST (JSON or form data) or GET with the values in the link. We read name, phone, email, project, locality, city, message and the enquiry ID, whatever the field names are.
Please send one test lead once it is set up. Thank you.''';

class _PortalsScreenState extends State<PortalsScreen> {
  final _api = ApiClient.instance;
  final _profileId = TextEditingController();
  final _secret = TextEditingController();
  Map<String, dynamic>? _d;
  String _tab = 'Overview';
  String _portal = '99acres';
  String _busy = '';

  static const _description =
      '99acres, Housing.com and MagicBricks enquiries arrive in Leads by themselves, tagged with the portal and project. A buyer who is already a lead gets the new enquiry on their existing lead.';

  bool get _allowed {
    final a = context.read<AuthState>();
    return a.role == 'super_admin' || (a.role == 'admin' && canAccess(a.org, 'growth'));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _allowed) _load();
    });
  }

  @override
  void dispose() {
    _profileId.dispose();
    _secret.dispose();
    super.dispose();
  }

  void _apply(dynamic data) {
    _d = (data as Map).cast<String, dynamic>();
    _profileId.text = '${_housing['profileId'] ?? ''}';
    _secret.clear();
  }

  Future<void> _load() async {
    try {
      final r = await _api.dio.get('/portal-leads/settings');
      _apply(r.data);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not load the portals.'), error: true);
    }
    if (mounted) setState(() {});
  }

  void _snack(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? AppColors.danger : null));
  }

  List<Map<String, dynamic>> get _portals => [
        for (final p in (_d?['portals'] as List?) ?? const [])
          if (p is Map) p.cast<String, dynamic>(),
      ];
  Map<String, dynamic> get _housing => ((_d?['housing'] as Map?) ?? {}).cast<String, dynamic>();

  Future<void> _saveHousing(Map<String, dynamic> patch) async {
    setState(() => _busy = 'save');
    try {
      final r = await _api.dio.put('/portal-leads/settings/housing', data: patch);
      _apply(r.data);
      _snack('Saved.');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not save.'), error: true);
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _pullNow() async {
    setState(() => _busy = 'pull');
    try {
      final r = await _api.dio.post('/portal-leads/settings/housing/pull');
      _apply(r.data['settings']);
      final got = ((r.data['created'] as num?) ?? 0).toInt() + ((r.data['added'] as num?) ?? 0).toInt();
      _snack(got > 0
          ? '$got new ${got == 1 ? 'enquiry' : 'enquiries'} from Housing.com.'
          : 'Connected. No new enquiries right now.');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not reach Housing.com.'), error: true);
      _load();
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _newLinks() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Make new links?'),
        content: const Text('The current links for all three portals stop working. Send the new ones to your portal account managers.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, new links', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = 'link');
    try {
      final r = await _api.dio.post('/portal-leads/settings/new-link');
      _apply(r.data);
      _snack('New links made. Send them to your portal account managers.');
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not make a new link.'), error: true);
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  static String _brand(String slug) => slug == 'housing' ? 'housing' : slug;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final t = AppTheme.of(context);
    if (!_allowed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Property portals')),
        body: auth.role == 'admin'
            ? UpgradeWall(org: auth.org, feature: 'Property portal leads', description: _description, needs: 'growth')
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Only an admin can set up property portals.',
                      textAlign: TextAlign.center, style: TextStyle(color: t.textSoft)),
                ),
              ),
      );
    }
    final d = _d;
    final portals = _portals;
    final h = _housing;
    final total30 = portals.fold<int>(0, (n, p) => n + ((p['leads30d'] as num?) ?? 0).toInt());
    final lasts = [for (final p in portals) if (p['lastLeadAt'] != null) '${p['lastLeadAt']}']..sort();
    final sending = portals.where((p) => p['lastLeadAt'] != null).length;
    final housingSilent = portals.firstWhere((p) => p['slug'] == 'housing', orElse: () => const {})['lastLeadAt'] == null;
    final live = sending + (h['enabled'] == true && housingSilent ? 1 : 0);
    return Scaffold(
      appBar: AppBar(title: const Text('Property portals')),
      body: d == null
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                IntegrationHeader(
                  logo: SizedBox(
                    width: 52,
                    height: 52,
                    child: Wrap(spacing: 2, runSpacing: 2, children: const [
                      BrandLogo('99acres', size: 25),
                      BrandLogo('housing', size: 25),
                      BrandLogo('magicbricks', size: 25),
                    ]),
                  ),
                  title: 'Property portals',
                  subtitle: _description,
                  status: live > 0 ? StatusPill.on('Receiving leads') : StatusPill.off('Not connected'),
                ),
                const SizedBox(height: 14),
                MiniStatGrid([
                  MiniStat('Enquiries · 30 days', '$total30'),
                  MiniStat('Portals sending', '$sending of 3'),
                  MiniStat('Last enquiry', lasts.isEmpty ? 'None yet' : agoText(lasts.last)),
                  MiniStat('Housing.com fetch', h['enabled'] == true ? 'Every 15 min' : 'Off'),
                ]),
                const SizedBox(height: 14),
                ChipTabs(tabs: const ['Overview', 'Settings', 'Setup help'], value: _tab, onChanged: (v) => setState(() => _tab = v)),
                const SizedBox(height: 12),
                if (_tab == 'Overview') ..._overview(portals),
                if (_tab == 'Settings') ..._settings(portals, h),
                if (_tab == 'Setup help') ..._help(),
              ]),
            ),
    );
  }

  List<Widget> _overview(List<Map<String, dynamic>> portals) {
    final t = AppTheme.of(context);
    return [
      PanelCard(
        title: 'Portals',
        child: Column(children: [
          for (final (i, p) in portals.indexed) ...[
            if (i > 0) Divider(height: 1, color: t.border),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(children: [
                BrandLogo(_brand('${p['slug']}'), size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${p['label']}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.text)),
                    Text(p['lastLeadAt'] != null ? 'Last enquiry ${istTime(p['lastLeadAt'])}' : 'No enquiries yet',
                        style: TextStyle(fontSize: 11.5, color: t.textSoft)),
                  ]),
                ),
                Text('${p['leads30d'] ?? 0}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
              ]),
            ),
          ],
          const SizedBox(height: 4),
          Text('Count of new leads from each portal in the last 30 days. Repeat enquiries are added to the existing lead.',
              style: TextStyle(fontSize: 11.5, color: t.textSoft)),
        ]),
      ),
      const SizedBox(height: 12),
      const PanelCard(
        title: 'What we read from each enquiry',
        child: KeyValueList([
          ('Contact', 'Name, phone, email'),
          ('Property', 'Project, locality, city'),
          ('Enquiry', 'Message, budget, enquiry ID'),
          ('Project match', 'Filed into your project with the same name'),
          ('Repeat buyer', 'Added to their existing lead'),
        ]),
      ),
    ];
  }

  List<Widget> _settings(List<Map<String, dynamic>> portals, Map<String, dynamic> h) {
    final t = AppTheme.of(context);
    if (portals.isEmpty) return const [];
    final current = portals.firstWhere((p) => p['slug'] == _portal, orElse: () => portals.first);
    final label = '${current['label']}';
    final link = '${current['link'] ?? ''}';
    final message = _managerMessage(label, link);
    final keysSaved = '${h['profileId'] ?? ''}'.isNotEmpty && h['keySet'] == true;
    final formChanged = _secret.text.isNotEmpty || _profileId.text != '${h['profileId'] ?? ''}';
    return [
      PanelCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(
            height: 40,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final p in portals)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    showCheckmark: false,
                    avatar: BrandLogo(_brand('${p['slug']}'), size: 20),
                    label: Text('${p['label']}'),
                    selected: p['slug'] == current['slug'],
                    onSelected: (_) => setState(() => _portal = '${p['slug']}'),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 12),
          CopyField(
            label: 'Your $label link',
            value: link,
            note: 'Keep this link private: anything sent to it becomes a lead in your account.',
          ),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: Text('Message for your $label account manager',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.text)),
            ),
            TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: message));
                _snack('Message copied');
              },
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: const Text('Copy message'),
            ),
          ]),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: t.surfaceLow,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: t.border),
            ),
            child: Text(message, style: TextStyle(fontSize: 12, color: t.textSoft)),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      PanelCard(
        title: 'Housing.com API (builder accounts)',
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(h['enabled'] == true ? 'On' : 'Off', style: TextStyle(fontSize: 12, color: t.textSoft)),
          Tooltip(
            message: keysSaved ? '' : 'Save the ID and key first',
            child: Switch(
              value: h['enabled'] == true,
              onChanged: _busy.isNotEmpty || !keysSaved ? null : (v) => _saveHousing({'enabled': v}),
            ),
          ),
        ]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            'Housing.com gives builder accounts an ID and a secret key. With them saved, we check for new enquiries every 15 minutes, as well as anything sent to your link.',
            style: TextStyle(fontSize: 12.5, color: t.textSoft),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _profileId,
            autocorrect: false,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Housing.com ID', hintText: 'e.g. 4544'),
          ),
          const SizedBox(height: 10),
          ValueListenableBuilder(
            valueListenable: _secret,
            builder: (_, _, _) => SecretField(
              label: 'Secret key',
              controller: _secret,
              saved: h['keySet'] == true,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
            GradientButton(
              onPressed: _busy.isNotEmpty || !formChanged
                  ? null
                  : () => _saveHousing({
                        'profileId': _profileId.text.trim(),
                        if (_secret.text.trim().isNotEmpty) 'secretKey': _secret.text.trim(),
                      }),
              loading: _busy == 'save',
              child: const Text('Save'),
            ),
            SecondaryButton(
              onPressed: _busy.isNotEmpty || !keysSaved ? null : _pullNow,
              icon: Icons.refresh_rounded,
              child: Text(_busy == 'pull' ? 'Fetching…' : 'Fetch now'),
            ),
            if (h['enabled'] == true)
              h['lastError'] != null && '${h['lastError']}'.isNotEmpty
                  ? StatusPill.warn('Fetch failing')
                  : StatusPill.on('Fetching'),
          ]),
          if (h['lastPullAt'] != null) ...[
            const SizedBox(height: 8),
            Text('Last checked ${istTime(h['lastPullAt'])}', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          ],
          if (h['lastError'] != null && '${h['lastError']}'.isNotEmpty) ...[
            const SizedBox(height: 8),
            ErrorNote('${h['lastError']}'),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      PanelCard(
        title: 'Private links',
        subtitle: 'Shared a link by mistake? Make new links; the old ones stop working.',
        child: Align(
          alignment: Alignment.centerLeft,
          child: SecondaryButton(
            onPressed: _busy.isEmpty ? _newLinks : null,
            child: Text(_busy == 'link' ? 'Making…' : 'Make new links'),
          ),
        ),
      ),
    ];
  }

  List<Widget> _help() => const [
        PanelCard(
          title: 'Set it up',
          child: SetupSteps([
            ('Copy the message', 'On the Settings tab, pick the portal and copy the message for your account manager.'),
            ('Send it', 'Send it to your account manager at that portal. If your portal dashboard has a CRM or webhook setting, paste the link there instead.'),
            ('Ask for a test lead', 'It shows up in Leads with the portal as the source.'),
            ('Housing.com builder accounts', 'You can also save the ID and key they give you to fetch enquiries every 15 minutes.'),
          ]),
        ),
        SizedBox(height: 12),
        PanelCard(
          title: 'If something goes wrong',
          child: KeyValueList([
            ("Portal says CRM delivery isn't included", 'It usually comes with builder or higher packages; ask which one adds it'),
            ('Lead had no phone number', 'Not saved; ask the portal to include the phone'),
            ('Housing.com fetch failing', 'Check the ID and key with your account manager'),
          ]),
        ),
      ];
}
