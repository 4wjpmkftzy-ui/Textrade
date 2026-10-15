#!/usr/bin/env bash
# 手元のPostgreSQLに使い捨てのデータベースを作り、設計図(マイグレーション)を適用してから
# セキュリティテストを実行します。
#   使い方: bash supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=textrade_test
PSQL=(psql -v ON_ERROR_STOP=1 -q -X -o /dev/null)

dropdb --if-exists "$DB"
createdb "$DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/local_stub.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -f supabase/tests/security_test.sql
dropdb "$DB"
