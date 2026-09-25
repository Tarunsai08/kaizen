package com.tarun.kaizen;
import com.tarun.kaizen.ShortsDetector.*;
public class ShortsDetectorTest {
  @org.junit.Test public void allCases() { main(new String[0]); if (fail > 0) throw new AssertionError(fail + " failed"); }
  static int fail = 0, pass = 0;
  static void check(String name, boolean cond) { if (cond) pass++; else { fail++; System.out.println("FAIL " + name); } }
  static Snapshot snap(String pkg, Node... ns) { Snapshot s = new Snapshot(); s.pkg = pkg; for (Node n : ns) s.nodes.add(n); return s; }
  static Node n(String id, int l, int t, int r, int b) { return new Node(id, l, t, r, b); }
  static Node tab(String desc, boolean sel) { Node x = new Node("com.google.android.youtube:id/pivot_bar_item", 0, 2200, 200, 2400); x.desc = desc; x.selected = sel; return x; }
  public static void main(String[] a) {
    Config c = new Config();
    // YouTube Shorts player via strong id
    check("yt strong", ShortsDetector.detectApp(snap(ShortsDetector.YT, n("com.google.android.youtube:id/reel_recycler", 0, 0, 1080, 2300)), c, false) != null);
    // renamed id but full-screen & contains reel
    check("yt generic cover", ShortsDetector.detectApp(snap(ShortsDetector.YT, n("com.google.android.youtube:id/reel_new_container_v2", 0, 0, 1080, 2300)), c, false) != null);
    // Shorts shelf on home feed (small) must NOT block
    check("yt shelf ok", ShortsDetector.detectApp(snap(ShortsDetector.YT, n("com.google.android.youtube:id/reel_shelf_item", 0, 500, 540, 1400), n("com.google.android.youtube:id/results", 0, 0, 1080, 2300)), c, false) == null);
    // Shorts tab selected, no ids
    check("yt tab", ShortsDetector.detectApp(snap(ShortsDetector.YT, tab("Home", false), tab("Shorts", true)), c, false) != null);
    // Home tab selected
    check("yt home ok", ShortsDetector.detectApp(snap(ShortsDetector.YT, tab("Home", true), tab("Shorts", false)), c, false) == null);
    // normal watch page
    check("yt watch ok", ShortsDetector.detectApp(snap(ShortsDetector.YT, n("com.google.android.youtube:id/watch_player", 0, 0, 1080, 700)), c, false) == null);
    // disabled
    Config off = new Config(); off.youtube = false;
    check("yt disabled", ShortsDetector.detectApp(snap(ShortsDetector.YT, n("com.google.android.youtube:id/reel_recycler", 0, 0, 1080, 2300)), off, false) == null);
    // Instagram reels viewer
    check("ig reels", ShortsDetector.detectApp(snap(ShortsDetector.IG, n("com.instagram.android:id/clips_viewer_view_pager", 0, 0, 1080, 2300)), c, false) != null);
    // Instagram stories (reel_viewer) must NOT block
    check("ig stories ok", ShortsDetector.detectApp(snap(ShortsDetector.IG, n("com.instagram.android:id/reel_viewer_media_container", 0, 0, 1080, 2300)), c, false) == null);
    // Instagram home feed with inline small clip
    check("ig feed ok", ShortsDetector.detectApp(snap(ShortsDetector.IG, n("com.instagram.android:id/clips_media_inline", 0, 300, 1080, 1200)), c, false) == null);
    // Reels tab selected
    Node rt = new Node("com.instagram.android:id/clips_tab", 0, 2200, 200, 2400); rt.desc = "Reels"; rt.selected = true;
    check("ig tab", ShortsDetector.detectApp(snap(ShortsDetector.IG, rt), c, false) != null);
    // DM exception
    Config dm = new Config(); dm.allowDmReels = true;
    check("ig dm allowed", ShortsDetector.detectApp(snap(ShortsDetector.IG, n("com.instagram.android:id/clips_viewer_view_pager", 0, 0, 1080, 2300)), dm, true) == null);
    check("ig dm detect", ShortsDetector.looksLikeDms(snap(ShortsDetector.IG, n("com.instagram.android:id/direct_thread_toolbar", 0, 0, 1080, 200))));
    // Browser
    Node url = new Node("com.android.chrome:id/url_bar", 0, 0, 1080, 120); url.text = "m.youtube.com/shorts/abc123"; url.editable = true;
    check("chrome shorts", ShortsDetector.detectBrowser(snap("com.android.chrome", url), c) != null);
    Node url2 = new Node("com.android.chrome:id/url_bar", 0, 0, 1080, 120); url2.text = "youtube.com/watch?v=abc";
    check("chrome watch ok", ShortsDetector.detectBrowser(snap("com.android.chrome", url2), c) == null);
    Node url3 = new Node("org.mozilla.firefox:id/mozac_browser_toolbar_url_view", 0, 0, 1080, 120); url3.text = "https://www.instagram.com/reels/xyz/";
    check("firefox reels", ShortsDetector.detectBrowser(snap("org.mozilla.firefox", url3), c) != null);
    Node url4 = new Node("com.android.chrome:id/url_bar", 0, 0, 1080, 120); url4.text = "instagram.com/p/xyz";
    check("ig post ok", ShortsDetector.detectBrowser(snap("com.android.chrome", url4), c) == null);
    Config bs = new Config(); bs.blockedSites.add("instagram.com");
    check("blocked site", ShortsDetector.detectBrowser(snap("com.android.chrome", url4), bs) != null);
    Node url5 = new Node("com.android.chrome:id/url_bar", 0, 0, 1080, 120); url5.text = "notinstagram.com.evil.io/x";
    check("blocked site no false", ShortsDetector.detectBrowser(snap("com.android.chrome", url5), bs) == null);
    Node url6 = new Node("com.sec.android.app.sbrowser:id/location_bar_edit_text", 0,0,1080,120); url6.text = "youtube.com/shorts/Q1"; 
    check("samsung shorts", ShortsDetector.detectBrowser(snap("com.sec.android.app.sbrowser", url6), c) != null);
    Node url7 = new Node("com.brave.browser:id/url_bar", 0,0,1080,120); url7.text = "www.facebook.com/reel/123";
    check("fb reel", ShortsDetector.detectBrowser(snap("com.brave.browser", url7), c) != null);
    System.out.println("passed " + pass + " failed " + fail);

  }
}
