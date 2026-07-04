import 'dart:async';
import 'package:flutter/material.dart';
import '../sync_service.dart';

class RemoteSettingsPage extends StatefulWidget {
  const RemoteSettingsPage({Key? key}) : super(key: key);

  @override
  State<RemoteSettingsPage> createState() => _RemoteSettingsPageState();
}

class _RemoteSettingsPageState extends State<RemoteSettingsPage> {
  Map<String, dynamic> _settings = {};
  bool _isLoading = true;
  bool _isConnected = false;
  bool _hasChanges = false;
  bool _showClipboardHistory = false;
  List<String> _clipboardHistory = [];
  StreamSubscription? _settingsSubscription;

  final Map<String, SettingCategory> _categories = {
    'llm': SettingCategory(
      name: 'AI & LLM',
      icon: Icons.smart_toy,
      color: const Color(0xFF00E5FF),
      settings: [
        'llm_provider',
        'llm_model',
        'ollama_url',
        'temperature',
        'max_tokens',
      ],
    ),
    'security': SettingCategory(
      name: 'Security',
      icon: Icons.shield,
      color: Colors.orange,
      settings: [
        'auto_approve_low',
        'auto_approve_mid',
        'shell_approval_qr',
      ],
    ),
    'appearance': SettingCategory(
      name: 'Appearance',
      icon: Icons.palette,
      color: Colors.purple,
      settings: [
        'theme',
        'font_size',
      ],
    ),
    'browser': SettingCategory(
      name: 'Browser',
      icon: Icons.language,
      color: Colors.green,
      settings: [
        'homepage',
        'search_engine',
      ],
    ),
    'automation': SettingCategory(
      name: 'Automation',
      icon: Icons.bolt,
      color: Colors.amber,
      settings: [
        'run_in_background',
        'notifications_enabled',
      ],
    ),
    'p2p': SettingCategory(
      name: 'P2P & Sync',
      icon: Icons.sync_alt,
      color: const Color(0xFF4CAF50),
      settings: [
        'sync_mode',
        'auto_reconnect',
        'temp_storage',
      ],
    ),
    'clipboard': SettingCategory(
      name: 'Clipboard',
      icon: Icons.content_paste,
      color: const Color(0xFF9C27B0),
      settings: [
        'clipboard_sync_enabled',
        'clipboard_history',
        'clipboard_interval',
      ],
    ),
  };

  @override
  void initState() {
    super.initState();
    _isConnected = SyncService().isConnectedToDesktop;
    _loadSettings();
    _listenToUpdates();
  }

  void _listenToUpdates() {
    _settingsSubscription = SyncService().onDesktopToMobile.listen((msg) {
      if (msg['type'] == 'settings-update') {
        setState(() {
          _settings[msg['key']] = msg['value'];
        });
      }
    });

    SyncService().onDesktopControl.listen((msg) {
      if (msg['action'] == 'get-settings' && msg['success'] == true) {
        setState(() {
          _settings = Map<String, dynamic>.from(msg['settings']);
          _isLoading = false;
        });
      }
    });

    SyncService().onClipboardSynced.listen((text) {
      setState(() {
        _clipboardHistory.insert(0, text);
        if (_clipboardHistory.length > 20) {
          _clipboardHistory = _clipboardHistory.sublist(0, 20);
        }
      });
    });
  }

