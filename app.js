import { generateAIResponse } from "./ai/engine.js";
import { LEGAL_CASES } from "./ai/cases.js";
import {
  HELP_CONTACTS,
  MAP_HELP_OPTIONS
} from "./ai/help.js";
import { clearMemory } from "./ai/memory.js";

const input = document.getElementById("chat-input");
const messages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-btn");
const newChatButton = document.getElementById("new-chat-btn");
const themeButton = document.getElementById("theme-btn");
const landingThemeButton = document.getElementById("landing-theme-btn");
const caseLibraryList = document.getElementById("case-library-list");
const chatHistoryList = document.getElementById("chat-history-list");
const caseCatalogGrid = document.getElementById("case-catalog-grid");
const contactList = document.getElementById("help-contact-list");
const mapActions = document.getElementById("map-actions");
const helpMap = document.getElementById("help-map");
const mapOpenLink = document.getElementById("map-open-link");
const mapStatus = document.getElementById("map-status");
const useLocationButton = document.getElementById("use-location-btn");
const currentLocationButton = document.getElementById("current-location-btn");
const footerLocationButton = document.getElementById("footer-location-btn");
const topbarLocationButton = document.getElementById("topbar-location-btn");
const openChatButtons = document.querySelectorAll("[data-open-chat]");
const landingLinks = document.querySelectorAll("[data-landing-link]");

let isGenerating = false;
let activeMapOption = MAP_HELP_OPTIONS[0];
let userCoordinates = null;
let legalHelpMap = null;
let mapMarkers = null;
let userMarker = null;
let chatHistory = [];
let activeConversationId = null;
let viewTransitionTimer = null;

sendButton.addEventListener("click", () => sendMessage());
newChatButton.addEventListener("click", startNewChat);
themeButton.addEventListener("click", toggleTheme);
landingThemeButton?.addEventListener("click", toggleTheme);
input.addEventListener("keydown", handleKey);
input.addEventListener("input", resizeInput);
useLocationButton?.addEventListener("click", requestLocation);
currentLocationButton?.addEventListener("click", requestLocation);
footerLocationButton?.addEventListener("click", requestLocation);
topbarLocationButton?.addEventListener("click", requestLocation);
openChatButtons.forEach((button) => {
  button.addEventListener("click", () => openChatView());
});
landingLinks.forEach((link) => {
  link.addEventListener("click", () => showLandingView());
});

renderStructuredContent();
initLiveMap();
updateMap(activeMapOption);
if (!document.body.classList.contains("is-landing")) {
  showLandingView();
}

document.addEventListener("click", (event) => {
  const promptButton = event.target.closest("[data-prompt]");

  if (!promptButton || isGenerating) return;

  const prompt = promptButton.getAttribute("data-prompt");

  if (!prompt) return;

  openChatView();
  input.value = prompt;
  resizeInput();

  if (promptButton.getAttribute("data-submit") !== "false") {
    sendMessage(prompt);
  } else {
    input.focus();
  }
});

function sendMessage(forcedText) {

  const text = String(forcedText || input.value).trim();

  if (!text || isGenerating) return;

  hideWelcome();
  saveConversationStart(text);
  appendUserMessage(text);
  clearInput();
  showTyping();
  setGenerating(true);

  let aiResult;

  try {
    aiResult = generateAIResponse(text);
  } catch (error) {
    console.error("NyayMitra response failed", error);
    aiResult = {
      text: "I could not process that safely. Please try again with a shorter description of what happened.",
      suggestions: [
        "Show me legal cases with sanctions",
        "What evidence should I preserve?",
        "Draft a complaint outline"
      ]
    };
  }

  const delay = Math.min(1100, 450 + aiResult.text.length * 2);

  window.setTimeout(() => {
    hideTyping();
    appendAIMessage(aiResult);
    setGenerating(false);
    input.focus();
  }, delay);
}

