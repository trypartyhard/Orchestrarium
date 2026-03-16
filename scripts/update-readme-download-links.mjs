import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const readmePath = resolve(rootDir, "README.md");
const packageJsonPath = resolve(rootDir, "package.json");
const tauriConfigPath = resolve(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(rootDir, "src-tauri", "Cargo.toml");

const readme = readFileSync(readmePath, "utf8");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
const cargoToml = readFileSync(cargoTomlPath, "utf8");
const cargoVersionMatch = cargoToml.match(/^version = "([^"]+)"$/m);

if (!cargoVersionMatch) {
  throw new Error("Could not find package version in src-tauri/Cargo.toml");
}

const cargoVersion = cargoVersionMatch[1];

if (
  packageJson.version !== tauriConfig.version ||
  packageJson.version !== cargoVersion
) {
  throw new Error(
    `Version mismatch: package.json=${packageJson.version}, src-tauri/tauri.conf.json=${tauriConfig.version}, src-tauri/Cargo.toml=${cargoVersion}`,
  );
}

const version = packageJson.version;
const baseUrl = `https://github.com/trypartyhard/Orchestrarium/releases/download/v${version}`;

const replacements = [
  {
    label: "README subtitle",
    pattern: /\*\*.*\*\*/,
    expected: "**Workspace Manager for Agent Configurations**",
  },
  {
    label: "Windows badge",
    pattern:
      /\[!\[Windows\]\(https:\/\/img\.shields\.io\/badge\/Windows-0078D6\?logo=windows&logoColor=white\)\]\([^)]+\)/,
    expected: `[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](${baseUrl}/Orchestrarium_${version}_x64-setup.exe)`,
  },
  {
    label: "macOS badge",
    pattern:
      /\[!\[macOS\]\(https:\/\/img\.shields\.io\/badge\/macOS-000000\?logo=apple&logoColor=white\)\]\([^)]+\)/,
    expected: `[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](${baseUrl}/Orchestrarium_${version}_x64.dmg)`,
  },
  {
    label: "Linux badge",
    pattern:
      /\[!\[Linux\]\(https:\/\/img\.shields\.io\/badge\/Linux-FCC624\?logo=linux&logoColor=black\)\]\([^)]+\)/,
    expected: `[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](${baseUrl}/Orchestrarium_${version}_amd64.deb)`,
  },
];

let nextReadme = readme;

for (const { label, pattern, expected } of replacements) {
  if (!pattern.test(nextReadme)) {
    throw new Error(`Could not find ${label} in README.md`);
  }

  nextReadme = nextReadme.replace(pattern, expected);
}

const checkMode = process.argv.includes("--check");

if (checkMode) {
  if (nextReadme !== readme) {
    console.error("README download links are out of sync with the current version.");
    process.exit(1);
  }

  console.log(`README download links match version ${version}.`);
  process.exit(0);
}

if (nextReadme !== readme) {
  writeFileSync(readmePath, nextReadme);
  console.log(`Updated README download links to version ${version}.`);
} else {
  console.log(`README download links already match version ${version}.`);
}
