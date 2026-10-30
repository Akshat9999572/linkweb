"""Package the committed web app for Hostinger Business Node.js hosting."""
from pathlib import Path
import datetime
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = (ROOT / "local-runtime").resolve()

if len(sys.argv) == 3 and sys.argv[1] == "--archive":
    stage = Path(sys.argv[2]).resolve()
    if not stage.is_relative_to(RUNTIME) or not stage.name.startswith("hostinger-source-"):
        raise SystemExit("The staging directory must belong to this workspace.")
    stamp = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).strftime("%Y%m%d_%H%M%S")
    archive = RUNTIME / f"linkweb_hostinger_{stamp}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for file in stage.rglob("*"):
            if file.is_file():
                bundle.write(file, file.relative_to(stage).as_posix())
    if archive.stat().st_size > 50 * 1024 * 1024:
        raise SystemExit("Hostinger's source archive size limit was exceeded.")
    print(json.dumps({"archive": str(archive), "bytes": archive.stat().st_size}))
else:
    stage = Path(tempfile.mkdtemp(prefix="hostinger-source-", dir=RUNTIME)).resolve()
    if not stage.is_relative_to(RUNTIME):
        raise SystemExit("Invalid staging directory.")
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    for name in filter(None, files):
        if name.startswith(("apps/mobile/", "apps/extension/", ".devcontainer/", ".github/")):
            continue
        if name.startswith("local-runtime/") and name != "local-runtime/personal-profile.mjs":
            continue
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    package_file = stage / "package.json"
    package = json.loads(package_file.read_text(encoding="utf-8"))
    package["workspaces"] = ["apps/web", "packages/*"]
    package.pop("devDependencies", None)
    package["scripts"] = {
        "build": "node scripts/build-hostinger.mjs",
        "start": "node hostinger/shared-server.cjs",
        "postinstall": "node scripts/install-browser.cjs && patch-package",
    }
    package["engines"] = {"node": "22.x"}
    package_file.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"stage": str(stage), "next": "Update this staging directory's yarn.lock, then run --archive STAGE."}))