function handleKey(event) {

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function startNewChat() {

  openChatView();
  clearMemory();
  activeConversationId = null;
  messages.querySelectorAll(".msg-user-wrap, .msg-ai-wrap").forEach((node) => {
    node.remove();
  });

  const welcome = document.getElementById("chat-welcome");

  if (welcome) {
    welcome.style.display = "";
  }

  clearInput();
  input.focus();
}

function openChatView() {

  if (document.body.classList.contains("is-chat")) {
    input.focus();
    return;
  }

  window.clearTimeout(viewTransitionTimer);
  document.body.classList.add("is-transitioning");

  viewTransitionTimer = window.setTimeout(() => {
    document.body.classList.remove("is-landing");
    document.body.classList.add("is-chat");
  }, 260);

  window.setTimeout(() => {
    document.body.classList.remove("is-transitioning");
    legalHelpMap?.invalidateSize();
    input.focus();
  }, 760);
}

function showLandingView() {

  window.clearTimeout(viewTransitionTimer);
  document.body.classList.add("is-transitioning");

  viewTransitionTimer = window.setTimeout(() => {
    document.body.classList.add("is-landing");
    document.body.classList.remove("is-chat");
  }, 180);

  window.setTimeout(() => {
    document.body.classList.remove("is-transitioning");
  }, 620);
}

function appendUserMessage(text) {

  const wrapper = document.createElement("div");
  const bubble = document.createElement("div");

  wrapper.className = "msg-user-wrap";
  bubble.className = "msg-user";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  scrollBottom();
}

function appendAIMessage(result) {

  const wrapper = document.createElement("div");
  const avatar = document.createElement("div");
  const response = document.createElement("div");

  wrapper.className = "msg-ai-wrap";
  avatar.className = "ai-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "⚖️";

  response.className = "ai-response";
  response.innerHTML = formatResponse(result.text);

  if (Array.isArray(result.suggestions) && result.suggestions.length > 0) {
    response.appendChild(renderSuggestions(result.suggestions));
  }

  wrapper.append(avatar, response);
  messages.appendChild(wrapper);
  scrollBottom();
}

function renderSuggestions(suggestions) {

  const group = document.createElement("div");

  group.className = "ai-suggestions";
  group.setAttribute("aria-label", "Suggested follow up questions");

  suggestions.slice(0, 4).forEach((suggestion) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion-btn";
    button.textContent = suggestion;
    button.setAttribute("data-prompt", suggestion);

    group.appendChild(button);
  });

  return group;
}

function showTyping() {

  const wrapper = document.createElement("div");
  const avatar = document.createElement("div");
  const card = document.createElement("div");

  wrapper.className = "msg-ai-wrap";
  wrapper.id = "typing";

  avatar.className = "ai-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "⚖️";

  card.className = "typing-card";
  card.innerHTML = `
    <div class="typing-dots" aria-hidden="true">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
    <span>NyayMitra is reviewing the facts...</span>
  `;

  wrapper.append(avatar, card);
  messages.appendChild(wrapper);
  scrollBottom();
}

function hideTyping() {

  document.getElementById("typing")?.remove();
}

function hideWelcome() {

  const welcome = document.getElementById("chat-welcome");

  if (welcome) {
    welcome.style.display = "none";
  }
}

function saveConversationStart(text) {

  if (activeConversationId) return;

  activeConversationId = window.crypto?.randomUUID?.() || String(Date.now());

  chatHistory = [
    {
      id: activeConversationId,
      title: text.length > 54 ? `${text.slice(0, 54)}...` : text,
      prompt: text
    },
    ...chatHistory
  ].slice(0, 12);

  renderChatHistory();
}

function renderChatHistory() {

  if (!chatHistoryList) return;

  chatHistoryList.textContent = "";

  if (chatHistory.length === 0) {
    const empty = document.createElement("div");

    empty.className = "history-empty";
    empty.textContent = "No conversations yet";
    chatHistoryList.appendChild(empty);
    return;
  }

  chatHistory.forEach((item) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "history-item chat-history-item";
    button.textContent = item.title;
    button.addEventListener("click", () => {
      startNewChat();
      activeConversationId = item.id;
      input.value = item.prompt;
      resizeInput();
      sendMessage(item.prompt);
    });

    chatHistoryList.appendChild(button);
  });
}

