#!/bin/sh
# Sourced. Runs after 15-local-resolvers.envsh.
if [ -z "${NGINX_LOCAL_RESOLVERS}" ]; then
  NGINX_LOCAL_RESOLVERS=127.0.0.11
  export NGINX_LOCAL_RESOLVERS
fi
