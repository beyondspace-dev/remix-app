package com.fainthit.remix;

import android.Manifest;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.PermissionInfo;
import android.os.Build;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

public final class RemixPermissionManager {
    private static final String TAG = "RemixPermissions";

    private RemixPermissionManager() {}

    public static synchronized void grantAllDeclaredRuntimePermissions(Context context) {
        DevicePolicyManager devicePolicyManager = context.getSystemService(DevicePolicyManager.class);
        if (
            devicePolicyManager == null ||
            !devicePolicyManager.isDeviceOwnerApp(context.getPackageName())
        ) {
            return;
        }

        ComponentName admin = new ComponentName(context, RemixDeviceAdminReceiver.class);
        for (String permission : getMissingDeclaredRuntimePermissions(context)) {
            grantRuntimePermission(context, devicePolicyManager, admin, permission);
        }
    }

    static String[] getMissingDeclaredRuntimePermissions(Context context) {
        PackageManager packageManager = context.getPackageManager();
        List<String> permissions = new ArrayList<>();

        try {
            PackageInfo packageInfo = getPackageInfo(packageManager, context.getPackageName());
            if (packageInfo.requestedPermissions == null) {
                return new String[0];
            }

            for (String permission : packageInfo.requestedPermissions) {
                if (
                    Manifest.permission.READ_EXTERNAL_STORAGE.equals(permission) &&
                    Build.VERSION.SDK_INT > Build.VERSION_CODES.S_V2
                ) {
                    continue;
                }

                if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
                    continue;
                }

                try {
                    PermissionInfo permissionInfo = getPermissionInfo(packageManager, permission);
                    if (getBaseProtection(permissionInfo) == PermissionInfo.PROTECTION_DANGEROUS) {
                        permissions.add(permission);
                    }
                } catch (PackageManager.NameNotFoundException ignored) {
                    // The permission does not exist on this Android version.
                }
            }
        } catch (PackageManager.NameNotFoundException exception) {
            Log.e(TAG, "Unable to inspect declared permissions", exception);
        }

        return permissions.toArray(new String[0]);
    }

    private static void grantRuntimePermission(
        Context context,
        DevicePolicyManager devicePolicyManager,
        ComponentName admin,
        String permission
    ) {
        try {
            boolean granted = devicePolicyManager.setPermissionGrantState(
                admin,
                context.getPackageName(),
                permission,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
            );

            if (
                !granted &&
                context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w(TAG, "Permission was not granted: " + permission);
            }
        } catch (SecurityException exception) {
            Log.e(TAG, "Device Owner cannot grant permission: " + permission, exception);
        }
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo getPackageInfo(PackageManager packageManager, String packageName)
        throws PackageManager.NameNotFoundException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return packageManager.getPackageInfo(
                packageName,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS)
            );
        }

        return packageManager.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS);
    }

    private static PermissionInfo getPermissionInfo(
        PackageManager packageManager,
        String permission
    ) throws PackageManager.NameNotFoundException {
        return packageManager.getPermissionInfo(permission, 0);
    }

    @SuppressWarnings("deprecation")
    private static int getBaseProtection(PermissionInfo permissionInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return permissionInfo.getProtection();
        }

        return permissionInfo.protectionLevel & PermissionInfo.PROTECTION_MASK_BASE;
    }
}
