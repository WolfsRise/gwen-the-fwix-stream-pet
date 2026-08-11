(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "controller" ? "controller" : "overlay";
  const normalizeRoom = value => (value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 42);
  const savedRoom = localStorage.getItem("gwen-room");
  const generatedRoom = `gwen-${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12)}`;
  let room = normalizeRoom(params.get("room") || savedRoom || generatedRoom);
  localStorage.setItem("gwen-room", room);

  if (mode === "controller") startController();
  else startOverlay();

  function startOverlay() {
    document.querySelector("#controller").remove();
    const overlay = document.querySelector("#overlay");
    const layout = params.get("layout") === "pet" ? "pet" : "gameplay";
    overlay.classList.add(`layout-${layout}`);
    const pet = document.querySelector("#pet");
    const sprite = document.querySelector("#sprite");
    const badge = document.querySelector("#connectionBadge");
    if (params.get("debug") === "1") badge.style.opacity = "1";
    const idleFrames = [
      "gwen-idle-v3-00.webp",
      "gwen-idle-v3-01.webp",
      "gwen-idle-v3-02.webp",
      "gwen-idle-v3-03.webp",
      "gwen-idle-v3-04.webp",
      "gwen-idle-v3-05.webp"
    ];
    const idleDurations = [2200, 180, 1900, 2400, 2100, 2300];
    const talkFrames = {
      rest: "gwen-talk-rest-v3.webp",
      open: "gwen-talk-open-v3.webp",
      round: "gwen-talk-round-v3.webp"
    };
    const speechOnset = .11;
    const speechRelease = .055;
    let voiceEnergy = 0;
    let target = 0;
    let idleIndex = 0;
    let currentFrame = "";
    let speaking = false;
    let wasSpeaking = false;
    let quietSince = 0;
    let settleUntil = 0;
    let testUntil = 0;
    let nextFrame = performance.now() + idleDurations[0];

    [...idleFrames, ...Object.values(talkFrames)].forEach(source => {
      const image = new Image();
      image.src = source;
    });

    function showFrame(source) {
      if (source === currentFrame) return;
      currentFrame = source;
      sprite.src = source;
    }

    showFrame(idleFrames[0]);

    function fitScene() {
      const scale = Math.min(innerWidth / 1280, innerHeight / 720);
      document.documentElement.style.setProperty("--scene-scale", String(scale));
    }

    fitScene();
    addEventListener("resize", fitScene, { passive: true });

    function connect() {
      const peer = new Peer(`gwen-overlay-${room}`);
      peer.on("connection", conn => {
        badge.textContent = "controller connected";
        badge.classList.add("connected");
        conn.on("data", data => {
          if (data && data.type === "voice") target = Math.max(0, Math.min(1, Number(data.level) || 0));
          if (data && data.type === "test") testUntil = performance.now() + 1400;
        });
        conn.on("close", () => badge.classList.remove("connected"));
      });
      peer.on("error", () => {
        badge.textContent = "reconnecting controller…";
        setTimeout(connect, 2500);
      });
    }

    window.gwenDebug = {
      voice(level = 1) {
        target = Math.max(0, Math.min(1, Number(level) || 0));
      }
    };

    function render(now) {
      const testLevel = now < testUntil
        ? .42 + ((Math.sin(now / 94) + 1) * .22)
        : 0;
      const activeTarget = Math.max(target, testLevel);
      voiceEnergy += (activeTarget - voiceEnergy) * (activeTarget > voiceEnergy ? .38 : .12);
      target *= .89;

      if (!speaking && voiceEnergy >= speechOnset) {
        speaking = true;
        quietSince = 0;
      } else if (speaking && voiceEnergy < speechRelease) {
        quietSince ||= now;
        if (now - quietSince > 190) speaking = false;
      } else if (voiceEnergy >= speechRelease) {
        quietSince = 0;
      }

      pet.style.setProperty("--voice-energy", voiceEnergy.toFixed(3));
      pet.dataset.speaking = speaking ? "true" : "false";

      if (speaking) {
        const cadence = Math.max(108, 172 - voiceEnergy * 46);
        const phase = Math.floor(now / cadence) % 4;
        let mouth = "rest";
        if (phase === 1) mouth = voiceEnergy > .42 ? "open" : "round";
        if (phase === 3) mouth = voiceEnergy > .58 ? "round" : "open";
        showFrame(talkFrames[mouth]);
        nextFrame = now + 900;
        settleUntil = 0;
      } else {
        if (wasSpeaking) {
          settleUntil = now + 180;
          nextFrame = settleUntil + idleDurations[idleIndex];
          showFrame(talkFrames.rest);
        } else if (now >= settleUntil && now >= nextFrame) {
          idleIndex = (idleIndex + 1) % idleFrames.length;
          showFrame(idleFrames[idleIndex]);
          nextFrame = now + idleDurations[idleIndex];
        }
      }

      wasSpeaking = speaking;
      requestAnimationFrame(render);
    }

    connect();
    requestAnimationFrame(render);
  }

  function startController() {
    document.querySelector("#overlay").remove();
    const controller = document.querySelector("#controller");
    controller.hidden = false;
    const roomInput = document.querySelector("#room");
    const applyRoom = document.querySelector("#applyRoom");
    const startMic = document.querySelector("#startMic");
    const testTalk = document.querySelector("#testTalk");
    const sensitivity = document.querySelector("#sensitivity");
    const meterFill = document.querySelector("#meterFill");
    const status = document.querySelector("#status");
    const overlayUrl = document.querySelector("#overlayUrl");
    let connection;
    let microphoneActive = false;

    roomInput.value = room;
    updateUrl();
    connect();

    applyRoom.addEventListener("click", () => {
      room = normalizeRoom(roomInput.value) || generatedRoom;
      localStorage.setItem("gwen-room", room);
      params.set("room", room);
      history.replaceState(null, "", `${location.pathname}?mode=controller&room=${encodeURIComponent(room)}`);
      updateUrl();
      connect();
    });

    testTalk.addEventListener("click", () => send({ type: "test" }));
    startMic.addEventListener("click", enableMic, { once: true });

    function updateUrl() {
      overlayUrl.textContent = `${location.origin}${location.pathname}?mode=overlay&layout=gameplay&room=${encodeURIComponent(room)}`;
    }

    function connect() {
      status.textContent = "Connecting to Gwen’s overlay…";
      const peer = new Peer();
      peer.on("open", () => {
        connection = peer.connect(`gwen-overlay-${room}`, { reliable: false });
        connection.on("open", () => {
          status.textContent = microphoneActive
            ? "Ready—Gwen is following your voice."
            : "Overlay connected. Enable your microphone.";
        });
        connection.on("close", () => { status.textContent = "Overlay disconnected. Press Connect to retry."; });
      });
      peer.on("error", () => { status.textContent = "Waiting for the Lightstream overlay. Press Connect after it appears."; });
    }

    async function enableMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        const audio = new AudioContext();
        const source = audio.createMediaStreamSource(stream);
        const analyser = audio.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = .45;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        startMic.textContent = "Microphone active";
        startMic.disabled = true;
        microphoneActive = true;
        status.textContent = "Listening locally—talk normally and adjust sensitivity if needed.";
        setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const centered = (sample - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / samples.length);
          const level = Math.max(0, Math.min(1, (rms - .012) * Number(sensitivity.value) * 7));
          meterFill.style.width = `${level * 100}%`;
          send({ type: "voice", level: Number(level.toFixed(3)) });
        }, 65);
      } catch (error) {
        status.textContent = `Microphone permission failed: ${error.message}`;
        startMic.addEventListener("click", enableMic, { once: true });
      }
    }

    function send(data) {
      if (connection && connection.open) connection.send(data);
    }
  }
})();
