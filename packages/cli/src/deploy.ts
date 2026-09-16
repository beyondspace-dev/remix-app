import { existsSync } from "node:fs";
import path from "node:path";

import { deployProjectPackage } from "@remixapp/manager";

import {
  listAndroidDevices,
  resolveAdb,
  selectAndroidDevice,
} from "../android-tools/index.mjs";

import { buildProject } from "./build.js";
import { loadRemixConfig } from "./config.js";
import { RemixCliError } from "./errors.js";
import { packageFileName } from "./paths.js";

export interface DeployOptions {
  cwd: string;
  device?: string;
  build?: boolean;
}

export async function deployProject(options: DeployOptions): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const adb = resolveAdb();
  const devices = listAndroidDevices(adb);
  const device = await selectAndroidDevice(devices, options.device);
  const packagePath =
    options.build === false
      ? await resolveExistingPackage(cwd)
      : await buildProject({ cwd });

  await deployProjectPackage({
    adbPath: adb,
    deviceSerial: device.serial,
    packagePath,
  });

  console.log(`Deployed ${packagePath} to ${device.serial}`);
}

async function resolveExistingPackage(cwd: string): Promise<string> {
  const { config } = await loadRemixConfig(cwd);
  const packagePath = path.join(
    cwd,
    "dist",
    packageFileName(config.name, config.version),
  );

  if (!existsSync(packagePath)) {
    throw new RemixCliError(
      `Project package does not exist: ${packagePath}\nRun "remix-cli build" or omit --no-build.`,
    );
  }

  return packagePath;
}
