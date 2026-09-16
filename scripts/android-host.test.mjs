import assert from "node:assert/strict";

import { isAndroidHostDeviceOwner } from "./android-host.mjs";

assert.equal(
  isAndroidHostDeviceOwner(
    "User  0: admin=com.fainthit.remix/.RemixDeviceAdminReceiver,DeviceOwner",
  ),
  true,
);
assert.equal(
  isAndroidHostDeviceOwner(
    "User  0: admin=com.example/.DeviceAdminReceiver,DeviceOwner",
  ),
  false,
);
