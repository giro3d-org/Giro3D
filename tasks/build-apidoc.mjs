/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { exec, execSync } from 'child_process';
import { program } from 'commander';
import esMain from 'es-main';
import fse from 'fs-extra';
import path, { dirname } from 'path';
import { exit } from 'process';
import { fileURLToPath } from 'url';

import { copyAssets } from './build-static-site.mjs';
import { getPackageVersion } from './prepare-package.mjs';
import { createStaticServer } from './serve.mjs';
import { log, logError, logOk } from './utils.mjs';

const baseDir = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(baseDir, '..');
const apidocDir = path.join(rootDir, 'apidoc');
const sourceDir = path.join(rootDir, 'src');
const tmpDir = path.join(rootDir, 'build', '.cache', 'apidoc');

/**
 * @typedef {object} Parameters
 * @property {string} output
 * @property {string} version
 * @property {boolean} lintOnly
 * @property {boolean} watch
 */

export const defaultParameters = {
    output: path.join(rootDir, 'build', 'site', 'next', 'apidoc'),
    clean: true,
    version: undefined,
    releaseName: 'next',
};

/**
 * @param {Parameters} parameters
 */
export async function cleanApidoc(parameters) {
    log('apidoc', 'Cleaning output directory...');
    fse.removeSync(parameters.output);
    fse.removeSync(tmpDir);
}

/**
 * @param {string} src - The root directory
 * @returns {string[]} - The entry points
 */
function collectEntryPoints(src) {
    const result = [];

    for (const entry of fse.readdirSync(src, {
        recursive: true,
        withFileTypes: true,
        encoding: 'utf-8',
    })) {
        if (entry.isDirectory()) {
            const dirPath = path.join(entry.parentPath, entry.name);
            const apiFile = path.join(dirPath, 'api.json');

            // If api.json is present in the directory,
            // we consider including its files in the entry points.
            if (fse.existsSync(apiFile)) {
                try {
                    const json = JSON.parse(fse.readFileSync(apiFile, { encoding: 'utf-8' }));
                    /** @type {string[]} */
                    const include = json.include;

                    for (const item of include) {
                        const fullpath = path.join(dirPath, item);
                        if (fse.existsSync(fullpath)) {
                            result.push(fullpath);
                        } else {
                            logError('apidoc', `No such file: ${fullpath}`);
                            throw new Error('FATAL');
                        }
                    }
                } catch {
                    logError('apidoc', `Error while parsing ${apiFile}`);
                }
            }
        }
    }

    return result;
}

/**
 * @param {Parameters} parameters
 */
export async function buildApidoc(parameters) {
    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    fse.mkdirpSync(tmpDir);
    const typedocConfigPath = path.join(tmpDir, 'typedoc.json');

    /**
     * @type {import('typedoc').TypeDocOptions}
     */
    const config = {
        $schema: 'https://typedoc.org/schema.json',
        entryPoints: collectEntryPoints(sourceDir),
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        out: parameters.output,
        plugin: ['typedoc-github-theme', 'typedoc-plugin-rename-defaults'],
        theme: 'typedoc-github-theme',
        name: `API (${parameters.version}) - Giro3D`,
        readme: path.join(apidocDir, 'README.md'),
        basePath: sourceDir,
        titleLink: '/',
        excludeExternals: true,
        excludeInternal: true,
        excludePrivate: true,
        navigationLinks: {},
        customFooterHtml: `Copyright <strong>Giro3D</strong> 2018-${new Date().getFullYear()}, licensed under <a target="blank" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</href>`,
    };

    fse.writeJsonSync(typedocConfigPath, config);

    log('apidoc', 'Building documentation...');
    if (parameters.lintOnly) {
        execSync(`npx typedoc --options ${typedocConfigPath} --emit none`);
    } else {
        if (parameters.watch) {
            exec(`npx typedoc --watch --options ${typedocConfigPath}`);
        } else {
            execSync(`npx typedoc --options ${typedocConfigPath}`);
        }
    }
    logOk('apidoc', `Built documentation at ${parameters.output}`);
}

/**
 * @param {Parameters} parameters
 */
async function serveApidoc(parameters) {
    log('apidoc', 'Starting server...');
    return createStaticServer(parameters.output, path.join(parameters.output, '..'));
}

/**
 * If running this module directly, read the config file, call the main
 * function, and write the output file.
 */
if (esMain(import.meta)) {
    program
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('-c, --clean', 'Clean output directory', defaultParameters.clean)
        .option('--no-clean', "Don't clean")
        .option('-v, --version <version>', 'Version', defaultParameters.version)
        .option(
            '-r, --release-name <name>',
            'Release name (latest, next, ...)',
            defaultParameters.releaseName,
        )
        .option('-w, --watch', 'Serve and watch for modifications', false)
        .option('--lint-only', 'Lint only', false);

    program.parse();

    const { watch, clean, ...options } = program.opts();
    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    /** @type {Parameters} */
    const params = { ...options, clean, watch };

    run(params);
}

/**
 * @param {Parameters} params
 */
async function run(params) {
    if (!params.lintOnly) {
        if (params.clean) {
            await cleanApidoc(params);
        }

        await copyAssets({
            output: path.join(params.output, '..'),
        });
    }

    try {
        await buildApidoc(params);
        if (params.watch) {
            await serveApidoc(params);
        }
    } catch (e) {
        logError('apidoc', 'One or more error occured while generated API doc.');
        logError('apidoc', e);
        exit(1);
    }
}
