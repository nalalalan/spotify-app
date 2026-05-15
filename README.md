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
3. Put the zip at `data/spotify-streaming-history.zip` and run `npm run import:plays -- data/spotify-streaming-history.zip`, or extract the JSON files into `data/spotify-streaming-history/` and run `npm run import:plays`.

The raw export folder and zip are git-ignored. The importer matches by Spotify track URI first, then title and artist. It keeps lifetime `playCount`, plus `versionPlayStats.playCount` for the visible song rows.

`versionPlayStats.playCount` means every nonzero track listening event after the song was added to that playlist version and before the next Driving version date. Spotify's export does not include playlist-source context, so this is a version-window count rather than proof that the play came from the playlist screen. Playlist songs with no matching export event are shown as `0 plays`.

## Run Locally

```bash
npm run fetch:data
npm start
```

Open `http://localhost:3000`.
