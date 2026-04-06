#!/usr/bin/env bash

set -euo pipefail

WORKFLOW_FILE="${WORKFLOW_FILE:-sonarqube.yml}"
ARTIFACT_ROOT="${ARTIFACT_ROOT:-/tmp/dosh-sonar-artifact}"
TARGET_BRANCH="${1:-${TARGET_BRANCH:-}}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is required but was not found in PATH." >&2
  exit 1
fi

mkdir -p "${ARTIFACT_ROOT}"

RUN_ID="$(
  gh run list \
    --workflow "${WORKFLOW_FILE}" \
    --limit 20 \
    --json databaseId,headBranch,status,conclusion,createdAt \
  | python3 -c '
import json
import sys

target_branch = sys.argv[1]
runs = json.load(sys.stdin)

for run in runs:
    if run.get("status") != "completed":
        continue
    if run.get("conclusion") != "success":
        continue
    if target_branch and run.get("headBranch") != target_branch:
        continue
    print(run["databaseId"])
    raise SystemExit(0)

raise SystemExit(1)
' "${TARGET_BRANCH}"
)"

if [[ -z "${RUN_ID}" ]]; then
  if [[ -n "${TARGET_BRANCH}" ]]; then
    echo "No successful ${WORKFLOW_FILE} workflow run found for branch '${TARGET_BRANCH}'." >&2
  else
    echo "No successful ${WORKFLOW_FILE} workflow run found." >&2
  fi
  exit 1
fi

DEST_DIR="${ARTIFACT_ROOT}/run-${RUN_ID}"
rm -rf "${DEST_DIR}"
mkdir -p "${DEST_DIR}"

gh run download "${RUN_ID}" -D "${DEST_DIR}" >/dev/null

ARTIFACT_DIR="$(
  find "${DEST_DIR}" -mindepth 1 -maxdepth 1 -type d | sort | head -n 1
)"

if [[ -z "${ARTIFACT_DIR}" ]]; then
  echo "Downloaded run ${RUN_ID}, but no artifact directory was found under ${DEST_DIR}." >&2
  exit 1
fi

echo "Downloaded Sonar artifact from run ${RUN_ID}"
echo "Artifact directory: ${ARTIFACT_DIR}"
echo "Summary markdown: ${ARTIFACT_DIR}/sonar-summary.md"
echo "Summary json: ${ARTIFACT_DIR}/sonar-summary.json"
echo "Issue summary json: ${ARTIFACT_DIR}/sonar-issues-summary.json"
echo "Full issue json: ${ARTIFACT_DIR}/sonar-issues-full.json"
