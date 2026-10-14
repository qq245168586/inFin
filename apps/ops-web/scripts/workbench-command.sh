#!/usr/bin/env bash
set -euo pipefail
workbench exec -i "${INFINI_INSTANCE_ID:-i-bp1gy4to0n4dh5gk7tuw}" -c "${1:?Remote command is required}"
