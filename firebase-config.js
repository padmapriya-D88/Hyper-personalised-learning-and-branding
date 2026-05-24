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
  apiKey:            "AIzaSyBkO4eBu7tVmNflaznA23fDc32mUTHWmUY",
  authDomain:        "goldeneagle-bd362.firebaseapp.com",
  projectId:         "goldeneagle-bd362",
  storageBucket:     "goldeneagle-bd362.firebasestorage.app",
  messagingSenderId: "942974929009",
  appId:             "1:942974929009:web:3d37430c5e00c4a44473d0",
  measurementId:     "G-R5VVVQE1R1",
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
