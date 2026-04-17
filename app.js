
// const firebaseConfig = {
//   apiKey: "AIzaSyDI90juhgTmNBv_lTcCkImhe4GfNlef6YQ",
//   authDomain: "auction-auction-d049a.firebaseapp.com",
//   databaseURL: "https://ef-auction-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "auction-auction-d049a",
//   storageBucket: "auction-auction-d049a.firebasestorage.app",
//   messagingSenderId: "150739598900",
//   appId: "1:150739598900:web:63874caa1fe7f74bf85461"
// };

// firebase.initializeApp(firebaseConfig);
// const db = firebase.database();
// Import the functions you need from the SDKs you need
/* ================= FIREBASE CONFIG ================= */
/* ================= FIREBASE CONFIG ================= */
// DO NOT use "import" statements here if you are using script tags in HTML
/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyDI90juhgTmNBv_lTcCkImhe4GfNlef6YQ",
  authDomain: "auction-auction-d049a.firebaseapp.com",
  databaseURL: "https://auction-auction-d049a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "auction-auction-d049a",
  storageBucket: "auction-auction-d049a.firebasestorage.app",
  messagingSenderId: "150739598900",
  appId: "1:150739598900:web:63874caa1fe7f74bf85461"
};

// Initialize Firebase using the global 'firebase' object 
// created by the compat scripts in your HTML
// This will WORK with your current HTML
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ================= LOGIN & OTHER FUNCTIONS ================= */
// Your handleLogin(), bid(), etc., follow below...

/* ================= REST OF YOUR CODE ================= */
// Your handleLogin, bid, etc. functions go here...

// Note: Analytics is removed because it often causes issues in local testing 
// and isn't needed for your auction to work.

/* ================= THE REST OF YOUR CODE ================= */
// Keep your handleLogin(), bid(), and other functions here...
// Just make sure they don't have "import" or "export" at the top!

// Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

/* ================= SOUND EFFECTS ================= */
const kbcWin  = new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3");
const kbcLose = new Audio("https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3");
kbcWin.volume  = 0.9;
kbcLose.volume = 0.9;

/* ================= GLOBALS ================= */
const TEAMS = ["UK", "AH", "TF", "GOK", "TXS", "EM"];

// BUG FIX: isLoggedIn was assigned but never declared — added explicit declaration.
let role       = "";
let isLoggedIn = false;
let hideTimer  = null;

const ADMIN_PASSWORD  = "124421";
const OWNER_PASSWORDS = {
  "UK": "26786",
  "AH":  "26202",
  "TF":  "26914",
  "GOK":  "26731",
  "TXS": "26983",
  "EM": "26500"
};

/* ================= LOGIN ================= */
function handleLogin() {
  const u = document.getElementById("loginUser").value.trim().toUpperCase();
  const k = document.getElementById("loginKey").value.trim();

  if (u === "ADMIN") {
    if (k !== ADMIN_PASSWORD) {
      alert("Wrong ADMIN password");
      return;
    }
    role       = "ADMIN";
    isLoggedIn = true;
    sessionStorage.setItem("role", "ADMIN");

    document.getElementById("loginBox").style.display  = "none";
    document.getElementById("app").style.display       = "block";
    document.getElementById("adminPanel").style.display = "block";
    // BUG FIX: initTeams() was called on every admin login, wiping purses/slots
    // mid-auction on every refresh. Now only initialises if teams don't exist yet.
    db.ref("teams").once("value", snap => {
      if (!snap.exists()) initTeams();
    });
    return;
  }

  if (TEAMS.includes(u)) {
    if (OWNER_PASSWORDS[u] !== k) {
      alert("Wrong owner password");
      return;
    }
    role       = u;
    isLoggedIn = true;
    sessionStorage.setItem("role", "OWNER");
    sessionStorage.setItem("team", u);

    document.getElementById("loginBox").style.display   = "none";
    document.getElementById("app").style.display        = "block";
    document.getElementById("ownerPanel").style.display = "block";
    document.getElementById("ownerHeader").style.display = "block";
    document.getElementById("ownerTeam").innerText      = role;
    document.getElementById("bottomNav").style.display  = "flex";
    showTab("live");
    return;
  }

  alert("Invalid Login");
}

/* ================= INIT ================= */
function initTeams() {
  TEAMS.forEach(t => {
    db.ref("teams/" + t).set({ purse: 1200, slots: 7 });
  });
}

