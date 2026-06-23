# AGENTS.md

## Project overview
Strapi 5 backend for the Amante Creations website blog and editorial content.

## Working rules
- Prefer minimal, targeted changes.
- Follow existing Strapi factory patterns before introducing custom controllers or services.
- Do not add dependencies without approval.
- For non-trivial changes, inspect surrounding content-type schemas and generated types first.

## Commands
- install: `npm install`
- dev: `npm run develop`
- build: `npm run build`
- test: no test script currently configured
- lint: no lint script currently configured
- typecheck: no TypeScript typecheck script currently configured

## Architecture notes
- Main entrypoints: `src/index.js`.
- Important modules: `src/api/blog`, `src/api/blog-revision`, `src/api/author`, `src/api/category`, `src/api/tag`, `src/components/shared/seo.json`.
- Sensitive areas: `config/database.js`, Strapi Cloud deployment settings, public API permissions.
- Generated code / files to avoid editing directly: `types/generated/*` unless regenerating from Strapi.

## Change-specific rules
- If touching API contracts, update the frontend Strapi service and docs.
- If touching database schema, consider Cloud schema sync behavior and whether a migration is needed.
- If touching blog body saves, preserve automatic `Blog Revision` snapshots in `src/api/blog/content-types/blog/lifecycles.js`; snapshots should cover initial, before-update, and after-update states, and revision failures should log but not block the primary blog save.
- If touching auth or permissions, preserve users-permissions role behavior and verify public reads.

## Verification
Before finishing:
- run relevant tests
- run lint/typecheck if relevant
- verify behavior changed as intended
- summarize assumptions and remaining risks

## Security / safety
- Never commit secrets or edit `.env` values into source.
- Be careful with destructive scripts, migrations, and infra configs.
