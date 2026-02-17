/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import chalk from 'chalk';

/**
 * @param {string} module
 * @param {unknown} output
 */
export function log(module, output) {
    console.log(chalk.blue(`[${module}]`) + ' ' + output);
}

/**
 * @param {string} module
 * @param {unknown} output
 */
export function logOk(module, output) {
    console.log(chalk.blue(`[${module}]`) + ' ' + chalk.green(output));
}

/**
 * @param {string} module
 * @param {unknown} output
 */
export function logWarning(module, output) {
    console.warn(chalk.blue(`[${module}]`) + ' ' + chalk.yellow(output));
}

/**
 * @param {string} module
 * @param {unknown} output
 */
export function logError(module, output) {
    console.error(chalk.blue(`[${module}]`) + ' ' + chalk.red(output));
}

/**
 * @param {string} module
 * @param {string} file
 */
export function logWatched(module, file) {
    console.log('\n' + chalk.blue(`[${module}]`) + ' ' + chalk.magenta(`Modified: ${file}`));
}
