#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BUILDER_NAME="${BUILDER_NAME:-tarot-pi-builder}"
REGISTRY="${REGISTRY:-zaptapped}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-tarot-frontend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-my-first-container}"
TAG="${TAG:-}"
PLATFORMS="${PLATFORMS:-linux/arm64}"
TARGET="${TARGET:-all}"
PUSH=false
LOAD=false
NO_CACHE=false

usage() {
  cat <<'EOF'
Usage:
  ./scripts/buildx-images.sh --tag <tag> [options]

Build the frontend and/or backend container images with docker buildx for
Raspberry Pi targets.

Options:
  --tag <tag>                 Image tag to build, for example v1.0.3
  --target <all|frontend|backend>
                              Which image(s) to build. Default: all
  --platform <platforms>      Buildx platform list. Default: linux/arm64
                              Example: linux/arm64,linux/arm/v7
  --registry <name>           Registry or namespace prefix. Default: zaptapped
  --frontend-image <name>     Frontend image name. Default: tarot-frontend
  --backend-image <name>      Backend image name. Default: my-first-container
  --builder <name>            Buildx builder name. Default: tarot-pi-builder
  --push                      Push images to the registry after building
  --load                      Load the built image into the local Docker daemon
                              Only valid for a single platform build
  --no-cache                  Build without using cache
  -h, --help                  Show this help text

Examples:
  ./scripts/buildx-images.sh --tag v1.0.3 --push
  ./scripts/buildx-images.sh --tag v1.0.3 --target frontend --push
  ./scripts/buildx-images.sh --tag v1.0.3 --platform linux/arm64,linux/arm/v7 --push
  ./scripts/buildx-images.sh --tag dev-pi --target backend --load
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_builder() {
  if docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
    docker buildx use "${BUILDER_NAME}" >/dev/null
  else
    docker buildx create --name "${BUILDER_NAME}" --use >/dev/null
  fi

  docker buildx inspect --bootstrap >/dev/null
}

validate_args() {
  if [[ -z "${TAG}" ]]; then
    echo "--tag is required" >&2
    usage
    exit 1
  fi

  if [[ "${TARGET}" != "all" && "${TARGET}" != "frontend" && "${TARGET}" != "backend" ]]; then
    echo "Invalid --target: ${TARGET}" >&2
    exit 1
  fi

  if [[ "${PUSH}" == true && "${LOAD}" == true ]]; then
    echo "--push and --load cannot be used together" >&2
    exit 1
  fi

  if [[ "${LOAD}" == true && "${PLATFORMS}" == *","* ]]; then
    echo "--load only supports a single platform build" >&2
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        TAG="$2"
        shift 2
        ;;
      --target)
        TARGET="$2"
        shift 2
        ;;
      --platform)
        PLATFORMS="$2"
        shift 2
        ;;
      --registry)
        REGISTRY="$2"
        shift 2
        ;;
      --frontend-image)
        FRONTEND_IMAGE="$2"
        shift 2
        ;;
      --backend-image)
        BACKEND_IMAGE="$2"
        shift 2
        ;;
      --builder)
        BUILDER_NAME="$2"
        shift 2
        ;;
      --push)
        PUSH=true
        shift
        ;;
      --load)
        LOAD=true
        shift
        ;;
      --no-cache)
        NO_CACHE=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

build_image() {
  local image_ref="$1"
  local dockerfile="$2"
  local context_dir="$3"

  local -a cmd=(
    docker buildx build
    --builder "${BUILDER_NAME}"
    --platform "${PLATFORMS}"
    --tag "${image_ref}"
    --file "${dockerfile}"
  )

  if [[ "${NO_CACHE}" == true ]]; then
    cmd+=(--no-cache)
  fi

  if [[ "${PUSH}" == true ]]; then
    cmd+=(--push)
  elif [[ "${LOAD}" == true ]]; then
    cmd+=(--load)
  fi

  cmd+=("${context_dir}")

  printf 'Building %s\n' "${image_ref}"
  printf 'Command:'
  printf ' %q' "${cmd[@]}"
  printf '\n'

  (cd "${REPO_ROOT}" && "${cmd[@]}")
}

main() {
  require_cmd docker
  parse_args "$@"
  validate_args
  ensure_builder

  if [[ "${TARGET}" == "all" || "${TARGET}" == "frontend" ]]; then
    build_image \
      "${REGISTRY}/${FRONTEND_IMAGE}:${TAG}" \
      "frontend/Dockerfile" \
      "frontend"
  fi

  if [[ "${TARGET}" == "all" || "${TARGET}" == "backend" ]]; then
    build_image \
      "${REGISTRY}/${BACKEND_IMAGE}:${TAG}" \
      "backend/Dockerfile" \
      "backend"
  fi
}

main "$@"
