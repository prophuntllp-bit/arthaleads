import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';

/// Settings — profile editing via PUT /auth/me. Mirrors the "My Profile"
/// section of frontend/src/pages/Settings.jsx; org billing/branding/
/// integrations are left to the web app for now.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _api = ApiClient.instance;
  late final _name = TextEditingController();
  late final _phone = TextEditingController();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  bool _saving = false;
  bool _initialized = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  void _initFromAuth(AuthState auth) {
    if (_initialized) return;
    _name.text = auth.user?['name'] as String? ?? '';
    _phone.text = auth.user?['phone'] as String? ?? '';
    _initialized = true;
  }

  Future<void> _save() async {
    if (_newPassword.text.isNotEmpty && _currentPassword.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Enter your current password to set a new one'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.dio.put('/auth/me', data: {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        if (_newPassword.text.isNotEmpty) 'currentPassword': _currentPassword.text,
        if (_newPassword.text.isNotEmpty) 'newPassword': _newPassword.text,
      });
      if (mounted) {
        await context.read<AuthState>().refresh();
        _currentPassword.clear();
        _newPassword.clear();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Profile updated'),
          backgroundColor: AppColors.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Update failed')),
          backgroundColor: AppColors.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    _initFromAuth(auth);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Organization', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(auth.org?['name'] as String? ?? '—',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(auth.role, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text('My Profile', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
        const SizedBox(height: 12),
        TextField(
          enabled: false,
          decoration: InputDecoration(labelText: 'Email', hintText: auth.user?['email'] as String? ?? ''),
        ),
        const SizedBox(height: 12),
        TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone')),
        const SizedBox(height: 20),
        Text('Change Password', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextField(
          controller: _currentPassword,
          decoration: const InputDecoration(labelText: 'Current password'),
          obscureText: true,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _newPassword,
          decoration: const InputDecoration(labelText: 'New password'),
          obscureText: true,
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Saving…' : 'Save Changes'),
        ),
      ],
    );
  }
}
