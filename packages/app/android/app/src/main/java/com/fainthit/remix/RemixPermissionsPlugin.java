package com.fainthit.remix;

import android.app.admin.DevicePolicyManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;

@CapacitorPlugin(name = "RemixPermissions")
public class RemixPermissionsPlugin extends Plugin {
    private static final String TAG = "RemixPermissions";

    private ActivityResultLauncher<String[]> runtimePermissionLauncher;
    private ActivityResultLauncher<Intent> writeSettingsLauncher;
    private PluginCall pendingCall;

    @Override
    public void load() {
        runtimePermissionLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> requestWriteSettings()
        );
        writeSettingsLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> finishRequest()
        );
    }

    @PluginMethod
    public void prepareStartupPermissions(PluginCall call) {
        DevicePolicyManager manager = getContext().getSystemService(DevicePolicyManager.class);
        if (manager != null && manager.isDeviceOwnerApp(getContext().getPackageName())) {
            call.resolve();
            return;
        }

        if (pendingCall != null) {
            call.reject("Startup permission request is already running");
            return;
        }

        pendingCall = call;
        String[] missing = RemixPermissionManager.getMissingDeclaredRuntimePermissions(getContext());
        if (missing.length == 0) {
            requestWriteSettings();
            return;
        }

        runtimePermissionLauncher.launch(missing);
    }

    private void requestWriteSettings() {
        if (Settings.System.canWrite(getContext())) {
            finishRequest();
            return;
        }

        Intent intent = new Intent(
            Settings.ACTION_MANAGE_WRITE_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        try {
            writeSettingsLauncher.launch(intent);
        } catch (ActivityNotFoundException exception) {
            Log.w(TAG, "System settings permission screen is unavailable", exception);
            finishRequest();
        }
    }

    private void finishRequest() {
        String[] missing = RemixPermissionManager.getMissingDeclaredRuntimePermissions(getContext());
        if (missing.length > 0) {
            Log.w(TAG, "Startup permissions denied: " + Arrays.toString(missing));
        }
        if (!Settings.System.canWrite(getContext())) {
            Log.w(TAG, "WRITE_SETTINGS was not granted");
        }

        PluginCall call = pendingCall;
        pendingCall = null;
        if (call != null) {
            call.resolve();
        }
    }
}
