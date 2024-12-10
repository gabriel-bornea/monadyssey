const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("No version provided to release script.");
  process.exit(1);
}

const rootPkgPath = path.resolve(__dirname, '..', 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = newVersion;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2), 'utf8');

const packagesDir = path.resolve(__dirname, '..', 'packages');
const packages = fs.readdirSync(packagesDir).filter((p) => {
  const pkgJsonPath = path.join(packagesDir, p, 'package.json');
  return fs.existsSync(pkgJsonPath);
});

for (const pkgName of packages) {
  const pkgPath = path.join(packagesDir, pkgName, 'package.json');
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkgData.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2), 'utf8');

  execSync(`npm publish`, {
    cwd: path.join(packagesDir, pkgName),
    stdio: 'inherit'
  });
}
