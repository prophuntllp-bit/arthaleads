import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';

/// Add / edit a plain pipeline lead — POST /leads or PUT /leads/:id.
/// Project leads are edited via the detail sheet only, same as the web.
class LeadFormScreen extends StatefulWidget {
  final Map<String, dynamic>? lead;
  final List<Map<String, dynamic>> agents;

  const LeadFormScreen({super.key, this.lead, required this.agents});

  @override
  State<LeadFormScreen> createState() => _LeadFormScreenState();
}

class _LeadFormScreenState extends State<LeadFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.lead?['name'] as String? ?? '');
  late final _phone = TextEditingController(text: widget.lead?['phone'] as String? ?? '');
  late final _email = TextEditingController(text: widget.lead?['email'] as String? ?? '');
  late final _location = TextEditingController(text: widget.lead?['preferredLocation'] as String? ?? '');
  late final _requirements = TextEditingController(text: widget.lead?['requirements'] as String? ?? '');
  late final _budgetMin = TextEditingController(
      text: (widget.lead?['budget'] as Map?)?['min']?.toString() ?? '');
  late final _budgetMax = TextEditingController(
      text: (widget.lead?['budget'] as Map?)?['max']?.toString() ?? '');

  late String _source = widget.lead?['source'] as String? ?? 'Manual';
  late String _status = widget.lead?['status'] as String? ?? 'New';
  late String _priority = widget.lead?['priority'] as String? ?? 'Medium';
  late String _propertyType = widget.lead?['propertyType'] as String? ?? '';
  late String _bhk = widget.lead?['bhk'] as String? ?? '';
  late String _purpose = widget.lead?['purpose'] as String? ?? '';
  late String _assignedTo = widget.lead?['assignedTo'] is Map
      ? (widget.lead!['assignedTo'] as Map)['_id'] as String? ?? ''
      : widget.lead?['assignedTo'] as String? ?? '';

  bool _saving = false;

  bool get isEdit => widget.lead != null;

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _location, _requirements, _budgetMin, _budgetMax]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'name': _name.text.trim(),
      'phone': _phone.text.trim(),
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      'source': _source,
      'status': _status,
      'priority': _priority,
      if (_propertyType.isNotEmpty) 'propertyType': _propertyType,
      if (_bhk.isNotEmpty) 'bhk': _bhk,
      if (_purpose.isNotEmpty) 'purpose': _purpose,
      if (_location.text.trim().isNotEmpty) 'preferredLocation': _location.text.trim(),
      if (_requirements.text.trim().isNotEmpty) 'requirements': _requirements.text.trim(),
      if (_budgetMin.text.isNotEmpty || _budgetMax.text.isNotEmpty)
        'budget': {
          if (_budgetMin.text.isNotEmpty) 'min': num.tryParse(_budgetMin.text),
          if (_budgetMax.text.isNotEmpty) 'max': num.tryParse(_budgetMax.text),
        },
      if (_assignedTo.isNotEmpty) 'assignedTo': _assignedTo,
    };
    try {
      if (isEdit) {
        await ApiClient.instance.dio.put('/leads/${widget.lead!['_id']}', data: body);
      } else {
        await ApiClient.instance.dio.post('/leads', data: body);
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
      appBar: AppBar(title: Text(isEdit ? 'Edit Lead' : 'Add Lead')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field(_name, 'Name *', validator: (v) => v!.trim().isEmpty ? 'Required' : null),
            _field(_phone, 'Phone *',
                keyboard: TextInputType.phone,
                validator: (v) => v!.trim().isEmpty ? 'Required' : null),
            _field(_email, 'Email', keyboard: TextInputType.emailAddress),
            _dropdown('Source', sourceOptions, _source, (v) => setState(() => _source = v)),
            _dropdown('Status', statusOptions, _status, (v) => setState(() => _status = v)),
            _dropdown('Priority', priorityOptions, _priority, (v) => setState(() => _priority = v)),
            _dropdown('Property Type', propertyTypes, _propertyType,
                (v) => setState(() => _propertyType = v), allowEmpty: true),
            _dropdown('BHK', bhkOptions, _bhk, (v) => setState(() => _bhk = v), allowEmpty: true),
            _dropdown('Purpose', purposeOptions, _purpose, (v) => setState(() => _purpose = v),
                allowEmpty: true),
            _field(_location, 'Preferred Location'),
            Row(
              children: [
                Expanded(child: _field(_budgetMin, 'Budget Min', keyboard: TextInputType.number)),
                const SizedBox(width: 12),
                Expanded(child: _field(_budgetMax, 'Budget Max', keyboard: TextInputType.number)),
              ],
            ),
            _field(_requirements, 'Requirements', maxLines: 3),
            if (widget.agents.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: DropdownButtonFormField<String>(
                  initialValue: _assignedTo.isEmpty ? '' : _assignedTo,
                  decoration: const InputDecoration(labelText: 'Assign to', isDense: true),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Auto-assign')),
                    ...widget.agents.map((a) => DropdownMenuItem(
                          value: a['_id'] as String,
                          child: Text(a['name'] as String? ?? ''),
                        )),
                  ],
                  onChanged: (v) => setState(() => _assignedTo = v ?? ''),
                ),
              ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Lead')),
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

  Widget _dropdown(
    String label,
    List<String> options,
    String value,
    ValueChanged<String> onChanged, {
    bool allowEmpty = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DropdownButtonFormField<String>(
        initialValue: value.isEmpty && allowEmpty ? '' : (options.contains(value) ? value : options.first),
        decoration: InputDecoration(labelText: label, isDense: true),
        items: [
          if (allowEmpty) const DropdownMenuItem(value: '', child: Text('—')),
          ...options.map((o) => DropdownMenuItem(value: o, child: Text(o))),
        ],
        onChanged: (v) => onChanged(v ?? ''),
      ),
    );
  }
}
