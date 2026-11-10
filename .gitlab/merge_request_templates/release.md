## Checklist

> [!note]
> Please refer to the `HOW_TO_RELEASE.md` for the full documentation on the release process.

### Before merge

- [ ] `package.json`: removed `"private": true` to ensure that the package is publishable on
      npmjs.com
- [ ] `CHANGELOG.md`: added a section for the new release
- [ ] `package.json` and `package-lock.json`: updated with the new version
- [ ] all new contributors are present in `CONTRIBUTORS.md`

### When MR is validated

- [ ] Create tag `vX.Y.Z` on the latest commit of this MR
- [ ] Create a release for this tag in <https://gitlab.com/giro3d/giro3d/-/releases> with the
      release notes taken from `CHANGELOG.md`
- [ ] Check that the website is updated and that the new package is available on npmjs.com
- [ ] Update the [OSGeo page](https://www.osgeo.org/projects/giro3d/) if relevant (e.g new features are worth mentioning on the page)
