package ai.archer.assistant;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the custom native plugin BEFORE Capacitor creates its bridge.
        // If registration happens after super.onCreate(), the WebView starts
        // without ArcherBridge and JavaScript sees "Pont Android non chargé".
        registerPlugin(ArcherBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
