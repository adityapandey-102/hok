-- Round 5: staff can copy the client's portal link again at any time.
--
-- The link token is now also stored, in PLAIN TEXT, next to its SHA-256 hash (the user's decision,
-- 2026-11-18: simplicity over at-rest secrecy). The public lookup still goes by `token_hash`, unchanged.
-- The API clears `token` when a link is revoked (regenerated, disabled, client archived), so only the
-- ONE active link per client keeps its token. Links made before this round have `token` null; staff
-- make a new link to get one they can copy.
--
-- ADDITIVE ONLY: the column is nullable, so the old API runs unchanged against this schema.

alter table public.portal_links add column token text;

-- The portal's "needs your attention" files: a client's newest shared (client-visible, live) assets.
create index if not exists assets_client_visible_idx on public.assets (client_id, created_at desc, id desc)
  where visible_to_client and deleted_at is null;
