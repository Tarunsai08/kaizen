package com.tarun.kaizen;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

final class WidgetUtil {
    private WidgetUtil() {}

    /** PendingIntent that opens Kaizen with a kaizen:// action (handled in JS). */
    static PendingIntent open(Context ctx, String action, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("kaizen://" + action));
        i.setClassName(ctx.getPackageName(), ctx.getPackageName() + ".MainActivity");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
