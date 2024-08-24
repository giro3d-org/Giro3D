module.exports = {
    presets: ['@babel/preset-typescript'],
    plugins: [
        // Necessary to import text files (shaders)
        ['babel-plugin-inline-import', { extensions: ['.json', '.glsl'] }],
        ['minify-dead-code-elimination'],
    ],
    env: {
        test: {
            presets: ['jest', ['@babel/preset-env']],
        },
    },
};
