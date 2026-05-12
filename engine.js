import {
  greetings,
  thanksReplies,
  byeReplies
} from "./greetings.js";

import { LEGAL_CASES, getCasesByCategory } from "./cases.js";
import { detectIntent } from "./intents.js";
import {
  buildLibrarySuggestions,
  buildSuggestions,
  formatCaseLibrary,
  formatCaseResponse,
  formatNearbyHelpResponse,
  responses
} from "./responses.js";
import { getRecentMessages, saveMessage } from "./memory.js";

const CASE_LIBRARY_TERMS = [
  "case",
  "cases",
  "sanction",
  "sanctions",
  "penalty",
  "penalties",
  "punishment",
  "remedy",
  "remedies",
  "legal options"
];

const FOCUS_PATTERNS = [
  ["sanctions", /(sanction|penalt|punish|fine|jail|imprison|remed)/i],
  ["evidence", /(evidence|proof|document|record|screenshot|what.*keep|what.*need)/i],
  ["draft", /(draft|write|format|complaint|notice|application|letter|email|message|whatsapp|sms)/i],
  ["help", /(nearby|nearest|contact|helpline|phone|map|location|where.*go|legal aid|police station|cyber cell|help centre|help center)/i]
];

function randomItem(arr) {

  return arr[
    Math.floor(Math.random() * arr.length)
  ];
}

export function generateAIResponse(message) {

  const cleanedMessage = String(message || "").trim();

  if (!cleanedMessage) {
    return {
      text: responses.general,
      suggestions: buildSuggestions()
    };
  }

  saveMessage("user", cleanedMessage);

  const classification = detectIntent(cleanedMessage);

  logClassification(classification);

  const response = buildResponse(cleanedMessage, classification);

  saveMessage("assistant", response.text);

  return response;
}

function buildResponse(message, classification) {

  const intent = classification.intent || "general";

  if (classification.responseType === "greeting") {
    return {
      text: randomItem(greetings),
      suggestions: [
        "I lost money in an online scam",
        "My landlord is not returning my deposit",
        "Draft a complaint for my issue",
        "Show nearby legal help"
      ]
    };
  }

  if (classification.responseType === "thanks") {
    return {
      text: randomItem(thanksReplies),
      suggestions: buildSuggestions()
    };
  }

  if (classification.responseType === "bye") {
    return {
      text: randomItem(byeReplies),
      suggestions: []
    };
  }

  if (classification.responseType === "fallback") {
    if (isBroadLibraryRequest(message)) {
      return {
        text: formatCaseLibrary(LEGAL_CASES),
        suggestions: buildLibrarySuggestions()
      };
    }

    if (detectFocus(message) === "help") {
      return {
        text: formatNearbyHelpResponse(),
        suggestions: [
          "Show legal aid map",
          "Show cyber crime contact",
          "Draft an email for my issue"
        ]
      };
    }

    return {
      text: responses.lowConfidence || responses.general,
      suggestions: [
        "I lost money in an online scam",
        "My employer has not paid my salary",
        "My landlord is forcing me to leave",
        "A seller is refusing my refund"
      ]
    };
  }

  if (isBroadLibraryRequest(message)) {
    const categoryCases = intent !== "general"
      ? getCasesByCategory(intent)
      : LEGAL_CASES;

    return {
      text: formatCaseLibrary(categoryCases),
      suggestions: intent !== "general" && categoryCases.length
        ? buildSuggestions(categoryCases[0])
        : buildLibrarySuggestions()
    };
  }

  const focus = detectFocus(message);
  const directMatches = findBestCases(message, intent);
  const matches = directMatches.length > 0
    ? directMatches
    : findBestCases(buildContext(message), intent);

  if (isLibraryRequest(message) && matches.length === 0) {
    return {
      text: formatCaseLibrary(),
      suggestions: buildLibrarySuggestions()
    };
  }

  if (focus === "help" && matches.length === 0) {
    return {
      text: formatNearbyHelpResponse(),
      suggestions: [
        "Show legal aid map",
        "Show cyber crime contact",
        "Draft an email for my issue"
      ]
    };
  }

  if (isLibraryRequest(message) && intent !== "general" && focus === "full") {
    const categoryCases = getCasesByCategory(intent);

    return {
      text: formatCaseLibrary(categoryCases),
      suggestions: categoryCases.length
        ? buildSuggestions(categoryCases[0])
        : buildLibrarySuggestions()
    };
  }

  if (matches.length > 0) {
    const [topCase, ...relatedCases] = matches;

    return {
      text: formatCaseResponse(topCase, {
        focus,
        relatedCases: relatedCases.slice(0, 2),
        message
      }),
      suggestions: buildSuggestions(topCase)
    };
  }

  if (isUrgentSafetyMessage(message)) {
    return {
      text: responses.emergency,
      suggestions: [
        "How do I write a police complaint?",
        "What evidence should I preserve?",
        "Show police complaint remedies"
      ]
    };
  }

  return {
    text: responses.general,
    suggestions: buildSuggestions()
  };
}

function logClassification(classification) {

  console.info("[LawMitra AI classification]", {
    normalizedInput: classification.normalizedText,
    detectedIntent: classification.intent,
    confidenceScore: classification.confidence,
    selectedResponseType: classification.responseType,
    matchedKeywords: classification.matchedKeywords,
    ambiguous: Boolean(classification.ambiguous)
  });
}

function buildContext(message) {

  const recentUserMessages = getRecentMessages({
    role: "user",
    limit: 4
  })
    .map((entry) => entry.content)
    .join(" ");

  return `${recentUserMessages} ${message}`.trim();
}

function findBestCases(message, intent) {

  const text = normalize(message);

  return LEGAL_CASES
    .map((legalCase) => ({
      legalCase,
      score: scoreCase(legalCase, text, intent)
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((result) => result.legalCase);
}

function scoreCase(legalCase, text, intent) {

  let score = legalCase.category === intent ? 4 : 0;

  const titleTokens = legalCase.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);

  for (const token of titleTokens) {
    if (text.includes(token)) score += 1;
  }

  for (const keyword of legalCase.keywords) {
    if (text.includes(normalize(keyword))) score += 3;
  }

  if (text.includes(legalCase.id.replace(/-/g, " "))) {
    score += 8;
  }

  return score;
}

function detectFocus(message) {

  for (const [focus, pattern] of FOCUS_PATTERNS) {
    if (pattern.test(message)) return focus;
  }

  return "full";
}

function isLibraryRequest(message) {

  const text = normalize(message);

  return CASE_LIBRARY_TERMS.some((term) => text.includes(term));
}

function isBroadLibraryRequest(message) {

  const text = normalize(message);

  return (
    text.includes("case library") ||
    text.includes("legal cases with sanctions") ||
    /(show|list|all|multiple)\b.*\b(case|cases|sanction|sanctions|penalty|penalties|remedy|remedies)\b/.test(text)
  );
}

function isUrgentSafetyMessage(message) {

  return /(danger|unsafe|attack|assault|threat|violence|blackmail|stalking|suicide|self harm)/i
    .test(message);
}

function normalize(value) {

  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
