import { spawnSync } from "node:child_process";
import path from "node:path";

const HOST_PACKAGE = "com.fainthit.remix";
const HOST_ACTIVITY = "com.fainthit.remix/.MainActivity";
const DEVICE_IMPORT_DIR = "files/remix/import";
const DEVICE_TMP_DIR = "/data/local/tmp/remixapp";

export interface DeployProjectPackageOptions {
  adbPath: string;
  deviceSerial: string;
  packagePath: string;
}

export class ManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagerError";
  }
}

export async function deployProjectPackage({
  adbPath,
  deviceSerial,
  packagePath,
}: DeployProjectPackageOptions): Promise<void> {
  const devicePackagePath = installPackageFile(
    adbPath,
    deviceSerial,
    packagePath,
  );

  activateProjectPackage(adbPath, deviceSerial, devicePackagePath);
  startHostWithInstall(adbPath, deviceSerial, devicePackagePath);
}

function installPackageFile(
  adbPath: string,
  deviceSerial: string,
  packagePath: string,
): string {
  const fileName = path.basename(packagePath);
  const tmpPath = `${DEVICE_TMP_DIR}/${fileName}`;
  const appPath = `${DEVICE_IMPORT_DIR}/${fileName}`;

  run(adbPath, ["-s", deviceSerial, "shell", "mkdir", "-p", DEVICE_TMP_DIR]);
  run(adbPath, ["-s", deviceSerial, "push", packagePath, tmpPath]);
  run(adbPath, ["-s", deviceSerial, "shell", "chmod", "644", tmpPath]);
  run(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "mkdir",
    "-p",
    DEVICE_IMPORT_DIR,
  ]);
  run(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "cp",
    tmpPath,
    appPath,
  ]);
  run(adbPath, ["-s", deviceSerial, "shell", "rm", "-f", tmpPath]);

  return `/data/data/${HOST_PACKAGE}/${appPath}`;
}

function activateProjectPackage(
  adbPath: string,
  deviceSerial: string,
  packagePath: string,
): void {
  const script = [
    "rm -rf files/remix/projects/staging files/remix/projects/previous",
    "mkdir -p files/remix/projects/staging",
    `unzip -oq ${shellQuote(packagePath)} -d files/remix/projects/staging`,
    "if [ -d files/remix/projects/active ]; then mv files/remix/projects/active files/remix/projects/previous; fi",
    "mv files/remix/projects/staging files/remix/projects/active",
    "rm -rf files/remix/projects/previous",
  ].join(" && ");

  run(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    `run-as ${HOST_PACKAGE} sh -c ${shellQuote(script)}`,
  ]);
}

function startHostWithInstall(
  adbPath: string,
  deviceSerial: string,
  packagePath: string,
): void {
  run(adbPath, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "start",
    "-n",
    HOST_ACTIVITY,
    "--es",
    "remix.install",
    packagePath,
  ]);
}

function run(command: string, args: string[]): void {
  const useWindowsShell =
    process.platform === "win32" && /\.(?:bat|cmd)$/i.test(command);
  const executable = useWindowsShell
    ? [command, ...args].map(quoteWindowsShellArg).join(" ")
    : command;
  const executableArgs = useWindowsShell ? [] : args;
  const result = spawnSync(executable, executableArgs, {
    encoding: "utf8",
    shell: useWindowsShell,
    stdio: "pipe",
  });

  if (result.error) {
    throw new ManagerError(result.error.message);
  }

  if (result.status !== 0) {
    throw new ManagerError(
      [`Command failed: ${command} ${args.join(" ")}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function quoteWindowsShellArg(value: string): string {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
