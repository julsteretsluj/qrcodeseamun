# SEAMUN registration scanner

Desk tool for SEAMUN I 2027. Scanning a badge checks a delegate or chair in and shows their name, committee, allocation, and whether they are a delegate or chair. The allocation matrix lives in Supabase, not in this repository.

## Run

```bash
npm install
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the project's publishable key), then:

```bash
npm run dev
```

- Registration desk: [http://localhost:3000](http://localhost:3000)
- Sign in: [http://localhost:3000/login](http://localhost:3000/login)
- Badge codes: [http://localhost:3000/codes](http://localhost:3000/codes)

## The desk

Anyone who opens the site can use the scanner. A lookup returns one person at a time: name, committee, allocation, and role. Email, grade, and school are never returned, and the full roster is not exposed.

The camera needs HTTPS (or `localhost`). It asks for the rear camera, offers Switch camera when the device has more than one, ignores the same code read twice within four seconds, and turns off when the tab is hidden or closed. If the live camera is not an option, Scan from a photo decodes a picture of the badge with the same decoder. A badge can also be typed in by its six-character allocation ID (for example `abc123`, any letter case). Older placard codes such as `SEAMUN-2027-ECO-001` are still accepted.

## Signing in and badge codes

Badge codes only open for `juleskittoastrop@gmail.com`. Use Secretariat sign in on the desk, or go to `/login`, and sign in with that account's SEAMUN password. There is also a sign-in link by email, and Forgot password? sends a reset email that opens `/reset-password` to choose a new one. The page checks the email on the server, and the `list_registration_badges` function checks it again in the database, so any other account is turned away and gets nothing back.

`/codes` shows every code grouped by committee. Download all as ZIP saves one PNG per allocation, named `COMMITTEE_Allocation_id.png` (for example `UNHRC_France_abc123.png`). Each committee also has its own ZIP, each tile has its own PNG, and the page prints as a sheet of codes. The images are made in the browser after the signed-in roster loads; none are stored in the app.

In Supabase Auth, URL Configuration, add `<site>/auth/**` to the redirect allow list so sign-in links (`/auth/callback`) and password resets (`/auth/reset`) return to this app.

## What a QR code contains

Each code encodes only the six-character allocation ID from the matrix `ID` column (stored as `registration_people.short_id`), for example `abc123`. It carries no name or contact details. Codes printed before this change held placard codes; they still check in, but reprint them from `/codes` so every badge carries its ID.

## Where registration is stored

`registration_checkins` holds one row per placard code and the time it was first registered. Scanning the same badge again shows the original time. Seats with no one assigned are shown at the desk and are not checked in.

To clear a check-in, delete its row from `registration_checkins` in the Supabase SQL editor.
