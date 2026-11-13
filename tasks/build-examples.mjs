/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import chokidar from 'chokidar';
import { program } from 'commander';
import ejs from 'ejs';
import esMain from 'es-main';
import frontMatter from 'front-matter';
import fse from 'fs-extra';
import path, { dirname } from 'path';
import * as shiki from 'shiki';
import * as oxfmt from 'oxfmt';
import { fileURLToPath } from 'url';
import { build, createServer } from 'vite';
import { defineConfig } from 'vite';

import { handleModification } from '../observer.mjs';
import { copyAssets } from './build-static-site.mjs';
import { getPackageVersion } from './prepare-package.mjs';
import { log, logError, logOk } from './utils.mjs';

const baseDir = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(baseDir, '..');
const examplesDir = path.join(rootDir, 'examples');
const templatesDir = path.join(rootDir, 'site', 'templates');
const giro3dPackageDir = path.join(rootDir, 'build', 'giro3d');

export const defaultParameters = {
    output: path.join(rootDir, 'build', 'site', 'examples'),
    version: undefined,
    mode: 'production',
    clean: true,
    example: undefined,
};

const relativeImportRegex = /\.\.\/src/;

let exampleId = 0;

// We now need a vite.config.js because the config-less examples fail to build
// some dependencies that require a recent target.
const viteConfigCode = `
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
`;

export function parseExample(pathToHtmlFile) {
    const html = fse.readFileSync(pathToHtmlFile, 'utf-8');

    const { attributes, body } = frontMatter(html);

    if (!attributes.title) {
        throw new Error(`${pathToHtmlFile}: missing <title> YAML attribute`);
    }
    if (!attributes.shortdesc) {
        throw new Error(`${pathToHtmlFile}: missing <shortdesc> YAML attribute`);
    }

    return { attributes, body };
}

export function parseCss(pathToHtmlFile) {
    let customCss = '';
    const pathToCssFile = pathToHtmlFile.replace('.html', '.css');
    if (fse.existsSync(pathToCssFile)) {
        const cssStyle = fse.readFileSync(pathToCssFile, 'utf-8');
        customCss = '<style>\n' + cssStyle.trim() + '\n</style>';
    }
    return customCss;
}

function getExampleCard(pathToHtmlFile) {
    const name = path.parse(pathToHtmlFile).name;
    const { attributes } = parseExample(pathToHtmlFile);
    exampleId++;
    return {
        title: attributes.title,
        description: attributes.shortdesc,
        tags: attributes.tags,
        id: exampleId,
        searchtext: `${attributes.title} ${attributes.shortdesc} ${attributes.tags?.join(' ')}`,
        name,
    };
}

function validateExample(pathToHtmlFile) {
    const jsFile = pathToHtmlFile.replace('.html', '.js');
    const js = fse.readFileSync(jsFile, 'utf-8');
    if (relativeImportRegex.test(js)) {
        const filename = path.basename(jsFile);
        throw new Error(
            `${filename}: relative import path detected. Use absolute path in the form @giro3d\\giro3d`,
        );
    }
}

function readTemplate(templateFilename) {
    const template = path.join(templatesDir, templateFilename);
    return ejs.compile(fse.readFileSync(template, 'utf-8'), {
        templateFilename,
        root: rootDir,
        views: [templatesDir],
    });
}

export function getExamplesFiles(parameters) {
    const filter = name => {
        if (parameters.example === undefined) {
            return true;
        }

        return parameters.example === name.replace('.html', '');
    };

    const htmlFiles = fse
        .readdirSync(examplesDir)
        .filter(f => f.endsWith('.html') && f !== 'index.html' && filter(f))
        .map(f => path.resolve(examplesDir, f));

    htmlFiles.forEach(f => validateExample(f));
    return htmlFiles;
}

export function findExamples() {
    return fse
        .readdirSync(examplesDir)
        .filter(name => name.endsWith('.html'))
        .map(name => name.replace(/\.html$/, ''))
        .filter(example => {
            const jsFile = `${example}.js`;
            return fse.existsSync(path.join(examplesDir, jsFile));
        });
}

