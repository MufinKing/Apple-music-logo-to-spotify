# Apple Music logos for Spotify

**English** · [Français](README.fr.md)

Show the **artist logos from Apple Music** on Spotify's artist pages, in place of the plain-text name.

Apple Music lets artists upload a logo for their profile. This [Spicetify](https://spicetify.app) extension brings those logos to the Spotify desktop app. When an artist has no logo, the usual text name stays.

<img width="1057" height="930" alt="image" src="https://github.com/user-attachments/assets/2845bbda-8934-420a-a2a3-fe62235e8a5b" />


## How it works

```
Spotify (this Spicetify extension)
   │ 1. finds the artist with Apple's iTunes Search API (from your computer)
   │ 2. asks your Cloudflare Worker for the logo
   ▼
Your Cloudflare Worker
   │ 3. reads the artist's Apple Music page and finds the logo image
   │ 4. fetches the image and sends it back
   ▼
Spotify shows the logo instead of the artist name
```

A Worker is needed because Spotify cannot read Apple Music's web pages directly (browser CORS rules). **Each user deploys their own Worker.** The free Cloudflare plan is far more than enough for one person (100,000 requests per day at the time of writing).

## Requirements

- The Spotify **desktop app** with [Spicetify](https://spicetify.app) installed (it does not work in the web player)
- A free [Cloudflare](https://dash.cloudflare.com) account
- Developed and tested on macOS. Windows and Linux should work but are untested.

## Setup

### 1. Deploy your Worker

**With the dashboard (no tools needed)**

1. In the Cloudflare dashboard, open **Workers & Pages** and create a Worker (any name, e.g. `apple-logos`). Menu labels change from time to time.
2. Deploy the default code, then choose **Edit code**, replace everything with the content of [`worker.js`](worker.js) and deploy again.
3. Copy your Worker URL. It looks like `https://apple-logos.<your-subdomain>.workers.dev`.

**Or with the command line** (Node 18+): `npx wrangler login`, then `npx wrangler deploy` in this folder.

**Test it:** open `https://<your-worker-url>/logo?name=Eminem` in a browser. You should see a logo image. Add `&debug=1` to get a JSON diagnostic (`version`, `template`, and the result of each image attempt in `tries`).

### 2. Install the extension

1. Open [`apple-logos.js`](apple-logos.js) in a text editor and set `API` to your Worker URL, keeping the `/logo?name=` ending:
   ```js
   const API = "https://apple-logos.your-subdomain.workers.dev/logo?name=";
   ```
2. Copy the file into Spicetify's `Extensions` folder:
   - macOS / Linux: `cp apple-logos.js "$(spicetify path userdata)/Extensions/"`
   - Windows (PowerShell): `Copy-Item apple-logos.js "$(spicetify path userdata)\Extensions\"`
3. Enable it and apply:
   ```
   spicetify config extensions apple-logos.js
   spicetify apply
   ```
4. Quit Spotify completely, reopen it and visit an artist page.

After each Spotify update, run `spicetify apply` again.

## Settings

At the top of `apple-logos.js`:

| Setting | Default | What it does |
|---|---|---|
| `API` | placeholder | Your Worker URL, ending with `/logo?name=` |
| `COUNTRY` | `"fr"` | Two-letter country code of the Apple Music store used to search for the artist. Set your own country. |
| `POSITION` | `"center"` | `"center"` or `"right"`: bottom of the banner, on the "monthly listeners" row. `"inline"`: above the name, on the left. |
| `HEIGHT` | `72` | Logo height in pixels |
| `PLATE` | `""` | Background behind dark logos, which would be invisible on Spotify's dark banner. `""` is default and disables it. |
| `DEBUG` | `false` | `true` shows small notifications in Spotify (logo shown, no logo, who searched) |
| `TITLE` | Spotify's title selector | Where the artist name is on the page. Change it if Spotify changes its layout. |
| `LISTENERS` | English / French | Text used to find the artist banner. Add your language if the logo is not placed correctly. |

The Worker has the same `COUNTRY` setting at the top of `worker.js`. Keep both the same.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Notification "set your Worker URL" | Edit `API` in `apple-logos.js` (step 2.1), then reinstall the file. |
| Notification "logo server unreachable" | The Worker URL is wrong or the Worker is down. Open the test URL from step 1 in a browser. |
| Red notification mentioning `iTunes search … Rate limit` | Apple limits searches per IP address. The extension normally searches from your computer, so this means that search failed too. Wait a few minutes and revisit the artist. |
| Notification "artist title not found" | Spotify changed its layout. Adjust `TITLE` (inspect the artist name with Spicetify's developer tools). |
| The text name stays | Normal: this artist has no Apple Music logo, or the names differ. Set `DEBUG = true` to see what happens. |
| Logo hard to see | Adjust `PLATE`, or set it to `""`. |
| `Extension "apple-logos.js" not found` when applying | The file is not in the `Extensions` folder, or has another name. Check with `ls "$(spicetify path userdata)/Extensions"`. |

For a Worker problem, open `https://<your-worker-url>/logo?name=<Artist>&debug=1`: it shows the artist found, the template and every image attempt.

## Limitations

- Only artists who uploaded a logo to Apple Music have one. The feature is recent, so many artists don't.
- The artist name must match exactly (case, accents and punctuation are ignored). Homonyms or different spellings get no logo rather than a wrong one.
- It relies on Apple Music's page structure and on Spotify's page layout. Both are undocumented and may change and break it.
- Desktop app only.

## Privacy

The artist names you view are sent to Apple's iTunes Search API from your computer, and to your own Worker, which contacts Apple Music and Apple's image servers. There are no analytics and nothing is sent anywhere else. Your Worker is reachable by anyone who knows its URL, so don't share it.

## Disclaimer

This is an unofficial, personal project, not affiliated with Apple, Spotify, Cloudflare or Spicetify. Spicetify modifies the Spotify client, which may go against Spotify's terms. This project reads Apple's public web pages and images without an official API, which may go against Apple's terms. Logos belong to their respective artists and rights holders: this project stores none and is meant for personal use only. Use it at your own risk.

## License

[MIT](LICENSE)
