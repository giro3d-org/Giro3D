/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

const preamble = `// This preamble is automatically injected at bundling time by webpack
// To validate uses of the WebGL API
import 'webgl-lint';
// End of injected preamble
\n`;

/**
 * @param {string} source
 * @returns {string}
 */
module.exports = function (source) {
    return preamble + source;
};
