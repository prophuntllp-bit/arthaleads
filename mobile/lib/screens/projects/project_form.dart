import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';

/// Add / edit a project — POST /projects or PUT /projects/:id.
/// Images/amenities/BHK types are entered as comma-separated lists rather
/// than a full upload flow, matching the model's plain string-array fields.
class ProjectFormScreen extends StatefulWidget {
  final Map<String, dynamic>? project;
  final List<Map<String, dynamic>> agents;

  const ProjectFormScreen({super.key, this.project, required this.agents});

  @override
  State<ProjectFormScreen> createState() => _ProjectFormScreenState();
}

class _ProjectFormScreenState extends State<ProjectFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.project?['name'] as String? ?? '');
  late final _description = TextEditingController(text: widget.project?['description'] as String? ?? '');
  late final _location = TextEditingController(text: widget.project?['location'] as String? ?? '');
  late final _priceMin = TextEditingController(text: (widget.project?['priceMin'] as num?)?.toString() ?? '');
  late final _priceMax = TextEditingController(text: (widget.project?['priceMax'] as num?)?.toString() ?? '');
  late final _area = TextEditingController(text: widget.project?['area'] as String? ?? '');
  late final _reraNumber = TextEditingController(text: widget.project?['reraNumber'] as String? ?? '');
  late final _bhkTypes = TextEditingController(
      text: ((widget.project?['bhkTypes'] as List?) ?? []).join(', '));
  late final _amenities = TextEditingController(
      text: ((widget.project?['amenities'] as List?) ?? []).join(', '));
  late final _images = TextEditingController(
      text: ((widget.project?['images'] as List?) ?? []).join(', '));
  late Set<String> _assignedTo = ((widget.project?['assignedTo'] as List?) ?? [])
      .map((a) => a is Map ? a['_id'] as String : a as String)
      .toSet();

  bool _saving = false;
  bool get isEdit => widget.project != null;

  @override
  void dispose() {
    for (final c in [_name, _description, _location, _priceMin, _priceMax, _area, _reraNumber, _bhkTypes, _amenities, _images]) {
      c.dispose();
    }
    super.dispose();
  }

  List<String> _split(String s) =>
      s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'location': _location.text.trim(),
      'priceMin': num.tryParse(_priceMin.text) ?? 0,
      'priceMax': num.tryParse(_priceMax.text) ?? 0,
      'area': _area.text.trim(),
      'reraNumber': _reraNumber.text.trim(),
      'bhkTypes': _split(_bhkTypes.text),
      'amenities': _split(_amenities.text),
      'images': _split(_images.text),
      'assignedTo': _assignedTo.toList(),
    };
    try {
      if (isEdit) {
        await ApiClient.instance.dio.put('/projects/${widget.project!['_id']}', data: body);
      } else {
        await ApiClient.instance.dio.post('/projects', data: body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Save failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(isEdit ? 'Edit Project' : 'Add Project')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field(_name, 'Name *', validator: (v) => v!.trim().isEmpty ? 'Required' : null),
            _field(_location, 'Location'),
            _field(_description, 'Description', maxLines: 3),
            Row(
              children: [
                Expanded(child: _field(_priceMin, 'Price Min', keyboard: TextInputType.number)),
                const SizedBox(width: 12),
                Expanded(child: _field(_priceMax, 'Price Max', keyboard: TextInputType.number)),
              ],
            ),
            _field(_area, 'Area (e.g. 1200–1800 sq ft)'),
            _field(_bhkTypes, 'BHK Types (comma-separated, e.g. 2BHK, 3BHK)'),
            _field(_amenities, 'Amenities (comma-separated)'),
            _field(_images, 'Image URLs (comma-separated)'),
            _field(_reraNumber, 'RERA Number'),
            if (widget.agents.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Assign Agents', style: Theme.of(context).textTheme.labelLarge),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: widget.agents.map((a) {
                  final id = a['_id'] as String;
                  final selected = _assignedTo.contains(id);
                  return FilterChip(
                    label: Text(a['name'] as String? ?? ''),
                    selected: selected,
                    onSelected: (v) => setState(() => v ? _assignedTo.add(id) : _assignedTo.remove(id)),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 20),
            GradientButton(
              fullWidth: true,
              loading: _saving,
              onPressed: _saving ? null : _save,
              child: Text(isEdit ? 'Save Changes' : 'Add Project'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController ctrl,
    String label, {
    TextInputType? keyboard,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        maxLines: maxLines,
        validator: validator,
        decoration: InputDecoration(labelText: label, isDense: true),
      ),
    );
  }
}
