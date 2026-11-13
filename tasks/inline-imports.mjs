/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import path from 'path';

/**
 * Preprocess TypeScript file to inline .glsl and .json imports.
 * This replaces babel-plugin-inline-import functionality.
 *
 * @param {string} filePath - Path to the TypeScript file
 * @returns {string} - Processed content with inlined imports
 */
export function inlineGlslAndJsonImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);

    // Match import statements for .glsl and .json files
    const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+\.(glsl|json))['"];?/g;

    let match;
    const importsToReplace = [];

    while ((match = importRegex.exec(content)) !== null) {
        const importName = match[1];
        const importPath = match[2];
        const fullPath = path.resolve(dir, importPath);

        if (fs.existsSync(fullPath)) {
            importsToReplace.push({
                start: match.index,
                end: match.index + match[0].length,
                name: importName,
                path: fullPath,
                isJson: importPath.endsWith('.json'),
            });
        }
    }

    // Process imports in reverse order to maintain correct indices
    importsToReplace.reverse().forEach(({ start, end, name, path, isJson }) => {
        const fileContent = fs.readFileSync(path, 'utf8');

        if (isJson) {
            const jsonContent = JSON.stringify(JSON.parse(fileContent));
            const replacement = `const ${name} = ${jsonContent};`;
            content = content.substring(0, start) + replacement + content.substring(end);
        } else {
            const escapedContent = fileContent
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\${/g, '\\${')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');

            const replacement = `const ${name} = \`${escapedContent}\`;`;
            content = content.substring(0, start) + replacement + content.substring(end);
        }
    });

    return content;
}
