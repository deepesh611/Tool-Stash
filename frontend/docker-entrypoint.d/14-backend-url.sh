#!/bin/sh
# Sourced by the nginx image (must NOT be executable — export has to survive).
# BACKEND_URL is the address *this container* uses to reach the API, not the
# URL in the browser. Do not use localhost.

_strip_slash() {
  echo "$1" | sed 's#/*$##'
}

_is_loopback() {
  case "$1" in
    http://localhost|http://localhost:*|http://127.0.0.1|http://127.0.0.1:*| \
    https://localhost|https://localhost:*|https://127.0.0.1|https://127.0.0.1:*| \
    http://[::1]|http://[::1]:*|https://[::1]|https://[::1]:*)
      return 0
      ;;
  esac
  return 1
}

_host_of() {
  echo "$1" | sed -E 's#^https?://##' | sed 's#/.*##' | sed 's#:.*##'
}

_gateway_ip() {
  gw=$(ip route show default 2>/dev/null | awk '{print $3; exit}')
  if [ -n "$gw" ]; then
    echo "$gw"
    return
  fi
  hex=$(awk '$2 == "00000000" { print $3; exit }' /proc/net/route 2>/dev/null)
  [ -z "$hex" ] && return
  printf "%d.%d.%d.%d\n" \
    "0x$(echo "$hex" | cut -c7-8)" \
    "0x$(echo "$hex" | cut -c5-6)" \
    "0x$(echo "$hex" | cut -c3-4)" \
    "0x$(echo "$hex" | cut -c1-2)"
}

_host_docker_internal_ip() {
  getent hosts host.docker.internal 2>/dev/null | awk '{print $1; exit}'
}

BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8001}"
BACKEND_URL="$(_strip_slash "${BACKEND_URL:-}")"

_pick_host_gateway() {
  internal_ip="$(_host_docker_internal_ip)"
  gateway_ip="$(_gateway_ip)"
  if [ -n "$internal_ip" ]; then
    BACKEND_URL="http://${internal_ip}:${BACKEND_HOST_PORT}"
  elif [ -n "$gateway_ip" ]; then
    BACKEND_URL="http://${gateway_ip}:${BACKEND_HOST_PORT}"
  else
    BACKEND_URL="http://host.docker.internal:${BACKEND_HOST_PORT}"
  fi
}

# Keep http://backend:8000 even if DNS is not ready yet — nginx resolves it
# per request. Only rewrite loopback, which can never reach a sibling container.
if [ -z "$BACKEND_URL" ] || _is_loopback "$BACKEND_URL"; then
  echo "Tool Stash frontend: ${BACKEND_URL:-empty} is not usable inside this container; using host gateway."
  _pick_host_gateway
fi

export BACKEND_URL
echo "Tool Stash frontend: proxying /api → ${BACKEND_URL}"