  Future<void> _loadSettings() async {
    if (!_isConnected) {
      setState(() {
        _isLoading = false;
      });
      return;
    }

    try {
      await SyncService().executeDesktopControl('get-settings');
      // The listener will update the state when response arrives
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _saveSetting(String key, dynamic value) async {
    setState(() {
      _settings[key] = value;
      _hasChanges = true;
    });

    try {
      await SyncService().executeDesktopControl('update-setting', args: {
        'key': key,
        'value': value,
      });
      setState(() {
        _hasChanges = false;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save: $e')),
      );
    }
  }

  @override
  void dispose() {
    _settingsSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Desktop Settings',
            style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (_hasChanges)
            TextButton(
              onPressed: _loadSettings,
              child: const Text('Discard',
                  style: TextStyle(color: Colors.white54)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: _loadSettings,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (!_isConnected) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 80, color: Colors.white24),
            const SizedBox(height: 20),
            const Text('Not Connected',
                style: TextStyle(color: Colors.white70, fontSize: 18)),
            const SizedBox(height: 10),
            const Text(
              'Connect to desktop to manage settings',
              style: TextStyle(color: Colors.white38),
            ),
            const SizedBox(height: 30),
            ElevatedButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/connect-desktop'),
              icon: const Icon(Icons.link),
              label: const Text('Connect Desktop'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00E5FF),
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      );
    }

    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF00E5FF)),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ..._categories.entries
            .map((entry) => _buildCategorySection(entry.key, entry.value)),
        const SizedBox(height: 20),
        _buildClipboardHistoryPanel(),
        const SizedBox(height: 30),
        _buildDangerZone(),
      ],
    );
  }

  Widget _buildClipboardHistoryPanel() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        children: [
          ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF9C27B0).withOpacity(0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child:
                  const Icon(Icons.history, color: Color(0xFF9C27B0), size: 20),
            ),
            title: const Text('Clipboard History',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
            subtitle: Text('${_clipboardHistory.length} items',
                style: TextStyle(
                    color: Colors.white.withOpacity(0.4), fontSize: 12)),
            trailing: IconButton(
              icon: Icon(
                _showClipboardHistory ? Icons.expand_less : Icons.expand_more,
                color: Colors.white70,
              ),
              onPressed: () {
                setState(() {
                  _showClipboardHistory = !_showClipboardHistory;
                });
              },
            ),
          ),
          if (_showClipboardHistory) ...[
            const Divider(color: Colors.white10, height: 1),
            if (_clipboardHistory.isEmpty)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text('No clipboard history yet',
                    style: TextStyle(color: Colors.white38)),
              )
            else
              ...List.generate(_clipboardHistory.length, (index) {
                final text = _clipboardHistory[index];
                return ListTile(
                  dense: true,
                  title: Text(
                    text.length > 50 ? '${text.substring(0, 50)}...' : text,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text('Item ${index + 1}',
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.3), fontSize: 10)),
                  trailing: IconButton(
                    icon:
                        const Icon(Icons.copy, color: Colors.white38, size: 18),
                    onPressed: () {
                      // Copy to clipboard
                    },
                  ),
                );
              }),
          ],
        ],
      ),
    );
  }

  Widget _buildCategorySection(String categoryKey, SettingCategory category) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: category.color.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(category.icon, color: category.color, size: 20),
                ),
                const SizedBox(width: 12),
                Text(
                  category.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10, height: 1),
          ...category.settings.map((setting) => _buildSettingTile(setting)),
        ],
      ),
    );
  }

  Widget _buildSettingTile(String settingKey) {
    final config = _settingConfigs[settingKey];
    if (config == null) return const SizedBox();

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      title: Text(
        config['label'] ?? settingKey,
        style: const TextStyle(color: Colors.white, fontSize: 14),
      ),
      subtitle: Text(
        config['description'] ?? '',
        style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
      ),
      trailing: _buildSettingControl(settingKey, config),
    );
  }

  Widget _buildSettingControl(String settingKey, Map config) {
    final type = config['type'];
    final value = _settings[settingKey];

    switch (type) {
      case 'toggle':
        return Switch(
          value: value == true,
          onChanged: (v) => _saveSetting(settingKey, v),
          activeColor: const Color(0xFF00E5FF),
        );

      case 'select':
        return PopupMenuButton<String>(
          initialValue: value?.toString(),
          onSelected: (v) => _saveSetting(settingKey, v),
          color: const Color(0xFF1E1E1E),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value?.toString() ?? 'Select',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const Icon(Icons.arrow_drop_down, color: Colors.white54),
              ],
            ),
          ),
          itemBuilder: (context) => (config['options'] as List<Map>)
              .map<PopupMenuEntry<String>>((opt) => PopupMenuItem<String>(
                    value: opt['value'] as String,
                    child: Text(opt['label'] as String,
                        style: const TextStyle(color: Colors.white)),
                  ))
              .toList(),
        );

      case 'slider':
        return SizedBox(
          width: 150,
          child: Row(
            children: [
              Expanded(
                child: Slider(
                  value: (value as num?)?.toDouble() ?? 0.5,
                  min: (config['min'] as num?)?.toDouble() ?? 0,
                  max: (config['max'] as num?)?.toDouble() ?? 1,
                  divisions: ((config['max'] - config['min']) / config['step'])
                      .round(),
                  onChanged: (v) => _saveSetting(settingKey, v),
                  activeColor: const Color(0xFF00E5FF),
                ),
              ),
              Text(
                value?.toString() ?? '0',
                style: const TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        );

      case 'text':
        return SizedBox(
          width: 150,
          child: TextField(
            controller: TextEditingController(text: value?.toString() ?? ''),
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Colors.white.withOpacity(0.1),
            ),
            onSubmitted: (v) => _saveSetting(settingKey, v),
          ),
        );

      default:
        return const SizedBox();
    }
  }

  Widget _buildDangerZone() {
    return Container(
      margin: const EdgeInsets.only(bottom: 30),
      decoration: BoxDecoration(
        color: Colors.red.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.warning, color: Colors.red, size: 20),
                SizedBox(width: 8),
                Text(
                  'Danger Zone',
                  style: TextStyle(
                    color: Colors.red,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: Color(0x33FF0000), height: 1),
          ListTile(
            title: const Text('Restart Desktop App',
                style: TextStyle(color: Colors.white)),
            subtitle: const Text('Restart the desktop application',
                style: TextStyle(color: Colors.white38, fontSize: 12)),
            trailing: const Icon(Icons.restart_alt, color: Colors.red),
            onTap: () => _showConfirmDialog(
              'Restart Desktop',
              'This will restart the Aartiq desktop application.',
              () => SyncService().executeDesktopControl('restart'),
            ),
          ),
          ListTile(
            title: const Text('Clear All Settings',
                style: TextStyle(color: Colors.white)),
            subtitle: const Text('Reset all settings to default',
                style: TextStyle(color: Colors.white38, fontSize: 12)),
            trailing: const Icon(Icons.delete_forever, color: Colors.red),
            onTap: () => _showConfirmDialog(
              'Clear Settings',
              'This will reset all desktop settings to their defaults. This cannot be undone.',
              () => SyncService().executeDesktopControl('clear-settings'),
            ),
          ),
        ],
      ),
    );
  }

  void _showConfirmDialog(
      String title, String message, VoidCallback onConfirm) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Text(title, style: const TextStyle(color: Colors.white)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child:
                const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              onConfirm();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('$title completed')),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Confirm', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  final Map<String, Map<String, dynamic>> _settingConfigs = {
    'llm_provider': {
      'label': 'AI Provider',
      'description': 'Primary AI provider',
      'type': 'select',
      'options': [
        {'label': 'Gemini (Recommended)', 'value': 'gemini'},
        {'label': 'Ollama (Local)', 'value': 'ollama'},
        {'label': 'OpenAI', 'value': 'openai'},
        {'label': 'Claude', 'value': 'anthropic'},
      ],
    },
    'llm_model': {
      'label': 'Default Model',
      'description': 'Default AI model for tasks',
      'type': 'select',
      'options': [
        {'label': 'Gemini Flash', 'value': 'gemini-2.0-flash'},
        {'label': 'Gemini Pro', 'value': 'gemini-1.5-pro'},
        {'label': 'DeepSeek R1 8B', 'value': 'deepseek-r1:8b'},
        {'label': 'GPT-4o Mini', 'value': 'gpt-4o-mini'},
      ],
    },
    'temperature': {
      'label': 'Temperature',
      'description': 'AI creativity level',
      'type': 'slider',
      'min': 0.0,
      'max': 1.0,
      'step': 0.1,
    },
    'max_tokens': {
      'label': 'Max Tokens',
      'description': 'Maximum response length',
      'type': 'select',
      'options': [
        {'label': '1024', 'value': '1024'},
        {'label': '2048', 'value': '2048'},
        {'label': '4096', 'value': '4096'},
        {'label': '8192', 'value': '8192'},
      ],
    },
    'auto_approve_low': {
      'label': 'Auto-approve Low Risk',
      'description': 'Automatically run safe commands',
      'type': 'toggle',
    },
    'auto_approve_mid': {
      'label': 'Auto-approve Medium Risk',
      'description': 'Run medium risk commands without prompt',
      'type': 'toggle',
    },
    'shell_approval_qr': {
      'label': 'QR Approval for Shell',
      'description': 'Use QR code for shell approvals on Mac',
      'type': 'toggle',
    },
    'theme': {
      'label': 'Theme',
      'description': 'Desktop app theme',
      'type': 'select',
      'options': [
        {'label': 'Dark', 'value': 'dark'},
        {'label': 'Light', 'value': 'light'},
        {'label': 'System', 'value': 'system'},
      ],
    },
    'font_size': {
      'label': 'Font Size',
      'description': 'UI font size',
      'type': 'select',
      'options': [
        {'label': '12px', 'value': '12'},
        {'label': '14px', 'value': '14'},
        {'label': '16px', 'value': '16'},
        {'label': '18px', 'value': '18'},
      ],
    },
    'homepage': {
      'label': 'Homepage',
      'description': 'Default homepage URL',
      'type': 'text',
    },
    'search_engine': {
      'label': 'Search Engine',
      'description': 'Default search provider',
      'type': 'select',
      'options': [
        {'label': 'Google', 'value': 'google'},
        {'label': 'DuckDuckGo', 'value': 'duckduckgo'},
        {'label': 'Bing', 'value': 'bing'},
      ],
    },
    'run_in_background': {
      'label': 'Run in Background',
      'description': 'Keep running when window is closed',
      'type': 'toggle',
    },
    'notifications_enabled': {
      'label': 'Notifications',
      'description': 'Show desktop notifications',
      'type': 'toggle',
    },
    'sync_mode': {
      'label': 'Sync Mode',
      'description': 'How to connect devices',
      'type': 'select',
      'options': [
        {'label': 'Local Only (WiFi)', 'value': 'local'},
        {'label': 'Cloud Only', 'value': 'cloud'},
        {'label': 'Local + Cloud', 'value': 'local_cloud'},
      ],
    },
    'auto_reconnect': {
      'label': 'Auto Reconnect',
      'description': 'Automatically reconnect to saved devices',
      'type': 'toggle',
    },
    'temp_storage': {
      'label': 'Temp Storage (P2P)',
      'description': 'Use Firebase as temp storage only (P2P mode)',
      'type': 'toggle',
    },
    'clipboard_sync_enabled': {
      'label': 'Clipboard Sync',
      'description': 'Sync clipboard between devices',
      'type': 'toggle',
    },
    'clipboard_history': {
      'label': 'Clipboard History',
      'description': 'Show recent clipboard items',
      'type': 'toggle',
    },
    'clipboard_interval': {
      'label': 'Sync Interval',
      'description': 'How often to check clipboard',
      'type': 'select',
      'options': [
        {'label': '1 second', 'value': '1'},
        {'label': '2 seconds', 'value': '2'},
        {'label': '5 seconds', 'value': '5'},
        {'label': '10 seconds', 'value': '10'},
      ],
    },
  };
}

class SettingCategory {
  final String name;
  final IconData icon;
  final Color color;
  final List<String> settings;

  SettingCategory({
    required this.name,
    required this.icon,
    required this.color,
    required this.settings,
  });
}
