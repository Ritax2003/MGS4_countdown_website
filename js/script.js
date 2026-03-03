(() => {
  const el = (id) => document.getElementById(id);

  const closeMenu = () => {
    if (!menuOpen) return;
    menuOpen = false;
    setMenu(false);
    playSfx(menuCloseSfx);
  };

  const overlay = el("overlay");
  const message = el("message");
  const video = el("bg");

  const introAudio = el("introAudio");
  const loopAudio = el("loopAudio");

  let audioCtx = null;
  let musicGain = null;

  let introBuf = null;
  let loopBuf = null;

  let introNode = null;
  let loopNode = null;
  let introGain = null;
  let loopGain = null;

  let usingWebAudio = false;

  const getMediaSrc = (mediaEl, fallback) => {
    if (!mediaEl) return fallback;
    const attr = mediaEl.getAttribute ? mediaEl.getAttribute("src") : null;
    if (attr) return attr;
    if (mediaEl.currentSrc) return mediaEl.currentSrc;
    if (mediaEl.src) return mediaEl.src;
    return fallback;
  };

  const INTRO_URL = getMediaSrc(introAudio, "audio/intro.mp3");
  const LOOP_URL = getMediaSrc(loopAudio, "audio/loop.mp3");

  const ensureAudioCtx = () => {
    if (audioCtx && musicGain) return true;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    try {
      audioCtx = new Ctx();
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 1;
      musicGain.connect(audioCtx.destination);
      return true;
    } catch (_) {
      audioCtx = null;
      musicGain = null;
      return false;
    }
  };

  const initMusicGain = () => {
    ensureAudioCtx();
  };

  const resumeAudioCtx = () => {
    if (!audioCtx) return;
    if (audioCtx.state !== "suspended") return;
    audioCtx.resume().catch(() => {});
  };

  const stopWebAudioMusic = () => {
    if (introNode) {
      try {
        introNode.stop(0);
      } catch (_) {}
      try {
        introNode.disconnect();
      } catch (_) {}
      introNode = null;
    }
    if (loopNode) {
      try {
        loopNode.stop(0);
      } catch (_) {}
      try {
        loopNode.disconnect();
      } catch (_) {}
      loopNode = null;
    }
    if (introGain) {
      try {
        introGain.disconnect();
      } catch (_) {}
      introGain = null;
    }
    if (loopGain) {
      try {
        loopGain.disconnect();
      } catch (_) {}
      loopGain = null;
    }
  };

  const introFetch = fetch(INTRO_URL, { cache: "force-cache" })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  const loopFetch = fetch(LOOP_URL, { cache: "force-cache" })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  const decodeBuffers = async () => {
    if (!ensureAudioCtx()) return false;
    resumeAudioCtx();

    if (introBuf && loopBuf) return true;

    const [introAb, loopAb] = await Promise.all([introFetch, loopFetch]);
    if (!introAb || !loopAb || !audioCtx) return false;

    try {
      const [iBuf, lBuf] = await Promise.all([
        audioCtx.decodeAudioData(introAb.slice(0)),
        audioCtx.decodeAudioData(loopAb.slice(0)),
      ]);
      introBuf = iBuf;
      loopBuf = lBuf;
      return true;
    } catch (_) {
      introBuf = null;
      loopBuf = null;
      return false;
    }
  };

  const startWebAudioIntroThenLoop = async () => {
    const ok = await decodeBuffers();
    if (!ok || !introBuf || !loopBuf || !audioCtx || !musicGain) return false;

    stopWebAudioMusic();

    const startAt = audioCtx.currentTime + 0.05;
    const introDur = introBuf.duration;

    const XFADE = 0.02;

    introGain = audioCtx.createGain();
    loopGain = audioCtx.createGain();

    introGain.gain.setValueAtTime(1, startAt);
    loopGain.gain.setValueAtTime(0, startAt);

    introNode = audioCtx.createBufferSource();
    introNode.buffer = introBuf;
    introNode.loop = false;

    loopNode = audioCtx.createBufferSource();
    loopNode.buffer = loopBuf;
    loopNode.loop = true;

    introNode.connect(introGain);
    loopNode.connect(loopGain);

    introGain.connect(musicGain);
    loopGain.connect(musicGain);

    const fadeStart = startAt + Math.max(0, introDur - XFADE);

    introGain.gain.setValueAtTime(1, fadeStart);
    introGain.gain.linearRampToValueAtTime(0, startAt + introDur);

    loopGain.gain.setValueAtTime(0, fadeStart);
    loopGain.gain.linearRampToValueAtTime(1, startAt + introDur);

    introNode.start(startAt);
    loopNode.start(fadeStart);

    usingWebAudio = true;
    return true;
  };

  const stopElementMusic = () => {
    if (introAudio) introAudio.pause();
    if (loopAudio) loopAudio.pause();
  };

  const restartElementMusic = () => {
    stopElementMusic();
    if (introAudio) introAudio.currentTime = 0;
    if (loopAudio) loopAudio.currentTime = 0;
    if (!experienceStarted) return;
    tryPlay(introAudio);
  };

  const stopMusic = () => {
    if (usingWebAudio) stopWebAudioMusic();
    stopElementMusic();
  };

  const restartMusic = async () => {
    stopMusic();

    if (!experienceStarted) return;

    const ok = await startWebAudioIntroThenLoop();
    if (!ok) {
      usingWebAudio = false;
      restartElementMusic();
    }
  };

  const menuToggle = el("menuToggle");
  const menuPanel = el("menuPanel");
  const menuDimmer = el("menuDimmer");
  const menuOpenSfx = el("menuOpenSfx");
  const menuCloseSfx = el("menuCloseSfx");
  const menuSelectSfx = el("menuSelectSfx");
  const musicToggle = el("musicToggle");
  const musicToggleText = el("musicToggleText");
  const musicVolume = el("musicVolume");
  const menuOfficial = el("menuOfficial");
  const menuDesktop = el("menuDesktop");
  const menuTipJar = el("menuTipJar");

  const progressUI = el("progressUI");
  const progressFill = el("progressFill");
  const progressLabel = el("progressLabel");
  const progressPercent = el("progressPercent");
  const progressRemaining = el("progressRemaining");

  const sideUI = el("sideUI");
  const sideText = el("sideText");

  const PROGRESS_START = new Date("2026-02-12T00:00:00-06:00").getTime();
  const PROGRESS_END = new Date("2026-08-27T00:00:00-07:00").getTime(); // PT (PDT)


  const SIDE_FADE_MS = 1500;
  const SIDE_HOLD_MS = 6000;

  const TIPS_URL = "tips.txt";
  const FALLBACK_TIPS = [""];
  let sideMessages = FALLBACK_TIPS.slice();

  const tipsReady = (async () => {
    try {
      const res = await fetch(TIPS_URL, { cache: "no-store" });
      if (!res.ok) return;
      const text = await res.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length) sideMessages = lines;
    } catch (_) {}
  })();

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const tryPlay = (a) => a && a.play && a.play().catch(() => {});
  const playSfx = (a) => {
    if (!a) return;
    a.currentTime = 0;
    tryPlay(a);
  };

  let experienceStarted = false;

  let countdownCompleteFired = false;

  let countdownComplete = false;
  let pulseTimeoutId = null;

  let completeSfx = null;

  const prepareCompleteSfx = () => {
    if (completeSfx) return;
    try {
      completeSfx = new Audio("audio/complete.mp3");
      completeSfx.preload = "auto";

      // Unlock playback on user gesture (this click), without audible output.
      const prevVol = completeSfx.volume;
      completeSfx.volume = 0;

      const finalize = () => {
        try {
          completeSfx.pause();
        } catch (_) {}
        try {
          completeSfx.currentTime = 0;
        } catch (_) {}
        completeSfx.volume = prevVol;
      };

      const p = completeSfx.play();
      if (p && p.then) p.then(finalize).catch(finalize);
      else finalize();
    } catch (_) {
      completeSfx = null;
    }
  };

  const playCompleteSfx = () => {
    if (!completeSfx) {
      try {
        completeSfx = new Audio("audio/complete.mp3");
        completeSfx.preload = "auto";
      } catch (_) {
        completeSfx = null;
      }
    }
    if (!completeSfx) return;

    try {
      completeSfx.currentTime = 0;
    } catch (_) {}
    tryPlay(completeSfx);
  };

  const onCountdownComplete = () => {
    // Fires ONCE, and only after the user clicks the overlay.
    countdownComplete = true;

    if (pulseTimeoutId) {
      clearTimeout(pulseTimeoutId);
      pulseTimeoutId = null;
    }

    if (progressLabel) {
      progressLabel.classList.remove("pulse");
      progressLabel.textContent = "Complete";
    }

    playCompleteSfx();

    // Optional hooks (harmless if unused).
    try {
      window.dispatchEvent(new CustomEvent("mgs4CountdownComplete"));
    } catch (_) {}

    if (typeof window.onMGS4CountdownComplete === "function") {
      try {
        window.onMGS4CountdownComplete();
      } catch (err) {
        console.error("onMGS4CountdownComplete() threw:", err);
      }
    }
  };

  let musicMuted = false;
  let musicVolumeValue = 1;

  const setMusicMuted = (muted, persist = true) => {
    musicMuted = !!muted;

    if (musicMuted) {
      stopMusic();
      if (introAudio) introAudio.currentTime = 0;
      if (loopAudio) loopAudio.currentTime = 0;
    } else {
      restartMusic();
    }

    if (musicToggle) {
      musicToggle.classList.toggle("musicMuted", musicMuted);
      musicToggle.setAttribute("aria-pressed", musicMuted ? "true" : "false");
    }
    if (musicToggleText) {
      musicToggleText.textContent = musicMuted ? "Turn On Music" : "Turn Off Music";
    }

    if (!persist) return;
    try {
      localStorage.setItem("musicMuted", musicMuted ? "1" : "0");
    } catch (_) {}
  };

  const setMusicVolume = (v, persist = true) => {
    const clamped = Math.max(0, Math.min(1, Number(v)));
    musicVolumeValue = Number.isFinite(clamped) ? clamped : 1;

    if (musicGain) {
      const now = audioCtx ? audioCtx.currentTime : 0;
      try {
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(musicVolumeValue, now + 0.02);
      } catch (_) {
        musicGain.gain.value = musicVolumeValue;
      }
    } else {
      if (introAudio) introAudio.volume = musicVolumeValue;
      if (loopAudio) loopAudio.volume = musicVolumeValue;
    }

    if (musicVolume) {
      musicVolume.value = String(Math.round(musicVolumeValue * 100));
    }

    if (!persist) return;
    try {
      localStorage.setItem("musicVolume", String(musicVolumeValue));
    } catch (_) {}
  };

  try {
    const savedVol = localStorage.getItem("musicVolume");
    if (savedVol !== null) musicVolumeValue = Number(savedVol);
  } catch (_) {}

  try {
    const saved = localStorage.getItem("musicMuted");
    if (saved === "1") musicMuted = true;
  } catch (_) {}

  setMusicVolume(musicVolumeValue, false);
  setMusicMuted(musicMuted, false);

  if (musicToggle) {
    musicToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setMusicMuted(!musicMuted);
    });
  }

  if (musicVolume) {
    const onVol = (e) => {
      const raw = Number(e.target.value);
      setMusicVolume(raw / 100);
    };
    musicVolume.addEventListener("input", onVol);
    musicVolume.addEventListener("change", onVol);
  }

  const setMenu = (open) => {
    menuToggle.classList.toggle("open", open);
    menuPanel.classList.toggle("open", open);
    menuDimmer.classList.toggle("open", open);
    menuDimmer.setAttribute("aria-hidden", open ? "false" : "true");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuPanel.setAttribute("aria-hidden", open ? "false" : "true");
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuToggle.title = open ? "Close" : "Menu";
  };

  const updateProgress = () => {
    const now = Date.now();

    const total = PROGRESS_END - PROGRESS_START;
    const elapsed = now - PROGRESS_START;

    let pct = 0;
    if (Number.isFinite(total) && total > 0) {
      if (now >= PROGRESS_END) {
        pct = 100;
      } else {
        pct = Math.floor((elapsed / total) * 100);
        pct = clamp(pct, 0, 99);
      }
    }

    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";

    let remainingMs = PROGRESS_END - now;
    if (!Number.isFinite(remainingMs) || remainingMs < 0) remainingMs = 0;

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    progressRemaining.textContent =
      `${days} day(s), ${hours} hour(s), ${minutes} minute(s), ${seconds} second(s) remaining`;

    const isComplete = now >= PROGRESS_END || remainingMs === 0;

    if (experienceStarted && !countdownCompleteFired && isComplete) {
      countdownCompleteFired = true;
      onCountdownComplete();
    }
  };


  let progressShown = false;
  const showProgressUI = () => {
    if (progressShown) return;
    progressShown = true;
    progressUI.classList.add("show");
    menuToggle.classList.add("show");

    pulseTimeoutId = setTimeout(() => {
      if (!countdownComplete) progressLabel.classList.add("pulse");
    }, 650);
  };

  let sideStarted = false;
  const startSideLoop = async () => {
    await tipsReady;
    if (sideStarted || !sideMessages.length) return;
    sideStarted = true;
    sideUI.classList.add("show");

    let i = 0;
    while (true) {
      sideText.innerHTML = sideMessages[i];
      sideText.classList.add("show");
      await sleep(SIDE_FADE_MS + SIDE_HOLD_MS);
      sideText.classList.remove("show");
      await sleep(SIDE_FADE_MS);
      i = (i + 1) % sideMessages.length;
    }
  };

  const MESSAGE_FADE_MS = 900;
  const showMenuButton = () => menuToggle.classList.add("show");

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      message.classList.add("show");
      setTimeout(showMenuButton, MESSAGE_FADE_MS);
    })
  );

  updateProgress();
  setInterval(updateProgress, 1000);

  if (introAudio) {
    introAudio.addEventListener("ended", () => {
      if (usingWebAudio) return;
      if (musicMuted) return;
      if (!loopAudio) return;
      loopAudio.currentTime = 0;
      tryPlay(loopAudio);
    });
  }

  let menuOpen = false;
  setMenu(false);

  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    menuOpen = !menuOpen;
    setMenu(menuOpen);
    playSfx(menuOpen ? menuOpenSfx : menuCloseSfx);
  });

  menuPanel.addEventListener("click", (e) => e.stopPropagation());

  menuDimmer.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!menuOpen) return;
    menuOpen = false;
    setMenu(false);
    playSfx(menuCloseSfx);
  });

  const bindMenuItemHover = () => {
    const items = document.querySelectorAll(".menuItem");
    items.forEach((btn) => {
      btn.addEventListener("pointerenter", () => playSfx(menuSelectSfx));
      btn.addEventListener("focus", () => playSfx(menuSelectSfx));
    });
  };

  bindMenuItemHover();

  if (menuOfficial) {
    menuOfficial.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  if (menuDesktop) {
    menuDesktop.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  if (menuTipJar) {
    menuTipJar.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  document.addEventListener("click", () => {
    if (!menuOpen) return;
    menuOpen = false;
    setMenu(false);
    playSfx(menuCloseSfx);
  });

  overlay.addEventListener(
    "click",
    async () => {
      overlay.classList.add("fade");
      video.classList.add("show");

      updateProgress();
      setTimeout(showProgressUI, 520);
      setTimeout(startSideLoop, 520);

      tryPlay(video);

      initMusicGain();
      resumeAudioCtx();
      setMusicVolume(musicVolumeValue, false);
      // Mark the experience as started (user gesture has happened).
      experienceStarted = true;

      // If the countdown already finished before the user arrived,
      // DO NOT run the silent "unlock" play — it can steal/zero out the SFX.
      const alreadyComplete = Date.now() >= PROGRESS_END;

      if (!alreadyComplete) {
        // Unlock SFX playback for later (when countdown completes in the future).
        prepareCompleteSfx();
      } else {
        // Optional: pre-create the element to reduce latency.
        if (!completeSfx) {
          try {
            completeSfx = new Audio("audio/complete.mp3");
            completeSfx.preload = "auto";
          } catch (_) {
            completeSfx = null;
          }
        }
      }

      if (!countdownCompleteFired && alreadyComplete) {
        countdownCompleteFired = true;
        onCountdownComplete();
      }


      if (musicMuted) {
        stopMusic();
        if (introAudio) introAudio.currentTime = 0;
        if (loopAudio) loopAudio.currentTime = 0;
      } else {
        await restartMusic();
      }
    },
    { once: true }
  );

  var kcSfx = new Audio("audio/kc.mp3");
  kcSfx.preload = "auto";

  var kC = "38,38,40,40,37,39,37,39,66,65";
  var kP = [];
  var kT = false;

  var cK = function (e) {
    if (!experienceStarted) return;
    if (kT) return;

    kP.push(e.keyCode);

    if (kP.length > 10) kP = kP.slice(-10);

    if (kP.join() === kC) {
      rK();
    }
  };

  var rK = function () {
    if (kT) return;
    kT = true;

    document.removeEventListener("keyup", cK);

    try {
      kcSfx.play().catch(function () {});
    } catch (_) {}

    if (video) {
      video.playbackRate = 4;
      video.defaultPlaybackRate = 4;
    }
  };

  document.addEventListener("keyup", cK);
})();
