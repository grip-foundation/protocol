# Contributing to Grip Protocol

Thanks for your interest. Grip is early-stage open infrastructure — clear contributions are welcome.

## Before you start

- For **bugs**, open an issue using the bug template before writing a PR. This helps us avoid two people fixing the same thing.
- For **new features**, open a discussion or feature-request issue first. We'd rather push back on scope before you spend weekends on it.
- For **typos, small doc fixes, or obvious improvements**, a direct PR is fine.

## Dev setup

```bash
git clone https://github.com/grip-foundation/protocol.git
cd protocol
forge install
forge build
forge test -vv
```

The test suite should pass on `main` at any time. If it doesn't, that's a bug — open an issue.

## Pull request checklist

- [ ] Tests pass locally (`forge test`)
- [ ] New contract logic is covered by tests (property-based preferred for economic logic)
- [ ] No hardcoded addresses outside `script/` or `docs/`
- [ ] Gas changes noted in the PR description (Foundry prints gas diffs)
- [ ] Public APIs include NatSpec comments
- [ ] No breaking changes to deployed interfaces without a migration plan

## Commit style

We follow conventional-ish commits — lowercase prefix + short summary:

- `feat:` new capability
- `fix:` bug fix
- `refactor:` no behavior change
- `test:` tests only
- `docs:` docs only
- `chore:` tooling, deps, CI

Keep commits small and focused. A PR with twenty tiny commits is better than one giant commit.

## Security issues

Do **not** file public issues for security vulnerabilities. Email `security@grip.wtf` with:

- A description of the issue
- Steps to reproduce
- The contracts and functions affected
- Your proposed fix, if you have one

We aim to respond within 48 hours and will coordinate disclosure with you before any public announcement.

## Conduct

Be direct, be technical, be kind. Disagreements about design happen; personal attacks don't.

## License

By contributing, you agree your contributions are released under the MIT license (same as the rest of the repo).
