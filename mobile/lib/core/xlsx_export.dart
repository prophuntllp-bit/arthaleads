import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';

import 'api_client.dart';
import 'file_output.dart';

/// Excel exports in the ArthaLeads look (21 Oct 2026). The server builds the
/// file with the web's own style (orange header, filters, frozen header and
/// Name, source and status pills, the Summary sheet with the logo), so a file
/// from the phone and one from the web are the same:
///  - Leads:        GET  /leads/export?format=xlsx plus the list's filters
///  - Dump/project: POST /leads/export-sheet { kind, leads, prospective, filename }
/// See backend/utils/exports/leadWorkbook.js.
class XlsxExport {
  XlsxExport._();

  static const _type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  /// Downloads the Leads workbook for these filters (or `ids`), saves it to
  /// Downloads/ArthaLeads and opens it.
  static Future<void> saveLeads(BuildContext context, Map<String, dynamic> params, {required String fallbackName}) async {
    final res = await _bytes(() => ApiClient.instance.dio.get<List<int>>(
          '/leads/export',
          queryParameters: {...params, 'format': 'xlsx'},
          options: Options(responseType: ResponseType.bytes),
        ));
    if (context.mounted) await _save(context, res, fallbackName);
  }

  /// Sends rows the screen already holds (Dump Leads, a project's leads) and
  /// saves and opens the styled file that comes back.
  static Future<void> saveRows(BuildContext context, Map<String, dynamic> body, {required String fallbackName}) async {
    final res = await _bytes(() => ApiClient.instance.dio.post<List<int>>(
          '/leads/export-sheet',
          data: body,
          options: Options(responseType: ResponseType.bytes),
        ));
    if (context.mounted) await _save(context, res, fallbackName);
  }

  /// With a bytes response an error body arrives as bytes too: turn it back
  /// into JSON so ApiClient.errorMessage can read the server's message.
  static Future<Response<List<int>>> _bytes(Future<Response<List<int>>> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is List<int>) {
        try {
          final decoded = jsonDecode(utf8.decode(data));
          throw DioException(
            requestOptions: e.requestOptions,
            response: Response(requestOptions: e.requestOptions, statusCode: e.response?.statusCode, data: decoded),
            type: e.type,
          );
        } on FormatException {
          rethrow;
        }
      }
      rethrow;
    }
  }

  static Future<void> _save(BuildContext context, Response<List<int>> res, String fallbackName) async {
    final disposition = res.headers.value('content-disposition') ?? '';
    final match = RegExp(r'filename="([^"]+)"').firstMatch(disposition);
    final name = match?.group(1) ?? fallbackName;
    await FileOutput.saveAndOpen(context, Uint8List.fromList(res.data ?? const []), name, _type);
  }

  /// "Status: New · Source: Facebook · Last 30 days": the Summary sheet's
  /// Filters line, from the parts the screen knows.
  static String filtersText(List<String?> parts) {
    final kept = parts.whereType<String>().where((p) => p.trim().isNotEmpty).toList();
    return kept.isEmpty ? 'All leads, no filters' : kept.join(' · ');
  }
}
