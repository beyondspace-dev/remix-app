import { createHash } from "node:crypto";
import { once } from "node:events";
import { createConnection, type Socket } from "node:net";
import type { Readable } from "node:stream";

import { ManagerError, runAdb } from "./adb.js";

const HOST_ACTIVITY = "com.fainthit.remix/.MainActivity";
const DEPLOY_SOCKET = "remixapp-manager-v1";
const PROTOCOL_MAGIC = 0x524d5831;
// 512 MiB bounds device cache use; raise with the Host limit if real packages exceed it.
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const RESPONSE_LIMIT = 64 * 1024;
const SERVER_START_TIMEOUT_MS = 15_000;

export interface DeployProgress {
  phase: "starting" | "uploading" | "installing" | "done";
  transferred?: number;
  total?: number;
}

export interface DeployProjectOptions {
  adbPath: string;
  deviceSerial: string;
  source: Readable;
  size: number;
  sha256: string;
  onProgress?: (progress: DeployProgress) => void;
}

interface DeployResponse {
  ok: boolean;
  sha256?: string;
  error?: string;
}

export async function deployProject(
  options: DeployProjectOptions,
): Promise<void> {
  if (!Number.isSafeInteger(options.size) || options.size <= 0) {
    throw new ManagerError(
      "Project package size must be a positive safe integer",
    );
  }
  if (options.size > MAX_PACKAGE_BYTES) {
    throw new ManagerError(
      `Project package exceeds ${MAX_PACKAGE_BYTES} bytes`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(options.sha256)) {
    throw new ManagerError(
      "Project package SHA-256 must be lowercase hexadecimal",
    );
  }

  options.onProgress?.({ phase: "starting" });
  runAdb(options.adbPath, [
    "-s",
    options.deviceSerial,
    "shell",
    "am",
    "start",
    "-n",
    HOST_ACTIVITY,
  ]);

  const port = createForward(options.adbPath, options.deviceSerial);
  try {
    await waitForServer(port);
    await uploadProject(port, options);
  } finally {
    runAdb(
      options.adbPath,
      ["-s", options.deviceSerial, "forward", "--remove", `tcp:${port}`],
      { allowFailure: true },
    );
  }
}

function createForward(adbPath: string, deviceSerial: string): number {
  const result = runAdb(adbPath, [
    "-s",
    deviceSerial,
    "forward",
    "tcp:0",
    `localabstract:${DEPLOY_SOCKET}`,
  ]);
  const port = Number(result.stdout.trim());
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new ManagerError(
      `ADB returned an invalid forwarded port: ${result.stdout.trim()}`,
    );
  }
  return port;
}

async function waitForServer(port: number): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    let socket: Socket | undefined;
    try {
      socket = await connect(port);
      socket.write(requestHeader(0, ZERO_SHA256));
      socket.end();
      const response = await readResponse(socket);
      if (response.ok) return;
      lastError = new Error(
        response.error ?? "Deploy server rejected readiness check",
      );
    } catch (error) {
      lastError = error;
    } finally {
      socket?.destroy();
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new ManagerError(
    `Timed out waiting for remixApp deploy server: ${errorMessage(lastError)}`,
  );
}

async function uploadProject(
  port: number,
  options: DeployProjectOptions,
): Promise<void> {
  const socket = await connect(port);
  const hash = createHash("sha256");
  let transferred = 0;

  options.onProgress?.({
    phase: "uploading",
    transferred,
    total: options.size,
  });

  try {
    await write(socket, requestHeader(options.size, options.sha256));

    for await (const value of options.source) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      transferred += chunk.length;
      if (transferred > options.size) {
        throw new ManagerError(
          "Project package stream exceeded its declared size",
        );
      }
      hash.update(chunk);
      await write(socket, chunk);
      options.onProgress?.({
        phase: "uploading",
        transferred,
        total: options.size,
      });
    }

    if (transferred !== options.size) {
      throw new ManagerError(
        `Project package stream ended at ${transferred} bytes; expected ${options.size}`,
      );
    }

    options.onProgress?.({ phase: "installing" });
    socket.end();
    const response = await readResponse(socket);
    if (!response.ok) {
      throw new ManagerError(response.error ?? "Project deploy failed");
    }

    const localHash = hash.digest("hex");
    if (localHash !== options.sha256 || response.sha256 !== options.sha256) {
      throw new ManagerError("Project package SHA-256 verification failed");
    }

    options.onProgress?.({ phase: "done" });
  } catch (error) {
    socket.destroy();
    if (error instanceof ManagerError) throw error;
    throw new ManagerError(errorMessage(error));
  }
}

function requestHeader(size: number, sha256: string): Buffer {
  const header = Buffer.allocUnsafe(44);
  header.writeUInt32BE(PROTOCOL_MAGIC, 0);
  header.writeBigUInt64BE(BigInt(size), 4);
  Buffer.from(sha256, "hex").copy(header, 12);
  return header;
}

async function connect(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function write(socket: Socket, chunk: Buffer): Promise<void> {
  if (!socket.write(chunk)) {
    await once(socket, "drain");
  }
}

async function readResponse(socket: Socket): Promise<DeployResponse> {
  let buffer = Buffer.alloc(0);
  let bodyLength: number | undefined;

  for await (const value of socket) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    buffer = Buffer.concat([buffer, chunk]);

    if (bodyLength === undefined && buffer.length >= 4) {
      bodyLength = buffer.readUInt32BE(0);
      if (bodyLength === 0 || bodyLength > RESPONSE_LIMIT) {
        throw new ManagerError(`Invalid deploy response length: ${bodyLength}`);
      }
    }

    if (bodyLength !== undefined && buffer.length >= bodyLength + 4) {
      socket.destroy();
      try {
        return JSON.parse(buffer.subarray(4, bodyLength + 4).toString("utf8"));
      } catch {
        throw new ManagerError("Deploy server returned invalid JSON");
      }
    }
  }

  throw new ManagerError(
    "Deploy server closed before sending a complete response",
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ZERO_SHA256 = "0".repeat(64);
