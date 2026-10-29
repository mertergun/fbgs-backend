# Süper Lig context verification — 29 October 2026

Only prev_league_context and next_league_context are corrected for the 30 European fixtures. European dates, identity, results, predictions and grouping are preserved.

## Sources and method

The CSV referenced by old comments is absent; data/ is ignored. db.js remains the canonical startup seed. Official TFF weekly fixture tables were retrieved on 2026-10-29, covering weeks 1–20; the checked-in evidence retains the four clubs for weeks 4–19, bounding every European fixture. Dates are Turkish local calendar dates (Europe/Istanbul). Each evidence record links to the weekly table and individual match details. Club sponsor names are normalized only for display.

[Week 4 schedule revision](https://www.tff.org/default.aspx?pageID=201&ftxtID=51232) and [weeks 7–16 schedule announcement](https://www.tff.org/default.aspx?pageID=201&ftxtID=51338) were checked. The latter explicitly moves the derby to October 26 and notes future cup-related changes remain possible. Latest weekly tables take precedence over original seed assumptions.

Previous/next means the closest listed domestic game chronologically before/after the stored European date, not the original assumed league week. Weeks 4–19 each contain one game per club: no byes are present in this audited interval. The latest table dates handle schedule revisions without treating league week numbers as dates. No domestic game falls on the same date as one of these European fixtures.

## Uncertainty

January weeks 17–19 have a listed date but no published kickoff time. As a conservative inference, those dates and their placement around European games are provisional; the UI explicitly says “geçici”. Reverify when TFF publishes detailed January scheduling. Games with published times are described as scheduled, not guaranteed never to change. European dates themselves were not audited or corrected in this change.

No live database connection is configured in this workspace. The report compares the old tracked seed with the corrected seed, not deployed rows. The updater defaults to dry-run, checks deployed values against the reviewed old/new values, and refuses unexpected drift. Isolated PostgreSQL test output is recorded separately.

## Old/new context by European fixture

| Match | Side | Old | Corrected | Evidence |
|---|---|---|---|---|
| bjk_1 | Previous | Hafta 5: Erzurumspor FK (🏠 - 13 Eyl) | Hafta 5: Erzurumspor FK (🏠 - 11 Eyl) | [TFF week 5](https://www.tff.org/Default.aspx?hafta=5&pageID=198), [match 317827](https://www.tff.org/Default.aspx?pageId=29&macId=317827) |
| bjk_1 | Next | Hafta 6: Amed SK (✈️ - 20 Eyl) | Hafta 6: Amed SK (✈️ - 20 Eyl) | [TFF week 6](https://www.tff.org/Default.aspx?hafta=6&pageID=198), [match 317832](https://www.tff.org/Default.aspx?pageId=29&macId=317832) |
| bjk_2 | Previous | Hafta 8: Trabzonspor (✈️ - 4 Eki) | Hafta 7: Kocaelispor (🏠 - 11 Eki) | [TFF week 7](https://www.tff.org/Default.aspx?hafta=7&pageID=198), [match 317845](https://www.tff.org/Default.aspx?pageId=29&macId=317845) |
| bjk_2 | Next | Hafta 9: İstanbul Başakşehir (🏠 - 18 Eki) | Hafta 8: Trabzonspor (✈️ - 19 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317847](https://www.tff.org/Default.aspx?pageId=29&macId=317847) |
| bjk_3 | Previous | Hafta 9: İstanbul Başakşehir (🏠 - 18 Eki) | Hafta 8: Trabzonspor (✈️ - 19 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317847](https://www.tff.org/Default.aspx?pageId=29&macId=317847) |
| bjk_3 | Next | Hafta 10: Samsunspor (🏠 - 25 Eki) | Hafta 9: İstanbul Başakşehir (🏠 - 26 Eki) | [TFF week 9](https://www.tff.org/Default.aspx?hafta=9&pageID=198), [match 317863](https://www.tff.org/Default.aspx?pageId=29&macId=317863) |
| bjk_4 | Previous | Hafta 11: Göztepe (✈️ - 1 Kas) | Hafta 10: Kasımpaşa (✈️ - 1 Kas) | [TFF week 10](https://www.tff.org/Default.aspx?hafta=10&pageID=198), [match 317866](https://www.tff.org/Default.aspx?pageId=29&macId=317866) |
| bjk_4 | Next | Hafta 12: Gaziantep FK (🏠 - 8 Kas) | Hafta 11: Gençlerbirliği (🏠 - 8 Kas) | [TFF week 11](https://www.tff.org/Default.aspx?hafta=11&pageID=198), [match 317881](https://www.tff.org/Default.aspx?pageId=29&macId=317881) |
| bjk_5 | Previous | Hafta 13: Galatasaray (🏠 - 22 Kas) | Hafta 12: Konyaspor (✈️ - 22 Kas) | [TFF week 12](https://www.tff.org/Default.aspx?hafta=12&pageID=198), [match 317888](https://www.tff.org/Default.aspx?pageId=29&macId=317888) |
| bjk_5 | Next | Hafta 14: Kocaelispor (🏠 - 29 Kas) | Hafta 13: Galatasaray (🏠 - 30 Kas) | [TFF week 13](https://www.tff.org/Default.aspx?hafta=13&pageID=198), [match 317899](https://www.tff.org/Default.aspx?pageId=29&macId=317899) |
| bjk_6 | Previous | Hafta 15: Alanyaspor (✈️ - 6 Ara) | Hafta 14: Samsunspor (🏠 - 6 Ara) | [TFF week 14](https://www.tff.org/Default.aspx?hafta=14&pageID=198), [match 317908](https://www.tff.org/Default.aspx?pageId=29&macId=317908) |
| bjk_6 | Next | Hafta 16: Çaykur Rizespor (🏠 - 13 Ara) | Hafta 15: Gaziantep FK (✈️ - 14 Ara) | [TFF week 15](https://www.tff.org/Default.aspx?hafta=15&pageID=198), [match 317910](https://www.tff.org/Default.aspx?pageId=29&macId=317910) |
| bjk_7 | Previous | Hafta 17: Eyüpspor (✈️ - 17 Oca) | Hafta 17: Göztepe (✈️ - 17 Oca, geçici) | [TFF week 17](https://www.tff.org/Default.aspx?hafta=17&pageID=198), [match 317932](https://www.tff.org/Default.aspx?pageId=29&macId=317932) — provisional |
| bjk_7 | Next | Hafta 18: Alanyaspor (✈️ - 24 Oca) | Hafta 18: Eyüpspor (✈️ - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317944](https://www.tff.org/Default.aspx?pageId=29&macId=317944) — provisional |
| bjk_8 | Previous | Hafta 18: Alanyaspor (✈️ - 24 Oca) | Hafta 18: Eyüpspor (✈️ - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317944](https://www.tff.org/Default.aspx?pageId=29&macId=317944) — provisional |
| bjk_8 | Next | Hafta 19: Çorum FK (✈️ - 31 Oca) | Hafta 19: Alanyaspor (🏠 - 31 Oca, geçici) | [TFF week 19](https://www.tff.org/Default.aspx?hafta=19&pageID=198), [match 317948](https://www.tff.org/Default.aspx?pageId=29&macId=317948) — provisional |
| fb_1 | Previous | Hafta 4: Beşiktaş (🏠 - 6 Eyl) | Hafta 4: Beşiktaş (🏠 - 5 Eyl) | [TFF week 4](https://www.tff.org/Default.aspx?hafta=4&pageID=198), [match 317817](https://www.tff.org/Default.aspx?pageId=29&macId=317817) |
| fb_1 | Next | Hafta 5: Gaziantep FK (✈️ - 13 Eyl) | Hafta 5: Gaziantep FK (✈️ - 14 Eyl) | [TFF week 5](https://www.tff.org/Default.aspx?hafta=5&pageID=198), [match 317820](https://www.tff.org/Default.aspx?pageId=29&macId=317820) |
| fb_2 | Previous | Hafta 8: Alanyaspor (🏠 - 4 Eki) | Hafta 7: Çaykur Rizespor (✈️ - 10 Eki) | [TFF week 7](https://www.tff.org/Default.aspx?hafta=7&pageID=198), [match 317841](https://www.tff.org/Default.aspx?pageId=29&macId=317841) |
| fb_2 | Next | Hafta 9: Galatasaray (✈️ - 18 Eki) | Hafta 8: Alanyaspor (🏠 - 17 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317853](https://www.tff.org/Default.aspx?pageId=29&macId=317853) |
| fb_3 | Previous | Hafta 9: Galatasaray (✈️ - 18 Eki) | Hafta 8: Alanyaspor (🏠 - 17 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317853](https://www.tff.org/Default.aspx?pageId=29&macId=317853) |
| fb_3 | Next | Hafta 10: Göztepe (🏠 - 25 Eki) | Hafta 9: Galatasaray (✈️ - 26 Eki) | [TFF week 9](https://www.tff.org/Default.aspx?hafta=9&pageID=198), [match 317862](https://www.tff.org/Default.aspx?pageId=29&macId=317862) |
| fb_4 | Previous | Hafta 11: Çorum FK (✈️ - 1 Kas) | Hafta 10: Göztepe (🏠 - 31 Eki) | [TFF week 10](https://www.tff.org/Default.aspx?hafta=10&pageID=198), [match 317871](https://www.tff.org/Default.aspx?pageId=29&macId=317871) |
| fb_4 | Next | Hafta 12: Kocaelispor (✈️ - 8 Kas) | Hafta 11: Çorum FK (✈️ - 8 Kas) | [TFF week 11](https://www.tff.org/Default.aspx?hafta=11&pageID=198), [match 317879](https://www.tff.org/Default.aspx?pageId=29&macId=317879) |
| fb_5 | Previous | Hafta 13: Erzurumspor FK (🏠 - 22 Kas) | Hafta 12: Kocaelispor (✈️ - 21 Kas) | [TFF week 12](https://www.tff.org/Default.aspx?hafta=12&pageID=198), [match 317890](https://www.tff.org/Default.aspx?pageId=29&macId=317890) |
| fb_5 | Next | Hafta 14: İstanbul Başakşehir (✈️ - 29 Kas) | Hafta 13: Erzurumspor FK (🏠 - 29 Kas) | [TFF week 13](https://www.tff.org/Default.aspx?hafta=13&pageID=198), [match 317898](https://www.tff.org/Default.aspx?pageId=29&macId=317898) |
| fb_6 | Previous | Hafta 15: Trabzonspor (🏠 - 6 Ara) | Hafta 14: İstanbul Başakşehir (✈️ - 5 Ara) | [TFF week 14](https://www.tff.org/Default.aspx?hafta=14&pageID=198), [match 317903](https://www.tff.org/Default.aspx?pageId=29&macId=317903) |
| fb_6 | Next | Hafta 16: Kasımpaşa (✈️ - 13 Ara) | Hafta 15: Trabzonspor (🏠 - 13 Ara) | [TFF week 15](https://www.tff.org/Default.aspx?hafta=15&pageID=198), [match 317916](https://www.tff.org/Default.aspx?pageId=29&macId=317916) |
| fb_7 | Previous | Hafta 17: Amed SK (🏠 - 17 Oca) | Hafta 17: Amed SK (🏠 - 17 Oca, geçici) | [TFF week 17](https://www.tff.org/Default.aspx?hafta=17&pageID=198), [match 317934](https://www.tff.org/Default.aspx?pageId=29&macId=317934) — provisional |
| fb_7 | Next | Hafta 18: Konyaspor (✈️ - 24 Oca) | Hafta 18: Gençlerbirliği (🏠 - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317941](https://www.tff.org/Default.aspx?pageId=29&macId=317941) — provisional |
| fb_8 | Previous | Hafta 18: Konyaspor (✈️ - 24 Oca) | Hafta 18: Gençlerbirliği (🏠 - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317941](https://www.tff.org/Default.aspx?pageId=29&macId=317941) — provisional |
| fb_8 | Next | Hafta 19: Samsunspor (✈️ - 31 Oca) | Hafta 19: Konyaspor (✈️ - 31 Oca, geçici) | [TFF week 19](https://www.tff.org/Default.aspx?hafta=19&pageID=198), [match 317952](https://www.tff.org/Default.aspx?pageId=29&macId=317952) — provisional |
| gs_1 | Previous | Hafta 4: İstanbul Başakşehir (✈️ - 6 Eyl) | Hafta 4: İstanbul Başakşehir (✈️ - 4 Eyl) | [TFF week 4](https://www.tff.org/Default.aspx?hafta=4&pageID=198), [match 317813](https://www.tff.org/Default.aspx?pageId=29&macId=317813) |
| gs_1 | Next | Hafta 5: Kocaelispor (🏠 - 13 Eyl) | Hafta 5: Kocaelispor (🏠 - 13 Eyl) | [TFF week 5](https://www.tff.org/Default.aspx?hafta=5&pageID=198), [match 317826](https://www.tff.org/Default.aspx?pageId=29&macId=317826) |
| gs_2 | Previous | Hafta 8: Gençlerbirliği (✈️ - 4 Eki) | Hafta 7: Kasımpaşa (🏠 - 9 Eki) | [TFF week 7](https://www.tff.org/Default.aspx?hafta=7&pageID=198), [match 317844](https://www.tff.org/Default.aspx?pageId=29&macId=317844) |
| gs_2 | Next | Hafta 9: Fenerbahçe (🏠 - 18 Eki) | Hafta 8: Gençlerbirliği (✈️ - 17 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317851](https://www.tff.org/Default.aspx?pageId=29&macId=317851) |
| gs_3 | Previous | Hafta 9: Fenerbahçe (🏠 - 18 Eki) | Hafta 8: Gençlerbirliği (✈️ - 17 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317851](https://www.tff.org/Default.aspx?pageId=29&macId=317851) |
| gs_3 | Next | Hafta 10: Konyaspor (✈️ - 25 Eki) | Hafta 9: Fenerbahçe (🏠 - 26 Eki) | [TFF week 9](https://www.tff.org/Default.aspx?hafta=9&pageID=198), [match 317862](https://www.tff.org/Default.aspx?pageId=29&macId=317862) |
| gs_4 | Previous | Hafta 11: Amed SK (🏠 - 1 Kas) | Hafta 10: Konyaspor (✈️ - 30 Eki) | [TFF week 10](https://www.tff.org/Default.aspx?hafta=10&pageID=198), [match 317870](https://www.tff.org/Default.aspx?pageId=29&macId=317870) |
| gs_4 | Next | Hafta 12: Samsunspor (🏠 - 8 Kas) | Hafta 11: Amed SK (🏠 - 7 Kas) | [TFF week 11](https://www.tff.org/Default.aspx?hafta=11&pageID=198), [match 317880](https://www.tff.org/Default.aspx?pageId=29&macId=317880) |
| gs_5 | Previous | Hafta 13: Beşiktaş (✈️ - 22 Kas) | Hafta 12: Samsunspor (🏠 - 21 Kas) | [TFF week 12](https://www.tff.org/Default.aspx?hafta=12&pageID=198), [match 317889](https://www.tff.org/Default.aspx?pageId=29&macId=317889) |
| gs_5 | Next | Hafta 14: Çaykur Rizespor (🏠 - 29 Kas) | Hafta 13: Beşiktaş (✈️ - 30 Kas) | [TFF week 13](https://www.tff.org/Default.aspx?hafta=13&pageID=198), [match 317899](https://www.tff.org/Default.aspx?pageId=29&macId=317899) |
| gs_6 | Previous | Hafta 15: Eyüpspor (✈️ - 6 Ara) | Hafta 14: Çaykur Rizespor (🏠 - 4 Ara) | [TFF week 14](https://www.tff.org/Default.aspx?hafta=14&pageID=198), [match 317907](https://www.tff.org/Default.aspx?pageId=29&macId=317907) |
| gs_6 | Next | Hafta 16: Gaziantep FK (🏠 - 13 Ara) | Hafta 15: Eyüpspor (✈️ - 12 Ara) | [TFF week 15](https://www.tff.org/Default.aspx?hafta=15&pageID=198), [match 317911](https://www.tff.org/Default.aspx?pageId=29&macId=317911) |
| gs_7 | Previous | Hafta 17: Çorum FK (✈️ - 17 Oca) | Hafta 17: Gaziantep FK (✈️ - 17 Oca, geçici) | [TFF week 17](https://www.tff.org/Default.aspx?hafta=17&pageID=198), [match 317928](https://www.tff.org/Default.aspx?pageId=29&macId=317928) — provisional |
| gs_7 | Next | Hafta 18: Erzurumspor FK (🏠 - 24 Oca) | Hafta 18: Çorum FK (✈️ - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317943](https://www.tff.org/Default.aspx?pageId=29&macId=317943) — provisional |
| gs_8 | Previous | Hafta 18: Erzurumspor FK (🏠 - 24 Oca) | Hafta 18: Çorum FK (✈️ - 24 Oca, geçici) | [TFF week 18](https://www.tff.org/Default.aspx?hafta=18&pageID=198), [match 317943](https://www.tff.org/Default.aspx?pageId=29&macId=317943) — provisional |
| gs_8 | Next | Hafta 19: Göztepe (🏠 - 31 Oca) | Hafta 19: Erzurumspor FK (🏠 - 31 Oca, geçici) | [TFF week 19](https://www.tff.org/Default.aspx?hafta=19&pageID=198), [match 317954](https://www.tff.org/Default.aspx?pageId=29&macId=317954) — provisional |
| ts_1 | Previous | Hafta 8: Beşiktaş (🏠 - 4 Eki) | Hafta 7: Samsunspor (✈️ - 10 Eki) | [TFF week 7](https://www.tff.org/Default.aspx?hafta=7&pageID=198), [match 317846](https://www.tff.org/Default.aspx?pageId=29&macId=317846) |
| ts_1 | Next | Hafta 9: Eyüpspor (✈️ - 18 Eki) | Hafta 8: Beşiktaş (🏠 - 19 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317847](https://www.tff.org/Default.aspx?pageId=29&macId=317847) |
| ts_2 | Previous | Hafta 9: Eyüpspor (✈️ - 18 Eki) | Hafta 8: Beşiktaş (🏠 - 19 Eki) | [TFF week 8](https://www.tff.org/Default.aspx?hafta=8&pageID=198), [match 317847](https://www.tff.org/Default.aspx?pageId=29&macId=317847) |
| ts_2 | Next | Hafta 10: Gaziantep FK (🏠 - 25 Eki) | Hafta 9: Çaykur Rizespor (✈️ - 26 Eki) | [TFF week 9](https://www.tff.org/Default.aspx?hafta=9&pageID=198), [match 317859](https://www.tff.org/Default.aspx?pageId=29&macId=317859) |
| ts_3 | Previous | Hafta 12: Eyüpspor (🏠 - 8 Kas) | Hafta 11: Alanyaspor (✈️ - 8 Kas) | [TFF week 11](https://www.tff.org/Default.aspx?hafta=11&pageID=198), [match 317876](https://www.tff.org/Default.aspx?pageId=29&macId=317876) |
| ts_3 | Next | Hafta 13: Göztepe (✈️ - 22 Kas) | Hafta 12: Eyüpspor (🏠 - 22 Kas) | [TFF week 12](https://www.tff.org/Default.aspx?hafta=12&pageID=198), [match 317883](https://www.tff.org/Default.aspx?pageId=29&macId=317883) |
| ts_4 | Previous | Hafta 13: Göztepe (✈️ - 22 Kas) | Hafta 12: Eyüpspor (🏠 - 22 Kas) | [TFF week 12](https://www.tff.org/Default.aspx?hafta=12&pageID=198), [match 317883](https://www.tff.org/Default.aspx?pageId=29&macId=317883) |
| ts_4 | Next | Hafta 14: Samsunspor (🏠 - 29 Kas) | Hafta 13: Göztepe (✈️ - 30 Kas) | [TFF week 13](https://www.tff.org/Default.aspx?hafta=13&pageID=198), [match 317896](https://www.tff.org/Default.aspx?pageId=29&macId=317896) |
| ts_5 | Previous | Hafta 15: Fenerbahçe (✈️ - 6 Ara) | Hafta 14: Çorum FK (🏠 - 6 Ara) | [TFF week 14](https://www.tff.org/Default.aspx?hafta=14&pageID=198), [match 317901](https://www.tff.org/Default.aspx?pageId=29&macId=317901) |
| ts_5 | Next | Hafta 16: Kocaelispor (🏠 - 13 Ara) | Hafta 15: Fenerbahçe (✈️ - 13 Ara) | [TFF week 15](https://www.tff.org/Default.aspx?hafta=15&pageID=198), [match 317916](https://www.tff.org/Default.aspx?pageId=29&macId=317916) |
| ts_6 | Previous | Hafta 16: Kocaelispor (🏠 - 13 Ara) | Hafta 15: Fenerbahçe (✈️ - 13 Ara) | [TFF week 15](https://www.tff.org/Default.aspx?hafta=15&pageID=198), [match 317916](https://www.tff.org/Default.aspx?pageId=29&macId=317916) |
| ts_6 | Next | Hafta 17: Kasımpaşa (🏠 - 17 Oca) | Hafta 16: Kocaelispor (🏠 - 21 Ara) | [TFF week 16](https://www.tff.org/Default.aspx?hafta=16&pageID=198), [match 317919](https://www.tff.org/Default.aspx?pageId=29&macId=317919) |

## Validation and dry-run output

`npm test`: 16 tests passed, including all eight European-round/shared-selector regressions. The
new tests verify the reviewed evidence against every seed row, unchanged
European identity and round membership, backups, fail-closed drift detection,
transaction rollback, idempotency, and unchanged guesses, players, rooms and
results. The isolated database uses the reviewed original seed as its baseline.

Actual isolated baseline dry-run summary:

```json
{"expectedRows":30,"pendingRows":30,"alreadyCorrectRows":0,"changedFields":58}
```

Actual local CLI dry-run output (exit 1; no live connection attempted):

```text
DATABASE_URL is not configured. No database was accessed.
```

The live database must still be checked. The 30/58 figures are the seed-baseline
comparison, not a claim about the deployed database.

## Application instructions (after approval)

1. Review the PR, source evidence, and provisional January entries. Do not deploy
   or start the corrected seed yet: the existing startup sync would update live
   context automatically, bypassing this script's backup and drift review.
2. From this branch, install dependencies with `npm ci`. Configure `DATABASE_URL`
   in the environment or an untracked `.env` using your existing secure process.
   Do not paste it into chat or commit it. The script uses normal pg TLS settings
   from the connection URL and never imports database initialization.
3. Run `node scripts/update-league-context.js --dry-run`. This uses a read-only
   transaction and outputs old/new values. Review all pending changes. Unexpected
   identities, context values, or missing rows abort the entire operation. Values
   already corrected are accepted and skipped. If actual data differs, stop and
   prepare a new reviewed manifest; do not force an overwrite.
4. After approval to apply, create a local `backups` directory if needed. Run:

   ```text
   node scripts/update-league-context.js --apply --backup backups/2026-10-29.context-backup.json
   ```

   Use a new backup filename on each attempt with pending changes. The script
   locks the 30 expected rows, writes an exclusive before-image export, updates
   only the two context columns by ID with old-value checks, verifies protected
   fields and results, and commits once. Export failure, unexpected row counts,
   drift, or protected-field changes cause rollback. A failed apply may leave a
   valid before-image export; it will not be overwritten by a later attempt.
5. Run the dry-run again; pendingRows must be zero. Keep the backup outside Git.
   Then merge/deploy the matching seed correction so startup will preserve the
   reviewed context. This change has not been merged, deployed, or applied live
   as part of preparation. A rerun against already-correct rows performs no
   updates and does not replace an existing backup.

Rollback, if needed, should be a separate reviewed context-only patch using the
before-image and expected-current-value checks. Never reset or reseed tables.
