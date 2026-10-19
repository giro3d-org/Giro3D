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
    version: undefined,
};

async function buildRelease(parameters) {
    const { output, ...options } = parameters;

    log('site', chalk.bold(`Building site...`));
    await buildApidoc({
        ...options,
        output: path.join(parameters.output, 'apidoc'),
    });
    await buildExamples({
        ...options,
        output: path.join(parameters.output, 'examples'),
        mode: 'production',
    });
    await buildTutorials({
        ...options,
        output: path.join(parameters.output, 'tutorials'),
    });
    logOk('site', chalk.bold(`Built site`));
}

async function buildWebsite(parameters) {
    await buildStaticSite(parameters);
    await buildRelease(parameters);
}

if (esMain(import.meta)) {
    program
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('-v, --version <version>', 'Version', defaultParameters.version)
        .option('-w, --watch', 'Serve and watch for modifications', false);

    program.parse();

    const { watch, ...options } = program.opts();
    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    await buildWebsite(options);
    if (watch) {
        await createStaticServer(options.output);
    }
}
