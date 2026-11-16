# Authentication: Unified Login vs. Instagram Login

instacli uses **Unified Login by default**. The legacy Instagram Login is only available via
`--legacy`. The login type is stored as `login_type` in `~/.instacli/config.json`.

| | Unified Login (`unified`, default) | Instagram Login (`instagram`, `--legacy`) |
|---|---|---|
| Meta status | Recommended; only setup that gets new features; the only one offered to **new** apps | Labelled legacy; no retirement date announced (as of 2026-11) |
| Login dialog | `https://www.facebook.com/dialog/oauth?client_id&config_id&redirect_uri&response_type=code` | `https://www.instagram.com/oauth/authorize?...&scope=instagram_business_*` |
| User logs in with | Instagram **or** Facebook | Instagram only |
| Credentials | **Meta** App ID/Secret + Configuration ID (`config_id`) | **Instagram** App ID/Secret |
| Code exchange | `GET graph.facebook.com/v27.0/oauth/access_token` | `POST api.instagram.com/oauth/access_token` + `ig_exchange_token` |
| Token | Business Integration System User token (SUAT), owned by the client's business portfolio | Instagram User token |
| Lifetime | Set in the configuration (default: never expires) | 60 days, refresh via `ig_refresh_token` |
| API host | `graph.facebook.com` | `graph.instagram.com` |
| `/me` | The system user — **not** the IG account. Always use `/{ig-user-id}` | The IG account |
| Account discovery | `GET /me/assigned_instagram_accounts?fields=id,username` | `GET /me?fields=user_id` |
| Permissions | `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_manage_insights`, (`business_management`) | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, ... |
| Facebook Page | Not required | Not required |
| Business portfolio | **Required** (app must be owned by one) | Not required |

## How instacli maps this

- `instacli auth setup [--legacy] [--redirect-uri <uri>]` — interactive flow, Unified Login unless
  `--legacy` is given. You may paste the full redirect URL; the `code` is extracted.
- `instacli auth token [--legacy]` — paste a token generated in the dashboard (Unified Login unless `--legacy`).
- Unified: after the token exchange instacli lists `/me/assigned_instagram_accounts` and lets you
  pick one; the `client_business_id` (from `/me?fields=client_business_id`) and `config_id` are stored too.
- All API calls (`post`, `story`, `media`, `dm`, `me`) pick the host by `login_type`.
  Paths are identical (`/{ig-user-id}/media`, `/media_publish`, `/conversations`, `/messages`).
- `auth refresh` only applies to Instagram Login. Unified tokens that never expire need no refresh;
  expiring ones require re-running `auth setup` (the SUAT management API needs `business_management`
  and is not implemented).
- Configs written before this change have no `login_type` and keep working as `instagram` until
  `instacli auth setup` is re-run; `auth status` shows a hint to switch.

## Meta App Dashboard setup (Unified Login)

1. The app must be owned by a **business portfolio** — otherwise the "API setup with Unified login" tab doesn't appear.
2. Use cases → **Manage messaging & content on Instagram** → Customize → **API setup with Unified login**.
3. **Create new configuration**. Pick permissions (at least `instagram_basic`, `instagram_content_publish`;
   `instagram_manage_messages` for DMs). Token expiry: *Never* is easiest for a CLI.
4. If `assigned_instagram_accounts` comes back empty: add **`business_management`**. The Unified-login
   permission editor doesn't offer it; add the *Facebook Login for Business* product and edit the
   same configuration under Facebook Login for Business → Configurations (community finding).
5. Redirect URL: HTTPS, e.g. `https://localhost/` (instacli's default; the browser error after the redirect is expected).
6. Note the **Configuration ID** and the **Meta App ID/Secret** (App settings → Basic — not the Instagram App ID).
7. Dev mode: your Instagram account must be added as Instagram Tester and accept the invite
   (instagram.com → Settings → Website permissions → Apps and websites → Tester invites).

## Known gaps / not yet verified live

- The Unified flow was implemented from Meta's docs and community reports and smoke-tested with stubbed
  HTTP; it has not been run against a real Unified-Login app yet.
- DMs via `/{ig-user-id}/conversations` on `graph.facebook.com` with a SUAT are not confirmed by Meta docs.
  Community reports say IGSIDs are identical across both setups.
- Whether `https://localhost/` is accepted as redirect URL in a Unified configuration is not documented.

## Sources (checked 2026-11-16)

- [Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview)
- [Unified Login – get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started)
- [Unified Login – authentication](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication)
- [Unified Login – permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions)
- [Unified Login – migration](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/migration)
- Community: [openreply#104](https://github.com/diwenne/openreply/issues/104), [postiz#2404](https://github.com/gitroomhq/postiz-app/pull/2404), [openpost#495](https://github.com/getopenpost/openpost/issues/495), [CRPRO Hub comparison](https://crprohub.com/en/blog/instagram-api-instagram-login-facebook-login-unified-login)
