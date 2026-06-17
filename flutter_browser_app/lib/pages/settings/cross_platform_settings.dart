import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_browser/models/browser_model.dart';
import 'package:flutter_browser/models/search_engine_model.dart';
import 'package:flutter_browser/models/webview_model.dart';
import 'package:flutter_browser/util.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../../models/window_model.dart';
import '../../webview_tab.dart';
import '../../sync_service.dart';
import '../../auth_service.dart';

class CrossPlatformSettings extends StatefulWidget {
  const CrossPlatformSettings({super.key});

  @override
  State<CrossPlatformSettings> createState() => _CrossPlatformSettingsState();
}

class _CrossPlatformSettingsState extends State<CrossPlatformSettings> {
  final TextEditingController _customHomePageController =
      TextEditingController();
  final TextEditingController _customUserAgentController =
      TextEditingController();
  final TextEditingController _remoteDeviceIdController =
      TextEditingController();
  final TextEditingController _welcomeMessageController =
      TextEditingController();

  @override
  void dispose() {
    _customHomePageController.dispose();
    _customUserAgentController.dispose();
    _remoteDeviceIdController.dispose();
    _welcomeMessageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final windowModel = Provider.of<WindowModel>(context, listen: true);
    final children = _buildBaseSettings();
    if (windowModel.webViewTabs.isNotEmpty) {
      children.addAll(_buildWebViewTabSettings());
    }

    return ListView(children: children);
  }

