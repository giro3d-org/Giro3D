# How to release Giro3D

[[_TOC_]]

## Requirements

Install the commitizen utility with pip

```shell
pip install commitizen
```

This will install the `cz` utility in your python packages folder (by default `$HOME/.local/bin/cz`).

## Normal workflow: major/minor release

1. Create a release branch `release/X.Y` (where `X.Y.0` is the release version number) at the tip of `main`
2. In branch `main`, bump the version in _package.json_ and run `npm i` (to update the _package-lock.json_ file accordingly)
3. In the release branch, generate changelog, etc. (described below)
4. Open the release Merge Request (MR) to `main` (described below)
5. If major changes are required (i.e. that require peer-review), new merge requests can be created, branching from and to the release branch
6. When the release MR is ready:
    1. Tag the latest commit on the release branch (don't forget the `v` prefix)
    2. Once tagged, the pipeline will automatically be triggered to publish the package on NPM
    3. Accept the release MR
    4. The release branch can be deleted

**Note:** for pre-releases, you can use a release branch to tag the version, but that branch **MUST** be protected for the pipeline to run and publish the package. Branches following the pattern `release/*` are automatically protected.

## Exceptional workflow: patch releases

If an urgent hotfix is needed for an existing release (say, release a `v0.39.1` for `v0.39.0`):

1. Create a release branch `release/X.Y` at the tag of the existing release we need to patch
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
