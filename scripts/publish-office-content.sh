#!/usr/bin/env bash
set -euo pipefail

build_root=$(cd "${1:?Pass the distribution directory}" && pwd)
source_commit=$(git rev-parse --verify "${2:?Pass the verified main commit}^{commit}")
branch=refs/heads/office-content-v1
for manifest in mos-v1.json templates.json; do
  if [[ ! -s "$build_root/content/$manifest" ]]; then
    echo "Missing content/$manifest in the verified build." >&2
    exit 1
  fi
done

scratch=$(mktemp -d)
export GIT_INDEX_FILE="$scratch/index"
trap 'rm -f -- "$GIT_INDEX_FILE" "$GIT_INDEX_FILE.lock"; rmdir -- "$scratch"' EXIT

remote_tip() {
  git ls-remote --refs origin "$1" | cut -f1
}

for attempt in 1 2 3; do
  parent=$(remote_tip "$branch")
  parents=()
  if [[ -n "$parent" ]]; then
    git fetch --quiet --no-tags origin "$branch"
    parent=$(git rev-parse FETCH_HEAD)
    git read-tree "$parent"
    parents=(-p "$parent")
  else
    git read-tree --empty
  fi

  git --work-tree="$build_root" -c core.autocrlf=false add -f --ignore-removal -- content
  tree=$(git write-tree)
  if [[ -n "$parent" && "$tree" == "$(git rev-parse "$parent^{tree}")" ]]; then
    echo "Published content already matches this build."
    exit 0
  fi
  main_tip=$(remote_tip refs/heads/main)
  if [[ "$main_tip" != "$source_commit" ]]; then
    echo "Skipping an outdated build of main ($source_commit)."
    exit 0
  fi
  commit=$(git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit-tree "$tree" "${parents[@]}" -m "Publish Office content from $source_commit")
  if git push origin "$commit:$branch"; then
    exit 0
  fi
  current=$(remote_tip "$branch")
  if [[ "$current" == "$parent" ]]; then exit 1; fi
  echo "Content branch changed during attempt $attempt. Retrying against the new tip."
done
exit 1
