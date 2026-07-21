import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:excel/excel.dart' as xlsx;

/// Ports the import pipeline from `frontend/src/pages/Leads.jsx`'s
/// `handleImport`: alias-based CRM column matching with content-inference
/// fallback, plus auto-detected Facebook Lead Form CSV parsing (budget/
/// purpose extraction, question-column → remark mapping). Supports
/// .csv/.txt (including Facebook's UTF-16 export) and .xlsx/.xls.

class ImportResult {
  final List<Map<String, dynamic>> leads;
  final String? notice;
  const ImportResult(this.leads, [this.notice]);
}

class ImportEmptyException implements Exception {
  final String message;
  const ImportEmptyException(this.message);
  @override
  String toString() => message;
}

String _normKey(String s) => s.toLowerCase().replaceAll(RegExp(r'[\s_\-().#/\\]'), '');

/// Header-lookup closure for one row — tries aliases in priority order,
/// returns the first non-empty value found (or '').
class _ColPicker {
  final Map<String, String> _map = {};
  final Map<String, dynamic> row;
  _ColPicker(this.row) {
    for (final h in row.keys) {
      _map[_normKey(h)] = h;
    }
  }

  String call(List<String> candidates) {
    for (final c in candidates) {
      final orig = _map[_normKey(c)];
      if (orig != null) {
        final v = (row[orig] ?? '').toString().trim();
        if (v.isNotEmpty) return v;
      }
    }
    return '';
  }
}

