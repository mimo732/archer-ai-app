package ai.archer.assistant;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.widget.Toast;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * JARVIS — Android native bridge.
 *
 * Personal/local mode:
 * - no remote ARCHER server is required;
 * - OpenRouter API key is stored on-device (encrypted when AndroidX security is available);
 * - AI requests leave the phone only for the selected OpenRouter model;
 * - app launching and speech capture run directly on Android.
 *
 * The plugin name remains "ArcherBridge" for compatibility with the original codebase.
 */
@CapacitorPlugin(
        name = "ArcherBridge",
        permissions = {
                @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
        }
)
public class ArcherBridgePlugin extends Plugin {

    private static final String PREF_API_KEY = "openrouterApiKey";
    private final ExecutorService io = Executors.newSingleThreadExecutor();

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
        PACKAGES.put("google maps", "com.google.android.apps.maps");
        PACKAGES.put("cartes", "com.google.android.apps.maps");
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
        PACKAGES.put("réglages", "com.android.settings");
        PACKAGES.put("paramètres", "com.android.settings");
        PACKAGES.put("camera", "com.android.camera");
        PACKAGES.put("caméra", "com.android.camera");
        PACKAGES.put("appareil photo", "com.android.camera");
        PACKAGES.put("phone", "com.android.dialer");
        PACKAGES.put("téléphone", "com.android.dialer");
        PACKAGES.put("messages", "com.google.android.apps.messaging");
        PACKAGES.put("sms", "com.google.android.apps.messaging");
        PACKAGES.put("playstore", "com.android.vending");
        PACKAGES.put("play store", "com.android.vending");
        PACKAGES.put("files", "com.google.android.documentsui");
        PACKAGES.put("fichiers", "com.google.android.documentsui");
    }

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
        FALLBACK_URLS.put("google maps", "https://maps.google.com");
        FALLBACK_URLS.put("cartes", "https://maps.google.com");
        FALLBACK_URLS.put("gmail", "https://mail.google.com");
        FALLBACK_URLS.put("spotify", "https://open.spotify.com");
        FALLBACK_URLS.put("github", "https://github.com");
        FALLBACK_URLS.put("chatgpt", "https://chatgpt.com");
        FALLBACK_URLS.put("tiktok", "https://www.tiktok.com");
        FALLBACK_URLS.put("telegram", "https://web.telegram.org");
        FALLBACK_URLS.put("discord", "https://discord.com/app");
        FALLBACK_URLS.put("netflix", "https://www.netflix.com");
    }

    private SharedPreferences securePrefs() {
        try {
            MasterKey masterKey = new MasterKey.Builder(getContext())
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    getContext(),
                    "jarvis_secure",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception ignored) {
            return getContext().getSharedPreferences("jarvis_secure_fallback", android.content.Context.MODE_PRIVATE);
        }
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject info = new JSObject();
        SharedPreferences prefs = getContext().getSharedPreferences("jarvis", android.content.Context.MODE_PRIVATE);
        String deviceId = prefs.getString("deviceId", null);
        if (deviceId == null || deviceId.isEmpty()) {
            deviceId = "android-" + java.util.UUID.randomUUID();
            prefs.edit().putString("deviceId", deviceId).apply();
        }
        info.put("deviceId", deviceId);
        info.put("name", "Android — " + Build.MODEL);
        info.put("platform", "android");
        info.put("version", "1.1-local");
        call.resolve(info);
    }

    @PluginMethod
    public void saveApiKey(PluginCall call) {
        String key = call.getString("apiKey", "").trim();
        if (key.isEmpty()) {
            call.reject("Clé API vide");
            return;
        }
        securePrefs().edit().putString(PREF_API_KEY, key).apply();
        JSObject out = new JSObject();
        out.put("saved", true);
        call.resolve(out);
    }

    @PluginMethod
    public void clearApiKey(PluginCall call) {
        securePrefs().edit().remove(PREF_API_KEY).apply();
        JSObject out = new JSObject();
        out.put("saved", false);
        call.resolve(out);
    }

    @PluginMethod
    public void apiKeyStatus(PluginCall call) {
        String key = securePrefs().getString(PREF_API_KEY, "");
        JSObject out = new JSObject();
        out.put("configured", key != null && !key.trim().isEmpty());
        call.resolve(out);
    }

    @PluginMethod
    public void askAI(PluginCall call) {
        final String message = call.getString("message", "").trim();
        final String system = call.getString("system", "").trim();
        final String model = call.getString("model", "").trim();
        final String apiKey = securePrefs().getString(PREF_API_KEY, "");

        if (message.isEmpty()) {
            call.reject("Message vide");
            return;
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            call.reject("Clé OpenRouter non configurée");
            return;
        }
        if (model.isEmpty()) {
            call.reject("Modèle OpenRouter non configuré");
            return;
        }

        io.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL("https://openrouter.ai/api/v1/chat/completions");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(60000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("X-Title", "JARVIS Personal Android");

                JSONArray messages = new JSONArray();
                if (!system.isEmpty()) {
                    messages.put(new JSONObject().put("role", "system").put("content", system));
                }
                messages.put(new JSONObject().put("role", "user").put("content", message));

                JSONObject body = new JSONObject();
                body.put("model", model);
                body.put("messages", messages);

                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload);
                }

                int code = conn.getResponseCode();
                InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
                StringBuilder raw = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) raw.append(line);
                }

                if (code < 200 || code >= 300) {
                    call.reject("OpenRouter HTTP " + code + " : " + raw.toString());
                    return;
                }

                JSONObject response = new JSONObject(raw.toString());
                JSONArray choices = response.optJSONArray("choices");
                if (choices == null || choices.length() == 0) {
                    call.reject("Réponse OpenRouter vide");
                    return;
                }
                String content = choices.getJSONObject(0)
                        .getJSONObject("message")
                        .optString("content", "")
                        .trim();
                if (content.isEmpty()) {
                    call.reject("Réponse IA vide");
                    return;
                }

                JSObject out = new JSObject();
                out.put("reply", content);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("Erreur IA : " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private SpeechRecognizer speechRecognizer;

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startInAppRecognition(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startInAppRecognition(call);
        } else {
            call.reject("Permission microphone refusée");
        }
    }

    /**
     * SpeechRecognizer keeps recognition inside JARVIS instead of launching
     * the large Google voice-dialog activity used by ACTION_RECOGNIZE_SPEECH.
     */
    private void startInAppRecognition(PluginCall call) {
        final String language = call.getString("language", "fr-FR");
        final String mode = call.getString("mode", "command");

        getActivity().runOnUiThread(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("Service de reconnaissance vocale indisponible");
                return;
            }

            cleanupSpeechRecognizer();
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}

                @Override
                public void onError(int error) {
                    String message;
                    switch (error) {
                        case SpeechRecognizer.ERROR_AUDIO: message = "Erreur audio"; break;
                        case SpeechRecognizer.ERROR_CLIENT: message = "Écoute interrompue"; break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: message = "Permission microphone manquante"; break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: message = "Service vocal réseau indisponible"; break;
                        case SpeechRecognizer.ERROR_NO_MATCH: message = "Je n’ai pas compris"; break;
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: message = "Microphone occupé"; break;
                        case SpeechRecognizer.ERROR_SERVER: message = "Service vocal indisponible"; break;
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: message = "Aucune parole détectée"; break;
                        default: message = "Reconnaissance vocale interrompue"; break;
                    }
                    cleanupSpeechRecognizer();
                    call.reject(message);
                }

                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    cleanupSpeechRecognizer();
                    if (matches == null || matches.isEmpty()) {
                        call.reject("Aucune phrase reconnue");
                        return;
                    }
                    JSObject out = new JSObject();
                    out.put("text", matches.get(0));
                    call.resolve(out);
                }

                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

            // Low-latency mode for normal commands; a slightly more patient mode
            // for dictated addresses. The previous 12-second minimum could make
            // JARVIS feel artificially slow even after the user had finished talking.
            final boolean addressMode = "address".equalsIgnoreCase(mode);
            intent.putExtra(
                    RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS,
                    addressMode ? 1800L : 700L
            );
            intent.putExtra(
                    RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
                    addressMode ? 1400L : 750L
            );
            intent.putExtra(
                    RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                    addressMode ? 1000L : 500L
            );
            speechRecognizer.startListening(intent);
        });
    }

    private void cleanupSpeechRecognizer() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.cancel();
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
    }

    @PluginMethod
    public void speakText(PluginCall call) {
        final String text = call.getString("text", "").trim();
        final String language = call.getString("language", "fr-FR").trim();
        if (text.isEmpty()) {
            call.reject("Texte vocal vide");
            return;
        }

        getActivity().runOnUiThread(() -> {
            final TextToSpeech[] engine = new TextToSpeech[1];
            engine[0] = new TextToSpeech(getContext(), status -> {
                TextToSpeech tts = engine[0];
                if (tts == null || status != TextToSpeech.SUCCESS) {
                    call.reject("Synthèse vocale Android indisponible");
                    if (tts != null) tts.shutdown();
                    return;
                }

                Locale locale = Locale.FRANCE;
                try {
                    String normalized = language.replace('_', '-');
                    String[] parts = normalized.split("-");
                    if (parts.length >= 2) {
                        locale = new Locale(parts[0], parts[1]);
                    } else if (parts.length == 1 && !parts[0].isEmpty()) {
                        locale = new Locale(parts[0]);
                    }
                } catch (Exception ignored) {}

                int langResult = tts.setLanguage(locale);
                if (langResult == TextToSpeech.LANG_MISSING_DATA ||
                        langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.FRANCE);
                }

                tts.setSpeechRate(1.0f);
                tts.setPitch(1.0f);

                final String utteranceId = "jarvis-" + System.nanoTime();
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}

                    @Override
                    public void onDone(String id) {
                        if (!utteranceId.equals(id)) return;
                        tts.shutdown();
                        JSObject out = new JSObject();
                        out.put("spoken", true);
                        call.resolve(out);
                    }

                    @Override
                    public void onError(String id) {
                        if (!utteranceId.equals(id)) return;
                        tts.shutdown();
                        call.reject("Erreur de synthèse vocale");
                    }

                    @Override
                    public void onError(String id, int errorCode) {
                        onError(id);
                    }
                });

                int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
                if (result == TextToSpeech.ERROR) {
                    tts.shutdown();
                    call.reject("Impossible de lancer la synthèse vocale");
                }
            });
        });
    }

    @PluginMethod
    public void navigate(PluginCall call) {
        String destination = call.getString("destination", "").trim();
        if (destination.isEmpty()) {
            call.reject("Destination manquante");
            return;
        }

        // Prefer the native Google Maps navigation intent. If Maps is not
        // installed, fall back to a normal HTTPS directions URL.
        try {
            Uri navUri = Uri.parse("google.navigation:q=" + Uri.encode(destination));
            Intent nav = new Intent(Intent.ACTION_VIEW, navUri);
            nav.setPackage("com.google.android.apps.maps");
            nav.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(nav);
            JSObject out = new JSObject();
            out.put("destination", destination);
            out.put("result", "navigation_started");
            call.resolve(out);
            return;
        } catch (Exception ignored) {
            String web = "https://www.google.com/maps/dir/?api=1&destination=" + Uri.encode(destination);
            openUrlInternal(web, call);
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String name = call.getString("name", "").toLowerCase(Locale.ROOT).trim();
        String query = call.getString("query", "");
        if (name.isEmpty()) {
            call.reject("Nom d'application manquant");
            return;
        }

        String pkg = PACKAGES.get(name);

        if (("youtube".equals(name) || "yt".equals(name)) && query != null && !query.isEmpty()) {
            Intent search = new Intent(Intent.ACTION_SEARCH);
            search.setPackage("com.google.android.youtube");
            search.putExtra("query", query);
            search.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(search);
                JSObject out = new JSObject();
                out.put("result", "Recherche YouTube : " + query);
                call.resolve(out);
                return;
            } catch (Exception ignored) {
                openUrlInternal("https://www.youtube.com/results?search_query=" + Uri.encode(query), call);
                return;
            }
        }

        if (pkg != null) {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(launch);
                call.resolve();
                return;
            }
            String fallback = FALLBACK_URLS.get(name);
            if (fallback != null) {
                openUrlInternal(fallback, call);
                return;
            }
            call.reject("Application non installée : " + name);
            return;
        }

        call.reject("Application inconnue : " + name);
    }

    private void openUrlInternal(String url, PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible d'ouvrir : " + url);
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            call.reject("URL non prise en charge");
            return;
        }
        openUrlInternal(url, call);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        String title = call.getString("title", "JARVIS");
        String body = call.getString("body", "");
        Toast.makeText(getContext(), title + (body.isEmpty() ? "" : " — " + body), Toast.LENGTH_LONG).show();
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
