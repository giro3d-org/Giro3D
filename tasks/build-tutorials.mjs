/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import chokidar from 'chokidar';
import { program } from 'commander';
import docco from 'docco-next';
import ejs from 'ejs';
import esMain from 'es-main';
import fse from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { parseCss, parseExample } from './build-examples.mjs';
import { getPackageVersion } from './prepare-package.mjs';
import { createStaticServer } from './serve.mjs';
import { log, logOk, logWatched } from './utils.mjs';

const baseDir = dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(baseDir, '..');
const examplesDir = path.join(rootDir, 'examples');
const siteDir = path.join(rootDir, 'site');
const templatesDir = path.join(siteDir, 'templates');
const tmpDir = path.join(rootDir, 'build', '.cache', 'docco');

// List of tutorials to build (i.e. files in the examples folder)
export const TUTORIALS = {
    'getting-started.js': {
        name: 'Getting started',
        title: 'Getting started',
    },
};

export const defaultParameters = {
    output: path.join(rootDir, 'build', 'site', 'next', 'tutorials'),
    version: undefined,
    releaseName: 'next',
    clean: true,
};

export async function cleanTutorials(parameters) {
    log('tutorials', 'Cleaning output directory...');
    fse.removeSync(parameters.output);
}

export async function buildTutorials(parameters) {
    const pwd = process.cwd();

    fse.mkdirpSync(tmpDir);
    const relativeOutput = path.relative(pwd, examplesDir);
    if (
        relativeOutput.startsWith('.') ||
        relativeOutput.startsWith('/') ||
        relativeOutput.startsWith('\\')
    ) {
        // Might have side-effects and I don't want to spend too much time testing, so disable it
        throw new Error(
            'examples directory is not a subdirectory of the current working directory; this is not supported',
        );
    }

    if (!parameters.version) {
        parameters.version = await getPackageVersion();
    }

    log('tutorials', `Building ${Object.keys(TUTORIALS).length} tutorials...`);
    // We actually generate new EJS templates 🤯
    await docco.run([
        '-css',
        path.join(siteDir, 'docco.css'),
        '-s',
        'github-light',
        '-l',
        'parallel',
        '-t',
        path.join(templatesDir, 'tutorial.ejs'),
        '--output',
        tmpDir,
        ...Object.keys(TUTORIALS).map(t => `${relativeOutput}/${t}`),
    ]);

    for (const [jsFilename, metadata] of Object.entries(TUTORIALS)) {
        log('tutorials', `Building ${jsFilename}...`);
        const htmlFilename = jsFilename.replace('.js', '.html');
        const pathToHtmlFile = path.join(examplesDir, htmlFilename);

        const name = path.parse(pathToHtmlFile).name;
        const { attributes, body } = parseExample(pathToHtmlFile);
        const customCss = parseCss(pathToHtmlFile);

        const variables = {
            content: body.trim(),
            customcss: customCss,
            example_name: attributes.title,
            name: name,
            title: attributes.title,
            description: attributes.shortdesc,
            long_description: attributes.longdesc ?? '',
            attribution: attributes.attribution ?? '',
            js: jsFilename,
            releaseName: parameters.releaseName,
            releaseVersion: parameters.version,
            ...metadata,
        };

        const template = ejs.compile(
            fse.readFileSync(path.join(tmpDir, relativeOutput, htmlFilename), 'utf-8'),
            {
                htmlFilename,
                root: rootDir,
                views: [templatesDir],
            },
        );

        const content = template(variables);
        fse.outputFileSync(path.join(parameters.output, htmlFilename), content);
    }

    fse.copyFileSync(path.join(siteDir, 'docco.css'), path.join(parameters.output, 'docco.css'));
    if (!fse.pathExistsSync(path.join(parameters.output, 'public'))) {
        fse.moveSync(path.join(tmpDir, 'public'), path.join(parameters.output, 'public'));
    }
    logOk('tutorials', `Built tutorials at ${parameters.output}`);
}

async function handleModification(parameters, sourceFile) {
    logWatched('tutorials', path.basename(sourceFile));
    await buildTutorials(parameters);
}

async function watchTutorials(parameters) {
    chokidar
        .watch([
            // docco might have some cache; watching on the template does not work
            // path.join(parameters.templates, 'tutorial.ejs'),
            ...Object.keys(TUTORIALS).map(jsFileName => path.join(examplesDir, jsFileName)),
            ...Object.keys(TUTORIALS).map(jsFileName =>
                path.join(examplesDir, jsFileName.replace('.js', '.html')),
            ),
            ...Object.keys(TUTORIALS)
                .map(jsFileName => path.join(examplesDir, jsFileName.replace('.js', '.css')))
                .filter(path => fse.existsSync(path)),
        ])
        .on('change', p => handleModification(parameters, p));
}

async function serveTutorials(parameters) {
    await watchTutorials(parameters);
    log('tutorials', 'Starting server...');
    return createStaticServer(path.join(parameters.output), path.join(parameters.output, '..'), [
        {
            // Here we hack a bit HTTP: we expect the tutorial to fetch 'http://localhost:8080/../examples'
            // which redirects to 'http://localhost:8080/examples'
            directory: path.join(parameters.output, '..', 'examples'),
            publicPath: '/examples/',
        },
    ]);
}

if (esMain(import.meta)) {
    program
        .option('-o, --output <directory>', 'Output directory', defaultParameters.output)
        .option('-c, --clean', 'Clean output directory', defaultParameters.clean)
        .option('--no-clean', "Don't clean")
        .option('-v, --version <version>', 'Version', defaultParameters.version)
        .option(
            '-r, --release-name <version>',
            'Published version (latest, next, ...)',
            defaultParameters.releaseName,
        )
        .option('-w, --watch', 'Serve and watch for modifications', false);

    program.parse();

    const { watch, clean, ...options } = program.opts();
    const pwd = process.cwd();
    options.output = path.resolve(pwd, options.output);

    if (clean) {
        await cleanTutorials(options);
    }

    await buildTutorials(options);
    if (watch) {
        await serveTutorials(options);
    }
}
