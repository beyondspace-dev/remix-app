import {
  AdbDeviceFrameDecoder,
  parseAdbDeviceList,
  parseDeviceOwner,
  parsePackageVersion,
  type AndroidDevice,
} from "./device-parser.mjs";
import { ManagerError, runAdb, spawnAdb } from "./adb.js";

const REMIX_APP_ID = "com.fainthit.remix";

export type { AndroidDevice } from "./device-parser.mjs";

export interface RemixAppStatus {
  installed: boolean;
  running: boolean;
  versionName?: string;
  versionCode?: number;
}

export interface AndroidDeviceInfo extends AndroidDevice {
  androidVersion?: string;
  deviceOwner?: string;
  remix: RemixAppStatus;
}

export interface WatchDevicesOptions {
  signal?: AbortSignal;
}

export function listDevices(adbPath: string): AndroidDevice[] {
  return parseAdbDeviceList(runAdb(adbPath, ["devices", "-l"]).stdout);
}

export function inspectDevice(
  adbPath: string,
  deviceSerial: string,
): AndroidDeviceInfo {
  const device = listDevices(adbPath).find(
    (candidate) => candidate.serial === deviceSerial,
  );
  if (!device) {
    throw new ManagerError(`ADB device not found: ${deviceSerial}`);
  }
  if (device.state !== "device") {
    throw new ManagerError(
      `ADB device is not ready: ${deviceSerial} (${device.state})`,
    );
  }

  const model = shell(adbPath, deviceSerial, ["getprop", "ro.product.model"]);
  const androidVersion = shell(adbPath, deviceSerial, [
    "getprop",
    "ro.build.version.release",
  ]);
  const packagePath = shell(
    adbPath,
    deviceSerial,
    ["pm", "path", REMIX_APP_ID],
    true,
  );
  const installed = /^package:/m.test(packagePath);
  const packageVersion = installed
    ? parsePackageVersion(
        shell(adbPath, deviceSerial, ["dumpsys", "package", REMIX_APP_ID]),
      )
    : {};
  const running = installed && Boolean(
    shell(adbPath, deviceSerial, ["pidof", REMIX_APP_ID], true),
  );
  const deviceOwner = parseDeviceOwner(
    shell(adbPath, deviceSerial, ["dpm", "list-owners"]),
  );

  return {
    ...device,
    ...(model ? { model } : {}),
    ...(androidVersion ? { androidVersion } : {}),
    ...(deviceOwner ? { deviceOwner } : {}),
    remix: {
      installed,
      running,
      ...packageVersion,
    },
  };
}

export async function* watchDevices(
  adbPath: string,
  options: WatchDevicesOptions = {},
): AsyncGenerator<AndroidDevice[]> {
  if (options.signal?.aborted) return;

  const child = spawnAdb(adbPath, ["track-devices", "-l"]);
  const decoder = new AdbDeviceFrameDecoder();
  let processError: Error | undefined;
  let stderr = "";
  const completion = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("error", (error) => {
      processError = error;
      resolve({ code: null, signal: null });
    });
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-64 * 1024);
  });

  const abort = () => child.kill();
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    if (options.signal?.aborted) {
      child.kill();
      return;
    }

    for await (const chunk of child.stdout) {
      for (const devices of decoder.push(chunk)) {
        yield devices;
      }
    }

    const result = await completion;
    if (options.signal?.aborted) return;
    if (processError) {
      throw new ManagerError(processError.message);
    }
    decoder.finish();
    if (result.code !== 0) {
      throw new ManagerError(
        stderr.trim() ||
          `ADB device tracker exited with ${result.signal ?? result.code ?? "unknown status"}`,
      );
    }
  } catch (error) {
    if (error instanceof ManagerError) throw error;
    throw new ManagerError(
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    options.signal?.removeEventListener("abort", abort);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
  }
}

function shell(
  adbPath: string,
  deviceSerial: string,
  args: string[],
  allowFailure = false,
): string {
  const result = runAdb(
    adbPath,
    ["-s", deviceSerial, "shell", ...args],
    { allowFailure },
  );
  return result.stdout.trim();
}
