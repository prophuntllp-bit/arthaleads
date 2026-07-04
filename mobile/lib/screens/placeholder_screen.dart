import 'package:flutter/material.dart';

/// Temporary stand-in while screens are built out one by one.
class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.construction_rounded, size: 48, color: Theme.of(context).disabledColor),
          const SizedBox(height: 12),
          Text('$title — coming soon', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}