  List<Widget> _buildBaseSettings() {
    final browserModel = Provider.of<BrowserModel>(context, listen: true);
    final windowModel = Provider.of<WindowModel>(context, listen: true);
    final settings = browserModel.getSettings();

    var widgets = <Widget>[
      const ListTile(title: Text("Connectivity & Cloud Sync"), enabled: false),
      ListTile(
        title: const Text("Google Cloud Sync"),
        subtitle: Text(AuthService().isAuthenticated
            ? "Signed in as ${AuthService().userEmail}"
            : "Sign in to enable cross-device cloud sync"),
        leading: Icon(
          Icons.cloud_done,
          color: AuthService().isAuthenticated ? Colors.blue : Colors.grey,
        ),
        trailing: AuthService().isAuthenticated
            ? TextButton(
                onPressed: () async {
                  await AuthService().signOut();
                  setState(() {});
                },
                child: const Text("Sign Out", style: TextStyle(color: Colors.red)),
              )
            : ElevatedButton(
                onPressed: () async {
                  final success = await AuthService().signInWithGoogle();
                  if (success) {
                    setState(() {});
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00E5FF),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: const Text("Sign In"),
              ),
      ),
      ListTile(
        title: const Text("Cross-Device P2P Sync"),
        subtitle: Text(
          SyncService().isConnected
              ? "Connected to Peer"
              : (SyncService().deviceId != null
                  ? "Local ID: ${SyncService().deviceId!.substring(0, 8)}..."
                  : "Not Initialized"),
        ),
        leading: Icon(
          Icons.sync,
          color: SyncService().isConnected ? Colors.green : Colors.grey,
        ),
        onTap: () => _showSyncDialog(context),
      ),
      ListTile(
        title: const Text("Search Engine"),
        subtitle: Text(settings.searchEngine.name),
        trailing: DropdownButton<SearchEngineModel>(
          hint: const Text("Search Engine"),
          onChanged: (value) {
            setState(() {
              if (value != null) {
                settings.searchEngine = value;
              }
              browserModel.updateSettings(settings);
            });
          },
          value: settings.searchEngine,
          items: SearchEngines.map((searchEngine) {
            return DropdownMenuItem(
              value: searchEngine,
              child: Text(searchEngine.name),
            );
          }).toList(),
        ),
      ),
      ListTile(
        title: const Text("Home page"),
        subtitle: Text(
          settings.homePageEnabled
              ? (settings.customUrlHomePage.isEmpty
                  ? "ON"
                  : settings.customUrlHomePage)
              : "OFF",
        ),
        onTap: () {
          _customHomePageController.text = settings.customUrlHomePage;

          showDialog(
            context: context,
            builder: (context) {
              return AlertDialog(
                contentPadding: const EdgeInsets.all(0.0),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    StatefulBuilder(
                      builder: (context, setState) {
                        return SwitchListTile(
                          title: Text(settings.homePageEnabled ? "ON" : "OFF"),
                          value: settings.homePageEnabled,
                          onChanged: (value) {
                            setState(() {
                              settings.homePageEnabled = value;
                              browserModel.updateSettings(settings);
                            });
                          },
                        );
                      },
                    ),
                    StatefulBuilder(
                      builder: (context, setState) {
                        return ListTile(
                          enabled: settings.homePageEnabled,
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: <Widget>[
                              Expanded(
                                child: TextField(
                                  onSubmitted: (value) {
                                    setState(() {
                                      settings.customUrlHomePage = value;
                                      browserModel.updateSettings(settings);
                                      Navigator.pop(context);
                                    });
                                  },
                                  keyboardType: TextInputType.url,
                                  decoration: const InputDecoration(
                                    hintText: 'Custom URL Home Page',
                                  ),
                                  controller: _customHomePageController,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      FutureBuilder(
        future: InAppWebViewController.getDefaultUserAgent(),
        builder: (context, snapshot) {
          var deafultUserAgent = "";
          if (snapshot.hasData) {
            deafultUserAgent = snapshot.data as String;
          }

          return ListTile(
            title: const Text("Default User Agent"),
            subtitle: Text(deafultUserAgent),
            onLongPress: () {
              Clipboard.setData(ClipboardData(text: deafultUserAgent));
            },
          );
        },
      ),
      SwitchListTile(
        title: const Text("Debugging Enabled"),
        subtitle: const Text(
          "Enables debugging of web contents loaded into any WebViews of this application. On iOS < 16.4, the debugging mode is always enabled.",
        ),
        value: settings.debuggingEnabled,
        onChanged: (value) {
          setState(() {
            settings.debuggingEnabled = value;
            browserModel.updateSettings(settings);
            if (windowModel.webViewTabs.isNotEmpty) {
              var webViewModel = windowModel.getCurrentTab()?.webViewModel;
              if (Util.isAndroid()) {
                InAppWebViewController.setWebContentsDebuggingEnabled(
                  settings.debuggingEnabled,
                );
              }
              webViewModel?.settings?.isInspectable = settings.debuggingEnabled;
              webViewModel?.webViewController?.setSettings(
                settings: webViewModel.settings ?? InAppWebViewSettings(),
              );
              windowModel.saveInfo();
            }
          });
        },
      ),
      FutureBuilder(
        future: PackageInfo.fromPlatform(),
        builder: (context, snapshot) {
          String packageDescription = "";
          if (snapshot.hasData) {
            PackageInfo packageInfo = snapshot.data as PackageInfo;
            packageDescription =
                "Package Name: ${packageInfo.packageName}\nVersion: ${packageInfo.version}\nBuild Number: ${packageInfo.buildNumber}";
          }
          return ListTile(
            title: const Text("Comet-AI Package Info"),
            subtitle: Text(packageDescription),
            onLongPress: () {
              Clipboard.setData(ClipboardData(text: packageDescription));
            },
          );
        },
      ),
      const Divider(),
      const ListTile(title: Text("Neural Intelligence Keys"), enabled: false),
      ListTile(
        title: const Text("Gemini API Key"),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(settings.geminiApiKey.isEmpty ? "Not Set" : "••••••••"),
            const SizedBox(height: 4),
            Row(
              children: [
                const Text("Model: ",
                    style: TextStyle(fontSize: 10, color: Colors.grey)),
                DropdownButton<String>(
                  value: settings.geminiModel,
                  style:
                      const TextStyle(fontSize: 10, color: Color(0xFF00E5FF)),
                  dropdownColor: Colors.black,
                  underline: Container(),
                  items: [
                    'gemini-2.0-flash',
                    'gemini-2.0-flash-lite',
                    'gemini-2.0-pro',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-8b',
                  ]
                      .map((m) => DropdownMenuItem(
                          value: m, child: Text(m.toUpperCase())))
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      if (value != null) {
                        settings.geminiModel = value;
                        browserModel.updateSettings(settings);
                        browserModel.save();
                      }
                    });
                  },
                ),
              ],
            ),
          ],
        ),
        leading: const Icon(Icons.api, color: Color(0xFF00E5FF)),
        onTap: () =>
            _showApiKeyDialog(context, "Gemini", settings.geminiApiKey, (val) {
          settings.geminiApiKey = val;
          browserModel.updateSettings(settings);
        }),
      ),
      ListTile(
        title: const Text("OpenAI API Key"),
        subtitle: Text(settings.openaiApiKey.isEmpty ? "Not Set" : "••••••••"),
        leading: const Icon(Icons.auto_awesome, color: Color(0xFF00FF88)),
        onTap: () =>
            _showApiKeyDialog(context, "OpenAI", settings.openaiApiKey, (val) {
          settings.openaiApiKey = val;
          browserModel.updateSettings(settings);
        }),
      ),
      ListTile(
        title: const Text("Claude API Key"),
        subtitle: Text(settings.claudeApiKey.isEmpty ? "Not Set" : "••••••••"),
        leading: const Icon(Icons.psychology, color: Color(0xFFFF8800)),
        onTap: () =>
            _showApiKeyDialog(context, "Claude", settings.claudeApiKey, (val) {
          settings.claudeApiKey = val;
          browserModel.updateSettings(settings);
        }),
      ),
      ListTile(
        title: const Text("OpenRouter API Key"),
        subtitle: Text(
          settings.openRouterApiKey.isEmpty ? "Not Set" : "••••••••",
        ),
        leading: const Icon(Icons.router, color: Color(0xFF8800FF)),
        onTap: () => _showApiKeyDialog(
          context,
          "OpenRouter",
          settings.openRouterApiKey,
          (val) {
            settings.openRouterApiKey = val;
            browserModel.updateSettings(settings);
          },
        ),
      ),
      ListTile(
        title: const Text("Ollama (Local LLM)"),
        subtitle: Text("${settings.ollamaModel} @ ${settings.ollamaBaseUrl}"),
        leading: const Icon(Icons.laptop, color: Colors.orange),
        onTap: () => _showOllamaDialog(context, settings, (baseUrl, model) {
          settings.ollamaBaseUrl = baseUrl;
          settings.ollamaModel = model;
          browserModel.updateSettings(settings);
        }),
      ),
      const Divider(),
      const ListTile(title: Text("Homepage Customization"), enabled: false),
      ListTile(
        title: const Text("Welcome Message"),
        subtitle: Text(settings.homePageWelcomeMessage),
        leading: const Icon(Icons.edit_note, color: Colors.amber),
        onTap: () {
          _welcomeMessageController.text = settings.homePageWelcomeMessage;
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text("Set Welcome Message"),
              content: TextField(
                controller: _welcomeMessageController,
                decoration: const InputDecoration(hintText: "Enter message"),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Cancel"),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      settings.homePageWelcomeMessage =
                          _welcomeMessageController.text;
                      browserModel.updateSettings(settings);
                      browserModel.save();
                    });
                    Navigator.pop(context);
                  },
                  child: const Text("Save"),
                ),
              ],
            ),
          );
        },
      ),
      SwitchListTile(
        title: const Text("Show Quick Actions"),
        subtitle: const Text("Toggle AI quick action buttons on homepage"),
        value: settings.showQuickActions,
        onChanged: (value) {
          setState(() {
            settings.showQuickActions = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      SwitchListTile(
        title: const Text("Show Social Shortcuts"),
        subtitle: const Text("Toggle social media shortcuts on homepage"),
        value: settings.showSocialShortcuts,
        onChanged: (value) {
          setState(() {
            settings.showSocialShortcuts = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      const Divider(),
      const ListTile(title: Text("Visuals & Branding"), enabled: false),
      ListTile(
        title: const Text("App Name / Logo Name"),
        subtitle: Text(settings.logoName),
        leading: const Icon(Icons.title, color: Colors.blue),
        onTap: () {
          final controller = TextEditingController(text: settings.logoName);
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text("Set App Name"),
              content: TextField(controller: controller),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("Cancel")),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      settings.logoName = controller.text;
                      browserModel.updateSettings(settings);
                      browserModel.save();
                    });
                    Navigator.pop(context);
                  },
                  child: const Text("Save"),
                ),
              ],
            ),
          );
        },
      ),
      ListTile(
        title: const Text("Custom Logo URL"),
        subtitle: Text(settings.logoUrl.isEmpty ? "Default" : settings.logoUrl),
        leading: const Icon(Icons.image, color: Colors.purple),
        onTap: () {
          final controller = TextEditingController(text: settings.logoUrl);
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text("Set Logo URL"),
              content: TextField(
                  controller: controller,
                  decoration: const InputDecoration(hintText: "https://...")),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("Cancel")),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      settings.logoUrl = controller.text;
                      browserModel.updateSettings(settings);
                      browserModel.save();
                    });
                    Navigator.pop(context);
                  },
                  child: const Text("Save"),
                ),
              ],
            ),
          );
        },
      ),
      SwitchListTile(
        title: const Text("URL Predictor"),
        subtitle:
            const Text("Predict and suggest URLs as you type (Default: Off)"),
        value: settings.urlPredictorEnabled,
        onChanged: (value) {
          setState(() {
            settings.urlPredictorEnabled = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      ListTile(
        title: const Text("Theme"),
        subtitle: Text(settings.theme),
        leading: const Icon(Icons.style, color: Colors.cyan),
        trailing: DropdownButton<String>(
          value: settings.theme,
          items: [
            "Dark",
            "Vibrant",
            "Glass",
            "Minimal",
            "Ocean",
            "Sunset",
            "Forest",
            "Purple"
          ].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (val) {
            setState(() {
              if (val != null) settings.theme = val;
              browserModel.updateSettings(settings);
              browserModel.save();
            });
          },
        ),
      ),
      ListTile(
        title: const Text("Layout"),
        subtitle: Text(settings.layout),
        leading: const Icon(Icons.dashboard, color: Colors.green),
        trailing: DropdownButton<String>(
          value: settings.layout,
          items: ["Default", "Compact", "Sidebar"]
              .map((l) => DropdownMenuItem(value: l, child: Text(l)))
              .toList(),
          onChanged: (val) {
            setState(() {
              if (val != null) settings.layout = val;
              browserModel.updateSettings(settings);
              browserModel.save();
            });
          },
        ),
      ),
      ListTile(
        title: const Text("Background Color"),
        subtitle: Text(settings.homePageBgColor),
        leading: Icon(
          Icons.color_lens,
          color: Color(int.tryParse(settings.homePageBgColor) ?? 0xFF000000),
        ),
        onTap: () {
          _showColorPickerDialog(context, settings, (color) {
            setState(() {
              settings.homePageBgColor =
                  '0x${color.value.toRadixString(16).padLeft(8, '0').toUpperCase()}';
              browserModel.updateSettings(settings);
              browserModel.save();
            });
          });
        },
      ),
      const Divider(),
      const ListTile(title: Text("Security & Privacy"), enabled: false),
      SwitchListTile(
        title: const Text("Safe Browsing"),
        subtitle: const Text("Protect against malicious sites and downloads"),
        value: settings.safeBrowsingEnabled,
        onChanged: (value) {
          setState(() {
            settings.safeBrowsingEnabled = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      SwitchListTile(
        title: const Text("Tracking Prevention"),
        subtitle: const Text("Block trackers from following your web activity"),
        value: settings.trackingPreventionEnabled,
        onChanged: (value) {
          setState(() {
            settings.trackingPreventionEnabled = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      SwitchListTile(
        title: const Text("Ad-blocking"),
        subtitle: const Text("Remove intrusive ads for a cleaner experience"),
        value: settings.adBlockingEnabled,
        onChanged: (value) {
          setState(() {
            settings.adBlockingEnabled = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      const Divider(),
      const ListTile(title: Text("Performance"), enabled: false),
      SwitchListTile(
        title: const Text("Performance Mode"),
        subtitle: const Text("Optimize resource usage for speed"),
        value: settings.performanceModeEnabled,
        onChanged: (value) {
          setState(() {
            settings.performanceModeEnabled = value;
            browserModel.updateSettings(settings);
            browserModel.save();
          });
        },
      ),
      const Divider(),
      ListTile(
        leading: Container(
          height: 35,
          width: 35,
          margin: const EdgeInsets.only(top: 6.0, left: 6.0),
          child: const CircleAvatar(
            backgroundImage: AssetImage("assets/icon/icon.png"),
          ),
        ),
        title: const Text("Comet-AI Official Website"),
        subtitle: const Text("https://browser.ponsrischool.in"),
        trailing: const Icon(Icons.open_in_new, color: Color(0xFF00E5FF)),
        onTap: () {
          final windowModel = Provider.of<WindowModel>(context, listen: false);
          windowModel.addTab(
            WebViewTab(
              key: GlobalKey(),
              webViewModel: WebViewModel(
                url: WebUri("https://browser.ponsrischool.in"),
              ),
            ),
          );
        },
      ),
      ListTile(
        leading: Container(
          height: 35,
          width: 35,
          margin: const EdgeInsets.only(top: 6.0, left: 6.0),
          child: const Icon(
            Icons.code,
            size: 30,
            color: Colors.white,
          ),
        ),
        title: const Text("Comet-AI GitHub Repository"),
        subtitle: const Text("https://github.com/Preet3627/Comet-AI"),
        trailing: const Icon(Icons.open_in_new, color: Color(0xFF00E5FF)),
        onTap: () {
          final windowModel = Provider.of<WindowModel>(context, listen: false);
          windowModel.addTab(
            WebViewTab(
              key: GlobalKey(),
              webViewModel: WebViewModel(
                url: WebUri("https://github.com/Preet3627/Comet-AI"),
              ),
            ),
          );
        },
      ),
    ];

    if (Util.isAndroid()) {
      widgets.addAll(<Widget>[
        FutureBuilder(
          future: InAppWebViewController.getCurrentWebViewPackage(),
          builder: (context, snapshot) {
            String packageDescription = "";
            if (snapshot.hasData) {
              WebViewPackageInfo packageInfo =
                  snapshot.data as WebViewPackageInfo;
              packageDescription =
                  "${packageInfo.packageName ?? ""} - ${packageInfo.versionName ?? ""}";
            }
            return ListTile(
              title: const Text("WebView Package Info"),
              subtitle: Text(packageDescription),
              onLongPress: () {
                Clipboard.setData(ClipboardData(text: packageDescription));
              },
            );
          },
        ),
      ]);
    }

    return widgets;
  }

  List<Widget> _buildWebViewTabSettings() {
    var windowModel = Provider.of<WindowModel>(context, listen: true);
    var currentWebViewModel = Provider.of<WebViewModel>(context, listen: true);
    var webViewController = currentWebViewModel.webViewController;

    var widgets = <Widget>[
      const ListTile(title: Text("Current WebView Settings"), enabled: false),
      SwitchListTile(
        title: const Text("JavaScript Enabled"),
        subtitle: const Text(
          "Sets whether the WebView should enable JavaScript.",
        ),
        value: currentWebViewModel.settings?.javaScriptEnabled ?? true,
        onChanged: (value) async {
          currentWebViewModel.settings?.javaScriptEnabled = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Cache Enabled"),
        subtitle: const Text(
          "Sets whether the WebView should use browser caching.",
        ),
        value: currentWebViewModel.settings?.cacheEnabled ?? true,
        onChanged: (value) async {
          currentWebViewModel.settings?.cacheEnabled = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      StatefulBuilder(
        builder: (context, setState) {
          return ListTile(
            title: const Text("Custom User Agent"),
            subtitle: Text(
              currentWebViewModel.settings?.userAgent?.isNotEmpty ?? false
                  ? currentWebViewModel.settings!.userAgent!
                  : "Set a custom user agent ...",
            ),
            onTap: () {
              _customUserAgentController.text =
                  currentWebViewModel.settings?.userAgent ?? "";

              showDialog(
                context: context,
                builder: (context) {
                  return AlertDialog(
                    contentPadding: const EdgeInsets.all(0.0),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        ListTile(
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: <Widget>[
                              Expanded(
                                child: TextField(
                                  onSubmitted: (value) async {
                                    currentWebViewModel.settings?.userAgent =
                                        value;
                                    webViewController?.setSettings(
                                      settings: currentWebViewModel.settings ??
                                          InAppWebViewSettings(),
                                    );
                                    currentWebViewModel.settings =
                                        await webViewController?.getSettings();
                                    windowModel.saveInfo();
                                    setState(() {
                                      Navigator.pop(context);
                                    });
                                  },
                                  decoration: const InputDecoration(
                                    hintText: 'Custom User Agent',
                                  ),
                                  controller: _customUserAgentController,
                                  keyboardType: TextInputType.multiline,
                                  textInputAction: TextInputAction.go,
                                  maxLines: null,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          );
        },
      ),
      SwitchListTile(
        title: const Text("Support Zoom"),
        subtitle: const Text(
          "Sets whether the WebView should not support zooming using its on-screen zoom controls and gestures.",
        ),
        value: currentWebViewModel.settings?.supportZoom ?? true,
        onChanged: (value) async {
          currentWebViewModel.settings?.supportZoom = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Media Playback Requires User Gesture"),
        subtitle: const Text(
          "Sets whether the WebView should prevent HTML5 audio or video from autoplaying.",
        ),
        value: currentWebViewModel.settings?.mediaPlaybackRequiresUserGesture ??
            true,
        onChanged: (value) async {
          currentWebViewModel.settings?.mediaPlaybackRequiresUserGesture =
              value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Vertical ScrollBar Enabled"),
        subtitle: const Text(
          "Sets whether the vertical scrollbar should be drawn or not.",
        ),
        value: currentWebViewModel.settings?.verticalScrollBarEnabled ?? true,
        onChanged: (value) async {
          currentWebViewModel.settings?.verticalScrollBarEnabled = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Horizontal ScrollBar Enabled"),
        subtitle: const Text(
          "Sets whether the horizontal scrollbar should be drawn or not.",
        ),
        value: currentWebViewModel.settings?.horizontalScrollBarEnabled ?? true,
        onChanged: (value) async {
          currentWebViewModel.settings?.horizontalScrollBarEnabled = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Disable Vertical Scroll"),
        subtitle: const Text(
          "Sets whether vertical scroll should be enabled or not.",
        ),
        value: currentWebViewModel.settings?.disableVerticalScroll ?? false,
        onChanged: (value) async {
          currentWebViewModel.settings?.disableVerticalScroll = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Disable Horizontal Scroll"),
        subtitle: const Text(
          "Sets whether horizontal scroll should be enabled or not.",
        ),
        value: currentWebViewModel.settings?.disableHorizontalScroll ?? false,
        onChanged: (value) async {
          currentWebViewModel.settings?.disableHorizontalScroll = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Disable Context Menu"),
        subtitle: const Text(
          "Sets whether context menu should be enabled or not.",
        ),
        value: currentWebViewModel.settings?.disableContextMenu ?? false,
        onChanged: (value) async {
          currentWebViewModel.settings?.disableContextMenu = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      ListTile(
        title: const Text("Minimum Font Size"),
        subtitle: const Text("Sets the minimum font size."),
        trailing: SizedBox(
          width: 50.0,
          child: TextFormField(
            initialValue:
                currentWebViewModel.settings?.minimumFontSize.toString(),
            keyboardType: const TextInputType.numberWithOptions(),
            onFieldSubmitted: (value) async {
              currentWebViewModel.settings?.minimumFontSize = int.parse(value);
              webViewController?.setSettings(
                settings:
                    currentWebViewModel.settings ?? InAppWebViewSettings(),
              );
              currentWebViewModel.settings =
                  await webViewController?.getSettings();
              windowModel.saveInfo();
              setState(() {});
            },
          ),
        ),
      ),
      SwitchListTile(
        title: const Text("Allow File Access From File URLs"),
        subtitle: const Text(
          "Sets whether JavaScript running in the context of a file scheme URL should be allowed to access content from other file scheme URLs.",
        ),
        value:
            currentWebViewModel.settings?.allowFileAccessFromFileURLs ?? false,
        onChanged: (value) async {
          currentWebViewModel.settings?.allowFileAccessFromFileURLs = value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
      SwitchListTile(
        title: const Text("Allow Universal Access From File URLs"),
        subtitle: const Text(
          "Sets whether JavaScript running in the context of a file scheme URL should be allowed to access content from any origin.",
        ),
        value: currentWebViewModel.settings?.allowUniversalAccessFromFileURLs ??
            false,
        onChanged: (value) async {
          currentWebViewModel.settings?.allowUniversalAccessFromFileURLs =
              value;
          webViewController?.setSettings(
            settings: currentWebViewModel.settings ?? InAppWebViewSettings(),
          );
          currentWebViewModel.settings = await webViewController?.getSettings();
          windowModel.saveInfo();
          setState(() {});
        },
      ),
    ];

    return widgets;
  }

  void _showApiKeyDialog(
    BuildContext context,
    String provider,
    String currentKey,
    Function(String) onSave,
  ) {
    final controller = TextEditingController(text: currentKey);
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text("$provider API Key"),
          content: TextField(
            controller: controller,
            decoration: InputDecoration(
              hintText: "Enter $provider API key",
              border: const OutlineInputBorder(),
            ),
            obscureText: true,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () {
                onSave(controller.text);
                Navigator.pop(context);
              },
              child: const Text("Save"),
            ),
          ],
        );
      },
    );
  }

  void _showOllamaDialog(
    BuildContext context,
    BrowserSettings settings,
    Function(String, String) onSave,
  ) {
    final urlController = TextEditingController(text: settings.ollamaBaseUrl);
    final modelController = TextEditingController(text: settings.ollamaModel);
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Ollama Configuration"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: urlController,
                decoration: const InputDecoration(
                  labelText: "Base URL",
                  hintText: "http://localhost:11434",
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: modelController,
                decoration: const InputDecoration(
                  labelText: "Model Name",
                  hintText: "llama3.3",
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () {
                onSave(urlController.text, modelController.text);
                Navigator.pop(context);
              },
              child: const Text("Save"),
            ),
          ],
        );
      },
    );
  }

  void _showSyncDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("P2P Sync Setup"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SelectableText(
                "Local Device ID:\n${SyncService().deviceId ?? 'Loading...'}",
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _remoteDeviceIdController,
                decoration: const InputDecoration(
                  labelText: "Remote Device ID",
                  hintText: "Enter Electron App Device ID",
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () {
                if (_remoteDeviceIdController.text.isNotEmpty) {
                  SyncService().connect(_remoteDeviceIdController.text);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Sync connection initiated..."),
                    ),
                  );
                }
              },
              child: const Text("Connect"),
            ),
          ],
        );
      },
    );
  }

  void _showColorPickerDialog(
    BuildContext context,
    BrowserSettings settings,
    Function(Color) onSelected,
  ) {
    final colors = [
      Colors.black,
      const Color(0xFF1A1A1A),
      const Color(0xFF0D1117),
      const Color(0xFF121212),
      const Color(0xFF1E1E2E),
      const Color(0xFF000510),
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Choose Background Color"),
        content: Wrap(
          spacing: 10,
          children: colors.map((color) {
            return GestureDetector(
              onTap: () {
                onSelected(color);
                Navigator.pop(context);
              },
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
