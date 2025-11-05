/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import esMain from 'es-main';
import { globSync } from 'glob';
import { basename } from 'path';
import { exit } from 'process';

import { logError, logOk } from './utils.mjs';

const regex = /^[a-z_\d]+$/;

const MODULE_NAME = 'check-folders';

/**
 * Check that folders are in lowercase.
 */
async function main() {
    const args = process.argv;

    let error = 0;
    for (const folder of args.slice(2)) {
        const dirs = globSync(`${folder}/**/`);

        for (const dir of dirs) {
            const dirname = basename(dir);
            if (!regex.test(dirname)) {
                error++;
                logError(MODULE_NAME, `invalid directory name: ${dir}`);
            }
        }
    }
    if (error > 0) {
        exit(1);
    } else {
        logOk(MODULE_NAME, 'no issue with directory names');
        exit(0);
    }
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
