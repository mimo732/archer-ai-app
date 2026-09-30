package ai.archer.assistant;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Map;

/**
 * ARCHER AI — Android native bridge.
 * The website's universal agent (/agent-client.js) detects this plugin as
 * window.Capacitor.Plugins.ArcherBridge and uses it to execute commands
 * queued on the ARCHER website: open apps, open URLs, notify, sys info.
 */
@CapacitorPlugin(name = "ArcherBridge")
public class ArcherBridgePlugin extends Plugin {

    /** friendly names → Android package ids (mirrors the website APP_LINKS) */
    private static final Map<String, String> PACKAGES = new HashMap<String, String>();
    static {
        PACKAGES.put("youtube", "com.google.android.youtube");
        PACKAGES.put("yt", "com.google.android.youtube");
        PACKAGES.put("instagram", "com.instagram.android");
        PACKAGES.put("facebook", "com.facebook.katana");
        PACKAGES.put("whatsapp", "com.whatsapp");
        PACKAGES.put("twitter", "com.twitter.android");
        PACKAGES.put("x", "com.twitter.android");
        PACKAGES.put("google", "com.google.android.googlequicksearchbox");
        PACKAGES.put("maps", "com.google.android.apps.maps");
        PACKAGES.put("gmail", "com.google.android.gm");
        PACKAGES.put("spotify", "com.spotify.music");
        PACKAGES.put("github", "com.github.android");
        PACKAGES.put("chatgpt", "com.openai.chatgpt");
        PACKAGES.put("tiktok", "com.zhiliaoapp.musically");
        PACKAGES.put("telegram", "org.telegram.messenger");
        PACKAGES.put("discord", "com.discord");
        PACKAGES.put("netflix", "com.netflix.mediaclient");
        PACKAGES.put("chrome", "com.android.chrome");
        PACKAGES.put("settings", "com.android.settings");
        PACKAGES.put("camera", "com.android.camera");
        PACKAGES.put("phone", "com.android.dialer");
        PACKAGES.put("messages", "com.google.android.apps.messaging");
        PACKAGES.put("playstore", "com.android.vending");
        PACKAGES.put("files", "com.google.android.documentsui");
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject info = new JSObject();
        String persisted = getContext()
                .getSharedPreferences("archer", android.content.Context.MODE_PRIVATE)
                .getString("deviceId", null);
        String deviceId = persisted;
        if (deviceId == null || deviceId.isEmpty()) {
            deviceId = "android-" + java.util.UUID.randomUUID().toString();
            getContext()
                    .getSharedPreferences("archer", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString("deviceId", deviceId)
                    .apply();
        }
        info.put("deviceId", deviceId);
        info.put("name", "Android — " + Build.MODEL);
        info.put("platform", "android");
        info.put("version", "1.0.0");
        call.resolve(info);
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String name = call.getString("name");
        String query = call.getString("query", "");
        if (name == null || name.isEmpty()) {
            call.reject("no app name given");
            return;
        }
        String key = name.toLowerCase().trim();
        String pkg = PACKAGES.get(key);

        // YouTube search: deep-link straight into the app's search
        if ("youtube".equals(key) || "yt".equals(key)) {
            if (query != null && !query.isEmpty()) {
                Intent search = new Intent(Intent.ACTION_SEARCH);
                search.setPackage("com.google.android.youtube");
                search.putExtra("query", query);
                search.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    startActivity(search);
                    JSObject out = new JSObject();
                    out.put("result", "searching YouTube for " + query);
                    call.resolve(out);
                    return;
                } catch (Exception ignored) {
                    // fall through to browser search
                }
                openUrl(URI_WEB, "https://www.youtube.com/results?search_query=" + query, call);
                return;
            }
        }

        if (pkg != null) {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launch);
                call.resolve();
                return;
            }
            // app not installed → fall back to the web (matching the site behaviour)
            String fallback = FALLBACK_URLS.get(key);
            if (fallback != null) {
                openUrl(URI_WEB, fallback, call);
                return;
            }
            call.reject("app not installed: " + name);
            return;
        }

        call.reject("unknown app: " + name);
    }

    private static final int URI_WEB = 0;

    /** common web fallbacks when the native app is missing */
    private static final Map<String, String> FALLBACK_URLS = new HashMap<String, String>();
    static {
        FALLBACK_URLS.put("youtube", "https://www.youtube.com");
        FALLBACK_URLS.put("yt", "https://www.youtube.com");
        FALLBACK_URLS.put("instagram", "https://www.instagram.com");
        FALLBACK_URLS.put("facebook", "https://www.facebook.com");
        FALLBACK_URLS.put("whatsapp", "https://web.whatsapp.com");
        FALLBACK_URLS.put("twitter", "https://x.com");
        FALLBACK_URLS.put("x", "https://x.com");
        FALLBACK_URLS.put("google", "https://www.google.com");
        FALLBACK_URLS.put("maps", "https://maps.google.com");
        FALLBACK_URLS.put("gmail", "https://mail.google.com");
        FALLBACK_URLS.put("spotify", "https://open.spotify.com");
        FALLBACK_URLS.put("github", "https://github.com");
        FALLBACK_URLS.put("chatgpt", "https://chatgpt.com");
        FALLBACK_URLS.put("tiktok", "https://www.tiktok.com");
        FALLBACK_URLS.put("telegram", "https://web.telegram.org");
        FALLBACK_URLS.put("discord", "https://discord.com/app");
        FALLBACK_URLS.put("netflix", "https://www.netflix.com");
    }

    private void openUrl(int mode, String url, PluginCall call) {
        try {
            Uri uri = Uri.parse(url);
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("could not open: " + url);
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("no url given");
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            call.reject("unsupported url");
            return;
        }
        openUrl(URI_WEB, url, call);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        String title = call.getString("title", "ARCHER AI");
        String body = call.getString("body", "");
        Toast.makeText(getContext(), title + (body.isEmpty() ? "" : " — " + body), Toast.LENGTH_LONG)
                .show();
        call.resolve();
    }

    @PluginMethod
    public void sysInfo(PluginCall call) {
        JSObject info = new JSObject();
        info.put("model", Build.MODEL);
        info.put("brand", Build.BRAND);
        info.put("device", Build.DEVICE);
        info.put("androidVersion", Build.VERSION.RELEASE);
        info.put("sdkInt", Build.VERSION.SDK_INT);
        Runtime rt = Runtime.getRuntime();
        info.put("javaHeapMaxMB", rt.maxMemory() / (1024 * 1024));
        info.put("javaHeapFreeMB", rt.freeMemory() / (1024 * 1024));
        call.resolve(info);
    }
}
