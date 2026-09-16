import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import {
  deployProject as deployProjectToDevice,
  deployProjectPackageLegacy,
} from "@remixapp/manager";

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
  legacy?: boolean;
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

  if (options.legacy) {
    await deployProjectPackageLegacy({
      adbPath: adb,
      deviceSerial: device.serial,
      packagePath,
    });
  } else {
    const packageStat = await stat(packagePath);
    const sha256 = await hashFile(packagePath);
    await deployProjectToDevice({
      adbPath: adb,
      deviceSerial: device.serial,
      source: createReadStream(packagePath),
      size: packageStat.size,
      sha256,
    });
  }

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

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}
