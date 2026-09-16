import path from "node:path";

import { runAdb } from "./adb";

const HOST_PACKAGE = "com.fainthit.remix";
const HOST_ACTIVITY = "com.fainthit.remix/.MainActivity";
const DEVICE_IMPORT_DIR = "files/remix/import";
const DEVICE_TMP_DIR = "/data/local/tmp/remixapp";

export interface DeployProjectPackageLegacyOptions {
  adbPath: string;
  deviceSerial: string;
  packagePath: string;
}

export async function deployProjectPackageLegacy({
  adbPath,
  deviceSerial,
  packagePath,
}: DeployProjectPackageLegacyOptions): Promise<void> {
  const fileName = path.basename(packagePath);
  const tmpPath = `${DEVICE_TMP_DIR}/${fileName}`;
  const appPath = `${DEVICE_IMPORT_DIR}/${fileName}`;

  runAdb(adbPath, ["-s", deviceSerial, "shell", "mkdir", "-p", DEVICE_TMP_DIR]);
  runAdb(adbPath, ["-s", deviceSerial, "push", packagePath, tmpPath]);
  runAdb(adbPath, ["-s", deviceSerial, "shell", "chmod", "644", tmpPath]);
  runAdb(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "mkdir",
    "-p",
    DEVICE_IMPORT_DIR,
  ]);
  runAdb(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "cp",
    tmpPath,
    appPath,
  ]);
  runAdb(adbPath, ["-s", deviceSerial, "shell", "rm", "-f", tmpPath]);

  const devicePackagePath = `/data/data/${HOST_PACKAGE}/${appPath}`;
  const script = [
    "rm -rf files/remix/projects/staging files/remix/projects/previous",
    "mkdir -p files/remix/projects/staging",
    `unzip -oq ${shellQuote(devicePackagePath)} -d files/remix/projects/staging`,
    "if [ -d files/remix/projects/active ]; then mv files/remix/projects/active files/remix/projects/previous; fi",
    "mv files/remix/projects/staging files/remix/projects/active",
    "rm -rf files/remix/projects/previous",
  ].join(" && ");

  runAdb(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    `run-as ${HOST_PACKAGE} sh -c ${shellQuote(script)}`,
  ]);
  runAdb(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "start",
    "-n",
    HOST_ACTIVITY,
    "--es",
    "remix.install",
    devicePackagePath,
  ]);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