// Having underscores or special characters in examples
// names would be a bad practice that hurts SEO.
const exampleNameValidator = new RegExp(/^[a-z0-9-]+$/, 'm');

export function findExamplesEntries(parameters) {
    const entry = {};

    if (parameters.example) {
        log('examples', `Will build only example "${parameters.example}"`);
    }

    const examples = findExamples(examplesDir);
    examples.forEach(example => {
        if (!exampleNameValidator.test(example)) {
            logError(
                'examples',
                `Invalid example name: "${example}". Expected only lowercase letters, numbers and hyphens.`,
            );
        }
        const thumbnail = path.join(examplesDir, 'screenshots', `${example}.webp`);
        if (!fse.existsSync(thumbnail)) {
            logError('examples', `Missing thumbnail: ${example}.webp`);
        }

        if (parameters.example === undefined || parameters.example === example) {
            const jsFile = `${example}.js`;
            // Use relative path from examplesDir for Vite to resolve correctly
            entry[example] = path.join(examplesDir, jsFile);
        }
    });
    return entry;
}

export async function generateIndex(htmlFiles, parameters) {
    const thumbnails = htmlFiles.map(f => getExampleCard(f));

    log('examples', `Generating ${thumbnails.length} examples...`);

    const indexHtmlTemplate = readTemplate('index.ejs');
    const indexHtmlContent = indexHtmlTemplate({
        title: `Examples (${parameters.version})`,
        name: `Examples (${parameters.version})`,
        description: parameters.name,
        examples: thumbnails,
        releaseVersion: parameters.version,
    });
    return indexHtmlContent;
}

