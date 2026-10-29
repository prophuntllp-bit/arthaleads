import 'dart:async';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/glass.dart';
import '../../widgets/integration_kit.dart';
import '../../widgets/motion.dart';
import '../leads/lead_origin.dart';

/// Integrations → Website forms: the WordPress sites sending their form
/// enquiries in. Mirrors frontend/src/pages/integrations/WebsitesPage.jsx
/// (28 Oct 2026): each site has a name, an address (for its icon) and its own
/// key for the ArthaLeads plugin; sites can be added, renamed and removed.
/// Backend: /api/automations/website/* (controllers/automationController.js).
class WebsitesScreen extends StatefulWidget {
  const WebsitesScreen({super.key});

  @override
  State<WebsitesScreen> createState() => _WebsitesScreenState();
}

const _formPlugins = ['Contact Form 7', 'WPForms', 'Elementor', 'Gravity Forms', 'Ninja Forms', 'Forminator', 'Fluent Forms'];
const _pluginZip = 'https://www.arthaleads.com/arthaleads-integration.zip';

String _hostOf(String url) {
  final h = Uri.tryParse(url)?.host ?? '';
  final host = h.isEmpty ? url : h;
  return host.startsWith('www.') ? host.substring(4) : host;
}

/// The name you gave the site wins; then the name its plugin reports; then
/// its address.
String _siteTitle(Map<String, dynamic> s) {
  final name = '${s['name'] ?? ''}';
  final siteName = '${s['siteName'] ?? ''}';
  final url = '${s['siteUrl'] ?? ''}';
  if (!LeadOrigin.isGenericName(name)) return name;
  if (!LeadOrigin.isGenericName(siteName)) return siteName;
  return url.isNotEmpty ? _hostOf(url) : name;
}

