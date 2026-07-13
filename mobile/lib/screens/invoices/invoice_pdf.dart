import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// Builds a branded tax-invoice PDF matching the web app's SimpleInvoicePDF /
/// DetailedInvoicePDF layout (frontend/src/pages/Invoices.jsx) — letterhead,
/// GST breakdown, amount in words, bank details, signatory block.

String fmtINR(num? n) {
  final v = n ?? 0;
  final s = v.toStringAsFixed(2);
  final parts = s.split('.');
  var whole = parts[0].replaceFirst('-', '');
  final buf = StringBuffer();
  if (whole.length > 3) {
    final last3 = whole.substring(whole.length - 3);
    var rest = whole.substring(0, whole.length - 3);
    final groups = <String>[];
    while (rest.length > 2) {
      groups.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) groups.insert(0, rest);
    buf.write(groups.join(','));
    buf.write(',');
    buf.write(last3);
  } else {
    buf.write(whole);
  }
  return '${v < 0 ? '-' : ''}₹$buf.${parts[1]}';
}

const _ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const _tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

String _twoDigits(int n) {
  if (n < 20) return _ones[n];
  return _tens[n ~/ 10] + (n % 10 != 0 ? ' ${_ones[n % 10]}' : '');
}

String _threeDigits(int n) {
  if (n >= 100) return '${_ones[n ~/ 100]} Hundred${n % 100 != 0 ? ' ${_twoDigits(n % 100)}' : ''}';
  return _twoDigits(n);
}

String _toWords(int n) {
  if (n == 0) return 'Zero';
  final parts = <String>[];
  final crore = n ~/ 10000000;
  n %= 10000000;
  final lakh = n ~/ 100000;
  n %= 100000;
  final thousand = n ~/ 1000;
  n %= 1000;
  final rest = n;
  if (crore != 0) parts.add('${_threeDigits(crore)} Crore');
  if (lakh != 0) parts.add('${_threeDigits(lakh)} Lakh');
  if (thousand != 0) parts.add('${_threeDigits(thousand)} Thousand');
  if (rest != 0) parts.add(_threeDigits(rest));
  return parts.join(' ');
}

String amountInWords(num? totalBill) {
  final total = totalBill ?? 0;
  final numPart = total.round();
  final paisa = ((total - numPart) * 100).round();
  var w = 'Rupees ${_toWords(numPart)}';
  if (paisa != 0) w += ' and ${_toWords(paisa)} Paise';
  return '$w Only.';
}

String _fmtDate(dynamic d) {
  if (d == null) return '-';
  final dt = DateTime.tryParse(d.toString());
  if (dt == null) return '-';
  return DateFormat('dd MMMM yyyy').format(dt);
}

PdfColor _brandColor(Map<String, dynamic>? org) {
  final hex = org?['brandColor'] as String?;
  if (hex != null && RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) {
    return PdfColor.fromHex(hex);
  }
  return PdfColor.fromHex('#FF6B00');
}

/// Downloads the org logo (if any) so it can be embedded in the PDF.
/// Falls back to null (a colored initial badge is drawn instead) on failure.
Future<Uint8List?> _fetchLogoBytes(String? url) async {
  if (url == null || url.isEmpty) return null;
  try {
    final res = await Dio().get<List<int>>(
      url,
      options: Options(responseType: ResponseType.bytes, receiveTimeout: const Duration(seconds: 8)),
    );
    final data = res.data;
    if (res.statusCode == 200 && data != null) return Uint8List.fromList(data);
  } catch (_) {}
  return null;
}

