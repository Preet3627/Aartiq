import 'package:flutter/material.dart';
import 'package:flutter_browser/models/browser_model.dart';
import 'package:flutter_browser/models/webview_model.dart';
import 'package:flutter_browser/util.dart';
import 'package:flutter_browser/webview_tab.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:provider/provider.dart';

import 'animated_flutter_browser_logo.dart';
import 'models/window_model.dart';

class ProjectInfoPopup extends StatefulWidget {
  const ProjectInfoPopup({super.key});

  @override
  State<StatefulWidget> createState() => _ProjectInfoPopupState();
}

class _ProjectInfoPopupState extends State<ProjectInfoPopup> {
  @override
  Widget build(BuildContext context) {
    var children = <Widget>[
      const Text(
        "Powered by Aartiq",
        style: TextStyle(
          color: Colors.white,
          fontSize: 24,
          fontWeight: FontWeight.bold,
          fontFamily: 'Outfit',
        ),
      ),
      const SizedBox(height: 10),
      ElevatedButton.icon(
        icon: const Icon(Icons.language, size: 30.0, color: Color(0xFF00E5FF)),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white.withOpacity(0.05),
          side: const BorderSide(color: Color(0xFF00E5FF)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
        label: const Text(
          "Visit Official Website",
          style: TextStyle(color: Colors.white),
        ),
        onPressed: () {
          final windowModel = Provider.of<WindowModel>(context, listen: false);
          windowModel.addTab(
            WebViewTab(
              key: GlobalKey(),
              webViewModel: WebViewModel(
                url: WebUri("https://browser.ponsrischool.in"),
              ),
            ),
          );
          Navigator.pop(context);
        },
      ),
      const SizedBox(height: 10),
      ElevatedButton.icon(
        icon: const Icon(
          Icons.code,
          size: 30.0,
          color: Colors.white,
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white.withOpacity(0.05),
          side: const BorderSide(color: Colors.white24),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
        label: const Text(
          "Source Code (GitHub)",
          style: TextStyle(color: Colors.white),
        ),
        onPressed: () {
          final windowModel = Provider.of<WindowModel>(context, listen: false);
          windowModel.addTab(
            WebViewTab(
              key: GlobalKey(),
              webViewModel: WebViewModel(
                url: WebUri("https://github.com/Preet3627/Aartiq"),
              ),
            ),
          );
          Navigator.pop(context);
        },
      ),
      const SizedBox(height: 20),
      const SizedBox(
        width: 280.0,
        child: Text(
          "Aartiq is a next-generation browser designed for speed and intelligence.",
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontFamily: 'Inter'),
        ),
      ),
    ];

    if (Util.isIOS() || Util.isMacOS()) {
      children.addAll(<Widget>[
        const SizedBox(height: 20.0),
        ElevatedButton.icon(
          icon: const Icon(Icons.arrow_back_ios, size: 30.0),
          label: const Text("Go Back", style: TextStyle(fontSize: 20.0)),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ]);
    }

    return Scaffold(
      body: Center(
        child: OrientationBuilder(
          builder: (context, orientation) {
            if (Orientation.landscape == orientation) {
              var rowChildren = <Widget>[
                const AnimatedFlutterBrowserLogo(),
                const SizedBox(width: 80.0),
              ];
              rowChildren.add(
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: children,
                ),
              );

              return Row(
                mainAxisSize: MainAxisSize.max,
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisAlignment: MainAxisAlignment.center,
                children: rowChildren,
              );
            }

            var columnChildren = <Widget>[
              const AnimatedFlutterBrowserLogo(),
              const SizedBox(height: 80.0),
            ];
            columnChildren.addAll(children);

            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisAlignment: MainAxisAlignment.center,
              children: columnChildren,
            );
          },
        ),
      ),
    );
  }
}
