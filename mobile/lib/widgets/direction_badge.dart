import 'package:flutter/material.dart';

/// Shows whether the lead called us (inbound) or we called the lead (outbound).
///
/// The backend records this per call as `meta.direction`, but nothing used to
/// display it — so an incoming enquiry and an agent's own outgoing call looked
/// identical in the history, both just "ANSWERED".
///
/// Mirrors DIRECTION_STYLE in the web app (frontend/src/pages/Calls.jsx) so both
/// clients read the same way.
class DirectionBadge extends StatelessWidget {
  final String? direction;
  const DirectionBadge({super.key, required this.direction});

  static const _inboundColor = Color(0xFF3B82F6);
  static const _outboundColor = Color(0xFF8B8B93);

  @override
  Widget build(BuildContext context) {
    final isInbound = direction == 'inbound';
    final isOutbound = direction == 'outbound';
    // Older calls predate direction tracking — show nothing rather than guess.
    if (!isInbound && !isOutbound) return const SizedBox.shrink();

    final color = isInbound ? _inboundColor : _outboundColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isInbound ? Icons.call_received_rounded : Icons.call_made_rounded,
            size: 11,
            color: color,
          ),
          const SizedBox(width: 3),
          Text(
            isInbound ? 'Incoming' : 'Outgoing',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
