import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/initials_avatar.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';

const _planLimits = {
  'starter': 3,
  'growth': 20,
  'trial': 20,
  'pro': 20,
  'enterprise': 999999,
};

/// Team — GET/POST/PATCH/DELETE /auth/users. Unlike most other admin-only
/// screens, the backend restricts this strictly to role === "admin" (not
/// manager) — see backend/routes/authRoutes.js. The nav drawer's generic
/// adminOnly flag lets managers tap in, so this screen self-guards rather
/// than surfacing a raw 403.
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  final _api = ApiClient.instance;
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.get('/auth/users');
      setState(
        () => _users = (res.data['users'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to load team')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> user) async {
    try {
      final res = await _api.dio.patch('/auth/users/${user['_id']}/toggle');
      setState(() {
        final idx = _users.indexWhere((u) => u['_id'] == user['_id']);
        if (idx != -1)
          _users[idx] = (res.data['user'] as Map).cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to update status')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> user) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove team member?'),
        content: Text('"${user['name']}" will lose access to Arthaleads.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Remove',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.dio.delete('/auth/users/${user['_id']}');
      setState(() => _users.removeWhere((u) => u['_id'] == user['_id']));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to remove member')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Color _roleColor(String? role) {
    switch (role) {
      case 'admin':
        return AppColors.primary;
      case 'manager':
        return AppColors.info;
      default:
        return const Color(0xFF6B7280);
    }
  }

  ImageProvider<Object>? _avatarProvider(String? value) {
    final avatar = value?.trim() ?? '';
    if (avatar.isEmpty) return null;
    if (avatar.startsWith('data:image/') && avatar.contains(',')) {
      try {
        return MemoryImage(
          base64Decode(avatar.substring(avatar.indexOf(',') + 1)),
        );
      } catch (_) {
        return null;
      }
    }
    final uri = Uri.tryParse(avatar);
    return uri != null && uri.hasScheme ? NetworkImage(avatar) : null;
  }

  Future<void> _openForm({Map<String, dynamic>? user}) async {
    final nameCtrl = TextEditingController(
      text: user?['name'] as String? ?? '',
    );
    final emailCtrl = TextEditingController(
      text: user?['email'] as String? ?? '',
    );
    final phoneCtrl = TextEditingController(
      text: user?['phone'] as String? ?? '',
    );
    final passwordCtrl = TextEditingController();
    final avatarCtrl = TextEditingController(
      text: user?['avatar'] as String? ?? '',
    );
    String role = user?['role'] as String? ?? 'agent';
    bool isActive = user?['isActive'] != false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  user == null ? 'Add Team Member' : 'Edit Team Member',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtrl,
                  decoration: InputDecoration(
                    labelText: user == null ? 'Phone' : 'Phone (optional)',
                  ),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: avatarCtrl,
                  decoration: InputDecoration(
                    labelText: 'Avatar URL',
                    suffixIcon: IconButton(
                      tooltip: 'Choose image',
                      icon: const Icon(Icons.photo_library_outlined),
                      onPressed: () async {
                        final picked = await ImagePicker().pickImage(
                          source: ImageSource.gallery,
                          imageQuality: 72,
                          maxWidth: 600,
                        );
                        if (picked == null) return;
                        final bytes = await picked.readAsBytes();
                        if (bytes.length > 1500000) {
                          if (ctx.mounted) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Please choose an image smaller than 1.5 MB',
                                ),
                                backgroundColor: AppColors.danger,
                              ),
                            );
                          }
                          return;
                        }
                        final mime = picked.name.toLowerCase().endsWith('.png')
                            ? 'image/png'
                            : 'image/jpeg';
                        setSheetState(
                          () => avatarCtrl.text =
                              'data:$mime;base64,${base64Encode(bytes)}',
                        );
                      },
                    ),
                  ),
                ),
                if (avatarCtrl.text.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundImage: _avatarProvider(avatarCtrl.text),
                        child: _avatarProvider(avatarCtrl.text) == null
                            ? const Icon(Icons.person)
                            : null,
                      ),
                      TextButton.icon(
                        onPressed: () => setSheetState(avatarCtrl.clear),
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Remove'),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: passwordCtrl,
                  decoration: InputDecoration(
                    labelText: user == null
                        ? 'Password'
                        : 'New password (leave blank to keep current)',
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: [
                    const DropdownMenuItem(
                      value: 'admin',
                      child: Text('Admin'),
                    ),
                    const DropdownMenuItem(
                      value: 'manager',
                      child: Text('Manager'),
                    ),
                    const DropdownMenuItem(
                      value: 'agent',
                      child: Text('Agent'),
                    ),
                    // Not a normally assignable role — included only so editing an
                    // existing super_admin's other fields doesn't crash the dropdown
                    // (initialValue must match exactly one item) or silently demote them.
                    if (role == 'super_admin')
                      const DropdownMenuItem(
                        value: 'super_admin',
                        child: Text('Super Admin'),
                      ),
                  ],
                  onChanged: (v) => setSheetState(() => role = v ?? 'agent'),
                ),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active account'),
                  subtitle: const Text('Inactive members cannot sign in'),
                  value: isActive,
                  onChanged: (value) => setSheetState(() => isActive = value),
                ),
                const SizedBox(height: 16),
                GradientButton(
                  fullWidth: true,
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty ||
                        emailCtrl.text.trim().isEmpty ||
                        (user == null && phoneCtrl.text.trim().length < 10)) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Name, email and a valid phone number are required',
                          ),
                          backgroundColor: AppColors.danger,
                        ),
                      );
                      return;
                    }
                    if (user == null || passwordCtrl.text.isNotEmpty) {
                      final pwd = passwordCtrl.text;
                      final strong =
                          pwd.length >= 8 &&
                          RegExp(r'[A-Z]').hasMatch(pwd) &&
                          RegExp(r'[0-9]').hasMatch(pwd) &&
                          RegExp(
                            r'[!@#$%^&*()\-_=+{};:,<.>?/\\|\[\]~`]',
                          ).hasMatch(pwd);
                      if (!strong) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Password must be 8+ chars with 1 uppercase, 1 number, 1 special character',
                            ),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                        return;
                      }
                    }
                    final data = {
                      'name': nameCtrl.text.trim(),
                      'email': emailCtrl.text.trim(),
                      'phone': phoneCtrl.text.trim(),
                      'role': role,
                      'avatar': avatarCtrl.text.trim(),
                      'isActive': isActive,
                      if (passwordCtrl.text.isNotEmpty)
                        'password': passwordCtrl.text,
                    };
                    try {
                      if (user == null) {
                        await _api.dio.post('/auth/users', data: data);
                      } else {
                        await _api.dio.patch(
                          '/auth/users/${user['_id']}',
                          data: data,
                        );
                      }
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(
                            content: Text(
                              ApiClient.errorMessage(e, 'Save failed'),
                            ),
                            backgroundColor: AppColors.danger,
                          ),
                        );
                      }
                    }
                  },
                  child: Text(user == null ? 'Add Member' : 'Save Changes'),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );

    if (saved == true) _load();
  }

  Widget _countPill(String label, int count, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(fontSize: 10.5, color: color),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (auth.role != 'admin') {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Team management is available to admins only.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final admins = _users.where((u) => u['role'] == 'admin').length;
    final managers = _users.where((u) => u['role'] == 'manager').length;
    final agents = _users.where((u) => u['role'] == 'agent').length;
    final plan = auth.org?['plan'] as String?;
    final memberLimit = auth.role == 'super_admin'
        ? 999999
        : (_planLimits[plan] ?? 999999);
    final atLimit = _users.length >= memberLimit;

    return Scaffold(
      floatingActionButton: GradientFab(
        onPressed: () {
          if (atLimit) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Member limit reached ($memberLimit) for your plan. Upgrade to add more.',
                ),
                backgroundColor: AppColors.danger,
              ),
            );
            return;
          }
          _openForm();
        },
        icon: Icons.person_add_rounded,
      ),
      body: Column(
        children: [
          PageHeader(
            title: 'Team Management',
            subtitle: memberLimit >= 999999
                ? '${_users.length} members'
                : '${_users.length}/$memberLimit members',
            icon: Icons.groups_rounded,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 8, 13, 4),
            child: Row(
              children: [
                _countPill('Admins', admins, AppColors.primary),
                _countPill('Managers', managers, AppColors.info),
                _countPill('Agents', agents, const Color(0xFF6B7280)),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: AppSpinner(size: 32))
                : _users.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.groups_outlined,
                            size: 40,
                            color: AppColors.primary.withValues(alpha: 0.3),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'No team members found',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Add your first team member to get started.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.only(bottom: 80, top: 8),
                itemCount: _users.length,
                itemBuilder: (context, i) {
                  final u = _users[i];
                  final active = u['isActive'] != false;
                  final roleColor = _roleColor(u['role'] as String?);
                  return FadeSlideIn(
                    delay: Duration(milliseconds: 20 * (i % 12)),
                    child: Card(
                      margin: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      child: ListTile(
                        onTap: () => _openForm(user: u),
                        leading: InitialsAvatar(
                          backgroundColor: roleColor.withValues(alpha: 0.15),
                          avatarValue: u['avatar'] as String?,
                          fallback: Text(
                            (u['name'] as String? ?? '?').isNotEmpty
                                ? (u['name'] as String)[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                              color: roleColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(
                          u['name'] as String? ?? '—',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: active
                                ? null
                                : Theme.of(context).disabledColor,
                          ),
                        ),
                        subtitle: Text(
                          '${u['email'] ?? ''} · ${u['role'] ?? ''}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Switch(
                              value: active,
                              activeThumbColor: AppColors.success,
                              onChanged: (_) => _toggleActive(u),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                color: AppColors.danger,
                                size: 20,
                              ),
                              onPressed: () => _delete(u),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
