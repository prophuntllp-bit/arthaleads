import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';

const _platformDefaults = {
  'Google': ('/api/leads', 'Use this endpoint from Google Ads landing pages or lead form bridges.'),
  'WhatsApp': ('/api/leads', 'Push WhatsApp enquiries into the lead API with source set to WhatsApp.'),
  'Website Form': ('/api/leads', 'Connect website or landing page forms to the lead create API.'),
  'Custom': ('/api/leads', 'Use a custom data source and map it into your CRM lead fields.'),
};

const _serverBase = 'https://api.arthaleads.com';

/// Add / edit a non-Facebook lead source (Google, WhatsApp, Website, Custom).
/// Facebook requires a browser OAuth round-trip and stays web-only; editing
/// an existing Facebook connection here is limited to name/page/form.
class AutomationFormScreen extends StatefulWidget {
  final Map<String, dynamic>? automation;

  const AutomationFormScreen({super.key, this.automation});

  @override
  State<AutomationFormScreen> createState() => _AutomationFormScreenState();
}

class _AutomationFormScreenState extends State<AutomationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.automation?['name'] as String? ?? '');
  late final _description = TextEditingController(text: widget.automation?['description'] as String? ?? '');
  late final _leadSourceLabel = TextEditingController(text: widget.automation?['leadSourceLabel'] as String? ?? '');
  late final _pageId = TextEditingController(text: widget.automation?['pageId'] as String? ?? '');
  late final _formId = TextEditingController(text: widget.automation?['formId'] as String? ?? '');
  late String _platform = widget.automation?['platform'] as String? ?? 'Google';
  bool _saving = false;

  bool get _isEdit => widget.automation != null;
  bool get _isFacebook => _platform == 'Facebook';

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _leadSourceLabel.dispose();
    _pageId.dispose();
    _formId.dispose();
    super.dispose();
  }

  String get _webhookPath =>
      widget.automation?['webhookPath'] as String? ?? _platformDefaults[_platform]?.$1 ?? '/api/leads';

  String get _endpoint => '$_serverBase$_webhookPath';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'name': _name.text.trim(),
      if (!_isEdit) 'platform': _platform,
      if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
      if (_leadSourceLabel.text.trim().isNotEmpty) 'leadSourceLabel': _leadSourceLabel.text.trim(),
      if (_isFacebook) 'pageId': _pageId.text.trim(),
      if (_isFacebook) 'formId': _formId.text.trim(),
    };
    try {
      if (_isEdit) {
        await ApiClient.instance.dio.patch('/automations/${widget.automation!['_id']}', data: body);
      } else {
        await ApiClient.instance.dio.post('/automations', data: body);
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
      appBar: AppBar(title: Text(_isEdit ? 'Edit Source' : 'Add Lead Source')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (!_isEdit)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: DropdownButtonFormField<String>(
                  initialValue: _platform,
                  decoration: const InputDecoration(labelText: 'Platform', isDense: true),
                  items: _platformDefaults.keys
                      .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                      .toList(),
                  onChanged: (v) => setState(() => _platform = v ?? 'Google'),
                ),
              )
            else if (_isFacebook)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text('Facebook connections only allow editing name, page, and form here — '
                    'reconnecting/OAuth stays on the web app.',
                    style: TextStyle(fontSize: 12, color: AppColors.warning)),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name *', isDense: true),
                validator: (v) => v!.trim().isEmpty ? 'Required' : null,
              ),
            ),
            if (_isFacebook) ...[
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: TextFormField(
                  controller: _pageId,
                  decoration: const InputDecoration(labelText: 'Facebook Page ID', isDense: true),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: TextFormField(
                  controller: _formId,
                  decoration: const InputDecoration(labelText: 'Lead Form ID', isDense: true),
                ),
              ),
            ] else ...[
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: TextFormField(
                  controller: _leadSourceLabel,
                  decoration: InputDecoration(
                    labelText: 'Lead Source Label',
                    hintText: _platformDefaults[_platform]?.$1 == null ? '' : _platform,
                    isDense: true,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: TextFormField(
                  controller: _description,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Description',
                    hintText: _platformDefaults[_platform]?.$2 ?? '',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardTheme.color,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Theme.of(context).dividerTheme.color ?? Colors.transparent),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Endpoint', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: Text(_endpoint,
                              style: const TextStyle(fontSize: 12, color: AppColors.primary),
                              overflow: TextOverflow.ellipsis),
                        ),
                        IconButton(
                          icon: const Icon(Icons.copy, size: 16),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: _endpoint));
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied')));
                          },
                        ),
                      ],
                    ),
                    Text(
                      'POST leads to this endpoint with source set to ${_leadSourceLabel.text.trim().isNotEmpty ? _leadSourceLabel.text.trim() : _platform}.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            GradientButton(
              fullWidth: true,
              loading: _saving,
              onPressed: _saving ? null : _save,
              child: Text(_isEdit ? 'Save Changes' : 'Add Source'),
            ),
          ],
        ),
      ),
    );
  }
}
