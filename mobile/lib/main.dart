import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/auth_state.dart';
import 'core/options_service.dart';
import 'core/push_service.dart';
import 'core/theme.dart';
import 'core/theme_state.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';
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
      // or two, so it stays blank rather than flashing the wrong layout.
      return Scaffold(
        // SafeArea because this stands in for the Shell, which normally
        // supplies an app bar — without it the first card slides under the
        // status bar and looks clipped.
        body: SafeArea(
          child: auth.restoringKnownSession
              ? const DashboardSkeleton()
              : const SizedBox.shrink(),
        ),
      );
    }
    if (auth.orgBlockReason != null) {
      return _OrgBlockedScreen(reason: auth.orgBlockReason!);
    }
    return auth.loggedIn ? const Shell() : const LoginScreen();
  }
}

class _OrgBlockedScreen extends StatelessWidget {
  final String reason;
  const _OrgBlockedScreen({required this.reason});

  @override
  Widget build(BuildContext context) {
    final trial = reason == 'TRIAL_EXPIRED';
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                trial ? Icons.hourglass_bottom_rounded : Icons.block_rounded,
                size: 56,
                color: AppColors.danger,
              ),
              const SizedBox(height: 16),
              Text(
                trial ? 'Your trial has expired' : 'Organisation inactive',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                trial
                    ? 'Please upgrade your plan on the web dashboard to continue.'
                    : 'Your organisation account is inactive. Contact support.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
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
