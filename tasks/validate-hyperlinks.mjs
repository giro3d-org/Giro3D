/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { program } from 'commander';
import esMain from 'es-main';
import fse from 'fs-extra';
import { globIterateSync } from 'glob';
import jsdom from 'jsdom';
import path from 'path';
import { exit } from 'process';

import { logError, logOk } from './utils.mjs';

const MODULE = 'validate-hyperlinks';

const excludedFolders = ['classes/external', 'next/'];
const hrefFilter = ['about:blank', 'mailto'];

let exitWithError = false;

/** @type {Record<string, boolean>} */
const visitedLinks = {};

function checkPath(uri, relativeLink, emitterPath) {
    const filename = uri.toString().replace('file://', '').replace(uri.hash, '').trim();

    let exists;
    if (visitedLinks[filename] === undefined) {
        exists = fse.existsSync(filename);
        visitedLinks[filename] = exists;
    } else {
        exists = visitedLinks[filename];
    }

    if (!exists) {
        exitWithError = true;
        logError(MODULE, `${emitterPath}: broken link -> ${relativeLink}`);
    }
}

const redirects = [
    { before: '/examples/', after: '/latest/examples/' },
    { before: '/tutorials/', after: '/latest/tutorials/' },
    { before: '/apidoc/', after: '/latest/apidoc/' },
];

/**
 * @param {string} uri
 */
function removeLeadingSlash(uri) {
    if (uri.startsWith('/')) {
        return uri.substring(1);
    }
    return uri;
}

/**
 * @param {string} uri
 */
function applyRedirects(uri) {
    for (const rule of redirects) {
        if (uri.startsWith(rule.before)) {
            return uri.replace(rule.before, rule.after);
        }
    }

    return uri;
}

/**
 * @param {string} href
 * @param {string} relativePath
 * @param {string} siteRoot
 */
function validateRootLink(href, relativePath, siteRoot) {
    if (hrefFilter.some(x => href.includes(x))) {
        return;
    }

    let sanitized = applyRedirects(href);
    sanitized = removeLeadingSlash(sanitized);
    const uri = new URL(sanitized, `file://${siteRoot}/`);

    checkPath(uri, href, relativePath);
}

/**
 * @param {string} href
 * @param {string} emitterAbsolutePath
 * @param {string} relativePath
 */
function validateRelativeLink(href, emitterAbsolutePath, relativePath) {
    const uri = new URL(href, `file://${emitterAbsolutePath}`);

    checkPath(uri, href, relativePath);
}

function processHtmlFile(absolutePath, relativePath, siteRoot) {
    const html = fse.readFileSync(absolutePath, { encoding: 'utf-8' });
    const dom = new jsdom.JSDOM(html);

    const anchors = dom.window.document.querySelectorAll('a');

    for (const anchor of anchors) {
        if (anchor.href.length > 0 && !anchor.href.includes('://')) {
            if (hrefFilter.some(x => anchor.href.includes(x))) {
                continue;
            }

            if (anchor.href.startsWith('/')) {
                validateRootLink(anchor.href, relativePath, siteRoot);
            } else {
                validateRelativeLink(anchor.href, absolutePath, relativePath);
            }
        }
    }
}

/**
 * If running this module directly, read the config file, call the main
 * function, and write the output file.
 */
if (esMain(import.meta)) {
    program.option('-i, --input <directory>', 'Root directory to scan for HTML files');

    program.parse();

    const options = program.opts();

    const pwd = process.cwd();

    const rootDirectory = path.resolve(pwd, options.input);

    for (const item of globIterateSync('**/*.html', { cwd: rootDirectory })) {
        const pathToHtml = path.resolve(rootDirectory, item);

        if (!excludedFolders.some(x => pathToHtml.includes(x))) {
            processHtmlFile(pathToHtml, item, rootDirectory);
        }
    }

    if (exitWithError) {
        logError('Broken links were found in the generated website.');
        exit(1);
    } else {
        logOk('No broken links found');
        exit(0);
    }
}
