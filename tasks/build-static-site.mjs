/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import chokidar from 'chokidar';
import { program } from 'commander';
import ejs from 'ejs';
import esMain from 'es-main';
import fse from 'fs-extra';
import { globSync } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

import { getGitVersion, getPackageVersion } from './prepare-package.mjs';
import { createStaticServer } from './serve.mjs';
import { log, logOk, logWatched } from './utils.mjs';

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(baseDir, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const siteDir = path.join(rootDir, 'site');
const graphicsDir = path.join(rootDir, 'graphics');
const templatesDir = path.join(siteDir, 'templates');

export const defaultParameters = {
    output: path.join(rootDir, 'build', 'site'),
    releaseName: 'next',
};

export async function getVersions() {
    const latest = await getPackageVersion();
    const next = await getGitVersion();

    return [
        { title: `Latest (${latest})`, href: '/latest/examples/index.html' },
        { title: `Next (${next})`, href: '/next/examples/index.html' },
    ];
}

function readTemplate(template) {
    const templateFilename = path.basename(template);
    return ejs.compile(fse.readFileSync(template, 'utf-8'), {
        templateFilename,
        root: rootDir,
        views: [templatesDir],
    });
}

function copyWasmFiles(outputDir) {
    log('static-site', 'copying library files...');

    const copy = (...src) => {
        const sourceFile = path.join(nodeModulesDir, ...src);
        const filename = path.basename(sourceFile);
        const destFile = path.join(outputDir, filename);

        fse.copyFileSync(sourceFile, destFile);

        const relative = path.relative(rootDir, destFile);
        logOk('static-site', relative);
    };

    copy('laz-perf', 'lib', 'laz-perf.wasm');

    // Draco library
    copy('three', 'examples', 'jsm', 'libs', 'draco', 'draco_decoder.wasm');
    copy('three', 'examples', 'jsm', 'libs', 'draco', 'draco_decoder.js');
    copy('three', 'examples', 'jsm', 'libs', 'draco', 'draco_encoder.js');
    copy('three', 'examples', 'jsm', 'libs', 'draco', 'draco_wasm_wrapper.js');

    // Basis library
    copy('three', 'examples', 'jsm', 'libs', 'basis', 'basis_transcoder.wasm');
    copy('three', 'examples', 'jsm', 'libs', 'basis', 'basis_transcoder.js');
}

export async function copyAssets(parameters) {
    log('static-site', 'Generating assets...');
    const assetsDir = path.join(parameters.output, 'assets');
    const fontsDir = path.join(assetsDir, 'fonts');
    const wasmDir = path.join(assetsDir, 'wasm');
    const imagesDir = path.join(parameters.output, 'images');
    fse.mkdirpSync(fontsDir);
    fse.mkdirpSync(imagesDir);
    fse.mkdirpSync(wasmDir);

    copyWasmFiles(wasmDir);

    const scssList = ['bootstrap-custom', 'index'];

    scssList.forEach(scss => {
        execSync(
            `npx sass ${path.join(siteDir, `${scss}.scss`)}:${path.join(assetsDir, `${scss}.css`)} --style=compressed`,
        );
    });

    fse.copySync(
        path.join(rootDir, 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.bundle.min.js'),
        path.join(assetsDir, 'bootstrap.bundle.min.js'),
    );

    fse.copySync(path.join(rootDir, 'node_modules', 'bootstrap-icons', 'font', 'fonts'), fontsDir);
    fse.copySync(graphicsDir, imagesDir);
    fse.copySync(
        path.join(graphicsDir, 'favicon.svg'),
        path.join(parameters.output, 'favicon.svg'),
    );
}

export async function copySite(parameters) {
    log('static-site', 'Building site...');
    const ejsFiles = globSync(path.join(siteDir, '*.ejs'));
    const availableVersions = await getVersions();

    ejsFiles.forEach(ejsFile => {
        const filename = path.basename(ejsFile);
        const htmlFilename = filename.replace('.ejs', '.html');

        const htmlTemplate = readTemplate(ejsFile);
        const htmlContent = htmlTemplate({
            releaseName: parameters.releaseName,
            availableVersions,
        }).trim();

        fse.outputFileSync(path.join(parameters.output, htmlFilename), htmlContent);
    });

    fse.copyFileSync(path.join(siteDir, '_redirects'), path.join(parameters.output, '_redirects'));
}

export async function buildStaticSite(parameters) {
    await copyAssets(parameters);
    await copySite(parameters);
}

async function handleModification(parameters, sourceFile) {
    logWatched('static-site', path.basename(sourceFile));
    await buildStaticSite({
        ...parameters,
        clean: false,
    });
    logOk('static-site', 'Rebuilt!');
}

async function serveStaticSite(parameters) {
    chokidar.watch([siteDir, graphicsDir]).on('change', p => handleModification(parameters, p));

    log('static-site', 'Starting server...');
    return createStaticServer(parameters.output);
}

/**
 * If running this module directly, read the config file, call the main
 * function, and write the output file.
 */
if (esMain(import.meta)) {
    program
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('-c, --clean', 'Clean directory', defaultParameters.clean)
        .option(
            '-r, --release-name <version>',
            'Release name to use in navbar (latest, next, ...)',
            defaultParameters.releaseName,
        )
        .option('-w, --watch', 'Serve and watch for modifications', false);

    program.parse();

    const { watch, ...options } = program.opts();
    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    await buildStaticSite(options);
    if (watch) {
        await serveStaticSite(options);
    }
}
