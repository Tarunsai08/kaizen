package com.tarun.kaizen;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Kaizen Shield (inspired by Regain & one sec):
 *  - leaves YouTube Shorts / Instagram Reels (in the apps AND in web browsers)
 *  - optional: blocks whole websites
 *  - shows Kaizen's pause screen before chosen apps open
 *  - gentle toast when an app goes over its daily limit
 * Detection logic lives in ShortsDetector (unit-tested). Nothing leaves the phone.
 */
public class ShieldService extends AccessibilityService {

    private static final int MAX_NODES = 600;
    private static final int MAX_DEPTH = 40;

    private final Handler main = new Handler(Looper.getMainLooper());
    private String foreground = "";
    private long lastPause = 0;
    private String lastPausePkg = "";
    private long cfgLoadedAt = 0;
    private JSONObject cfg = new JSONObject();
    private final ShortsDetector.Config det = new ShortsDetector.Config();
    private final Set<String> pauseApps = new HashSet<>();
    private final Map<String, String> pauseLabels = new HashMap<>();
    private boolean diagnostics = false;

    // debounced checking: always check the LATEST screen, never drop the last event
    private boolean checkScheduled = false;
    private String pendingPkg = "";
    private long lastAction = 0;
    private int actionsInWindow = 0;
    private long lastDmSeen = 0;
    private long lastDiag = 0;

    private SharedPreferences prefs() {
        return getSharedPreferences(KaizenPlugin.SHIELD_PREFS, Context.MODE_PRIVATE);
    }

    private void loadConfig() {
        long now = System.currentTimeMillis();
        if (now - cfgLoadedAt < 2000) return;
        cfgLoadedAt = now;
        try {
            cfg = new JSONObject(prefs().getString("config", "{}"));
        } catch (Exception e) {
            cfg = new JSONObject();
        }
        JSONObject shorts = cfg.optJSONObject("shorts");
        boolean paused = cfg.optLong("pausedUntil", 0) > now;
        det.youtube = !paused && shorts != null && shorts.optBoolean("youtube", false);
        det.instagram = !paused && shorts != null && shorts.optBoolean("instagram", false);
        det.browsers = !paused && cfg.optBoolean("browsers", true) && (det.youtube || det.instagram || cfg.optJSONArray("blockedSites") != null);
        det.allowDmReels = cfg.optBoolean("allowDmReels", false);
        det.blockedSites.clear();
        JSONArray sites = cfg.optJSONArray("blockedSites");
        if (sites != null && !paused) for (int i = 0; i < sites.length(); i++) det.blockedSites.add(sites.optString(i));
        diagnostics = cfg.optBoolean("diagnostics", false);
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
    }

    private static boolean ignorable(String pkg) {
        return pkg.startsWith("com.android.systemui") || pkg.contains("inputmethod") || pkg.contains("keyboard") || pkg.equals("android");
    }

