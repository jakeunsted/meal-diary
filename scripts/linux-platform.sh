#!/bin/sh
# Shared Linux platform detection for Docker/Railway installs.
case "$(uname -m)" in
  aarch64 | arm64)
    LINUX_ESBUILD_ARCH="linux-arm64"
    arch_suffix="arm64-gnu"
    oxc_platform="linux-arm64-gnu"
    ;;
  x86_64 | amd64)
    LINUX_ESBUILD_ARCH="linux-x64"
    arch_suffix="x64-gnu"
    oxc_platform="linux-x64-gnu"
    ;;
  *)
    echo "Unsupported architecture for native bindings: $(uname -m)" >&2
    exit 1
    ;;
esac

export LINUX_ESBUILD_ARCH arch_suffix oxc_platform
