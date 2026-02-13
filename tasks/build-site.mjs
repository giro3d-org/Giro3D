/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import chalk from 'chalk';
import { program } from 'commander';
import esMain from 'es-main';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { buildApidoc } from './build-apidoc.mjs';
import { buildExamples } from './build-examples.mjs';
import { buildStaticSite } from './build-static-site.mjs';
import { buildTutorials } from './build-tutorials.mjs';
import { createStaticServer } from './serve.mjs';
import { log, logError, logOk, logWarning } from './utils.mjs';

const baseDir = dirname(fileURLToPath(import.meta.url));

export const defaultParameters = {
    output: path.join(baseDir, '..', 'build', 'site'),
};

async function buildRelease(parameters, releaseName) {
    log('site', chalk.bold(`Building release ${releaseName}...`));
    await buildApidoc({
        output: path.join(parameters.output, releaseName, 'apidoc'),
        releaseName,
    });
    await buildExamples({
        output: path.join(parameters.output, releaseName, 'examples'),
        mode: 'production',
        releaseName,
    });
    await buildTutorials({
        output: path.join(parameters.output, releaseName, 'tutorials'),
        releaseName,
    });
    logOk('site', chalk.bold(`Built release ${releaseName}`));
}

async function buildWebsite(parameters) {
    await buildStaticSite({
        output: parameters.output,
        releaseName: parameters.useNext ? 'next' : 'latest',
    });

    if (parameters.buildLatest) {
        await buildRelease(parameters, 'latest');
    }

    if (parameters.buildNext) {
        await buildRelease(parameters, 'next');
    }
}

if (esMain(import.meta)) {
    program
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('--build-next', 'Build as next version', false)
        .option('--build-latest', 'Build as latest version', false)
        .option('--use-next', 'Use next version for static site', false)
        .option('-w, --watch', 'Serve and watch for modifications', false);

    program.parse();

    const { watch, ...options } = program.opts();
    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    if (!options.buildNext && !options.buildLatest) {
        logError('site', 'Nothing to build, --build-next and/or --build-latest must be specified');
        process.exit(1);
    }
    if (!options.buildNext && options.useNext) {
        logWarning('site', 'next version is used for static site, but is not being built');
    }
    if (!options.buildLatest && !options.useNext) {
        logWarning('site', 'latest version is used for static site, but is not being built');
    }

    await buildWebsite(options);
    if (watch) {
        await createStaticServer(options.output);
    }
}
