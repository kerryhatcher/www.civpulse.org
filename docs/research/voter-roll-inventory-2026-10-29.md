# Located SOS voter rolls — October 29, 2026

The owner confirmed that the Bibb and Houston SOS registration rolls on
**Kudzu** are the requested early-2026 source files. Requested eventual access
is **administrators only**, not all authenticated users. This step locates and
documents the sources; it does not import records or implement access controls.
No individual voter records are included here.

## Confirmed source directory on Kudzu

`/mnt/storage/projects_old/projects/voter-app/data/import/voter/gasos/`

| File | Snapshot date in filename | Bytes | Data rows, excluding header |
| --- | --- | ---: | ---: |
| `Bibb-20260203.csv` | 2026-02-03 | 26,494,419 | 116,198 |
| `HOUSTON-2026.02.02.csv` | 2026-02-02 | 34,326,099 | 126,114 |

Both files have the same 53-column header, including registration number,
registration status, name, birth year, residence/mailing address, precincts,
district assignments and registration/last-vote dates. Row counts were measured
from nonempty CSV lines; source checksums were calculated from the original
bytes and match the adjacent `.csv.sha512.txt` sidecars and the old project's
`voter-api/data/data.md` inventory. These are historical registration snapshots,
not current registration totals or records of ballot choices.

SHA-512:

```text
Bibb-20260203.csv
4e17e13480a4359fc5442d507f78ed9c3b4144e28f0e02c371d5078e473acfbd172f6ae82205f6abef6ec4a82664565f34808930a47b88e09114fb3c282d7b97

HOUSTON-2026.02.02.csv
4438ce241c4fa4c01e600f5df80892a3e598bb55ec7452a8a10928bee50f9a360495f9c6dd82c70ebb3476afe719673b1bac6a41e4c92bad41bf5a73857474fe
```

## Other located copies

Both filenames also exist under these Kudzu directories:

- `/mnt/storage/projects_old/projects/voter-app/voter-api/data/voter/`
- `/mnt/storage/hombak/projects/voter-app/data/import/voter/gasos/`
- `/mnt/storage/hombak/projects/voter-app/voter-api/data/voter/`

The Bibb file also exists in
`/mnt/storage/projects_old/projects/voterdata/` and
`/mnt/storage/projects_old/projects/voterdata2/`. The `voterdata` copy and its
`/mnt/storage/hombak/projects/voterdata/` counterpart were independently hashed
and match the confirmed Bibb source. Other listed copies were located by name;
their bytes were not individually verified.

The nearby `full-2026-04-13.csv` commercial enrichment and
`StandardText20260413-20687803106.tsv` VAN export are different sources and are
outside this request. Their vendor IDs should not be assumed to equal SOS
registration numbers.

## Existing public-host exposure

The old project's `voter-api/data/data.md` identifies the `voteweb` R2 bucket
and the `data.hatchtech.dev` host. On October 29, 2026, unauthenticated HTTPS
HEAD requests for both `/Bibb-20260203.csv` and `/HOUSTON-2026.02.02.csv` returned
HTTP 200, `text/csv`, and content lengths matching the local sources. No remote
record bodies were downloaded. This indicates the old host currently exposes
the files without an authentication challenge; local copies alone do not
establish admin-only privacy. Hosting permissions and any alternate bucket
endpoints/cache behavior remain to be reviewed before claiming that access is
restricted. No remote settings or files were changed during this inventory.

## Requirements for a later implementation

Preserve original bytes and source checksums in restricted storage. Voter data
must remain separate from public people profiles, public search, static build
exports, public map layers and the public document archive. Enforce admin-only
reads and writes in the backend using the existing `public.is_admin()` model;
a browser sign-in gate alone is insufficient. Any raw-file downloads must use
private storage with an administrator permission check.

Any database migration must be tested locally or in a preview branch and reach
GitHub main before production application, following repository policy. Verify
anonymous and ordinary authenticated denial as well as administrator access.
Implementation, imports and remediation of the old public host are follow-up
work, not changes made by this inventory.
