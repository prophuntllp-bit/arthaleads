import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/auth_errors.dart';
import '../core/auth_state.dart';
import '../core/signup_handoff.dart';
import '../core/theme.dart';
import '../widgets/buttons.dart';
import '../widgets/google_logo.dart';
import '../widgets/labeled_field.dart';

/// Signup — mirrors frontend/src/pages/Signup.jsx step for step, against the
/// same endpoints. Nothing was added to the backend for this.
///
///   email   -> address in, link + code out       POST /auth/signup/send-otp
///   verify  -> type the code, or open the link   verify-otp | poll link-status
///   details -> org, name, phone, password        POST /auth/signup
///   pending -> a human approves the trial
///
/// Google skips the first two: /auth/google/signup-profile returns a
/// signupToken directly, because Google has already proved the address.
///
/// reCAPTCHA is deliberately not sent. checkRecaptcha in the backend is
/// tri-state and only blocks on a positive bot verdict — a missing token is
/// allowed and logged. Account creation is gated on the signupToken instead,
/// which is the check that actually matters.
enum _Step { email, verify, details, pending }

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> with WidgetsBindingObserver {
  final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  _Step _step = _Step.email;
  bool _busy = false;
  bool _googleBusy = false;
  String? _error;

  final _email = TextEditingController();
  final _code = TextEditingController();
  final _orgName = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _referral = TextEditingController();

  bool _showReferral = false;
  bool _obscure = true;
  String _maskedEmail = '';
  String _signupToken = '';
  /// True when Google vouched for the address rather than an emailed code. The
  /// token is bound to that address, so the field is shown read-only.
  bool _googleVerified = false;

  SignupHandoff? _handoff;
  Timer? _pollTimer;
  int _polls = 0;
  int _resendIn = 0;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _resendTimer?.cancel();
    for (final c in [_email, _code, _orgName, _name, _phone, _password, _referral]) {
      c.dispose();
    }
    super.dispose();
  }

  // Opening the emailed link backgrounds this app, and Android throttles timers
  // while it is away — so coming back would otherwise sit on a stale screen
  // until the next tick. Polling immediately on resume means returning from the
  // browser advances the form at once, which the web version cannot do.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _step == _Step.verify) {
      _pollLinkStatus();
    }
  }

  String get _emailValue => _email.text.trim().toLowerCase();

  // ── Step 1: send the link + code ───────────────────────────────────────────
  Future<void> _sendCode() async {
    final email = _emailValue;
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    setState(() { _busy = true; _error = null; });

    final handoff = SignupHandoff.generate();
    try {
      final res = await ApiClient.instance.dio.post('/auth/signup/send-otp', data: {
        'email': email,
        'handoffHash': handoff.hash,
      });
      if (!mounted) return;
      setState(() {
        _handoff = handoff;
        _maskedEmail = (res.data as Map)['maskedEmail']?.toString() ?? email;
        _step = _Step.verify;
        _busy = false;
      });
      _startResendCountdown();
      _startPolling();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = authErrorMessage(e, 'Could not send the email. Please try again.');
      });
    }
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() => _resendIn = 30);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || _resendIn <= 0) { t.cancel(); return; }
      setState(() => _resendIn--);
    });
  }

  // ── Step 2a: the emailed link, watched for ─────────────────────────────────
  void _startPolling() {
    _pollTimer?.cancel();
    _polls = 0;
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollLinkStatus());
  }

  Future<void> _pollLinkStatus() async {
    final handoff = _handoff;
    if (handoff == null || _step != _Step.verify) return;
    if (_polls++ > 150) { _pollTimer?.cancel(); return; } // ~10 minutes

    try {
      final res = await ApiClient.instance.dio.post('/auth/signup/link-status', data: {
        'email': _emailValue,
        'handoff': handoff.secret,
      });
      final data = res.data as Map;
      if (data['verified'] == true && data['signupToken'] != null) {
        _pollTimer?.cancel();
        if (!mounted) return;
        setState(() {
          _signupToken = data['signupToken'].toString();
          _step = _Step.details;
        });
      }
    } catch (_) {
      // Transient. The code box is still on screen and still works, so a failed
      // poll should not raise an error at somebody who is not stuck.
    }
  }

  // ── Step 2b: the typed code ────────────────────────────────────────────────
  Future<void> _verifyCode() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final res = await ApiClient.instance.dio.post('/auth/signup/verify-otp', data: {
        'email': _emailValue,
        'otp': _code.text.trim(),
      });
      if (!mounted) return;
      _pollTimer?.cancel();
      setState(() {
        _signupToken = (res.data as Map)['signupToken'].toString();
        _step = _Step.details;
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = authErrorMessage(e, 'Could not verify that code.');
      });
    }
  }

  // ── Google: skips straight to the details ──────────────────────────────────
  Future<void> _googleSignup() async {
    setState(() { _googleBusy = true; _error = null; });
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) { setState(() => _googleBusy = false); return; } // cancelled
      final accessToken = (await account.authentication).accessToken;
      if (accessToken == null) throw Exception('No Google access token');

      final res = await ApiClient.instance.dio.post(
        '/auth/google/signup-profile',
        data: {'credential': accessToken},
      );
      final data = res.data as Map;
      if (!mounted) return;

      // Already registered: this is a sign-in, not a sign-up. Same call the
      // login screen makes, so they land on the dashboard rather than being
      // walked through a signup that would fail on a duplicate address.
      if (data['existing'] == true) {
        await context.read<AuthState>().googleLogin(accessToken);
        return;
      }

      setState(() {
        _email.text = data['email']?.toString() ?? '';
        _name.text = data['name']?.toString() ?? '';
        _signupToken = data['signupToken']?.toString() ?? '';
        _googleVerified = true;
        _step = _Step.details;
        _googleBusy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _googleBusy = false;
        _error = authErrorMessage(e, 'Google sign-up failed. Please try again.');
      });
    }
  }

  // ── Step 3: create the account ─────────────────────────────────────────────
  String? _passwordProblem(String v) {
    // Mirrors passwordSchema in backend/validations/schemas.js, so the server
    // never has to be the one to say no.
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!RegExp(r'[A-Z]').hasMatch(v)) return 'Include at least 1 uppercase letter';
    if (!RegExp(r'[0-9]').hasMatch(v)) return 'Include at least 1 number';
    if (!RegExp(r'''[!@#$%^&*()\-_=+{};:,<.>?/\\|\[\]~`]''').hasMatch(v)) {
      return 'Include at least 1 special character';
    }
    return null;
  }

  Future<void> _createAccount() async {
    final pwProblem = _passwordProblem(_password.text);
    if (_orgName.text.trim().length < 2) {
      setState(() => _error = 'Enter your company or organisation name');
      return;
    }
    if (_name.text.trim().length < 2) {
      setState(() => _error = 'Enter your full name');
      return;
    }
    if (_phone.text.trim().replaceAll(RegExp(r'\D'), '').length < 10) {
      setState(() => _error = 'Enter a valid 10-digit mobile number');
      return;
    }
    if (pwProblem != null) {
      setState(() => _error = pwProblem);
      return;
    }

    setState(() { _busy = true; _error = null; });
    try {
      await ApiClient.instance.dio.post('/auth/signup', data: {
        'orgName': _orgName.text.trim(),
        'name': _name.text.trim(),
        'email': _emailValue,
        'password': _password.text,
        'phone': _phone.text.trim(),
        if (_referral.text.trim().isNotEmpty)
          'referralCode': _referral.text.trim().toUpperCase(),
        'signupToken': _signupToken,
      });
      if (!mounted) return;
      setState(() { _step = _Step.pending; _busy = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = authErrorMessage(e, 'Could not create the account.');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create your account'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            _StepDots(step: _step),
            const SizedBox(height: 20),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
                ),
                child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
              ),
              const SizedBox(height: 16),
            ],
            switch (_step) {
              _Step.email => _emailStep(t),
              _Step.verify => _verifyStep(t),
              _Step.details => _detailsStep(t),
              _Step.pending => _pendingStep(t),
            },
          ],
        ),
      ),
    );
  }

  // ── Step views ─────────────────────────────────────────────────────────────
  Widget _emailStep(AppTheme t) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Start with your work email',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('We will send a link and a code to confirm it is yours.',
              style: TextStyle(fontSize: 13, color: t.textSoft)),
          const SizedBox(height: 20),
          LabeledField(
            label: 'Work email',
            child: TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(hintText: 'you@company.com'),
              onSubmitted: (_) => _sendCode(),
            ),
          ),
          const SizedBox(height: 18),
          GradientButton(
            fullWidth: true,
            loading: _busy,
            onPressed: _busy ? null : _sendCode,
            child: const Text('Send verification link'),
          ),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: Divider(color: t.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text('or', style: TextStyle(fontSize: 12, color: t.textSoft)),
            ),
            Expanded(child: Divider(color: t.border)),
          ]),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: _googleBusy ? null : _googleSignup,
            icon: _googleBusy
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const GoogleLogo(),
            label: const Text('Sign up with Google'),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
          const SizedBox(height: 20),
          Center(
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Already have an account? Sign in'),
            ),
          ),
          // Escape hatch. If anything here misbehaves in the field, the web
          // flow is the same four steps against the same endpoints.
          Center(
            child: TextButton(
              onPressed: () => launchUrl(
                Uri.parse('https://www.arthaleads.com/signup'),
                mode: LaunchMode.externalApplication,
              ),
              child: Text('Sign up on the web instead',
                  style: TextStyle(fontSize: 12, color: t.textSoft)),
            ),
          ),
        ],
      );

  Widget _verifyStep(AppTheme t) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.mark_email_read_outlined, size: 42, color: AppColors.primary),
          const SizedBox(height: 12),
          Center(
            child: Text('Sent to $_maskedEmail',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              'Open the link in that email and this screen continues on its own. Or enter the code below.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: t.textSoft),
            ),
          ),
          const SizedBox(height: 22),
          LabeledField(
            label: '6-digit code',
            child: TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: 8),
              decoration: const InputDecoration(counterText: '', hintText: '······'),
              onSubmitted: (_) => _verifyCode(),
            ),
          ),
          const SizedBox(height: 14),
          GradientButton(
            fullWidth: true,
            loading: _busy,
            onPressed: _busy ? null : _verifyCode,
            child: const Text('Verify email'),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton.icon(
                onPressed: () => setState(() {
                  _pollTimer?.cancel();
                  _step = _Step.email;
                  _code.clear();
                  _error = null;
                }),
                icon: const Icon(Icons.arrow_back, size: 14),
                label: const Text('Change email', style: TextStyle(fontSize: 12)),
              ),
              TextButton(
                onPressed: (_resendIn > 0 || _busy) ? null : _sendCode,
                child: Text(_resendIn > 0 ? 'Resend in ${_resendIn}s' : 'Resend email',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      );

  Widget _detailsStep(AppTheme t) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('A few details',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(
            _googleVerified
                ? 'Google confirmed $_emailValue. Finish setting up your workspace.'
                : 'Your email is confirmed. Finish setting up your workspace.',
            style: TextStyle(fontSize: 13, color: t.textSoft),
          ),
          const SizedBox(height: 20),
          LabeledField(
            label: 'Company or organisation',
            child: TextField(
              controller: _orgName,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(hintText: 'Your company name'),
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Your full name',
            child: TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(hintText: 'Enter your full name'),
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Mobile number',
            child: TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(hintText: '10-digit mobile number'),
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Password',
            child: TextField(
              controller: _password,
              obscureText: _obscure,
              decoration: InputDecoration(
                hintText: '8+ chars, uppercase, number, special',
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Collapsed by default: most people do not have one, and a visible
          // empty field invites them to wonder whether they are missing out.
          if (!_showReferral)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => _showReferral = true),
                child: const Text('Have a referral code?', style: TextStyle(fontSize: 12)),
              ),
            )
          else
            LabeledField(
              label: 'Referral code',
              child: TextField(
                controller: _referral,
                textCapitalization: TextCapitalization.characters,
                maxLength: 6,
                decoration: const InputDecoration(counterText: '', hintText: '6-character code'),
              ),
            ),
          const SizedBox(height: 14),
          GradientButton(
            fullWidth: true,
            loading: _busy,
            onPressed: _busy ? null : _createAccount,
            child: const Text('Create account'),
          ),
        ],
      );

  Widget _pendingStep(AppTheme t) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          Icon(Icons.hourglass_top_rounded, size: 48, color: AppColors.primary),
          const SizedBox(height: 16),
          Center(
            child: Text('Request received',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 8),
          Text(
            'Your trial is with our team for approval, usually within one working day. '
            'We will email $_emailValue the moment it is active, and you can sign in here straight away.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: t.textSoft, height: 1.5),
          ),
          const SizedBox(height: 24),
          GradientButton(
            fullWidth: true,
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to sign in'),
          ),
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: () => launchUrl(
                Uri(scheme: 'mailto', path: 'contact@arthaleads.com'),
                mode: LaunchMode.externalApplication,
              ),
              child: const Text('Contact support', style: TextStyle(fontSize: 12)),
            ),
          ),
        ],
      );
}

/// Four dots, so the form says how much is left. The web version has the whole
/// page to imply that; a phone screen does not.
class _StepDots extends StatelessWidget {
  final _Step step;
  const _StepDots({required this.step});

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    final index = _Step.values.indexOf(step);
    return Row(
      children: List.generate(_Step.values.length, (i) {
        final done = i <= index;
        return Expanded(
          child: Container(
            height: 3,
            margin: EdgeInsets.only(right: i == _Step.values.length - 1 ? 0 : 6),
            decoration: BoxDecoration(
              color: done ? AppColors.primary : t.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }
}
