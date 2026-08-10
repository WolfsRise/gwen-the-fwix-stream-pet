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
    const pet = document.querySelector("#pet");
    const sprite = document.querySelector("#sprite");
    const badge = document.querySelector("#connectionBadge");
    if (params.get("debug") === "1") badge.style.opacity = "1";
    const idleFrames = [0, 1, 2, 3, 4, 5];
    const idleDurations = [280, 110, 110, 140, 140, 320];
    let energy = 0;
    let target = 0;
    let frameIndex = 0;
    let nextFrame = performance.now() + idleDurations[0];

    function connect() {
      const peer = new Peer(`gwen-overlay-${room}`);
      peer.on("connection", conn => {
        badge.textContent = "controller connected";
        badge.classList.add("connected");
        conn.on("data", data => {
          if (data && data.type === "voice") target = Math.max(0, Math.min(1, Number(data.level) || 0));
          if (data && data.type === "test") target = 1;
        });
        conn.on("close", () => badge.classList.remove("connected"));
      });
      peer.on("error", () => {
        badge.textContent = "reconnecting controller…";
        setTimeout(connect, 2500);
      });
    }

    function render(now) {
      energy += (target - energy) * (target > energy ? .42 : .15);
      target *= .9;
      pet.style.setProperty("--energy", energy.toFixed(3));
      if (now >= nextFrame) {
        frameIndex = (frameIndex + 1) % idleFrames.length;
        const frame = idleFrames[frameIndex];
        sprite.src = `idle-${String(frame).padStart(2, "0")}.webp`;
        nextFrame = now + (energy > .15 ? Math.max(80, idleDurations[frameIndex] * .55) : idleDurations[frameIndex]);
      }
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
      overlayUrl.textContent = `${location.origin}${location.pathname}?mode=overlay&room=${encodeURIComponent(room)}`;
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