function clearInput() {

  input.value = "";
  resizeInput();
}

function resizeInput() {

  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

function setGenerating(value) {

  isGenerating = value;
  sendButton.disabled = value;
  input.disabled = value;
}

function scrollBottom() {

  messages.scrollTop = messages.scrollHeight;
}

function renderStructuredContent() {

  renderChatHistory();
  renderCaseLibrary();
  renderContactCards();
  renderMapActions();
}

function renderCaseLibrary() {

  if (caseLibraryList) {
    const groupedCases = groupCasesByCategory(LEGAL_CASES);

    caseLibraryList.textContent = "";

    groupedCases.forEach(([category, cases]) => {
      const label = document.createElement("div");

      label.className = "history-title";
      label.textContent = getCategoryLabel(category);
      caseLibraryList.appendChild(label);

      cases.forEach((legalCase) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "history-item";
        button.textContent = legalCase.title;
        button.setAttribute("data-prompt", `Help me with ${legalCase.title}`);

        caseLibraryList.appendChild(button);
      });
    });
  }

  if (!caseCatalogGrid) return;

  caseCatalogGrid.textContent = "";

  LEGAL_CASES.forEach((legalCase) => {
    const button = document.createElement("button");
    const category = document.createElement("span");
    const title = document.createElement("strong");
    const summary = document.createElement("span");

    button.type = "button";
    button.className = "catalog-card";
    button.setAttribute("data-prompt", `Help me with ${legalCase.title}`);

    category.className = "category-label";
    category.textContent = getCategoryLabel(legalCase.category);
    title.textContent = legalCase.title;
    summary.textContent = legalCase.summary;

    button.append(category, title, summary);
    caseCatalogGrid.appendChild(button);
  });
}

function renderContactCards() {

  if (!contactList) return;

  contactList.textContent = "";

  HELP_CONTACTS.forEach((contact) => {
    const card = document.createElement("article");
    const title = document.createElement("strong");
    const description = document.createElement("p");
    const actions = document.createElement("div");
    const phone = document.createElement("a");
    const site = document.createElement("a");

    card.className = "contact-card";
    title.textContent = `${contact.shortName} - ${contact.phone}`;
    description.textContent = contact.availability;
    actions.className = "contact-actions";

    phone.className = "contact-action";
    phone.href = `tel:${contact.phone.replace(/\s/g, "")}`;
    phone.textContent = "Call";

    site.className = "contact-action";
    site.href = contact.website;
    site.target = "_blank";
    site.rel = "noopener noreferrer";
    site.textContent = "Website";

    actions.append(phone, site);

    if (contact.whatsapp) {
      const whatsapp = document.createElement("a");

      whatsapp.className = "contact-action";
      whatsapp.href = `https://wa.me/91${contact.whatsapp}`;
      whatsapp.target = "_blank";
      whatsapp.rel = "noopener noreferrer";
      whatsapp.textContent = "WhatsApp";
      actions.appendChild(whatsapp);
    }

    card.append(title, description, actions);
    contactList.appendChild(card);
  });
}

function renderMapActions() {

  if (!mapActions) return;

  mapActions.textContent = "";

  MAP_HELP_OPTIONS.forEach((option) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "map-action";
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.id === activeMapOption?.id));

    if (option.id === activeMapOption?.id) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      activeMapOption = option;
      updateMap(option);
      renderMapActions();
    });

    mapActions.appendChild(button);
  });
}

function requestLocation() {

  if (!navigator.geolocation) {
    setLocationButtonState("Location unavailable", true);
    return;
  }

  setLocationButtonState("Locating...", true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      setLocationButtonState("Location active", false);
      updateMap(activeMapOption);
    },
    () => {
      setLocationButtonState("Use my location", false);
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 300000
    }
  );
}

function updateMap(option) {

  if (!helpMap || !option) return;

  if (mapOpenLink) {
    mapOpenLink.href = createExternalMapSearchUrl(option.query);
  }

  renderMapMarkers(option);
  setMapStatus(userCoordinates
    ? `${option.label} search centered near ${userCoordinates.latitude.toFixed(4)}, ${userCoordinates.longitude.toFixed(4)}.`
    : `${option.label} search. Allow location for nearby results.`);
}

