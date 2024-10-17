import esMain from 'es-main';
import { globSync } from 'glob';
import { exit } from 'process';

async function main() {
    const args = process.argv;

    for (const folder of args.slice(2)) {
        const dirs = globSync(`${folder}/**/[A-Z]*/`, {});

        if (dirs && dirs.length > 0) {
            for (const invalid of dirs) {
                console.error(`invalid directory name: ${invalid}`);
            }
            exit(1);
        }
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
