import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/browser_model.dart';
import '../sync_service.dart';

class FullScreenAIChat extends StatefulWidget {
  final String initialMessage;
  const FullScreenAIChat({Key? key, required this.initialMessage})
      : super(key: key);

  @override
  State<FullScreenAIChat> createState() => _FullScreenAIChatState();
}

class _FullScreenAIChatState extends State<FullScreenAIChat> {
  String _statusMessage = "Connecting to Neural Core...";
  String? _response;
  bool _isProcessing = true;

  late String _currentMessage;

  @override
  void initState() {
    super.initState();
    _currentMessage = widget.initialMessage;
    _processQuery();
  }

  Future<void> _processQuery([String? newMessage]) async {
    if (newMessage != null) {
      _currentMessage = newMessage;
    }
    
    final syncService = SyncService();

    if (!syncService.isConnectedToDesktop) {
      setState(() {
        _statusMessage = "Error: Desktop Connection Required";
        _response =
            "Please connect to the Aartiq Desktop application to enable AI features and desktop control.";
        _isProcessing = false;
      });
      return;
    }

    setState(() {
      _statusMessage = "Desktop Found. Executing Command...";
    });

    try {
      final browserModel = Provider.of<BrowserModel>(context, listen: false);
      final settings = browserModel.getSettings();
      final model = settings.geminiModel;

      setState(() {
        _statusMessage = "Using $model Intelligence...";
      });

      final result = await syncService.sendPromptToDesktop(
        _currentMessage,
        model: model,
      );
      setState(() {
        if (result != null && result['error'] != null) {
          _statusMessage = "Process Failed";
          _response = "Error: ${result['error']}";
        } else {
          _statusMessage = "Task Completed Successfully";
          _response = result?['output'] ??
              "Command executed. Check desktop for results.";
        }
        _isProcessing = false;
      });
    } catch (e) {
      setState(() {
        _statusMessage = "Connection Error";
        _response = "Failed to communicate with desktop: $e";
        _isProcessing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title:
            const Text("Aartiq Chat", style: TextStyle(fontFamily: 'Outfit')),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.black,
              const Color(0xFF1A0033),
              const Color(0xFF001A33),
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildGlowingIcon(),
                const SizedBox(height: 30),
                ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(
                    colors: [Color(0xFF00E5FF), Color(0xFFD500F9)],
                  ).createShader(bounds),
                  child: const Text(
                    "Aartiq Intelligence",
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'Outfit',
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  _statusMessage,
                  style: TextStyle(
                    color: _isProcessing
                        ? const Color(0xFF00E5FF)
                        : Colors.white54,
                    fontSize: 16,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 30),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 30),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: const Color(0xFF00E5FF).withOpacity(0.3)),
                  ),
                  child: Column(
                    children: [
                      Text(
                        "Query: ${widget.initialMessage}",
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      if (_response != null) ...[
                        const Divider(height: 30, color: Colors.white24),
                        Text(
                          _response!,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 15),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 40),
                if (_isProcessing)
                  const CircularProgressIndicator(color: Color(0xFFD500F9))
                else ...[
                  _buildInfoRow(
                      Icons.desktop_windows, "Desktop Control Active"),
                  _buildInfoRow(Icons.security, "Secure Sandboxed Execution"),
                  const SizedBox(height: 30),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 30),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: const Color(0xFF00E5FF).withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            style: const TextStyle(
                                color: Colors.white, fontSize: 14),
                            decoration: const InputDecoration(
                              hintText: "Ask another question...",
                              hintStyle: TextStyle(color: Colors.white30),
                              border: InputBorder.none,
                            ),
                            onSubmitted: (val) {
                              if (val.isNotEmpty) {
                                setState(() {
                                  _isProcessing = true;
                                  _response = null;
                                  _statusMessage = "Processing New Request...";
                                });
                                _processQuery(val);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("Close",
                        style: TextStyle(color: Colors.white38)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlowingIcon() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00E5FF)
                .withOpacity(0.5 * (_isProcessing ? 0.8 : 0.4)),
            blurRadius: 30,
            spreadRadius: 10,
          ),
        ],
      ),
      child: const Icon(Icons.auto_awesome, size: 80, color: Color(0xFF00E5FF)),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: const Color(0xFFD500F9), size: 20),
          const SizedBox(width: 12),
          Text(text,
              style: const TextStyle(color: Colors.white54, fontSize: 14)),
        ],
      ),
    );
  }
}
