# European prediction game

Run `npm ci`, then `npm start` with the existing database environment configured.
Run `npm test` for isolated PostgreSQL and browser DOM regression tests. Tests do
not run database initialization or connect to the configured database.

## European rounds

The weekly competition and locked-room predictions use `public/rounds.js` in
both Node and the browser. UCL, UEL and UECL fixtures with valid dates are sorted
by date and ID. The closest neighbouring groups (smallest combined date span)
merge first, up to four games, with at most one fixture per club. Equal spans
prefer the earlier group. A round spans at most 14 days, allowing staggered
European schedules without filling gaps across long breaks. Missing club
fixtures leave smaller rounds; unmatched games remain separate. No fixture is
reassigned by its completion status.

Selectors display sequential round numbers and the earliest/latest fixture
dates. Round IDs derive from their member match IDs, so input ordering and
result updates do not change membership. Schedule edits can change membership;
refresh clients after a schedule correction.

`GET /api/weekly-competition?roomId=1&roundId=<round-id>` returns round metadata,
`complete`, `remaining`, and `standings`. The former `weekStart` selector is no
longer accepted: a calendar week cannot identify a cross-week round. Unknown
round IDs return 404. Standings stay hidden until every member has `played=true`
and result points of 0, 1 or 3. Ranking stays correct guesses descending, then
earned match points descending, then name. A correct 0-point guess counts as
correct. Room lock and guess visibility rules are unchanged.

## Fixture source caution

The tracked source is `SEED_MATCHES` in `db.js`. Its comments reference
`data/fixture_26_27.csv`, but that CSV is absent and `data/` is ignored. Startup
upserts fixture dates and league context from the embedded seed, preserving
results and guesses. Database-only fixture corrections will be overwritten on
the next startup unless the seed is corrected too.
