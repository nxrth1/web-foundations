# QuickNotes

QuickNotes is a simple browser-based note-taking app that lets you quickly create, organise, search and delete notes by category. Notes are stored in the browser using localStorage, so they remain available after refreshing the page.

## Features

- Add notes with Personal, Work or Study categories.
- Validate notes so they cannot be empty or longer than 200 characters.
- Display notes as readable cards with category and creation date.
- Delete individual notes.
- Search notes without case sensitivity.
- Show the correct note count for zero, one or many notes.
- Save and restore notes using localStorage.
- Responsive layout for smaller screens.

## How to run locally

1. Clone or download this repository.
2. Open the `quicknotes-app` folder.
3. Open `index.html` in a modern web browser.
4. Start adding notes.

No build tools, package manager or server are required.

## What I learned

- I learned how to structure a small web application with semantic HTML elements and accessible label-to-input connections.
- I learned how to use CSS Flexbox, reusable category classes and media queries to create a responsive interface.
- I learned how JavaScript can manage an array of objects, update the DOM with `createElement` and `textContent`, and respond to form and search events.
- I learned how `localStorage`, `JSON.stringify()` and `JSON.parse()` can be used to persist application data between page refreshes.
