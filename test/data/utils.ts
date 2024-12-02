import * as path from "path";
import * as fs from 'fs';
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
