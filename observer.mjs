/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import * as esbuild from 'esbuild';
import chokidar from 'chokidar';
import esMain from 'es-main';
import fs from 'fs';
import { globSync } from 'glob';
import path from 'path';

import { inlineGlslAndJsonImports } from './tasks/inline-imports.mjs';

function usage() {
    console.log('observer.js <source> <dest>');
}

/**
 * Search Javascript files that inline the provided GLSL file.
 *
 * @param {string} - glslFile The file to search.
 * @param {string} - sourceFolder The path to the source folder.
 * @param {Function} - callback The callback called for each javascript file.
 */
function searchInlinedFiles(glslFile, sourceFolder, callback) {
    const glslFilename = path.basename(glslFile);

    const files = globSync(`${sourceFolder}/**/*.*`);

    files.forEach(file => {
        fs.readFile(file, (err, data) => {
            if (err) {
                console.error(`error while reading ${file}: ${err}`);
            } else if (data.includes(glslFilename)) {
                if (file.endsWith('.glsl')) {
                    // This GLSL is inlined by another GLSL, let's continue searching.
                    searchInlinedFiles(file, sourceFolder, callback);
                } else {
                    callback(file);
                }
            }
        });
    });
}

/**
 * Handle the modification of the specified source file:
 * - If it is a javascript file, it will be transpiled.
 * - If it is a GLSL file, all javascript files that inline this file will be transpiled.
 *
 * @param {string} - sourceFile The modified file.
 * @param {string} - sourceFolder The top-level folder containing the modified file.
 * @param {string} - destFolder The top-level folder to put the transpiled results.
 */
export function handleModification(sourceFile, sourceFolder, destFolder) {
    console.log(); // newline
    console.log(`modified: ${path.basename(sourceFile)}`);

    if (sourceFile.endsWith('.js') || sourceFile.endsWith('.ts')) {
        transpileFile(sourceFile, sourceFolder, destFolder);
    } else if (sourceFile.endsWith('.glsl')) {
        // GLSL files are inlined rather than transpiled.
        // We thus need to look for javascript files that inline this GLSL file
        // and transpile them instead.
        searchInlinedFiles(sourceFile, sourceFolder, js => {
            transpileFile(js, sourceFolder, destFolder);
        });
    }
}

/**
 * Transpile a single TypeScript file using esbuild.
 *
 * @param {string} - sourceFile The file to transpile.
 * @param {string} - sourceFolder The top-level folder containing the modified file.
 * @param {string} - destFolder The top-level folder to put the transpiled file.
 */
function transpileFile(sourceFile, sourceFolder, destFolder) {
    const destFile = sourceFile.replace(sourceFolder, destFolder).replace('.ts', '.js');

    console.log(` - transpiling: ${sourceFile.replace(sourceFolder, '')}`);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(destFile), { recursive: true });

    try {
        // Preprocess to inline GLSL and JSON imports
        const processedContent = inlineGlslAndJsonImports(sourceFile);

        // Write the preprocessed content to a temp file
        const tempFile = `${sourceFile}.tmp`;
        fs.writeFileSync(tempFile, processedContent, 'utf8');

        // Transpile with esbuild
        esbuild.buildSync({
            entryPoints: [tempFile],
            outfile: destFile,
            format: 'esm',
            target: 'es2020',
            platform: 'browser',
            bundle: false,
            minify: false,
            sourcemap: true,
            loader: {
                '.ts': 'ts',
                '.tmp': 'ts',
            },
            packages: 'external',
        });

        console.log(`  -> ${destFile}`);

        // Clean up temp file
        fs.unlinkSync(tempFile);
    } catch (error) {
        console.error(error);
    }
}

function main() {
    // eslint-disable-next-line no-undef
    const args = process.argv;

    if (args.length < 4) {
        usage();
        return 1;
    }

    const sourceFolder = path.resolve(args[2]);
    const destFolder = path.resolve(args[3]);

    console.log(`watching folder ${sourceFolder} -> ${destFolder}`);

    chokidar.watch(sourceFolder).on('change', p => handleModification(p, sourceFolder, destFolder));

    return 0;
}

if (esMain(import.meta)) {
    main();
}
