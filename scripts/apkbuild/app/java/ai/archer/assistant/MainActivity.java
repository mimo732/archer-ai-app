package ai.archer.assistant;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.app.DownloadManager;
import android.os.Environment;
import android.app.ActivityManager;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.Locale;

/**
 * ARCHER AI — Android app (lean native shell)
 * -------------------------------------------
 * Loads the ARCHER website brain in a secure WebView and exposes the same
 * device bridge contract as the Electron app, so the site's universal agent
 * (agent-client.js) registers this phone with the brain and executes its
 * commands (open youtube, notify, sys info...) natively.
 */
public class MainActivity extends Activity {

    /** ARCHER website brain — baked at build time (CI can rewrite it) */
    private static final String SERVER_URL =
            "https://preview-8cd85ce6-1016-48b5-a387-d12748b3dc31.space-z.ai";

    private static final String CHANNEL_ID = "archer";

    private WebView web;

    // ---- bridge ---------------------------------------------------------------

    private class NativeBridge {

        @JavascriptInterface
        public String deviceInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("deviceId", persistentDeviceId());
                o.put("name", deviceName());
                o.put("platform", "android");
                o.put("version", "1.0.0");
                return o.toString();
            } catch (Exception e) {
                return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public String openApp(String json) {
            try {
                JSONObject p = new JSONObject(json == null ? "{}" : json);
                String name = p.optString("name", p.optString("target", "")).trim().toLowerCase(Locale.US);
                String query = p.optString("query", "").trim();
                if (name.length() == 0) return "{\"error\":\"no app name\"}";

                // YouTube search inside the app itself
                if (name.contains("youtube") && query.length() > 0) {
                    return openPackageUrl("com.google.android.youtube",
                            "https://www.youtube.com/results?search_query=" + urlencode(query));
                }

                String pkg = packageFor(name);
                if (pkg == null) {
                    // not a known package — graceful web lookup fallback
                    return openUrlJson("{\"url\":\"https://www.google.com/search?q="
                            + urlencode(name + " app") + "\"}");
                }
                PackageManager pm = getPackageManager();
                Intent i = pm.getLaunchIntentForPackage(pkg);
                if (i == null) return "{\"value\":\"app not installed: " + esc(name) + "\"}";
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "{\"value\":\"ok\"}";
            } catch (Exception e) {
                return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public String openUrl(String json) {
            return openUrlJson(json);
        }

        @JavascriptInterface
        public String notify(String json) {
            try {
                JSONObject p = new JSONObject(json == null ? "{}" : json);
                String title = p.optString("title", "ARCHER AI");
                String body = p.optString("body", "");
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm == null || !nm.areNotificationsEnabled()) {
                    toast(title + (body.length() > 0 ? " — " + body : ""));
                    return "{\"value\":\"toast\"}";
                }
                Notification.Builder b = Build.VERSION.SDK_INT >= 26
                        ? new Notification.Builder(MainActivity.this, CHANNEL_ID)
                        : new Notification.Builder(MainActivity.this);
                b.setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new Notification.BigTextStyle().bigText(body))
                        .setAutoCancel(true);
                Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (open != null) {
                    b.setContentIntent(PendingIntent.getActivity(MainActivity.this, 0, open,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
                }
                nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), b.build());
                return "{\"value\":\"ok\"}";
            } catch (Exception e) {
                return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public String sysInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("manufacturer", Build.MANUFACTURER);
                o.put("model", Build.MODEL);
                o.put("android", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("battery", batteryPercent());
                o.put("uptimeMin", SystemClock.uptimeMillis() / 60000L);
                ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
                if (am != null) {
                    ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                    am.getMemoryInfo(mi);
                    o.put("memUsedMb", (mi.totalMem - mi.availMem) / 1048576L);
                    o.put("memTotalMb", mi.totalMem / 1048576L);
                }
                return o.toString();
            } catch (Exception e) {
                return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
            }
        }
    }

    // ---- app map ---------------------------------------------------------------

    private static String packageFor(String name) {
        String n = name.replace(" app", "").replace(" open", "").trim();
        switch (n) {
            case "youtube":       return "com.google.android.youtube";
            case "yt music":
            case "youtube music": return "com.google.android.apps.youtube.music";
            case "chrome":        return "com.android.chrome";
            case "whatsapp":      return "com.whatsapp";
            case "instagram":
            case "insta":         return "com.instagram.android";
            case "facebook":      return "com.facebook.katana";
            case "messenger":     return "com.facebook.orca";
            case "gmail":
            case "mail":          return "com.google.android.gm";
            case "maps":
            case "google maps":   return "com.google.android.apps.maps";
            case "spotify":       return "com.spotify.music";
            case "netflix":       return "com.netflix.mediaclient";
            case "camera":        return "com.android.camera2";
            case "settings":      return "com.android.settings";
            case "playstore":
            case "play store":    return "com.android.vending";
            case "twitter":
            case "x":             return "com.twitter.android";
            case "tiktok":        return "com.zhiliaoapp.musically";
            case "telegram":      return "org.telegram.messenger";
            case "snapchat":      return "com.snapchat.android";
            case "reddit":        return "com.reddit.frontpage";
            case "amazon":        return "com.amazon.mShop.android.shopping";
            case "uber":          return "com.ubercab";
            case "calendar":      return "com.google.android.calendar";
            case "clock":         return "com.google.android.deskclock";
            case "calculator":    return "com.google.android.calculator";
            case "photos":        return "com.google.android.apps.photos";
            case "drive":         return "com.google.android.apps.docs";
            case "chatgpt":       return "com.openai.chatgpt";
            case "github":        return "com.github.android";
            default:              return null;
        }
    }

    private String openPackageUrl(String pkg, String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.setPackage(pkg);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "{\"value\":\"ok\"}";
        } catch (Exception e) {
            return openUrlJson("{\"url\":\"" + esc(url) + "\"}");
        }
    }

