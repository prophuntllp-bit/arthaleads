import 'dart:convert';
import 'dart:io';

import 'package:excel/excel.dart' as xlsx;

/// Ports `frontend/src/pages/ProjectDetail.jsx`'s `parseRow`: fuzzy
/// alias-based column matching for project-lead imports (name/phone/email/
/// source only — ProjectLead has no status/priority/property fields).
/// Supports .csv/.txt (incl. UTF-16 exports) and .xlsx/.xls, same as the
/// plain-Leads importer in `lead_import.dart`.

class ProjectImportResult {
  final List<Map<String, dynamic>> rows;
  final int skipped;
  const ProjectImportResult(this.rows, this.skipped);
}

class ProjectImportEmptyException implements Exception {
  final String message;
  const ProjectImportEmptyException(this.message);
  @override
  String toString() => message;
}

// Mirrors web's STANDARD_IMPORT_KEYS — headers that are "known" contact
// fields and should NOT be folded into remarkNote as an unrecognized extra.
const _standardKeys = {
  'full name', 'full_name', 'name', 'names', 'customer name', 'lead name',
  'contact name', 'client name', 'prospect name',
  'first name', 'first_name', 'firstname', 'fname', 'given name', 'given_name',
  'last name', 'last_name', 'lastname', 'lname', 'surname', 'family name', 'family_name',
  'phone number', 'phone_number', 'phone', 'mobile', 'contact',
  'mobile number', 'ph', 'number', 'mob', 'whatsapp', 'contact number', 'cell',
  'mobile no', 'mobile no.', 'phone no', 'phone no.', 'cell phone',
  'cell no', 'telephone', 'tel', 'contact no', 'contact no.',
  'email', 'email address', 'email_address', 'mail',
  'source', 'lead source',
};

String _cleanPhone(String raw) => raw
    .replaceAll(RegExp(r'^(?:p|ph|tel|mob|mobile|phone)\s*:\s*', caseSensitive: false), '')
    .replaceAll(RegExp(r'\s+'), '')
    .trim();

Map<String, dynamic> _parseRow(Map<String, dynamic> raw) {
  final r = <String, String>{};
  raw.forEach((k, v) => r[k.trim().toLowerCase()] = (v ?? '').toString().trim());

  String fuzzy(List<String> substrings) {
    for (final sub in substrings) {
      final key = r.keys.firstWhere((k) => k.contains(sub), orElse: () => '');
      if (key.isNotEmpty && (r[key] ?? '').isNotEmpty) return r[key]!;
    }
    return '';
  }

  final firstName = r['first name'] ?? r['first_name'] ?? r['firstname'] ?? r['fname'] ?? r['given name'] ?? r['given_name'] ?? '';
  final lastName = r['last name'] ?? r['last_name'] ?? r['lastname'] ?? r['lname'] ?? r['surname'] ?? r['family name'] ?? r['family_name'] ?? '';
  final splitName = [firstName, lastName].where((s) => s.isNotEmpty).join(' ');

  final name = r['full_name'] ?? r['full name'] ?? r['name'] ?? r['names'] ??
      r['customer name'] ?? r['lead name'] ?? r['contact name'] ??
      r['client name'] ?? r['prospect name'] ??
      (splitName.isNotEmpty ? splitName : fuzzy(['name']));

  final rawPhone = r['phone_number'] ?? r['phone number'] ?? r['phone'] ?? r['mobile'] ??
      r['contact'] ?? r['mobile number'] ?? r['ph'] ?? r['number'] ?? r['mob'] ??
      r['whatsapp'] ?? r['contact number'] ?? r['cell'] ?? r['mobile no'] ??
      r['mobile no.'] ?? r['phone no'] ?? r['phone no.'] ?? r['cell phone'] ??
      r['cell no'] ?? r['telephone'] ?? r['tel'] ?? r['contact no'] ?? r['contact no.'] ??
      fuzzy(['phone', 'mobile', 'cell', 'tel', 'whatsapp', 'contact no', 'mob no']);
  final phone = _cleanPhone(rawPhone);

  final email = r['email_address'] ?? r['email address'] ?? r['email'] ?? r['mail'] ?? fuzzy(['email', 'mail']);
  final source = r['source'] ?? r['lead source'] ?? 'Manual';

  final extras = r.entries
      .where((e) => !_standardKeys.contains(e.key) && e.value.isNotEmpty)
      .map((e) => '${e.key.replaceAll('_', ' ')}: ${e.value}')
      .join(' · ');

  return {
    'name': name,
    'phone': phone,
    if (email.isNotEmpty) 'email': email,
    'source': source,
    'remarkNote': extras,
  };
}