function initLiveMap() {

  if (!helpMap || !window.L) {
    setMapStatus("Live map could not load. Use the map search link above.");
    return;
  }

  legalHelpMap = window.L.map(helpMap, {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView([22.9734, 78.6569], 5);

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19
  }).addTo(legalHelpMap);

  mapMarkers = window.L.layerGroup().addTo(legalHelpMap);
  window.setTimeout(() => legalHelpMap.invalidateSize(), 200);

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => legalHelpMap.invalidateSize()).observe(helpMap);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        window.setTimeout(() => legalHelpMap.invalidateSize(), 120);
      }
    }).observe(helpMap);
  }
}

function renderMapMarkers(option) {

  if (!legalHelpMap || !window.L || !mapMarkers) return;

  mapMarkers.clearLayers();

  if (userCoordinates) {
    const center = [
      userCoordinates.latitude,
      userCoordinates.longitude
    ];

    legalHelpMap.setView(center, 13);
    userMarker = window.L.marker(center)
      .bindPopup("Your location")
      .addTo(mapMarkers);

    window.L.circle(center, {
      color: "#3b5bff",
      fillColor: "#3b5bff",
      fillOpacity: 0.1,
      radius: 3000
    }).addTo(mapMarkers);

    window.L.marker(center, {
      opacity: 0.82
    })
      .bindPopup(`${option.label}: open the selected map search for live nearby listings.`)
      .addTo(mapMarkers);
  } else {
    const nationalPoints = [
      {
        label: "Delhi legal aid and courts",
        coordinates: [28.6139, 77.2090]
      },
      {
        label: "Mumbai legal aid and courts",
        coordinates: [19.0760, 72.8777]
      },
      {
        label: "Bengaluru legal aid and courts",
        coordinates: [12.9716, 77.5946]
      },
      {
        label: "Kolkata legal aid and courts",
        coordinates: [22.5726, 88.3639]
      }
    ];

    legalHelpMap.setView([22.9734, 78.6569], 5);

    nationalPoints.forEach((point) => {
      window.L.marker(point.coordinates)
        .bindPopup(`${point.label}<br>${option.label} map search is available above.`)
        .addTo(mapMarkers);
    });
  }

  window.setTimeout(() => legalHelpMap.invalidateSize(), 100);
}

function createExternalMapSearchUrl(query) {

  const locationQuery = userCoordinates
    ? `${query} near ${userCoordinates.latitude},${userCoordinates.longitude}`
    : query;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
}

function setLocationButtonState(text, disabled) {

  [useLocationButton, currentLocationButton, topbarLocationButton].forEach((button) => {
    if (!button) return;

    button.textContent = text;
    button.disabled = disabled;
  });

  if (footerLocationButton) {
    footerLocationButton.title = text;
    footerLocationButton.disabled = disabled;
  }
}

function setMapStatus(text) {

  if (mapStatus) {
    mapStatus.textContent = text;
  }
}

function groupCasesByCategory(cases) {

  const groups = new Map();

  cases.forEach((legalCase) => {
    const group = groups.get(legalCase.category) || [];

    group.push(legalCase);
    groups.set(legalCase.category, group);
  });

  return [...groups.entries()];
}

function getCategoryLabel(category) {

  const labels = {
    accident: "Accident",
    banking: "Banking",
    cheque: "Cheque",
    civic: "Civic",
    consumer: "Consumer",
    contract: "Contract",
    criminal: "Criminal",
    cyber_fraud: "Cyber",
    defamation: "Defamation",
    environment: "Environment",
    housing: "Housing",
    insurance: "Insurance",
    intellectual_property: "IP",
    landlord: "Landlord",
    medical: "Medical",
    passport: "Passport",
    police: "Police",
    privacy: "Privacy",
    property: "Property",
    public_records: "RTI",
    public_service: "Public Service",
    relationship: "Family",
    rights: "Rights",
    senior: "Senior",
    student: "Student",
    tax: "Tax",
    traffic: "Traffic",
    workplace: "Workplace"
  };

  return labels[category] || category.replace(/_/g, " ");
}

