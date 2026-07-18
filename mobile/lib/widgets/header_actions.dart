import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../screens/leads/lead_detail_sheet.dart';
import 'chips.dart';
import 'motion.dart';

const _alertsSeenKey = 'crm_alerts_seen';
const _secureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

Future<List<Map<String, dynamic>>> _fetchProjectsForSheet() async {
  try {
    final res = await ApiClient.instance.dio.get('/projects');
    return (res.data['data'] as List? ?? []).cast<Map<String, dynamic>>();
  } catch (_) {
    return [];
  }
}

Future<void> _openLeadFromResult(
  BuildContext context,
  Map<String, dynamic> lead,
) async {
  final projects = await _fetchProjectsForSheet();
  if (!context.mounted) return;
  await showModalBottomSheet<dynamic>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) =>
        LeadDetailSheet(lead: lead, projects: projects, onUpdated: (_) {}),
  );
}

/// Header search icon — mirrors the web's inline lead search (GET /leads/unified).
class HeaderSearchButton extends StatelessWidget {
  const HeaderSearchButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Search leads',
      icon: const Icon(Icons.search_rounded),
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        // The AppBar's own context outlives the sheet, so lead-detail
        // navigation triggered after this sheet pops stays valid.
        builder: (_) => _SearchSheet(rootContext: context),
      ),
    );
  }
}

class _SearchSheet extends StatefulWidget {
  final BuildContext rootContext;

  const _SearchSheet({required this.rootContext});

  @override
  State<_SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends State<_SearchSheet> {
  final _ctrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _query = value.trim();
    if (_query.length < 2) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), _search);
  }

  Future<void> _search() async {
    if (_query.length < 2) return;
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.dio.get(
        '/leads/unified',
        queryParameters: {'search': _query, 'limit': 7, 'page': 1},
      );
      if (!mounted) return;
      setState(
        () => _results = (res.data['leads'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
    } catch (_) {
      if (mounted) setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Search Leads', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            onChanged: _onChanged,
            decoration: InputDecoration(
              hintText: 'Search name, phone, email…',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: AppSpinner(size: 16),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.5,
            ),
            child: _results.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      _query.length < 2
                          ? 'Type at least 2 characters'
                          : 'No matching leads',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: _results.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final lead = _results[i];
                      final name = lead['name'] as String? ?? '—';
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withValues(
                            alpha: 0.15,
                          ),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(
                          name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(lead['phone'] as String? ?? ''),
                        trailing: StatusChip(lead['status'] as String?),
                        onTap: () {
                          Navigator.pop(context);
                          _openLeadFromResult(widget.rootContext, lead);
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Header notification bell — mirrors web's "New Lead Alerts" panel (GET /leads/alerts).
class HeaderAlertsButton extends StatefulWidget {
  const HeaderAlertsButton({super.key});

  @override
  State<HeaderAlertsButton> createState() => _HeaderAlertsButtonState();
}

class _HeaderAlertsButtonState extends State<HeaderAlertsButton> {
  List<Map<String, dynamic>> _alerts = [];
  int _unseen = 0;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.dio.get('/leads/alerts');
      final alerts = (res.data['data'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      final seenAt = await _secureStorage.read(key: _alertsSeenKey);
      final seenTime = seenAt != null ? DateTime.tryParse(seenAt) : null;
      final unseen = seenTime == null
          ? alerts.length
          : alerts.where((a) {
              final created = DateTime.tryParse(
                a['createdAt'] as String? ?? '',
              );
              return created != null && created.isAfter(seenTime);
            }).length;
      if (!mounted) return;
      setState(() {
        _alerts = alerts;
        _unseen = unseen;
      });
    } catch (_) {
      // Leave alerts empty on failure — bell simply shows no badge.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open() async {
    // This button's own context outlives the sheet, so lead-detail
    // navigation triggered after the sheet pops stays valid.
    final rootContext = context;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _AlertsSheet(
        alerts: _alerts,
        loading: _loading,
        rootContext: rootContext,
      ),
    );
    await _secureStorage.write(
      key: _alertsSeenKey,
      value: DateTime.now().toIso8601String(),
    );
    if (mounted) setState(() => _unseen = 0);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          tooltip: 'New lead alerts',
          icon: const Icon(Icons.notifications_none_rounded),
          onPressed: _open,
        ),
        if (_unseen > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 16),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                _unseen > 9 ? '9+' : '$_unseen',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _AlertsSheet extends StatelessWidget {
  final List<Map<String, dynamic>> alerts;
  final bool loading;
  final BuildContext rootContext;

  const _AlertsSheet({
    required this.alerts,
    required this.loading,
    required this.rootContext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('New Lead Alerts', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Leads created in the last 7 days',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.55,
            ),
            child: alerts.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Text('No new leads recently'),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: alerts.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final lead = alerts[i];
                      final created = DateTime.tryParse(
                        lead['createdAt'] as String? ?? '',
                      );
                      return ListTile(
                        title: Text(
                          lead['name'] as String? ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          [
                            lead['phone'] as String? ?? '',
                            if ((lead['source'] as String? ?? '').isNotEmpty)
                              lead['source'] as String,
                          ].join(' · '),
                        ),
                        trailing: created != null
                            ? Text(
                                DateFormat('d MMM, h:mm a').format(created),
                                style: Theme.of(context).textTheme.bodySmall,
                              )
                            : null,
                        onTap: () {
                          Navigator.pop(context);
                          _openLeadFromResult(rootContext, lead);
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
