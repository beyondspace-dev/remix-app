export interface AndroidDevice {
  serial: string;
  state: string;
  model?: string;
  product?: string;
  device?: string;
  transportId?: number;
}

export function parseAdbDeviceList(output: string): AndroidDevice[];

export class AdbDeviceFrameDecoder {
  push(chunk: Uint8Array): AndroidDevice[][];
  finish(): void;
}

export function parseDeviceOwner(output: string): string | undefined;

export interface PackageVersion {
  versionName?: string;
  versionCode?: number;
}

export function parsePackageVersion(output: string): PackageVersion;
