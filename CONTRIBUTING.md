# Contributing

Thank you for contributing to this project. Together, we can make this project even better.

Make sure to read our [Code of Conduct](https://github.com/MaksiRose/paw-and-paper/blob/dev/CODE_OF_CONDUCT.md).

These guidelines explain how to open different kinds of issues, writing good commit messages and creating PR's for the correct branches.


# Opening Issues

## Bug report

Bug reports are for unintended behavior, typos and oversights. It is best to explain exactly what is happening, what is expected instead, and how to reproduce the issue. The more detailed the information is, the faster the bug can be fixed. Adding version numbers can help in case the issue doesn't get fixed for a while.

## Feature requests

Feature requests are for new features, improvements on existing features, or general suggestions that can improve quality. It is important to explain in the idea in great detail, as well as why the idea is needed. Examples of when this comes in handy and alternative ways to solve this are good practice.

Most importantly, try to think about if this might be incompatible with some current behavior, and how to overcome that incompatibility. This is also called Chesterton's Fence:
> Do not remove a fence until you know why it was put up in the first place.

This means thinking about why the decision to do things as they were done was made, and to assume that there was a good reason for this. When adding something new or improving on something, think about why it hasn't been done already, as changing it might have some unexpected consequences.

## Species requests

The bot has a list of species that the user needs to pick from when setting up their character for the RPG-parts of the bot.

Species should not be extinct, mythical, and should not be too specific, for example a breed of dog, or they will not be accepted. Rule of thumb is that if it is so similar to another animal that they can be grouped together without changing anything in that block, they should be grouped together.

The kind of species you choose affects gameplay, for example, which biomes you can visit and which animals you encounter.

With that in mind, pick which environment the species would do best in (cold, warm, water), what kind of diet the species has (omnivore, herbivore, carnivote) and which kinds of animals it preys on and which prey on it. Make sure to put in as many as possible here, since only those that can also be picked as species can also be added as fightable. Even the ones that aren't currently in the game will be written down and might be added later. Make sure you have credible sources for this information too.\


# Writing good commit messages

When you want to work on an issue, you will have to fork the repository and make commits with the changes you make. Make sure to make individual commits  for each change, rather than bundling several changes in one commit or committing half-finished changes.

Commit messages should be formatted like this:
```
<type>(<scope>): <subject>
<NEWLINE>
<body>
<NEWLINE>
<footer>
```
- The **type** is mandatory and communicates the intent of your change. These are the types you can pick from:
  - `feat` for a new feature, the emoji for this is ✨
  - `fix` for a bug fix, the emoji for this is 🐛
  - `docs` for documentation only changes, the emoji for this is 📚
  - `style` for visual-only changes to code, such as white-space, formatting, semicolons, the emoji for this is 💎
  - `refactor` for adding small alterations that make code simpler and cleaner while not changing functionality, the emoji for this is 📦
  - `perf` for changes that improve performance, the emoji for this is 🚀
  - `test` for adding missing or correcting existing tests, the emoji for this is 🚨
  - `build` for build related changes such as external dependencies, the emoji for this is 🛠️
  - `ci` for changes to continuous integration files and scripts, the emoji for this is ⚙️
  - `chore` for other changes that don't modify src or test files, the emoji for this is ♻️
  - `revert` for reverts to previous commits, the emoji for this is 🗑️
- The **scope** is optional and communicates what is affected by this commit. This can be left out when the commit affects several things and cannot be assigned to one scope. The types of scopes are:
  - `bot` for changes to how the discord bot works
- The **subject** is mandatory and commmunicates *what* change was made, in a concise description in present tense, all lowercase and no dot(.) at the end.
- The **body** is optional and communicates motivation for the change and contrast with previous behavior. It is also in imperative, present tense.
- The **footer** is optional and may either contain breaking changes with a description of the change, justification and migration notes, or referencing issues, prefix with "Closes" keyword. Examplke: "Closes #123, #456"


# Branches

Knowing these branches helps you fork off of and merging into the correct ones when making changes.

## Stable

The **stable** branch is a permanent branch that reflects the latest stable release. Direct commits should not occur. *Hotfix*-branches should branch off of it, and *hotfix*-branches and *release*-branches should merge into it.

## Dev

The **dev** branch is a permanent branch that reflects the latest finished features. Direct commits should only occur for features that have been merged into it but not been released yet. Bugs might still be present in this version. Direct commits are only allowed for minor bug fixes. *Feature*-branches, *fix*-branches and *release*-branches should branch off of it, and *hotfix*-branches, *feature*-branches aand *fix*-branches should merge into it.

## Release

**Release** branches are temporary branches that reflect a testing stage for a upcoming release. They branch off of the *dev*-branch and merge into the *stable*-branch. Direct commits should only occur for minor fixes. Nothing should branch off of it and nothing should merge into it.

## Hotfix

**Hotfix** branches are temporary branches for important bugs that needs quick fixing. They branch off of the *stable*-branch and merge into the *stable*-branch and the *dev*-branch. Direct commits should occur to resolve the bug. Nothing should branch off of it and nothing should merge into it.

## Fix and feature

**Fix/Feature** branches are temporary branches for bugs and features that are worked on for future releases. Direct commits should occur to make progress on the fix or feature. They branch off of the *dev*-branch and merge back into the *dev*-branch.

## Final workflow

1. For severe bugs, created a *hotfix*-branch from stable, and merge into stable and dev
2. For new features or minor bugs, create a *fix/feature*-branch from dev, and merge into dev
3. When a new release is ready, create a *release*-branch from dev, test and bugfix from that branch, then merge into stable

## Notes

1. hotfix, fix and feature branches should follow the naming convention `hotfix-ticketnr`, `fix-ticketnr`, `feature-ticketnr.
2. release branches should follow the naming convention `release-major.minor.patch`, with major, minor and patch being increasing numbers.
