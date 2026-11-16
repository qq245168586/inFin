# Public Repository Migration

Date: 2026-11-16

## Scope

The workspace and eight project repositories are consolidated into this public
repository. `main` contains all source trees, including Coach iOS and the web
simulator. Original project branches are archived under
`codex/history/<project>/<branch>` and tags under `<project>/<tag>`.

## History And Safety

- All published branches and tags have been rewritten to remove known plaintext
  credentials, derived hashes, embedded Basic authentication values and tokens.
- Runtime databases, session records, backups, build outputs and generated binary
  documents are excluded from history, not merely deleted in the latest commit.
  Source documentation and its generation scripts remain where applicable.
- Commit authors, messages and topology are retained where possible. Commit IDs
  change after sanitization; Git signatures cannot survive a rewritten commit.
- Original local repositories and production services were not rewritten or
  deployed during this export. Local audit files and original-to-new commit maps
  are private and are not part of the public repository.
- Never merge or push original unsanitized branches into this public repository.
  Use a fresh clone of this repository for public development.

## Configuration

`REDACTED_CONFIGURE_LOCALLY` and `example-client:configure-locally` are dummy
placeholders, not usable production credentials. Before deployment, configure
your own account bootstrap passwords, MQTT credentials and any legacy client
authentication. Do not deploy the source's placeholder defaults unchanged.

Server/MQTT configuration uses private environment variables where supported.
Android compile-time configuration must also be supplied privately. Keep actual
environment files, signing keys and databases outside Git. Local recovery scripts
and old Nginx samples are historical utilities, not the active production setup.

Removing a secret from this export does not revoke it. Any credential previously
shared outside trusted systems should be rotated separately; this migration does
not change passwords or invalidate sessions in production.

## Verification

Before publishing, the export is checked with Gitleaks over all branch/tag
history, an exact-value check for the identified secrets and derived values, and
a path check for excluded runtime data. These checks reduce exposure risk but
cannot prove the absence of every possible sensitive string.

The existing business test pipeline is run against the sanitized combined source
before its integration commit. Tests use mock data, not production databases.
