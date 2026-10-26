#!/bin/bash

# =========================================================================
# C2-Network Database Setup Orchestration Script
# =========================================================================

echo "Starting C2-Network database setup..."

# Direct Neon PostgreSQL Connection String
DB_URL="postgresql://neondb_owner:npg_du79hBYtnHfE@ep-shy-math-b4p3r1cw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"

echo "Running 01_network_schema.sql (or schema.sql)..."
psql "$DB_URL" -f schema.sql

echo "Running functions.sql..."
psql "$DB_URL" -f functions.sql

echo "Running triggers.sql..."
psql "$DB_URL" -f triggers.sql

echo "Running views.sql..."
psql "$DB_URL" -f views.sql

echo "Running seed_dev.sql..."
psql "$DB_URL" -f seed_dev.sql

echo "C2-Network database setup completed successfully!"