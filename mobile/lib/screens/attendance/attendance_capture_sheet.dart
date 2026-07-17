import 'dart:convert';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/theme.dart';
import '../../widgets/buttons.dart';
import '../../widgets/motion.dart';

class AttendanceCaptureResult {
  const AttendanceCaptureResult({
    this.selfie,
    this.latitude,
    this.longitude,
    this.accuracy,
  });

  final String? selfie;
  final double? latitude;
  final double? longitude;
  final double? accuracy;
}

class AttendanceCaptureSheet extends StatefulWidget {
  const AttendanceCaptureSheet({
    super.key,
    required this.clockIn,
    required this.requiredProof,
  });

  final bool clockIn;
  final bool requiredProof;

  @override
  State<AttendanceCaptureSheet> createState() => _AttendanceCaptureSheetState();
}

class _AttendanceCaptureSheetState extends State<AttendanceCaptureSheet>
    with WidgetsBindingObserver {
  CameraController? _controller;
  CameraDescription? _camera;
  Uint8List? _photo;
  Position? _position;
  String? _cameraError;
  String? _locationError;
  bool _cameraLoading = true;
  bool _locationLoading = true;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startCamera();
    _findLocation();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      controller.dispose();
      _controller = null;
    } else if (state == AppLifecycleState.resumed && _photo == null) {
      _initializeCamera(_camera);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _startCamera() async {
    if (mounted) {
      setState(() {
        _cameraLoading = true;
        _cameraError = null;
      });
    }
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw CameraException('NoCamera', 'No camera found');
      }
      _camera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      await _initializeCamera(_camera);
    } on CameraException catch (error) {
      if (!mounted) return;
      setState(() {
        _cameraLoading = false;
        _cameraError = switch (error.code) {
          'CameraAccessDenied' || 'CameraAccessDeniedWithoutPrompt' =>
            'Camera permission is blocked. Allow Camera in Android Settings → Apps → Arthaleads → Permissions.',
          _ => 'The camera could not be started. Tap Retry to try again.',
        };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _cameraLoading = false;
        _cameraError = 'No usable camera was found on this device.';
      });
    }
  }

  Future<void> _initializeCamera(CameraDescription? camera) async {
    if (camera == null) return;
    await _controller?.dispose();
    final controller = CameraController(
      camera,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    _controller = controller;
    try {
      await controller.initialize();
      await controller.setFlashMode(FlashMode.off);
      if (mounted) {
        setState(() {
          _cameraLoading = false;
          _cameraError = null;
        });
      }
    } on CameraException catch (error) {
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _controller = null;
        _cameraLoading = false;
        _cameraError = error.code.startsWith('CameraAccessDenied')
            ? 'Camera permission is blocked. Allow Camera in Android Settings → Apps → Arthaleads → Permissions.'
            : 'The camera could not be started. Tap Retry to try again.';
      });
    }
  }

  Future<void> _findLocation() async {
    setState(() {
      _locationLoading = true;
      _locationError = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const _LocationFailure(
          'Location is switched off. Enable Android Location, then tap Retry.',
        );
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        throw const _LocationFailure(
          'Location permission is blocked. Allow Location in Android Settings → Apps → Arthaleads → Permissions.',
        );
      }
      if (permission == LocationPermission.denied) {
        throw const _LocationFailure('Location permission was not allowed.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      if (mounted) setState(() => _position = position);
    } on _LocationFailure catch (error) {
      if (mounted) setState(() => _locationError = error.message);
    } catch (_) {
      if (mounted) {
        setState(() {
          _locationError =
              'Location could not be determined. Check GPS and tap Retry.';
        });
      }
    } finally {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  Future<void> _takePhoto() async {
    final controller = _controller;
    if (controller == null ||
        !controller.value.isInitialized ||
        controller.value.isTakingPicture ||
        _capturing) {
      return;
    }
    setState(() => _capturing = true);
    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      await controller.dispose();
      if (mounted) {
        setState(() {
          _photo = bytes;
          _controller = null;
        });
      }
    } on CameraException {
      if (mounted) {
        setState(() => _cameraError = 'Photo capture failed. Please retry.');
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _retake() async {
    setState(() => _photo = null);
    await _startCamera();
  }

  bool get _cameraResolved => _photo != null || _cameraError != null;
  bool get _locationResolved => _position != null || _locationError != null;
  bool get _canConfirm => _cameraResolved && _locationResolved && !_capturing;

  void _confirm() {
    if (!_canConfirm) return;
    final selfie = _photo == null
        ? null
        : 'data:image/jpeg;base64,${base64Encode(_photo!)}';
    Navigator.pop(
      context,
      AttendanceCaptureResult(
        selfie: selfie,
        latitude: _position?.latitude,
        longitude: _position?.longitude,
        accuracy: _position?.accuracy,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.clockIn ? 'Clock In' : 'Clock Out';
    final missingRequired =
        widget.requiredProof && (_photo == null || _position == null);
    return Material(
      color: AppTheme.of(context).surfaceSolid,
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.camera_alt_rounded,
                    size: 20,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Cancel',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: ColoredBox(color: Colors.black, child: _cameraPanel()),
                ),
              ),
              const SizedBox(height: 12),
              if (_photo != null)
                TextButton.icon(
                  onPressed: _retake,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retake selfie'),
                )
              else
                GradientButton(
                  onPressed:
                      _controller?.value.isInitialized == true && !_capturing
                      ? _takePhoto
                      : null,
                  icon: Icons.camera_alt_rounded,
                  loading: _capturing,
                  child: const Text('Capture selfie'),
                ),
              const SizedBox(height: 12),
              _locationPanel(),
              if (missingRequired) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFDBA74)),
                  ),
                  child: const Text(
                    'Your organisation requires a selfie and GPS location. If a permission is unavailable, the attendance record will show the missing proof to your admin.',
                    style: TextStyle(
                      color: Color(0xFF9A3412),
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GradientButton(
                      fullWidth: true,
                      onPressed: _canConfirm ? _confirm : null,
                      icon: Icons.check_circle_outline_rounded,
                      child: Text(title),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cameraPanel() {
    if (_photo != null) {
      return Image.memory(_photo!, fit: BoxFit.cover);
    }
    final controller = _controller;
    if (controller != null && controller.value.isInitialized) {
      return LayoutBuilder(
        builder: (context, constraints) {
          var scale =
              constraints.maxWidth /
              (constraints.maxHeight * controller.value.aspectRatio);
          if (scale < 1) scale = 1 / scale;
          return Transform.scale(
            scale: scale,
            child: Center(child: CameraPreview(controller)),
          );
        },
      );
    }
    if (_cameraLoading) return const Center(child: AppSpinner(size: 34));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Colors.amber,
            size: 40,
          ),
          const SizedBox(height: 10),
          Text(
            _cameraError ?? 'Camera unavailable',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
          const SizedBox(height: 10),
          TextButton.icon(
            onPressed: _startCamera,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry camera'),
          ),
        ],
      ),
    );
  }

  Widget _locationPanel() {
    final position = _position;
    final success = position != null;
    final color = success
        ? AppColors.success
        : _locationError != null
        ? AppColors.danger
        : AppTheme.of(context).textSoft;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.of(context).surfaceLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.of(context).border),
      ),
      child: Row(
        children: [
          Icon(Icons.location_on_rounded, color: color, size: 21),
          const SizedBox(width: 8),
          Expanded(
            child: _locationLoading
                ? const Text('Getting precise location…')
                : success
                ? Text(
                    '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}  ±${position.accuracy.round()}m',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  )
                : Text(
                    _locationError ?? 'Location unavailable',
                    style: const TextStyle(fontSize: 12),
                  ),
          ),
          if (_locationLoading)
            const SizedBox(width: 18, height: 18, child: AppSpinner(size: 18))
          else if (!success)
            TextButton(onPressed: _findLocation, child: const Text('Retry'))
          else
            const Icon(Icons.check_circle_rounded, color: AppColors.success),
        ],
      ),
    );
  }
}

class _LocationFailure implements Exception {
  const _LocationFailure(this.message);
  final String message;
}
