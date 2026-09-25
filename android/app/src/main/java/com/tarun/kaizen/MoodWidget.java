package com.tarun.kaizen;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Home-screen widget: one-tap mood logging. */
public class MoodWidget extends AppWidgetProvider {
    private static final int[] FACES = { R.id.w_m1, R.id.w_m2, R.id.w_m3, R.id.w_m4, R.id.w_m5 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_mood);
            for (int i = 0; i < FACES.length; i++) {
                v.setOnClickPendingIntent(FACES[i], WidgetUtil.open(ctx, "mood/" + (i + 1), 20 + i));
            }
            v.setOnClickPendingIntent(R.id.w_mood_title, WidgetUtil.open(ctx, "checkin", 30));
            mgr.updateAppWidget(id, v);
        }
    }
}