String _decodeUtf16(List<int> bytes, {required bool littleEndian}) {
  final codeUnits = <int>[];
  for (var i = 0; i + 1 < bytes.length; i += 2) {
    codeUnits.add(littleEndian ? (bytes[i] | (bytes[i + 1] << 8)) : ((bytes[i] << 8) | bytes[i + 1]));
  }
  return String.fromCharCodes(codeUnits);
}

List<Map<String, dynamic>> _parseCsvText(String text) {
  final lines = text.split(RegExp(r'\r?\n')).where((l) => l.trim().isNotEmpty).toList();
  if (lines.length < 2) return [];
  final delim = lines[0].contains('\t') ? '\t' : ',';

  List<String> parseLine(String line) {
    final vals = <String>[];
    var cur = StringBuffer();
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
      final ch = line[i];
      if (ch == '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch == delim && !inQuote) {
        vals.add(cur.toString());
        cur = StringBuffer();
        continue;
      }
      cur.write(ch);
    }
    vals.add(cur.toString());
    return vals;
  }

  final headers = parseLine(lines[0]).map((h) => h.trim()).toList();
  return lines.skip(1).map((line) {
    final vals = parseLine(line);
    final obj = <String, dynamic>{};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = (i < vals.length ? vals[i] : '').trim();
    }
    return obj;
  }).toList();
}

String _cellToString(xlsx.CellValue? v) {
  if (v == null) return '';
  if (v is xlsx.TextCellValue) return v.value.toString();
  if (v is xlsx.DateCellValue) return v.asDateTimeUtc().toIso8601String();
  if (v is xlsx.DateTimeCellValue) return v.asDateTimeUtc().toIso8601String();
  if (v is xlsx.FormulaCellValue) return v.formula;
  return v.toString();
}

/// Reads a .csv/.txt or .xlsx/.xls file at [path] and returns ready-to-POST
/// project-lead rows for `/projects/:id/leads/import`. Throws
/// [ProjectImportEmptyException] with a user-facing message on no usable rows.
Future<ProjectImportResult> parseProjectLeadImportFile(String path) async {
  final isCsv = path.toLowerCase().endsWith('.csv') || path.toLowerCase().endsWith('.txt');
  List<Map<String, dynamic>> rows;

  if (isCsv) {
    final bytes = await File(path).readAsBytes();
    String text;
    if (bytes.length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE) {
      text = _decodeUtf16(bytes.sublist(2), littleEndian: true);
    } else if (bytes.length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF) {
      text = _decodeUtf16(bytes.sublist(2), littleEndian: false);
    } else {
      text = utf8.decode(bytes, allowMalformed: true);
    }
    rows = _parseCsvText(text);
  } else {
    final bytes = await File(path).readAsBytes();
    final workbook = xlsx.Excel.decodeBytes(bytes);
    if (workbook.tables.isEmpty) throw const ProjectImportEmptyException('File is empty');
    final sheet = workbook.tables.values.first;
    final excelRows = sheet.rows;
    if (excelRows.isEmpty) throw const ProjectImportEmptyException('File is empty');
    final headers = excelRows.first.map((c) => _cellToString(c?.value).trim()).toList();
    rows = excelRows.skip(1).map((r) {
      final obj = <String, dynamic>{};
      for (var i = 0; i < headers.length; i++) {
        obj[headers[i]] = i < r.length ? _cellToString(r[i]?.value) : '';
      }
      return obj;
    }).toList();
  }

  if (rows.isEmpty) throw const ProjectImportEmptyException('File is empty');

  final parsed = rows.map(_parseRow).toList();
  final valid = parsed.where((r) => (r['name'] as String).isNotEmpty && (r['phone'] as String).isNotEmpty).toList();
  if (valid.isEmpty) {
    throw const ProjectImportEmptyException('No valid leads found — check that your file has name and phone columns');
  }
  return ProjectImportResult(valid, parsed.length - valid.length);
}
