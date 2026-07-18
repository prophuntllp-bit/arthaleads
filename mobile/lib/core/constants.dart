import 'package:flutter/material.dart';

/// Option lists mirrored from frontend/src/utils/constants.js and Leads.jsx.
const statusOptions = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed Won', 'Closed Lost'];

const sourceOptions = [
  'Facebook', 'Google', 'WhatsApp', 'Manual', 'Website', 'Referral',
  'Walk-in', 'PropTiger', '99acres', 'MagicBricks', 'Other',
];

const priorityOptions = ['Low', 'Medium', 'High', 'Hot'];

const propertyTypes = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office', 'Penthouse', 'Other'];

const bhkOptions = ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Studio', 'N/A'];

const purposeOptions = ['Buy', 'Rent', 'Invest', 'N/A'];

class BookingOption {
  final String value;
  final String label;
  final Color? color;
  const BookingOption(this.value, this.label, this.color);
}

const bookingOptions = [
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
