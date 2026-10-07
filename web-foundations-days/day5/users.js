const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadUsersButton = document.querySelector("#load-users");
const statusText = document.querySelector("#status");
const list = document.querySelector("#users-list");
const filterInput = document.querySelector("#filter-input");

let users = [];
let hasLoadedUsers = false;

function createUserElement(user) {
  const li = document.createElement("li");
  const name = document.createElement("h2");
  name.textContent = user.name;
  li.appendChild(name);

  const email = document.createElement("p");
  email.textContent = `Email: ${user.email}`;
  li.appendChild(email);

  const city = document.createElement("p");
  city.textContent = `City: ${user.address.city}`;
  li.appendChild(city);

  const company = document.createElement("p");
  company.textContent = `Company: ${user.company.name}`;
  li.appendChild(company);

  return li;
}

function renderUsers(userList) {
  list.replaceChildren();

  if (userList.length === 0) {
    statusText.textContent = "No users match your filter.";
    return;
  }

  userList.forEach(user => {
    list.appendChild(createUserElement(user));
  });
}

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadUsersButton.disabled = true;
  list.replaceChildren();
  users = [];
  hasLoadedUsers = false;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    users = await response.json();
    hasLoadedUsers = true;
    renderUsers(users);
    if (users.length > 0) {
      statusText.textContent = `Loaded ${users.length} users.`;
    }
  } catch (error) {
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadUsersButton.disabled = false;
  }
}

loadUsersButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (!hasLoadedUsers) {
    return;
  }

  const filterText = filterInput.value.toLowerCase();
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(filterText)
  );

  renderUsers(filteredUsers);
  if (filteredUsers.length > 0) {
    statusText.textContent = `Showing ${filteredUsers.length} of ${users.length} users.`;
  }
});
