# How to release Giro3D

[[_TOC_]]

## Requirements

Install the [commitizen](https://commitizen-tools.github.io/commitizen/) utility with pip or any compatible package manager (homebrew...)

```shell
pip install commitizen
```

This will install the `cz` utility in your python packages folder (by default `$HOME/.local/bin/cz`).

## Security mechanisms

The CI/CD on gitlab.com automatically publishes beta and stable packages in the `@giro3d`
organization on npmjs.com.

Authentication uses the recommended [Trusted Publisher](https://docs.npmjs.com/trusted-publishers)
mechanism instead of an authentication token.

Check that the trusted publisher is enabled for the root `.gitlab-ci.yml` in the package settings (<https://www.npmjs.com/package/@giro3d/giro3d/access>).

## Note on semantic versioning

Giro3D follows [semantic versioning](https://semver.org/). Versions will be noted `X.Y.Z`, with:

- `X` being the major version - incremented when breaking changes are introduced to the public API,
- `Y` being the minor version - incremented when new non-breaking changes are introduced to the public API,
- `Z` being the patch version - incremented when only non-breaking bugfixes are introduced.

## Normal workflow: major/minor release

This scenario assumes that we want to release version **`v2.0.0`** of Giro3D.

1. Create a release branch named `release/2.0` at the tip of `main`
1. Edit `package.json` in this branch, with the following changes:
    - Remove `"private": true` so that the package can be published from this branch
    - Set `"version"` to `2.0.0-beta.0`
1. Run `npm i` (to update `package-lock.json` accordingly)
1. Generate the changelog (described below)
1. Create a merge request (MR) for `release/2.0` to be merged into `main`
1. If major changes are required (i.e. that require peer-review), new merge requests can be created, branching from and to the release branch
1. When the release MR is ready:
    1. Set the version in `package.json` from **`2.0.0-beta.*`** **`2.0.0`** (final version)
    2. Create a tag on the latest commit of the release branch (tag is **`v2.0.0`**, don't forget the `v` prefix)
    3. Once tagged, the pipeline will automatically be triggered to publish the package on [npmjs.com](npmjs.com)
    4. Accept the release MR
    5. The release branch can be deleted

**Note:** for pre-releases, you can use a release branch to tag the version, but that branch **MUST** be protected for the pipeline to run and publish the package. Branches following the pattern `release/*` are automatically protected.

## Exceptional workflow: patch releases

If an urgent hotfix is needed for an existing release (say, release a hotfix `v2.0.1` for the 2.0 release):

1. Create the release branch `release/2.0` at the tag of the existing release we need to patch
2. Create a short-lived hotfix branch from the release branch
3. In the hotfix branch, push the fix, generate changelog, etc.
4. Open the release Merge Request (MR) to the release branch
5. If changes that need peer-review are required, new merge requests can be created, branching from and to the release branch
6. When the release MR is ready:
    1. Tag the latest commit on the release branch (don't forget the `v` prefix)
    2. Once tagged, the pipeline will automatically be triggered to publish the package on NPM
    3. Accept the release MR
    4. If applicable, merge the release branch into `main`
    5. The release branch can be deleted

## Generate the changelog

1. review the changes between the last release and the current `main`, with the following command

    ```shell
    git log --oneline --no-merges $(git describe --tags --abbrev=0)..
    ```

2. generate a changelog with commitizen:

    ```shell
    cz changelog --incremental --unreleased-version <version>
    ```

    where version is the version we want to release (don't forget the `v` prefix, for example `v2.0.0`).

3. Edit the generated changelog for readability (fix typos, add some context for unclear changes).
   It's also best to sort the items in Feat/Fix/Refactor alphabetically.
   For the `BREAKING CHANGE` section, edit the text to add a migration guide.

## Publish the package manually on npmjs.com

> [!warning] Warning
> This procedure is for exceptional circumstances only ! In general, publishing NPM packages should
> be done from the CI/CD pipeline described in `.gitlab-ci.yml`. One notable exception is to publish
> preview packages in non-stable channels, such as <https://www.npmjs.com/package/@giro3d/giro3d/v/2.0.0-perfwms.1>

If you wish to manually create a NPM release:

### Check that you are authenticated

```shell
npm who
```

### Optional: clean your repository and reinstall packages

```shell
git clean -ffdx
npm ci
```

### Build the package

```shell
npm run make-package
```

### Publish the package

> [!warning]
> Ensure that the package has been properly built in the `build/giro3d/` folder !

If you are publishing a preview package, use the `preview` tag.

```shell
npm publish build/giro3d/ --access public --tag preview
```

## Update external references to Giro3D

If the release is a major version that brings notable improvements and features, it might be
relevant to update:

- the OSGeo Giro3D page: <https://www.osgeo.org/projects/giro3d/>
