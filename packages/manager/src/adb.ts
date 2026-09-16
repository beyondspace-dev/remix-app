import { spawnSync } from "node:child_process";

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

export function runAdb(
  command: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): RunResult {
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

function quoteWindowsShellArg(value: string): string {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
