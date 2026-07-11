import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';

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
      setState(() => _users = (res.data['users'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to load team')),
          backgroundColor: AppColors.danger,
        ));
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
        if (idx != -1) _users[idx] = (res.data['user'] as Map).cast<String, dynamic>();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to update status')),
          backgroundColor: AppColors.danger,
        ));
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
      await _api.dio.delete('/auth/users/${user['_id']}');
      setState(() => _users.removeWhere((u) => u['_id'] == user['_id']));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ApiClient.errorMessage(e, 'Failed to remove member')),
          backgroundColor: AppColors.danger,
        ));
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

  Future<void> _openForm({Map<String, dynamic>? user}) async {
    final nameCtrl = TextEditingController(text: user?['name'] as String? ?? '');
    final emailCtrl = TextEditingController(text: user?['email'] as String? ?? '');
    final phoneCtrl = TextEditingController(text: user?['phone'] as String? ?? '');
    final passwordCtrl = TextEditingController();
    String role = user?['role'] as String? ?? 'agent';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(user == null ? 'Add Team Member' : 'Edit Team Member',
                    style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 16),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
                const SizedBox(height: 12),
                TextField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone (optional)')),
                const SizedBox(height: 12),
                TextField(
                  controller: passwordCtrl,
                  decoration: InputDecoration(
                    labelText: user == null ? 'Password' : 'New password (leave blank to keep current)',
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                    DropdownMenuItem(value: 'manager', child: Text('Manager')),
                    DropdownMenuItem(value: 'agent', child: Text('Agent')),
                  ],
                  onChanged: (v) => setSheetState(() => role = v ?? 'agent'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () async {
                    final data = {
                      'name': nameCtrl.text.trim(),
                      'email': emailCtrl.text.trim(),
                      'phone': phoneCtrl.text.trim(),
                      'role': role,
                      if (passwordCtrl.text.isNotEmpty) 'password': passwordCtrl.text,
                    };
                    try {
                      if (user == null) {
                        await _api.dio.post('/auth/users', data: data);
                      } else {
                        await _api.dio.patch('/auth/users/${user['_id']}', data: data);
                      }
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text(ApiClient.errorMessage(e, 'Save failed')),
                          backgroundColor: AppColors.danger,
                        ));
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (auth.role != 'admin') {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Team management is available to admins only.', textAlign: TextAlign.center),
        ),
      );
    }

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.person_add_rounded),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
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
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    child: ListTile(
                      onTap: () => _openForm(user: u),
                      leading: CircleAvatar(
                        backgroundColor: roleColor.withValues(alpha: 0.15),
                        child: Text(
                          (u['name'] as String? ?? '?').isNotEmpty
                              ? (u['name'] as String)[0].toUpperCase()
                              : '?',
                          style: TextStyle(color: roleColor, fontWeight: FontWeight.w700),
                        ),
                      ),
                      title: Text(u['name'] as String? ?? '—',
                          style: TextStyle(fontWeight: FontWeight.w600, color: active ? null : Theme.of(context).disabledColor)),
                      subtitle: Text('${u['email'] ?? ''} · ${u['role'] ?? ''}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Switch(
                            value: active,
                            activeColor: AppColors.success,
                            onChanged: (_) => _toggleActive(u),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger, size: 20),
                            onPressed: () => _delete(u),
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
}
