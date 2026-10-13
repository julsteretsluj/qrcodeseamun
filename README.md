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
- Badge codes: [http://localhost:3000/codes](http://localhost:3000/codes)

## The desk

The desk asks for a desk code before it opens. Only a bcrypt hash of that code is stored, in `registration_desk`. Every lookup sends the desk code again, and ten wrong codes in fifteen minutes pause the desk. A lookup returns one person at a time: name, committee, allocation, and role. Email, grade, and school are never returned.

Camera scanning uses the device's rear camera. If a badge will not scan, type its placard code (for example `SEAMUN-2027-ECO-001`) or its six-character short id from the matrix.

## Badge codes

`/codes` only opens for `juleskittoastrop@gmail.com`. Sign in with that account's SEAMUN password, or ask for a sign-in email. The page checks the email on the server, and the `list_registration_badges` function checks it again in the database, so another account gets nothing back. Each tile can be downloaded as a PNG, and the whole page prints as a sheet of codes.

For the sign-in email link to come back to this app, add `<site>/auth/callback` to the Supabase Auth redirect allow list.

## What a QR code contains

Each code encodes only the placard code from the allocation matrix, for example `SEAMUN-2027-ECO-001`. It carries no name or contact details.

## Where registration is stored

`registration_checkins` holds one row per placard code and the time it was first registered. Scanning the same badge again shows the original time. Seats with no one assigned are shown at the desk and are not checked in.

To clear a check-in, delete its row from `registration_checkins` in the Supabase SQL editor.