function toggleTheme() {

  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", next);
  themeButton.setAttribute("aria-pressed", String(next === "dark"));
}

function formatResponse(text) {

  const lines = String(text || "").trim().split("\n");
  const introLines = [];
  const sections = [];
  let currentSection = null;

  for (const rawLine of lines) {
    const heading = rawLine.trim().match(/^\*\*(.+)\*\*$/);

    if (heading) {
      currentSection = {
        heading: heading[1],
        lines: []
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(rawLine);
    } else {
      introLines.push(rawLine);
    }
  }

  let html = "";
  const introHtml = formatContentLines(introLines);

  if (introHtml) {
    html += `<div class="response-lead">${introHtml}</div>`;
  }

  let templatesStarted = false;

  sections.forEach((section) => {
    const headingText = escapeHtml(section.heading);

    if (isDraftSection(section.heading)) {
      if (!templatesStarted) {
        html += `<div class="template-title">Ready-to-send templates</div>`;
        templatesStarted = true;
      }

      html += `
        <details class="draft-details">
          <summary>${getSectionIcon(section.heading)} ${headingText}</summary>
          <pre>${escapeHtml(section.lines.join("\n").trim())}</pre>
        </details>
      `;
      return;
    }

    html += `
      <section class="response-section ${getSectionClass(section.heading)}">
        <div class="response-heading">
          <span class="response-icon" aria-hidden="true">${getSectionIcon(section.heading)}</span>
          <span>${headingText}</span>
        </div>
        ${formatContentLines(section.lines)}
      </section>
    `;
  });

  return html || `<div class="response-lead">${escapeHtml(String(text || ""))}</div>`;
}

function formatContentLines(rawLines) {

  let html = "";
  let listType = null;

  for (const rawLine of rawLines) {
    const line = escapeHtml(rawLine.trim());

    if (!line) {
      html += closeOpenList(listType);
      listType = null;
      continue;
    }

    if (line.startsWith("- ")) {
      if (listType !== "ul") {
        html += closeOpenList(listType);
        html += "<ul>";
        listType = "ul";
      }

      html += `<li>${formatInline(line.slice(2))}</li>`;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") {
        html += closeOpenList(listType);
        html += "<ol>";
        listType = "ol";
      }

      html += `<li>${formatInline(line.replace(/^\d+\.\s/, ""))}</li>`;
      continue;
    }

    html += closeOpenList(listType);
    listType = null;
    html += `<p>${formatInline(line)}</p>`;
  }

  html += closeOpenList(listType);

  return html;
}

function isDraftSection(heading) {

  return /(email|message|sms|whatsapp)/i.test(heading);
}

function getSectionIcon(heading) {

  const text = String(heading || "").toLowerCase();

  if (text.includes("summary") || text.includes("likely")) return "▣";
  if (text.includes("right") || text.includes("sanction") || text.includes("remed")) return "⚖";
  if (text.includes("preserve") || text.includes("evidence")) return "▤";
  if (text.includes("next") || text.includes("outline")) return "↳";
  if (text.includes("contact") || text.includes("help")) return "☎";
  if (text.includes("map")) return "⌖";
  if (text.includes("question")) return "?";
  if (text.includes("email")) return "✉";
  if (text.includes("message") || text.includes("sms") || text.includes("whatsapp")) return "●";
  return "▪";
}

function getSectionClass(heading) {

  const text = String(heading || "").toLowerCase();

  if (text.includes("contact") || text.includes("help")) return "is-contacts";
  if (text.includes("next") || text.includes("right now")) return "is-steps";
  if (text.includes("right") || text.includes("sanction") || text.includes("remed")) return "is-rights";
  return "";
}

function closeOpenList(type) {

  if (type === "ul") return "</ul>";
  if (type === "ol") return "</ol>";
  return "";
}

function formatInline(text) {

  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function escapeHtml(value) {

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
