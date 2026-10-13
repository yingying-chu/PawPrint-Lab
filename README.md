# PawPrint Lab

Personalized products made from your pet. Upload a photo, and PawPrint Lab draws your pet as a cute character, builds a 3D "twin" of it, and puts it on real products you can order: pillows, beds, totes, jewelry, embroidered lettering.

Built for the [Arcade](https://arcade.ai) hackathon.

## How it works

1. **Photo → character.** [Meshy](https://www.meshy.ai) image-to-image redraws the pet as a toy-like character.
2. **Character → 3D twin.** Meshy image-to-3D turns that character into a GLB model shown in the browser.
3. **Design studio.** Make sticker sheets, single characters, or embroidery lettering from the twin.
4. **Shop & checkout.** The [Arcade API](https://docs.arcade.ai) supplies the product catalog, renders designs onto products, and creates the checkout.

## Stack

- **Frontend:** vanilla HTML/CSS/JS in `public/` (`index.html`, `app.js`)
- **Backend:** Next.js 16 API routes in `app/api/`
- **Database:** Turso (libSQL) via Drizzle, with migrations in `drizzle/`
- **Files:** private Vercel Blob storage
- **Hosting:** Vercel, plus a daily cron that deletes expired photos

Locally, with no Turso or Blob credentials, data goes to `.data/pawprint.db` and `.data/blobs/`.

## Run it locally

```bash
cp .env.example .env   # add ARCADE_API_KEY and MESHY_API_KEY
npm install
npm run dev            # http://localhost:5173
```

`npm run dev` applies database migrations first. Set `PAWPRINT_DEMO_OPEN=1` to skip the demo sign-in, or set `PAWPRINT_DEMO_PASSCODE` to require a passcode.

## Project layout

```
app/api/      API routes (uploads, twin-jobs, characters, designs, lettering, checkouts, …)
lib/          Arcade + Meshy clients, storage, demo auth
db/           Drizzle schema and client
drizzle/      SQL migrations
public/       The storefront (static), fonts, demo pet assets
proxy.ts      Demo sign-in gate
docs/         Design notes for the 3D pipeline
```
