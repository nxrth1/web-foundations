const noteForm = document.querySelector('#note-form');
const noteInput = document.querySelector('#note-input');
const noteCategory = document.querySelector('#note-category');
const searchInput = document.querySelector('#search-input');
const notesList = document.querySelector('#notes-list');
const noteCount = document.querySelector('#note-count');
const errorMessage = document.querySelector('#error-message');

let notes = [];

function render() {
  notesList.replaceChildren();

  const searchTerm = searchInput.value.trim().toLowerCase();
  const filteredNotes = notes.filter((note) =>
    note.text.toLowerCase().includes(searchTerm)
  );

  if (filteredNotes.length === 0) {
    if (searchTerm && notes.length > 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No notes match your search.';
      notesList.appendChild(emptyMessage);
    }
  } else {
    filteredNotes.forEach((note) => {
      const listItem = document.createElement('li');
      listItem.className = `note-card category-${note.category.toLowerCase()}`;

      const noteText = document.createElement('p');
      noteText.className = 'note-text';
      noteText.textContent = note.text;

      const meta = document.createElement('div');
      meta.className = 'note-meta';

      const details = document.createElement('div');

      const categoryLabel = document.createElement('span');
      categoryLabel.className = `category-label category-${note.category.toLowerCase()}`;
      categoryLabel.textContent = note.category;

      const date = document.createElement('span');
      date.textContent = ` · ${note.createdAt}`;

      details.appendChild(categoryLabel);
      details.appendChild(date);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => deleteNote(note.id));

      meta.appendChild(details);
      meta.appendChild(deleteButton);

      listItem.appendChild(noteText);
      listItem.appendChild(meta);
      notesList.appendChild(listItem);
    });
  }

  if (notes.length === 0) {
    noteCount.textContent = 'You have no notes yet.';
  } else if (notes.length === 1) {
    noteCount.textContent = 'You have 1 note.';
  } else {
    noteCount.textContent = `You have ${notes.length} notes.`;
  }
}

function saveNotes() {
  localStorage.setItem('quicknotes-notes', JSON.stringify(notes));
}

function deleteNote(id) {
  notes = notes.filter((note) => note.id !== id);
  saveNotes();
  render();
}

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = noteInput.value.trim();

  if (!text) {
    errorMessage.textContent = 'Please type a note first.';
    return;
  }

  if (text.length > 200) {
    errorMessage.textContent = 'Notes must be 200 characters or fewer.';
    return;
  }

  const note = {
    id: Date.now().toString(),
    text,
    category: noteCategory.value,
    createdAt: new Date().toLocaleString()
  };

  notes.push(note);
  saveNotes();
  render();

  noteInput.value = '';
  errorMessage.textContent = '';
  noteInput.focus();
});

searchInput.addEventListener('input', render);

const savedNotes = localStorage.getItem('quicknotes-notes');

if (savedNotes) {
  try {
    const parsedNotes = JSON.parse(savedNotes);
    if (Array.isArray(parsedNotes)) {
      notes = parsedNotes;
    }
  } catch (error) {
    notes = [];
  }
}

render();