export async function generateExample(htmlFile, parameters) {
    const htmlFilename = path.basename(htmlFile);
    const jsFilename = htmlFilename.replace('.html', '.js');

    const jsFile = htmlFile.replace('.html', '.js');

    const jsContent = await fse.readFile(jsFile, 'utf-8');

    // In dev mode, use absolute path to JS file from examples directory
    // This allows Vite to resolve imports correctly
    const jsPath = parameters.mode === 'development' ? `/examples/${jsFilename}` : jsFilename;

    const name = path.parse(htmlFile).name;
    const { attributes, body: htmlCustomContent } = parseExample(htmlFile);
    const cssContent = parseCss(htmlFile);

    const giro3dVersion = parameters.version.includes('-dev')
        ? 'git+https://gitlab.com/giro3d/giro3d.git' // Not packaged yet, set git repo
        : parameters.version.substring(1); // Remove "v"

    const variables = {
        content: htmlCustomContent.trim(),
        customcss: cssContent,
        example_name: attributes.title,
        name: name,
        giro3d_version: giro3dVersion,
        title: attributes.title,
        description: attributes.shortdesc,
        long_description: attributes.longdesc ?? '',
        attribution: attributes.attribution ?? '',
        js: jsFilename,
        highlightedJsCode: undefined,
        highlightedHtmlCode: undefined,
        highlightedPackageCode: undefined,
        releaseVersion: parameters.version,
        dependencies: attributes.dependencies,
    };

    if (parameters.mode === 'production') {
        const htmlCodeTemplate = readTemplate('published_html.ejs');

        let htmlCode = htmlCodeTemplate(variables);

        htmlCode = (await oxfmt.format('index.html', htmlCode)).code;

        const packageJson = generatePackageJsonContent(variables).trim();

        let sourceCode = jsContent
            .replaceAll(/import StatusBar from.*\n/gi, '') // Remove StatusBar code that would not
            .replaceAll(/StatusBar\.bind[^;]*;/gim, ''); // work out of the box (requires HTML code)

        sourceCode = inlineImports(sourceCode);

        sourceCode = sourceCode
            .replaceAll(/\/\*\*.*?\*\//gs, '') // remove JSDoc comments
            .replaceAll(/^.*\/\/\s*@ts.*$/gim, ''); // Remove typescript-related comments

        // Format the code
        sourceCode = (await oxfmt.format('index.js', sourceCode)).code;

        variables['highlightedJsCode'] = await shiki.codeToHtml(sourceCode, {
            theme: 'github-light',
            lang: 'js',
        });
        variables['highlightedHtmlCode'] = await shiki.codeToHtml(htmlCode, {
            theme: 'github-light',
            lang: 'html',
        });
        variables['highlightedPackageCode'] = await shiki.codeToHtml(packageJson, {
            theme: 'github-light',
            lang: 'json',
        });
        variables['viteConfigCode'] = await shiki.codeToHtml(viteConfigCode.trim(), {
            theme: 'github-light',
            lang: 'js',
        });
    }

    const htmlTemplate = readTemplate(
        parameters.mode === 'production' ? 'example.ejs' : 'example-dev.ejs',
    );
    const htmlContent = htmlTemplate(variables);

    return htmlContent;
}

/**
 * @param {string} sourceCode
 * @returns {string}
 */
function inlineImports(sourceCode) {
    function inline(filename) {
        let content = fse.readFileSync(path.join(examplesDir, 'widgets', filename), 'utf-8');

        // Since it is inlined, we need to get rid of the export keyword
        content = content.replace('export function', 'function');

        // Let's remove imports, otherwise they would appear multiple
        // times or right in the middle of the source code.
        // The drawback is that the source code must provide those imports,
        // even if they appear unused.
        content = content.replace(/import .*?;/gs, '');

        content = content.trim() + '\n';

        return content;
    }

    return sourceCode.replace(/import .*? from '.\/widgets\/(\w+.js)';/g, (_, filename) =>
        inline(filename),
    );
}

/**
 * @param {string} list
 * @return {Record<string, string>} For each dependency name, the version found in the root package.json
 */
function parseDependencyList(list) {
    const result = {};

    const filename = path.join(rootDir, 'package.json');
    const projectPackageJson = JSON.parse(fse.readFileSync(filename, 'utf-8'));

    function findVersion(packageName) {
        return (
            projectPackageJson['dependencies'][packageName] ??
            projectPackageJson['peerDependencies'][packageName] ??
            projectPackageJson['devDependencies'][packageName]
        );
    }

    if (list) {
        // Dependency names might have [double] quotes to make them compatible with YAML
        // headers (the @ sign must be quoted for example), let's clean them.
        const names = list.map(chunk => chunk.trim().replace(/'/g, '').replace(/"/g, ''));

        for (const name of names) {
            result[name] = findVersion(name);
        }
    }

    return result;
}

function generatePackageJsonContent(parameters) {
    const dependencies = parseDependencyList(parameters.dependencies);

    const content = {
        name: parameters.name,
        dependencies: {
            ...dependencies,
            '@giro3d/giro3d': parameters.giro3d_version,
        },
        devDependencies: {
            vite: '^3.2.3',
        },
        scripts: {
            start: 'vite',
            build: 'vite build',
        },
    };

    const INDENT = 4;
    return JSON.stringify(content, null, INDENT);
}

/**
 * Prepare output directory with HTML files and static assets
 */
async function prepareOutputDirectory(parameters, htmlFiles) {
    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    // Create output directory
    if (parameters.clean) {
        fse.removeSync(parameters.output);
    }
    fse.ensureDirSync(parameters.output);

    if (!fse.existsSync(path.join(parameters.output, '..', '..', 'assets'))) {
        await copyAssets({
            output: path.join(parameters.output, '..', '..'),
        });
    }

    // Generate index.html
    const indexHtml = await generateIndex(htmlFiles, parameters);
    fse.writeFileSync(path.join(parameters.output, 'index.html'), indexHtml);

    // Generate each example HTML file
    for (const htmlFile of htmlFiles) {
        const htmlContent = await generateExample(htmlFile, parameters);
        const outputName = path.basename(htmlFile);
        fse.writeFileSync(path.join(parameters.output, outputName), htmlContent);
    }

    // Copy static assets
    const staticDirs = ['css', 'image', 'screenshots', 'data'];
    for (const dir of staticDirs) {
        const src = path.join(examplesDir, dir);
        if (fse.existsSync(src)) {
            fse.copySync(src, path.join(parameters.output, dir));
        }
    }

    // Copy index.js if it exists
    const indexJs = path.join(examplesDir, 'index.js');
    if (fse.existsSync(indexJs)) {
        fse.copySync(indexJs, path.join(parameters.output, 'index.js'));
    }
}

export async function getViteConfig(parameters, htmlFiles = null) {
    log('examples', 'Generating Vite configuration...');
    const entry = findExamplesEntries(parameters);

    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    // If htmlFiles not provided, get them
    if (!htmlFiles) {
        htmlFiles = getExamplesFiles(parameters);
    }
    await prepareOutputDirectory(parameters, htmlFiles);

    /** @type {import('vite').UserConfig} */
    const viteConfig = defineConfig({
        mode: parameters.mode,
        resolve: {
            alias: {
                '@giro3d/giro3d': giro3dPackageDir,
            },
        },
        build: {
            // In production: output to parameters.output
            // In development: output to a temp directory (dev mode uses dev server, not build)
            outDir:
                parameters.mode === 'production'
                    ? parameters.output
                    : path.join(rootDir, 'build', '.vite-dev'),
            emptyOutDir: parameters.mode === 'production' ? false : true,
            rollupOptions: {
                input: entry,
                output: {
                    entryFileNames: '[name].js',
                    assetFileNames: 'assets/[name].[ext]',
                },
                // Suppress warnings about direct eval in third-party dependencies
                onwarn(warning, defaultHandler) {
                    // EVAL warnings from third-party libraries (like three.js/lottie) are expected
                    // and don't affect functionality, so we suppress them
                    if (warning.code === 'EVAL') {
                        return;
                    }
                    defaultHandler(warning);
                },
            },
            target: 'es2020',
            minify: parameters.mode === 'production',
            sourcemap: parameters.mode === 'development',
        },
        optimizeDeps: {
            // Pre-bundle common dependencies for better performance
            include: [
                'three',
                'ol',
                '3d-tiles-renderer',
                'camera-controls',
                'copc',
                'geotiff',
                'earcut',
                'lil-gui',
                'lru-cache',
                'wkt-parser',
            ],
            esbuildOptions: {
                target: 'es2020',
            },
        },
        logLevel: 'info',
    });

    logOk('examples', `Found ${Object.keys(entry).length} example(s)`);
    return viteConfig;
}

export async function cleanExamples(parameters) {
    log('examples', 'Cleaning output directory...');
    fse.removeSync(parameters.output);
}

export async function buildExamples(parameters) {
    const viteConfig = await getViteConfig(parameters);

    try {
        log('examples', 'Building with Vite...');
        await build(viteConfig);
        logOk('examples', `Examples built at ${parameters.output}`);
    } catch (err) {
        logError('examples', `Build failed: ${err.message}`);
        throw err;
    }
}

export async function watchExamples() {
    const sourceFolder = path.join(rootDir, 'src');

    chokidar
        .watch(sourceFolder)
        .on('change', p => handleModification(p, sourceFolder, giro3dPackageDir));
}

export async function serveExamples(parameters) {
    const htmlFiles = getExamplesFiles(parameters);

    // In dev mode, prepare the output directory for static assets
    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    if (parameters.clean) {
        fse.removeSync(parameters.output);
    }
    fse.ensureDirSync(parameters.output);

    // Copy parent assets if needed
    if (!fse.existsSync(path.join(parameters.output, '..', '..', 'assets'))) {
        await copyAssets({
            output: path.join(parameters.output, '..', '..'),
        });
    }

    // Copy static assets that are needed for examples
    const staticDirs = ['css', 'image', 'screenshots', 'data'];
    for (const dir of staticDirs) {
        const src = path.join(examplesDir, dir);
        if (fse.existsSync(src)) {
            fse.copySync(src, path.join(parameters.output, dir));
        }
    }

    // Generate HTML files to output directory
    // We'll also copy JS files there for Vite to serve

    // Generate index.html (gallery page)
    const indexHtml = await generateIndex(htmlFiles, parameters);
    fse.writeFileSync(path.join(parameters.output, 'index.html'), indexHtml);

    // Generate HTML files for the examples we're serving
    for (const htmlFile of htmlFiles) {
        const htmlContent = await generateExample(htmlFile, parameters);
        const outputName = path.basename(htmlFile);
        const outputPath = path.join(parameters.output, outputName);
        fse.writeFileSync(outputPath, htmlContent);
    }

    // Build entry points map for Vite
    const entry = {};
    htmlFiles.forEach(htmlFile => {
        const name = path.parse(htmlFile).name;
        const jsFile = path.join(examplesDir, `${name}.js`);
        if (fse.existsSync(jsFile)) {
            entry[name] = jsFile;
        }
    });

    // Create server with additional configuration for development
    // We set root to output directory where the HTML files are
    const server = await createServer({
        mode: parameters.mode,
        resolve: {
            alias: {
                '@giro3d/giro3d': giro3dPackageDir,
            },
        },
        root: parameters.output,
        server: {
            fs: {
                // Allow serving files from output dir (HTML/JS), examples dir (source JS), and root
                allow: [parameters.output, examplesDir, rootDir],
            },
            host: true,
            port: 8080,
        },
        appType: 'mpa', // Multi-page application mode
        build: {
            outDir: path.join(rootDir, 'build', '.vite-dev'),
            emptyOutDir: true,
            rollupOptions: {
                input: entry,
                output: {
                    entryFileNames: '[name].js',
                    assetFileNames: 'assets/[name].[ext]',
                },
                onwarn(warning, defaultHandler) {
                    if (warning.code === 'EVAL') {
                        return;
                    }
                    defaultHandler(warning);
                },
            },
            target: 'es2020',
            minify: false,
            sourcemap: true,
        },
        optimizeDeps: {
            include: [
                'three',
                'ol',
                '3d-tiles-renderer',
                'camera-controls',
                'copc',
                'geotiff',
                'earcut',
                'lil-gui',
                'lru-cache',
                'wkt-parser',
            ],
            esbuildOptions: {
                target: 'es2020',
            },
        },
        logLevel: 'info',
    });

    const port = server.config.server.port;
    const protocol = server.config.server.https ? 'https' : 'http';

    await server.listen();
    log('examples', `Server running at ${protocol}://localhost:${port}`);

    // Watch for source changes
    watchExamples();

    // Keep the process alive while the server is running
    // Using setInterval to prevent the event loop from blocking
    setInterval(() => {}, 10000);
    await new Promise(() => {});
}

/**
 * If running this module directly, read the config file, call the main
 * function, and write the output file.
 */
if (esMain(import.meta)) {
    program
        .argument('[example]', 'Build a specific example', defaultParameters.example)
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('-c, --clean', 'Clean output directory', defaultParameters.clean)
        .option('--no-clean', "Don't clean")
        .option('--mode <environment>', 'Environment', defaultParameters.mode)
        .option('-v, --version <version>', 'Version', defaultParameters.version)
        .option('-w, --watch', 'Serve and watch for modifications', false);

    const cmd = program.parse();

    const { watch, clean, ...options } = program.opts();

    if (cmd.processedArgs.length > 0) {
        options.example = cmd.processedArgs[0];
    }

    // Also check for EXAMPLE environment variable
    if (process.env.EXAMPLE && !options.example) {
        options.example = process.env.EXAMPLE;
    }

    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    if (clean) {
        await cleanExamples(options);
    }

    if (watch) {
        await serveExamples(options);
    } else {
        await buildExamples(options);
    }
}
