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
dates. One dashboard selector controls both weekly predictions and ranking,
preserves the selected round on refresh, and ignores outdated ranking replies
after changing rounds or rooms. Round IDs derive from their member match IDs, so input ordering and
result updates do not change membership. Schedule edits can change membership;
refresh clients after a schedule correction.

`GET /api/weekly-competition?roomId=1&roundId=<round-id>` returns round metadata,
`complete`, `remaining`, and `standings`. The former `weekStart` selector is no
longer accepted: a calendar week cannot identify a cross-week round. Unknown
round IDs return 404. Standings stay hidden until every member has `played=true`
and result points of 0, 1 or 3. Ranking uses correct-guess points plus bonuses descending, then
correct guesses descending, then name. A correct 0-point guess counts as
correct. Room lock and guess visibility rules are unchanged.

## Fixture source caution

The tracked source is `SEED_MATCHES` in `db.js`. The formerly referenced
`data/fixture_26_27.csv` is absent and `data/` is ignored. Startup
upserts fixture dates and league context from the embedded seed, preserving
results and guesses. Database-only fixture corrections will be overwritten on
the next startup unless the seed is corrected too.

The reviewed domestic context correction and TFF source links are in
[docs/super-lig-context-review.md](docs/super-lig-context-review.md).
The guarded updater is `scripts/update-league-context.js`; see the report for
dry-run, backup, and application instructions. Do not start the app to run a
dry-run: normal startup performs its existing broad seed sync.


## Manual prediction bonuses

In Admin → **Bonus points**, choose the correct prediction by match and player,
enter the **total awarded points** (e.g. 8), add a reason, and save. Every correct
guess earns 1 point, so an 8-point award stores a +7 bonus. Repeated saves replace
the award rather than accumulating it. Save 1 to remove it.
Bonuses follow the prediction in every room containing the player and count in
weekly and overall points and rankings. Correct-guess counts remain unchanged.
Ranking sorts by points, correct guesses, then name. A result correction suspends
the bonus whenever the prediction is no longer correct. The weekly overview shows
the bonus and its reason. No player is awarded automatically by this code change.

Startup adds `bonus_points` and `bonus_reason` to existing guesses with zero/empty
defaults; existing results and prediction values are preserved. Match-outcome
values (0/1/3) describe predictions, not the score for a correct prediction.

## Trabzonspor schedule correction — 5 November 2026

The UEFA [team fixtures](https://www.uefa.com/uefaconferenceleague/clubs/52731--trabzonspor/matches/)
and [league-phase schedule](https://www.uefa.com/uefaconferenceleague/news/02a8-217779a8ad3a-b4c75bb82a48-1000--conference-league-league-phase-fixtures/)
confirm the following dates. IDs remain attached to opponents, not matchday numbers:

| ID | Opponent | Date |
|---|---|---|
| ts_1 | KuPS Kuopio (away) | 2026-10-15 |
| ts_2 | Hearts (home) | 2026-10-22 |
| ts_6 | Freiburg (home) | 2026-11-05 |
| ts_5 | CSKA Sofia (away) | 2026-11-26 |
| ts_3 | Jablonec (home) | 2026-12-10 |
| ts_4 | Red Star Belgrade (away) | 2026-12-17 |

Deploy this version and restart the server to apply the embedded seed through
its existing database sync. Refresh clients afterwards to rebuild rounds.
Predictions, bonuses and recorded results stay with the same opponent and ID;
no results are inferred or moved between opponents. If a result was previously
entered against the wrong opponent, correct it separately in Admin.
Surrounding league context follows the corrected dates using the checked-in TFF
schedule. The October context migration is historical and intentionally rejects
these corrected dates; do not rerun it against the November schedule.
