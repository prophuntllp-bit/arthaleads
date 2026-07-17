import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';

/// Add/edit project form with the same structured fields and image workflow as
/// the web app. Photos are resized/compressed on-device and sent as data URLs.
class ProjectFormScreen extends StatefulWidget {
  final Map<String, dynamic>? project;
  final List<Map<String, dynamic>> agents;

  const ProjectFormScreen({super.key, this.project, required this.agents});

  @override
  State<ProjectFormScreen> createState() => _ProjectFormScreenState();
}

class _ProjectFormScreenState extends State<ProjectFormScreen> {
  static const _bhkOptions = [
    '1BHK',
    '2BHK',
    '3BHK',
    '4BHK',
    '4BHK+',
    'Studio',
    'Duplex',
    'Penthouse',
  ];
  static const _amenityOptions = [
    'Swimming Pool',
    'Gymnasium',
    'Clubhouse',
    '24/7 Security',
    'CCTV Surveillance',
    'Covered Parking',
    'Visitor Parking',
    'Lift / Elevator',
    'Power Backup',
    '24/7 Water Supply',
    'Garden / Landscape',
    "Children's Play Area",
    'Sports Facility',
    'Jogging Track',
    'Intercom',
    'Fire Safety',
    'Rainwater Harvesting',
    'Solar Panels',
    'EV Charging',
    'Shopping Complex',
    'School Nearby',
    'Hospital Nearby',
    'Metro Connectivity',
    'Vastu Compliant',
  ];

  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(
    text: widget.project?['name'] as String? ?? '',
  );
  late final _description = TextEditingController(
    text: widget.project?['description'] as String? ?? '',
  );
  late final _location = TextEditingController(
    text: widget.project?['location'] as String? ?? '',
  );
  late final _priceMin = TextEditingController(
    text: (widget.project?['priceMin'] as num?)?.toString() ?? '',
  );
  late final _priceMax = TextEditingController(
    text: (widget.project?['priceMax'] as num?)?.toString() ?? '',
  );
  late final _area = TextEditingController(
    text: widget.project?['area'] as String? ?? '',
  );
  late final _reraNumber = TextEditingController(
    text: widget.project?['reraNumber'] as String? ?? '',
  );
  final _imageUrl = TextEditingController();
  final _customAmenity = TextEditingController();

  late final Set<String> _bhkTypes =
      ((widget.project?['bhkTypes'] as List?) ?? [])
          .map((e) => e.toString())
          .toSet();
  late final List<String> _amenities =
      ((widget.project?['amenities'] as List?) ?? [])
          .map((e) => e.toString())
          .toList();
  late final List<String> _images = ((widget.project?['images'] as List?) ?? [])
      .map((e) => e.toString())
      .toList();
  late final Set<String> _assignedTo =
      ((widget.project?['assignedTo'] as List?) ?? [])
          .map((a) => a is Map ? a['_id'].toString() : a.toString())
          .toSet();
  late DateTime? _possessionDate = DateTime.tryParse(
    widget.project?['possessionDate']?.toString() ?? '',
  );

  bool _saving = false;
  bool _pickingImages = false;
  bool get isEdit => widget.project != null;

