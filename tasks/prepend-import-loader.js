const preamble = `// This preamble is automatically injected at bundling time by webpack
// To validate uses of the WebGL API
import 'webgl-lint';
// End of injected preamble
\n`;

module.exports = function (source) {
    return preamble + source;
};
