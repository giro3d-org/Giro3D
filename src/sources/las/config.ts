import { LazPerf } from 'laz-perf';

export const DEFAULT_LAZPERF_PATH = 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.6/lib';

let lazPerfPath = DEFAULT_LAZPERF_PATH;

/**
 * Sets the path to the directory that contains the laz-perf library files.
 *
 * This must be set before instantiating any class that makes use of this library.
 *
 * For example, if the `laz-perf.wasm` file is served from
 * `<website>/public/wasm/laz-perf.wasm`, the path to configure is the following:
 * ```ts
 * setLazPerfPath('/public/wasm/');
 * ```
 *
 * Note: the default path to the laz-perf library is {@link DEFAULT_LAZPERF_PATH}.
 */
export function setLazPerfPath(path: string) {
    lazPerfPath = path;
}

/**
 * @internal
 */
export function getLazPerfPath() {
    return lazPerfPath;
}

let lazPerf: Promise<LazPerf> | undefined = undefined;

/**
 * Loads one instance of the LazPerf library.
 */
async function loadLazPerf(wasmPath: string) {
    // console.log('initializing laz-perf with path: ' + wasmPath);
    return await LazPerf.create({
        locateFile: (file: string) => `${wasmPath}/${file}`,
    });
}

/**
 * @internal
 */
export function getLazPerf() {
    if (!lazPerf) {
        lazPerf = loadLazPerf(lazPerfPath);
    }

    return lazPerf;
}