Future<Uint8List> buildInvoicePdf({
  required Map<String, dynamic> inv,
  required Map<String, dynamic>? org,
}) async {
  final doc = pw.Document();
  final brand = _brandColor(org);
  final logoBytes = await _fetchLogoBytes(org?['logo'] as String?);
  final logoImage = logoBytes != null ? pw.MemoryImage(logoBytes) : null;

  final invNumber = (inv['customInvoiceNumber'] as String?)?.isNotEmpty == true
      ? inv['customInvoiceNumber']
      : '${inv['invoiceNumber'] ?? ''}';
  final gstType = inv['gstType'] as String? ?? 'CGST+SGST';
  final isIgst = gstType == 'IGST';

  final orgName = org?['name'] as String? ?? '';
  final orgAddress = org?['address'] as String?;
  final orgPhone = org?['phone'] as String?;
  final orgEmail = org?['email'] as String?;
  final orgGst = org?['gstNo'] as String?;
  final orgPan = org?['pan'] as String?;
  final orgRera = org?['rera'] as String?;

  pw.Widget cell(String text, {bool bold = false, double size = 9, PdfColor? color, pw.TextAlign align = pw.TextAlign.left}) {
    return pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(fontSize: size, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal, color: color));
  }

  pw.Widget letterhead() {
    return pw.Column(children: [
      pw.Container(height: 4, color: brand),
      pw.Container(
        padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: PdfColor.fromInt(0xFFE2E8F0))),
        ),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Row(children: [
              if (logoImage != null)
                pw.Container(height: 34, width: 70, child: pw.Image(logoImage, fit: pw.BoxFit.contain))
              else
                pw.Container(
                  height: 34, width: 34,
                  decoration: pw.BoxDecoration(color: brand, borderRadius: pw.BorderRadius.circular(6)),
                  alignment: pw.Alignment.center,
                  child: pw.Text(orgName.isNotEmpty ? orgName[0].toUpperCase() : '?',
                      style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 16)),
                ),
              pw.SizedBox(width: 10),
              pw.Text(orgName, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 15)),
            ]),
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                color: const PdfColor.fromInt(0xFF1E293B),
                child: pw.Text('TAX INVOICE',
                    style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 9)),
              ),
              pw.SizedBox(height: 3),
              pw.Text('No. $invNumber   |   ${_fmtDate(inv['invoiceDate'])}',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColor.fromInt(0xFF64748B))),
            ]),
          ],
        ),
      ),
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        color: const PdfColor.fromInt(0xFFF8FAFC),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Wrap(spacing: 14, children: [
            if (orgAddress != null && orgAddress.isNotEmpty) cell(orgAddress, size: 8),
            if (orgPhone != null && orgPhone.isNotEmpty) cell(orgPhone, size: 8),
            if (orgEmail != null && orgEmail.isNotEmpty) cell(orgEmail, size: 8),
          ]),
          pw.Wrap(spacing: 14, children: [
            if (orgGst != null && orgGst.isNotEmpty) cell('GST: $orgGst', size: 8, bold: true),
            if (orgPan != null && orgPan.isNotEmpty) cell('PAN: $orgPan', size: 8, bold: true),
            if (orgRera != null && orgRera.isNotEmpty) cell('RERA: $orgRera', size: 8, bold: true),
          ]),
        ]),
      ),
    ]);
  }

  final tableBorder = pw.TableBorder.all(color: const PdfColor.fromInt(0xFFE2E8F0), width: 0.5);

  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(0),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          letterhead(),
          pw.Padding(
            padding: const pw.EdgeInsets.all(18),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Bill To + Invoice details
                pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Expanded(
                    flex: 2,
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(10),
                      color: const PdfColor.fromInt(0xFFF8FAFC),
                      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                        cell('BILL TO', size: 7, color: const PdfColor.fromInt(0xFF94A3B8)),
                        pw.SizedBox(height: 3),
                        cell(inv['developerName'] as String? ?? '', bold: true, size: 11),
                        if ((inv['developerAddress'] as String? ?? '').isNotEmpty)
                          cell(inv['developerAddress'] as String, size: 8, color: const PdfColor.fromInt(0xFF64748B)),
                        if ((inv['developerGst'] as String? ?? '').isNotEmpty)
                          cell('GSTIN: ${inv['developerGst']}', size: 8),
                        if ((inv['developerPan'] as String? ?? '').isNotEmpty)
                          cell('PAN: ${inv['developerPan']}', size: 8),
                      ]),
                    ),
                  ),
                  pw.SizedBox(width: 10),
                  pw.Expanded(
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(10),
                      color: const PdfColor.fromInt(0xFFF8FAFC),
                      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                        cell('INVOICE DETAILS', size: 7, color: const PdfColor.fromInt(0xFF94A3B8)),
                        pw.SizedBox(height: 3),
                        _kv('Invoice No', invNumber),
                        _kv('Date', _fmtDate(inv['invoiceDate'])),
                        _kv('GST Type', gstType),
                      ]),
                    ),
                  ),
                ]),
                pw.SizedBox(height: 10),

                // Subject
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: pw.BoxDecoration(
                    color: const PdfColor.fromInt(0xFFF8FAFC),
                    border: pw.Border(left: pw.BorderSide(color: brand, width: 3)),
                  ),
                  child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                    pw.Text(
                      'Brokerage for ${inv['unitType'] ?? ''} ${inv['unitNo'] ?? ''}'
                      '${(inv['tower'] as String? ?? '').isNotEmpty ? ' / Tower ${inv['tower']}' : ''}'
                      '${(inv['phase'] as String? ?? '').isNotEmpty ? ' / Phase ${inv['phase']}' : ''}'
                      ' at ${inv['projectName'] ?? ''}',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
                    ),
                    pw.Text(
                      'Customer: ${inv['customerName'] ?? ''}'
                      '${(inv['jointBuyerName'] as String? ?? '').isNotEmpty ? ' / ${inv['jointBuyerName']}' : ''}',
                      style: const pw.TextStyle(fontSize: 8, color: PdfColor.fromInt(0xFF64748B)),
                    ),
                  ]),
                ),
                pw.SizedBox(height: 10),

                // Charges table
                pw.Table(
                  border: tableBorder,
                  columnWidths: const {0: pw.FixedColumnWidth(28), 1: pw.FlexColumnWidth(), 2: pw.FixedColumnWidth(90)},
                  children: [
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF1E293B)),
                      children: [
                        _th('Sr.', align: pw.TextAlign.center),
                        _th('Description'),
                        _th('Amount (₹)', align: pw.TextAlign.right),
                      ],
                    ),
                    pw.TableRow(children: [
                      _td('1', align: pw.TextAlign.center),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(5),
                        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                          pw.Text('Brokerage Charges', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                          if ((inv['brokerageAdjustment'] as num? ?? 0) > 0)
                            cell('Less adjustment: ${fmtINR(inv['brokerageAdjustment'] as num?)}', size: 8, color: const PdfColor.fromInt(0xFF64748B)),
                          if ((inv['fosIncentive'] as num? ?? 0) > 0)
                            cell('FOS Incentive: ${fmtINR(inv['fosIncentive'] as num?)}', size: 8, color: const PdfColor.fromInt(0xFF64748B)),
                          if ((inv['eoiIncentive'] as num? ?? 0) > 0)
                            cell('EOI Incentive: ${fmtINR(inv['eoiIncentive'] as num?)}', size: 8, color: const PdfColor.fromInt(0xFF64748B)),
                        ]),
                      ),
                      _td(fmtINR(inv['totalBrokerage'] as num?), align: pw.TextAlign.right, bold: true),
                    ]),
                    if (!isIgst) ...[
                      pw.TableRow(children: [_td(''), _td('CGST @ 9%'), _td(fmtINR(inv['cgst'] as num?), align: pw.TextAlign.right)]),
                      pw.TableRow(children: [_td(''), _td('SGST @ 9%'), _td(fmtINR(inv['sgst'] as num?), align: pw.TextAlign.right)]),
                    ] else
                      pw.TableRow(children: [_td(''), _td('IGST @ 18%'), _td(fmtINR(inv['igst'] as num?), align: pw.TextAlign.right)]),
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF1E293B)),
                      children: [
                        pw.SizedBox(),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(5),
                          child: pw.Text('GRAND TOTAL',
                              textAlign: pw.TextAlign.right,
                              style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(5),
                          child: pw.Text(fmtINR(inv['totalBill'] as num?),
                              textAlign: pw.TextAlign.right,
                              style: pw.TextStyle(color: brand, fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        ),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 6),
                pw.Text('Amount in Words: ${amountInWords(inv['totalBill'] as num?)}',
                    style: pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic, color: const PdfColor.fromInt(0xFF64748B))),
                pw.SizedBox(height: 12),

                // Payment + signatory
                pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Expanded(
                    flex: 2,
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(10),
                      color: const PdfColor.fromInt(0xFFF8FAFC),
                      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                        cell('Payment Details', bold: true, size: 9),
                        pw.SizedBox(height: 4),
                        if ((org?['bankAccountName'] as String? ?? '').isNotEmpty) _kv('Account Name', org!['bankAccountName']),
                        if ((org?['bankAccountNo'] as String? ?? '').isNotEmpty) _kv('Account No.', org!['bankAccountNo']),
                        if ((org?['bankIfsc'] as String? ?? '').isNotEmpty) _kv('IFSC Code', org!['bankIfsc']),
                        if ((org?['bankName'] as String? ?? '').isNotEmpty)
                          _kv('Bank / Branch', [org?['bankName'], org?['bankBranch']].where((e) => e != null && (e as String).isNotEmpty).join(', ')),
                      ]),
                    ),
                  ),
                  pw.SizedBox(width: 10),
                  pw.Expanded(
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(10),
                      decoration: pw.BoxDecoration(border: pw.Border.all(color: const PdfColor.fromInt(0xFFE2E8F0))),
                      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                        cell('For $orgName', size: 8, color: const PdfColor.fromInt(0xFF94A3B8)),
                        pw.SizedBox(height: 36),
                        pw.Container(
                          decoration: const pw.BoxDecoration(
                            border: pw.Border(top: pw.BorderSide(color: PdfColor.fromInt(0xFFCBD5E1))),
                          ),
                          padding: const pw.EdgeInsets.only(top: 3),
                          child: cell('Authorized Signatory', size: 8, color: const PdfColor.fromInt(0xFF64748B)),
                        ),
                      ]),
                    ),
                  ),
                ]),
                pw.SizedBox(height: 16),

                // Footer
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  color: const PdfColor.fromInt(0xFF1E293B),
                  child: pw.Text(
                    [orgAddress, orgPhone, orgEmail].where((e) => e != null && e.isNotEmpty).join('   ·   '),
                    textAlign: pw.TextAlign.center,
                    style: const pw.TextStyle(fontSize: 8, color: PdfColor.fromInt(0xFF94A3B8)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  return doc.save();
}

pw.Widget _kv(String k, dynamic v) {
  return pw.Padding(
    padding: const pw.EdgeInsets.only(bottom: 2),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(k, style: const pw.TextStyle(fontSize: 8.5, color: PdfColor.fromInt(0xFF64748B))),
        pw.Text('$v', style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
      ],
    ),
  );
}

pw.Widget _th(String text, {pw.TextAlign align = pw.TextAlign.left}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 9)),
  );
}

pw.Widget _td(String text, {pw.TextAlign align = pw.TextAlign.left, bool bold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
  );
}
