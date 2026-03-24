const SERVER_URL = '';

async function apiCreateUser({ username, avatarUrl, language }) {
  const resp = await fetch(`${SERVER_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, avatarUrl, language })
  });
  return resp.json();
}

async function apiGetRooms() {
  const resp = await fetch(`${SERVER_URL}/api/rooms`);
  return resp.json();
}

async function apiCreateRoom(name) {
  const resp = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return resp.json();
}
