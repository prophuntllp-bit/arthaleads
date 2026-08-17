import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/auth_errors.dart';
import '../core/auth_state.dart';
import '../core/theme.dart';
import '../widgets/buttons.dart';
import '../widgets/glass.dart';
import '../widgets/labeled_field.dart';

/// Exact SVG paths from frontend/src/pages/Login.jsx's inline Google logo.
const _googleLogoSvg = '''
<svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
  <path fill="#FBBC05" d="M10.5 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
  <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
</svg>
''';

/// Login — mirrors frontend/src/pages/Login.jsx's mobile ("lg:hidden")
/// layout: logo + heading, a "Secure access" note, email/phone + password
/// form, forgot-password link, Google sign-in, and a sign-up link out to
/// the web app (mobile has no self-serve org signup flow).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _googleLoading = false;
  bool _obscure = true;
  String? _error;
  // scopes match frontend's useGoogleLogin default (email + profile via userinfo)
  final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final id = _identifier.text.trim();
    final pw = _password.text;
    if (id.isEmpty || pw.isEmpty) {
      setState(() => _error = 'Enter your email/phone and password');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().login(id, pw);
    } catch (e) {
      setState(() => _error = authErrorMessage(e, 'Login failed'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitGoogle() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return; // user cancelled
      final auth = await account.authentication;
      final accessToken = auth.accessToken;
      if (accessToken == null) throw Exception('No Google access token');
      if (!mounted) return;
      await context.read<AuthState>().googleLogin(accessToken);
    } catch (e) {
      setState(
        () => _error = authErrorMessage(
          e,
          'Google sign-in failed. Please try again.',
        ),
      );
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Scaffold(
      body: AppBackdrop(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 64,
                        height: 64,
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: t.shadow,
                        ),
                        child: Image.asset(
                          'assets/images/logo.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Welcome to Arthaleads',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.4,
                        color: t.text,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Sign in to your premium real estate workspace',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: t.textSoft),
                    ),
                    const SizedBox(height: 22),
                    GlassSurface(
                      radius: AppRadii.modalLarge,
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: t.surfaceLow,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.verified_user_outlined,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Secure access',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: t.text,
                                        ),
                                      ),
                                      Text(
                                        'Protected with role-based access controls.',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: t.textSoft,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          LabeledField(
                            label: 'Email or Phone',
                            child: TextField(
                              controller: _identifier,
                              keyboardType: TextInputType.emailAddress,
                              autocorrect: false,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                hintText: 'you@company.com or 9876543210',
                                helperText:
                                    'Enter your email address or registered mobile number.',
                                helperMaxLines: 2,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          LabeledField(
                            label: 'Password',
                            child: TextField(
                              controller: _password,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                  ),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.1),
                                border: Border.all(
                                  color: AppColors.danger.withValues(alpha: 0.2),
                                ),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.danger,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 18),
                          GradientButton(
                            fullWidth: true,
                            loading: _loading,
                            onPressed: _loading ? null : _submit,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            child: const Text('Sign In'),
                          ),
                          const SizedBox(height: 10),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              style: TextButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                padding: EdgeInsets.zero,
                                minimumSize: const Size(0, 0),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const ForgotPasswordScreen(),
                                ),
                              ),
                              child: const Text(
                                'Forgot password?',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: Divider(color: t.border, height: 1),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                ),
                                child: Text(
                                  'or continue with',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: t.textSoft,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Divider(color: t.border, height: 1),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Material(
                            color: t.surfaceLow,
                            borderRadius: BorderRadius.circular(16),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: _googleLoading ? null : _submitGoogle,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 13,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: t.border),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    if (_googleLoading)
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: t.textSoft,
                                        ),
                                      )
                                    else
                                      SvgPicture.string(
                                        _googleLogoSvg,
                                        width: 18,
                                        height: 18,
                                      ),
                                    const SizedBox(width: 10),
                                    Text(
                                      _googleLoading
                                          ? 'Signing in…'
                                          : 'Sign in with Google',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: t.text,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Center(
                            child: Wrap(
                              alignment: WrapAlignment.center,
                              children: [
                                Text(
                                  "Don't have an account? ",
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: t.textSoft,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () => launchUrl(
                                    Uri.parse('https://arthaleads.com/signup'),
                                    mode: LaunchMode.externalApplication,
                                  ),
                                  child: const Text(
                                    'Sign up',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Forgot password — mirrors frontend/src/pages/ForgotPassword.jsx exactly:
/// logo, form/success two-state card, and a "Back to Sign In" link.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_email.text.trim().isEmpty) {
      setState(() => _error = 'Please enter your email address.');
      return;
    }
    setState(() => _loading = true);
    try {
      await ApiClient.instance.dio.post(
        '/auth/forgot-password',
        data: {'email': _email.text.trim()},
      );
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = ApiClient.errorMessage(
            e,
            'Something went wrong. Please try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTheme.of(context);
    return Scaffold(
      body: AppBackdrop(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: SoftSurface(
                  radius: AppRadii.modalLarge,
                  padding: const EdgeInsets.all(24),
                  color: t.surface,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 56,
                          height: 56,
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: t.shadow,
                          ),
                          child: Image.asset(
                            'assets/images/logo.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (_sent) ...[
                        Center(
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check_circle_outline,
                              color: AppColors.success,
                              size: 28,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Check your inbox',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            color: t.text,
                          ),
                        ),
                        const SizedBox(height: 8),
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.5,
                              color: t.textSoft,
                            ),
                            children: [
                              const TextSpan(
                                text: "We've sent a password reset link to ",
                              ),
                              TextSpan(
                                text: _email.text.trim(),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: t.text,
                                ),
                              ),
                              const TextSpan(
                                text: '. The link expires in 1 hour.',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Center(
                          child: Wrap(
                            alignment: WrapAlignment.center,
                            children: [
                              Text(
                                "Didn't receive it? Check your spam folder or ",
                                style: TextStyle(
                                  fontSize: 11,
                                  color: t.textSoft,
                                ),
                              ),
                              GestureDetector(
                                onTap: () => setState(() {
                                  _sent = false;
                                  _error = null;
                                }),
                                child: const Text(
                                  'try again',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                              Text(
                                '.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: t.textSoft,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        Text(
                          'Forgot password?',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w900,
                            color: t.text,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Enter your email and we'll send you a reset link.",
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: t.textSoft),
                        ),
                        const SizedBox(height: 20),
                        LabeledField(
                          label: 'Email address',
                          child: TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autofocus: true,
                            enabled: !_loading,
                            onSubmitted: (_) => _submit(),
                            decoration: const InputDecoration(
                              hintText: 'you@example.com',
                              prefixIcon: Icon(Icons.mail_outline, size: 18),
                            ),
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.danger.withValues(alpha: 0.07),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: AppColors.danger,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loading ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 15),
                          ),
                          child: _loading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Send Reset Link'),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton.icon(
                          onPressed: () => Navigator.of(context).pop(),
                          style: TextButton.styleFrom(
                            foregroundColor: t.textSoft,
                          ),
                          icon: const Icon(Icons.arrow_back, size: 16),
                          label: const Text(
                            'Back to Sign In',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
