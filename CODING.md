# Giro3D coding guide

[[_TOC_]]

This guide gives advices and conventions on how to keep your code clean and coherent with the Giro3D codebase.

## Typescript considerations

The codebase now favors Typescript over Javascript. However, to avoid a brutal transition of the entire codebase, the migration is progressive.

Here are the general guidelines:

- New files should be in Typescript (`.ts`)
- Existing files may be migrated to Typescript, as long as all linters and tests pass.
- Use `interface` over `type` when possible (this is enforced by [this ESLint rule](https://typescript-eslint.io/rules/consistent-type-definitions/))

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

## Web Workers guidelines

Giro3D makes use of Web Workers to parallelize some CPU-intensive operations. However, since Web Workers are not handled equally well by all bundlers, there are a few guidelines to make them work on all platforms.

### Worker code inlining

The usual syntax of creating a worker by referencing an external javascript file does not work well with all bundlers by default, because this external file will not exist in the final build (since the bundler will bundle it with all other files).

The safest way to make workers run on all target platforms is to **inline their code**. This is done by the `inline-workers` task that is run when packaging the library.

This task transforms every location where a worker is created by the equivalent inlined version. This is done by first bundling and minifying the worker code, then converting it to base64, then inserting the base64 representation into a data URL fed into the worker constructor:

```ts
const worker = new Worker(new URL('./relative/path/to/worker.js'), import.meta.url);
```

thus becomes

```ts
const worker = new Worker(
    URL.createObjectURL(new Blob([atob('aW1wb3J0IHR5cGUgRGlzc...')], { type: 'text/javascript' })),
);
```

### Using a worker from a regular Typescript file

Here are guidelines on how to import a worker and use it.

- **Import Javascript files**. Worker source files are regular Typescript files, but referenced as Javascript files when creating the worker, since we import the transpiled version.

    ```ts
    const worker = new Worker(new URL('./relative/path/to/worker.js'), import.meta.url);
    ```

- **Use worker pools**. To avoid managing workers individually, use the `WorkerPool` class that makes it much easier to manage a pool of workers and send message to them. The lifetime of workers is automatically handled by the pool.

### Writing a worker

Here are a few guidelines related to writing web workers for Giro3D.

- **Write small workers**: Since the worker code will be inlined in every call site (although minified), it has to be **small**. It is better to have very specialized workers with very small amounts of code to reduce the bundle size.
- **Make it compatible with `WorkerPool`**: writing a worker compatible with the `WorkerPool` is very easy.
- **Do not import three.js in a worker**: three.js is notoriously impossible to tree-shake, and it will create a huge bundled worker. For example, instead of creating `BufferAttribute`s in the worker, just create the necessary elements to recreate the attribute outside the worker.
- **Write simple workers**: Since workers are inlined without any source map, they cannot be easily debugged in the browser. By writing logically simple code, we are less likely to introduce bugs.
- **Write worker-less alternatives**: each time a worker is used to speed-up a task, make it possible to run the same task without the worker (e.g by using an option in the constructor). Executing the same code outside a worker makes it easier to debug and to eliminate worker-related issues. It is also a fail-safe in the rare case when workers are not supported on the target platform.
