/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import esMain from 'es-main';
import { globSync } from 'glob';
import { exit } from 'process';

/**
 * Check that folders are in lowercase.
 */
async function main() {
    const args = process.argv;

    let error = 0;
    for (const folder of args.slice(2)) {
        const dirs = globSync(`${folder}/**/`);

        for (const dir of dirs) {
            if (dir.toLocaleLowerCase() !== dir) {
                error++;
                console.error(`invalid directory name: ${dir}`);
            }
        }
    }
    if (error > 0) {
        exit(1);
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
