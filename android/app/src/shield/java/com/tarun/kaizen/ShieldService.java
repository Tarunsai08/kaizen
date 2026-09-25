package com.tarun.kaizen;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Kaizen Shield (inspired by Regain & one sec):
 *  - leaves YouTube Shorts / Instagram Reels feeds as soon as they open
 *  - shows Kaizen's "pause" screen before chosen apps open
 *  - gentle toast when an app goes over its daily limit
 * It only looks at which app/screen is in front. Nothing is stored except simple counters.
 */
public class ShieldService extends AccessibilityService {

    private static final Map<String, String[]> SHORTS_IDS = new HashMap<>();
    static {
        SHORTS_IDS.put("com.google.android.youtube", new String[] {
            "com.google.android.youtube:id/reel_recycler",
            "com.google.android.youtube:id/reel_player_page_container",
            "com.google.android.youtube:id/reel_watch_player",
            "com.google.android.youtube:id/shorts_container",
        });
        SHORTS_IDS.put("com.instagram.android", new String[] {
            "com.instagram.android:id/clips_viewer_view_pager",
            "com.instagram.android:id/clips_viewer_container",
            "com.instagram.android:id/root_clips_layout",
            "com.instagram.android:id/clips_video_container",
        });
    }
    private static final Map<String, String> SHORTS_KEY = new HashMap<>();
    static {
        SHORTS_KEY.put("com.google.android.youtube", "youtube");
        SHORTS_KEY.put("com.instagram.android", "instagram");
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private String foreground = "";
    private long lastCheck = 0;
    private long lastBlock = 0;
    private long lastPause = 0;
    private String lastPausePkg = "";
    private long cfgLoadedAt = 0;
    private JSONObject cfg = new JSONObject();
    private final Set<String> pauseApps = new HashSet<>();
    private final Map<String, String> pauseLabels = new HashMap<>();

    private SharedPreferences prefs() {
        return getSharedPreferences(KaizenPlugin.SHIELD_PREFS, Context.MODE_PRIVATE);
    }

    private void loadConfig() {
        long now = System.currentTimeMillis();
        if (now - cfgLoadedAt < 3000) return;
        cfgLoadedAt = now;
        try {
            cfg = new JSONObject(prefs().getString("config", "{}"));
            pauseApps.clear();
            pauseLabels.clear();
            JSONArray arr = cfg.optJSONArray("pauseApps");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject a = arr.optJSONObject(i);
                    if (a == null) continue;
                    pauseApps.add(a.optString("pkg"));
                    pauseLabels.put(a.optString("pkg"), a.optString("label"));
                }
            }
        } catch (Exception e) {
            cfg = new JSONObject();
        }
    }

    private boolean shortsEnabled(String pkg) {
        String key = SHORTS_KEY.get(pkg);
        if (key == null) return false;
        JSONObject shorts = cfg.optJSONObject("shorts");
        return shorts != null && shorts.optBoolean(key, false);
    }

    private static boolean ignorable(String pkg) {
        return pkg.startsWith("com.android.systemui") || pkg.contains("inputmethod") || pkg.contains("keyboard")
            || pkg.equals("android");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (ignorable(pkg)) return;
        loadConfig();
        int type = event.getEventType();

        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && !pkg.equals(foreground)) {
            String prev = foreground;
            foreground = pkg;
            if (!pkg.equals(getPackageName())) onAppEntered(pkg, prev);
        }

        if (shortsEnabled(pkg) && pkg.equals(foreground)) {
            long now = System.currentTimeMillis();
            if (now - lastCheck < 400) return;
            lastCheck = now;
            if (now - lastBlock < 1500) return;
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;
            try {
                if (hasShorts(root, SHORTS_IDS.get(pkg))) {
                    lastBlock = now;
                    performGlobalAction(GLOBAL_ACTION_BACK);
                    KaizenPlugin.logShieldEvent(this, "blocked", pkg);
                    main.post(() -> Toast.makeText(this, "Kaizen Shield: short videos are blocked", Toast.LENGTH_SHORT).show());
                }
            } finally {
                root.recycle();
            }
        }
    }

    private boolean hasShorts(AccessibilityNodeInfo root, String[] ids) {
        if (ids == null) return false;
        for (String id : ids) {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(id);
            if (nodes != null && !nodes.isEmpty()) {
                boolean visible = false;
                for (AccessibilityNodeInfo n : nodes) {
                    if (n.isVisibleToUser()) visible = true;
                    n.recycle();
                }
                if (visible) return true;
            }
        }
        return false;
    }

    private void onAppEntered(String pkg, String prev) {
        long now = System.currentTimeMillis();
        // Pause before opening
        if (pauseApps.contains(pkg)) {
            long allowUntil = prefs().getLong("allow_" + pkg, 0);
            boolean recentlyPaused = pkg.equals(lastPausePkg) && now - lastPause < 4000;
            if (now > allowUntil && !recentlyPaused && !getPackageName().equals(prev)) {
                lastPause = now;
                lastPausePkg = pkg;
                KaizenPlugin.logShieldEvent(this, "paused", pkg);
                String label = pauseLabels.containsKey(pkg) ? pauseLabels.get(pkg) : pkg;
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("kaizen://pause?pkg=" + Uri.encode(pkg) + "&label=" + Uri.encode(label)));
                i.setClassName(getPackageName(), getPackageName() + ".MainActivity");
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(i);
                return;
            }
        }
        // Daily limit reminder
        JSONObject limits = cfg.optJSONObject("limits");
        if (limits != null && limits.has(pkg)) {
            int limit = limits.optInt(pkg, 0);
            if (limit > 0) {
                try {
                    java.util.Calendar c = java.util.Calendar.getInstance();
                    c.set(java.util.Calendar.HOUR_OF_DAY, 0);
                    c.set(java.util.Calendar.MINUTE, 0);
                    c.set(java.util.Calendar.SECOND, 0);
                    org.json.JSONArray apps = KaizenPlugin.usageBetween(this, c.getTimeInMillis(), now, "").getJSONArray("apps");
                    for (int k = 0; k < apps.length(); k++) {
                        JSONObject a = apps.getJSONObject(k);
                        if (pkg.equals(a.optString("pkg"))) {
                            long mins = a.optLong("ms") / 60000;
                            if (mins >= limit) {
                                final String msg = "You’ve used " + a.optString("label") + " for " + mins + " min today (limit " + limit + ")";
                                main.post(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }
    }

    @Override
    public void onInterrupt() {
    }
}
