package com.tarun.kaizen;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Home-screen widget: day score, habits done, tasks left, companion level. */
public class DayWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        updateAll(ctx, mgr, ids);
    }

    static void updateAll(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject d;
        try {
            d = new JSONObject(ctx.getSharedPreferences(KaizenPlugin.WIDGET_PREFS, Context.MODE_PRIVATE).getString("data", "{}"));
        } catch (Exception e) {
            d = new JSONObject();
        }
        int score = d.optInt("score", 0);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_day);
            v.setTextViewText(R.id.w_score, String.valueOf(score));
            v.setProgressBar(R.id.w_progress, 100, Math.max(0, Math.min(100, score)), false);
            v.setTextViewText(R.id.w_habits, "Habits " + d.optInt("habitsDone", 0) + "/" + d.optInt("habitsDue", 0) + "  ·  " + d.optInt("tasksLeft", 0) + " tasks left");
            v.setTextViewText(R.id.w_level, d.optString("name", "Kai") + " · Lv " + d.optInt("level", 1) + " " + d.optString("stage", ""));
            v.setOnClickPendingIntent(R.id.w_root, WidgetUtil.open(ctx, "today", 10));
            mgr.updateAppWidget(id, v);
        }
    }
}
