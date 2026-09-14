#!/usr/bin/env bash
# Sau flow g4-study-offline: đối chiếu cards trên Supabase local với lịch FSRS — không mất, không nhân đôi.
#   bash scripts/study-sync-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."
docker exec supabase_db_anchor-handoff psql -U postgres -tA -c "
with u as (select id from auth.users where email='eval@anchor.local')
select 'cards='||count(*)||' distinct_questions='||count(distinct question_id)
  ||' reviewed='||count(*) filter (where (fsrs_state->>'reps')::int > 0)
  ||' due_future='||count(*) filter (where due_at > now())
from cards where owner=(select id from u);"
