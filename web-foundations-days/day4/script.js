const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const saveStatus = document.querySelector("#save-status");
const lastSaved = document.querySelector("#last-saved");
const clearBtn = document.querySelector("#clear-btn");
const newNoteBtn = document.querySelector("#new-note-btn");
const themeToggle = document.querySelector("#theme-toggle");

const DRAFT_KEY = "day4-note-draft";
const LAST_SAVED_KEY = "day4-note-saved-at";
const THEME_KEY = "day4-theme";

let saveTimer = null;

function formatSavedTime(timestamp) {
  if (!timestamp) {
    return "Not saved yet";
  }

  const date = new Date(timestamp);
  return `Saved ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function setStatus(message, type = "neutral") {
  saveStatus.textContent = message;
  saveStatus.className = `save-status ${type}`;
}

function refreshLastSaved() {
  const timestamp = localStorage.getItem(LAST_SAVED_KEY);
  lastSaved.textContent = formatSavedTime(timestamp);
}

function updateCounts() {
  const text = noteText.value;
  const characterCount = text.length;
  const trimmedText = text.trim();
  const wordCountValue = trimmedText === "" ? 0 : trimmedText.split(/\s+/).length;

  charCount.textContent = `${characterCount} / 200 characters`;
  wordCount.textContent = `${wordCountValue} words`;

  charCount.classList.remove("warning", "over");

  if (characterCount > 200) {
    charCount.classList.add("over");
  } else if (characterCount > 180) {
    charCount.classList.add("warning");
  }
}

function saveDraft() {
  const timestamp = new Date().toISOString();
  localStorage.setItem(DRAFT_KEY, noteText.value);
  localStorage.setItem(LAST_SAVED_KEY, timestamp);
  refreshLastSaved();
  setStatus("Saved", "saved");
}

function newNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(LAST_SAVED_KEY);
  updateCounts();
  refreshLastSaved();
  setStatus("New note started", "neutral");
  noteText.focus();
}

function clearNote() {
  if (noteText.value.trim() === "") {
    setStatus("Nothing to clear", "neutral");
    noteText.focus();
    return;
  }

  const confirmed = window.confirm("Clear this draft?");
  if (!confirmed) {
    return;
  }

  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(LAST_SAVED_KEY);
  updateCounts();
  refreshLastSaved();
  setStatus("Draft cleared", "neutral");
  noteText.focus();
}

function updateThemeButton() {
  if (document.body.classList.contains("dark")) {
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }
}

noteText.addEventListener("input", function () {
  updateCounts();
  setStatus("Saving...", "saving");

  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 250);
});

clearBtn.addEventListener("click", clearNote);
newNoteBtn.addEventListener("click", newNote);

noteText.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  updateThemeButton();
});

const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
  setStatus("Draft restored", "restored");
} else {
  setStatus("Draft ready", "neutral");
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

refreshLastSaved();
updateThemeButton();
updateCounts();
