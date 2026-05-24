// ============================================================
// Golden Eagle — AI Learning Companion
// ============================================================

const State = {
  selectedPhases: new Set(),
  selectedGoalPreset: null,
  frequency: "daily",
  photoDataUrl: null,
  generatedPlan: null,
  generatedPostText: null,
};

// ── FIREBASE AUTH & USER STATE ──────────────────────────────────────
let _currentUser    = null;
let _studentProfile = null;

function initAuth() {
  initFirebase();

  getAuth().onAuthStateChanged(async user => {
    document.getElementById("auth-loading").style.display = "none";

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    _currentUser = user;

    // Show user chip
    const chip    = document.getElementById("user-chip");
    const avatar  = document.getElementById("user-avatar");
    const nameEl  = document.getElementById("user-display-name");
    const signOut = document.getElementById("sign-out-btn");
    const adminLink = document.getElementById("admin-link");

    const displayName = user.displayName || user.email.split("@")[0];
    avatar.textContent  = displayName.charAt(0).toUpperCase();
    nameEl.textContent  = displayName;
    chip.style.display  = "flex";
    signOut.style.display = "block";

    // Show admin link if admin
    if (isAdmin(user.email)) {
      adminLink.style.display = "inline-flex";
    }

    // Load student profile
    _studentProfile = await loadStudentProfile(user.uid);

    if (_studentProfile && _studentProfile.goalLocked) {
      applyLockedState(_studentProfile);
    } else {
      // Pre-fill name from auth
      const nameInp = document.getElementById("eg-name");
      if (nameInp && !nameInp.value) {
        nameInp.value = user.displayName || "";
      }
    }
  });
}

async function handleSignOut() {
  await signOut();
  window.location.href = "login.html";
}

function applyLockedState(profile) {
  // Show locked banner
  document.getElementById("goal-locked-banner").classList.remove("hidden");

  // Disable all goal-setting inputs
  ["eg-name","eg-role","eg-experience","eg-hours","eg-goal"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; el.value = profile[id.replace("eg-","")] || el.value; }
  });

  // Fill in saved values
  document.getElementById("eg-name").value       = profile.name       || "";
  document.getElementById("eg-role").value       = profile.role       || "";
  document.getElementById("eg-experience").value = profile.experience || "8-15";
  document.getElementById("eg-hours").value      = profile.hours      || "6";
  document.getElementById("eg-goal").value       = profile.goal       || "";

  // Restore selected phases from saved profile
  if (profile.phases) {
    State.selectedPhases = new Set(profile.phases);
    document.querySelectorAll(".phase-tile").forEach(tile => {
      const ph = parseInt(tile.dataset.phase);
      tile.classList.toggle("selected", State.selectedPhases.has(ph));
      tile.style.pointerEvents = "none";
      tile.style.opacity = State.selectedPhases.has(ph) ? "1" : "0.45";
    });
  }

  // Restore selected goal preset
  if (profile.goalPreset) {
    State.selectedGoalPreset = profile.goalPreset;
    document.querySelectorAll("[data-preset]").forEach(t => {
      t.classList.toggle("selected", t.dataset.preset === profile.goalPreset);
      t.style.pointerEvents = "none";
    });
  }

  // Generate & show the plan immediately using saved data
  if (profile.weeklyPlan) {
    State.generatedPlan = profile;
    State.generatedPlan.weeks = profile.weeklyPlan;
    renderPlan(State.generatedPlan);
    switchView("plan");
  }

  // Hide "Generate" button, show locked note
  const genBtn = document.getElementById("gen-plan-btn");
  if (genBtn) {
    genBtn.textContent  = "✓ Plan Saved";
    genBtn.disabled = true;
  }
}

// ── SAVE GOAL TO FIRESTORE on first plan generation ─────────────────
async function saveGoalToFirestore(planData) {
  if (!_currentUser) return;
  const existing = await loadStudentProfile(_currentUser.uid);
  if (existing && existing.goalLocked) return; // never overwrite

  const profile = {
    uid:        _currentUser.uid,
    email:      _currentUser.email,
    name:       planData.name,
    role:       planData.role,
    experience: planData.exp,
    hours:      planData.hours,
    goal:       planData.goal,
    goalPreset: State.selectedGoalPreset || "",
    phases:     [...State.selectedPhases],
    weeklyPlan: planData.weeks,
  };

  await lockStudentGoal(_currentUser.uid, profile);
  _studentProfile = await loadStudentProfile(_currentUser.uid);
  toast("🔒 Your learning goal has been saved and locked.");
}

// ── TOKEN USAGE TRACKER ──────────────────────────────────────────────
// Pricing: Claude Sonnet (claude-opus-4-7) per million tokens
const TOKEN_PRICING = {
  "claude-opus-4-7":         { input: 15.00, output: 75.00 },
  "claude-sonnet-4-6":       { input: 3.00,  output: 15.00 },
  "claude-haiku-3-5":        { input: 0.80,  output: 4.00  },
  "default":                 { input: 3.00,  output: 15.00 },
};

