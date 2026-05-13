# Spotify Driving Record

Static AO Labs app for `spotify.aolabs.io`.

The source snapshot prefers Spotify Web API playlist-item pagination when credentials are present. Without credentials, it falls back to Alan's public Spotify profile, public playlist page counts, public embed preview rows, and date screenshots.

## Full Spotify Rows

1. Create a Spotify Developer app.
2. Add `http://127.0.0.1:5178/callback` as the app redirect URI.
3. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.env.local`.
4. Run `npm run auth:spotify` if account authorization is needed for private or collaborative playlists.
5. Run `npm run fetch:data`.

With API credentials, the importer keeps paginating each playlist until Spotify returns no next page, so large playlists are no longer capped by public embeds.

## Run Locally

```bash
npm run fetch:data
npm start
```

Open `http://localhost:3000`.
