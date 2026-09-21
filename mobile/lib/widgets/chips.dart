import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../core/constants.dart';
import 'badges.dart';

class StatusChip extends StatelessWidget {
  final String? status;
  const StatusChip(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    if (status == null || status!.isEmpty) return const SizedBox.shrink();
    return Pill(status!, statusColor(status));
  }
}

class PriorityChip extends StatelessWidget {
  final String? priority;
  const PriorityChip(this.priority, {super.key});

  @override
  Widget build(BuildContext context) {
    if (priority == null || priority!.isEmpty) return const SizedBox.shrink();
    return Pill(priority!, priorityColor(priority));
  }
}

class BookingChip extends StatelessWidget {
  final String? booking;
  const BookingChip(this.booking, {super.key});

  @override
  Widget build(BuildContext context) {
    if (booking == null || booking!.isEmpty) return const SizedBox.shrink();
    final opt = bookingOptions.where((o) => o.value == booking).firstOrNull;
    return Pill(booking!, opt?.color ?? const Color(0xFF6B7280));
  }
}

/// Lead source as a solid coloured pill with the source's own logo, so the
/// origin of a lead reads at a glance. Colours match the web's source badges.
/// Brand logos come from Font Awesome; real-estate portals (PropTiger, 99acres,
/// MagicBricks) have no logo there, so they get a house icon in their brand colour.
class SourceChip extends StatelessWidget {
  final String? source;
  const SourceChip(this.source, {super.key});

  static const _style = <String, (Color, FaIconData)>{
    'Facebook': (Color(0xFF1877F2), FontAwesomeIcons.facebookF),
    'Google': (Color(0xFF4285F4), FontAwesomeIcons.google),
    'WhatsApp': (Color(0xFF2AB540), FontAwesomeIcons.whatsapp),
    'Manual': (Color(0xFF64748B), FontAwesomeIcons.penToSquare),
    'Website': (Color(0xFFF88025), FontAwesomeIcons.globe),
    'Custom': (Color(0xFF14B8A6), FontAwesomeIcons.puzzlePiece),
    'Referral': (Color(0xFF9333EA), FontAwesomeIcons.userGroup),
    'Walk-in': (Color(0xFFD97706), FontAwesomeIcons.personWalking),
    'PropTiger': (Color(0xFFDC2626), FontAwesomeIcons.house),
    '99acres': (Color(0xFF65A30D), FontAwesomeIcons.house),
    'MagicBricks': (Color(0xFF4F46E5), FontAwesomeIcons.house),
    'QR Code': (Color(0xFF1F2937), FontAwesomeIcons.qrcode),
    'Other': (Color(0xFF6B7280), FontAwesomeIcons.ellipsis),
    'Vistrow Voice': (Color(0xFF9333EA), FontAwesomeIcons.microphoneLines),
  };

  @override
  Widget build(BuildContext context) {
    final s = source;
    if (s == null || s.isEmpty) return const SizedBox.shrink();
    final (color, icon) = _style[s] ?? (const Color(0xFF6B7280), FontAwesomeIcons.globe);
    final voice = s == 'Vistrow Voice';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: voice ? null : color,
        gradient: voice
            ? const LinearGradient(colors: [Color(0xFF9333EA), Color(0xFFD946EF), Color(0xFFEC4899)])
            : null,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FaIcon(icon, size: 10, color: Colors.white),
          const SizedBox(width: 5),
          Text(
            s,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