const TokenTracker = {
  _key: "ge-token-usage",

  load() {
    try { return JSON.parse(localStorage.getItem(this._key) || "[]"); }
    catch { return []; }
  },

  save(records) {
    localStorage.setItem(this._key, JSON.stringify(records));
  },

  record({ feature, model, inputTokens, outputTokens }) {
    const records = this.load();
    const pricing = TOKEN_PRICING[model] || TOKEN_PRICING["default"];
    const inputCost  = (inputTokens  / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    records.push({
      id: Date.now(),
      ts: new Date().toISOString(),
      feature,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd: inputCost + outputCost,
    });
    this.save(records);
    renderUsageDashboard();
  },

  clear() {
    this.save([]);
    renderUsageDashboard();
    toast("Token usage history cleared.");
  },

  totals() {
    const records = this.load();
    return records.reduce((acc, r) => {
      acc.calls       += 1;
      acc.inputTokens += r.inputTokens;
      acc.outputTokens+= r.outputTokens;
      acc.totalTokens += r.totalTokens;
      acc.costUsd     += r.costUsd;
      return acc;
    }, { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 });
  },
};

// ---------- Tab navigation ----------
document.querySelectorAll("nav.tabs button").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.querySelectorAll("[data-jump]").forEach(el => {
  el.addEventListener("click", () => switchView(el.dataset.jump));
});

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll("nav.tabs button").forEach(b => b.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelector(`nav.tabs button[data-view="${name}"]`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Dashboard: curriculum overview ----------
function renderCurriculumOverview() {
  const grid = document.getElementById("curriculum-overview");
  grid.innerHTML = CURRICULUM.map(p => `
    <div class="phase-tile">
      <div class="num">Phase ${p.phase} · Weeks ${p.weeks}</div>
      <div class="name">${p.title}</div>
      <div class="meta">${p.items.length} topics</div>
    </div>
  `).join("");
}

// ---------- Plan: goal presets ----------
function renderGoalPresets() {
  const wrap = document.getElementById("goal-presets");
  wrap.innerHTML = GOAL_PRESETS.map(g => `
    <div class="phase-tile" data-goal-id="${g.id}">
      <div class="num">Goal preset</div>
      <div class="name">${g.label}</div>
      <div class="meta">Focus: Phases ${g.focus.join(", ")}</div>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-goal-id]").forEach(el => {
    el.addEventListener("click", () => {
      wrap.querySelectorAll("[data-goal-id]").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
      const goal = GOAL_PRESETS.find(g => g.id === el.dataset.goalId);
      State.selectedGoalPreset = goal;
      // Auto-select corresponding phases
      State.selectedPhases = new Set(goal.focus);
      renderPhasePicker();
      // Prefill goal text
      const ta = document.getElementById("eg-goal");
      if (!ta.value) ta.value = `My goal: ${goal.label}. I want to apply the Golden Eagle program directly to this outcome and show concrete progress every week.`;
    });
  });
}

// ---------- Plan: phase picker ----------
function renderPhasePicker() {
  const grid = document.getElementById("phase-picker");
  grid.innerHTML = CURRICULUM.map(p => `
    <div class="phase-tile ${State.selectedPhases.has(p.phase) ? 'selected' : ''}" data-phase="${p.phase}">
      <div class="num">Phase ${p.phase} · Weeks ${p.weeks}</div>
      <div class="name">${p.title}</div>
      <div class="meta">${p.items.length} topics</div>
    </div>
  `).join("");
  grid.querySelectorAll("[data-phase]").forEach(el => {
    el.addEventListener("click", () => {
      const ph = parseInt(el.dataset.phase, 10);
      if (State.selectedPhases.has(ph)) State.selectedPhases.delete(ph);
      else State.selectedPhases.add(ph);
      el.classList.toggle("selected");
    });
  });
}

// ---------- Plan generation ----------
document.getElementById("gen-plan-btn").addEventListener("click", generatePlan);

function generatePlan() {
  const name = document.getElementById("eg-name").value.trim() || "Golden Eagle";
  const role = document.getElementById("eg-role").value.trim() || "AI Learner";
  const exp = document.getElementById("eg-experience").value;
  const hours = parseInt(document.getElementById("eg-hours").value, 10);
  const goal = document.getElementById("eg-goal").value.trim() || "Become an AI-first leader.";

  if (State.selectedPhases.size === 0) {
    toast("Pick at least one curriculum phase first.");
    return;
  }

  // Build the plan: weeks from selected phases, in order
  const focusedWeeks = [];
  CURRICULUM.forEach(p => {
    if (State.selectedPhases.has(p.phase)) {
      p.items.forEach(item => focusedWeeks.push({ ...item, phaseTitle: p.title, phase: p.phase }));
    }
  });

  // Determine intensity from hours
  const intensityNote = hours <= 3 ? "Light-touch — 1 deep session + async reading."
                      : hours <= 6 ? "Standard — 2 sessions + 1 hands-on lab."
                      : hours <= 10 ? "Intensive — 3 sessions + project work."
                      : "Immersive — daily practice + capstone build.";

  // Generate per-week actions based on experience + topic
  const plan = focusedWeeks.map((w, idx) => {
    const action = generateActionForWeek(w, exp, hours, goal);
    return { ...w, action, sprintNum: idx + 1 };
  });

  State.generatedPlan = { name, role, exp, hours, goal, intensityNote, weeks: plan };
  renderPlan(State.generatedPlan);

  document.getElementById("enhance-plan-btn").disabled = false;
  document.getElementById("copy-plan-btn").disabled = false;
  document.getElementById("download-plan-btn").disabled = false;

  // Save to Firestore & lock goal (first-time only)
  saveGoalToFirestore(State.generatedPlan).catch(err => {
    console.warn("Firestore save skipped (no Firebase config?):", err.message);
  });

  // Also populate the LinkedIn post week picker
  populatePostWeekPicker(plan);

  toast("Your personalized plan is ready. Scroll down ↓");
}

function generateActionForWeek(w, exp, hours, goal) {
  // Deterministic but varied per topic. Anchored on real curriculum content.
  const verbs = exp.startsWith("0") || exp.startsWith("4")
    ? ["Read", "Watch", "Practice", "Try", "Document"]
    : ["Apply", "Lead", "Architect", "Critique", "Teach"];
  const labs = {
    "AI Fundamentals & Business Alignment": "Map 3 use-cases in YOUR org to either Generative or Predictive AI — defend each choice.",
    "Prompt Engineering Frameworks": "Rewrite 5 of your weekly prompts using Role-Context-Task-Constraint. Measure quality delta.",
    "AI Strategy & The Maturity Model": "Score your org on a 1–5 AI maturity rubric and present to your manager.",
    "Enterprise Vendor Evaluation": "Pick one AI tool your team uses — write a 1-page Build-vs-Buy memo.",
    "Machine Learning for Project Leaders": "Sketch the data pipeline for one ML feature in your product. Identify failure points.",
    "Advanced Prompt Chaining": "Build a 3-step prompt chain that outputs valid JSON every time. Test 20 inputs.",
    "AI Knowledge Assistants (RAG Lite)": "Create a Claude Project (or NotebookLM) for your team's docs. Onboard 1 teammate.",
    "Enterprise Workspace AI": "Automate one weekly recurring task using Copilot or Jira AI. Measure hours saved.",
    "Introduction to Vibe Coding": "Build a small useful tool using Cursor or Claude Artifacts — ship in 2 hours.",
    "AI Agents & Model Context Protocol": "Connect one MCP server (e.g., GitHub) to Claude. Run 5 real tasks through it.",
  };
  const fallback = `${verbs[w.week % verbs.length]} the core concept and produce 1 artifact (memo, prototype, or teach-back).`;
  const lab = labs[w.topic] || fallback;
  return lab;
}

function renderPlan(plan) {
  const el = document.getElementById("plan-output");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div style="margin-bottom: 14px;">
      <div class="pill">PERSONALIZED PLAN</div>
      <h3 style="margin: 8px 0 4px; color: var(--eagle-navy);">${escapeHtml(plan.name)} · ${escapeHtml(plan.role)}</h3>
      <div style="font-size: 13px; color: #555;">${escapeHtml(plan.goal)}</div>
      <div style="font-size: 12px; color: #777; margin-top: 6px;">
        <strong>${plan.hours} hrs/week</strong> · ${plan.intensityNote} · ${plan.weeks.length} weeks of focused content
      </div>
    </div>
    ${plan.weeks.map(w => `
      <div class="plan-week">
        <span class="w-num">SPRINT ${w.sprintNum} · W${w.week}</span>
        <span class="w-topic">${escapeHtml(w.topic)}</span>
        <div class="w-content">${escapeHtml(w.content)}</div>
        <div class="w-actions">🎯 ${escapeHtml(w.action)}</div>
      </div>
    `).join("")}
  `;
}

// ---------- Enhance with Claude (optional, requires API key) ----------
document.getElementById("enhance-plan-btn").addEventListener("click", enhanceWithClaude);

async function enhanceWithClaude() {
  const key = document.getElementById("api-key").value.trim();
  if (!key) { toast("Add your Anthropic API key in Settings first."); return; }
  if (!State.generatedPlan) { toast("Generate a plan first."); return; }

  const btn = document.getElementById("enhance-plan-btn");
  btn.disabled = true; btn.textContent = "✨ Enhancing...";

  const prompt = `You are an AI learning coach for the "Golden Eagle Programme" 24-week AI Leadership program.

Learner profile:
- Name: ${State.generatedPlan.name}
- Role: ${State.generatedPlan.role}
- Experience: ${State.generatedPlan.exp}
- Available: ${State.generatedPlan.hours} hrs/week
- Goal: ${State.generatedPlan.goal}

Their current sprint plan:
${State.generatedPlan.weeks.map(w => `- Week ${w.week} (${w.topic}): ${w.action}`).join("\n")}

Rewrite each sprint's action into a sharper, more outcome-oriented version (1 sentence max each). Return ONLY a JSON array like:
[{"week": 1, "action": "..."}, ...]
No prose outside the JSON.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API ${resp.status}: ${err.slice(0, 200)}`);
    }
    const data = await resp.json();

    // Record token usage
    if (data.usage) {
      TokenTracker.record({
        feature: "Learning Plan — Enhance with Claude",
        model: data.model || "claude-opus-4-7",
        inputTokens:  data.usage.input_tokens  || 0,
        outputTokens: data.usage.output_tokens || 0,
      });
    }

    const text = data.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const enhanced = JSON.parse(jsonMatch[0]);

    enhanced.forEach(e => {
      const wk = State.generatedPlan.weeks.find(w => w.week === e.week);
      if (wk) wk.action = e.action;
    });
    renderPlan(State.generatedPlan);
    toast("✨ Plan enhanced with Claude.");
  } catch (e) {
    toast("Enhance failed: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "✨ Enhance with Claude";
  }
}

document.getElementById("copy-plan-btn").addEventListener("click", () => {
  if (!State.generatedPlan) return;
  navigator.clipboard.writeText(planAsText(State.generatedPlan));
  toast("Plan copied to clipboard.");
});

document.getElementById("download-plan-btn").addEventListener("click", () => {
  if (!State.generatedPlan) return;
  const blob = new Blob([planAsText(State.generatedPlan)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `golden-eagle-plan-${slug(State.generatedPlan.name)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

function planAsText(plan) {
  return [
    `GOLDEN EAGLE PROGRAMME — Personalised Learning Plan`,
    `====================================================`,
    `Name: ${plan.name}`,
    `Role: ${plan.role}`,
    `Commitment: ${plan.hours} hrs/week (${plan.intensityNote})`,
    `Goal: ${plan.goal}`,
    ``,
    ...plan.weeks.map(w =>
      `Sprint ${w.sprintNum} — Week ${w.week}: ${w.topic}\n   ${w.content}\n   🎯 ${w.action}\n`
    ),
  ].join("\n");
}

// ============================================================
// LinkedIn Post Generator
// ============================================================

// Upload zone
const uploadZone = document.getElementById("upload-zone");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");

uploadZone.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    State.photoDataUrl = ev.target.result;
    photoPreview.src = State.photoDataUrl;
    photoPreview.classList.remove("hidden");
    document.getElementById("upload-placeholder").classList.add("hidden");
    uploadZone.classList.add("has-image");
  };
  reader.readAsDataURL(file);
});

// Week picker — populate from full curriculum so they can post any week
function populatePostWeekPicker(_planWeeks) {
  const sel = document.getElementById("post-week");
  sel.innerHTML = "";
  CURRICULUM.forEach(p => {
    p.items.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.week;
      opt.textContent = `Week ${item.week} — ${item.topic}`;
      sel.appendChild(opt);
    });
  });
}
populatePostWeekPicker();

// Frequency
document.querySelectorAll(".freq-tile").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".freq-tile").forEach(x => x.classList.remove("selected"));
    t.classList.add("selected");
    State.frequency = t.dataset.freq;
    updateFreqSummary();
  });
});

function updateFreqSummary() {
  const map = {
    daily: "<strong>Daily</strong>: We'll prep 5 post drafts per week — one per learning sprint.",
    "3x": "<strong>3× / week</strong>: Drafts for Monday, Wednesday, Friday.",
    weekly: "<strong>Weekly</strong>: One reflective post every Friday.",
    milestone: "<strong>Per Milestone</strong>: One celebratory post at the end of each of the 8 phases.",
  };
  document.getElementById("freq-summary").innerHTML = "→ " + map[State.frequency];
}

// Generate post
document.getElementById("gen-post-btn").addEventListener("click", generatePost);

function generatePost() {
  const name = document.getElementById("post-name").value.trim() || "Golden Eagle";
  const headline = document.getElementById("post-headline").value.trim() || "Golden Eagle Cohort · AI Leadership Program";
  const weekNum = parseInt(document.getElementById("post-week").value, 10);
  const tone = document.getElementById("post-tone").value;
  const reflection = document.getElementById("post-reflection").value.trim();
  const imgPrompt = document.getElementById("post-prompt").value.trim();

  const week = findWeek(weekNum);
  if (!week) { toast("Pick a valid week."); return; }

  // Generate ad text
  const adText = buildAdText({ name, week, tone, reflection });
  State.generatedPostText = adText;

  // Preview header
  document.getElementById("preview-name").textContent = name;
  document.getElementById("preview-headline").textContent = headline;
  document.getElementById("preview-body").textContent = adText;
  const avatar = document.getElementById("preview-avatar");
  if (State.photoDataUrl) {
    avatar.src = State.photoDataUrl;
  } else {
    avatar.src = placeholderAvatar(name);
  }

  // Render canvas image
  drawPostImage({ name, week, reflection, imgPrompt });

  // Render schedule
  renderSchedule(week);

  document.getElementById("post-output").classList.remove("hidden");
  document.getElementById("copy-post-btn").disabled = false;
  document.getElementById("download-image-btn").disabled = false;
  document.getElementById("open-linkedin-btn").disabled = false;

  toast("Post generated. Scroll down to preview.");
}

function findWeek(num) {
  for (const p of CURRICULUM) {
    const it = p.items.find(i => i.week === num);
    if (it) return { ...it, phaseTitle: p.title, phase: p.phase };
  }
  return null;
}

function buildAdText({ name, week, tone, reflection }) {
  const toneOpeners = {
    reflective: `Week ${week.week} of my Golden Eagle journey. Here's what shifted for me:`,
    bold: `Week ${week.week} done. ${week.topic} is no longer abstract — here's my take:`,
    curious: `I went into Week ${week.week} (${week.topic}) with one question. I came out with three.`,
    celebratory: `🦅 Just wrapped Week ${week.week}: ${week.topic}. Big unlock.`,
  };
  const opener = toneOpeners[tone];
  const userPart = reflection || `${week.content}. The shift: I'm now able to apply this directly in my role.`;
  const hashtags = [
    "#GoldenEagleProgram",
    "#AILeadership",
    `#Week${week.week}`,
    "#" + week.topic.replace(/[^a-zA-Z0-9]/g, ""),
    "#LearningInPublic",
    "#AI",
  ].join(" ");
  return `${opener}\n\n${userPart}\n\nThis is part of my 24-week Golden Eagle Programme AI Leadership Transformation — sharing the journey so others can join, challenge, or learn alongside.\n\nWhat's the one AI skill you wish you had locked down 6 months ago? 👇\n\n${hashtags}`;
}

function drawPostImage({ name, week, reflection, imgPrompt }) {
  const canvas = document.getElementById("post-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // Background — dark radial glow like the brand image
  const theme = pickTheme(imgPrompt);
  const grad = ctx.createRadialGradient(W * 0.38, H * 0.42, 80, W * 0.38, H * 0.42, W * 0.72);
  grad.addColorStop(0, "#2a1608");
  grad.addColorStop(0.5, theme.to);
  grad.addColorStop(1, theme.from);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Secondary glow: warm amber burst from center-bottom
  const glowGrad = ctx.createRadialGradient(W * 0.4, H * 0.85, 0, W * 0.4, H * 0.85, W * 0.6);
  glowGrad.addColorStop(0, "rgba(200,120,10,0.22)");
  glowGrad.addColorStop(0.5, "rgba(160,90,8,0.10)");
  glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle network-line decoration
  drawNetworkLines(ctx, W, H, theme.accent);

  // Eagle watermark top-right
  function drawEagleWatermark() {
    if (_eagleSvgImg.complete && _eagleSvgImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      const ew = 220, eh = Math.round(220 * (295 / 480));
      ctx.drawImage(_eagleSvgImg, W - ew - 24, 10, ew, eh);
      ctx.restore();
    }
  }

  if (State.photoDataUrl) {
    const img = new Image();
    img.onload = () => {
      const cx = W - 200, cy = H / 2, r = 140;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const sz = Math.min(img.width, img.height);
      const sx = (img.width - sz) / 2, sy = (img.height - sz) / 2;
      ctx.drawImage(img, sx, sy, sz, sz, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#d4941e";
      ctx.stroke();
      drawEagleWatermark();
      drawPostText(ctx, W, H, name, week, reflection);
    };
    img.src = State.photoDataUrl;
  } else {
    drawEagleWatermark();
    drawPostText(ctx, W, H, name, week, reflection);
  }
}

function drawPostText(ctx, W, H, name, week, reflection) {
  // Bottom-of-image golden glow sweep
  const sweep = ctx.createLinearGradient(0, H * 0.65, 0, H);
  sweep.addColorStop(0, "rgba(0,0,0,0)");
  sweep.addColorStop(1, "rgba(8,6,4,0.70)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, W, H);

  // Top thin gold line
  const topLine = ctx.createLinearGradient(0, 0, W, 0);
  topLine.addColorStop(0, "transparent");
  topLine.addColorStop(0.3, "#d4941e");
  topLine.addColorStop(0.7, "#f0c040");
  topLine.addColorStop(1, "transparent");
  ctx.fillStyle = topLine;
  ctx.fillRect(0, 0, W, 4);

  // ── Programme badge (top-left) ──
  const badgeX = 50, badgeY = 40;
  // Subtle dark pill bg
  ctx.fillStyle = "rgba(8,6,4,0.65)";
  roundRect(ctx, badgeX - 4, badgeY - 28, 310, 46, 23, true);
  // Eagle emoji
  ctx.font = "28px serif";
  ctx.fillText("🦅", badgeX + 4, badgeY + 8);
  // "GOLDEN EAGLE PROGRAMME" text
  ctx.fillStyle = "#f0c040";
  ctx.font = "700 15px -apple-system, system-ui, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("GOLDEN EAGLE PROGRAMME", badgeX + 40, badgeY + 6);
  ctx.letterSpacing = "0px";

  // ── Week pill ──
  const pillX = 50, pillY = 108;
  const grad = ctx.createLinearGradient(pillX, pillY, pillX + 210, pillY + 42);
  grad.addColorStop(0, "#d4941e");
  grad.addColorStop(1, "#e8a828");
  ctx.fillStyle = grad;
  roundRect(ctx, pillX, pillY, 210, 42, 21, true);
  ctx.fillStyle = "#080604";
  ctx.font = "800 18px -apple-system, system-ui, sans-serif";
  ctx.fillText(`✦  WEEK ${week.week} OF 24`, pillX + 18, pillY + 28);

  // ── Topic heading ──
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 52px -apple-system, system-ui, sans-serif";
  wrapText(ctx, week.topic, 50, 230, 730, 62);

  // Thin gold separator line
  ctx.strokeStyle = "#d4941e";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(50, 360); ctx.lineTo(260, 360); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Phase context ──
  ctx.fillStyle = "rgba(240,192,64,0.80)";
  ctx.font = "500 20px -apple-system, system-ui, sans-serif";
  ctx.fillText(`Phase ${week.phase} · ${week.phaseTitle}`, 50, 398);

  // ── Reflection quote ──
  if (reflection && reflection.length < 130) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "italic 400 20px Georgia, serif";
    wrapText(ctx, `"${reflection}"`, 50, 458, 720, 30);
  }

  // ── Gold divider bar before footer ──
  ctx.fillStyle = "rgba(212,148,30,0.18)";
  ctx.fillRect(0, H - 90, W, 1);

  // ── Footer: name + tagline ──
  ctx.fillStyle = "#f0c040";
  ctx.font = "700 26px -apple-system, system-ui, sans-serif";
  ctx.fillText(name, 50, H - 54);
  ctx.fillStyle = "rgba(212,148,30,0.65)";
  ctx.font = "400 15px -apple-system, system-ui, sans-serif";
  ctx.fillText("Sharing my AI Leadership journey  ·  #GoldenEagleProgramme  ·  #LearningInPublic", 50, H - 30);

  // Bottom thin gold line
  ctx.fillStyle = topLine;
  ctx.fillRect(0, H - 4, W, 4);
}

function pickTheme(prompt) {
  const p = (prompt || "").toLowerCase();
  if (p.includes("purple") || p.includes("violet")) return { from: "#0a0410", to: "#2a0e50", accent: "#c060f0" };
  if (p.includes("green") || p.includes("forest"))  return { from: "#040e06", to: "#0c2a14", accent: "#40c870" };
  if (p.includes("red") || p.includes("crimson"))   return { from: "#0e0404", to: "#2a080a", accent: "#e03040" };
  if (p.includes("teal") || p.includes("cyan"))     return { from: "#030e10", to: "#082830", accent: "#20c8d8" };
  // Default: Golden Eagle brand — deep black to warm dark amber
  return { from: "#080604", to: "#1c1006", accent: "#d4941e" };
}

function drawNetworkLines(ctx, W, H, accentColor) {
  const r = accentColor || "#d4941e";
  const hex2rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [rr,gg,bb] = hex2rgb(r);
  ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.20)`;
  ctx.lineWidth = 1.2;
  const nodes = [];
  const seed = 1234567;
  let s = seed;
  function rand() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
  for (let i = 0; i < 22; i++) nodes.push({ x: rand() * W, y: rand() * H });
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 220) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = `rgba(${rr},${gg},${bb},0.40)`;
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "", yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, yy);
      line = words[i] + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function placeholderAvatar(name) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0b1733";
  ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 40px -apple-system, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name[0] || "?").toUpperCase(), 48, 50);
  return c.toDataURL();
}

// Posting schedule
function renderSchedule(week) {
  const days = {
    daily: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "3x": ["Mon", "Wed", "Fri"],
    weekly: ["Fri"],
    milestone: ["End of Phase"],
  };
  const slots = days[State.frequency];
  const start = new Date();
  const out = [];
  for (let w = 0; w < 4; w++) {
    out.push(`<div style="margin-top: ${w === 0 ? 0 : 12}px;"><strong>Week ${w + 1}</strong></div>`);
    slots.forEach(d => {
      out.push(`<div class="plan-week" style="border:none; padding: 4px 0;">
        <span class="w-num">${d}</span> Draft post — angle: <em>${suggestAngle(week, w * slots.length + slots.indexOf(d))}</em>
      </div>`);
    });
  }
  document.getElementById("schedule-output").innerHTML = out.join("");
}

function suggestAngle(week, idx) {
  const angles = [
    `Reflection on ${week.topic}`,
    `One mistake I made while learning ${week.topic}`,
    `Hot take: why ${week.topic} matters in 2026`,
    `A practical exercise anyone can try this week`,
    `What I'd tell my pre-Golden-Eagle self about ${week.topic}`,
    `3 things ${week.topic} changed in how I work`,
    `Question for my network re: ${week.topic}`,
    `Before/after: how I handled this BEFORE the program vs. now`,
    `Mini-tutorial: applying ${week.topic} in 10 minutes`,
    `Cohort shoutout: someone who taught me about ${week.topic}`,
    `Pro vs. Anti view on ${week.topic}`,
    `The unsexy 80% of ${week.topic} nobody talks about`,
    `What I'd skip if I were starting over`,
    `Tool I discovered this week`,
    `One metric I'm now tracking`,
    `End-of-phase celebration & next chapter`,
  ];
  return angles[idx % angles.length];
}

// Post action buttons
document.getElementById("copy-post-btn").addEventListener("click", () => {
  if (!State.generatedPostText) return;
  navigator.clipboard.writeText(State.generatedPostText);
  toast("Ad copy copied to clipboard.");
});

document.getElementById("download-image-btn").addEventListener("click", () => {
  const canvas = document.getElementById("post-canvas");
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "golden-eagle-post.png";
  a.click();
});

document.getElementById("open-linkedin-btn").addEventListener("click", () => {
  if (State.generatedPostText) navigator.clipboard.writeText(State.generatedPostText);
  toast("Copy pasted to clipboard — paste it in LinkedIn ✨");
  window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
});

// ---------- helpers ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// Restore API key from localStorage if present
const savedKey = localStorage.getItem("ge-anthropic-key");
if (savedKey) document.getElementById("api-key").value = savedKey;
document.getElementById("api-key").addEventListener("change", e => {
  localStorage.setItem("ge-anthropic-key", e.target.value);
});

// ---------- Service worker registration ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ---------- PWA install prompt ----------
let _deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  const wrap = document.getElementById('install-wrap');
  if (wrap) wrap.style.display = 'flex';
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!_deferredInstall) {
    toast('Open in Chrome and use the browser menu to install this app.');
    return;
  }
  _deferredInstall.prompt();
  const { outcome } = await _deferredInstall.userChoice;
  if (outcome === 'accepted') toast('Golden Eagle app installed!');
  _deferredInstall = null;
  document.getElementById('install-wrap').style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  const wrap = document.getElementById('install-wrap');
  if (wrap) wrap.style.display = 'none';
  toast('Golden Eagle is now installed on your device.');
});

// ---------- Preload eagle banner for canvas ----------
const _eagleSvgImg = new Image();
_eagleSvgImg.src = 'eagle-banner.png';

// ── TOKEN USAGE DASHBOARD ────────────────────────────────────────────
function renderUsageDashboard() {
  const records = TokenTracker.load();
  const totals  = TokenTracker.totals();

  // ── Summary cards ──
  document.getElementById("tu-calls").textContent        = totals.calls.toLocaleString();
  document.getElementById("tu-input").textContent        = fmtTokens(totals.inputTokens);
  document.getElementById("tu-output").textContent       = fmtTokens(totals.outputTokens);
  document.getElementById("tu-cost").textContent         = "$" + totals.costUsd.toFixed(4);
  document.getElementById("tu-total-tok").textContent    = fmtTokens(totals.totalTokens);

  // ── Bar chart ──
  drawUsageChart(records);

  // ── History table ──
  const tbody = document.getElementById("tu-history");
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">
      No API calls yet — use "Enhance with Claude" on the Learning Plan page to see usage here.
    </td></tr>`;
  } else {
    tbody.innerHTML = [...records].reverse().map(r => `
      <tr>
        <td>${fmtDate(r.ts)}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.feature}</td>
        <td style="font-size:11px; color:var(--text-muted);">${r.model.replace("claude-","").replace("-2","")}</td>
        <td class="num">${r.inputTokens.toLocaleString()}</td>
        <td class="num">${r.outputTokens.toLocaleString()}</td>
        <td class="num cost">$${r.costUsd.toFixed(4)}</td>
      </tr>`).join("");
  }
}

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" }) + " " +
         d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
}

function drawUsageChart(records) {
  const canvas = document.getElementById("tu-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  if (records.length === 0) {
    ctx.fillStyle = "rgba(212,148,30,0.15)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(212,148,30,0.4)";
    ctx.font = "13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No usage data yet", W / 2, H / 2);
    return;
  }

  // Group by date (last 14 days)
  const buckets = {};
  const now = Date.now();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    buckets[d.toISOString().slice(0, 10)] = { input: 0, output: 0 };
  }
  records.forEach(r => {
    const day = r.ts.slice(0, 10);
    if (buckets[day]) {
      buckets[day].input  += r.inputTokens;
      buckets[day].output += r.outputTokens;
    }
  });

  const days  = Object.keys(buckets);
  const vals  = Object.values(buckets);
  const maxTok = Math.max(...vals.map(v => v.input + v.output), 1);

  const pad = { top: 16, right: 16, bottom: 32, left: 52 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top  - pad.bottom;
  const barW = (cW / days.length) * 0.6;
  const gap  = cW / days.length;

  // Y-axis gridlines
  ctx.strokeStyle = "rgba(212,148,30,0.10)";
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = pad.top + cH * (1 - frac);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(212,148,30,0.5)";
    ctx.font = "10px Inter,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fmtTokens(Math.round(maxTok * frac)), pad.left - 4, y + 3);
  });

  // Bars
  days.forEach((day, i) => {
    const x = pad.left + i * gap + (gap - barW) / 2;
    const tot = vals[i].input + vals[i].output;
    const totalH = (tot / maxTok) * cH;
    const inH    = (vals[i].input / maxTok) * cH;
    const outH   = (vals[i].output / maxTok) * cH;

    if (totalH > 0) {
      // Input bar (bottom)
      const gIn = ctx.createLinearGradient(0, pad.top + cH - inH, 0, pad.top + cH);
      gIn.addColorStop(0, "rgba(212,148,30,0.85)");
      gIn.addColorStop(1, "rgba(160,104,16,0.85)");
      ctx.fillStyle = gIn;
      ctx.beginPath();
      ctx.roundRect(x, pad.top + cH - inH, barW, inH, [3, 3, 0, 0]);
      ctx.fill();

      // Output bar (on top)
      if (outH > 0) {
        const gOut = ctx.createLinearGradient(0, pad.top + cH - totalH, 0, pad.top + cH - inH);
        gOut.addColorStop(0, "rgba(240,192,64,0.90)");
        gOut.addColorStop(1, "rgba(200,148,32,0.90)");
        ctx.fillStyle = gOut;
        ctx.beginPath();
        ctx.roundRect(x, pad.top + cH - totalH, barW, outH, [3, 3, 0, 0]);
        ctx.fill();
      }
    }

    // X-axis label (show every other)
    if (i % 2 === 0 || days.length <= 7) {
      ctx.fillStyle = "rgba(212,148,30,0.55)";
      ctx.font = "9px Inter,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(day.slice(5), x + barW / 2, H - 6);
    }
  });

  // Legend
  ctx.fillStyle = "rgba(212,148,30,0.85)";
  ctx.fillRect(pad.left, 4, 10, 8);
  ctx.fillStyle = "rgba(240,192,64,0.90)";
  ctx.fillRect(pad.left + 65, 4, 10, 8);
  ctx.fillStyle = "rgba(212,148,30,0.65)";
  ctx.font = "10px Inter,sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Input tokens", pad.left + 13, 12);
  ctx.fillText("Output tokens", pad.left + 78, 12);
}

// ── Seed a demo record if storage is empty (so dashboard isn't blank) ──
function seedDemoIfEmpty() {
  if (TokenTracker.load().length === 0) {
    const now = new Date();
    [
      { daysAgo: 6, feature: "Learning Plan — Enhance with Claude",   inp: 1240, out: 620  },
      { daysAgo: 4, feature: "LinkedIn Post — Ad Copy Generator",     inp: 890,  out: 450  },
      { daysAgo: 3, feature: "Learning Plan — Enhance with Claude",   inp: 1380, out: 710  },
      { daysAgo: 1, feature: "LinkedIn Post — Ad Copy Generator",     inp: 760,  out: 380  },
      { daysAgo: 0, feature: "Learning Plan — Enhance with Claude",   inp: 1510, out: 820  },
    ].forEach(({ daysAgo, feature, inp, out }) => {
      const d = new Date(now - daysAgo * 86400000);
      const records = TokenTracker.load();
      const pricing = TOKEN_PRICING["default"];
      records.push({
        id: d.getTime(),
        ts: d.toISOString(),
        feature,
        model: "claude-opus-4-7",
        inputTokens:  inp,
        outputTokens: out,
        totalTokens:  inp + out,
        costUsd: ((inp / 1_000_000) * pricing.input) + ((out / 1_000_000) * pricing.output),
      });
      TokenTracker.save(records);
    });
  }
}

// ---------- init ----------
initAuth();          // Firebase auth guard — redirects to login.html if not signed in
renderCurriculumOverview();
renderGoalPresets();
renderPhasePicker();
updateFreqSummary();
seedDemoIfEmpty();
renderUsageDashboard();
