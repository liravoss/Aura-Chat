const roomsEl = document.getElementById('rooms');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomNameEl = document.getElementById('roomName');

async function loadRooms() {
  const rooms = await apiGetRooms();
  roomsEl.innerHTML = '';
  if (!rooms || rooms.length === 0) {
    roomsEl.innerHTML = '<div class="small">No rooms yet. Create one!</div>';
    return;
  }
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-item';
    // escapeHtml is defined in utils.js
    div.innerHTML = `<div><strong>${escapeHtml(r.name)}</strong></div>
      <div>
        <button class="button small-btn" data-id="${r._id}">Join</button>
      </div>`;
    roomsEl.appendChild(div);
  });

  // attach join handlers
  document.querySelectorAll('.small-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      goToChat(id);
    });
  });
}

createRoomBtn.addEventListener('click', async () => {
  const name = roomNameEl.value.trim();
  // FIX: Replaced alert() with showMessageModal()
  if (!name) return showMessageModal('Please enter a name for the room.');
  try {
    const room = await apiCreateRoom(name);
    roomNameEl.value = '';
    loadRooms();
  } catch (e) {
    console.error(e);
    // FIX: Replaced alert() with showMessageModal()
    showMessageModal('Failed to create room. Please try again.');
  }
});

function goToChat(roomId) {
  // getUserOrRedirect is defined in utils.js
  const user = getUserOrRedirect();
  if (!user) return;
  window.location.href = `chat.html?roomId=${roomId}`;
}

// Initial load
// loadRooms(); // Assuming this is called later, or immediately. Keeping original structure.
(function init() {
    // Check if user is logged in before loading rooms data
    const user = getUserOrRedirect();
    if (user) {
        loadRooms();
    }
})();