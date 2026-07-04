import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:provider/provider.dart';
import 'package:collection/collection.dart';
import '../models/browser_model.dart';
import '../models/window_model.dart';
import 'aartiq_agent_service.dart';

// ─────────────────────────────────────────────
// AGENT CHAT PAGE
// ─────────────────────────────────────────────

class AgentChatPage extends StatefulWidget {
  final String initialTask;
  final InAppWebViewController? webViewController;

  const AgentChatPage({
    Key? key,
    required this.initialTask,
    this.webViewController,
  }) : super(key: key);

  @override
  State<AgentChatPage> createState() => _AgentChatPageState();
}

class _AgentChatPageState extends State<AgentChatPage>
    with TickerProviderStateMixin {
  late AartiqAgentService _agentService;
  final List<AgentStep> _steps = [];
  bool _isRunning = false;
  bool _isDone = false;
  String? _doneMessage;
  String? _stuckMessage;
  final ScrollController _scrollController = ScrollController();
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  String? _apiKey;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _loadApiKeyAndStart();
  }

  @override
  void dispose() {
    _agentService.dispose();
    _pulseController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadApiKeyAndStart() async {
    final browserModel = Provider.of<BrowserModel>(context, listen: false);
    final settings = browserModel.getSettings();
    final isGemini = settings.geminiModel.toLowerCase().contains('gemini');

    _apiKey = isGemini ? settings.geminiApiKey : settings.claudeApiKey;

    if (_apiKey == null || _apiKey!.isEmpty) {
      final key = await _showApiKeyDialog(isGemini);
      if (key == null || key.isEmpty) {
        if (mounted) Navigator.pop(context);
        return;
      }
      _apiKey = key;
      if (isGemini) {
        settings.geminiApiKey = key;
      } else {
        settings.claudeApiKey = key;
      }
      browserModel.updateSettings(settings);
      browserModel.save();
    }

    _startAgent();
  }

  Future<String?> _showApiKeyDialog(bool isGemini) async {
    final controller = TextEditingController();
    final providerName = isGemini ? 'Gemini' : 'Claude';
    final keyPrefix = isGemini ? 'AIza...' : 'sk-ant...';

    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0D0D1A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          '$providerName API Key Required',
          style:
              const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Aartiq Agent uses $providerName AI to browse the web autonomously. Enter your API key to continue.',
              style: const TextStyle(color: Colors.white60, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: keyPrefix,
                hintStyle: const TextStyle(color: Colors.white30),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                      color: const Color(0xFF00E5FF).withOpacity(0.3)),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child:
                const Text('Cancel', style: TextStyle(color: Colors.white38)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00E5FF), Color(0xFFD500F9)],
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00E5FF).withOpacity(0.4),
                    blurRadius: 12,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: const Text('Start Agent',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  void _startAgent() {
    final browserModel = Provider.of<BrowserModel>(context, listen: false);
    final settings = browserModel.getSettings();

    InAppWebViewController? controller = widget.webViewController;
    
    if (controller == null) {
      final windowModel = Provider.of<WindowModel>(context, listen: false);
      final currentTab = windowModel.getCurrentTab();
      if (currentTab != null) {
        controller = currentTab.webViewModel.webViewController;
      }
    }

    _agentService = AartiqAgentService(
      apiKey: _apiKey!,
      model: settings.geminiModel,
      webViewController: controller,
    );

    setState(() {
      _isRunning = true;
      _isDone = false;
      _steps.clear();
      _doneMessage = null;
      _stuckMessage = null;
    });

    _hookAgentListeners();

    _agentService.runTask(widget.initialTask).then((session) {
      if (mounted) {
        setState(() {
          if (!_isDone && _stuckMessage == null) {
            _isRunning = false;
            if (session.isDone) {
              _isDone = true;
              _doneMessage = session.doneMessage;
            } else if (session.stuckMessage != null) {
              _stuckMessage = session.stuckMessage;
            }
          }
        });
      }
    });
  }

  void _stopAgent() {
    _agentService.stop();
    setState(() {
      _isRunning = false;
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _sendFollowUpTask(String task) {
    if (task.isEmpty) return;
    
    setState(() {
      _isRunning = true;
      _isDone = false;
      _stuckMessage = null;
      _doneMessage = null;
    });

    // Check if we need to get a controller
    if (_agentService.webViewController == null) {
      final windowModel = Provider.of<WindowModel>(context, listen: false);
      final currentTab = windowModel.getCurrentTab();
      if (currentTab != null) {
        // Re-initialize service with the controller
        final browserModel = Provider.of<BrowserModel>(context, listen: false);
        final settings = browserModel.getSettings();
        _agentService = AartiqAgentService(
          apiKey: _apiKey!,
          model: settings.geminiModel,
          webViewController: currentTab.webViewModel.webViewController,
        );
        // Re-hook listeners
        _hookAgentListeners();
      }
    }

    _agentService.runTask(task).then((session) {
      if (mounted) {
        setState(() {
          if (!_isDone && _stuckMessage == null) {
            _isRunning = false;
            if (session.isDone) {
              _isDone = true;
              _doneMessage = session.doneMessage;
            } else if (session.stuckMessage != null) {
              _stuckMessage = session.stuckMessage;
            }
          }
        });
      }
    });
  }

  void _hookAgentListeners() {
    _agentService.onStep.listen((step) {
      if (mounted) {
        setState(() {
          _steps.add(step);
          
          final doneAction = step.actions.firstWhereOrNull((a) {
            final normalized = a.trim().replaceAll('[', '').replaceAll(']', '');
            return normalized.startsWith('DONE:');
          });
          
          final stuckAction = step.actions.firstWhereOrNull((a) {
            final normalized = a.trim().replaceAll('[', '').replaceAll(']', '');
            return normalized.startsWith('STUCK:');
          });

          if (doneAction != null) {
            _isDone = true;
            _isRunning = false;
            _doneMessage = doneAction
                .replaceAll('[', '').replaceAll(']', '')
                .replaceFirst('DONE:', '')
                .trim()
                .replaceAll('"', '');
          } else if (stuckAction != null) {
            _isRunning = false;
            _stuckMessage = stuckAction
                .replaceAll('[', '').replaceAll(']', '')
                .replaceFirst('STUCK:', '')
                .trim()
                .replaceAll('"', '');
          }
        });
        _scrollToBottom();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020208),
      body: Stack(
        children: [
          // Animated background
          _buildBackground(),

          // Main content
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                _buildTaskCard(),
                Expanded(child: _buildStepsList()),
                if (_isDone || _stuckMessage != null) _buildResultCard(),
                if (_isRunning) _buildThinkingIndicator(),
                _buildBottomBar(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Stack(
          children: [
            Positioned(
              top: -100,
              left: -100,
              child: Container(
                width: 400,
                height: 400,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF00E5FF)
                          .withOpacity(0.06 * _pulseAnimation.value),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFFD500F9)
                          .withOpacity(0.05 * _pulseAnimation.value),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white54),
            onPressed: () {
              _stopAgent();
              Navigator.pop(context);
            },
          ),
          const SizedBox(width: 8),
          // Agent status indicator
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isRunning
                      ? Color.lerp(const Color(0xFF00E5FF),
                          const Color(0xFF00FF88), _pulseAnimation.value)!
                      : _isDone
                          ? const Color(0xFF00FF88)
                          : const Color(0xFFFF4444),
                  boxShadow: _isRunning
                      ? [
                          BoxShadow(
                            color: const Color(0xFF00E5FF)
                                .withOpacity(0.6 * _pulseAnimation.value),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ]
                      : null,
                ),
              );
            },
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'AARTIQ AGENT',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                    fontFamily: 'Outfit',
                  ),
                ),
                Text(
                  _isRunning
                      ? 'Step ${_steps.length} • Executing...'
                      : _isDone
                          ? 'Task Complete ✓'
                          : _stuckMessage != null
                              ? 'Agent Stuck'
                              : 'Idle',
                  style: TextStyle(
                    color: _isRunning
                        ? const Color(0xFF00E5FF)
                        : _isDone
                            ? const Color(0xFF00FF88)
                            : Colors.white38,
                    fontSize: 11,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          if (_isRunning)
            TextButton.icon(
              onPressed: _stopAgent,
              icon: const Icon(Icons.stop_circle_outlined, size: 16),
              label: const Text('Stop', style: TextStyle(fontSize: 12)),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFFF4444),
                backgroundColor: const Color(0xFFFF4444).withOpacity(0.1),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTaskCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF00E5FF).withOpacity(0.08),
            const Color(0xFFD500F9).withOpacity(0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF00E5FF).withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00E5FF).withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.auto_awesome,
                color: Color(0xFF00E5FF), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'TASK',
                  style: TextStyle(
                    color: Color(0xFF00E5FF),
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  widget.initialTask,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepsList() {
    if (_steps.isEmpty && _isRunning) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                return Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF00E5FF)
                            .withOpacity(0.4 * _pulseAnimation.value),
                        blurRadius: 30,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.psychology,
                    color: Color(0xFF00E5FF),
                    size: 50,
                  ),
                );
              },
            ),
            const SizedBox(height: 20),
            const Text(
              'Initializing Agent...',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 16,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _steps.length,
      itemBuilder: (context, index) {
        return _buildStepCard(_steps[index]);
      },
    );
  }

  Widget _buildStepCard(AgentStep step) {
    final color = _getStepColor(step.stepStatus);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2), width: 1),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withOpacity(0.15),
              border: Border.all(color: color.withOpacity(0.4)),
            ),
            child: Center(
              child: Text(
                '${step.stepNumber}',
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          title: Text(
            step.status.isNotEmpty ? step.status : 'Step ${step.stepNumber}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: step.nextAction.isNotEmpty
              ? Text(
                  step.nextAction,
                  style: TextStyle(color: color.withOpacity(0.7), fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                )
              : null,
          trailing: _buildStepStatusIcon(step.stepStatus),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (step.thinking.isNotEmpty) ...[
                    _buildSection(
                        '🧠 Thinking', step.thinking, const Color(0xFF9C27B0)),
                    const SizedBox(height: 12),
                  ],
                  if (step.actions.isNotEmpty) ...[
                    _buildActionsSection(step.actions),
                  ],
                  if (step.screenshotBase64 != null) ...[
                    const SizedBox(height: 12),
                    _buildScreenshotPreview(step.screenshotBase64!),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, String content, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(0.1)),
          ),
          child: Text(
            content,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionsSection(List<String> actions) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '⚡ ACTIONS',
          style: TextStyle(
            color: Color(0xFF00E5FF),
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF00E5FF).withOpacity(0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: actions.map((action) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('› ',
                        style:
                            TextStyle(color: Color(0xFF00E5FF), fontSize: 12)),
                    Expanded(
                      child: Text(
                        action,
                        style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildScreenshotPreview(String base64) {
    try {
      final bytes = base64Decode(base64);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '📸 SCREENSHOT',
            style: TextStyle(
              color: Colors.white38,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.memory(
              bytes,
              height: 150,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
        ],
      );
    } catch (e) {
      return const SizedBox.shrink();
    }
  }

  Widget _buildStepStatusIcon(AgentStepStatus status) {
    switch (status) {
      case AgentStepStatus.done:
        return const Icon(Icons.check_circle,
            color: Color(0xFF00FF88), size: 20);
      case AgentStepStatus.stuck:
        return const Icon(Icons.error_outline,
            color: Color(0xFFFF4444), size: 20);
      case AgentStepStatus.error:
        return const Icon(Icons.warning_amber,
            color: Color(0xFFFF9800), size: 20);
      case AgentStepStatus.thinking:
        return const Icon(Icons.psychology, color: Color(0xFF9C27B0), size: 20);
      case AgentStepStatus.acting:
        return const Icon(Icons.bolt, color: Color(0xFF00E5FF), size: 20);
    }
  }

  Color _getStepColor(AgentStepStatus status) {
    switch (status) {
      case AgentStepStatus.done:
        return const Color(0xFF00FF88);
      case AgentStepStatus.stuck:
        return const Color(0xFFFF4444);
      case AgentStepStatus.error:
        return const Color(0xFFFF9800);
      case AgentStepStatus.thinking:
        return const Color(0xFF9C27B0);
      case AgentStepStatus.acting:
        return const Color(0xFF00E5FF);
    }
  }

  Widget _buildThinkingIndicator() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF00E5FF).withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.15)),
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Row(
                children: List.generate(3, (i) {
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF00E5FF).withOpacity(
                        ((_pulseAnimation.value + i * 0.33) % 1.0)
                            .clamp(0.2, 1.0),
                      ),
                    ),
                  );
                }),
              );
            },
          ),
          const SizedBox(width: 12),
          const Text(
            'Agent is thinking...',
            style: TextStyle(color: Color(0xFF00E5FF), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildResultCard() {
    final isSuccess = _isDone;
    final color = isSuccess ? const Color(0xFF00FF88) : const Color(0xFFFF4444);
    final message = isSuccess ? _doneMessage : _stuckMessage;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.1), color.withOpacity(0.04)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isSuccess ? Icons.check_circle : Icons.error_outline,
            color: color,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isSuccess ? 'TASK COMPLETED' : 'AGENT STUCK',
                  style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
                if (message != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    message,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final followUpController = TextEditingController();
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!_isRunning)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: followUpController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: "Send follow-up instruction...",
                        hintStyle: TextStyle(color: Colors.white30),
                        border: InputBorder.none,
                      ),
                      onSubmitted: (val) {
                        _sendFollowUpTask(val);
                        followUpController.clear();
                      },
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send, color: Color(0xFF00E5FF), size: 20),
                    onPressed: () {
                      _sendFollowUpTask(followUpController.text);
                      followUpController.clear();
                    },
                  ),
                ],
              ),
            ),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text('Back to Browser'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.08),
                    foregroundColor: Colors.white70,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              if (!_isRunning && (_isDone || _stuckMessage != null)) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _steps.clear();
                        _isDone = false;
                        _stuckMessage = null;
                        _doneMessage = null;
                      });
                      _startAgent();
                    },
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Retry Task'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00E5FF).withOpacity(0.15),
                      foregroundColor: const Color(0xFF00E5FF),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                            color: const Color(0xFF00E5FF).withOpacity(0.3)),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
