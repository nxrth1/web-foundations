 
checks response.ok,and displays each 
user's name, email, city and company name using 
createElement and textContent; loading, success and error messages 
in #status; 
the button disabled while loading; and a filter box that shows 
only users whose name includes 
the typed text (not case-sensitive), without making a new request.

In users.js, write loadUsers() using fetch, async / await and try / catch / finally.

Store the loaded users in an array and write a renderUsers(list) function that draws any array of users.

Listen for the input event on the filter box, filter the stored array and call renderUsers with the result. 
Show "No users match your filter." when nothing matches.

const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadusersBtn = document.querySelector("#load-users");
const statusText = document.querySelector("#status");
const list = document.querySelector("#users-list");
const filterInput = document.querySelector("#filter-input");

function createUserElement(user) {
  const li = document.createElement("li");
  li.textContent = `${user.name} (${user.email}) - ${user.address.city}, ${user.company.name}`;
  return li;
}

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadusersBtn.disabled = true;
  list.innerHTML = "";

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const users = await response.json();
    renderUsers(users);
    statusText.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadusersBtn.disabled = false; // runs whether it worked or failed
  }
}

function renderUsers(users) {
  list.innerHTML = "";
  if (users.length === 0) {
    statusText.textContent = "No users match your filter.";
    return;
  }
  users.forEach(user => {
    const userElement = createUserElement(user);
    list.appendChild(userElement);
  });
}

loadusersBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const filterText = filterInput.value.toLowerCase();
  const filteredUsers = users.filter(user => user.name.toLowerCase().includes(filterText));
  renderUsers(filteredUsers);
}); 
