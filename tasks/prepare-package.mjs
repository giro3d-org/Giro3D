import { execSync } from 'child_process';
import esMain from 'es-main';
import fse from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const baseDir = dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(baseDir, '../build/giro3d');

export async function getPackageVersion() {
    const pkg = await fse.readJSON(path.resolve(baseDir, '../package.json'));
    return `v${pkg.version}`;
}

export async function getGitVersion() {
    let nextCommitVersion = 'next';
    try {
        nextCommitVersion = execSync('git describe --tags --always').toString();
    } catch {
        // Ignore
    }
    return nextCommitVersion.trim();
}

async function main() {
    const pkg = await fse.readJSON(path.resolve(baseDir, '../package.json'));

    // update the version number in version.js
    const versionPath = path.join(buildDir, 'version.js');
    const versionRegEx = /const VERSION = '(.*)';/g;
    let versionSrc = await fse.readFile(versionPath, 'utf-8');
    versionSrc = versionSrc.replace(versionRegEx, `var VERSION = '${pkg.version}';`);
    await fse.writeFile(versionPath, versionSrc, 'utf-8');

    // write out simplified package.json
    pkg.main = 'index.js';
    delete pkg.scripts;
    delete pkg.devDependencies;
    delete pkg.style;
    delete pkg.eslintConfig;
    delete pkg.private;
    delete pkg.vitest;
    await fse.writeJSON(path.join(buildDir, 'package.json'), pkg, { spaces: 2 });

    // copy in readme and license files
    await fse.copyFile(path.resolve(baseDir, '../README.md'), path.join(buildDir, 'README.md'));

    await fse.copyFile(path.resolve(baseDir, '../LICENSE'), path.join(buildDir, 'LICENSE'));
}

/**
 * If running this module directly, read the config file, call the main
 * function, and write the output file.
 */
if (esMain(import.meta)) {
    main().catch(err => {
        process.stderr.write(`${err.message}\n`, () => process.exit(1));
    });
}
