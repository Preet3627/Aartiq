import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'main.dart';

class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  // Device memory for persistent local devices
  static const String _deviceMemoryKey = 'paired_devices_memory';
  List<Map<String, dynamic>> _savedDevices = [];
  final Set<String> _pendingDiscoveryReconnects = <String>{};

  DatabaseReference? _signalRef;
  RTCPeerConnection? _peerConnection;
  RTCDataChannel? _dataChannel;
  bool isConnected = false;
  String? userId;
  String? deviceId;
  String? remoteDeviceId;

  final StreamController<String> _clipboardController =
      StreamController<String>.broadcast();
  Stream<String> get onClipboardSynced => _clipboardController.stream;

  final StreamController<Map> _historyController =
      StreamController<Map>.broadcast();
  Stream<Map> get onHistorySynced => _historyController.stream;

  Future<void> loadSavedDevices() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString(_deviceMemoryKey);
      if (savedJson != null) {
        _savedDevices = List<Map<String, dynamic>>.from(
          (jsonDecode(savedJson) as List)
              .map((d) => _normalizeSavedDevice(Map<String, dynamic>.from(d))),
        );
        print(
            '[Sync] Loaded ${_savedDevices.length} saved devices from memory');
      }
    } catch (e) {
      print('[Sync] Error loading saved devices: $e');
    }
  }

  Future<void> saveDeviceToMemory(Map<String, dynamic> device) async {
    try {
      final normalizedDevice = _normalizeSavedDevice(device);
      final existingIndex = _savedDevices.indexWhere(
        (d) => d['deviceId'] == normalizedDevice['deviceId'],
      );
      if (existingIndex >= 0) {
        _savedDevices[existingIndex] = {
          ..._savedDevices[existingIndex],
          ...normalizedDevice,
        };
      } else {
        _savedDevices.add(normalizedDevice);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_deviceMemoryKey, jsonEncode(_savedDevices));
      print('[Sync] Saved device to memory: ${normalizedDevice['deviceName']}');
    } catch (e) {
      print('[Sync] Error saving device: $e');
    }
  }

  Future<void> removeDeviceFromMemory(String deviceId) async {
    try {
      _savedDevices.removeWhere((d) => d['deviceId'] == deviceId);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_deviceMemoryKey, jsonEncode(_savedDevices));
      print('[Sync] Removed device from memory: $deviceId');
    } catch (e) {
      print('[Sync] Error removing device: $e');
    }
  }

  List<Map<String, dynamic>> getSavedDevices() => _savedDevices;

  Map<String, dynamic> _normalizeSavedDevice(Map<String, dynamic> device) {
    return {
      'deviceId': device['deviceId'],
      'deviceName': device['deviceName'] ?? 'Desktop Device',
      'deviceType': device['deviceType'] ?? 'desktop',
      'ip': device['ip'],
      'port': device['port'] ?? 3004,
      'timestamp': device['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
      'lastConnected': device['lastConnected'] ?? device['timestamp'],
      'lastSeen':
          device['lastSeen'] ?? device['lastConnected'] ?? device['timestamp'],
      'autoConnect': device['autoConnect'] ?? true,
      'trusted': device['trusted'] ?? false,
      'connectionMode': device['connectionMode'] ?? 'local',
      'isOnline': device['isOnline'] ?? false,
    };
  }

  Map<String, dynamic>? getSavedDevice(String deviceId) {
    try {
      return _savedDevices
          .firstWhere((device) => device['deviceId'] == deviceId);
    } catch (_) {
      return null;
    }
  }

  Future<void> _updateSavedDevice(
    String deviceId, {
    String? deviceName,
    String? ip,
    int? port,
    bool? trusted,
    bool? autoConnect,
    bool? isOnline,
    String? connectionMode,
    int? lastConnected,
    int? lastSeen,
  }) async {
    final existing = getSavedDevice(deviceId) ?? {'deviceId': deviceId};
    await saveDeviceToMemory({
      ...existing,
      if (deviceName != null) 'deviceName': deviceName,
      if (ip != null) 'ip': ip,
      if (port != null) 'port': port,
      if (trusted != null) 'trusted': trusted,
      if (autoConnect != null) 'autoConnect': autoConnect,
      if (isOnline != null) 'isOnline': isOnline,
      if (connectionMode != null) 'connectionMode': connectionMode,
      if (lastConnected != null) 'lastConnected': lastConnected,
      if (lastSeen != null) 'lastSeen': lastSeen,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<void> initialize(String userId, {String? customDeviceId}) async {
    this.userId = userId;
    // Load saved devices from persistent memory
    await loadSavedDevices();

    if (customDeviceId != null) {
      this.deviceId = customDeviceId;
    } else {
      try {
        final dir = await getApplicationDocumentsDirectory();
        final file = File('${dir.path}/device_id.txt');
        if (await file.exists()) {
          this.deviceId = await file.readAsString();
        } else {
          this.deviceId = const Uuid().v4();
          await file.writeAsString(this.deviceId!);
        }
      } catch (e) {
        print('[Sync] Error loading/saving device ID: $e');
        this.deviceId = const Uuid().v4();
      }
    }
    print('[Sync] Initialized for user: $userId, device: $deviceId');
  }

  Future<void> connect(String targetDeviceId) async {
    this.remoteDeviceId = targetDeviceId;
    _signalRef = FirebaseDatabase.instance.ref('p2p_signals/$userId/$deviceId');

    _signalRef!.onValue.listen((event) {
      if (event.snapshot.value != null) {
        _handleSignal(event.snapshot.value as Map);
      }
    });

    await _setupPeerConnection();

    // Create an offer to start connection
    _dataChannel = await _peerConnection!.createDataChannel(
      'sync-channel',
      RTCDataChannelInit(),
    );
    _setupDataChannel();

    RTCSessionDescription offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);
    _sendSignal({'sdp': offer.toMap()});
  }

  Future<void> _setupPeerConnection() async {
    final Map<String, dynamic> configuration = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'},
      ],
    };

    _peerConnection = await createPeerConnection(configuration);

    _peerConnection!.onIceCandidate = (candidate) {
      _sendSignal({'candidate': candidate.toMap()});
    };

    _peerConnection!.onDataChannel = (channel) {
      _dataChannel = channel;
      _setupDataChannel();
    };

    _peerConnection!.onConnectionState = (state) {
      print('[Sync] Peer Connection State: $state');
    };
  }

  void _setupDataChannel() {
    if (_dataChannel == null) return;

    _dataChannel!.onMessage = (data) {
      _handleMessage(data.text);
    };
    _dataChannel!.onDataChannelState = (state) {
      isConnected = state == RTCDataChannelState.RTCDataChannelOpen;
      print('[Sync] Data Channel State: $state');
    };
  }

  String? _lastSentClipboard;

  void _handleMessage(String text) {
    try {
      final msg = jsonDecode(text);
      if (msg['type'] == 'clipboard-sync') {
        _lastSentClipboard = msg['text'];
        Clipboard.setData(ClipboardData(text: msg['text']));
        _clipboardController.add(msg['text']);
        print('[Sync] Clipboard synced: ${msg['text']}');
      } else if (msg['type'] == 'history-sync') {
        _historyController.add(msg['data']);
        print('[Sync] History synced');
      }
    } catch (e) {
      print('[Sync] Error handling message: $e');
    }
  }

  void _handleSignal(Map data) {
    if (data['sender'] == deviceId) return;

    final signal = data['signal'];
    if (signal['sdp'] != null) {
      _peerConnection!
          .setRemoteDescription(
        RTCSessionDescription(signal['sdp']['sdp'], signal['sdp']['type']),
      )
          .then((_) {
        if (signal['sdp']['type'] == 'offer') {
          _peerConnection!.createAnswer().then((answer) {
            _peerConnection!.setLocalDescription(answer);
            _sendSignal({'sdp': answer.toMap()});
          });
        }
      });
    } else if (signal['candidate'] != null) {
      _peerConnection!.addCandidate(
        RTCIceCandidate(
          signal['candidate']['candidate'],
          signal['candidate']['sdpMid'],
          signal['candidate']['sdpMLineIndex'],
        ),
      );
    }
  }

  void _sendSignal(Map signal) {
    if (userId == null || remoteDeviceId == null) return;
    FirebaseDatabase.instance.ref('p2p_signals/$userId/$remoteDeviceId').set({
      'signal': signal,
      'sender': deviceId,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void sendClipboard(String text) {
    if (text == _lastSentClipboard) return;
    _lastSentClipboard = text;
    if (isConnected && _dataChannel != null) {
      _dataChannel!.send(
        RTCDataChannelMessage(
          jsonEncode({'type': 'clipboard-sync', 'text': text}),
        ),
      );
    }
  }

  void sendHistory(Map data) {
    if (isConnected && _dataChannel != null) {
      _dataChannel!.send(
        RTCDataChannelMessage(
          jsonEncode({'type': 'history-sync', 'data': data}),
        ),
      );
    }
  }

  // Desktop connection via WiFi
  WebSocket? _desktopSocket;
  String? _desktopIp;
  int? _desktopPort;
  bool isConnectedToDesktop = false;
  bool _isReconnecting = false;
  Timer? _reconnectTimer;
  Timer? _desktopHeartbeatTimer;
  DateTime? _lastDesktopPongAt;
  static const String _lastDeviceKey = 'last_connected_device';
  String _desktopConnectionMode = 'none';
  String? _connectedDesktopLabel;

  // UDP Discovery
  RawDatagramSocket? _discoverySocket;
  final StreamController<Map<String, dynamic>> _discoveredDevicesController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onDeviceDiscovered =>
      _discoveredDevicesController.stream;
  final Set<String> _discoveredDeviceIds = {};

  final StreamController<Map> _commandResponseController =
      StreamController<Map>.broadcast();
  Stream<Map> get onCommandResponse => _commandResponseController.stream;

  final StreamController<Map> _aiStreamController =
      StreamController<Map>.broadcast();
  Stream<Map> get onAIStream => _aiStreamController.stream;

  final StreamController<Map> _desktopStatusController =
      StreamController<Map>.broadcast();
  Stream<Map> get onDesktopStatus => _desktopStatusController.stream;

  final StreamController<Map> _desktopToMobileController =
      StreamController<Map>.broadcast();
  Stream<Map> get onDesktopToMobile => _desktopToMobileController.stream;

  // Desktop Control - Full AI Chat
  final StreamController<Map<String, dynamic>> _desktopControlController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onDesktopControl =>
      _desktopControlController.stream;
  final Map<String, dynamic> _cloudDeviceCache = {};
  StreamSubscription<DatabaseEvent>? _cloudDevicesSubscription;
  StreamSubscription<DatabaseEvent>? _cloudAIResponsesSubscription;

  Future<void> startDiscovery() async {
    _discoveredDeviceIds.clear();
    try {
      _discoverySocket =
          await RawDatagramSocket.bind(InternetAddress.anyIPv4, 3005);
      _discoverySocket!.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          Datagram? dg = _discoverySocket!.receive();
          if (dg != null) {
            try {
              String message = utf8.decode(dg.data);
              Map<String, dynamic> data = jsonDecode(message);
              if (data['type'] == 'comet-ai-beacon') {
                String? deviceId = data['deviceId'];
                if (deviceId != null &&
                    !_discoveredDeviceIds.contains(deviceId)) {
                  _discoveredDeviceIds.add(deviceId);
                  _discoveredDevicesController.add({
                    'deviceId': deviceId,
                    'deviceName': data['deviceName'] ?? 'Unknown Desktop',
                    'ip': dg.address.address,
                    'port': data['port'] ?? 3004,
                  });
                }

                if (deviceId != null) {
                  unawaited(_updateSavedDevice(
                    deviceId,
                    deviceName: data['deviceName'] ?? 'Unknown Desktop',
                    ip: dg.address.address,
                    port: data['port'] ?? 3004,
                    isOnline: true,
                    lastSeen: DateTime.now().millisecondsSinceEpoch,
                    connectionMode: 'local',
                  ));

                  final savedDevice = getSavedDevice(deviceId);
                  final canAutoReconnect = savedDevice != null &&
                      savedDevice['trusted'] == true &&
                      savedDevice['autoConnect'] != false &&
                      !isConnectedToDesktop &&
                      !_isReconnecting &&
                      !_pendingDiscoveryReconnects.contains(deviceId);

                  if (canAutoReconnect) {
                    _pendingDiscoveryReconnects.add(deviceId);
                    unawaited(connectToDesktop(
                      dg.address.address,
                      data['port'] ?? 3004,
                      deviceId,
                    ).catchError((error) {
                      print(
                          '[Sync] Trusted discovery reconnect failed: $error');
                    }).whenComplete(() {
                      _pendingDiscoveryReconnects.remove(deviceId);
                    }));
                  }
                }
              }
            } catch (e) {
              print('[Sync] Error parsing discovery beacon: $e');
            }
          }
        }
      });
      print('[Sync] UDP discovery started on port 3005');
    } catch (e) {
      print('[Sync] Failed to start UDP discovery: $e');
    }
  }

  void stopDiscovery() {
    _discoverySocket?.close();
    _discoverySocket = null;
    print('[Sync] UDP discovery stopped');
  }

  Future<void> connectToDesktop(String ip, int port, String deviceId,
      {String? pairingCode}) async {
    try {
      _desktopIp = ip;
      _desktopPort = port;
      remoteDeviceId = deviceId;
      Map<String, dynamic>? handshakeAck;

      // Connect via WebSocket
      _desktopSocket = await WebSocket.connect('ws://$ip:$port')
          .timeout(const Duration(seconds: 5));

      final completer = Completer<void>();

      // Listen for messages
      _desktopSocket!.listen(
        (data) {
          try {
            final msg = jsonDecode(data);
            if (msg['type'] == 'handshake-ack' &&
                msg['authenticated'] == true) {
              handshakeAck = Map<String, dynamic>.from(msg);
              if (!completer.isCompleted) completer.complete();
            } else if (msg['type'] == 'error' && msg['code'] == 'AUTH_FAILED') {
              if (!completer.isCompleted)
                completer.completeError('AUTH_FAILED');
            }
          } catch (_) {}
          _handleDesktopMessage(data);
        },
        onDone: () {
          print('[Sync] Desktop connection closed');
          isConnectedToDesktop = false;
          _stopDesktopHeartbeat();
          if (remoteDeviceId != null) {
            unawaited(_updateSavedDevice(
              remoteDeviceId!,
              isOnline: false,
              lastSeen: DateTime.now().millisecondsSinceEpoch,
            ));
          }
          if (!completer.isCompleted) completer.completeError('Disconnected');
          _scheduleReconnect();
        },
        onError: (error) {
          print('[Sync] Desktop connection error: $error');
          isConnectedToDesktop = false;
          _stopDesktopHeartbeat();
          if (remoteDeviceId != null) {
            unawaited(_updateSavedDevice(
              remoteDeviceId!,
              isOnline: false,
              lastSeen: DateTime.now().millisecondsSinceEpoch,
            ));
          }
          if (!completer.isCompleted) completer.completeError(error);
          _scheduleReconnect();
        },
      );

      // Send handshake
      _desktopSocket!.add(
        jsonEncode({
          'type': 'handshake',
          'deviceId': this.deviceId,
          'deviceName': 'Comet Mobile (${Platform.operatingSystem})',
          'platform': 'mobile',
          'pairingCode': pairingCode,
        }),
      );

      // Wait for authentication response
      await completer.future.timeout(const Duration(seconds: 10));

      isConnectedToDesktop = true;
      _desktopConnectionMode = 'local';
      _connectedDesktopLabel =
          handshakeAck?['deviceName'] ?? handshakeAck?['hostname'] ?? ip;
      _isReconnecting = false;
      _reconnectTimer?.cancel();
      _startDesktopHeartbeat();
      _saveDeviceLocally(ip, port, deviceId);
      await saveDeviceToMemory({
        'deviceId': deviceId,
        'deviceName': _connectedDesktopLabel,
        'deviceType': 'desktop',
        'ip': ip,
        'port': port,
        'trusted': handshakeAck?['trusted'] == true,
        'autoConnect': true,
        'isOnline': true,
        'connectionMode': 'local',
        'lastConnected': DateTime.now().millisecondsSinceEpoch,
        'lastSeen': DateTime.now().millisecondsSinceEpoch,
      });
      print('[Sync] Connected and Authenticated to desktop at $ip:$port');
    } catch (e) {
      _desktopSocket?.close();
      _desktopSocket = null;
      isConnectedToDesktop = false;
      _stopDesktopHeartbeat();
      print('[Sync] Failed to connect to desktop: $e');
      if (_isReconnecting) {
        _scheduleReconnect();
      }
      rethrow;
    }
  }

  Future<void> _saveDeviceLocally(String ip, int port, String deviceId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final deviceData = jsonEncode({
        'ip': ip,
        'port': port,
        'deviceId': deviceId,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      await prefs.setString(_lastDeviceKey, deviceData);
      print('[Sync] Saved device info for auto-reconnect: $ip:$port');
    } catch (e) {
      print('[Sync] Failed to save device info: $e');
    }
  }

  Future<void> tryAutoReconnect() async {
    if (isConnectedToDesktop || _isReconnecting) return;

    try {
      await loadSavedDevices();
      final trustedDevices = _savedDevices
          .where((device) =>
              device['trusted'] == true && device['autoConnect'] != false)
          .toList()
        ..sort((a, b) =>
            (b['lastConnected'] ?? 0).compareTo(a['lastConnected'] ?? 0));

      for (final device in trustedDevices) {
        final ip = device['ip'];
        final port = device['port'];
        final deviceId = device['deviceId'];
        if (ip is String && ip.isNotEmpty && deviceId is String) {
          print('[Sync] Attempting trusted auto-reconnect to $ip:$port...');
          _isReconnecting = true;
          try {
            await connectToDesktop(ip, port ?? 3004, deviceId);
            return;
          } catch (error) {
            print('[Sync] Trusted auto-reconnect failed for $deviceId: $error');
          }
        }
      }

      final prefs = await SharedPreferences.getInstance();
      final deviceJson = prefs.getString(_lastDeviceKey);
      if (deviceJson == null) return;

      final deviceData = jsonDecode(deviceJson);
      final ip = deviceData['ip'];
      final port = deviceData['port'];
      final deviceId = deviceData['deviceId'];

      print('[Sync] Attempting auto-reconnect to $ip:$port...');
      _isReconnecting = true;
      await connectToDesktop(ip, port, deviceId);
    } catch (e) {
      print('[Sync] Auto-reconnect failed: $e');
      _isReconnecting = false;
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 10), () {
      if (!isConnectedToDesktop) {
        tryAutoReconnect();
      }
    });
  }

  void _startDesktopHeartbeat() {
    _desktopHeartbeatTimer?.cancel();
    _lastDesktopPongAt = DateTime.now();
    _desktopHeartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!isConnectedToDesktop || _desktopSocket == null) {
        return;
      }

      final lastPong = _lastDesktopPongAt;
      if (lastPong != null &&
          DateTime.now().difference(lastPong) > const Duration(seconds: 45)) {
        print('[Sync] Desktop heartbeat timed out, reconnecting...');
        _desktopSocket?.close();
        return;
      }

      try {
        _desktopSocket!.add(jsonEncode({
          'type': 'ping',
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        }));
      } catch (error) {
        print('[Sync] Heartbeat ping failed: $error');
        _desktopSocket?.close();
      }
    });
  }

  void _stopDesktopHeartbeat() {
    _desktopHeartbeatTimer?.cancel();
    _desktopHeartbeatTimer = null;
    _lastDesktopPongAt = null;
  }

  void _handleDesktopMessage(dynamic data) {
    try {
      final msg = jsonDecode(data);

      if (msg['type'] == 'command-response') {
        _commandResponseController.add(msg);
        print('[Sync] Command response received: ${msg['output']}');
      } else if (msg['type'] == 'pong') {
        _lastDesktopPongAt = DateTime.now();
      } else if (msg['type'] == 'handshake-ack') {
        final ackDeviceId = remoteDeviceId;
        if (ackDeviceId != null) {
          unawaited(_updateSavedDevice(
            ackDeviceId,
            deviceName: msg['deviceName'] ?? msg['hostname'],
            trusted: msg['trusted'] == true,
            isOnline: true,
            lastSeen: DateTime.now().millisecondsSinceEpoch,
          ));
        }
      } else if (msg['type'] == 'clipboard-sync') {
        _lastSentClipboard = msg['text'];
        Clipboard.setData(ClipboardData(text: msg['text']));
        _clipboardController.add(msg['text']);
      } else if (msg['type'] == 'agent-task') {
        final task = msg['task'];
        if (task != null) {
          navigatorKey.currentState
              ?.pushNamed('/agent-chat', arguments: {'task': task});
        }
      } else if (msg['type'] == 'error' && msg['code'] == 'AUTH_FAILED') {
        isConnectedToDesktop = false;
        print('[Sync] Authentication failed: ${msg['message']}');
      } else if (msg['type'] == 'ai-stream-response') {
        _aiStreamController.add({
          'promptId': msg['promptId'],
          'response': msg['response'],
          'isStreaming': msg['isStreaming'] ?? false,
        });
        print('[Sync] AI stream response received');
      } else if (msg['type'] == 'desktop-status') {
        _desktopStatusController.add(msg);
        print(
            '[Sync] Desktop status: screenOn=${msg['screenOn']}, activeApp=${msg['activeApp']}');
      } else if (msg['type'] == 'desktop-to-mobile') {
        _desktopToMobileController.add(msg);
        print('[Sync] Desktop to mobile message: ${msg['action']}');
      } else if (msg['type'] == 'desktop-control-response') {
        _desktopControlController.add(msg);
        print('[Sync] Desktop control response: ${msg['action']}');
      } else if (msg['type'] == 'device-trust-updated') {
        final updatedDeviceId = msg['deviceId']?.toString();
        if (updatedDeviceId != null) {
          unawaited(_updateSavedDevice(
            updatedDeviceId,
            trusted: msg['trustLevel'] == 'trusted',
            autoConnect: msg['autoConnect'] != false,
            deviceName: msg['deviceName']?.toString(),
            lastSeen: DateTime.now().millisecondsSinceEpoch,
          ));
        }
      }
    } catch (e) {
      print('[Sync] Error handling desktop message: $e');
    }
  }

  /// Send a command to execute on the desktop
  Future<Map?> executeOnDesktop(
    String command, {
    Map<String, dynamic>? args,
  }) async {
    if (!isConnectedToDesktop || _desktopSocket == null) {
      throw Exception('Not connected to desktop');
    }

    final commandId = const Uuid().v4();

    _desktopSocket!.add(
      jsonEncode({
        'type': 'execute-command',
        'commandId': commandId,
        'command': command,
        'args': args ?? {},
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      }),
    );

    // Wait for response (with timeout)
    try {
      final response = await onDesktopControl
          .firstWhere(
            (msg) => msg['commandId'] == commandId,
            orElse: () => {'error': 'Timeout'},
          )
          .timeout(const Duration(seconds: 30));

      return response;
    } catch (e) {
      print('[Sync] Command execution failed: $e');
      return {'error': e.toString()};
    }
  }

  /// Send a prompt to be executed on desktop (for AI features)
  Future<Map?> sendPromptToDesktop(String prompt, {String? model}) async {
    return executeOnDesktop('ai-prompt', args: {
      'prompt': prompt,
      'model': model,
    });
  }

  /// Disconnect from desktop
  void disconnectFromDesktop() {
    if (_desktopConnectionMode == 'local') {
      _desktopSocket?.close();
    }
    _stopDesktopHeartbeat();
    _desktopSocket = null;
    isConnectedToDesktop = false;
    _desktopIp = null;
    _desktopPort = null;
    _desktopConnectionMode = 'none';
    _connectedDesktopLabel = null;
    remoteDeviceId = null;
    stopDiscovery();
    print('[Sync] Disconnected from desktop');
  }

  /// Get current connection info
  Map<String, dynamic> getConnectionInfo() {
    return {
      'isConnected': isConnectedToDesktop,
      'desktopIp': _desktopIp,
      'desktopPort': _desktopPort,
      'remoteDeviceId': remoteDeviceId,
      'mode': _desktopConnectionMode,
      'label': _connectedDesktopLabel,
    };
  }

  /// Desktop Control - Full AI Chat Interface
  Future<Map?> executeDesktopControl(
    String action, {
    String? prompt,
    Map<String, dynamic>? args,
    String? promptId,
  }) async {
    if (_desktopConnectionMode == 'cloud') {
      if (remoteDeviceId == null) {
        throw Exception('No cloud desktop selected');
      }

      final activePromptId = promptId ?? const Uuid().v4();

      if (action == 'send-prompt') {
        if (prompt == null || prompt.trim().isEmpty) {
          return {'success': false, 'error': 'Prompt is required'};
        }
        sendPromptToCloudDevice(
          remoteDeviceId!,
          prompt,
          promptId: activePromptId,
        );
        return {
          'success': true,
          'promptId': activePromptId,
          'commandId': activePromptId,
          'mode': 'cloud',
        };
      }

      if (action == 'get-status') {
        final device =
            _cloudDeviceCache[remoteDeviceId] as Map<String, dynamic>? ?? {};
        return {
          'success': true,
          'desktopName':
              device['deviceName'] ?? _connectedDesktopLabel ?? 'Cloud Desktop',
          'platform': device['platform'] ?? 'cloud',
          'connectionMode': 'cloud',
          'online': device['online'] ?? true,
          'activeApp': 'Remote Comet Desktop',
          'screenOn': true,
        };
      }

      return {
        'success': false,
        'error':
            'This desktop control action is only available on local network right now. Cloud mode currently supports AI sidebar prompts.',
        'mode': 'cloud',
      };
    }

    if (!isConnectedToDesktop || _desktopSocket == null) {
      throw Exception('Not connected to desktop');
    }

    final commandId = const Uuid().v4();

    _desktopSocket!.add(
      jsonEncode({
        'type': 'desktop-control',
        'commandId': commandId,
        'action': action,
        'prompt': prompt,
        'promptId': promptId ?? commandId,
        'args': args ?? {},
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      }),
    );

    try {
      if (action == 'send-prompt') {
        return {
          'success': true,
          'promptId': commandId,
          'commandId': commandId,
        };
      }

      final response = await onCommandResponse
          .firstWhere(
            (msg) => msg['commandId'] == commandId,
            orElse: () => {'error': 'Timeout'},
          )
          .timeout(const Duration(seconds: 30));

      return response;
    } catch (e) {
      print('[Sync] Desktop control failed: $e');
      return {'error': e.toString()};
    }
  }

  /// Request desktop status
  Future<Map?> getDesktopStatus() async {
    return executeDesktopControl('get-status');
  }

  /// Take screenshot from desktop
  Future<Map?> takeDesktopScreenshot() async {
    return executeDesktopControl('screenshot');
  }

  /// Execute shell command via desktop (triggers QR scanner on Mac if needed)
  Future<Map?> executeShellViaDesktop(String command,
      {bool requireApproval = true}) async {
    return executeDesktopControl('shell-command', args: {
      'command': command,
      'requireApproval': requireApproval,
    });
  }

  /// Get clipboard from desktop
  Future<String?> getDesktopClipboard() async {
    final result = await executeDesktopControl('get-clipboard');
    return result?['clipboard'];
  }

  /// Open URL on desktop browser
  Future<Map?> openUrlOnDesktop(String url) async {
    return executeDesktopControl('open-url', args: {'url': url});
  }

  /// Click at coordinates on desktop
  Future<Map?> clickOnDesktop(int x, int y) async {
    return executeDesktopControl('click', args: {'x': x, 'y': y});
  }

  /// Request desktop to show QR for shell approval
  Future<Map?> requestShellApprovalQR(String commandId, String command) async {
    return executeDesktopControl('show-shell-qr', args: {
      'commandId': commandId,
      'command': command,
    });
  }

  // Cloud Sync Methods
  String? _cloudUserId;
  String? _cloudDeviceId;
  bool _cloudConnected = false;
  DatabaseReference? _cloudDevicesRef;
  final StreamController<Map<String, dynamic>> _cloudDevicesController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onCloudDevicesUpdated =>
      _cloudDevicesController.stream;

  Future<void> initializeCloud(String userId, {String? deviceId}) async {
    _cloudUserId = userId;
    _cloudConnected = true;
    if (deviceId != null) {
      _cloudDeviceId = deviceId;
    } else {
      try {
        final dir = await getApplicationDocumentsDirectory();
        final file = File('${dir.path}/device_id.txt');
        if (await file.exists()) {
          _cloudDeviceId = await file.readAsString();
        } else {
          _cloudDeviceId = const Uuid().v4();
          await file.writeAsString(_cloudDeviceId!);
        }
      } catch (e) {
        print('[CloudSync] Error loading/saving device ID: $e');
        _cloudDeviceId = const Uuid().v4();
      }
    }
    print('[CloudSync] Initialized for user: $userId, device: $_cloudDeviceId');
    _startCloudDeviceListener();
    _startCloudAIResponseListener();
  }

  void _startCloudDeviceListener() {
    if (_cloudUserId == null) return;

    _cloudDevicesRef = FirebaseDatabase.instance.ref('devices/$_cloudUserId');
    _cloudDevicesSubscription?.cancel();
    _cloudDevicesSubscription = _cloudDevicesRef!.onValue.listen((event) {
      if (event.snapshot.value != null) {
        final Map<dynamic, dynamic> data = event.snapshot.value as Map;
        _cloudDeviceCache
          ..clear()
          ..addAll(
            data.map((key, value) => MapEntry(
                  key.toString(),
                  Map<String, dynamic>.from(value as Map),
                )),
          );
        _cloudDevicesController.add(Map<String, dynamic>.from(data));
      }
    });
  }

  void _startCloudAIResponseListener() {
    if (_cloudUserId == null || _cloudDeviceId == null) return;

    _cloudAIResponsesSubscription?.cancel();
    final responsesRef = FirebaseDatabase.instance
        .ref('aiResponses/$_cloudUserId/$_cloudDeviceId');

    _cloudAIResponsesSubscription = responsesRef.onValue.listen((event) {
      final data = event.snapshot.value;
      if (data is Map && data['response'] != null) {
        _aiStreamController.add({
          'promptId': data['promptId'],
          'response': data['response'],
          'isStreaming': data['isStreaming'] ?? false,
          'mode': 'cloud',
        });
      }
    });
  }

  Future<bool> connectToCloudDevice(String targetDeviceId) async {
    if (_cloudUserId == null || _cloudDeviceId == null) return false;

    try {
      final connectionRef = FirebaseDatabase.instance
          .ref('connections/$_cloudUserId/$_cloudDeviceId/$targetDeviceId');

      await connectionRef.set({
        'requestedAt': DateTime.now().millisecondsSinceEpoch,
        'status': 'pending'
      });

      // Wait for acceptance
      final completer = Completer<bool>();

      FirebaseDatabase.instance
          .ref(
              'connections/$_cloudUserId/$targetDeviceId/$_cloudDeviceId/status')
          .onValue
          .listen((event) {
        if (event.snapshot.value == 'accepted') {
          if (!completer.isCompleted) completer.complete(true);
        } else if (event.snapshot.value == 'rejected') {
          if (!completer.isCompleted) completer.complete(false);
        }
      });

      final connected =
          await completer.future.timeout(const Duration(seconds: 30));
      if (connected) {
        remoteDeviceId = targetDeviceId;
        isConnectedToDesktop = true;
        _desktopConnectionMode = 'cloud';
        final device =
            _cloudDeviceCache[targetDeviceId] as Map<String, dynamic>?;
        _connectedDesktopLabel =
            device?['deviceName']?.toString() ?? 'Cloud Desktop';
        _desktopIp = null;
        _desktopPort = null;
      }
      return connected;
    } catch (e) {
      print('[CloudSync] Connection failed: $e');
      return false;
    }
  }

  void disconnectFromCloudDevice(String targetDeviceId) {
    if (_cloudUserId == null || _cloudDeviceId == null) return;
    _cloudDevicesRef?.child(targetDeviceId).update({'online': false});
    if (remoteDeviceId == targetDeviceId) {
      isConnectedToDesktop = false;
      _desktopConnectionMode = 'none';
      _connectedDesktopLabel = null;
      remoteDeviceId = null;
    }
  }

  Future<void> syncClipboardToCloud(String text) async {
    if (_cloudUserId == null) return;
    final clipboardRef =
        FirebaseDatabase.instance.ref('clipboard/$_cloudUserId');
    await clipboardRef.set({
      'content': text,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'deviceId': _cloudDeviceId
    });
  }

  Future<void> syncHistoryToCloud(List<Map> history) async {
    if (_cloudUserId == null) return;
    final historyRef = FirebaseDatabase.instance.ref('history/$_cloudUserId');
    await historyRef.set(
        {'items': history, 'timestamp': DateTime.now().millisecondsSinceEpoch});
  }

  void sendPromptToCloudDevice(String deviceId, String prompt,
      {String? promptId}) {
    if (_cloudUserId == null) return;
    final promptRef =
        FirebaseDatabase.instance.ref('prompts/$_cloudUserId/$deviceId');
    promptRef.set({
      'promptId': promptId ?? 'prompt_${DateTime.now().millisecondsSinceEpoch}',
      'fromDeviceId': _cloudDeviceId,
      'prompt': prompt,
      'timestamp': DateTime.now().millisecondsSinceEpoch
    });
  }

  void forwardPromptToCloudDesktops(String prompt, {String? promptId}) async {
    if (_cloudUserId == null) return;

    // Get all online desktop devices
    final devicesSnapshot =
        await FirebaseDatabase.instance.ref('devices/$_cloudUserId').get();
    if (devicesSnapshot.value != null) {
      final Map<dynamic, dynamic> devices = devicesSnapshot.value as Map;
      for (final entry in devices.entries) {
        if (entry.key != _cloudDeviceId &&
            entry.value['deviceType'] == 'desktop' &&
            entry.value['online'] == true) {
          sendPromptToCloudDevice(entry.key, prompt, promptId: promptId);
        }
      }
    }
  }

  bool get isCloudConnected => _cloudConnected;
  bool get isCloudDesktopSession => _desktopConnectionMode == 'cloud';
  String get desktopConnectionMode => _desktopConnectionMode;
  String? get connectedDesktopLabel => _connectedDesktopLabel;
}
