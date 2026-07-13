import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';

/// Add / edit a lead. Plain leads: POST /leads or PUT /leads/:id (full field set).
/// Project leads: PATCH /projects/:pid/leads/:id — ProjectLead only stores a reduced
/// field set (name/phone/email/source/status), so the form hides the rest for those.
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
  late final _streetAddress = TextEditingController(text: widget.lead?['streetAddress'] as String? ?? '');
  late final _city = TextEditingController(text: widget.lead?['city'] as String? ?? '');
  late final _requirements = TextEditingController(text: widget.lead?['requirements'] as String? ?? '');
  late final _followUpNote = TextEditingController(text: widget.lead?['followUpNote'] as String? ?? '');
  late final _budgetMin = TextEditingController(
      text: (widget.lead?['budget'] as Map?)?['min']?.toString() ?? '');
  late final _budgetMax = TextEditingController(
      text: (widget.lead?['budget'] as Map?)?['max']?.toString() ?? '');
  late DateTime? _followUpDate = DateTime.tryParse(widget.lead?['followUpDate'] as String? ?? '');

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
  bool get _isProjectLead => widget.lead?['_type'] == 'project' && widget.lead?['projectId'] != null;

  @override
  void dispose() {
    for (final c in [
      _name, _phone, _email, _location, _streetAddress, _city,
      _requirements, _followUpNote, _budgetMin, _budgetMax,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    if (_isProjectLead) {
      final body = {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'source': _source,
        'status': _status,
      };
      try {
        await ApiClient.instance.dio
            .patch('/projects/${widget.lead!['projectId']}/leads/${widget.lead!['_id']}', data: body);
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
      return;
    }
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
      if (_streetAddress.text.trim().isNotEmpty) 'streetAddress': _streetAddress.text.trim(),
      if (_city.text.trim().isNotEmpty) 'city': _city.text.trim(),
      if (_requirements.text.trim().isNotEmpty) 'requirements': _requirements.text.trim(),
      'followUpDate': _followUpDate?.toIso8601String(),
      if (_followUpNote.text.trim().isNotEmpty) 'followUpNote': _followUpNote.text.trim(),
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
            if (!_isProjectLead) ...[
              _dropdown('Priority', priorityOptions, _priority, (v) => setState(() => _priority = v)),
              _dropdown('Property Type', propertyTypes, _propertyType,
                  (v) => setState(() => _propertyType = v), allowEmpty: true),
              _dropdown('BHK', bhkOptions, _bhk, (v) => setState(() => _bhk = v), allowEmpty: true),
              _dropdown('Purpose', purposeOptions, _purpose, (v) => setState(() => _purpose = v),
                  allowEmpty: true),
              _field(_location, 'Preferred Location'),
              _field(_streetAddress, 'Street Address'),
              _field(_city, 'City'),
              Row(
                children: [
                  Expanded(child: _field(_budgetMin, 'Budget Min', keyboard: TextInputType.number)),
                  const SizedBox(width: 12),
                  Expanded(child: _field(_budgetMax, 'Budget Max', keyboard: TextInputType.number)),
                ],
              ),
              _field(_requirements, 'Requirements', maxLines: 3),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: InkWell(
                  onTap: _pickFollowUpDate,
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Follow-up Date', isDense: true),
                    child: Text(_followUpDate == null
                        ? 'Not set'
                        : DateFormat('dd MMM yyyy').format(_followUpDate!)),
                  ),
                ),
              ),
              _field(_followUpNote, 'Follow-up Note', maxLines: 2),
            ],
            if (!_isProjectLead && widget.agents.isNotEmpty)
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

  Future<void> _pickFollowUpDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _followUpDate ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (date != null) setState(() => _followUpDate = date);
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
