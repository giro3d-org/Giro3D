module.exports = {
    presets: ['@babel/preset-typescript'],
    plugins: [
        // Necessary to import text files (shaders)
        ['babel-plugin-inline-import', { extensions: ['.json', '.glsl'] }],
        ['minify-dead-code-elimination'],
    ],
    // API barrel files are only there to generate the documentation
    // We really don't want barrel files in the exported package
    ignore: ['**/api.ts'],
};
