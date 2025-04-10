import chokidar from 'chokidar';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import { program } from 'commander';
import CopyPlugin from 'copy-webpack-plugin';
import ejs from 'ejs';
import esMain from 'es-main';
import frontMatter from 'front-matter';
import fse from 'fs-extra';
import path, { dirname } from 'path';
import * as prettier from 'prettier';
import * as shiki from 'shiki';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import webpackDevServer from 'webpack-dev-server';

import { handleModification } from '../observer.mjs';
import { copyAssets } from './build-static-site.mjs';
import { getPackageVersion } from './prepare-package.mjs';
import { log, logOk } from './utils.mjs';

const baseDir = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(baseDir, '..');
const examplesDir = path.join(rootDir, 'examples');
const templatesDir = path.join(rootDir, 'site', 'templates');
const giro3dPackageDir = path.join(rootDir, 'build', 'giro3d');

export const defaultParameters = {
    output: path.join(rootDir, 'build', 'site', 'next', 'examples'),
    version: undefined,
    releaseName: 'next',
    mode: 'production',
    clean: true,
    example: undefined,
};

const relativeImportRegex = /\.\.\/src/;

let exampleId = 0;

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
        .filter(f => f.endsWith('.html') && filter(f))
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

export function findExamplesEntries(parameters) {
    const entry = {};

    if (parameters.example) {
        log('examples', `Will build only example "${parameters.example}"`);
    }

    const examples = findExamples(examplesDir);
    examples.forEach(example => {
        if (parameters.example === undefined || parameters.example === example) {
            const jsFile = `${example}.js`;
            entry[example] = [path.join(examplesDir, jsFile)];
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
        releaseName: parameters.releaseName,
        releaseVersion: parameters.version,
    });
    return indexHtmlContent;
}

export async function generateExample(htmlFile, parameters) {
    const htmlFilename = path.basename(htmlFile);
    const jsFilename = htmlFilename.replace('.html', '.js');

    const jsFile = htmlFile.replace('.html', '.js');

    const jsContent = await fse.readFile(jsFile, 'utf-8');

    const name = path.parse(htmlFile).name;
    const { attributes, body: htmlCustomContent } = parseExample(htmlFile);
    const cssContent = parseCss(htmlFile);

    const giro3dVersion =
        parameters.releaseName === 'next'
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
        releaseName: parameters.releaseName,
        releaseVersion: parameters.version,
        dependencies: attributes.dependencies,
    };

    if (parameters.mode === 'production') {
        const htmlCodeTemplate = readTemplate('published_html.ejs');

        let htmlCode = htmlCodeTemplate(variables);

        htmlCode = await prettier.format(htmlCode, { parser: 'html' });

        const packageJson = generatePackageJsonContent(variables).trim();

        let sourceCode = jsContent
            .replaceAll(/import StatusBar from.*\n/gi, '') // Remove StatusBar code that would not
            .replaceAll(/StatusBar\.bind[^;]*;/gim, ''); // work out of the box (requires HTML code)

        sourceCode = inlineImports(sourceCode);

        sourceCode = sourceCode
            .replaceAll(/\/\*\*.*?\*\//gs, '') // remove JSDoc comments
            .replaceAll(/^.*\/\/\s*@ts.*$/gim, ''); // Remove typescript-related comments

        // Format the code with Prettier
        sourceCode = await prettier.format(sourceCode, { parser: 'babel' });

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

export async function getWebpackConfig(parameters) {
    log('examples', 'Generating webpack configuration...');
    const entry = findExamplesEntries(parameters);

    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    if (!fse.existsSync(path.join(parameters.output, '..', '..', 'assets'))) {
        await copyAssets({
            output: path.join(parameters.output, '..', '..'),
        });
    }

    /** @type {webpack.Configuration} */
    const webpackConfig = {
        mode: parameters.mode,
        watchOptions: {
            ignored: /node_modules/,
            poll: false,
        },
        context: examplesDir,
        resolve: {
            alias: { '@giro3d/giro3d': giro3dPackageDir },
        },
        devtool: 'source-map',
        entry,
        target: ['web', 'es5'],
        output: {
            filename: '[name].js',
            clean: true,
            path: parameters.output,
            library: '[name]',
            libraryTarget: 'umd',
            umdNamedDefine: true,
            devtoolModuleFilenameTemplate: 'webpack://[namespace]/[resource-path]?[loaders]',
            devtoolNamespace: 'giro3d',
        },
        optimization: {
            minimize: parameters.mode === 'production',
            splitChunks: {
                minSize: 17000,
                minRemainingSize: 0,
                minChunks: 1,
                maxAsyncRequests: 30,
                maxInitialRequests: 30,
                automaticNameDelimiter: '_',
                enforceSizeThreshold: 30000,
                cacheGroups: {
                    // we are opting out of defaultVendors, so rest of the node modules will be part of default cacheGroup
                    defaultVendors: false,
                    ol: {
                        test: /[\\/]node_modules[\\/]ol[\\/]/,
                        name: '__ol',
                        chunks: 'all',
                        priority: 100,
                    },
                    three: {
                        test: /[\\/]node_modules[\\/]three[\\/]/,
                        name: '__three',
                        chunks: 'all',
                        priority: 100,
                    },
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: '__vendor',
                        chunks: 'all',
                        priority: 10,
                    },
                },
            },
        },
        devServer: {
            hot: true,
            client: {
                progress: true,
                overlay: true,
            },
            static: [
                {
                    directory: path.join(parameters.output, '..', '..', 'assets'),
                    publicPath: '/assets/',
                },
                {
                    directory: path.join(parameters.output, '..', '..', 'images'),
                    publicPath: '/images/',
                },
            ],
        },
        plugins: [
            new CircularDependencyPlugin({
                // exclude detection of files based on a RegExp
                exclude: /node_modules/,
                // add errors to webpack instead of warnings
                failOnError: true,
                // allow import cycles that include an asyncronous import,
                // e.g. via import(/* webpackMode: "weak" */ './file.js')
                allowAsyncCycles: false,
                // set the current working directory for displaying module paths
                cwd: process.cwd(),
            }),
            new CopyPlugin({
                patterns: [
                    {
                        // Don't webpack index.js
                        from: 'index.js',
                        to: 'index.js',
                    },
                    {
                        from: 'index.js',
                        to: 'index.html',
                        transform: (content, from) => {
                            const htmlFiles = getExamplesFiles(parameters);
                            return generateIndex(htmlFiles, parameters);
                        },
                    },
                    {
                        from: '*.html',
                        to: '.',
                        transform: (content, from) => generateExample(from, parameters),
                    },
                    { from: 'css', to: 'css' },
                    { from: 'image', to: 'image' },
                    { from: 'screenshots', to: 'screenshots' },
                    { from: 'data', to: 'data' },
                ],
            }),
        ],
    };

    logOk('examples', `Found ${Object.keys(entry).length} example(s)`);
    return webpackConfig;
}

export async function cleanExamples(parameters) {
    log('examples', 'Cleaning output directory...');
    fse.removeSync(parameters.output);
}

export async function buildExamples(parameters) {
    const webpackConfig = await getWebpackConfig(parameters);
    const compiler = webpack(webpackConfig);

    return new Promise((resolve, reject) => {
        log('examples', 'Generating examples...');
        compiler.run((err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            console.log(stats.toString({ colors: true }));

            compiler.close(closeErr => {
                if (closeErr) {
                    reject(closeErr);
                } else if (stats.hasErrors()) {
                    reject(new Error('Webpack failed'));
                } else {
                    logOk('examples', `Examples built at ${webpackConfig.output.path}`);
                    resolve();
                }
            });
        });
    });
}

export async function watchExamples(parameters) {
    const sourceFolder = path.join(rootDir, 'src');

    chokidar
        .watch(sourceFolder)
        .on('change', p => handleModification(p, sourceFolder, giro3dPackageDir));
}

export async function serveExamples(parameters) {
    await watchExamples(parameters);

    const webpackConfig = await getWebpackConfig(parameters);
    const compiler = webpack(webpackConfig);
    const server = new webpackDevServer(webpackConfig.devServer, compiler);

    log('examples', 'Starting server...');
    return server.start();
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
        .option(
            '-r, --release-name <version>',
            'Published version (latest, next, ...)',
            defaultParameters.releaseName,
        )
        .option('-w, --watch', 'Serve and watch for modifications', false);

    const cmd = program.parse();

    const { watch, clean, ...options } = program.opts();

    if (cmd.processedArgs.length > 0) {
        options.example = cmd.processedArgs[0];
    }

    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    if (clean) {
        await cleanExamples(options);
    }

    await copyAssets({
        output: path.join(options.output, '..'),
    });

    if (watch) {
        await serveExamples(options);
    } else {
        await buildExamples(options);
    }
}
