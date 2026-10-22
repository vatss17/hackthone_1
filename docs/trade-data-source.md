# UAE trade-data source assessment (Demo Sprint 4)

**Chosen source:** UN Comtrade database, public preview API (`https://comtradeapi.un.org/public/v1/preview/C/A/HS`), published by the United Nations Statistics Division. Assessed and queried on 2026-10-22.

## Findings

| Question | Finding |
|---|---|
| API or download | The public preview endpoint answers without a key. It returns one period per request and a small row limit, so a full dataset needs the paid or registered tiers. |
| Licence and attribution | Two official texts point in different directions (see "Re-dissemination guidance" below). The older licence agreement (`comtrade.un.org/licenseagreement.html`) says publication, redistribution, commercial use and automated downloading need **prior written permission from the UN Statistics Division**. The newer re-dissemination FAQ allows limited displays and free visualizations of small datasets without a licence. No attribution wording is specified. **No written permission or licence has been obtained or granted, and this project does not claim one.** |
| Classification granularity | Annual data by HS heading (4-digit shown here; 6-digit is available). Years up to 2021 are reported under HS 2017 and 2022 onward under HS 2022, so a series can cross a revision. |
| Coverage and frequency | Annual. The snapshot holds UAE-reported imports and India-reported exports to the UAE for the years the source returned (the UAE had not reported 2024 at retrieval). |
| UAE imports from India | **Not available directly.** The UAE's reports contain no partner-country detail in this source (requests for partner India returned no rows). India's own reported exports to the UAE are used as mirror data. They are valued differently (FOB against CIF) and timed differently, so the two series are shown side by side and never divided or subtracted. |
| Paid subscription | Not needed for the snapshot. Licence permission is a separate matter. |

## Re-dissemination guidance (reviewed 2026-10-22)

From the UN Comtrade re-dissemination FAQ, as read by us (not legal advice):

- Displaying a **limited amount** of data in tables, graphs or visualizations does not need a licence.
- **Free** visualization or analytics applications built on the data do not need a licence.
- Storing **fewer than 100,000 records** for a commercial service does not need a distribution licence.
- **Transformed** data (more than rounding or reformatting) may be shared.
- The restrictions target **APIs and bulk downloads** of the data.

Why this project still excludes the data from its repository:

1. The repository at `github.com/vatss17/hackthone_1` is **public**. Committing the file would publish the raw records, which is closer to redistribution than to a limited display.
2. The older licence page is stricter and was not withdrawn, so the two texts conflict.
3. The boundaries are not defined: what counts as "limited", whether "internal use" covers a demo, whether a non-profit or hackathon use is treated differently, and what "substantially different" means.
4. Nothing has been confirmed in writing by the UN Statistics Division.

**Remaining uncertainty:** whether showing a few headline figures per product in a free product demo is covered by the FAQ exceptions. Until that is confirmed in writing (or the data is replaced by a source whose terms clearly allow it), treat the position as unresolved.

## What was integrated

A one-off, rate-limited snapshot (`scripts/fetch-trade-evidence.mjs`, 14 requests, 91 records) of seven plastic headings (3916, 3917, 3923, 3924, 3925, 3926, 9403), written to **`src/data/restricted/uae-trade-comtrade.json`** with its retrieval date. That folder is in `.gitignore`: the file is **not committed and not in the public repository**. The original research was kept locally, not deleted. Screenshots that show its values are kept in the ignored `docs/screenshots/restricted/`.

The app does not call Comtrade at run time. It reads the local file on the server only, and only when the operator sets `TRADE_SNAPSHOT_DISPLAY=internal-demo` for that process. In any other deployment (a fresh clone, a public host) there is no file or no flag, so every evidence panel shows an honest empty state: the source, why nothing is shown, and that nothing is estimated. Opportunities, the calculator, screening, the roadmap and the documents all work without it. Evidence is always labelled a dated snapshot of reported data, never live and never demand.

No value is estimated, extrapolated or converted. There are no growth rates, no unit prices and no market shares.

## To show the data in a local internal demo

```bash
# put your own retrieved copy at src/data/restricted/uae-trade-comtrade.json (or run the fetch script once)
TRADE_SNAPSHOT_DISPLAY=internal-demo npm run dev
```

## Before any public sharing of the figures

Ask the UN Statistics Division in writing whether this use falls under the FAQ exceptions (contact details are on the Comtrade site), or replace the source (UAE Federal Competitiveness and Statistics Centre, Dubai Statistics Center, or a Comtrade subscription with redistribution rights). Do not set the flag on a public deployment until then.
