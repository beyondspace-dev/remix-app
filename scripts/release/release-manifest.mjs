import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const configFile = path.join(root, "release.config.json");
const versionFile = path.join(root, "packages/app/android/version.properties");

const isCheck = process.argv.length === 3 && process.argv[2] === "--check";

const apkFile = isCheck ? null : process.argv[2];
const outputFile = isCheck ? null : (process.argv[3] ?? "release.json");

if (!isCheck) {
  if (!apkFile) {
    throw new Error(
      "Usage: node scripts/release/release-manifest.mjs <apk> [output]",
    );
  }

  if (!fs.existsSync(apkFile)) {
    throw new Error(`APK not found: ${apkFile}`);
  }
}

const config = JSON.parse(fs.readFileSync(configFile, "utf8"));

const versionProperties = Object.fromEntries(
  fs
    .readFileSync(versionFile, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");

      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const version = versionProperties.REMIX_VERSION_NAME;
const versionCode = Number(versionProperties.REMIX_VERSION_CODE);

if (!version) {
  throw new Error("REMIX_VERSION_NAME is missing");
}

if (!Number.isInteger(versionCode)) {
  throw new Error("Invalid REMIX_VERSION_CODE");
}

const schema = config.schemaVersion;
if (schema !== 1) {
  throw new Error("Invalid Schema Version");
}

if (!isCheck) {
  const apkName = path.basename(apkFile);
  if (path.extname(apkName).toLowerCase() !== ".apk") {
    throw new Error("Unexpected APK file extension");
  }
}

const managerCompatibility = config.managerCompatibility.replace(
  /\{\{CURRENT\}\}/g,
  version,
);

const manifest = {
  schemaVersion: schema,
  app: "remixapp-host",
  packageName: "com.fainthit.remix",

  version,
  versionCode,

  protocolVersion: config.protocolVersion,
  managerCompatibility: managerCompatibility,

  apk: {
    name: apkName,
  },
};

const MANIFEST_JSON = JSON.stringify(manifest, null, 2);
if (!isCheck) {
  fs.writeFileSync(outputFile, `${MANIFEST_JSON}\n`, "utf8");

  console.log(`Created ${outputFile}`);
} else {
  console.log(MANIFEST_JSON);
  console.log("Release manifest check done");
}
