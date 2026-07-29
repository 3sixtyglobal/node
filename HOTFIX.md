# Hotfix Releases

A hotfix releases `main` plus selected cherry-picked fixes, without promoting everything currently on `next`. The machinery was validated end to end before rollout, see [the spike](https://github.com/iotaledger/twin-workspace/issues/29).

## When does a fix qualify for a hotfix?

All three must hold, otherwise the fix rides the next full release:

- The defect affects consumers of the stable (`latest`) line.
- The fix is small, isolated, and already merged and validated on `next`.
- Waiting for the next full platform release is not acceptable for those consumers.

## Procedure

1. Ensure the fix is merged on `next` (this is mandatory, see the rules below).
2. Run the **Create Hotfix Branch** workflow with a branch name (e.g. `hotfix/0.9.1`) and the comma-separated commit SHAs from `next`, oldest first. The workflow cuts the branch from `main` and cherry-picks the commits. If a cherry-pick conflicts, the run fails and no branch is pushed; prepare the branch manually instead.
3. Verify the branch builds. Cherry-pick any missing dependent commits manually.
4. Run **Release Production** with `hotfixBranch` set to the branch and either `semverBump` set to `patch` (or `minor`/`major`) or an explicit `customVersion`. Do not use `promote next` in hotfix mode; the workflow refuses it (it derives the version from the line of `next` while releasing different content).
5. Approve and merge the generated PRs as usual (merge PR, versions PR, release PR). **Before merging the release PR, verify it carries the `hotfix` label**; the label is applied moments after the PR is created and is what prevents the destructive content realignment of `next`.
6. Everything after the release PR merge is automatic: publish, GitHub releases, a realignment PR that bumps `next` above the released version and carries the release changelogs over (versions and changelogs only, no source content), and deletion of the hotfix branch.

## Rules

- **The fix must exist on `next`.** A fix that lives only on `main` is silently reverted by the next full release, because the promotion takes the content of `next` wholesale. Cherry-picking from `next` (the procedure above) guarantees this; any commit authored directly on the hotfix branch must be applied to `next` as well.
- **Never remove the `hotfix` label from a hotfix release PR.** Without it the post-publish realignment resets `next` to the content of `main` and erases in-flight development.
- **A hotfix branch must be cut from the current `main`.** The workflow refuses a branch that is behind `main`, because releasing it would revert the newer `main` changes; recreate the branch instead of rebasing around the refusal.
- **Multi-repo hotfixes** (a fix spanning this repo and e.g. `twin-dataspace`) must be released in dependency order: release the dependency repo (e.g. `twin-dataspace`) first, then bump it in this repo's hotfix branch to the freshly released version and release this repo.

## Recovery

- **Publish run failed after the release PR merged**: the merged release PR keeps the `autorelease: pending` label, and every later release attempt is blocked by it. Flip the label to `autorelease: tagged` on the merged PR, then re-run the failed jobs (a workflow change instead needs a fresh dispatch; re-runs use the original workflow snapshot).
- **Aborting before the release PR is merged**: close the open generated PR; `main` is only modified by merged PRs, so nothing needs reverting. Delete the stray `release/*` branch and the hotfix branch.
- **Version arithmetic**: hotfix `patch`/`minor`/`major` bumps are computed from the production manifest, and after the release `next` is moved one patch above it automatically (e.g. releasing `0.9.1` moves `next` to `0.9.2-next.0`). Across repos, version divergence from hotfixes is expected and harmless; repos re-align at the next platform release via `customVersion`.
