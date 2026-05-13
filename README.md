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

## True Play Counts

Spotify Web API does not expose lifetime personal play counts. To add real plays:

1. Request Spotify's Extended streaming history export from the Spotify account privacy page.
2. Download the zip from Spotify's email when it is ready.
3. Put the exported JSON files in `data/spotify-streaming-history/`.
4. Run `npm run import:plays`.

The importer matches by Spotify track URI first, then title and artist. The visible site uses `playCount`, defined as every nonzero track listening event in the export. It also keeps `streams30s` for the stricter 30-second stream count.

## Run Locally

```bash
npm run fetch:data
npm start
```

Open `http://localhost:3000`.
