const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const runtime = path.join(root, "local-runtime");

if (process.argv[2] === "--archive") {
  const stage = path.resolve(process.argv[3]);
  const relative = path.relative(runtime, stage);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(stage).startsWith("hostinger-source-")
  )
    throw new Error("The staging directory must belong to this workspace.");
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/[-:]/g, "")
    .replace(" ", "_");
  const archive = path.join(runtime, `linkweb_hostinger_${stamp}.zip`);
  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; $bundle = [System.IO.Compression.ZipFile]::Open($env:LINKWEB_PACKAGE_ZIP, [System.IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $env:LINKWEB_PACKAGE_STAGE -Recurse -File -Force | ForEach-Object { $name = $_.FullName.Substring($env:LINKWEB_PACKAGE_STAGE.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($bundle, $_.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $bundle.Dispose() }",
      ],
      {
        env: {
          ...process.env,
          LINKWEB_PACKAGE_STAGE: stage,
          LINKWEB_PACKAGE_ZIP: archive,
        },
        stdio: "inherit",
      }
    );
  } else {
    execFileSync("zip", ["-q", "-r", archive, "."], {
      cwd: stage,
      stdio: "inherit",
    });
  }
  const bytes = fs.statSync(archive).size;
  if (bytes > 50 * 1024 * 1024)
    throw new Error("Hostinger's 50 MB source limit was exceeded.");
  console.log(JSON.stringify({ archive, bytes }));
} else {
  const stage = fs.mkdtempSync(path.join(runtime, "hostinger-source-"));
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  for (const name of files) {
    if (
      [
        "apps/mobile/",
        "apps/extension/",
        "apps/worker/",
        ".devcontainer/",
        ".github/",
      ].some((prefix) => name.startsWith(prefix))
    )
      continue;
    if (
      name.startsWith("local-runtime/") &&
      name !== "local-runtime/personal-profile.mjs"
    )
      continue;
    const target = path.join(stage, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, name), target);
  }
  const file = path.join(stage, "package.json");
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.workspaces = ["apps/web", "packages/*"];
  pkg.packageManager = "npm@10.9.2";
  pkg.overrides = pkg.resolutions;
  delete pkg.resolutions;
  delete pkg.devDependencies;
  pkg.scripts = {
    build: "node scripts/build-hostinger.mjs",
    start: "node hostinger/shared-server.cjs",
    postinstall: "node scripts/install-browser.cjs",
  };
  pkg.engines = { node: "22.x" };
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  fs.writeFileSync(path.join(stage, ".npmrc"), "legacy-peer-deps=true\n");
  // Hostinger's Yarn installer supplies unsupported Yarn 1 flags. Use npm only
  // in this deployment artifact; the main repository retains its Yarn setup.
  for (const name of ["yarn.lock", ".yarnrc.yml"])
    fs.unlinkSync(path.join(stage, name));
  console.log(
    JSON.stringify({
      stage,
      next: "Generate the staged npm lockfile, then run --archive STAGE.",
    })
  );
}
