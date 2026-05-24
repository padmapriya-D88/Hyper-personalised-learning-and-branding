// ── Firebase Auth shared helpers ─────────────────────────────────────
// Loaded by login.html, index.html, admin.html

let _app, _auth, _db;

function initFirebase() {
  if (_app) return;
  _app  = firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _db   = firebase.firestore();
}

function getAuth() { return _auth; }
function getDb()   { return _db; }

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase().trim());
}

// Sign in with Google popup
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return _auth.signInWithPopup(provider);
}

// Sign in with email/password
async function signInEmail(email, password) {
  return _auth.signInWithEmailAndPassword(email, password);
}

// Sign up with email/password
async function signUpEmail(email, password, name) {
  const cred = await _auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });
  return cred;
}

// Sign out
async function signOut() {
  return _auth.signOut();
}

// Load student profile from Firestore
async function loadStudentProfile(uid) {
  const doc = await _db.collection("students").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

// Save / update student profile (merges with existing)
async function saveStudentProfile(uid, data) {
  await _db.collection("students").doc(uid).set(
    { ...data, lastActiveAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// Lock the student's goal (called on first plan generation)
async function lockStudentGoal(uid, goalData) {
  const existing = await loadStudentProfile(uid);
  if (existing && existing.goalLocked) return; // already locked

  await _db.collection("students").doc(uid).set({
    ...goalData,
    goalLocked:   true,
    goalLockedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:    existing?.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// Admin: load all students
async function loadAllStudents() {
  const snap = await _db.collection("students").orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
