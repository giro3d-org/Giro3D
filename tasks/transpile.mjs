/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import esMain from 'es-main';
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

import { log, logOk, logError } from './utils.mjs';
import { inlineGlslAndJsonImports } from './inline-imports.mjs';

/**
 * Transpiles TypeScript files from src to build/giro3d using esbuild.
 * This replaces the Babel-based transpilation.
 */
async function transpile() {
    const startTime = Date.now();
    log('transpile', 'Starting transpilation...');

    try {
        // Clean and create build directory
        const buildDir = path.resolve('build/giro3d');
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildDir, { recursive: true });

        // Copy src to build/giro3d/src (for non-JS files and .ts files)
        // This matches the original Babel behavior
        const srcDir = path.resolve('src');
        const buildSrcDir = path.resolve(buildDir, 'src');
        copyDirectory(srcDir, buildSrcDir);

        // Find all TypeScript files
        const tsFiles = globSync('src/**/*.ts', { absolute: true });

        if (tsFiles.length === 0) {
            logError('transpile', 'No TypeScript files found');
            return;
        }

        log('transpile', `Found ${tsFiles.length} TypeScript files to transpile`);

        // Transpile each file individually to preserve the directory structure
        // Output .js files to build/giro3d/ (not build/giro3d/src/)
        await Promise.all(
            tsFiles.map(async file => {
                const relativePath = path.relative('src', file);
                const outFile = path.join(buildDir, relativePath.replace(/\.ts$/, '.js'));

                // Ensure output directory exists
                fs.mkdirSync(path.dirname(outFile), { recursive: true });

                try {
                    // Preprocess to inline GLSL and JSON imports
                    const processedContent = inlineGlslAndJsonImports(file);

                    // Write the preprocessed content to a temp file
                    const tempFile = `${file}.tmp`;
                    fs.writeFileSync(tempFile, processedContent, 'utf8');

                    // Transpile with esbuild
                    await esbuild.build({
                        entryPoints: [tempFile],
                        outfile: outFile,
                        format: 'esm',
                        target: 'es2020',
                        platform: 'browser',
                        bundle: false,
                        minify: false,
                        sourcemap: false,
                        loader: {
                            '.ts': 'ts',
                            '.tmp': 'ts',
                        },
                        packages: 'external',
                    });

                    // Clean up temp file
                    fs.unlinkSync(tempFile);
                } catch (error) {
                    logError('transpile', `Failed to transpile ${file}: ${error.message}`);
                    throw error;
                }
            }),
        );

        // Copy .d.ts files to build/giro3d/ (not build/giro3d/src/)
        copyTypeDeclarationFiles(srcDir, buildDir);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logOk('transpile', `Transpilation completed in ${elapsed}s`);
    } catch (error) {
        logError('transpile', `Transpilation failed: ${error.message}`);
        console.error(error);
        process.exitCode = 1;
    }
}

/**
 * Copy non-TypeScript files from src to build/src.
 */
function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Copy .d.ts files from src to build.
 */
function copyTypeDeclarationFiles(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyTypeDeclarationFiles(srcPath, destPath);
        } else if (srcPath.endsWith('.d.ts')) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Run as main or export
if (esMain(import.meta)) {
    transpile().catch(() => (process.exitCode = 1));
}

export { transpile };
