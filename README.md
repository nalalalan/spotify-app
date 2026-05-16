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

The raw export folder and zip are git-ignored. The importer matches by Spotify track URI and title/artist aliases so alternate editions and music-video rows can still land on the same song. It keeps lifetime `playCount`, plus `versionPlayStats.playCount` for the visible song rows.

`playCount` means Spotify export listening events with at least 30 seconds played. Shorter nonzero rows stay in `listeningEvents` but are not shown as plays. `versionPlayStats.playCount` uses the same 30-second rule after the song was added to that playlist version and before the next Driving version date. Spotify's export does not include playlist-source context, so the site labels this as an era count rather than proof that the play came from the playlist screen. The song table also shows total plays from the export so old favorites do not look artificially low in newer versions. Playlist songs with no matching export event are shown as `0 plays`.

The overview mix bar is artist/composer based by song share. The over-time chart is artist/composer based by `versionPlayStats.playCount`, with every artist/composer included in the plot and the strongest artists labeled in the legend. Artist colors are shared between the mix bar and the chart. Song rows still keep the `Style` column without color markers.

## Run Locally

```bash
npm run fetch:data
npm start
```

Open `http://localhost:3000`.
