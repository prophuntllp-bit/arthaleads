import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

const _billingRequired = [
  'address',
  'gstNo',
  'pan',
  'bankAccountName',
  'bankAccountNo',
  'bankIfsc',
];

/// Settings — My Profile (avatar upload, name/phone, password) for everyone;
/// Organization (logo, billing/GST/bank details, auto-assign) and Security
/// (support access log) tabs for admin/super_admin. Mirrors the tab layout
/// of frontend/src/pages/Settings.jsx, including EnableX telephony setup.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _api = ApiClient.instance;
  String _tab = 'profile';

  // Profile
  late final _name = TextEditingController();
  late final _phone = TextEditingController();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  String? _avatar;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _savingProfile = false;
  bool _profileInitialized = false;

  // Organization billing
  final Map<String, TextEditingController> _billing = {
    for (final k in [
      'address',
      'phone',
      'email',
      'gstNo',
      'pan',
      'cin',
      'rera',
      'bankAccountName',
      'bankAccountNo',
      'bankIfsc',
      'bankName',
      'bankBranch',
    ])
      k: TextEditingController(),
  };
  String? _logo;
  bool _savingBilling = false;
  bool _billingInitialized = false;
  bool _autoAssign = true;
  bool _togglingAutoAssign = false;

  // EnableX telephony
  final _enablexAppId = TextEditingController();
  final _enablexApiKey = TextEditingController();
  final _enablexNumber = TextEditingController();
  bool _enablexLoaded = false;
  bool _enablexConnected = false;
  bool _enablexHasKey = false;
  bool _enablexAiStatus = false;
  bool _enablexBusy = false;
  bool _showEnablexKey = false;
  String _enablexInboundUrl = '';
  String _enablexOrgId = '';

  // Security
  List<Map<String, dynamic>> _accessRecords = [];
  bool _loadingAccess = true;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    _enablexAppId.dispose();
    _enablexApiKey.dispose();
    _enablexNumber.dispose();
    for (final c in _billing.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _initFromAuth(AuthState auth) {
    if (!_profileInitialized) {
      _name.text = auth.user?['name'] as String? ?? '';
      _phone.text = auth.user?['phone'] as String? ?? '';
      _avatar = auth.user?['avatar'] as String?;
      _profileInitialized = true;
    }
    if (!_billingInitialized) {
      final org = auth.org;
      for (final k in _billing.keys) {
        _billing[k]!.text = org?[k] as String? ?? '';
      }
      _logo = org?['logo'] as String?;
      _autoAssign = org?['autoAssign'] as bool? ?? true;
      _billingInitialized = true;
    }
  }

  Future<String?> _pickImageAsDataUri() async {
    final photo = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 75,
      maxWidth: 800,
    );
    if (photo == null) return null;
    final bytes = await photo.readAsBytes();
    if (bytes.lengthInBytes > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Image must be under 5 MB'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
      return null;
    }
    final ext = photo.path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return 'data:image/$ext;base64,${base64Encode(bytes)}';
  }

  Future<void> _pickAvatar() async {
    final uri = await _pickImageAsDataUri();
    if (uri != null) setState(() => _avatar = uri);
  }

  Future<void> _saveProfile() async {
    if (_newPassword.text.isNotEmpty) {
      final pwd = _newPassword.text;
      final ok =
          pwd.length >= 8 &&
          RegExp(r'[A-Z]').hasMatch(pwd) &&
          RegExp(r'[0-9]').hasMatch(pwd) &&
          RegExp(r'[!@#$%^&*()\-_=+{};:,<.>?/\\|\[\]~`]').hasMatch(pwd);
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'New password must be 8+ chars with 1 uppercase, 1 number, 1 special character',
            ),
            backgroundColor: AppColors.danger,
          ),
        );
        return;
      }
      if (_currentPassword.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enter your current password to set a new one'),
            backgroundColor: AppColors.danger,
          ),
        );
        return;
      }
    }
    setState(() => _savingProfile = true);
    try {
      await _api.dio.put(
        '/auth/me',
        data: {
          'name': _name.text.trim(),
          'phone': _phone.text.trim(),
          'avatar': _avatar ?? '',
          if (_newPassword.text.isNotEmpty)
            'currentPassword': _currentPassword.text,
          if (_newPassword.text.isNotEmpty) 'newPassword': _newPassword.text,
        },
      );
      if (!mounted) return;
      await context.read<AuthState>().refresh();
      _currentPassword.clear();
      _newPassword.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Update failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _pickLogo() async {
    final uri = await _pickImageAsDataUri();
    if (uri == null) return;
    setState(() => _logo = uri);
    try {
      await _api.dio.patch('/org/me/logo', data: {'logo': uri});
      if (mounted) await context.read<AuthState>().refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Logo updated'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Logo upload failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _removeLogo() async {
    try {
      await _api.dio.patch('/org/me/logo', data: {'logo': ''});
      setState(() => _logo = null);
      if (mounted) await context.read<AuthState>().refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to remove logo')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _saveBilling() async {
    final missing = _billingRequired
        .where((k) => _billing[k]!.text.trim().isEmpty)
        .toList();
    if (missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please fill all required fields (marked *) before saving',
          ),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    setState(() => _savingBilling = true);
    try {
      await _api.dio.patch(
        '/org/me/billing',
        data: {for (final k in _billing.keys) k: _billing[k]!.text.trim()},
      );
      if (mounted) await context.read<AuthState>().refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Billing details saved'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to save')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingBilling = false);
    }
  }

  Future<void> _toggleAutoAssign() async {
    final next = !_autoAssign;
    setState(() => _togglingAutoAssign = true);
    try {
      await _api.dio.patch('/org/me/auto-assign', data: {'autoAssign': next});
      setState(() => _autoAssign = next);
      if (mounted) await context.read<AuthState>().refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to update setting'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _togglingAutoAssign = false);
    }
  }

  Future<void> _loadEnableX() async {
    if (_enablexLoaded) return;
    setState(() => _enablexBusy = true);
    try {
      final res = await _api.dio.get('/calls/settings');
      final settings = (res.data['enablex'] as Map? ?? {})
          .cast<String, dynamic>();
      _enablexAppId.text = settings['appId']?.toString() ?? '';
      _enablexNumber.text = settings['virtualNumber']?.toString() ?? '';
      setState(() {
        _enablexConnected = res.data['connected'] == true;
        _enablexHasKey = settings['hasApiKey'] == true;
        _enablexAiStatus = settings['aiAutoStatus'] == true;
        _enablexInboundUrl = res.data['inboundUrl']?.toString() ?? '';
        _enablexOrgId = res.data['orgId']?.toString() ?? '';
        _enablexLoaded = true;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ApiClient.errorMessage(e, 'Failed to load telephony settings'),
            ),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _enablexBusy = false);
    }
  }

  Future<void> _saveEnableX() async {
    if (_enablexAppId.text.trim().isEmpty ||
        (_enablexApiKey.text.trim().isEmpty && !_enablexHasKey)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter the EnableX APP ID and APP KEY'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    setState(() => _enablexBusy = true);
    try {
      await _api.dio.patch(
        '/calls/settings',
        data: {
          'appId': _enablexAppId.text.trim(),
          if (_enablexApiKey.text.trim().isNotEmpty)
            'apiKey': _enablexApiKey.text.trim(),
          'virtualNumber': _enablexNumber.text.trim(),
        },
      );
      setState(() => _enablexHasKey = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('EnableX credentials saved'),
            backgroundColor: AppColors.success,
          ),
        );
      }
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
      if (mounted) setState(() => _enablexBusy = false);
    }
  }

  Future<void> _testEnableX() async {
    setState(() => _enablexBusy = true);
    try {
      await _api.dio.post('/calls/settings/test');
      setState(() => _enablexConnected = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('EnableX connected successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Connection failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _enablexBusy = false);
    }
  }

  Future<void> _updateEnableXFlag(String key, bool value) async {
    try {
      await _api.dio.patch('/calls/settings', data: {key: value});
      setState(() {
        if (key == 'enabled') _enablexConnected = value;
        if (key == 'aiAutoStatus') _enablexAiStatus = value;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Update failed')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _loadAccessLog() async {
    setState(() => _loadingAccess = true);
    try {
      final res = await _api.dio.get('/org/support-access');
      setState(
        () => _accessRecords = (res.data['records'] as List? ?? [])
            .cast<Map<String, dynamic>>(),
      );
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingAccess = false);
    }
  }

  Future<void> _respondAccess(String id, String action) async {
    try {
      await _api.dio.post(
        '/org/support-access/$id/respond',
        data: {'action': action},
      );
      _loadAccessLog();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to respond')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _endAccessSession() async {
    try {
      await _api.dio.post('/org/support-access/end-session');
      _loadAccessLog();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e, 'Failed to end session')),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  ImageProvider _imageProvider(String uri) {
    if (uri.startsWith('http://') || uri.startsWith('https://'))
      return NetworkImage(uri);
    final b64 = uri.contains(',') ? uri.split(',').last : uri;
    return MemoryImage(base64Decode(b64));
  }

  Widget _avatarPicker({
    required String? preview,
    required String fallback,
    required VoidCallback onPick,
    VoidCallback? onRemove,
  }) {
    return Row(
      children: [
        Stack(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: AppColors.primary.withValues(alpha: 0.1),
                image: preview != null && preview.isNotEmpty
                    ? DecorationImage(
                        image: _imageProvider(preview),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: preview == null || preview.isEmpty
                  ? Center(
                      child: Text(
                        fallback,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    )
                  : null,
            ),
            Positioned(
              right: -4,
              bottom: -4,
              child: InkWell(
                onTap: onPick,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.edit, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
        if (preview != null && preview.isNotEmpty && onRemove != null)
          Padding(
            padding: const EdgeInsets.only(left: 12),
            child: TextButton.icon(
              onPressed: onRemove,
              icon: const Icon(
                Icons.delete_outline,
                size: 16,
                color: AppColors.danger,
              ),
              label: const Text(
                'Remove',
                style: TextStyle(color: AppColors.danger, fontSize: 12),
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    _initFromAuth(auth);
    final isAdmin = auth.role == 'admin' || auth.role == 'super_admin';

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _tabChip('profile', 'My Profile', Icons.person_outline),
                if (isAdmin)
                  _tabChip(
                    'organization',
                    'Organization',
                    Icons.business_outlined,
                  ),
                if (isAdmin)
                  _tabChip(
                    'telephony',
                    'Telephony',
                    Icons.phone_in_talk_outlined,
                  ),
                if (isAdmin)
                  _tabChip('security', 'Security', Icons.lock_outline),
              ],
            ),
          ),
        ),
        Expanded(
          child: _tab == 'profile'
              ? _profileTab(auth)
              : _tab == 'organization' && isAdmin
              ? _organizationTab()
              : _tab == 'telephony' && isAdmin
              ? _telephonyTab()
              : _tab == 'security' && isAdmin
              ? _securityTab()
              : _profileTab(auth),
        ),
      ],
    );
  }

  Widget _tabChip(String value, String label, IconData icon) {
    final selected = _tab == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        avatar: Icon(icon, size: 15, color: selected ? Colors.white : null),
        label: Text(label, style: const TextStyle(fontSize: 12)),
        selected: selected,
        onSelected: (_) {
          setState(() => _tab = value);
          if (value == 'security' && _accessRecords.isEmpty) _loadAccessLog();
          if (value == 'telephony') _loadEnableX();
        },
      ),
    );
  }

  Widget _profileTab(AuthState auth) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _avatarPicker(
          preview: _avatar,
          fallback: (auth.user?['name'] as String? ?? '?').isNotEmpty
              ? (auth.user!['name'] as String)[0].toUpperCase()
              : '?',
          onPick: _pickAvatar,
          onRemove: () => setState(() => _avatar = ''),
        ),
        const SizedBox(height: 8),
        Text(
          _name.text.isEmpty
              ? (auth.user?['name'] as String? ?? '')
              : _name.text,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        Text(
          auth.user?['email'] as String? ?? '',
          style: const TextStyle(fontSize: 12, color: Colors.grey),
        ),
        Container(
          margin: const EdgeInsets.only(top: 6),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            auth.role,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Full Name'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _phone,
          decoration: const InputDecoration(labelText: 'Phone'),
        ),
        const SizedBox(height: 12),
        TextField(
          enabled: false,
          decoration: InputDecoration(
            labelText: 'Email',
            hintText: auth.user?['email'] as String?,
          ),
        ),
        const SizedBox(height: 20),
        Text('Change Password', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextField(
          controller: _currentPassword,
          obscureText: _obscureCurrent,
          decoration: InputDecoration(
            labelText: 'Current password',
            suffixIcon: IconButton(
              icon: Icon(
                _obscureCurrent
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: 18,
              ),
              onPressed: () =>
                  setState(() => _obscureCurrent = !_obscureCurrent),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _newPassword,
          obscureText: _obscureNew,
          decoration: InputDecoration(
            labelText: 'New password',
            hintText: '8+ chars, uppercase, number, special',
            suffixIcon: IconButton(
              icon: Icon(
                _obscureNew
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: 18,
              ),
              onPressed: () => setState(() => _obscureNew = !_obscureNew),
            ),
          ),
        ),
        const SizedBox(height: 20),
        GradientButton(
          fullWidth: true,
          loading: _savingProfile,
          onPressed: _savingProfile ? null : _saveProfile,
          child: const Text('Save Changes'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _billingField(
    String key,
    String label, {
    bool mono = false,
    bool numbers = false,
  }) {
    final required = _billingRequired.contains(key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _billing[key],
        style: TextStyle(fontFamily: mono ? 'monospace' : null),
        textCapitalization: numbers
            ? TextCapitalization.characters
            : TextCapitalization.none,
        decoration: InputDecoration(labelText: required ? '$label *' : label),
      ),
    );
  }

  Widget _organizationTab() {
    final filledCount = _billingRequired
        .where((k) => _billing[k]!.text.trim().isNotEmpty)
        .length;
    final isComplete = filledCount == _billingRequired.length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Organisation & Billing Details',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: (isComplete ? AppColors.success : AppColors.warning)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                isComplete
                    ? 'Complete'
                    : '$filledCount/${_billingRequired.length} required',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: isComplete ? AppColors.success : AppColors.warning,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'These details appear on every brokerage invoice sent to developers.',
          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: filledCount / _billingRequired.length,
            minHeight: 5,
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            color: isComplete ? AppColors.success : AppColors.primary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'ORGANISATION LOGO',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.grey.shade600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        _avatarPicker(
          preview: _logo,
          fallback: 'A',
          onPick: _pickLogo,
          onRemove: _logo != null && _logo!.isNotEmpty ? _removeLogo : null,
        ),
        const SizedBox(height: 20),
        Text(
          'ORGANISATION IDENTITY',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.grey.shade600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        _billingField('address', 'Registered Address'),
        _billingField('phone', 'Contact Number'),
        _billingField('email', 'Official Email'),
        const SizedBox(height: 8),
        Text(
          'TAX & COMPLIANCE',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.grey.shade600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        _billingField('gstNo', 'GST Number', mono: true, numbers: true),
        _billingField('pan', 'PAN Number', mono: true, numbers: true),
        _billingField('cin', 'CIN', mono: true),
        _billingField('rera', 'RERA Reg. No.', mono: true),
        const SizedBox(height: 8),
        Text(
          'BANK DETAILS',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.grey.shade600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        _billingField('bankAccountName', 'Account Name'),
        _billingField('bankAccountNo', 'Account Number', mono: true),
        _billingField('bankIfsc', 'IFSC Code', mono: true, numbers: true),
        _billingField('bankName', 'Bank Name'),
        _billingField('bankBranch', 'Branch / Address'),
        GradientButton(
          fullWidth: true,
          loading: _savingBilling,
          onPressed: _savingBilling ? null : _saveBilling,
          child: const Text('Save Billing Details'),
        ),
        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Auto Lead Assignment',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Automatically assign new leads to agents in round-robin rotation.',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _autoAssign
                        ? 'Enabled — leads auto-assign on creation'
                        : 'Disabled — assign manually',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _autoAssign ? AppColors.primary : Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
            _togglingAutoAssign
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Switch(
                    value: _autoAssign,
                    onChanged: (_) => _toggleAutoAssign(),
                  ),
          ],
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _telephonyTab() {
    if (_enablexBusy && !_enablexLoaded) {
      return const Center(child: AppSpinner(size: 32));
    }
    final webhook = _enablexOrgId.isEmpty
        ? 'https://api.arthaleads.com/api/calls/webhook'
        : 'https://api.arthaleads.com/api/calls/webhook/$_enablexOrgId';

    Widget copyRow(String label, String value) => Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    value,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Copy',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(const SnackBar(content: Text('Copied')));
                  },
                  icon: const Icon(Icons.copy, size: 17),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: (_enablexConnected ? AppColors.success : AppColors.primary)
              .withValues(alpha: 0.07),
          child: ListTile(
            leading: Icon(
              _enablexConnected ? Icons.wifi : Icons.wifi_off,
              color: _enablexConnected ? AppColors.success : AppColors.primary,
            ),
            title: Text(
              _enablexConnected ? 'EnableX Connected' : 'EnableX not connected',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              _enablexConnected
                  ? 'Click-to-call, recordings and AI summaries are active.'
                  : 'Enter your credentials to enable telephony.',
            ),
            trailing: _enablexConnected
                ? TextButton(
                    onPressed: () => _updateEnableXFlag('enabled', false),
                    child: const Text(
                      'Disconnect',
                      style: TextStyle(color: AppColors.danger),
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'EnableX credentials',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _enablexAppId,
          decoration: const InputDecoration(labelText: 'APP ID'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _enablexApiKey,
          obscureText: !_showEnablexKey,
          decoration: InputDecoration(
            labelText: _enablexHasKey
                ? 'APP KEY (saved — enter only to replace)'
                : 'APP KEY',
            suffixIcon: IconButton(
              onPressed: () =>
                  setState(() => _showEnablexKey = !_showEnablexKey),
              icon: Icon(
                _showEnablexKey
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _enablexNumber,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Virtual Phone Number'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: GradientButton(
                loading: _enablexBusy,
                onPressed: _enablexBusy ? null : _saveEnableX,
                child: const Text('Save Credentials'),
              ),
            ),
            if (_enablexHasKey) ...[
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _enablexBusy ? null : _testEnableX,
                  icon: const Icon(Icons.phone, size: 16),
                  label: const Text('Test & Enable'),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 18),
        copyRow('Recording Webhook URL', webhook),
        if (_enablexInboundUrl.isNotEmpty)
          copyRow('Inbound Answer URL', _enablexInboundUrl),
        if (_enablexConnected)
          Card(
            child: SwitchListTile.adaptive(
              title: const Text(
                'AI Auto-Status Updates',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: const Text(
                'Advance lead status automatically when call AI detects intent.',
              ),
              value: _enablexAiStatus,
              onChanged: (value) => _updateEnableXFlag('aiAutoStatus', value),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _securityTab() {
    final pending = _accessRecords
        .where((r) => r['status'] == 'pending')
        .toList();
    const reasonLabels = {
      'customer_support': 'Customer Support',
      'onboarding': 'Onboarding Assistance',
      'bug_investigation': 'Bug Investigation',
      'data_migration': 'Data Migration',
      'billing_issue': 'Billing Issue',
      'other': 'Other',
    };
    const statusColors = {
      'pending': AppColors.warning,
      'approved': AppColors.success,
      'denied': AppColors.danger,
      'active': AppColors.primary,
      'completed': Color(0xFF6B7280),
    };

    if (_loadingAccess) return const Center(child: AppSpinner(size: 32));

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadAccessLog,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Icon(
                Icons.shield_outlined,
                size: 18,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Support Access Log',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      'Track when Arthaleads support accesses your account',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (pending.isNotEmpty) ...[
            Text(
              'PENDING APPROVAL',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.warning,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            for (final r in pending)
              Card(
                color: AppColors.warning.withValues(alpha: 0.06),
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${r['requestedByName'] ?? 'Someone'} is requesting access',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${reasonLabels[r['reason']] ?? r['reason'] ?? ''}${(r['notes'] as String? ?? '').isNotEmpty ? " — ${r['notes']}" : ""}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            onPressed: () =>
                                _respondAccess(r['_id'] as String, 'deny'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.danger,
                            ),
                            child: const Text(
                              'Deny',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () =>
                                _respondAccess(r['_id'] as String, 'approve'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success,
                            ),
                            child: const Text(
                              'Approve',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
          ],
          if (_accessRecords.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Column(
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    size: 40,
                    color: AppColors.success.withValues(alpha: 0.3),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'No support access on record',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          else
            for (final r in _accessRecords)
              Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  dense: true,
                  title: Row(
                    children: [
                      Text(
                        r['requestedByName'] as String? ?? '—',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: (statusColors[r['status']] ?? Colors.grey)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          r['status'] as String? ?? '',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: statusColors[r['status']] ?? Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                  subtitle: Text(
                    '${reasonLabels[r['reason']] ?? r['reason'] ?? ''}${(r['notes'] as String? ?? '').isNotEmpty ? " — ${r['notes']}" : ""}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: r['status'] == 'active'
                      ? TextButton(
                          onPressed: _endAccessSession,
                          child: const Text(
                            'End',
                            style: TextStyle(fontSize: 11),
                          ),
                        )
                      : null,
                ),
              ),
        ],
      ),
    );
  }
}