/* ================= ADMIN FUNCTIONS ================= */
function nextPlayer() {
  const bp = parseInt(document.getElementById("basePrice").value) || 50;

  db.ref("auction/result").remove();
  db.ref("announcement").remove();

  db.ref("auction").set({
    player:           document.getElementById("playerInput").value || "Unknown",
    price:            bp,
    lastBid:          "-",
    lock:             false,
    activePair:       {},
    lastBidderLocked: null,
    canIncrease:      false,
    result:           null
  });
}

function increasePrice() {
  db.ref("auction").transaction(a => {
    if (!a)               return a;
    if (!a.canIncrease)   return a;   // no bid yet — block +10
    if (a.price >= 1200)  return a;   // max price cap

    a.price += 10;
    a.lastBidderLocked = a.lastBid;   // same owner can't re-bid immediately
    a.canIncrease      = false;       // re-enable only after next bid
    return a;
  });
}

function sold() {
  db.ref("auction").once("value", snap => {
    const a = snap.val();
    if (!a || a.lastBid === "-") return;

    db.ref("teams/" + a.lastBid).transaction(t => {
      if (!t || t.purse < a.price || t.slots <= 0) return t;
      t.purse -= a.price;
      t.slots--;
      return t;
    });

    db.ref("auction").update({
      result: {
        status: "SOLD",
        team:   a.lastBid,
        price:  a.price
      },
      lastSold: {
        player: a.player,
        team:   a.lastBid,
        price:  a.price
      },
      activePair: {},
      lock: true
    });

    kbcWin.currentTime = 0;
    kbcWin.play();

    db.ref("soldPlayers").push({
      player: a.player,
      team:   a.lastBid,
      price:  a.price,
      time:   Date.now()
    });
  });
}

function unsold() {
  db.ref("auction").update({
    result:     { status: "UNSOLD" },
    activePair: {},
    lock:       true
  });

  kbcLose.currentTime = 0;
  kbcLose.play();
}

function undoSold() {
  if (!confirm("Undo last SOLD player?")) return;

  db.ref("auction/lastSold").once("value", snap => {
    if (!snap.exists()) {
      alert("Nothing to undo");
      return;
    }

    const ls = snap.val();

    db.ref("teams/" + ls.team).transaction(t => {
      if (!t) return t;
      t.purse += ls.price;
      t.slots += 1;
      return t;
    });

    db.ref("soldPlayers").limitToLast(1).once("value", s => {
      s.forEach(c => c.ref.remove());
    });

    db.ref("auction").update({
      player:      ls.player,
      price:       ls.price,
      lastBid:     "-",
      lock:        false,
      activePair:  {},
      result:      null,
      lastSold:    null,
      canIncrease: false   // BUG FIX: reset so +10 is disabled until next bid
    });

    alert("UNDO successful");
  });
}

function resetAuction() {
  if (!confirm("Are you sure you want to RESET the entire auction?")) return;

  const soldBox = document.getElementById("soldPlayers");
  if (soldBox) soldBox.innerHTML = "";

  db.ref("soldPlayers").remove();

  TEAMS.forEach(t => {
    db.ref("teams/" + t).set({ purse: 1200, slots: 7 });
  });

  db.ref("auction").set({
    player:           "Waiting…",
    price:            0,
    lastBid:          "-",
    lock:             true,
    activePair:       {},
    lastBidderLocked: null,
    result:           null
  });

  db.ref("announcement").remove();
  alert("Auction RESET successful");
}

function announce(msg) {
  db.ref("announcement").set({ text: msg, time: Date.now() });
}

/* ================= OWNER FUNCTIONS ================= */
function bid() {
  db.ref("auction").once("value", snap => {
    const a = snap.val();
    if (!a || a.lock) { alert("Wait for admin"); return; }
    if (a.lastBidderLocked === role) { alert("You already bid, wait"); return; }

    db.ref("teams/" + role).once("value", ts => {
      const t = ts.val();
      if (!t || t.purse < a.price || t.slots <= 0) {
        alert("Not enough purse or slots");
        return;
      }

      let pair = a.activePair || {};
      if (Object.keys(pair).length >= 2 && !pair[role]) {
        alert("Only 2 owners allowed");
        return;
      }

      pair[role] = true;
      db.ref("auction").update({
        activePair:  pair,
        lastBid:     role,
        lock:        true,
        canIncrease: true
      });
    });
  });
}

function out() {
  db.ref("auction/activePair/" + role).remove();
  alert("You are OUT");
}

