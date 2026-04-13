# How to release Giro3D

[[_TOC_]]

## Requirements

Install the commitizen utility with pip

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

Giro3D follows [semantic versioning](https://semver.org/). Until 1.0.0 is released, versions are noted `0.Y.Z`, with:

- `Y` being the minor version - incremented when breaking changes or non-breaking changes are introduced to the public API,
- `Z` being the patch version - incremented when only non-breaking bugfixes are introduced.

When 1.0.0 will be released, versions will be noted `X.Y.Z`, with:

- `X` being the major version - incremented when breaking changes are introduced to the public API,
- `Y` being the minor version - incremented when new non-breaking changes are introduced to the public API,
- `Z` being the patch version - incremented when only non-breaking bugfixes are introduced.

## Normal workflow: major/minor release

This scenario assumes that we want to release version **`v0.39.0`** of Giro3D.

1. Create a release branch named `release/0.39` at the tip of `main`
2. _In branch `main`_: Set the version in `package.json` to **`0.40.0-dev`** (:warning: notice the `-dev` suffix, so that we don't accidentally publish a release package from `main`, and also because releases generally are preceded by beta versions.).
3. _In branch `main`_: Run `npm i` (to update `package-lock.json` accordingly)
4. _In branch `release/0.39`_: Change the version number from **`0.39.0-dev`** to **`0.39.0-beta.0`**
5. _In branch `release/0.39`_: Run `npm i` (to update `package-lock.json` accordingly)
6. _In branch `release/0.39`_: Generate changelog, etc. (described below)
7. Create a merge request (MR) for `release/0.39` to be merged into `main`
8. If major changes are required (i.e. that require peer-review), new merge requests can be created, branching from and to the release branch
9. When the release MR is ready:
    1. _In branch `release/0.39`_ Set the version in `package.json` from **`0.39.0-beta.*`** **`0.39.0`** (final version)
    2. _In branch `release/0.39`_ Tag the latest commit (tag is **`v0.39.0`**, don't forget the `v` prefix)
    3. Once tagged, the pipeline will automatically be triggered to publish the package on [npmjs.com](npmjs.com)
    4. Accept the release MR
    5. The release branch can be deleted

**Note:** for pre-releases, you can use a release branch to tag the version, but that branch **MUST** be protected for the pipeline to run and publish the package. Branches following the pattern `release/*` are automatically protected.

## Exceptional workflow: patch releases

If an urgent hotfix is needed for an existing release (say, release a `v0.39.1` for `v0.39.0`):

1. Create the release branch `release/0.39` at the tag of the existing release we need to patch
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
    $HOME/.local/bin/cz changelog --incremental --unreleased-version <version>
    ```

    where version is the version we want to release (don't forget the `v` prefix, for example `v0.5.0`).

3. Edit the generated changelog for readability (fix typos, add some context for unclear changes).
   It's also best to sort the items in Feat/Fix/Refactor alphabetically.
   For the `BREAKING CHANGE` section, edit the text to add a migration guide.

## Publish on NPM

If you wish to manually create a NPM release:

```shell
# check authentification
npm who

# build the package
npm run make-package
# publish the package - make sure the path "build/giro3d/" is specified!
npm publish build/giro3d/ --access public
```
