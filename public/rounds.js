// Shared by the server and browser: round membership must agree in both views.
(function (root) {
    'use strict';
    const MAX_SPAN_DAYS = 14;
    const DAY = 86400000;

    function buildRounds(matches) {
        const groups = matches.filter(m => {
            const date = m.matchDate;
            return ['UCL', 'UEL', 'UECL'].includes(m.tournament) &&
                /^\d{4}-\d{2}-\d{2}$/.test(date || '') &&
                !Number.isNaN(Date.parse(date)) &&
                new Date(date).toISOString().slice(0, 10) === date;
        }).map(m => [m]).sort((a, b) => compare(a[0], b[0]));

        // Merge the closest neighbouring groups first. Never mix two fixtures
        // from one club or bridge a long break just to fill four places.
        // Two weeks accommodates staggered European competition schedules.
        while (true) {
            let best = -1;
            let bestSpan = Infinity;
            for (let i = 0; i < groups.length - 1; i++) {
                const combined = [...groups[i], ...groups[i + 1]];
                if (combined.length > 4 || new Set(combined.map(m => m.team)).size !== combined.length) continue;
                const span = (Date.parse(combined.at(-1).matchDate) - Date.parse(combined[0].matchDate)) / DAY;
                if (span <= MAX_SPAN_DAYS && span < bestSpan) {
                    best = i;
                    bestSpan = span;
                }
            }
            if (best < 0) break;
            groups.splice(best, 2, [...groups[best], ...groups[best + 1]]);
        }
        return groups.map((games, i) => ({
            id: 'round-' + games.map(m => String(m.id)).sort().join('-'),
            number: i + 1,
            startDate: games[0].matchDate,
            endDate: games.at(-1).matchDate,
            matchIds: games.map(m => m.id)
        }));
    }

    function compare(a, b) {
        return a.matchDate.localeCompare(b.matchDate) || String(a.id).localeCompare(String(b.id));
    }

    if (typeof module === 'object' && module.exports) module.exports = { buildRounds };
    else root.EuropeanRounds = { buildRounds };
})(typeof globalThis !== 'undefined' ? globalThis : this);