    /** ACTION_VIEW an external url (shared by the bridge and fallbacks) */
    private String openUrlJson(String json) {
        try {
            JSONObject p = new JSONObject(json == null ? "{}" : json);
            String url = p.optString("url", "").trim();
            if (url.length() == 0) return "{\"error\":\"no url\"}";
            if (!url.matches("(?i)^(https?|mailto|tel|sms|geo)://.*")) {
                url = "https://" + url;
            }
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "{\"value\":\"ok\"}";
        } catch (Exception e) {
            return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
        }
    }

    // ---- helpers ---------------------------------------------------------------

    private String persistentDeviceId() {
        SharedPreferences sp = getSharedPreferences("archer", MODE_PRIVATE);
        String id = sp.getString("deviceId", null);
        if (id == null) {
            id = java.util.UUID.randomUUID().toString();
            sp.edit().putString("deviceId", id).apply();
        }
        return id;
    }

    private String deviceName() {
        String m = Build.MANUFACTURER;
        String mo = Build.MODEL;
        if (mo != null && m != null && mo.toLowerCase(Locale.US).startsWith(m.toLowerCase(Locale.US))) {
            return mo;
        }
        return (m == null ? "Android" : m) + " " + (mo == null ? "Device" : mo);
    }

    private int batteryPercent() {
        try {
            Intent i = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (i == null) return -1;
            int level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            return level < 0 ? -1 : (level * 100) / scale;
        } catch (Exception e) {
            return -1;
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    private static String urlencode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    // ---- shim injected before the site's agent boots ----------------------------
    // Wraps the synchronous native bridge in the Capacitor plugin shape the
    // website's agent-client.js already knows how to talk to.

    private static final String SHIM_JS =
        "(function(){" +
        "if(window.__archerShim)return;window.__archerShim=true;" +
        "var n=window.archerNative;if(!n)return;" +
        "function P(s){try{return JSON.parse(s)}catch(e){return{value:s}}}" +
        "function pm(f){try{return Promise.resolve(f())}catch(e){return Promise.reject(e)}}" +
        "var api={" +
        "deviceInfo:function(){return pm(function(){var o=P(n.deviceInfo());return o.value||o})}," +
        "openApp:function(a){return pm(function(){var o=P(n.openApp(JSON.stringify(a||{})));return o.value!==undefined?o.value:o})}," +
        "openUrl:function(a){return pm(function(){var o=P(n.openUrl(JSON.stringify(a||{})));return o.value!==undefined?o.value:o})}," +
        "notify:function(a){return pm(function(){var o=P(n.notify(JSON.stringify(a||{})));return o.value!==undefined?o.value:o})}," +
        "sysInfo:function(){return pm(function(){var o=P(n.sysInfo());return o.value||o})}" +
        "};" +
        "window.Capacitor=window.Capacitor||{Plugins:{}};" +
        "window.Capacitor.Plugins=window.Capacitor.Plugins||{};" +
        "window.Capacitor.Plugins.ArcherBridge=api;" +
        "})();";

    private void injectShim() {
        if (web == null) return;
        web.evaluateJavascript(SHIM_JS, null);
    }

    /** named inner classes (nested anonymous classes trip older R8 dexers) */
    private class ArcherWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            // non-web schemes (intent://, youtube://, whatsapp://...) go to Android,
            // so the site's deep-link feature opens real native apps
            if (url.startsWith("intent://")) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) { }
                return true;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) { }
                return true;
            }
            return false; // web content renders inside ARCHER
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            injectShim();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            injectShim();
            // belt-and-braces: the site hydrates scripts moments after load
            new Handler(Looper.getMainLooper()).postDelayed(new ShimInjector(), 1200);
        }
    }

    private class ShimInjector implements Runnable {
        @Override
        public void run() {
            injectShim();
        }
    }

    private class ArcherDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String disposition,
                                    String mimeType, long size) {
            try {
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String name = Uri.parse(url).getLastPathSegment();
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                        name == null ? "archer-download" : name);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(r);
                    toast("Downloading " + (name == null ? "" : name));
                }
            } catch (Exception e) {
                openUrlJson("{\"url\":\"" + esc(url) + "\"}");
            }
        }
    }

    // ---- lifecycle ---------------------------------------------------------------

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(
                    CHANNEL_ID, "ARCHER AI", NotificationManager.IMPORTANCE_DEFAULT));
        }

        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#030603"));
        w.setNavigationBarColor(Color.parseColor("#030603"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#030603"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new NativeBridge(), "archerNative");

        web.setWebViewClient(new ArcherWebViewClient());

        web.setWebChromeClient(new WebChromeClient());

        // in-app downloads (e.g. pulling ARCHER.apk from the SETTING panel itself)
        web.setDownloadListener(new ArcherDownloadListener());

        setContentView(web);
        web.loadUrl(SERVER_URL);
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
