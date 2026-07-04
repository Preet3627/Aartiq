package com.aartiq

import android.app.SearchManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.speech.RecognizerResultsIntent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugins.GeneratedPluginRegistrant

class MainActivity : FlutterActivity() {

    private val CHANNEL = "com.aartiq.intent_data"

    // Stores parsed intent data — consumed once by Flutter then cleared
    private var pendingIntent: MutableMap<String, String?> = mutableMapOf()

    companion object {
        // Must match the action strings in SearchWidget.kt
        const val ACTION_SEARCH = "com.aartiq.ACTION_SEARCH"
        const val ACTION_VOICE  = "com.aartiq.ACTION_VOICE"
        const val ACTION_AI     = "com.aartiq.ACTION_AI"
        const val EXTRA_QUERY   = "query"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        parseIntent(intent)
    }

    // Handles widget tap when the app is already in the foreground/background
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        parseIntent(intent)
    }

    private fun parseIntent(intent: Intent) {
        pendingIntent.clear()
        val action = intent.action ?: return
        if (RecognizerResultsIntent.ACTION_VOICE_SEARCH_RESULTS == action) return

        when (action) {
            // ── Standard browser / OS search intents ────────────────────────────
            Intent.ACTION_VIEW -> {
                pendingIntent["action"] = "view"
                pendingIntent["url"]    = intent.data?.toString()
            }
            Intent.ACTION_SEARCH,
            MediaStore.INTENT_ACTION_MEDIA_SEARCH,
            Intent.ACTION_WEB_SEARCH -> {
                pendingIntent["action"] = "search"
                pendingIntent["query"]  = intent.getStringExtra(SearchManager.QUERY) ?: ""
            }

            // ── Widget: search bar tapped → navigate to home + focus search ─────
            ACTION_SEARCH -> {
                pendingIntent["action"] = "search"
                pendingIntent["query"]  = intent.getStringExtra(EXTRA_QUERY) ?: ""
            }

            // ── Widget: mic icon tapped → trigger voice input ────────────────────
            ACTION_VOICE -> {
                pendingIntent["action"] = "voice"
                pendingIntent["query"]  = intent.getStringExtra(EXTRA_QUERY) ?: ""
            }

            // ── Widget: AI sparkle tapped → open AI chat screen ──────────────────
            ACTION_AI -> {
                pendingIntent["action"] = "ai"
                pendingIntent["query"]  = intent.getStringExtra(EXTRA_QUERY) ?: ""
            }

            else -> {
                pendingIntent["action"] = action
            }
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        GeneratedPluginRegistrant.registerWith(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call: MethodCall, result: MethodChannel.Result ->
                when (call.method) {
                    "getIntentData" -> {
                        // Return a snapshot then clear so Flutter consumes it exactly once
                        result.success(HashMap<String, String?>(pendingIntent))
                        pendingIntent.clear()
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
