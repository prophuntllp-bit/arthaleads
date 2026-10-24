import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Exports land on the phone like a download (23 Oct 2026, owner): saved to
/// Downloads/ArthaLeads and opened in the spreadsheet app, instead of the
/// share sheet. A "Share" button on the note still sends the file anywhere.
/// The Android side is MainActivity.kt ("arthaleads/downloads").
class FileOutput {
  FileOutput._();

  static const _channel = MethodChannel('arthaleads/downloads');

  static Future<void> saveAndOpen(BuildContext context, Uint8List bytes, String name, String mime) async {
    // The name can come from the server or a customer's name: never a path.
    name = name.replaceAll(RegExp(r'[\\/:*?"<>|\x00-\x1F]'), '_').replaceAll('..', '_').trim();
    if (name.isEmpty) name = 'export';
    final messenger = ScaffoldMessenger.maybeOf(context);
    String where = 'Downloads/ArthaLeads';
    bool opened = false;
    String? uri;
    try {
      uri = await _channel.invokeMethod<String>('save', {'bytes': bytes, 'name': name, 'mime': mime});
    } catch (_) {
      uri = null;
    }
    if (uri != null) {
      try {
        opened = await _channel.invokeMethod<bool>('open', {'uri': uri, 'mime': mime}) ?? false;
      } catch (_) {}
    } else {
      // Android 9 and older (or Downloads refused): the app's own folder.
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$name');
      await file.writeAsBytes(bytes, flush: true);
      where = 'the app';
      final res = await OpenFile.open(file.path, type: mime);
      opened = res.type == ResultType.done;
    }
    messenger?.showSnackBar(SnackBar(
      duration: const Duration(seconds: 6),
      // A SnackBar with a button stays until tapped unless told otherwise.
      persist: false,
      content: Text(opened
          ? 'Saved to $where: $name'
          : 'Saved to $where: $name. Install Excel or Google Sheets to open it.'),
      action: SnackBarAction(
        label: 'Share',
        onPressed: () => Share.shareXFiles([XFile.fromData(bytes, name: name, mimeType: mime)], fileNameOverrides: [name]),
      ),
    ));
  }
}
