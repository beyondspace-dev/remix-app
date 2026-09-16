import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const [apkPath, downloadUrl, outputBase] = process.argv.slice(2);

if (!apkPath || !downloadUrl || !outputBase) {
  throw new Error(
    "Usage: node scripts/release/provisioning.mjs <apk> <download-url> <output-base>",
  );
}

const url = new URL(downloadUrl);
if (url.protocol !== "https:") {
  throw new Error("Provisioning APK URL must use HTTPS.");
}

const apk = await readFile(apkPath);
const checksum = createHash("sha256").update(apk).digest("base64url");
const payload = {
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
    "com.fainthit.remix/.RemixDeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
    downloadUrl,
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": checksum,
};
const payloadText = JSON.stringify(payload);

await mkdir(path.dirname(path.resolve(outputBase)), { recursive: true });
await writeFile(
  `${outputBase}.json`,
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);
await QRCode.toFile(`${outputBase}.png`, payloadText, {
  errorCorrectionLevel: "M",
  margin: 4,
  width: 1024,
});

console.log(`Provisioning JSON: ${outputBase}.json`);
console.log(`Provisioning QR: ${outputBase}.png`);
console.log(`APK SHA-256: ${checksum}`);
