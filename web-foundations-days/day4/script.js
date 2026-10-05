// Connect the HTML elements to JavaScript using their id attributes.
// For example, #note-text selects <textarea id="note-text"> in index.html.
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

// These names identify this page's saved values in the browser's local storage.
const DRAFT_KEY = "day4-note-draft";
const THEME_KEY = "day4-theme";

// Read the textarea and display its current character and word totals.
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

// Empty the textarea, remove its saved draft, refresh the count, and return focus.
function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  noteText.focus();
}

// Keep the theme button's label in sync with the page's current theme.
function updateThemeButton() {
  if (document.body.classList.contains("dark")) {
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }
}

// HOOKUP: typing in #note-text updates the counts and saves the draft.
noteText.addEventListener("input", function () {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, noteText.value);
});

// HOOKUP: clicking #clear-btn runs the clearNote function above.
clearBtn.addEventListener("click", clearNote);

// HOOKUP: pressing Escape while #note-text is focused also clears the note.
noteText.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearNote();
  }
});

// HOOKUP: clicking #theme-toggle switches the body theme and saves the choice.
themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  updateThemeButton();
});

// On page load, restore a previously saved draft if one exists.
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

// On page load, restore dark mode if it was the previously saved choice.
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

// Set the initial button label and counts after restoring saved values.
updateThemeButton();
updateCounts();
