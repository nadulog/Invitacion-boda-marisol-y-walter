(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const weddingDate = new Date("2026-12-18T19:30:00-03:00");
  let activeModal = null;
  let lastFocused = null;
  let lockedScrollY = 0;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function scrollInstantly(top) {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    root.style.scrollBehavior = previousBehavior;
  }

  scrollInstantly(0);

  function updateCountdown() {
    const distance = Math.max(0, weddingDate.getTime() - Date.now());
    const values = {
      days: Math.floor(distance / 86400000),
      hours: Math.floor((distance / 3600000) % 24),
      minutes: Math.floor((distance / 60000) % 60),
      seconds: Math.floor((distance / 1000) % 60)
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = id === "days" ? String(value) : String(value).padStart(2, "0");
    });
  }
  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  const revealObserver = "IntersectionObserver" in window && !reducedMotion
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 })
    : null;

  document.querySelectorAll(".reveal").forEach((el) => {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add("is-visible");
  });

  function lockPage() {
    lockedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = "100%";
    document.body.classList.add("modal-open");
  }

  function unlockPage() {
    document.body.classList.remove("modal-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    scrollInstantly(lockedScrollY);
  }

  function openModal(modal) {
    if (!modal || activeModal) return;
    activeModal = modal;
    lastFocused = document.activeElement;
    modal.hidden = false;
    modal.querySelector(".modal__sheet").style.setProperty("--drag-y", "0px");
    lockPage();
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      modal.querySelector(".modal__sheet").focus({ preventScroll: true });
    });
  }

  function closeModal(modal, fromDrag) {
    if (!modal || modal !== activeModal) return;
    const sheet = modal.querySelector(".modal__sheet");
    if (fromDrag) sheet.style.setProperty("--drag-y", `${Math.max(window.innerHeight, sheet.offsetHeight)}px`);
    modal.classList.remove("is-open", "is-dragging");
    const finish = () => {
      modal.hidden = true;
      sheet.style.setProperty("--drag-y", "0px");
      activeModal = null;
      unlockPage();
      if (lastFocused) lastFocused.focus({ preventScroll: true });
    };
    if (reducedMotion) finish();
    else window.setTimeout(finish, 390);
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => openModal(document.getElementById(button.dataset.openModal)));
  });
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal")));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeModal) closeModal(activeModal);
    if (event.key === "Tab" && activeModal) {
      const focusables = [...activeModal.querySelectorAll("a[href], button, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    const sheet = modal.querySelector(".modal__sheet");
    const dragHandle = modal.querySelector(".modal__drag");
    let tracking = false;
    let startY = 0;
    let lastY = 0;
    let startTime = 0;
    let lastTime = 0;

    dragHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      tracking = true;
      startY = lastY = event.clientY;
      startTime = lastTime = performance.now();
      modal.classList.add("is-dragging");
      dragHandle.setPointerCapture(event.pointerId);
    });

    dragHandle.addEventListener("pointermove", (event) => {
      if (!tracking) return;
      const delta = Math.max(0, event.clientY - startY);
      lastY = event.clientY;
      lastTime = performance.now();
      sheet.style.setProperty("--drag-y", `${delta}px`);
      modal.querySelector(".modal__backdrop").style.opacity = String(Math.max(0, 1 - delta / 360));
    });

    function endDrag(event) {
      if (!tracking) return;
      tracking = false;
      if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
      const distance = Math.max(0, lastY - startY);
      const elapsed = Math.max(1, lastTime - startTime);
      const velocity = distance / elapsed;
      modal.classList.remove("is-dragging");
      modal.querySelector(".modal__backdrop").style.opacity = "";
      if (distance > 120 || (distance > 28 && velocity > 0.65)) closeModal(modal, true);
      else sheet.style.setProperty("--drag-y", "0px");
    }
    dragHandle.addEventListener("pointerup", endDrag);
    dragHandle.addEventListener("pointercancel", endDrag);
  });

  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  async function copyText(text, success) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(success);
    } catch (_error) {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      showToast(success);
    }
  }
  document.getElementById("copyAlias").addEventListener("click", () => copyText("Marisol.Barbieri", "Alias copiado"));
  document.getElementById("copyAddress").addEventListener("click", () => copyText("Wilde 1561, Barrio La Reja Grande. Acceso Oeste km 41.", "Dirección copiada"));

  document.getElementById("calendarButton").addEventListener("click", () => {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bloomdate//Walter y Marisol//ES", "BEGIN:VEVENT",
      "UID:walter-marisol-18122026@bloomdate", "DTSTAMP:20260926T120000Z", "DTSTART:20261218T223000Z",
      "SUMMARY:Boda de Walter y Marisol", "LOCATION:Azahares Eventos\\, Wilde 1561\\, Barrio La Reja Grande",
      "DESCRIPTION:Ceremonia y celebración", "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    link.download = "Boda-Walter-y-Marisol.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  const audio = document.getElementById("weddingAudio");
  const musicButton = document.getElementById("musicButton");
  const audioToggle = document.getElementById("audioToggle");
  const musicStatus = document.getElementById("musicStatus");
  const invitationIntro = document.getElementById("invitationIntro");
  const enterWithMusic = document.getElementById("enterWithMusic");
  const enterWithoutMusic = document.getElementById("enterWithoutMusic");

  function setMusicState(isPlaying) {
    musicButton.setAttribute("aria-pressed", String(isPlaying));
    audioToggle.setAttribute("aria-pressed", String(isPlaying));
    audioToggle.setAttribute("aria-label", isPlaying ? "Apagar música" : "Encender música");
    musicButton.setAttribute("aria-label", isPlaying ? "Pausar nuestra canción" : "Reproducir nuestra canción");
  }

  async function toggleMusic() {
    if (!audio.paused) {
      audio.pause();
      setMusicState(false);
      return;
    }
    try {
      await audio.play();
      setMusicState(true);
      musicStatus.textContent = "";
    } catch (_error) {
      musicStatus.textContent = "Tocá nuevamente para reproducir la música.";
      showToast("No pudimos iniciar la música");
    }
  }

  async function enterInvitation(withMusic) {
    if (withMusic) {
      try {
        await audio.play();
        setMusicState(true);
        musicStatus.textContent = "";
      } catch (_error) {
        setMusicState(false);
        showToast("Podés encender la música desde el botón inferior");
      }
    } else {
      audio.pause();
      setMusicState(false);
    }

    document.body.classList.remove("intro-open");
    invitationIntro.classList.add("is-leaving");
    scrollInstantly(0);
    window.setTimeout(() => { invitationIntro.hidden = true; }, reducedMotion ? 0 : 560);
  }

  enterWithMusic.addEventListener("click", () => enterInvitation(true));
  enterWithoutMusic.addEventListener("click", () => enterInvitation(false));
  musicButton.addEventListener("click", toggleMusic);
  audioToggle.addEventListener("click", toggleMusic);
  audio.addEventListener("play", () => setMusicState(true));
  audio.addEventListener("pause", () => setMusicState(false));

})();
