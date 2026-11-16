# LEARNINGS

## Domain Quirks

- [2026-11-16] Meta Unified Login: the token is a *Business Integration System User* token. `/me` returns the system user, not the Instagram account — always address `/{ig-user-id}` on `graph.facebook.com` and discover accounts via `/me/assigned_instagram_accounts`. An empty list almost always means `business_management` is missing from the Facebook Login for Business configuration. Code exchange uses the **Meta** App ID/Secret, not the Instagram App ID. See docs/authentication.md.
- [2026-11-16] New Meta apps can no longer use `instagram.com/oauth/authorize` ("Invalid platform app") nor the classic FB dialog with `scope` ("Invalid Scopes") — they need `facebook.com/dialog/oauth?config_id=...`. Existing Instagram-Login apps keep working (no retirement date as of 2026-11).

## Patterns

- [2026-11-16] Without real Meta credentials, smoke-test API routing by stubbing `node-fetch` via `require.cache` and calling `dist/lib/api.js` directly — it prints every URL/host the CLI would hit.
