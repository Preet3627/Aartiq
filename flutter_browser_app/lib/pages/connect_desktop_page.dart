import 'package:flutter/material.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'dart:ui';
import 'dart:io';
import 'dart:async';
import '../sync_service.dart';

class ConnectDesktopPage extends StatefulWidget {
  const ConnectDesktopPage({Key? key}) : super(key: key);

  @override
  State<ConnectDesktopPage> createState() => _ConnectDesktopPageState();
}

class _ConnectDesktopPageState extends State<ConnectDesktopPage> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? controller;
  bool isConnecting = false;
  bool isConnected = false;
  bool showScanner = false;
  bool isCloudMode = false;
  bool _isProcessingQR = false; // Guard flag
  String? desktopIp;
  String? desktopLabel;
  String? errorMessage;
  final List<Map<String, dynamic>> _discoveredDevices = [];
  final List<Map<String, dynamic>> _cloudDevices = [];
  final List<Map<String, dynamic>> _savedDevices = [];
  StreamSubscription? _discoverySubscription;
  StreamSubscription? _cloudDevicesSubscription;

  @override
  void initState() {
    super.initState();
    isConnected = SyncService().isConnectedToDesktop;
    if (isConnected) {
      desktopIp = SyncService().getConnectionInfo()['desktopIp'];
      desktopLabel = SyncService().getConnectionInfo()['label'] as String?;
    }
    _refreshSavedDevices();
    _startDiscovery();
  }

  void _refreshSavedDevices() {
    final devices =
        List<Map<String, dynamic>>.from(SyncService().getSavedDevices())
          ..sort((a, b) =>
              (b['lastConnected'] ?? 0).compareTo(a['lastConnected'] ?? 0));
    if (mounted) {
      setState(() {
        _savedDevices
          ..clear()
          ..addAll(devices);
      });
    } else {
      _savedDevices
        ..clear()
        ..addAll(devices);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null && args.containsKey('qrData')) {
      final qrData = args['qrData'] as String?;
      if (qrData != null && qrData.isNotEmpty) {
        // Process the deep link data as if it were scanned
        // But clear the argument so it doesn't process again on rebuild
        args.remove('qrData');
        Future.delayed(Duration.zero, () {
          if (mounted) {
            _scanQRCode(qrData);
          }
        });
      }
    }
  }

  void _startDiscovery() {
    if (isCloudMode) {
      _startCloudDiscovery();
    } else {
      _startLocalDiscovery();
    }
  }

  void _startLocalDiscovery() {
    _discoveredDevices.clear();
    SyncService().startDiscovery();
    _discoverySubscription = SyncService().onDeviceDiscovered.listen((device) {
      _refreshSavedDevices();
      if (mounted) {
        setState(() {
          if (!_discoveredDevices
              .any((d) => d['deviceId'] == device['deviceId'])) {
            _discoveredDevices.add(device);
          }
        });
      }
    });
  }

  void _startCloudDiscovery() {
    _cloudDevices.clear();
    _cloudDevicesSubscription =
        SyncService().onCloudDevicesUpdated.listen((devices) {
      if (mounted) {
        setState(() {
          _cloudDevices.clear();
          devices.forEach((key, value) {
            if (key != SyncService().deviceId) {
              _cloudDevices.add({
                'deviceId': key,
                'deviceName': value['deviceName'] ?? 'Unknown',
                'deviceType': value['deviceType'] ?? 'desktop',
                'isOnline': value['online'] ?? false,
              });
            }
          });
        });
      }
    });
  }

  @override
  void dispose() {
    _discoverySubscription?.cancel();
    _cloudDevicesSubscription?.cancel();
    SyncService().stopDiscovery();
    controller?.dispose();
    super.dispose();
  }

  Future<void> _showPairingCodeDialog(
      String ip, int port, String deviceId) async {
    String pairingCode = "";
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Color(0xFF121212),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Enter Pairing Code',
            style: TextStyle(color: Colors.white, fontFamily: 'Outfit')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Enter the 6-digit code shown on your desktop screen.',
                style: TextStyle(color: Colors.white70, fontSize: 13)),
            SizedBox(height: 20),
            TextField(
              autofocus: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              style: TextStyle(
                  color: Colors.white,
                  letterSpacing: 10,
                  fontSize: 24,
                  fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                counterText: "",
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(15),
                    borderSide: BorderSide.none),
              ),
              onChanged: (value) => pairingCode = value,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: Colors.white38)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF00E5FF),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12))),
            onPressed: () async {
              Navigator.pop(context);
              await _connect(ip, port, deviceId, pairingCode);
            },
            child: Text('Connect', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  Future<void> _connect(String ip, int port, String deviceId,
      [String? pairingCode]) async {
    setState(() {
      isConnecting = true;
      errorMessage = null;
    });

    try {
      await SyncService()
          .connectToDesktop(ip, port, deviceId, pairingCode: pairingCode);

      if (mounted) {
        setState(() {
          isConnected = true;
          desktopIp = ip;
          desktopLabel =
              SyncService().getConnectionInfo()['label'] as String? ?? ip;
          isConnecting = false;
        });
        _refreshSavedDevices();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Connected to desktop at $ip'),
            backgroundColor: Color(0xFF00E676),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isConnecting = false;
          errorMessage = e.toString().contains('AUTH_FAILED')
              ? 'Invalid pairing code'
              : 'Connection failed: $e';
        });
        _refreshSavedDevices();
      }
    }
  }

  Future<void> _approveRiskAction(String id, String pin) async {
    try {
      final result =
          await SyncService().executeOnDesktop('approve-high-risk', args: {
        'id': id,
        'pin': pin,
      });

      if (mounted) {
        if (result != null && result['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Action approved successfully!'),
              backgroundColor: Color(0xFF00E676),
            ),
          );
          setState(() {
            if (isConnected) showScanner = false;
            errorMessage = null;
          });
        } else {
          throw Exception(result?['error'] ?? 'Approval failed');
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMessage = 'Approval failed: $e';
        });
      }
    }
  }

  Future<bool> _confirmRiskApprovalPin(String expectedPin) async {
    final controller = TextEditingController();
    String? errorText;

    final approved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: const Color(0xFF151515),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: const Text(
              'Confirm High-Risk Approval',
              style: TextStyle(color: Colors.white),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Scan complete. Enter the PIN shown on your desktop to approve this high-risk action.',
                  style: TextStyle(color: Colors.white70, height: 1.4),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  maxLength: expectedPin.length,
                  autofocus: true,
                  style: const TextStyle(
                    color: Colors.white,
                    fontFamily: 'monospace',
                    letterSpacing: 6,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Desktop PIN',
                    labelStyle: const TextStyle(color: Colors.white54),
                    hintText: 'Enter PIN',
                    hintStyle: const TextStyle(color: Colors.white24),
                    errorText: errorText,
                    filled: true,
                    fillColor: Colors.white10,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    counterStyle: const TextStyle(color: Colors.white38),
                  ),
                  onChanged: (value) {
                    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
                    if (digitsOnly != value) {
                      controller.value = TextEditingValue(
                        text: digitsOnly,
                        selection:
                            TextSelection.collapsed(offset: digitsOnly.length),
                      );
                    }
                    if (errorText != null) {
                      setDialogState(() => errorText = null);
                    }
                  },
                  onSubmitted: (_) {
                    final enteredPin =
                        controller.text.replaceAll(RegExp(r'\D'), '');
                    if (enteredPin == expectedPin) {
                      Navigator.of(dialogContext).pop(true);
                    } else {
                      setDialogState(() {
                        errorText = 'PIN does not match the desktop code.';
                      });
                    }
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text(
                  'Cancel',
                  style: TextStyle(color: Colors.white54),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  final enteredPin =
                      controller.text.replaceAll(RegExp(r'\D'), '');
                  if (enteredPin == expectedPin) {
                    Navigator.of(dialogContext).pop(true);
                  } else {
                    setDialogState(() {
                      errorText = 'PIN does not match the desktop code.';
                    });
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00E676),
                  foregroundColor: Colors.black,
                ),
                child: const Text('Approve'),
              ),
            ],
          ),
        );
      },
    );

    controller.dispose();
    return approved == true;
  }

  Future<void> _scanQRCode(String qrData) async {
    if (_isProcessingQR) return;
    _isProcessingQR = true;

    // Pause camera while processing to prevent multiple scans
    controller?.pauseCamera();

    try {
      final uri = Uri.parse(qrData);
      if (uri.scheme == 'comet-ai') {
        if (uri.host == 'connect') {
          final ip = uri.queryParameters['ip'];
          final port = uri.queryParameters['port'];
          final deviceId = uri.queryParameters['device'];

          if (ip != null && port != null && deviceId != null) {
            _showPairingCodeDialog(ip, int.parse(port), deviceId);
          } else {
            throw Exception('Invalid connect QR code data');
          }
        } else if (uri.host == 'approve' || uri.host == 'shell-approve') {
          final id = uri.queryParameters['id'];
          final deviceId = uri.queryParameters['deviceId'];
          final pin = uri.queryParameters['pin'];

          if (id != null && deviceId != null && pin != null) {
            if (!SyncService().isConnectedToDesktop) {
              throw Exception(
                  'Must be connected and authenticated to desktop to approve actions.');
            }
            final approved = await _confirmRiskApprovalPin(pin);
            if (!approved) {
              return;
            }
            await _approveRiskAction(id, pin);
          } else {
            throw Exception('Invalid approve QR code data');
          }
        } else {
          throw Exception('Unknown Comet-AI QR Action');
        }
      } else {
        throw Exception('Not a Comet-AI QR code');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMessage = e.toString();
        });
      }
    } finally {
      _isProcessingQR = false;
      // Resume camera after processing (unless we navigated away or showScanner is false)
      if (mounted && (showScanner || !isConnected)) {
        controller?.resumeCamera();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Connect to Desktop',
          style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() {
                      isCloudMode = false;
                      _startDiscovery();
                    });
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: !isCloudMode ? Color(0xFF00E5FF) : Colors.white10,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.wifi,
                            size: 16,
                            color:
                                !isCloudMode ? Colors.black : Colors.white70),
                        SizedBox(width: 4),
                        Text('Local',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: !isCloudMode
                                    ? Colors.black
                                    : Colors.white70)),
                      ],
                    ),
                  ),
                ),
                SizedBox(width: 8),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      isCloudMode = true;
                      _startDiscovery();
                    });
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isCloudMode ? Color(0xFF9C27B0) : Colors.white10,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.cloud,
                            size: 16,
                            color: isCloudMode ? Colors.white : Colors.white70),
                        SizedBox(width: 4),
                        Text('Cloud',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isCloudMode
                                    ? Colors.white
                                    : Colors.white70)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: Container(
        color: Colors.black,
        child: SafeArea(
          child: (isConnected && !showScanner)
              ? _buildConnectedView()
              : _buildScannerView(),
        ),
      ),
    );
  }

  Widget _buildScannerView() {
    return SingleChildScrollView(
      child: Column(
        children: [
          if (isConnected && showScanner)
            Padding(
              padding: const EdgeInsets.only(top: 10.0),
              child: TextButton.icon(
                onPressed: () => setState(() => showScanner = false),
                icon: Icon(Icons.close, color: Colors.white70),
                label: Text('Cancel Scan',
                    style: TextStyle(color: Colors.white70)),
              ),
            ),
          if (!isCloudMode) ...[
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  const Icon(
                    Icons.qr_code_scanner,
                    size: 60,
                    color: Color(0xFF00E5FF),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Scan QR Code',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'Outfit',
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 250,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Stack(
                    children: [
                      QRView(
                        key: qrKey,
                        onQRViewCreated: _onQRViewCreated,
                        overlay: QrScannerOverlayShape(
                          borderColor: const Color(0xFF00E5FF),
                          borderRadius: 20,
                          borderLength: 30,
                          borderWidth: 8,
                          cutOutSize: 200,
                        ),
                      ),
                      if (isConnecting)
                        Container(
                          color: Colors.black54,
                          child: const Center(
                            child: CircularProgressIndicator(
                                color: Color(0xFF00E5FF)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          if (_savedDevices.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
              child: Row(
                children: [
                  Icon(Icons.devices, color: Color(0xFF00E5FF), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'SAVED DEVICES',
                    style: TextStyle(
                      color: Color(0xFF00E5FF),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              itemCount: _savedDevices.length,
              itemBuilder: (context, index) {
                final device = _savedDevices[index];
                final bool isOnline = device['isOnline'] == true;
                final bool isTrusted = device['trusted'] == true;
                final String? savedIp = device['ip'] as String?;
                final int savedPort = (device['port'] as int?) ?? 3004;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Material(
                      color: Colors.white.withOpacity(0.05),
                      child: ListTile(
                        onTap: (savedIp != null && savedIp.isNotEmpty)
                            ? () =>
                                _connect(savedIp, savedPort, device['deviceId'])
                            : null,
                        leading: Container(
                          padding: EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isOnline
                                ? Color(0xFF00E5FF).withOpacity(0.12)
                                : Colors.white.withOpacity(0.05),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.desktop_windows,
                            color:
                                isOnline ? Color(0xFF00E5FF) : Colors.white30,
                          ),
                        ),
                        title: Text(
                          device['deviceName'] ?? 'Saved Desktop',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Text(
                          isOnline
                              ? '${savedIp ?? 'Online'}${isTrusted ? ' • trusted' : ''}'
                              : 'Offline${isTrusted ? ' • trusted' : ''}',
                          style: TextStyle(
                            color:
                                isOnline ? Colors.greenAccent : Colors.white38,
                          ),
                        ),
                        trailing: Icon(
                          isOnline ? Icons.chevron_right : Icons.cloud_off,
                          color: isOnline ? Colors.white24 : Colors.white30,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
          if (isCloudMode && _cloudDevices.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 30, 20, 10),
              child: Row(
                children: [
                  Icon(Icons.cloud, color: Color(0xFF9C27B0), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'CLOUD DEVICES (Same Account)',
                    style: TextStyle(
                      color: Color(0xFF9C27B0),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              itemCount: _cloudDevices.length,
              itemBuilder: (context, index) {
                final device = _cloudDevices[index];
                final bool isOnline = device['isOnline'] ?? false;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Material(
                      color: Colors.white.withOpacity(0.05),
                      child: ListTile(
                        onTap: isOnline
                            ? () async {
                                setState(() => isConnecting = true);
                                final success = await SyncService()
                                    .connectToCloudDevice(device['deviceId']);
                                if (mounted) {
                                  setState(() {
                                    isConnecting = false;
                                    if (success) {
                                      isConnected = true;
                                      desktopLabel =
                                          device['deviceName'] as String?;
                                      desktopIp = null;
                                    } else {
                                      errorMessage = 'Connection failed';
                                    }
                                  });
                                }
                              }
                            : null,
                        leading: Container(
                          padding: EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isOnline
                                ? Color(0xFF9C27B0).withOpacity(0.1)
                                : Colors.white.withOpacity(0.05),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.desktop_windows,
                              color: isOnline
                                  ? Color(0xFF9C27B0)
                                  : Colors.white30),
                        ),
                        title: Text(device['deviceName'],
                            style: TextStyle(
                                color: isOnline ? Colors.white : Colors.white30,
                                fontWeight: FontWeight.bold)),
                        subtitle: Text(isOnline ? 'Online' : 'Offline',
                            style: TextStyle(
                                color:
                                    isOnline ? Colors.green : Colors.white30)),
                        trailing: isOnline
                            ? Icon(Icons.chevron_right, color: Colors.white24)
                            : null,
                      ),
                    ),
                  ),
                );
              },
            ),
          ] else if (!isCloudMode && _discoveredDevices.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 30, 20, 10),
              child: Row(
                children: [
                  Icon(Icons.devices, color: Colors.white38, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'DISCOVERED DEVICES',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              itemCount: _discoveredDevices.length,
              itemBuilder: (context, index) {
                final device = _discoveredDevices[index];
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Material(
                      color: Colors.white.withOpacity(0.05),
                      child: ListTile(
                        onTap: () => _showPairingCodeDialog(
                            device['ip'], device['port'], device['deviceId']),
                        leading: Container(
                          padding: EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Color(0xFF00E5FF).withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.desktop_windows,
                              color: Color(0xFF00E5FF)),
                        ),
                        title: Text(device['deviceName'],
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold)),
                        subtitle: Text(device['ip'],
                            style: TextStyle(color: Colors.white38)),
                        trailing:
                            Icon(Icons.chevron_right, color: Colors.white24),
                      ),
                    ),
                  ),
                );
              },
            ),
          ] else
            Padding(
              padding: const EdgeInsets.all(40.0),
              child: Column(
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white24),
                  ),
                  SizedBox(height: 10),
                  Text(
                      isCloudMode
                          ? 'Searching cloud devices...'
                          : 'Searching for local devices...',
                      style: TextStyle(color: Colors.white24, fontSize: 12)),
                ],
              ),
            ),
          if (isCloudMode)
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Container(
                padding: EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: Color(0xFF9C27B0).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Color(0xFF9C27B0).withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.cloud, color: Color(0xFF9C27B0)),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Cloud mode connects devices via your account. Devices must be logged in with the same account to appear here.',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Container(
                padding: EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Colors.red.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(errorMessage!,
                          style: TextStyle(color: Colors.white70)),
                    ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: _buildInstructionCard(),
          ),
        ],
      ),
    );
  }

  Widget _buildConnectedView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(30.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFF00E676), Color(0xFF00C853)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Color(0xFF00E676).withOpacity(0.3),
                    blurRadius: 20,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: Icon(Icons.check, size: 50, color: Colors.white),
            ),
            SizedBox(height: 30),
            Text(
              'Connected!',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                fontFamily: 'Outfit',
              ),
            ),
            SizedBox(height: 10),
            Text(
              'Desktop: ${desktopLabel ?? desktopIp ?? (isCloudMode ? 'Cloud Desktop' : 'Local Desktop')}',
              style: TextStyle(
                fontSize: 16,
                color: Colors.white70,
                fontFamily: 'Inter',
              ),
            ),
            SizedBox(height: 30),
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  padding: EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.touch_app, size: 30, color: Color(0xFF00E5FF)),
                      SizedBox(height: 15),
                      Text(
                        'Premium Synchronisation Active',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontFamily: 'Inter',
                        ),
                      ),
                      SizedBox(height: 15),
                      Text(
                        '• Instant Clipboard Sync\n'
                        '• Remote Command Execution\n'
                        '• Secure End-to-End Handshake',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.white60,
                          fontFamily: 'Inter',
                          height: 1.6,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(height: 30),
            ElevatedButton.icon(
              icon: Icon(Icons.desktop_windows),
              label: Text('Open Desktop Control'),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    isCloudMode ? Color(0xFF9C27B0) : Color(0xFF00E676),
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.pushNamed(context, '/desktop-control');
              },
            ),
            SizedBox(height: 14),
            ElevatedButton.icon(
              icon: Icon(Icons.qr_code_scanner),
              label: Text('Scan Action QR'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF00E5FF),
                foregroundColor: Colors.black,
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                setState(() {
                  showScanner = true;
                  errorMessage = null;
                });
              },
            ),
            SizedBox(height: 20),
            TextButton(
              onPressed: () {
                SyncService().disconnectFromDesktop();
                setState(() {
                  isConnected = false;
                  desktopIp = null;
                  desktopLabel = null;
                });
                _startDiscovery(); // Restart discovery
              },
              child: Text(
                'DISCONNECT SESSION',
                style: TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInstructionCard() {
    return Container(
      padding: EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          Icon(Icons.security, color: Colors.white24, size: 20),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Connections are secured via local handshake and encrypted with your pairing code.',
              style: TextStyle(
                color: Colors.white24,
                fontSize: 11,
                fontFamily: 'Inter',
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onQRViewCreated(QRViewController controller) {
    this.controller = controller;
    if (Platform.isAndroid) {
      controller.pauseCamera();
    }
    controller.resumeCamera();
    controller.scannedDataStream.listen((scanData) {
      if (scanData.code != null &&
          !isConnecting &&
          (!isConnected || showScanner)) {
        _scanQRCode(scanData.code!);
      }
    });
  }
}
