/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

module.exports = {
    presets: ['@babel/preset-typescript'],
    plugins: [
        // Necessary to import text files (shaders)
        ['babel-plugin-inline-import', { extensions: ['.json', '.glsl'] }],
        ['minify-dead-code-elimination'],
    ],
};
