import * as path from "node:path";
import * as fs from 'node:fs';
import * as process from "process";

export function getDataFileUrl(filename: string): string {
    if (path.isAbsolute(filename)) {
        return filename;
    }
    return path.join(process.cwd(), 'test', 'data', filename);
}

/**
 * Reads a file in the data folder
 * @param filename - The path to the file relative to the data folder.
 * @returns A buffer containing the file content.
 */
export function readDataFileSync(filename: string): Buffer {
    const buf = fs.readFileSync(getDataFileUrl(filename));

    return buf;
}

/**
 * Reads a JSON file in the data folder
 * @param filename - The path to the file relative to the data folder.
 * @returns A string containing the file content.
 */
export function readJsonSync(filename: string): string {
    const buf = fs.readFileSync(getDataFileUrl(filename), { encoding: 'utf-8'});

    return buf;
}
