import 'package:flutter/material.dart';

/// Lead option lists.
///
/// backend/constants/leadOptions.js is the single source of truth — the Mongoose
/// enums and Joi validators derive from it, and GET /api/public/options serves
/// it. OptionsService hydrates the lists below at startup, which matters here
/// because the APK is distributed privately: an old install still picks up new
/// options without being reinstalled.
///
/// These are mutable on purpose (hydration replaces their contents in place).
/// The values are the offline fallback.
const _defaultStatusOptions = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed Won', 'Closed Lost'];
List<String> statusOptions = List.of(_defaultStatusOptions);

const _defaultSourceOptions = [
  'Facebook', 'Google', 'WhatsApp', 'Manual', 'Website', 'Custom',
  'Vistrow Voice', 'Referral', 'Walk-in', 'PropTiger', '99acres',
  'MagicBricks', 'QR Code', 'Other',
];
List<String> sourceOptions = List.of(_defaultSourceOptions);

const _defaultPriorityOptions = ['Low', 'Medium', 'High', 'Hot'];
List<String> priorityOptions = List.of(_defaultPriorityOptions);

const _defaultPropertyTypes = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office', 'Penthouse', 'Other'];
List<String> propertyTypes = List.of(_defaultPropertyTypes);

const _defaultBhkOptions = ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Studio', 'N/A'];
List<String> bhkOptions = List.of(_defaultBhkOptions);

const _defaultPurposeOptions = ['Buy', 'Rent', 'Invest', 'N/A'];
List<String> purposeOptions = List.of(_defaultPurposeOptions);

class BookingOption {
  final String value;
  final String label;
  final Color? color;
  const BookingOption(this.value, this.label, this.color);
}

const _defaultBookingOptions = [
  BookingOption('', '- None -', null),
  BookingOption('Interested', 'Interested', Color(0xFF2563EB)),
  BookingOption('Not Interested', 'Not Interested', Color(0xFFEF4444)),
  BookingOption('Not Reachable', 'Not Reachable', Color(0xFF6B7280)),
  BookingOption('Low Budget', 'Low Budget', Color(0xFFDB2777)),
  BookingOption('Call Back', 'Call Back', Color(0xFFD97706)),
  BookingOption('Site Visit Booked', 'Site Visit Booked', Color(0xFF7C3AED)),
  BookingOption('Site Visit Done', 'Site Visit Done', Color(0xFF0D9488)),
  BookingOption('Booked', 'Booked', Color(0xFF16A34A)),
  BookingOption('Other Location', 'Other Location', Color(0xFFEA580C)),
  BookingOption('Commercial', 'Commercial', Color(0xFF4F46E5)),
];
List<BookingOption> bookingOptions = List.of(_defaultBookingOptions);

/// Colour per booking value, so a value that arrives from the API still renders
/// with the right chip colour. Unknown values fall back to grey.
const bookingColors = <String, Color>{
  'Interested': Color(0xFF2563EB),
  'Not Interested': Color(0xFFEF4444),
  'Not Reachable': Color(0xFF6B7280),
  'Low Budget': Color(0xFFDB2777),
  'Call Back': Color(0xFFD97706),
  'Site Visit Booked': Color(0xFF7C3AED),
  'Site Visit Done': Color(0xFF0D9488),
  'Booked': Color(0xFF16A34A),
  'Other Location': Color(0xFFEA580C),
  'Commercial': Color(0xFF4F46E5),
};

// Matches frontend/src/pages/LeadPipeline.jsx's STAGE_META, which is the
// same status→color mapping frontend/src/utils/constants.js's STATUS_COLORS
// resolves to (blue/amber/violet/orange/emerald/rose) — kept as one shared
// map so every screen's status badge/column agrees with web.
Color statusColor(String? status) {
  switch (status) {
    case 'New':
      return const Color(0xFF38BDF8);
    case 'Contacted':
      return const Color(0xFFFBBF24);
    case 'Site Visit':
      return const Color(0xFFA78BFA);
    case 'Negotiation':
      return const Color(0xFFFB923C);
    case 'Closed Won':
      return const Color(0xFF34D399);
    case 'Closed Lost':
      return const Color(0xFFFB7185);
    default:
      return const Color(0xFF6B7280);
  }
}

Color priorityColor(String? priority) {
  switch (priority) {
    case 'Hot':
      return const Color(0xFFEF4444);
    case 'High':
      return const Color(0xFFEA580C);
    case 'Medium':
      return const Color(0xFF3B82F6);
    case 'Low':
      return const Color(0xFF6B7280);
    default:
      return const Color(0xFF6B7280);
  }
}

/// Safe string extraction from API maps — some fields (populated refs,
/// structured objects like /leads/hot `_nextAction`) arrive as Maps, and a
/// blind `as String?` cast crashes the widget tree.
String? str(dynamic v) => v is String ? v : null;

/// Compact budget: 8000000 → "80L", 10000000 → "1Cr" (mirrors fmtBudget in Leads.jsx)
String fmtBudget(num? val) {
  if (val == null || val == 0) return '';
  if (val >= 10000000) {
    final v = (val / 10000000).toStringAsFixed(2);
    return '${v.replaceAll(RegExp(r'\.?0+$'), '')}Cr';
  }
  if (val >= 100000) {
    final v = (val / 100000).toStringAsFixed(1);
    return '${v.replaceAll(RegExp(r'\.?0+$'), '')}L';
  }
  return '₹$val';
}

/// Body for POST /calls/initiate (and the WebRTC session endpoint).
///
/// Project leads live in a separate ProjectLead collection with no shared _id,
/// so the backend picks the collection purely from WHICH key it receives:
/// `projectLeadId` means ProjectLead, `leadId` means Lead. Sending `leadId` for
/// a project lead therefore looks up the wrong collection and fails with a
/// flat "Lead not found." — which is exactly what agents hit when calling from
/// inside a project.
///
/// Always build the payload with this rather than hand-writing {'leadId': ...},
/// so a new call site cannot silently reintroduce that bug.
Map<String, dynamic> callTargetPayload(Map<String, dynamic> lead) {
  final isProject = lead['_type'] == 'project' && lead['projectId'] != null;
  return isProject
      ? {'projectLeadId': lead['_id']}
      : {'leadId': lead['_id']};
}