/* ================= OWNER TAB SWITCHING ================= */
function showTab(tab) {
  document.getElementById("teamLights").style.display   = "none";
  document.getElementById("teams").style.display        = "none";
  document.getElementById("soldPlayers").style.display  = "none";

  if (tab === "live")    document.getElementById("teamLights").style.display  = "block";
  if (tab === "status")  document.getElementById("teams").style.display       = "block";
  if (tab === "players") document.getElementById("soldPlayers").style.display = "block";

  // BUG FIX: .active class was never applied — active tab was never highlighted.
  document.querySelectorAll("#bottomNav button").forEach(btn => {
    btn.classList.remove("active");
  });
  const tabMap = { live: 0, status: 1, players: 2 };
  const idx = tabMap[tab];
  if (idx !== undefined) {
    document.querySelectorAll("#bottomNav button")[idx].classList.add("active");
  }
}

/* ================= FIREBASE LISTENERS ================= */

// --- Auction state ---
db.ref("auction").on("value", snap => {
  if (!snap.exists()) return;
  const a = snap.val();

  // Update live bidding lights
  const lightBox = document.getElementById("teamLights");
  if (lightBox) {
    lightBox.innerHTML = "";
    const active = a.activePair || {};

    TEAMS.forEach(t => {
      const isGreen = active[t];
      const myClass = (role === t) ? "myTeam" : "";
      lightBox.innerHTML += `
        <div class="card ${myClass}">
          <span class="light ${isGreen ? "green" : "red"}"></span>
          <b>${t}</b>
          ${isGreen ? "(BIDDING)" : "(OUT / FREE)"}
          ${role === t ? "⭐" : ""}
        </div>
      `;
    });
  }

  // BUG FIX: these updates were trapped inside the if(lightBox) block,
  // meaning they only ran when lightBox existed. Moved outside so they
  // always execute when auction state changes.
  document.getElementById("playerName").innerText = a.player;
  document.getElementById("price").innerText      = a.price;
  document.getElementById("lastBid").innerText    = a.lastBid;

  const bidBtn = document.getElementById("bidBtn");
  if (role !== "ADMIN" && bidBtn) {
    bidBtn.disabled = a.lock || a.lastBidderLocked === role;
  }

  const incBtn = document.getElementById("incBtn");
  if (role === "ADMIN" && incBtn) {
    incBtn.disabled = !a.canIncrease;
  }

  const result = document.getElementById("result");
  if (a.result) {
    result.style.display = "block";
    if (a.result.status === "SOLD") {
      result.className = "resultBox";
      result.innerHTML = `PLAYER : <b>${a.player}</b><br>SOLD TO : <b>${a.result.team}</b><br>PRICE : <b>${a.result.price}</b>`;
    } else {
      result.className = "resultBox unsold";
      result.innerHTML = `PLAYER : <b>${a.player}</b><br>STATUS : <b>UNSOLD</b>`;
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => result.style.display = "none", 5000);
  } else {
    // BUG FIX: when nextPlayer() sets result:null, hide the result box immediately.
    clearTimeout(hideTimer);
    result.style.display = "none";
  }
});

// --- Announcement popup ---
db.ref("announcement").on("value", snap => {
  if (!snap.exists()) return;
  const box = document.getElementById("announcePopup");
  box.innerHTML      = "<b>ADMIN:</b><br>" + snap.val().text;
  box.style.display  = "block";
  setTimeout(() => box.style.display = "none", 3000);
});

// --- Team status cards ---
db.ref("teams").on("value", snap => {
  const teamsDiv = document.getElementById("teams");
  teamsDiv.innerHTML = "";

  snap.forEach(c => {
    const t       = c.val();
    const myClass = (role === c.key) ? "myTeam" : "";
    const star    = (role === c.key) ? " ⭐ MY TEAM" : "";

    teamsDiv.innerHTML += `
      <div class="card ${myClass}">
        <b>${c.key}</b>${star}<br>
        Purse: ${t.purse}<br>
        Slots: ${t.slots}/7
      </div>
    `;
  });
});

// --- Sold players list ---
window.addEventListener("load", () => {
  const soldBox = document.getElementById("soldPlayers");
  if (!soldBox) {
    console.error("soldPlayers div not found");
    return;
  }

  db.ref("soldPlayers").on("child_added", snap => {
    const p       = snap.val();
    const myClass = (role === p.team) ? "myPlayer" : "";
    const tag     = (role === p.team) ? " ⭐ MY PLAYER" : "";

    const div       = document.createElement("div");
    div.className   = `card ${myClass}`;
    div.innerHTML   = `
      <b>${p.player}</b>${tag}<br>
      Team: ${p.team}<br>
      Price: ${p.price}
    `;
    soldBox.prepend(div);
  });
});