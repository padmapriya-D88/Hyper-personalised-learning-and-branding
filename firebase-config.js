// ═══════════════════════════════════════════════════════════════════
// GOLDEN EAGLE PROGRAMME — Firebase Configuration
// ═══════════════════════════════════════════════════════════════════
//
// SETUP STEPS (one-time, ~5 minutes):
//  1. Go to https://console.firebase.google.com
//  2. "Add project" → name: "golden-eagle-programme" → Continue
//  3. Project Settings (⚙) → "Add app" → Web (</>)
//  4. Copy the firebaseConfig object below and paste here
//  5. Authentication → Sign-in method → Enable: Email/Password + Google
//  6. Firestore Database → Create database → Start in production mode
//     → choose region (asia-south1 for India) → Done
//  7. Firestore → Rules tab → paste the rules at the bottom of this file
//  8. Save & Publish rules
// ═══════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// Emails that have admin access (can view all student data + export Excel)
const ADMIN_EMAILS = [
  "agilebodhipvt@gmail.com",
];

// ── Firestore Security Rules (paste into Firebase Console → Firestore → Rules)
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
             request.auth.token.email in ['agilebodhipvt@gmail.com'];
    }

    // Each student can read/write only their own document
    match /students/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read:        if isAdmin();
    }

    // Admin can list all students
    match /students/{uid} {
      allow list: if isAdmin();
    }
  }
}
*/
