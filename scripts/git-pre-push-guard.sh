#!/usr/bin/env bash
# This personal fork publishes only to its owner; upstream is a read-only source.
# Install: ln -sf ../../scripts/git-pre-push-guard.sh .git/hooks/pre-push
set -uo pipefail

remote="${1:-}"
url="${2:-}"
[ -n "$url" ] || url="$(git config --get "remote.${remote}.pushurl" || git config --get "remote.${remote}.url" || true)"

case "$url" in
  https://github.com/sdwhwzp/dsh-web|https://github.com/sdwhwzp/dsh-web.git|git@github.com:sdwhwzp/dsh-web.git|ssh://git@github.com/sdwhwzp/dsh-web.git)
    exit 0
    ;;
esac

cat >&2 <<EOF
pre-push: BLOCKED - '${remote}' targets '${url}'.
pre-push: This personal fork may publish only to github.com/sdwhwzp/dsh-web.
pre-push: The original repository is a read-only synchronization source.
EOF
exit 1