    private boolean watched(String pkg) {
        return ShortsDetector.YT.equals(pkg) || ShortsDetector.IG.equals(pkg) || ShortsDetector.isBrowser(pkg);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (ignorable(pkg)) return;
        loadConfig();
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && !pkg.equals(foreground)) {
            String prev = foreground;
            foreground = pkg;
            if (!pkg.equals(getPackageName())) onAppEntered(pkg, prev);
        }
        if (watched(pkg)) scheduleCheck(pkg);
    }

    private void scheduleCheck(String pkg) {
        pendingPkg = pkg;
        if (checkScheduled) return;
        checkScheduled = true;
        main.postDelayed(() -> {
            checkScheduled = false;
            try {
                runCheck(pendingPkg);
            } catch (Exception ignored) {
            }
        }, 220);
    }

    private ShortsDetector.Snapshot snapshot(AccessibilityNodeInfo root) {
        ShortsDetector.Snapshot s = new ShortsDetector.Snapshot();
        s.pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
        DisplayMetrics dm = getResources().getDisplayMetrics();
        s.screenW = dm.widthPixels;
        s.screenH = dm.heightPixels;
        ArrayDeque<Object[]> q = new ArrayDeque<>();
        q.add(new Object[] { root, 0 });
        Rect r = new Rect();
        int count = 0;
        while (!q.isEmpty() && count < MAX_NODES) {
            Object[] item = q.poll();
            AccessibilityNodeInfo n = (AccessibilityNodeInfo) item[0];
            int depth = (Integer) item[1];
            if (n == null) continue;
            count++;
            ShortsDetector.Node x = new ShortsDetector.Node();
            x.id = n.getViewIdResourceName() == null ? "" : n.getViewIdResourceName();
            x.cls = n.getClassName() == null ? "" : n.getClassName().toString();
            CharSequence t = n.getText();
            CharSequence d = n.getContentDescription();
            x.text = t == null ? "" : t.toString();
            x.desc = d == null ? "" : d.toString();
            x.selected = n.isSelected();
            x.visible = n.isVisibleToUser();
            x.editable = n.isEditable();
            n.getBoundsInScreen(r);
            x.l = r.left; x.t = r.top; x.r = r.right; x.b = r.bottom;
            s.nodes.add(x);
            if (depth < MAX_DEPTH) {
                for (int i = 0; i < n.getChildCount(); i++) {
                    AccessibilityNodeInfo c = n.getChild(i);
                    if (c != null) q.add(new Object[] { c, depth + 1 });
                }
            }
        }
        return s;
    }

    private void runCheck(String pkg) {
        if (!det.youtube && !det.instagram && det.blockedSites.isEmpty() && !diagnostics) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        ShortsDetector.Snapshot s = snapshot(root);
        if (!pkg.equals(s.pkg)) return; // the event came from a window that isn't in front
        long now = System.currentTimeMillis();
        if (ShortsDetector.looksLikeDms(s)) lastDmSeen = now;
        String reason = ShortsDetector.detectApp(s, det, now - lastDmSeen < 15000);
        if (reason == null) reason = ShortsDetector.detectBrowser(s, det);
        if (diagnostics) recordDiagnostics(s, reason);
        if (reason != null) block(s.pkg, reason);
    }

    private void block(String pkg, String reason) {
        long now = System.currentTimeMillis();
        if (now - lastAction < 700) return;
        // escalate if "back" isn't getting us out (e.g. Shorts opened from a notification)
        actionsInWindow = now - lastAction < 4000 ? actionsInWindow + 1 : 1;
        lastAction = now;
        if (actionsInWindow >= 3) {
            performGlobalAction(GLOBAL_ACTION_HOME);
            actionsInWindow = 0;
        } else {
            performGlobalAction(GLOBAL_ACTION_BACK);
        }
        if (actionsInWindow <= 1) {
            KaizenPlugin.logShieldEvent(this, "blocked", pkg);
            final String msg = reason.startsWith("site:") ? "Kaizen Shield: this site is blocked" : "Kaizen Shield: short videos are blocked";
            main.post(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
        }
    }

    /** Stores only view ids / selected tab labels / url (no content) so detection can be tuned. */
    private void recordDiagnostics(ShortsDetector.Snapshot s, String reason) {
        long now = System.currentTimeMillis();
        if (now - lastDiag < 1500 && reason == null) return;
        lastDiag = now;
        try {
            Set<String> ids = new LinkedHashSet<>();
            JSONArray big = new JSONArray();
            JSONArray sel = new JSONArray();
            long screen = s.screenArea();
            for (ShortsDetector.Node n : s.nodes) {
                if (!n.visible) continue;
                String id = n.shortId();
                if (!id.isEmpty()) ids.add(id);
                if (!id.isEmpty() && n.area() >= screen * 45 / 100) big.put(id);
                if (n.selected) sel.put((n.desc + " " + n.text).trim());
            }
            JSONObject o = new JSONObject();
            o.put("ts", now);
            o.put("pkg", s.pkg);
            o.put("result", reason == null ? "" : reason);
            o.put("url", ShortsDetector.isBrowser(s.pkg) ? ShortsDetector.browserUrl(s) : "");
            o.put("big", big);
            o.put("selected", sel);
            JSONArray idArr = new JSONArray();
            int k = 0;
            for (String id : ids) { if (k++ >= 80) break; idArr.put(id); }
            o.put("ids", idArr);
            SharedPreferences sp = prefs();
            JSONArray all = new JSONArray(sp.getString("diag", "[]"));
            all.put(o);
            while (all.length() > 40) all.remove(0);
            sp.edit().putString("diag", all.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private void onAppEntered(String pkg, String prev) {
        long now = System.currentTimeMillis();
        boolean paused = cfg.optLong("pausedUntil", 0) > now;
        if (!paused && pauseApps.contains(pkg)) {
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
        JSONObject limits = cfg.optJSONObject("limits");
        if (limits != null && limits.has(pkg)) {
            int limit = limits.optInt(pkg, 0);
            if (limit > 0) {
                try {
                    java.util.Calendar c = java.util.Calendar.getInstance();
                    c.set(java.util.Calendar.HOUR_OF_DAY, 0);
                    c.set(java.util.Calendar.MINUTE, 0);
                    c.set(java.util.Calendar.SECOND, 0);
                    JSONArray apps = KaizenPlugin.usageBetween(this, c.getTimeInMillis(), now, "").getJSONArray("apps");
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
