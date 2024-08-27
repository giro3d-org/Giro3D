# Giro3D coding guide

[[_TOC_]]

This guide gives advices and conventions on how to keep your code clean and coherent with the Giro3D codebase.

## Typescript considerations

The codebase now favors Typescript over Javascript. However, to avoid a brutal transition of the entire codebase, the migration is progressive.

Here are the general guidelines:

-   New files should be in Typescript (`.ts`)
-   Existing files may be migrated to Typescript, as long as all linters and tests pass.

### Importing `.ts` files

To import a Typescript file from a Javascript file, you must not mention the extension:

For example, if you want to import `Bar.ts` from `Foo.js`, use the following syntax:

```js
// Foo.js
import Bar from './Bar';
```

Do _not_ use this syntax:

```js
// Foo.js
import Bar from './Bar.ts';
```

Otherwise the transpiled `Foo.js` will still import a non-existent `Bar.ts` file.

## API surface

Files that should be part of the public API (and thus, appear in the [documentation](https://giro3d.org/apidoc/)) should be a part of a namespace file. Namespace files are located within each folder in the `src` folder (including `src` itself), and are named `api.ts`.

For example, if you want to add `src/core/Foo.ts` to the API, you must add it to the `src/core/api.ts` file.
