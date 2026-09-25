package com.tarun.kaizen;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Home-screen widget: I'm bored · Breathe · Focus · Urge. */
public class ActionsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_actions);
            v.setOnClickPendingIntent(R.id.w_a_bored, WidgetUtil.open(ctx, "bored", 40));
            v.setOnClickPendingIntent(R.id.w_a_breathe, WidgetUtil.open(ctx, "breathe", 41));
            v.setOnClickPendingIntent(R.id.w_a_focus, WidgetUtil.open(ctx, "focus", 42));
            v.setOnClickPendingIntent(R.id.w_a_urge, WidgetUtil.open(ctx, "urge", 43));
            mgr.updateAppWidget(id, v);
        }
    }
}
