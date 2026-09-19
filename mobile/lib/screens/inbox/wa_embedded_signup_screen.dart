import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';

/// Runs backend/views/waEmbeddedSignupPage.js (the Facebook JS SDK popup
/// flow) inside a WebView, since the app has no JS runtime of its own to
/// host the SDK. Returns {code, wabaId, phoneNumberId} via Navigator.pop
/// once the bridge page's `FlutterES` channel reports a result.
class WaEmbeddedSignupScreen extends StatefulWidget {
  final String appId;
  final String configId;
  const WaEmbeddedSignupScreen({super.key, required this.appId, required this.configId});

  @override
  State<WaEmbeddedSignupScreen> createState() => _WaEmbeddedSignupScreenState();
}

class _WaEmbeddedSignupScreenState extends State<WaEmbeddedSignupScreen> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    final base = ApiClient.instance.dio.options.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    final uri = Uri.parse('$base/wa-embedded-signup.html').replace(queryParameters: {
      'appId': widget.appId,
      'configId': widget.configId,
    });
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'FlutterES',
        onMessageReceived: (message) {
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>;
            if (mounted) Navigator.pop(context, data);
          } catch (_) {
            if (mounted) Navigator.pop(context, {'error': 'Unexpected response from WhatsApp connect.'});
          }
        },
      )
      ..loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Connect WhatsApp'),
        backgroundColor: AppTheme.of(context).surfaceSolid,
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
