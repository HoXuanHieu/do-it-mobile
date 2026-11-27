# DO-IT Mobile (Expo / React Native)

Android + iOS app with the same features as `frontend/` (web). Shares the API contract and i18n keys.

## Run locally

1. Start the backend reachable from the phone (same Wi-Fi):
   ```powershell
   dotnet run --project ../backend/src/DoIt.Api --urls http://0.0.0.0:5000
   ```
   Open port 5000 in Windows Firewall (Private network) once.
2. Copy `.env.example` to `.env` and set your PC's LAN IP (`ipconfig` → IPv4):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.15:5000
   ```
3. Install and start:
   ```powershell
   npm install
   npx expo start
   ```
   Scan the QR code with **Expo Go** (Android / iOS). If the network blocks device-to-PC traffic, use `npx expo start --tunnel`
   and expose the API with `cloudflared tunnel --url http://localhost:5000`.

## Layout

- `src/app/` — routes (expo-router). `(auth)` = sign-in pages, `(app)/(tabs)` = bottom tabs (Tổng quan, Lịch, Sức khỏe, Tài chính, Mục tiêu), header has notifications / settings / profile.
- `src/features/*/{api,queries,schemas,meta,layout,catalog}.ts` — copied from `frontend/src` unchanged (except `account/api.ts` avatar upload and `lib/api.ts` base URL). Keep them in sync when the API changes.
- `src/ui/` — shared mobile components and theme (palette from `frontend/src/index.css`).
- `src/i18n/locales/en.json` — web keys + a few mobile-only keys (`node scripts/add-i18n.mjs "Vietnamese=English"`).

## Auth

Same as web: access token in memory, refresh token in the httpOnly `doit_rt` cookie, kept by the native cookie jar.
The backend dev config already has `Auth:SecureCookies=false` so the cookie works over plain HTTP on the LAN.

## Build

`npx eas-cli build -p android --profile staging` (APK) / `-p ios --profile staging` (needs an Apple Developer account; register the iPhone first with `npx eas-cli device:create`). Builds run in the Expo cloud and use the staging API from `eas.json`.
