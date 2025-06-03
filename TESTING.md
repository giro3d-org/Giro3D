# Giro3D Testing suite

[[_TOC_]]

This document describes the Giro3D testing framework and details how to write tests, run test suite and more.

## ℹ️ Typescript considerations

The codebase now favors Typescript over Javascript, but the transition is progressive, to avoid too much noise in diffs and reduce the risk of regression. For this reason, please follow those guidelines when writing tests:

- New test files should be in Typescript (`Foo.test.ts` files).
- If you must add a test case to an existing `Bar.test.js` test file, please transform it to a Typescript file (`Bar.test.ts`) beforehand, to contribute to the Typescript transition.

## 🧪 Unit tests

Unit tests use the [Jest framework](https://jestjs.io/).

Test files are located in `test/unit`, under a folder hierachy that mirrors the hierarchy in `src/`, i.e: the tests for `src/core/Cache.js` are in `test/unit/core/Cache.test.js`

### Structure

- The root `describe()` should contain the name of the tested class:

    ```js
    describe('Extent', () => {...});
    ```

- each tested method should have its own `describe()`:

    ```js
    describe('Extent', () => {
      describe('isValid', () => { ... }),
      describe('isInside', () => { ... }),
    });
    ```

- Inside each method block, you can have any number of tests. Each test should have a clear description about the expected outcome, such as:

```js
describe('Extent', () => {
    describe('isValid', () => {
        it('should return false if extent has infinite values', () => {
            expect(new Extent(CoordinateSystem.epsg3857, NaN, 1, 0, 1).isValid()).toEqual(false);
            expect(new Extent(CoordinateSystem.epsg3857, Infinity, 1, 0, 1).isValid()).toEqual(
                false,
            );
            expect(new Extent(CoordinateSystem.epsg3857, 0, 1, Infinity, 1).isValid()).toEqual(
                false,
            );
        });
    });
});
```

### ✅ Coverage

Unit test coverage can be computed with:

```shell
npm run test-with-coverage
```

## Examples

The [example page](https://giro3d.org/examples/) contains a lot of examples, each tackling a single feature, or a combination of features.

Examples are both used to showcase Giro3D capabilities, but also as interactive tests, when unit testing is impossible or impractical, for example to test visual results.

### Structure

Each example is a pair of files: HTML and JS. The HTML is actually a template used to generate the actual HTML file with

```shell
npm run build-examples
```

The template looks like this:

```plain
---
title: Cloud Optimized GeoTIFF (COG)
shortdesc: Display a RGB COG.
longdesc: Cloud Optimized GeoTIFFs are regular GeoTIFF files whose layout is optimized for remote access. They allow streaming the image without tiling it beforehand.
attribution: © <a target="_blank" href="https://eox.at/">EOX</a>
---
```

`title` and `shortdesc` are both displayed in the example index, and the example itself. The `longdesc` is only displayed in the example itself, and include additional details about how-tos and API information.

The `attribution` contains all relevant copyright holders and a link to their respective website, if applicable.
