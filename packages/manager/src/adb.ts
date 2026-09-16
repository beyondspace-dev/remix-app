import {
  spawn,
  spawnSync,
  type ChildProcessByStdio,
} from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export class ManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagerError";
  }
}

export function resolveAdb(): string {
  const executable = process.platform === "win32" ? "adb.exe" : "adb";
  const candidates = [
    process.env.REMIXAPP_ADB,
    process.env.ADB,
    process.env.ANDROID_HOME
      ? path.join(process.env.ANDROID_HOME, "platform-tools", executable)
      : undefined,
    process.env.ANDROID_SDK_ROOT
      ? path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", executable)
      : undefined,
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Android",
          "Sdk",
          "platform-tools",
          executable,
        )
      : undefined,
    "adb",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (candidate !== "adb" && !existsSync(candidate)) {
      continue;
    }

    if (runAdb(candidate, ["version"], { allowFailure: true }).status === 0) {
      return candidate;
    }
  }

  throw new ManagerError(
    "Failed to run adb. Set REMIXAPP_ADB or add Android SDK platform-tools to PATH.",
  );
}

export function runAdb(
  command: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): RunResult {
  const { executable, executableArgs, useWindowsShell } = prepareCommand(
    command,
    args,
  );
  const result = spawnSync(executable, executableArgs, {
    encoding: "utf8",
    shell: useWindowsShell,
    stdio: "pipe",
    windowsHide: true,
  });

  if (result.error && !options.allowFailure) {
    throw new ManagerError(result.error.message);
  }

  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (status !== 0 && !options.allowFailure) {
    throw new ManagerError(
      [`Command failed: ${command} ${args.join(" ")}`, stdout, stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { status, stdout, stderr };
}

export function spawnAdb(
  command: string,
  args: string[],
): ChildProcessByStdio<null, Readable, Readable> {
  const { executable, executableArgs, useWindowsShell } = prepareCommand(
    command,
    args,
  );
  return spawn(executable, executableArgs, {
    shell: useWindowsShell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function prepareCommand(command: string, args: string[]) {
  const useWindowsShell =
    process.platform === "win32" && /\.(?:bat|cmd)$/i.test(command);
  return {
    executable: useWindowsShell
      ? [command, ...args].map(quoteWindowsShellArg).join(" ")
      : command,
    executableArgs: useWindowsShell ? [] : args,
    useWindowsShell,
  };
}

function quoteWindowsShellArg(value: string): string {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
