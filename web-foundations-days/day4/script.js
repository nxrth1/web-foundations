const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const DRAFT_KEY = "day4-note-draft";
const THEME_KEY = "day4-theme";

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

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
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
  localStorage.setItem(DRAFT_KEY, noteText.value);
});

clearBtn.addEventListener("click", clearNote);

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
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

updateThemeButton();
updateCounts();
