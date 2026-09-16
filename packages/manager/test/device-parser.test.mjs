import assert from "node:assert/strict";
import test from "node:test";

import {
  AdbDeviceFrameDecoder,
  parseAdbDeviceList,
  parseDeviceOwner,
  parsePackageVersion,
} from "../src/device-parser.mjs";

test("parses every ADB device state and long-list metadata", () => {
  assert.deepEqual(
    parseAdbDeviceList(`List of devices attached
R3AAA device product:a15 model:SM_A155N device:a15 transport_id:4
R3BBB unauthorized transport_id:5
emulator-5554 offline
???????????? no permissions (missing udev rules?)
`),
    [
      {
        serial: "R3AAA",
        state: "device",
        product: "a15",
        model: "SM_A155N",
        device: "a15",
        transportId: 4,
      },
      { serial: "R3BBB", state: "unauthorized", transportId: 5 },
      { serial: "emulator-5554", state: "offline" },
      { serial: "????????????", state: "no permissions" },
    ],
  );
});

test("decodes fragmented track-devices frames", () => {
  const body = "R3AAA\tdevice product:a15 model:SM_A155N transport_id:4\n";
  const frame = Buffer.concat([
    Buffer.from(body.length.toString(16).padStart(4, "0"), "ascii"),
    Buffer.from(body),
    Buffer.from("0000", "ascii"),
  ]);
  const decoder = new AdbDeviceFrameDecoder();

  assert.deepEqual(decoder.push(frame.subarray(0, 3)), []);
  assert.deepEqual(decoder.push(frame.subarray(3)), [
    [
      {
        serial: "R3AAA",
        state: "device",
        product: "a15",
        model: "SM_A155N",
        transportId: 4,
      },
    ],
    [],
  ]);
  decoder.finish();
});

test("distinguishes Device Owner and parses Remix package versions", () => {
  assert.equal(
    parseDeviceOwner(
      "User 0: admin=com.example/.Admin,ManagedProfileOwner\n" +
        "User 0: admin=com.fainthit.remix/.RemixDeviceAdminReceiver,DeviceOwner",
    ),
    "com.fainthit.remix/.RemixDeviceAdminReceiver",
  );
  assert.deepEqual(
    parsePackageVersion("    versionCode=42 minSdk=24\n    versionName=1.4.0\n"),
    { versionName: "1.4.0", versionCode: 42 },
  );
});
