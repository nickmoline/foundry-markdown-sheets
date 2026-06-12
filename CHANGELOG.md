# Changelog

All notable changes to this project will be documented in this file.

## [v0.1.1] - 2026-06-12
### :bug: Bug Fixes
- [`fdb636f`](https://github.com/nickmoline/foundry-markdown-sheets/commit/fdb636f951668f0353a4c7892ded4761286f1561) - strip invalid or non-external links in markdown exporter *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`177ee28`](https://github.com/nickmoline/foundry-markdown-sheets/commit/177ee28100bf0ccb8b309de67d8df69041633f1a) - remove draft flag from release workflow to ensure proper visibility *(commit by [@nickmoline](https://github.com/nickmoline))*

### :recycle: Refactors
- [`1f534af`](https://github.com/nickmoline/foundry-markdown-sheets/commit/1f534af1da07c6659eb8c189082a47ad0920330e) - remove ApplicationV1 and ApplicationV2 manual hook registrations and monkey-patching *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.1.0] - 2026-06-12
### :sparkles: New Features
- [`80c2baf`](https://github.com/nickmoline/foundry-markdown-sheets/commit/80c2baf533ff18b28e5974554bf4755e40b1207b) - add ability score table and implement robust saving throw calculation in markdown exporter *(commit by [@nickmoline](https://github.com/nickmoline))*

### :recycle: Refactors
- [`97b6cb9`](https://github.com/nickmoline/foundry-markdown-sheets/commit/97b6cb9ddeed5064235d37eae7b321f4af8baccf) - make markdown generation and item description formatting asynchronous to support HTML enrichment *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`7f76033`](https://github.com/nickmoline/foundry-markdown-sheets/commit/7f76033e15d58f2f3e3c748c3e3c75b8ce121871) - restructure YAML output for HP and abilities into detailed schemas and add utility for YAML array generation *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.0.5] - 2026-06-12
### :recycle: Refactors
- [`05051d5`](https://github.com/nickmoline/foundry-markdown-sheets/commit/05051d5f9aa9a5a08285f5c5fcf0c13a9caecd74) - remove html-to-markdown.js and consolidate exporter logic in markdown-exporter.js *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.0.4] - 2026-06-12
### :recycle: Refactors
- [`0630810`](https://github.com/nickmoline/foundry-markdown-sheets/commit/063081006d529835855752b43addc3bbea14e1bd) - wrap action handler registration in a try-catch block for improved robustness *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.0.3-alpha] - 2026-06-12
### :sparkles: New Features
- [`3adb468`](https://github.com/nickmoline/foundry-markdown-sheets/commit/3adb468d932d7de2f13416ca800441f42218232f) - add legacy ApplicationV1 support and expand ApplicationV2 hook registration for broader compatibility *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.0.2-alpha] - 2026-06-12
### :sparkles: New Features
- [`df5a2f5`](https://github.com/nickmoline/foundry-markdown-sheets/commit/df5a2f5b52faf34cba4fc2373a84ca15d80fa97f) - add actor image to markdown export and improve filename sanitization *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`b31edb9`](https://github.com/nickmoline/foundry-markdown-sheets/commit/b31edb95cc5e19b8e7ba6cd8afff0df89fcb6301) - add ApplicationV2 support and context menu integration for actor sheet exports *(commit by [@nickmoline](https://github.com/nickmoline))*

### :wrench: Chores
- [`fe91604`](https://github.com/nickmoline/foundry-markdown-sheets/commit/fe9160464118bb102c4bc600d536023caafaa686) - Added gitignore file *(commit by [@nickmoline](https://github.com/nickmoline))*


## [v0.0.1-alpha] - 2026-06-12
### :sparkles: New Features
- [`118548c`](https://github.com/nickmoline/foundry-markdown-sheets/commit/118548c4d1f8896f8387c2287463289e22d7ee0c) - add multilingual localization support for character sheet exports *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`7b85b08`](https://github.com/nickmoline/foundry-markdown-sheets/commit/7b85b08cf3c3a6e124fcae592ea77247f0747088) - add automated CHANGELOG.md updates and release packaging to CI workflow *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`8dbcc18`](https://github.com/nickmoline/foundry-markdown-sheets/commit/8dbcc183c64c5157a368170a887e2808bcca2ad1) - enable gitmojis and ref issue inclusion in changelog generation *(commit by [@nickmoline](https://github.com/nickmoline))*

### :wrench: Chores
- [`7beff7a`](https://github.com/nickmoline/foundry-markdown-sheets/commit/7beff7abb0bc5e81d6c4ca3fe43d18f95f2dfe63) - update changelog generation workflow to use requarks/changelog-action *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`3d441d9`](https://github.com/nickmoline/foundry-markdown-sheets/commit/3d441d9f8571d07c55c2d64373b4fca8f8aef498) - checkout target commitish during release workflow execution *(commit by [@nickmoline](https://github.com/nickmoline))*
- [`4a62346`](https://github.com/nickmoline/foundry-markdown-sheets/commit/4a62346d11e026698a5b24d4e292d55e8e070b54) - fix changelog output variable in CI workflow and reset CHANGELOG.md content *(commit by [@nickmoline](https://github.com/nickmoline))*

[v0.0.1-alpha]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.0...v0.0.1-alpha
[v0.0.2-alpha]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.1-alpha...v0.0.2-alpha
[v0.0.3-alpha]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.2-alpha...v0.0.3-alpha
[v0.0.4]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.3-alpha...v0.0.4
[v0.0.5]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.4...v0.0.5
[v0.1.0]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.0.5...v0.1.0
[v0.1.1]: https://github.com/nickmoline/foundry-markdown-sheets/compare/v0.1.0...v0.1.1
