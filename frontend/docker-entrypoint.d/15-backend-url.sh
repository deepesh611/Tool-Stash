#!/bin/sh
# Sourced by the nginx image (leave non-executable so export survives).
# BACKEND_URL is the address *this container* uses to reach the API — not the
# URL you open in a browser. localhost/127.0.0.1 here is this container.

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

_is_ipv4() {
  echo "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

_host_resolves() {
  host="$1"
  [ -z "$host" ] && return 1
  _is_ipv4 "$host" && return 0
  getent hosts "$host" >/dev/null 2>&1
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

compose_url=""
host_url=""

if _host_resolves backend; then
  compose_url="http://backend:8000"
fi

internal_ip="$(_host_docker_internal_ip)"
gateway_ip="$(_gateway_ip)"
if [ -n "$internal_ip" ]; then
  host_url="http://${internal_ip}:${BACKEND_HOST_PORT}"
elif [ -n "$gateway_ip" ]; then
  host_url="http://${gateway_ip}:${BACKEND_HOST_PORT}"
fi

_pick_reachable() {
  if [ -n "$compose_url" ]; then
    BACKEND_URL="$compose_url"
  elif [ -n "$host_url" ]; then
    BACKEND_URL="$host_url"
  else
    BACKEND_URL="http://host.docker.internal:${BACKEND_HOST_PORT}"
  fi
}

if [ -z "$BACKEND_URL" ] || _is_loopback "$BACKEND_URL"; then
  _pick_reachable
else
  target="$(_host_of "$BACKEND_URL")"
  if ! _host_resolves "$target"; then
    echo "Tool Stash frontend: ${BACKEND_URL} is not reachable from this container; picking a fallback."
    _pick_reachable
  fi
fi

export BACKEND_URL
echo "Tool Stash frontend: proxying /api → ${BACKEND_URL}"
