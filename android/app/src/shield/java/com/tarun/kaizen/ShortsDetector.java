package com.tarun.kaizen;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Pure (Android-free) detection logic so it can be unit-tested.
 * A Snapshot is a bounded walk of the accessibility tree reduced to what we need.
 *
 * Several independent signals are used so one renamed view id can't break blocking:
 *  1. strong view ids that only exist on the Shorts/Reels player
 *  2. generic ids containing reel/shorts/clips that cover most of the screen
 *  3. the Shorts / Reels bottom tab being the selected tab
 *  4. browser address bar showing a Shorts/Reels URL (or a blocked site)
 */
public final class ShortsDetector {
    private ShortsDetector() {}

    public static final String YT = "com.google.android.youtube";
    public static final String IG = "com.instagram.android";

    public static final class Node {
        public String id = "";      // resource name, e.g. com.google.android.youtube:id/reel_recycler
        public String cls = "";
        public String text = "";
        public String desc = "";
        public boolean selected;
        public boolean visible = true;
        public boolean editable;
        public int l, t, r, b;

        public Node() {}
        public Node(String id, int l, int t, int r, int b) { this.id = id; this.l = l; this.t = t; this.r = r; this.b = b; }
        public String shortId() { int i = id.indexOf(":id/"); return i >= 0 ? id.substring(i + 4) : id; }
        public long area() { return (long) Math.max(0, r - l) * Math.max(0, b - t); }
    }

    public static final class Snapshot {
        public String pkg = "";
        public int screenW = 1080, screenH = 2400;
        public List<Node> nodes = new ArrayList<>();
        public long screenArea() { return (long) screenW * screenH; }
    }

    public static final class Config {
        public boolean youtube = true, instagram = true, browsers = true;
        public boolean allowDmReels = false;
        public List<String> blockedSites = new ArrayList<>();
    }

    /* ---------------- in-app ---------------- */

    private static final String[] YT_STRONG = {
        "reel_recycler", "reel_player_page_container", "reel_watch_player", "reel_progress_bar",
        "reel_time_bar", "reel_player_overlay_container", "reel_watch_fragment_root", "shorts_player",
        "reel_player_underlay", "reel_dyn_remix", "reel_like_button", "reel_dislike_button", "reel_comment_button",
    };
    private static final String[] IG_STRONG = {
        "clips_viewer_view_pager", "clips_viewer_container", "clips_swipe_refresh_container",
        "root_clips_layout", "clips_video_container", "clips_ufi_component", "clips_media_component",
    };

    /** @return a short reason string when the snapshot shows a Shorts/Reels feed, else null. */
    public static String detectApp(Snapshot s, Config c, boolean recentlyInDms) {
        if (YT.equals(s.pkg) && c.youtube) return detect(s, YT_STRONG, new String[] { "reel", "shorts" }, "shorts");
        if (IG.equals(s.pkg) && c.instagram) {
            if (c.allowDmReels && recentlyInDms) return null;
            return detect(s, IG_STRONG, new String[] { "clips_" }, "reels"); // never "reel": Instagram uses it for Stories
        }
        return null;
    }

    private static String detect(Snapshot s, String[] strong, String[] generic, String tabLabel) {
        long screen = s.screenArea();
        for (Node n : s.nodes) {
            if (!n.visible) continue;
            String id = n.shortId().toLowerCase(Locale.ROOT);
            if (id.isEmpty()) continue;
            for (String k : strong) {
                // strong ids must still be a real, sizeable view (not a 1px leftover)
                if (id.equals(k) && n.area() >= screen / 20) return "id:" + id;
            }
            for (String g : generic) {
                if (id.contains(g) && !id.contains("reel_viewer") && !id.contains("shelf") && !id.contains("thumbnail") && n.area() >= screen * 55 / 100) return "cover:" + id;
            }
        }
        for (Node n : s.nodes) {
            if (!n.visible || !n.selected) continue;
            String label = (n.desc + " " + n.text).trim().toLowerCase(Locale.ROOT);
            if (label.equals(tabLabel) || label.startsWith(tabLabel + " ") || label.startsWith(tabLabel + ",")) return "tab:" + tabLabel;
        }
        return null;
    }

    public static boolean looksLikeDms(Snapshot s) {
        if (!IG.equals(s.pkg)) return false;
        for (Node n : s.nodes) {
            String id = n.shortId();
            if (id.startsWith("direct_") || id.contains("thread_") || id.equals("row_thread_composer_edittext")) return true;
        }
        return false;
    }

    /* ---------------- browsers ---------------- */

    public static final String[][] BROWSER_URL_IDS = {
        { "com.android.chrome", "url_bar" },
        { "com.chrome.beta", "url_bar" },
        { "com.brave.browser", "url_bar" },
        { "com.microsoft.emmx", "url_bar" },
        { "com.kiwibrowser.browser", "url_bar" },
        { "com.vivaldi.browser", "url_bar" },
        { "com.opera.browser", "url_field" },
        { "com.opera.mini.native", "url_field" },
        { "org.mozilla.firefox", "mozac_browser_toolbar_url_view" },
        { "org.mozilla.fenix", "mozac_browser_toolbar_url_view" },
        { "com.sec.android.app.sbrowser", "location_bar_edit_text" },
        { "com.mi.globalbrowser", "url" },
        { "com.duckduckgo.mobile.android", "omnibarTextInput" },
    };

    public static boolean isBrowser(String pkg) {
        for (String[] b : BROWSER_URL_IDS) if (b[0].equals(pkg)) return true;
        return false;
    }

    private static final Pattern SHORT_URL = Pattern.compile(
        "(^|[/.])(youtube\\.com/shorts|youtu\\.be/shorts|instagram\\.com/(reels?|reel)(/|$|\\?)|facebook\\.com/reels?(/|$|\\?)|fb\\.watch/|tiktok\\.com)",
        Pattern.CASE_INSENSITIVE);

    /** Returns the URL currently shown in a browser's address bar, or "" */
    public static String browserUrl(Snapshot s) {
        String want = null;
        for (String[] b : BROWSER_URL_IDS) if (b[0].equals(s.pkg)) want = b[1];
        if (want == null) return "";
        for (Node n : s.nodes) {
            if (n.shortId().equals(want)) {
                String t = n.text == null ? "" : n.text.trim();
                if (!t.isEmpty()) return t;
            }
        }
        // fallback: any editable field that looks like a URL
        for (Node n : s.nodes) {
            String t = n.text == null ? "" : n.text.trim();
            if (n.editable && t.matches("(?i)^(https?://)?[a-z0-9.-]+\\.[a-z]{2,}(/.*)?$")) return t;
        }
        return "";
    }

    public static String detectBrowser(Snapshot s, Config c) {
        if (!c.browsers || !isBrowser(s.pkg)) return null;
        String url = browserUrl(s);
        if (url.isEmpty()) return null;
        if (SHORT_URL.matcher(url).find()) return "url:" + url;
        String host = url.replaceFirst("(?i)^https?://", "").replaceFirst("[/?#].*$", "").toLowerCase(Locale.ROOT);
        for (String site : c.blockedSites) {
            String d = site.toLowerCase(Locale.ROOT).replaceFirst("^https?://", "").replaceFirst("/.*$", "").replaceFirst("^www\\.", "");
            if (d.isEmpty()) continue;
            if (host.equals(d) || host.endsWith("." + d)) return "site:" + d;
        }
        return null;
    }
}
