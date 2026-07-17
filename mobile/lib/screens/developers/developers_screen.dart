import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

class DevelopersScreen extends StatefulWidget {
  const DevelopersScreen({super.key});

  @override
  State<DevelopersScreen> createState() => _DevelopersScreenState();
}

class _DevelopersScreenState extends State<DevelopersScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _developers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/developers');
      if (mounted) {
        setState(
          () => _developers = (res.data['data'] as List? ?? [])
              .cast<Map<String, dynamic>>(),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load developers'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(Map<String, dynamic> developer) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove developer?'),
        content: Text(
          'Remove ${developer['name']}? Existing bookings and invoices will not be affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.dio.delete('/developers/${developer['_id']}');
      setState(() => _developers.remove(developer));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Remove failed'))),
        );
      }
    }
  }

  Future<void> _openForm([Map<String, dynamic>? developer]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.of(context).surfaceSolid,
      builder: (_) => _DeveloperForm(developer: developer),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: AppSpinner(size: 32));
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add),
        label: const Text('Add Developer'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _developers.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 180),
                  Icon(Icons.apartment_outlined, size: 54),
                  Center(child: Text('No developers added yet')),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                itemCount: _developers.length,
                itemBuilder: (context, index) {
                  final d = _developers[index];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              _logo(d['logo']?.toString() ?? ''),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      d['name']?.toString() ?? 'Developer',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    if ((d['address']?.toString() ?? '')
                                        .isNotEmpty)
                                      Text(
                                        d['address'].toString(),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodySmall,
                                      ),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => _openForm(d),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                              IconButton(
                                onPressed: () => _remove(d),
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: AppColors.danger,
                                ),
                              ),
                            ],
                          ),
                          const Divider(),
                          Wrap(
                            spacing: 14,
                            runSpacing: 5,
                            children: [
                              if ((d['pan']?.toString() ?? '').isNotEmpty)
                                Text(
                                  'PAN: ${d['pan']}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              if ((d['gstNo']?.toString() ?? '').isNotEmpty)
                                Text(
                                  'GST: ${d['gstNo']}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              Text(
                                'Brokerage: ${d['defaultBrokeragePercent'] ?? 2}%',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              Text(
                                'Template: ${d['invoiceTemplate'] ?? 'detailed'}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                          if ((d['reraNumbers'] as List? ?? []).isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Wrap(
                                spacing: 5,
                                children: (d['reraNumbers'] as List)
                                    .map(
                                      (r) => Chip(
                                        label: Text(
                                          r.toString(),
                                          style: const TextStyle(fontSize: 10),
                                        ),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  Widget _logo(String value) {
    if (value.isEmpty) {
      return const SizedBox(
        width: 48,
        height: 42,
        child: Icon(Icons.apartment_outlined),
      );
    }
    if (value.startsWith('data:image') && value.contains(',')) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(
          base64Decode(value.split(',').last),
          width: 48,
          height: 42,
          fit: BoxFit.contain,
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        value,
        width: 48,
        height: 42,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => const Icon(Icons.apartment_outlined),
      ),
    );
  }
}

class _DeveloperForm extends StatefulWidget {
  final Map<String, dynamic>? developer;
  const _DeveloperForm({this.developer});

  @override
  State<_DeveloperForm> createState() => _DeveloperFormState();
}

class _DeveloperFormState extends State<_DeveloperForm> {
  late final Map<String, TextEditingController> _c = {
    for (final field in ['name', 'address', 'pan', 'cin', 'gstNo'])
      field: TextEditingController(
        text: widget.developer?[field]?.toString() ?? '',
      ),
    'brokerage': TextEditingController(
      text: widget.developer?['defaultBrokeragePercent']?.toString() ?? '2',
    ),
    'fos': TextEditingController(
      text: widget.developer?['defaultFosIncentive']?.toString() ?? '0',
    ),
    'eoi': TextEditingController(
      text: widget.developer?['defaultEoiIncentive']?.toString() ?? '0',
    ),
    'rera': TextEditingController(),
  };
  late final List<String> _rera =
      (widget.developer?['reraNumbers'] as List? ?? [])
          .map((e) => e.toString())
          .toList();
  late String _template =
      widget.developer?['invoiceTemplate']?.toString() ?? 'detailed';
  late String _logo = widget.developer?['logo']?.toString() ?? '';
  bool _saving = false;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickLogo() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 400,
      maxHeight: 400,
    );
    if (file != null) {
      final bytes = await file.readAsBytes();
      if (mounted) {
        setState(() => _logo = 'data:image/jpeg;base64,${base64Encode(bytes)}');
      }
    }
  }

  Future<void> _save() async {
    if (_c['name']!.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final body = {
      'name': _c['name']!.text.trim(),
      'address': _c['address']!.text.trim(),
      'pan': _c['pan']!.text.trim().toUpperCase(),
      'cin': _c['cin']!.text.trim().toUpperCase(),
      'gstNo': _c['gstNo']!.text.trim().toUpperCase(),
      'logo': _logo,
      'reraNumbers': _rera,
      'defaultBrokeragePercent': num.tryParse(_c['brokerage']!.text) ?? 2,
      'defaultFosIncentive': num.tryParse(_c['fos']!.text) ?? 0,
      'defaultEoiIncentive': num.tryParse(_c['eoi']!.text) ?? 0,
      'invoiceTemplate': _template,
    };
    try {
      if (widget.developer == null) {
        await ApiClient.instance.dio.post('/developers', data: body);
      } else {
        await ApiClient.instance.dio.put(
          '/developers/${widget.developer!['_id']}',
          data: body,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Save failed'))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: .92,
    builder: (context, scroll) => ListView(
      controller: scroll,
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.developer == null ? 'Add Developer' : 'Edit Developer',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        Center(
          child: OutlinedButton.icon(
            onPressed: _pickLogo,
            icon: const Icon(Icons.upload),
            label: Text(_logo.isEmpty ? 'Upload Logo' : 'Change Logo'),
          ),
        ),
        if (_logo.isNotEmpty)
          Center(
            child: TextButton(
              onPressed: () => setState(() => _logo = ''),
              child: const Text('Remove logo'),
            ),
          ),
        _field('name', 'Developer / Builder Name *'),
        _field('address', 'Address', lines: 2),
        Row(
          children: [
            Expanded(child: _field('pan', 'PAN')),
            const SizedBox(width: 8),
            Expanded(child: _field('gstNo', 'GST No.')),
          ],
        ),
        _field('cin', 'CIN'),
        Row(
          children: [
            Expanded(child: _field('rera', 'Add RERA number')),
            IconButton.filledTonal(
              onPressed: () {
                final v = _c['rera']!.text.trim();
                if (v.isNotEmpty && !_rera.contains(v)) {
                  setState(() {
                    _rera.add(v);
                    _c['rera']!.clear();
                  });
                }
              },
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        Wrap(
          spacing: 5,
          children: _rera
              .map(
                (r) => InputChip(
                  label: Text(r),
                  onDeleted: () => setState(() => _rera.remove(r)),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _field('brokerage', 'Brokerage %', number: true)),
            const SizedBox(width: 8),
            Expanded(child: _field('fos', 'FOS Incentive', number: true)),
            const SizedBox(width: 8),
            Expanded(child: _field('eoi', 'EOI Incentive', number: true)),
          ],
        ),
        DropdownButtonFormField<String>(
          initialValue: _template,
          decoration: const InputDecoration(labelText: 'Invoice Template'),
          items: const [
            DropdownMenuItem(value: 'detailed', child: Text('Detailed')),
            DropdownMenuItem(value: 'simple', child: Text('Simple')),
          ],
          onChanged: (v) => _template = v ?? 'detailed',
        ),
        const SizedBox(height: 20),
        GradientButton(
          fullWidth: true,
          loading: _saving,
          onPressed: _saving ? null : _save,
          child: Text(
            widget.developer == null ? 'Add Developer' : 'Save Changes',
          ),
        ),
      ],
    ),
  );

  Widget _field(
    String key,
    String label, {
    int lines = 1,
    bool number = false,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: TextField(
      controller: _c[key],
      maxLines: lines,
      keyboardType: number ? TextInputType.number : null,
      decoration: InputDecoration(labelText: label),
    ),
  );
}
