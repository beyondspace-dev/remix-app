export function parseAdbDeviceList(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "List of devices attached")
    .map(parseDeviceLine)
    .filter((device) => device !== undefined);
}

export class AdbDeviceFrameDecoder {
  #buffer = Buffer.alloc(0);

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);
    const snapshots = [];

    while (this.#buffer.length >= 4) {
      const header = this.#buffer.subarray(0, 4).toString("ascii");
      if (!/^[0-9a-f]{4}$/i.test(header)) {
        throw new Error(`Invalid ADB track-devices frame header: ${header}`);
      }

      const length = Number.parseInt(header, 16);
      if (this.#buffer.length < 4 + length) {
        break;
      }

      const body = this.#buffer.subarray(4, 4 + length).toString("utf8");
      this.#buffer = this.#buffer.subarray(4 + length);
      snapshots.push(parseAdbDeviceList(body));
    }

    return snapshots;
  }

  finish() {
    if (this.#buffer.length !== 0) {
      throw new Error("ADB track-devices stream ended inside a frame");
    }
  }
}

export function parseDeviceOwner(output) {
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(",DeviceOwner")) continue;
    const match = line.match(/admin=([^,\s]+)/);
    if (match) return match[1];
  }
  return undefined;
}

export function parsePackageVersion(output) {
  const versionName = output.match(/^\s*versionName=(.+)$/m)?.[1]?.trim();
  const versionCodeValue = output.match(/^\s*versionCode=(\d+)\b/m)?.[1];
  const versionCode = versionCodeValue === undefined
    ? undefined
    : Number(versionCodeValue);
  return {
    ...(versionName && versionName !== "null" ? { versionName } : {}),
    ...(versionCode !== undefined ? { versionCode } : {}),
  };
}

function parseDeviceLine(line) {
  const match = line.match(/^(\S+)\s+(.+)$/);
  if (!match) return undefined;

  const [, serial, remainder] = match;
  const state = remainder.startsWith("no permissions")
    ? "no permissions"
    : remainder.split(/\s+/, 1)[0];
  const details = state === "no permissions"
    ? []
    : remainder.slice(state.length).trim().split(/\s+/).filter(Boolean);
  const properties = Object.fromEntries(
    details.flatMap((detail) => {
      const separator = detail.indexOf(":");
      return separator <= 0
        ? []
        : [[detail.slice(0, separator), detail.slice(separator + 1)]];
    }),
  );
  const transportId = Number(properties.transport_id);

  return {
    serial,
    state,
    ...(properties.model ? { model: properties.model } : {}),
    ...(properties.product ? { product: properties.product } : {}),
    ...(properties.device ? { device: properties.device } : {}),
    ...(Number.isSafeInteger(transportId) && transportId >= 0
      ? { transportId }
      : {}),
  };
}
