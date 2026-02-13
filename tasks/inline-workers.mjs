/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import esMain from 'es-main';
import * as esbuild from 'esbuild';
import fs from 'fs';
import { globSync } from 'glob';
import path from 'path';
import { MathUtils } from 'three';

import { log, logOk, logWarning } from './utils.mjs';

function formatBytes(bytes) {
    if (bytes < 2048) {
        return `${bytes} B`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * This task replaces the URLs in Worker constructors by URLs containing the bundled and
 * minified source code of the worker, i.e:
 *
 * ```js
 * new Worker(new URL('./worker.js', import.meta.url))
 * ```
 *
 * becomes
 *
 * ```js
 * new Worker(URL.createObjectURL(new Blob(['<the inlined source code of the worker here>'], {type: "text/javascript"})))
 * ```
 *
 * So that Giro3D's workers work on all bundlers. Indeed, on Vite (using the default configuration),
 * worker creation fails because the worker file is bundled with all the other source files, and
 * thus at runtime, 'worker.js' simply does not exist anymore. By embedding and inlining the source
 * code of the worker directly in the callsite, we ensure this will always work, while still
 * retaining the benefits of bundling.
 *
 * Note: Bundling and minification is done with **esbuild**, as it is very fast (much faster than Webpack).
 *
 * Important note: this task works on the **transpiled files** (i.e babel-processed .js files in
 * build/giro3d), not on the original source files!
 */

const moduleName = 'inline-workers';
// The size of the embedded worker code (in bytes) that we consider a reasonable limit before
// raising a warning. This is to encourage worker authors to make them as small as possible.
// For example, importing a single object from the three.js library will bundle the entire library,
// as this library is not tree-shakeable, making the processed source file unreasonably big.
const chunkLimit = 100 * 1024; // 100 KB
/** @type {Map<string, string>} */
const bundledWorkers = new Map();

/**
 * Processes the source code of a file that creates worker.
 *
 * @param {string} source The entire source code of the file.
 * @param {string} filename The absolute filename to the source file.
 * @returns {string} The updated code with the worker URLs replaced by data URLs.
 */
function processSourceFile(source, filename) {
    let result = source;

    // Captures the URL of a worker.
    const workerCreationUrl = /(?<=new Worker\()\s*new URL\('(.*?)',.*?\)/gms;
    const matches = [...source.matchAll(workerCreationUrl)];

    for (const match of matches) {
        const url = match[1];

        const workerPath = path.join(path.dirname(filename), url);

        // This worker has never been bundled before, let's
        // do it once and put the result into the cache.
        if (!bundledWorkers.has(workerPath)) {
            const tmpPath = path.join(path.dirname(workerPath), MathUtils.generateUUID());

            // We bundle and minify the worker code to a temporary file.
            esbuild.buildSync({
                entryPoints: [workerPath],
                bundle: true,
                minify: true,
                logLevel: 'warning',
                outfile: tmpPath,
            });

            const stat = fs.statSync(tmpPath);
            const relativePath = path.relative(process.cwd(), workerPath);

            if (stat.size > chunkLimit) {
                logWarning(
                    moduleName,
                    `Warning: After bundling and minification, ${relativePath} (${formatBytes(stat.size)}) exceeds the recommended size (${formatBytes(chunkLimit)}).
                    Since the worker code is embedded in every location that creates this worker,
                    we should have workers as small as possible to avoid generating huge files.
                    Hint: three.js is not tree-shakeable, so it should not be imported at all in workers.`,
                );
            } else {
                logOk(moduleName, `bundling ${relativePath} (${formatBytes(stat.size)})`);
            }

            // The temporary file is then read and the source code is
            // put into the cache, then the temporary file is deleted.
            let workerSource = fs.readFileSync(tmpPath, { encoding: 'utf-8' });

            // To ensure that we don't mess unescaped characters,
            // let's encode the source code to base64.
            const b64 = btoa(workerSource);

            bundledWorkers.set(workerPath, b64);
            fs.unlinkSync(tmpPath);
        }

        const workerSource = bundledWorkers.get(workerPath);

        // Note that the Blob contains the decoded base64 source code.
        const dataUrl = `new Blob([atob('${workerSource}')], {type: "text/javascript"})`;
        const replacementValue = `URL.createObjectURL(${dataUrl})`;

        result = result.replaceAll(match[0], replacementValue);
    }

    return result;
}

async function main() {
    const args = process.argv;

    const now = performance.now();

    const buildFolder = args[2];

    const files = globSync(`${buildFolder}/**/*.js`, { absolute: true });

    files.forEach(file => {
        const sourceCode = fs.readFileSync(file, { encoding: 'utf-8' });

        if (/new Worker\(/.test(sourceCode)) {
            log(moduleName, `processing ${path.relative(process.cwd(), file)}`);

            const inlinedSource = processSourceFile(sourceCode, file);
            fs.writeFileSync(file, inlinedSource);
        }
    });

    const s = (performance.now() - now) / 1000;
    logOk(moduleName, `workers inlined successfully in ${s.toFixed(1)} seconds.`);
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
