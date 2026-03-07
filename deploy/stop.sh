#!/bin/bash
##############################################################################
# Stop all services
##############################################################################
cd "$(dirname "$0")/.."
echo "Stopping all services..."
docker compose down
echo "Done. All services stopped."
