package com.tarun.kaizen;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Kaizen native bridge:
 *  - text shared into the app (bank SMS, links) and launch actions (widgets, shortcuts, Shield)
 *  - screen time via UsageStatsManager
 *  - Shield (Accessibility) config + events
 *  - home-screen widget data
 */
@CapacitorPlugin(name = "Kaizen")
public class KaizenPlugin extends Plugin {

    static volatile String sharedText = null;
    static volatile String sharedSubject = null;
    static volatile String launchAction = null;

    public static final String SHIELD_PREFS = "kaizen_shield";
    public static final String WIDGET_PREFS = "kaizen_widget";

    /* ---------------- shared text / launch actions ---------------- */

    @PluginMethod
    public void getSharedText(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", sharedText);
        ret.put("subject", sharedSubject);
        sharedText = null;
        sharedSubject = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void getLaunchAction(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("action", launchAction);
        launchAction = null;
        call.resolve(ret);
    }

    /* ---------------- screen time ---------------- */

    private boolean usageGranted() {
        Context ctx = getContext();
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        } else {
            mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void hasUsageAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", usageGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void openUsageAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    private String homePackage() {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        ResolveInfo ri = getContext().getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        return ri != null && ri.activityInfo != null ? ri.activityInfo.packageName : "";
    }

    static String labelFor(PackageManager pm, String pkg) {
        try {
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    @PluginMethod
    public void getUsage(PluginCall call) {
        if (!usageGranted()) {
            call.reject("Usage access not granted");
            return;
        }
        long from = call.getData().optLong("from", System.currentTimeMillis() - 86400000L);
        long to = call.getData().optLong("to", System.currentTimeMillis());
        call.resolve(usageBetween(getContext(), from, to, homePackage()));
    }

    static JSObject usageBetween(Context ctx, long from, long to, String home) {
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = usm.queryEvents(from, to);
        Map<String, Long> total = new HashMap<>();
        Map<String, Integer> launches = new HashMap<>();
        String fg = null;
        long fgStart = 0;
        String lastPkg = null;
        int unlocks = 0;
        UsageEvents.Event e = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            int type = e.getEventType();
            String pkg = e.getPackageName();
            long ts = e.getTimeStamp();
            if (type == 18) { // KEYGUARD_HIDDEN (API 28+) = phone unlocked
                unlocks++;
                continue;
            }
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (fg != null && !fg.equals(pkg)) {
                    total.put(fg, (total.containsKey(fg) ? total.get(fg) : 0L) + Math.max(0, ts - fgStart));
                }
                if (fg == null || !fg.equals(pkg)) {
                    fgStart = ts;
                    if (lastPkg == null || !lastPkg.equals(pkg)) {
                        launches.put(pkg, (launches.containsKey(pkg) ? launches.get(pkg) : 0) + 1);
                    }
                }
                fg = pkg;
                lastPkg = pkg;
            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED || type == 23 /* ACTIVITY_STOPPED */) {
                if (fg != null && fg.equals(pkg)) {
                    total.put(fg, (total.containsKey(fg) ? total.get(fg) : 0L) + Math.max(0, ts - fgStart));
                    fg = null;
                }
            } else if (type == 16 /* SCREEN_NON_INTERACTIVE */) {
                if (fg != null) {
                    total.put(fg, (total.containsKey(fg) ? total.get(fg) : 0L) + Math.max(0, ts - fgStart));
                    fg = null;
                }
                lastPkg = null;
            }
        }
        if (fg != null) {
            total.put(fg, (total.containsKey(fg) ? total.get(fg) : 0L) + Math.max(0, to - fgStart));
        }
        PackageManager pm = ctx.getPackageManager();
        JSArray apps = new JSArray();
        for (Map.Entry<String, Long> en : total.entrySet()) {
            String pkg = en.getKey();
            if (pkg.equals(home) || pkg.startsWith("com.android.systemui")) continue;
            JSObject o = new JSObject();
            o.put("pkg", pkg);
            o.put("label", labelFor(pm, pkg));
            o.put("ms", (long) en.getValue());
            o.put("launches", launches.containsKey(pkg) ? launches.get(pkg) : 0);
            apps.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        ret.put("unlocks", unlocks);
        return ret;
    }

    @PluginMethod
    public void getAppIcon(PluginCall call) {
        String pkg = call.getString("pkg");
        JSObject ret = new JSObject();
        try {
            Drawable d = getContext().getPackageManager().getApplicationIcon(pkg);
            int size = 96;
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(c);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            ret.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        } catch (Exception e) {
            ret.put("data", (String) null);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN);
        main.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> list = pm.queryIntentActivities(main, 0);
        Set<String> seen = new HashSet<>();
        JSArray apps = new JSArray();
        for (ResolveInfo ri : list) {
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(getContext().getPackageName()) || !seen.add(pkg)) continue;
            JSObject o = new JSObject();
            o.put("pkg", pkg);
            o.put("label", ri.loadLabel(pm).toString());
            apps.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    /* ---------------- Shield ---------------- */

    static boolean shieldEnabled(Context ctx) {
        String enabled = Settings.Secure.getString(ctx.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        String me = ctx.getPackageName() + "/";
        for (String s : enabled.split(":")) {
            if (s.startsWith(me) && s.endsWith("ShieldService")) return true;
        }
        return false;
    }

    @PluginMethod
    public void shieldStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", "shield".equals(BuildConfig.FLAVOR));
        ret.put("enabled", shieldEnabled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessibility(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void setShieldConfig(PluginCall call) {
        String cfg = call.getString("config", "{}");
        getContext().getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE).edit().putString("config", cfg).apply();
        call.resolve();
    }

    @PluginMethod
    public void getShieldEvents(PluginCall call) {
        SharedPreferences sp = getContext().getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE);
        JSArray arr;
        synchronized (KaizenPlugin.class) {
            String raw = sp.getString("events", "[]");
            try {
                arr = new JSArray(raw);
            } catch (Exception e) {
                arr = new JSArray();
            }
            sp.edit().putString("events", "[]").apply();
        }
        JSObject ret = new JSObject();
        ret.put("events", arr);
        call.resolve(ret);
    }

    static void logShieldEvent(Context ctx, String type, String pkg) {
        synchronized (KaizenPlugin.class) {
            SharedPreferences sp = ctx.getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE);
            try {
                JSONArray arr = new JSONArray(sp.getString("events", "[]"));
                JSObject o = new JSObject();
                o.put("type", type);
                o.put("pkg", pkg);
                o.put("ts", System.currentTimeMillis());
                arr.put(o);
                // keep the buffer small if the app isn't opened for a while
                while (arr.length() > 500) arr.remove(0);
                sp.edit().putString("events", arr.toString()).apply();
            } catch (Exception ignored) {
            }
        }
    }

    @PluginMethod
    public void allowApp(PluginCall call) {
        String pkg = call.getString("pkg");
        int minutes = call.getInt("minutes", 10);
        Context ctx = getContext();
        ctx.getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE).edit()
            .putLong("allow_" + pkg, System.currentTimeMillis() + minutes * 60000L).apply();
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(launch);
        }
        call.resolve();
    }

    /** Open an app chosen in the Boredom kit (optionally a deep link inside it) and let it skip the Shield pause for a while. */
    @PluginMethod
    public void launchApp(PluginCall call) {
        String pkg = call.getString("pkg", "");
        String url = call.getString("url", "");
        int minutes = call.getInt("minutes", 30);
        Context ctx = getContext();
        if (pkg.length() > 0) {
            ctx.getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE).edit()
                .putLong("allow_" + pkg, System.currentTimeMillis() + minutes * 60000L).apply();
        }
        Intent intent = null;
        if (url.length() > 0) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            if (pkg.length() > 0) intent.setPackage(pkg);
            if (intent.resolveActivity(ctx.getPackageManager()) == null) {
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            }
        } else if (pkg.length() > 0) {
            intent = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        }
        if (intent == null) {
            call.reject("App not found");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open: " + e.getMessage());
        }
    }

    @PluginMethod
    public void goHome(PluginCall call) {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(home);
        call.resolve();
    }

    /* ---------------- widgets ---------------- */

    @PluginMethod
    public void updateWidgets(PluginCall call) {
        String json = call.getString("json", "{}");
        Context ctx = getContext();
        ctx.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply();
        refreshWidgets(ctx);
        call.resolve();
    }

    static void refreshWidgets(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] day = mgr.getAppWidgetIds(new ComponentName(ctx, DayWidget.class));
        if (day.length > 0) DayWidget.updateAll(ctx, mgr, day);
    }
}
