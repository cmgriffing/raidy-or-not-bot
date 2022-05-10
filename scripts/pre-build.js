const fs = require("fs");
const path = require("path");

const packageJsonPath = path.resolve(__dirname, "../package.json");

const packageJsonRaw = fs.readFileSync(
  path.resolve(__dirname, "../package.json"),
  { encoding: "utf8" }
);
const packageJson = JSON.parse(packageJsonRaw);

packageJson.name = "raidy-or-not";

const { version } = packageJson;

fs.writeFileSync(
  path.resolve(__dirname, "../packages/main/version.ts"),
  `
export const BOT_VERSION = "${version}";
`
);

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
