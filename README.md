# Watchlist

Personal tracker for TV shows and movies you've watched or want to watch.
Google Sheets backend, Capacitor Android app, GitHub Actions builds the APK.

## 1. Set up the Google Sheet

1. Create a new Google Sheet.
2. Extensions → Apps Script.
3. Delete the default code, paste in the contents of `apps-script/Code.gs`.
4. Change the `TOKEN` constant to a random secret string of your choosing —
   this is what keeps strangers from finding your sheet and writing to it.
5. Deploy → New deployment → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
6. Copy the deployment URL — you'll need it in the app.

The script auto-creates an `entries` tab with the right headers on first
run, so you don't need to set up the sheet manually.

## 2. Push this repo to GitHub

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

The push triggers `.github/workflows/build-apk.yml`, which builds a debug
APK and attaches it to a new GitHub Release. You can also trigger it
manually from the Actions tab (workflow_dispatch).

Note: this builds a **debug-signed** APK — fine for installing on your own
phone, not intended for the Play Store. If you ever want a properly signed
release build, say so and we can add a signing step.

## 3. Install on your phone

1. Go to the repo's Releases page on GitHub.
2. Download `app-debug.apk` from the latest release.
3. Open it on your phone (you'll need to allow installs from unknown
   sources the first time).

## 4. First-time app setup

On first launch the app asks for:
- **Web app URL** — the Apps Script deployment URL from step 1.
- **Access token** — the `TOKEN` value you set in `Code.gs`.

These are stored locally on the phone.

## Making changes later

Edit files under `www/` for the app itself, or `apps-script/Code.gs` for
backend logic (paste changes into the Apps Script editor manually — it
isn't auto-deployed). Push to `main` and a new APK build/release follows
automatically.
