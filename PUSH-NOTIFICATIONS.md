# Push Notifications (FCM) — setup guide

Push delivery is **already wired on the backend**: every notification that
would miss the user (no open SSE stream = app closed or backgrounded) is sent
as an FCM push, and dead tokens are auto-cleared. Two things remain manual:
server credentials and the app-side Firebase config.

## 1. Backend (Render) — service account credentials

1. [console.firebase.google.com](https://console.firebase.google.com) → your project
2. Project settings → **Service accounts** → **Generate new private key** → download the JSON
3. In the JSON find `project_id`, `client_email`, `private_key`
4. Render dashboard → Environment → add:

   ```
   FCM_PROJECT_ID=<project_id>
   FCM_CLIENT_EMAIL=<client_email>
   FCM_PRIVATE_KEY=<private_key, keep the \n escapes on one line>
   ```

5. Redeploy. Until these exist the push layer no-ops safely (nothing breaks).

## 2. Android app — Firebase config + messaging plugin

1. Same Firebase project → **Add app → Android**, package `com.example.car_marketplace`
   (SHA-1 can reuse the OAuth client you already registered).
2. Download `google-services.json` → place in `car_marketplace/android/app/`.
3. Then wire the plugin (next code session, ~30 min):
   - `pubspec.yaml`: `firebase_messaging`, `flutter_local_notifications`
   - `android/build.gradle`: classpath `com.google.gms:google-services:4.4.x`
   - `android/app/build.gradle.kts`: `apply plugin: 'com.google.gms.google-services'`
   - On startup: request notification permission, get
     `FirebaseMessaging.instance.getToken()`, PUT it to `/api/users/device-token`
   - Refresh on `onTokenRefresh` and re-register after login.

   Registering the token is all the backend needs — delivery is automatic.

## How it behaves today (already live once configured)

- User in the app (SSE connected) → no push (they already got the live toast).
- App closed/backgrounded → FCM push with the notification title/body.
- Broadcast announcements push to every offline user.
- Token invalid (app removed) → 404/410 from FCM → token dropped automatically.
