package com.aartiq

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetProvider

class SearchWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: android.content.SharedPreferences
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.search_widget).apply {

                // ── Search bar tap → open app & focus search field ──────────────
                val searchIntent = Intent(context, MainActivity::class.java).apply {
                    action  = "com.aartiq.ACTION_SEARCH"
                    data    = Uri.parse("aartiq://search")
                    flags   = Intent.FLAG_ACTIVITY_NEW_TASK or
                              Intent.FLAG_ACTIVITY_SINGLE_TOP or
                              Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val searchPi = PendingIntent.getActivity(
                    context, 0, searchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_container, searchPi)

                // ── Mic tap → open with voice action ────────────────────────────
                val micIntent = Intent(context, MainActivity::class.java).apply {
                    action  = "com.aartiq.ACTION_VOICE"
                    data    = Uri.parse("aartiq://voice")
                    flags   = Intent.FLAG_ACTIVITY_NEW_TASK or
                              Intent.FLAG_ACTIVITY_SINGLE_TOP or
                              Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val micPi = PendingIntent.getActivity(
                    context, 1, micIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_mic_icon, micPi)

                // ── AI sparkle tap → open AI chat directly ───────────────────────
                val aiIntent = Intent(context, MainActivity::class.java).apply {
                    action  = "com.aartiq.ACTION_AI"
                    data    = Uri.parse("aartiq://ai")
                    flags   = Intent.FLAG_ACTIVITY_NEW_TASK or
                              Intent.FLAG_ACTIVITY_SINGLE_TOP or
                              Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val aiPi = PendingIntent.getActivity(
                    context, 2, aiIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_ai_icon, aiPi)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