class _WebsitesScreenState extends State<WebsitesScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>>? _sites;
  final Set<String> _justAdded = {};
  String _tab = 'Sites';
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _api.dio.get('/automations/website/token');
      final list = [
        for (final c in (r.data['connections'] as List?) ?? const [])
          if (c is Map) c.cast<String, dynamic>(),
      ];
      // A new site stays at the top, outlined, so it is seen without scrolling.
      list.sort((a, b) => (_justAdded.contains(b['id']) ? 1 : 0) - (_justAdded.contains(a['id']) ? 1 : 0));
      _sites = list;
    } catch (_) {
      _sites ??= [];
    }
    if (!mounted) return;
    setState(() {});
    // While a site is waiting for its plugin, check every 4 seconds so it
    // turns Connected on its own.
    final waiting = _sites!.any((s) => s['status'] != 'connected');
    if (waiting && _poll == null) {
      _poll = Timer.periodic(const Duration(seconds: 4), (_) => _load());
    } else if (!waiting) {
      _poll?.cancel();
      _poll = null;
    }
  }

  void _snack(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? AppColors.danger : null));
  }

  Future<void> _openForm([Map<String, dynamic>? site]) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _SiteForm(site: site),
    );
    if (result == null) return;
    if (site == null) {
      _justAdded.add('${result['id']}');
      setState(() => _tab = 'Sites');
    }
    _load();
  }

  Future<void> _remove(Map<String, dynamic> site) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove this site?'),
        content: Text('${_siteTitle(site)} will stop sending leads. Leads already in your CRM stay.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/automations/${site['id']}');
      _snack('Site removed.');
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Could not remove the site.'), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sites = _sites;
    final list = sites ?? const <Map<String, dynamic>>[];
    final connected = list.where((s) => s['status'] == 'connected').length;
    final forms = {for (final s in list) ...((s['connectedForms'] as List?) ?? const []).map((f) => '$f')}.length;
    final lasts = [for (final s in list) if (s['lastSyncAt'] != null) '${s['lastSyncAt']}']..sort();
    return Scaffold(
      appBar: AppBar(title: const Text('Website forms')),
      body: sites == null
          ? const Center(child: AppSpinner(size: 32))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
                IntegrationHeader(
                  logo: const _WordPressTile(size: 52),
                  title: 'Website forms',
                  subtitle:
                      'Enquiries from the contact forms on your WordPress sites arrive in Leads by themselves, with the site and page they came from. Each site has its own key.',
                  status: connected > 0
                      ? StatusPill.on('$connected connected')
                      : (list.isNotEmpty ? StatusPill.warn('Waiting for plugin') : StatusPill.off('Not connected')),
                  actions: [
                    GradientButton(onPressed: () => _openForm(), icon: Icons.add_rounded, child: const Text('Add a site')),
                    SecondaryButton(
                      onPressed: () => launchUrl(Uri.parse(_pluginZip), mode: LaunchMode.externalApplication),
                      icon: Icons.download_rounded,
                      child: const Text('Download plugin'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                MiniStatGrid([
                  MiniStat('Sites connected', '$connected of ${list.length}'),
                  MiniStat('Forms sending', '$forms'),
                  MiniStat('Last lead', lasts.isEmpty ? 'None yet' : agoText(lasts.last),
                      lasts.isEmpty ? null : istTime(lasts.last)),
                ]),
                const SizedBox(height: 14),
                ChipTabs(
                  tabs: const ['Sites', 'Setup help'],
                  value: _tab,
                  onChanged: (v) => setState(() => _tab = v),
                ),
                const SizedBox(height: 12),
                if (_tab == 'Sites' && list.isEmpty) _empty(),
                if (_tab == 'Sites')
                  for (final s in list) ...[_siteCard(s), const SizedBox(height: 12)],
                if (_tab == 'Setup help') ..._help(),
              ]),
            ),
    );
  }

  Widget _empty() {
    final t = AppTheme.of(context);
    return PanelCard(
      child: Column(children: [
        const SizedBox(height: 8),
        const _WordPressTile(size: 48),
        const SizedBox(height: 10),
        Text('No websites connected yet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
        const SizedBox(height: 4),
        Text(
          'Add a site to get its key, install the ArthaLeads plugin on that WordPress site and paste the key in. Its form enquiries then come straight into Leads.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12.5, color: t.textSoft),
        ),
        const SizedBox(height: 12),
        GradientButton(onPressed: () => _openForm(), icon: Icons.add_rounded, child: const Text('Add a site')),
        const SizedBox(height: 8),
      ]),
    );
  }

  Widget _siteCard(Map<String, dynamic> s) {
    final t = AppTheme.of(context);
    final ok = s['status'] == 'connected';
    final url = '${s['siteUrl'] ?? ''}';
    final forms = [for (final f in (s['connectedForms'] as List?) ?? const []) '$f'];
    return SoftSurface(
      radius: 18,
      padding: const EdgeInsets.all(14),
      border: _justAdded.contains(s['id']) ? Border.all(color: AppColors.primary.withValues(alpha: 0.55), width: 2) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _SiteIcon(site: s),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_siteTitle(s),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.text)),
              if (url.isNotEmpty)
                InkWell(
                  onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Flexible(
                      child: Text(_hostOf(url),
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: AppColors.primary)),
                    ),
                    const SizedBox(width: 3),
                    const Icon(Icons.open_in_new_rounded, size: 12, color: AppColors.primary),
                  ]),
                )
              else
                Text('Site address appears once the plugin is saved', style: TextStyle(fontSize: 11.5, color: t.textSoft)),
            ]),
          ),
          const SizedBox(width: 8),
          ok ? StatusPill.on('Connected') : StatusPill.warn('Waiting for plugin'),
        ]),
        const SizedBox(height: 10),
        KeyValueList([
          ('Last lead', s['lastSyncAt'] != null ? '${istTime(s['lastSyncAt'])} · ${agoText(s['lastSyncAt'])}' : 'None yet'),
          if (forms.isEmpty) ('Forms', ok ? 'Any form on the site' : '-'),
        ]),
        if (forms.isNotEmpty) ...[
          const SizedBox(height: 4),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final f in forms) Chip(label: Text(f, style: const TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact),
          ]),
        ],
        const SizedBox(height: 10),
        CopyField(
          label: 'Connection key',
          value: '${s['token'] ?? ''}',
          note: ok ? null : 'Paste this key into the ArthaLeads plugin on the site. This page updates by itself once it connects.',
        ),
        const SizedBox(height: 6),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          TextButton.icon(
            onPressed: () => _openForm(s),
            icon: const Icon(Icons.edit_rounded, size: 16),
            label: const Text('Edit'),
          ),
          TextButton.icon(
            onPressed: () => _remove(s),
            icon: const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.danger),
            label: const Text('Remove site', style: TextStyle(color: AppColors.danger)),
          ),
        ]),
      ]),
    );
  }

  List<Widget> _help() {
    final t = AppTheme.of(context);
    return [
      const PanelCard(
        title: 'Connect a WordPress site',
        child: SetupSteps([
          ('Add a site', 'Tap Add a site above, give it a name and copy its key.'),
          ('Install the plugin', 'In WordPress go to Plugins → Add New, search for ArthaLeads and install it. Or download the plugin here and use Upload Plugin.'),
          ('Open it', 'Activate it and open ArthaLeads CRM in the WordPress menu.'),
          ('Paste the key', "Paste the key into Account Token, enter the site's name and click Save."),
          ('Done', 'The site shows Connected here. Every form enquiry now comes into Leads.'),
        ]),
      ),
      const SizedBox(height: 12),
      PanelCard(
        title: 'Form plugins it reads',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final p in _formPlugins) Chip(label: Text(p, style: const TextStyle(fontSize: 11.5)), visualDensity: VisualDensity.compact),
          ]),
          const SizedBox(height: 8),
          Text(
            'Name, phone, email and message are picked up whatever the fields are called. Each lead keeps the page it was sent from, and the ad that brought the visitor when the link carried one.',
            style: TextStyle(fontSize: 12, color: t.textSoft),
          ),
          const SizedBox(height: 6),
          Text('One key per site. Removing a site here stops its leads; the plugin on that site will need a new key.',
              style: TextStyle(fontSize: 12, color: t.textSoft)),
        ]),
      ),
    ];
  }
}

