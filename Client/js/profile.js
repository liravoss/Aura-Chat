// elements
const usernameEl = document.getElementById('username');
const languageEl = document.getElementById('language');
const avatarFileEl = document.getElementById('avatarFile');
const avatarPreview = document.getElementById('avatarPreview');
const saveBtn = document.getElementById('saveBtn');

let avatarDataUrl = '';

avatarFileEl.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    avatarDataUrl = reader.result;
    avatarPreview.src = avatarDataUrl;
    avatarPreview.style.display = 'block';
  };
  reader.readAsDataURL(f);
});

saveBtn.addEventListener('click', async () => {
  const username = usernameEl.value.trim();
  const language = languageEl.value;
  
  // FIX: Replaced alert() with showMessageModal()
  if (!username) return showMessageModal('Please enter a username.');
  
  // Create the user on server
  try {
    // apiCreateUser is defined in api.js
    const user = await apiCreateUser({ username, avatarUrl: avatarDataUrl, language });
    // Save user locally
    localStorage.setItem('aurachat_user', JSON.stringify(user));
    // Redirect to community
    window.location.href = 'community.html';
  } catch (e) {
    console.error(e);
    // FIX: Replaced alert() with showMessageModal()
    showMessageModal('Failed to create user profile. Check the console for details.');
  }
});

// If user exists, redirect to community
(function init() {
    const user = JSON.parse(localStorage.getItem('aurachat_user') || 'null');
    if (user) {
        window.location.href = 'community.html';
    }
})();