import { run } from "../packages/cli/android-tools/index.mjs";

const ANDROID_HOST_APP_ID = "com.fainthit.remix";
const ANDROID_HOST_ACTIVITY = `${ANDROID_HOST_APP_ID}/.MainActivity`;
const ANDROID_HOST_ADMIN = `${ANDROID_HOST_APP_ID}/.RemixDeviceAdminReceiver`;

export function installAndLaunchAndroidHost(
  adb,
  deviceSerial,
  apkPath,
  setDeviceOwner = false,
) {
  run(adb, ["-s", deviceSerial, "install", "-r", apkPath], {
    stdio: "inherit",
  });
  if (setDeviceOwner) {
    ensureDeviceOwner(adb, deviceSerial);
  }
  run(adb, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "force-stop",
    ANDROID_HOST_APP_ID,
  ]);
  run(adb, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "start",
    "-n",
    ANDROID_HOST_ACTIVITY,
  ]);
}

function ensureDeviceOwner(adb, deviceSerial) {
  const listOwners = () =>
    run(adb, ["-s", deviceSerial, "shell", "dpm", "list-owners"]).stdout;

  if (isAndroidHostDeviceOwner(listOwners())) {
    return;
  }

  run(
    adb,
    [
      "-s",
      deviceSerial,
      "shell",
      "dpm",
      "set-device-owner",
      ANDROID_HOST_ADMIN,
    ],
    { stdio: "inherit" },
  );

  if (!isAndroidHostDeviceOwner(listOwners())) {
    throw new Error(`Device Owner setup failed: ${ANDROID_HOST_ADMIN}`);
  }
}

export function isAndroidHostDeviceOwner(output) {
  return output
    .split(/\r?\n/)
    .some(
      (line) =>
        line.includes(`admin=${ANDROID_HOST_ADMIN}`) &&
        line.includes(",DeviceOwner"),
    );
}
