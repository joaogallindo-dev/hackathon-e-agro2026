(() => {
  "use strict";

  const screens = Array.from(document.querySelectorAll(".screen"));
  const mainContent = document.getElementById("main-content");
  const analyzeButton = document.getElementById("analyze-button");
  const coordinateStatus = document.getElementById("location-status");
  const coordinateText = document.getElementById("coordinate-text");
  const mapElement = document.getElementById("map");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatForm = document.getElementById("chat-form");

  let currentScreen = "home";
  let returnFromChat = "result";
  let mapInstance = null;
  let mapMarker = null;
  let brazilMarker = null;
  let analysisTimer = null;
  let replyTimer = null;

  function activateScreen(name) {
    const nextScreen = document.getElementById(`screen-${name}`);
    if (!nextScreen) return;

    screens.forEach((screen) => {
      const isActive = screen === nextScreen;
      screen.hidden = !isActive;
      screen.classList.toggle("is-active", isActive);
      screen.setAttribute("aria-hidden", String(!isActive));
    });

    currentScreen = name;
    window.scrollTo(0, 0);
    const heading = nextScreen.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    } else {
      mainContent.focus({ preventScroll: true });
    }

    if (name === "location") {
      initializeMap();
      if (mapInstance) requestAnimationFrame(() => mapInstance.invalidateSize());
    }
  }

  function initializeMap() {
    if (mapInstance || !mapElement) return;

    if (!window.L) {
      mapElement.classList.add("map-unavailable");
      mapElement.textContent = "Não foi possível carregar o mapa. Você ainda pode informar as coordenadas manualmente abaixo.";
      return;
    }

    mapInstance = window.L.map(mapElement, { keyboard: true }).setView([-14.235, -51.925], 4);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(mapInstance);
    addBrazilReferenceMarker();

    mapInstance.on("click", (event) => setLocation(event.latlng.lat, event.latlng.lng));
    mapInstance.getContainer().addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const center = mapInstance.getCenter();
        setLocation(center.lat, center.lng);
      }
    });
  }

  function addBrazilReferenceMarker() {
    if (!mapInstance || !window.L || brazilMarker) return;
    const flagIcon = window.L.divIcon({
      className: "",
      html: '<span class="map-marker map-marker-country" aria-hidden="true">🇧🇷</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    brazilMarker = window.L.marker([-14.235, -51.925], {
      icon: flagIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 500,
    }).addTo(mapInstance);
  }

  function setLocation(latitude, longitude) {
    const formattedLatitude = latitude.toFixed(5);
    const formattedLongitude = longitude.toFixed(5);

    coordinateText.textContent = `Latitude ${formattedLatitude} · Longitude ${formattedLongitude}`;
    coordinateStatus.hidden = false;
    document.getElementById("confirm-location").disabled = false;
    document.getElementById("latitude-input").value = formattedLatitude;
    document.getElementById("longitude-input").value = formattedLongitude;
    document.getElementById("coordinate-error").hidden = true;
    document.getElementById("latitude-input").removeAttribute("aria-invalid");
    document.getElementById("longitude-input").removeAttribute("aria-invalid");

    if (mapInstance && window.L) {
      if (brazilMarker) mapInstance.removeLayer(brazilMarker);
      brazilMarker = null;
      const markerIcon = window.L.divIcon({
        className: "",
        html: '<span class="map-marker" aria-hidden="true"><i class="ph-fill ph-map-pin"></i></span>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      if (mapMarker) mapInstance.removeLayer(mapMarker);
      mapMarker = window.L.marker([latitude, longitude], { icon: markerIcon }).addTo(mapInstance);
    }
  }

  function useManualCoordinates() {
    const latitudeField = document.getElementById("latitude-input");
    const longitudeField = document.getElementById("longitude-input");
    const latitude = latitudeField.valueAsNumber;
    const longitude = longitudeField.valueAsNumber;
    const isValid = Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180;

    if (!isValid) {
      document.getElementById("coordinate-error").hidden = false;
      latitudeField.setAttribute("aria-invalid", String(!Number.isFinite(latitude) || latitude < -90 || latitude > 90));
      longitudeField.setAttribute("aria-invalid", String(!Number.isFinite(longitude) || longitude < -180 || longitude > 180));
      (latitudeField.getAttribute("aria-invalid") === "true" ? latitudeField : longitudeField).focus();
      return;
    }

    latitudeField.removeAttribute("aria-invalid");
    longitudeField.removeAttribute("aria-invalid");
    if (mapInstance) mapInstance.setView([latitude, longitude], Math.max(mapInstance.getZoom(), 12));
    setLocation(latitude, longitude);
  }

  function updateRadioSelection(input) {
    const group = input.name;
    document.querySelectorAll(`input[name="${group}"]`).forEach((radio) => {
      radio.closest(".option-card")?.classList.toggle("is-selected", radio.checked);
    });

    const nextButton = document.querySelector(`[data-next="${group}"]`);
    if (nextButton) nextButton.disabled = !document.querySelector(`input[name="${group}"]:checked`);
  }

  function resetChat() {
    if (replyTimer) window.clearTimeout(replyTimer);
    replyTimer = null;
    chatMessages.replaceChildren();
    appendMessage("assistant", "Olá! Sou a JoIA, inteligência artificial gratuita do Sistema CNA/Senar. Nesta demonstração, as respostas são simuladas. Quer saber mais sobre os próximos passos?");
    chatInput.value = "";
  }

  function restartApp() {
    if (analysisTimer) window.clearTimeout(analysisTimer);
    analysisTimer = null;
    if (replyTimer) window.clearTimeout(replyTimer);
    replyTimer = null;

    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = false;
      input.closest(".option-card")?.classList.remove("is-selected");
    });
    document.querySelectorAll("[data-next]").forEach((button) => { button.disabled = true; });
    document.getElementById("confirm-location").disabled = true;
    document.getElementById("view-loading").setAttribute("aria-busy", "false");
    document.getElementById("analyze-button").disabled = true;
    document.getElementById("analyze-button").removeAttribute("aria-busy");
    document.getElementById("latitude-input").value = "";
    document.getElementById("longitude-input").value = "";
    document.getElementById("coordinate-error").hidden = true;
    coordinateStatus.hidden = true;
    if (mapMarker && mapInstance) mapInstance.removeLayer(mapMarker);
    mapMarker = null;
    if (mapInstance) {
      mapInstance.setView([-14.235, -51.925], 4);
      addBrazilReferenceMarker();
    }
    resetChat();
    activateScreen("home");
  }

  function calculateResult() {
    const source = document.querySelector('input[name="q_fonte"]:checked')?.value;
    const volume = document.querySelector('input[name="q_vol"]:checked')?.value;
    if (!source || !volume) return null;

    if (source === "superficial" && volume === "baixo") {
      return {
        state: "success",
        icon: "ph-check-circle",
        title: "Possível dispensa de outorga",
        description: "O volume informado pode se enquadrar como uso insignificante. Confirme os critérios e a declaração necessários diretamente no portal do SEIA.",
      };
    }
    if (source === "subterranea") {
      return {
        state: "alert",
        icon: "ph-warning",
        title: "Verifique a autorização para captação subterrânea",
        description: "A captação subterrânea pode exigir autorização e outorga. Consulte o INEMA para confirmar as etapas aplicáveis ao seu caso.",
      };
    }
    return {
      state: "warning",
      icon: "ph-warning-circle",
      title: "Verifique a necessidade de outorga",
      description: "As respostas indicam que você deve confirmar a necessidade de outorga e os requisitos do pedido junto ao INEMA antes de iniciar a captação.",
    };
  }

  function analyzeAnswers() {
    if (currentScreen !== "q3" || analyzeButton.disabled) return;
    const result = calculateResult();
    if (!result) return;

    analyzeButton.disabled = true;
    analyzeButton.setAttribute("aria-busy", "true");
    const loadingScreen = document.getElementById("screen-loading");
    loadingScreen.setAttribute("aria-busy", "true");
    activateScreen("loading");

    analysisTimer = window.setTimeout(() => {
      analysisTimer = null;
      document.getElementById("result-card").className = `result-card result-${result.state}`;
      document.getElementById("result-icon").className = `ph-fill ${result.icon}`;
      document.getElementById("result-title").textContent = result.title;
      document.getElementById("result-description").textContent = result.description;
      loadingScreen.setAttribute("aria-busy", "false");
      analyzeButton.disabled = false;
      analyzeButton.removeAttribute("aria-busy");
      activateScreen("result");
    }, 900);
  }

  function appendMessage(kind, text) {
    const message = document.createElement("article");
    message.className = `chat-message ${kind === "user" ? "message-user" : "message-assistant"}`;
    message.textContent = text;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return message;
  }

  function createDemoReply(question) {
    const normalizedQuestion = question.toLocaleLowerCase("pt-BR");
    if (normalizedQuestion.includes("car") || normalizedQuestion.includes("cadastro")) {
      return "O cadastro e os documentos dependem do tipo de uso. Consulte a lista atualizada de exigências no SEIA e confirme com o INEMA.";
    }
    if (normalizedQuestion.includes("poço") || normalizedQuestion.includes("poco") || normalizedQuestion.includes("perfur")) {
      return "Poços podem exigir autorização específica. Confirme as etapas e os documentos diretamente com o INEMA antes de perfurar ou captar água.";
    }
    return "Esta demonstração não confirma exigências legais. Para orientação válida para o seu caso, consulte o portal SEIA e o INEMA.";
  }

  function sendChatMessage(event) {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    appendMessage("user", question);
    chatInput.value = "";
    chatInput.focus();

    const typingMessage = appendMessage("assistant", "Preparando resposta demonstrativa...");
    typingMessage.setAttribute("aria-label", "A JoIA está preparando uma resposta demonstrativa");
    replyTimer = window.setTimeout(() => {
      typingMessage.remove();
      appendMessage("assistant", createDemoReply(question));
      replyTimer = null;
    }, 650);
  }

  document.addEventListener("change", (event) => {
    if (event.target.matches('input[type="radio"]')) updateRadioSelection(event.target);
  });

  document.addEventListener("click", (event) => {
    const screenLink = event.target.closest("[data-screen]");
    if (screenLink) {
      event.preventDefault();
      activateScreen(screenLink.dataset.screen);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    switch (actionButton.dataset.action) {
      case "restart":
        restartApp();
        break;
      case "analyze":
        analyzeAnswers();
        break;
      case "open-chat":
        returnFromChat = currentScreen;
        activateScreen("chat");
        chatInput.focus({ preventScroll: true });
        break;
      case "close-chat":
        activateScreen(returnFromChat === "chat" ? "result" : returnFromChat);
        break;
      case "use-coordinates":
        useManualCoordinates();
        break;
      case "contact-demo":
        window.alert("Contato demonstrativo: esta versão não conecta com profissionais.");
        break;
      default:
        break;
    }
  });

  chatForm.addEventListener("submit", sendChatMessage);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && currentScreen === "chat") {
      activateScreen(returnFromChat === "chat" ? "result" : returnFromChat);
    }
  });

  window.addEventListener("resize", () => {
    if (mapInstance && currentScreen === "location") mapInstance.invalidateSize();
  });
})();