/// Content-based column inference: scan up to 10 rows to find which header
/// matches name/phone/email by the shape of values when alias lookup fails.
String? _inferColByContent(List<Map<String, dynamic>> rows, String type) {
  if (rows.isEmpty) return null;
  final headers = rows.first.keys.toList();
  final sample = rows.take(10).toList();
  int score(String header) {
    var hits = 0;
    for (final r in sample) {
      final v = (r[header] ?? '').toString().trim();
      if (v.isEmpty) continue;
      if (type == 'name' && RegExp(r"^[A-Za-z\s'.\-]{2,60}$").hasMatch(v) && !RegExp(r'\d').hasMatch(v)) {
        hits++;
      }
      if (type == 'phone' && RegExp(r'^\+?[\d\s\-()]{8,16}$').hasMatch(v.replaceAll(' ', ''))) hits++;
      if (type == 'email' && v.contains('@') && v.contains('.')) hits++;
    }
    return hits;
  }

  String? best;
  var bestScore = 1;
  for (final h in headers) {
    final s = score(h);
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

Map<String, dynamic> _parseImportRow(
  Map<String, dynamic> row,
  List<Map<String, dynamic>> agents, {
  Map<String, String?> inferredCols = const {},
}) {
  final col = _ColPicker(row);

  final firstName = col(['First Name', 'FirstName', 'FName', 'Given Name', 'GivenName']);
  final lastName = col(['Last Name', 'LastName', 'LName', 'Surname', 'Family Name', 'FamilyName']);
  final splitName = [firstName, lastName].where((s) => s.isNotEmpty).join(' ');

  var name = col([
    'Lead Name', 'LeadName', 'Full Name', 'FullName', 'Name', 'Names', 'Customer Name', 'CustomerName',
    'Contact Name', 'ContactName', 'Client Name', 'ClientName', 'User Name', 'UserName',
    'Prospect', 'Party', 'Buyer', 'Person', 'Contact', 'Customer',
  ]);
  if (name.isEmpty) name = splitName;
  if (name.isEmpty && inferredCols['name'] != null) {
    name = (row[inferredCols['name']] ?? '').toString().trim();
  }

  var phone = col([
    'Phone', 'Phone Number', 'PhoneNumber', 'Mobile', 'Mobile Number', 'MobileNumber',
    'Contact Number', 'ContactNumber', 'Cell', 'WhatsApp', 'Whatsapp Number', 'WhatsappNumber',
    'Mob', 'Tel', 'Telephone',
  ]);
  if (phone.isEmpty && inferredCols['phone'] != null) {
    phone = (row[inferredCols['phone']] ?? '').toString().trim();
  }

  var email = col(['Email', 'Email Address', 'EmailAddress', 'Email ID', 'EmailID', 'Mail', 'E-mail', 'E Mail']);
  if (email.isEmpty && inferredCols['email'] != null) {
    email = (row[inferredCols['email']] ?? '').toString().trim();
  }

  final agentName = col(['Agent', 'Assigned To', 'AssignedTo', 'Assigned Agent', 'AssignedAgent', 'Salesperson', 'Sales Person']);
  Map<String, dynamic>? assignedAgent;
  if (agentName.isNotEmpty) {
    for (final a in agents) {
      if ((a['name'] as String? ?? '').toLowerCase() == agentName.toLowerCase()) {
        assignedAgent = a;
        break;
      }
    }
  }

  final budgetSingle = col(['Budget', 'Budget Range', 'BudgetRange']);
  final budgetMin = double.tryParse(col(['Budget Min', 'BudgetMin', 'Min Budget', 'MinBudget'])) ?? 0;
  final budgetMaxRaw = col(['Budget Max', 'BudgetMax', 'Max Budget', 'MaxBudget']);
  final budgetMax = double.tryParse(budgetMaxRaw.isNotEmpty ? budgetMaxRaw : budgetSingle) ?? 0;

  final fuRaw = col([
    'Follow Up Date', 'FollowUpDate', 'Follow-Up Date', 'Followup Date', 'FollowupDate',
    'Next Followup', 'NextFollowup',
  ]);
  String? followUpDate;
  if (fuRaw.isNotEmpty) {
    final n = double.tryParse(fuRaw);
    if (n != null && n > 40000) {
      // Excel serial date -> JS/epoch date, same conversion as web.
      final d = DateTime.fromMillisecondsSinceEpoch(((n - 25569) * 86400 * 1000).round(), isUtc: true);
      followUpDate = d.toIso8601String();
    } else {
      final parsed = DateTime.tryParse(fuRaw);
      if (parsed != null) followUpDate = parsed.toIso8601String();
    }
  }

  final source = col(['Source', 'Lead Source', 'LeadSource']);
  final status = col(['Status', 'Lead Status', 'LeadStatus']);
  final priority = col(['Priority', 'Lead Priority', 'LeadPriority']);
  final propertyType = col(['Property Type', 'PropertyType', 'Requirements', 'Requirement', 'Property', 'Type']);
  final bhk = col(['BHK', 'Bhk', 'Configuration', 'Config']);
  final purpose = col(['Purpose', 'Requirement Type', 'RequirementType', 'Intent']);
  final preferredLocation = col(['Area', 'Location', 'Preferred Location', 'PreferredLocation', 'City', 'Locality']);
  final followUpNote = col(['Follow Up Note', 'FollowUpNote', 'Remark', 'Remarks', 'Note', 'Notes', 'Comment']);

  return {
    'name': name,
    'phone': phone,
    if (email.isNotEmpty) 'email': email,
    'source': source.isNotEmpty ? source : 'Manual',
    'status': status.isNotEmpty ? status : 'New',
    'priority': priority.isNotEmpty ? priority : 'Medium',
    'propertyType': propertyType.isNotEmpty ? propertyType : 'Apartment',
    'bhk': bhk.isNotEmpty ? bhk : 'N/A',
    'purpose': purpose.isNotEmpty ? purpose : 'Buy',
    if (preferredLocation.isNotEmpty) 'preferredLocation': preferredLocation,
    if (followUpDate != null) 'followUpDate': followUpDate,
    if (followUpNote.isNotEmpty) 'followUpNote': followUpNote,
    if (assignedAgent != null) 'assignedTo': assignedAgent['_id'],
    'budget': {'min': budgetMin.round(), 'max': budgetMax.round(), 'currency': 'INR'},
  };
}

// ── Facebook Lead Form CSV parser ───────────────────────────────────────────
const _fbMeta = {
  'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform',
  'lead_status',
};
const _fbContact = {'full_name', 'phone_number', 'phone', 'email', 'street_address', 'city'};

bool _isFbCsv(List<String> headers) =>
    headers.contains('full_name') && (headers.contains('phone_number') || headers.contains('phone'));

String _fbClean(String v) => v.replaceAll('_', ' ').replaceAll(RegExp(r'\s+'), ' ').trim();

Map<String, int> _parseFbBudget(String v) {
  final s = v.replaceAll(RegExp(r'[₹,\s]'), '').toLowerCase();
  final parts = s.split(RegExp(r'[–\-]+'));
  int toINR(String p) {
    final cleaned = p.replaceAll(RegExp(r'^_+|_+$'), '');
    final n = double.tryParse(cleaned);
    if (n == null || n == 0) return 0;
    if (cleaned.contains('cr')) return (n * 10000000).round();
    if (cleaned.contains('lakh') || cleaned.contains('lac') || cleaned.endsWith('l')) return (n * 100000).round();
    return n.round();
  }

  final min = toINR(parts.isNotEmpty ? parts[0] : '');
  final max = toINR(parts.length > 1 ? parts[1] : (parts.isNotEmpty ? parts[0] : ''));
  return {'min': min, 'max': max};
}

String _parseFbPurpose(String v) {
  final s = v.toLowerCase();
  if (s.contains('invest')) return 'Invest';
  if (s.contains('rent')) return 'Rent';
  return 'Buy';
}

Map<String, dynamic> _parseFbRow(Map<String, dynamic> row, List<String> questionCols) {
  final location = [row['street_address'], row['city']]
      .map((s) => _fbClean((s ?? '').toString()))
      .where((s) => s.isNotEmpty)
      .join(', ');

  var purpose = 'Buy';
  var budget = {'min': 0, 'max': 0};
  var followUpNote = '';
  final extras = <String>[];

  for (final col in questionCols) {
    final raw = (row[col] ?? '').toString().trim();
    if (raw.isEmpty) continue;
    final colLower = col.toLowerCase();
    if (colLower.contains('budget')) {
      budget = _parseFbBudget(raw);
    } else if (colLower.contains('purpose')) {
      purpose = _parseFbPurpose(raw);
    } else if (colLower.contains('when') || colLower.contains('plan') || colLower.contains('timeline') || colLower.contains('time')) {
      followUpNote = _fbClean(raw);
    } else {
      final label = col.replaceAll('_', ' ').replaceAll(RegExp(r'\?$'), '').trim();
      extras.add('$label: ${_fbClean(raw)}');
    }
  }

  final email = (row['email'] ?? '').toString().trim();

  return {
    'name': (row['full_name'] ?? '').toString().replaceAll(RegExp(r'^"|"$'), '').trim(),
    'phone': (row['phone_number'] ?? row['phone'] ?? '').toString().replaceFirst(RegExp('^p:', caseSensitive: false), '').trim(),
    if (email.isNotEmpty) 'email': email,
    'source': 'Facebook',
    if (location.isNotEmpty) 'preferredLocation': location,
    'purpose': purpose,
    'budget': {'min': budget['min'], 'max': budget['max'], 'currency': 'INR'},
    if (followUpNote.isNotEmpty) 'followUpNote': followUpNote,
    if (extras.isNotEmpty) 'remark': extras.join(' | '),
    'status': 'New',
    'priority': 'Medium',
  };
}

// ── Native CSV/TSV parser (handles quoted values, comma or tab delimiter) ──
List<Map<String, dynamic>> _parseCsvText(String text) {
  final lines = text.split(RegExp(r'\r?\n')).where((l) => l.trim().isNotEmpty).toList();
  if (lines.length < 2) return [];
  final delim = lines[0].contains('\t') ? '\t' : ',';

  List<String> parseRow(String line) {
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

  final headers = parseRow(lines[0]).map((h) => h.trim()).toList();
  return lines.skip(1).map((line) {
    final vals = parseRow(line);
    final obj = <String, dynamic>{};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = (i < vals.length ? vals[i] : '').trim();
    }
    return obj;
  }).toList();
}

String _decodeUtf16(Uint8List bytes, {required bool littleEndian}) {
  final codeUnits = <int>[];
  for (var i = 0; i + 1 < bytes.length; i += 2) {
    codeUnits.add(littleEndian ? (bytes[i] | (bytes[i + 1] << 8)) : ((bytes[i] << 8) | bytes[i + 1]));
  }
  return String.fromCharCodes(codeUnits);
}

String _cellToString(xlsx.CellValue? v) {
  if (v == null) return '';
  if (v is xlsx.TextCellValue) return v.value.toString();
  if (v is xlsx.DateCellValue) return v.asDateTimeUtc().toIso8601String();
  if (v is xlsx.DateTimeCellValue) return v.asDateTimeUtc().toIso8601String();
  if (v is xlsx.FormulaCellValue) return v.formula;
  return v.toString();
}

/// Reads a .csv/.txt or .xlsx/.xls file at [path], auto-detects the format
/// (Facebook Lead Form export vs. generic CRM export) and returns
/// ready-to-POST lead maps for `/leads/import`. Throws [ImportEmptyException]
/// with a user-facing message when the file has no usable rows.
Future<ImportResult> parseLeadImportFile(String path, List<Map<String, dynamic>> agents) async {
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
    if (workbook.tables.isEmpty) throw const ImportEmptyException('File is empty');
    final sheet = workbook.tables.values.first;
    final excelRows = sheet.rows;
    if (excelRows.isEmpty) throw const ImportEmptyException('File is empty');
    final headers = excelRows.first.map((c) => _cellToString(c?.value).trim()).toList();
    rows = excelRows.skip(1).map((r) {
      final obj = <String, dynamic>{};
      for (var i = 0; i < headers.length; i++) {
        obj[headers[i]] = i < r.length ? _cellToString(r[i]?.value) : '';
      }
      return obj;
    }).toList();
  }

  if (rows.isEmpty) throw const ImportEmptyException('File is empty');

  final headers = rows.first.keys.toList();
  List<Map<String, dynamic>> leadsToImport;
  String? notice;

  if (_isFbCsv(headers)) {
    final questionCols = headers.where((h) => !_fbMeta.contains(h) && !_fbContact.contains(h)).toList();
    final realRows = rows
        .where((row) => !row.values.any((v) => v is String && v.contains('<test lead')))
        .toList();
    leadsToImport = realRows
        .map((r) => _parseFbRow(r, questionCols))
        .where((e) => (e['name'] as String).isNotEmpty && (e['phone'] as String).isNotEmpty)
        .toList();
    if (leadsToImport.isEmpty) throw const ImportEmptyException('No valid leads in the Facebook export');
    notice = 'Facebook format detected — ${questionCols.length} custom question(s) mapped';
  } else {
    var parsed = rows.map((r) => _parseImportRow(r, agents)).toList();
    final firstPassValid =
        parsed.where((e) => (e['name'] as String).isNotEmpty && (e['phone'] as String).isNotEmpty).toList();

    if (firstPassValid.isEmpty) {
      final inferredCols = {
        'name': _inferColByContent(rows, 'name'),
        'phone': _inferColByContent(rows, 'phone'),
        'email': _inferColByContent(rows, 'email'),
      };
      if (inferredCols['name'] != null || inferredCols['phone'] != null) {
        parsed = rows.map((r) => _parseImportRow(r, agents, inferredCols: inferredCols)).toList();
        final inferred =
            parsed.where((e) => (e['name'] as String).isNotEmpty && (e['phone'] as String).isNotEmpty).toList();
        if (inferred.isNotEmpty) {
          final detected = inferredCols.entries
              .where((e) => e.value != null)
              .map((e) => '${e.key}="${e.value}"')
              .join(', ');
          notice = 'Auto-detected columns: $detected';
          leadsToImport = inferred;
        } else {
          leadsToImport = const [];
        }
      } else {
        leadsToImport = const [];
      }
    } else {
      leadsToImport = firstPassValid;
    }

    if (leadsToImport.isEmpty) {
      throw const ImportEmptyException('No valid leads found — check that your file has name and phone columns');
    }
  }

  return ImportResult(leadsToImport, notice);
}