  @override
  void dispose() {
    for (final c in [
      _name,
      _description,
      _location,
      _priceMin,
      _priceMax,
      _area,
      _reraNumber,
      _imageUrl,
      _customAmenity,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImages() async {
    final remaining = 5 - _images.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A project can have up to 5 photos.')),
      );
      return;
    }
    setState(() => _pickingImages = true);
    try {
      final picked = await ImagePicker().pickMultiImage(
        imageQuality: 60,
        maxWidth: 640,
        maxHeight: 640,
        limit: remaining,
      );
      final additions = <String>[];
      for (final file in picked.take(remaining)) {
        additions.add(
          'data:image/jpeg;base64,${base64Encode(await file.readAsBytes())}',
        );
      }
      if (mounted) {
        setState(() => _images.addAll(additions));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not add photos: $e')));
      }
    } finally {
      if (mounted) setState(() => _pickingImages = false);
    }
  }

  void _addImageUrl() {
    final value = _imageUrl.text.trim();
    if (value.isEmpty || _images.length >= 5) return;
    setState(() {
      _images.add(value);
      _imageUrl.clear();
    });
  }

  void _addAmenity(String value) {
    final cleaned = value.trim();
    if (cleaned.isEmpty || _amenities.contains(cleaned)) return;
    setState(() {
      _amenities.add(cleaned);
      _customAmenity.clear();
    });
  }

  Future<void> _pickPossessionDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _possessionDate ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 7300)),
    );
    if (picked != null) setState(() => _possessionDate = picked);
  }

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
      'possessionDate': _possessionDate == null
          ? null
          : DateFormat('yyyy-MM-dd').format(_possessionDate!),
      'bhkTypes': _bhkTypes.toList(),
      'amenities': _amenities,
      'images': _images,
      'assignedTo': _assignedTo.toList(),
    };
    try {
      if (isEdit) {
        await ApiClient.instance.dio.put(
          '/projects/${widget.project!['_id']}',
          data: body,
        );
      } else {
        await ApiClient.instance.dio.post('/projects', data: body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Save failed')),
            backgroundColor: AppColors.danger,
          ),
        );
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
            _sectionTitle('Project details'),
            _field(
              _name,
              'Name *',
              validator: (v) => v!.trim().isEmpty ? 'Required' : null,
            ),
            _field(_location, 'Location'),
            _field(_description, 'Description', maxLines: 3),
            Row(
              children: [
                Expanded(
                  child: _field(
                    _priceMin,
                    'Price Min',
                    keyboard: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    _priceMax,
                    'Price Max',
                    keyboard: TextInputType.number,
                  ),
                ),
              ],
            ),
            _field(_area, 'Area (e.g. 1200–1800 sq ft)'),
            _field(_reraNumber, 'RERA Number'),
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              leading: const Icon(Icons.event_available_outlined),
              title: const Text('Possession date'),
              subtitle: Text(
                _possessionDate == null
                    ? 'Not specified'
                    : DateFormat('dd MMM yyyy').format(_possessionDate!),
              ),
              trailing: _possessionDate == null
                  ? null
                  : IconButton(
                      onPressed: () => setState(() => _possessionDate = null),
                      icon: const Icon(Icons.close),
                    ),
              onTap: _pickPossessionDate,
            ),
            _sectionTitle('BHK types'),
            Wrap(
              spacing: 7,
              runSpacing: 4,
              children: _bhkOptions
                  .map(
                    (value) => FilterChip(
                      label: Text(value),
                      selected: _bhkTypes.contains(value),
                      onSelected: (selected) => setState(
                        () => selected
                            ? _bhkTypes.add(value)
                            : _bhkTypes.remove(value),
                      ),
                    ),
                  )
                  .toList(),
            ),
            _sectionTitle('Amenities'),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Select amenity'),
              items: _amenityOptions
                  .where((a) => !_amenities.contains(a))
                  .map((a) => DropdownMenuItem(value: a, child: Text(a)))
                  .toList(),
              onChanged: (value) {
                if (value != null) _addAmenity(value);
              },
            ),
            Row(
              children: [
                Expanded(child: _field(_customAmenity, 'Custom amenity')),
                IconButton.filledTonal(
                  onPressed: () => _addAmenity(_customAmenity.text),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            if (_amenities.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 3,
                children: _amenities
                    .map(
                      (a) => InputChip(
                        label: Text(a),
                        onDeleted: () => setState(() => _amenities.remove(a)),
                      ),
                    )
                    .toList(),
              ),
            _sectionTitle('Project photos (${_images.length}/5)'),
            OutlinedButton.icon(
              onPressed: _pickingImages || _images.length >= 5
                  ? null
                  : _pickImages,
              icon: _pickingImages
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_photo_alternate_outlined),
              label: Text(
                _pickingImages
                    ? 'Preparing photos…'
                    : 'Choose photos from phone',
              ),
            ),
            Row(
              children: [
                Expanded(child: _field(_imageUrl, 'Or paste image URL')),
                IconButton.filledTonal(
                  onPressed: _images.length >= 5 ? null : _addImageUrl,
                  icon: const Icon(Icons.add_link),
                ),
              ],
            ),
            if (_images.isNotEmpty)
              SizedBox(
                height: 104,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _images.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) =>
                      _imagePreview(_images[index], index),
                ),
              ),
            if (widget.agents.isNotEmpty) ...[
              _sectionTitle('Assign agents'),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: widget.agents.map((a) {
                  final id = a['_id'].toString();
                  return FilterChip(
                    label: Text(a['name'] as String? ?? ''),
                    selected: _assignedTo.contains(id),
                    onSelected: (selected) => setState(
                      () => selected
                          ? _assignedTo.add(id)
                          : _assignedTo.remove(id),
                    ),
                  );
                }).toList(),
              ),
              if (_assignedTo.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'No agents assigned — agents will not see this project.',
                    style: TextStyle(color: AppColors.warning, fontSize: 12),
                  ),
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

  Widget _imagePreview(String value, int index) {
    Widget image;
    if (value.startsWith('data:image') && value.contains(',')) {
      try {
        image = Image.memory(
          base64Decode(value.split(',').last),
          fit: BoxFit.cover,
        );
      } catch (_) {
        image = const Icon(Icons.broken_image_outlined);
      }
    } else {
      image = Image.network(
        value,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined),
      );
    }
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(width: 112, height: 96, child: image),
        ),
        Positioned(
          right: 3,
          top: 3,
          child: IconButton.filled(
            tooltip: 'Remove photo',
            iconSize: 16,
            constraints: const BoxConstraints.tightFor(width: 30, height: 30),
            onPressed: () => setState(() => _images.removeAt(index)),
            icon: const Icon(Icons.close),
          ),
        ),
      ],
    );
  }

  Widget _sectionTitle(String text) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 5),
    child: Text(
      text,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(
        color: AppColors.primary,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

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
