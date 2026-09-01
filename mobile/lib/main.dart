import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/auth_state.dart';
import 'core/options_service.dart';
import 'core/push_service.dart';
import 'core/theme.dart';
import 'core/theme_state.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';
import 'widgets/app_splash.dart';
import 'widgets/skeleton.dart';
import 'widgets/update_gate.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  // Refresh lead dropdown options from the backend (cached, offline-safe) so a
  // stale sideloaded build still offers exactly what the API accepts.
  // Deliberately not awaited — app start must not wait on it.
  OptionsService.hydrate();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()..restore()),
        ChangeNotifierProvider(create: (_) => ThemeState()..restore()),
      ],
      child: const ArthaleadsApp(),
    ),
  );
}

class ArthaleadsApp extends StatelessWidget {
  const ArthaleadsApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeState>();
    return MaterialApp(
      title: 'Arthaleads',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: theme.mode,
      // Wraps the whole app (not just the logged-in shell) so a mandatory
      // update applies even to someone sitting on the login screen.
      home: const UpdateGate(child: _AuthGate()),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (auth.restoring) {
      // A returning user is heading for the dashboard, so show its skeleton
      // for the /auth/me wait — the launch then reads as one continuous load
      // into the real dashboard rather than spinner, then skeleton, then
      // content. Before the stored token is read we cannot know where this
      // lands, but that phase is a local storage call and passes in a frame
      // or two, so it carries the launch mark rather than flashing the
      // wrong layout -- which also means the native splash hands over to an
      // identical screen instead of to a bare rectangle.
      return Scaffold(
        // SafeArea because this stands in for the Shell, which normally
        // supplies an app bar — without it the first card slides under the
        // status bar and looks clipped.
        body: SafeArea(
          child: auth.restoringKnownSession
              ? const DashboardSkeleton()
              : const AppSplash(),
        ),
      );
    }
    if (auth.orgBlockReason != null) {
      return _OrgBlockedScreen(reason: auth.orgBlockReason!);
    }
    return auth.loggedIn ? const Shell() : const LoginScreen();
  }
}

class _OrgBlockedScreen extends StatefulWidget {
  final String reason;
  const _OrgBlockedScreen({required this.reason});

  @override
  State<_OrgBlockedScreen> createState() => _OrgBlockedScreenState();
}

class _OrgBlockedScreenState extends State<_OrgBlockedScreen> {
  bool _cancelling = false;
  String? _error;

  bool get _trial => widget.reason == 'TRIAL_EXPIRED';
  bool get _pendingDeletion => widget.reason == 'ORG_PENDING_DELETION';

  // The deletion endpoints are exempt from the freeze that produced this
  // screen, so this call goes through where everything else is blocked --
  // otherwise the grace period would be impossible to act on from the app.
  Future<void> _cancelDeletion() async {
    setState(() { _cancelling = true; _error = null; });
    try {
      await ApiClient.instance.dio.delete('/auth/account/deletion');
      if (!mounted) return;
      // Everything behind this screen was built while the org was frozen.
      await context.read<AuthState>().refresh();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _cancelling = false;
        _error = ApiClient.errorMessage(e, 'Could not cancel. Please try again.');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _pendingDeletion
        ? 'Scheduled for deletion'
        : _trial
            ? 'Your trial has expired'
            : 'Organisation inactive';
    final body = _pendingDeletion
        ? 'This workspace and everything in it will be deleted when the notice period ends. You can still stop it.'
        : _trial
            ? 'Please upgrade your plan on the web dashboard to continue.'
            : 'Your organisation account is inactive. Contact support.';
    final icon = _pendingDeletion
        ? Icons.delete_forever_rounded
        : _trial
            ? Icons.hourglass_bottom_rounded
            : Icons.block_rounded;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 56, color: AppColors.danger),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 24),
              if (_pendingDeletion)
                ElevatedButton(
                  onPressed: _cancelling ? null : _cancelDeletion,
                  child: _cancelling
                      ? const SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Keep my workspace'),
                ),
              if (_pendingDeletion) const SizedBox(height: 8),
              _pendingDeletion
                  ? TextButton(
                      onPressed: () => context.read<AuthState>().logout(),
                      child: const Text('Back to login'),
                    )
                  : ElevatedButton(
                      onPressed: () => context.read<AuthState>().logout(),
                      child: const Text('Back to login'),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