class _WordPressTile extends StatelessWidget {
  final double size;
  const _WordPressTile({required this.size});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xFF21759B), borderRadius: BorderRadius.circular(size * 0.3)),
        child: FaIcon(FontAwesomeIcons.wordpress, color: Colors.white, size: size * 0.45),
      );
}

/// The site's favicon or logo, or the first letter of its name on a colour
/// picked from the name (web: SiteFavicon / LetterTile).
class _SiteIcon extends StatelessWidget {
  final Map<String, dynamic> site;
  const _SiteIcon({required this.site});

  @override
  Widget build(BuildContext context) {
    final url = '${site['siteIconUrl'] ?? ''}';
    final logo = site['siteIconKind'] == 'logo';
    // The first of these that is filled in (an empty siteName comes back as "").
    final letter = _Letter([site['siteName'], site['siteUrl'], site['name']].map((v) => '${v ?? ''}').firstWhere((v) => v.isNotEmpty, orElse: () => '?'));
    return Container(
      width: 44,
      height: 44,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: url.isEmpty
          ? letter
          : Padding(
              padding: EdgeInsets.all(logo ? 4 : 9),
              child: Image.network(url, fit: BoxFit.contain, errorBuilder: (_, _, _) => letter),
            ),
    );
  }
}

class _Letter extends StatelessWidget {
  final String name;
  const _Letter(this.name);

  @override
  Widget build(BuildContext context) {
    final text = name.replaceFirst(RegExp(r'^https?://', caseSensitive: false), '').replaceFirst(RegExp(r'^www\.', caseSensitive: false), '').trim();
    final letter = (RegExp(r'[a-z0-9]', caseSensitive: false).firstMatch(text)?.group(0) ?? '?').toUpperCase();
    var h = 0;
    for (final c in text.codeUnits) {
      h = (h * 31 + c) % 360;
    }
    return Container(
      alignment: Alignment.center,
      color: HSLColor.fromAHSL(1, h.toDouble(), 0.55, 0.48).toColor(),
      child: Text(letter, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17)),
    );
  }
}

/// Add a site (name and address, then its key) or edit one. After adding, the
/// key stays on screen so it can be copied before going to WordPress.
class _SiteForm extends StatefulWidget {
  final Map<String, dynamic>? site;
  const _SiteForm({this.site});

  @override
  State<_SiteForm> createState() => _SiteFormState();
}

class _SiteFormState extends State<_SiteForm> {
  late final _name = TextEditingController(text: widget.site == null ? '' : _siteTitle(widget.site!));
  late final _url = TextEditingController(text: '${widget.site?['siteUrl'] ?? ''}');
  bool _busy = false;
  String _error = '';
  Map<String, dynamic>? _created;

  bool get _editing => widget.site != null;

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Give the site a name.');
      return;
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    final api = ApiClient.instance;
    try {
      final body = {'name': _name.text.trim(), 'siteUrl': _url.text.trim()};
      if (_editing) {
        final r = await api.dio.patch('/automations/website/${widget.site!['id']}', data: body);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Site saved.')));
        Navigator.pop(context, (r.data['connection'] as Map).cast<String, dynamic>());
      } else {
        final r = await api.dio.post('/automations/website/create', data: body);
        setState(() => _created = (r.data['connection'] as Map).cast<String, dynamic>());
      }
    } catch (e) {
      setState(() => _error = ApiClient.errorMessage(e, 'Could not save. Try again.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final created = _created;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(created != null ? 'Site added' : (_editing ? 'Edit site' : 'Add a site'),
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: t.text)),
        const SizedBox(height: 12),
        if (created != null) ...[
          Text.rich(TextSpan(style: TextStyle(fontSize: 13, color: t.textSoft), children: [
            const TextSpan(text: 'Paste this key into the ArthaLeads plugin on '),
            TextSpan(text: '${created['name']}', style: TextStyle(fontWeight: FontWeight.w800, color: t.text)),
            const TextSpan(text: '. It turns Connected here once the plugin is saved.'),
          ])),
          const SizedBox(height: 12),
          CopyField(label: 'Connection key', value: '${created['token'] ?? ''}'),
          const SizedBox(height: 16),
          GradientButton(onPressed: () => Navigator.pop(context, created), child: const Text('Done')),
        ] else ...[
          TextField(
            controller: _name,
            autofocus: true,
            maxLength: 120,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Site name', hintText: 'e.g. Green Valley Homes'),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Website address (optional)', hintText: 'greenvalleyhomes.com'),
          ),
          const SizedBox(height: 4),
          Text("Used for the site's icon. The plugin fills it in when it connects.",
              style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          if (_editing) ...[
            const SizedBox(height: 6),
            Text('New leads from this site show this name as their source.',
                style: TextStyle(fontSize: 11.5, color: t.textSoft)),
          ],
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_error, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.danger)),
          ],
          const SizedBox(height: 16),
          GradientButton(
            onPressed: _busy ? null : _save,
            loading: _busy,
            child: Text(_editing ? 'Save' : 'Add site'),
          ),
        ],
      ]),
    );
  }
}
