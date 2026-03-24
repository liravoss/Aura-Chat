// /Client/js/chat.js
// Final chat client with Tenor GIF picker integrated.
// Assumes existence of: getUserOrRedirect(), escapeHtml(), showMessageModal(), connectSocket()

const TENOR_KEY = "AIzaSyCHZxBbpl8-p-Dt2zHCeNAB2iMB8WXXeYY"; 
function initChat() {
  // Read roomId
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("roomId");

  if (!roomId) {
    showMessageModal("Missing room ID. Redirecting...");
    setTimeout(() => (window.location.href = "community.html"), 1300);
    return;
  }

  const user = getUserOrRedirect();
  if (!user) {
    showMessageModal("No user profile found. Redirecting...");
    setTimeout(() => (window.location.href = "profile.html"), 1300);
    return;
  }

  // UI refs
  const messagesEl = document.getElementById("messages");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const roomTitle = document.getElementById("roomTitle");
  const myName = document.getElementById("myName");
  const myLang = document.getElementById("myLang");
  const myAvatar = document.getElementById("myAvatar");
  const usersList = document.getElementById("usersListInner");

  // GIF modal refs
  const gifBtn = document.getElementById("gifBtn");
  const gifModal = document.getElementById("gifModal");
  const gifSearch = document.getElementById("gifSearch");
  const gifResults = document.getElementById("gifResults");

  // Basic UI setup
  roomTitle.textContent = "Room";
  myName.textContent = user.username;
  myLang.textContent = (user.language || "en").toUpperCase();
  if (user.avatarUrl) {
    myAvatar.src = user.avatarUrl;
    myAvatar.style.display = "block";
  }

  // Connect to backend socket (connectSocket is defined in /js/socket.js)
  const chatSocket = connectSocket(roomId, user._id || user.id);

  chatSocket.on("connect", () => {
    console.log("Chat socket connected:", chatSocket.id);
  });

  chatSocket.on("disconnect", () => {
    console.warn("Chat socket disconnected.");
  });

  // Message received from server
  chatSocket.on("message", (msg) => {
    appendMessage(msg, (msg.senderId === (user._id || user.id)));
  });

  // When other user joins
  chatSocket.on("user-joined", (u) => {
    addUserToList(u);
    // small transient message in chat
    appendSystemMessage(`${u.username} joined the room.`);
  });

  // When server informs of other user leaving (if implemented server-side)
  // Note: chatSocket currently doesn't emit user-left; keep for future use:
  chatSocket.on("user-left", (u) => {
    removeUserFromList(u);
    appendSystemMessage(`${u.username} left the room.`);
  });

  // Send message handler
  function sendMessage(text) {
    const txt = (typeof text === "string") ? text.trim() : messageInput.value.trim();
    if (!txt) return;
    // Emit message to server
    chatSocket.emit("message", { roomId, text: txt });
    // Clear input only if we used the input
    if (!text) messageInput.value = "";
  }

  sendBtn.addEventListener("click", () => sendMessage());
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // -------- GIF Picker behavior (Tenor) --------
  gifBtn.addEventListener("click", () => {
    toggleGifModal(true);
    searchGIFs("trending");
    // focus the search box
    setTimeout(() => gifSearch.focus(), 150);
  });

  // Close GIF modal when clicking outside content
  window.addEventListener("click", (e) => {
    if (e.target === gifModal) toggleGifModal(false);
  });

  gifSearch.addEventListener("input", () => {
    const q = gifSearch.value.trim();
    if (q.length === 0) {
      searchGIFs("trending");
    } else {
      // debounce quickly (simple)
      if (gifSearch._debounce) clearTimeout(gifSearch._debounce);
      gifSearch._debounce = setTimeout(() => searchGIFs(q), 250);
    }
  });

  async function searchGIFs(query) {
    if (!TENOR_KEY || TENOR_KEY.startsWith("YOUR_TENOR")) {
      gifResults.innerHTML = `<div class="small">Please set TENOR_KEY in chat.js to use GIFs.</div>`;
      return;
    }

    gifResults.innerHTML = `<div class="small">Loading...</div>`;
    try {
      // Tenor v2 (google) endpoint (limit 12)
      const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=18`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.results || data.results.length === 0) {
        gifResults.innerHTML = `<div class="small">No GIFs found.</div>`;
        return;
      }

      gifResults.innerHTML = "";
      data.results.forEach((gif) => {
        // Try to pick a reasonably sized gif variant (gif or medium gif)
        let gifUrl = null;
        if (gif.media_formats) {
          // prefer gif, then gif_preview, then tinygif
          gifUrl = (gif.media_formats.gif && gif.media_formats.gif.url)
            || (gif.media_formats.mediumgif && gif.media_formats.mediumgif.url)
            || (gif.media_formats.tinygif && gif.media_formats.tinygif.url);
        }
        // fallback: some tenor payloads may use 'id' or other structure
        if (!gifUrl && gif.url) gifUrl = gif.url;

        if (!gifUrl) return; // skip if we couldn't find a URL

        const img = document.createElement("img");
        img.src = gifUrl;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.loading = "lazy";

        // clicking a GIF will send it immediately
        img.addEventListener("click", () => {
          // send GIF URL as message text
          sendMessage(gifUrl);
          toggleGifModal(false);
        });

        const wrapper = document.createElement("div");
        wrapper.style.width = "100%";
        wrapper.style.aspectRatio = "1 / 1";
        wrapper.appendChild(img);
        gifResults.appendChild(wrapper);
      });
    } catch (e) {
      console.error("Tenor search error:", e);
      gifResults.innerHTML = `<div class="small">Failed to load GIFs.</div>`;
    }
  }

  function toggleGifModal(show) {
    if (show) {
      gifModal.style.display = "block";
    } else {
      gifModal.style.display = "none";
      gifSearch.value = "";
      gifResults.innerHTML = "";
    }
  }

  // -------- UI helpers --------
  function appendSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "message";
    div.style.opacity = "0.8";
    div.style.fontStyle = "italic";
    div.style.maxWidth = "100%";
    div.innerHTML = escapeHtml(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(msg, isMe) {
    // create wrapper
    const outer = document.createElement("div");
    outer.className = "message" + (isMe ? " me" : "");

    // meta
    const meta = document.createElement("div");
    meta.className = "meta";
    const sender = escapeHtml(msg.senderName || "Unknown");
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : "";
    meta.innerHTML = `<strong>${sender}</strong> <span class="small">(${(msg.originalLanguage || "en").toUpperCase()} → ${(msg.targetLanguage || (user.language || "en")).toUpperCase()}) ${time}</span>`;

    // content (text or GIF)
    const content = document.createElement("div");
    content.className = "text";

    // decide if the message is an image/GIF url
    const text = msg.text || "";
    const isImageUrl = looksLikeImageUrl(text);

    if (isImageUrl) {
      const img = document.createElement("img");
      img.src = text;
      img.style.maxWidth = "320px";
      img.style.width = "100%";
      img.style.borderRadius = "12px";
      img.style.display = "block";
      img.alt = "GIF";
      content.appendChild(img);
    } else {
      content.innerHTML = escapeHtml(text);
    }

    outer.appendChild(meta);
    outer.appendChild(content);
    messagesEl.appendChild(outer);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function looksLikeImageUrl(url) {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase();
    // common image extensions (gif, png, jpg, jpeg, webp)
    if (/\.(gif|png|jpe?g|webp)(?:\?|$)/.test(lower)) return true;
    // tenor/giphy/media URLs often contain /media or tenor/gif etc
    if (lower.includes("tenor") || lower.includes("giphy") || lower.includes("media.tenor")) return true;
    // simple http(s) check
    if (/^https?:\/\/.+\.(gif|png|jpe?g|webp)(\?.*)?$/.test(lower)) return true;
    return false;
  }

  // -------- Users list helpers --------
  function addUserToList(u) {
    if (!u || !u.userId) return;
    if (document.getElementById(`user-${u.userId}`)) return;

    const div = document.createElement("div");
    div.id = `user-${u.userId}`;
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";
    div.style.marginBottom = "6px";

    const avatarHtml = u.avatar ? `<img src="${u.avatar}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;" />`
      : `<div style="width:28px;height:28px;border-radius:6px;background:#6ee7b733;display:grid;place-items:center;font-size:14px;font-weight:600;">${escapeHtml((u.username || 'U').charAt(0))}</div>`;

    div.innerHTML = `${avatarHtml}<span>${escapeHtml(u.username || 'Unknown')}</span>`;
    usersList.appendChild(div);
  }

  function removeUserFromList(u) {
    if (!u || !u.userId) return;
    const el = document.getElementById(`user-${u.userId}`);
    if (el) el.remove();
  }

  // Expose addUser for socket 'user-joined' convenience
  function addUser(u) { addUserToList(u); }

  // initial focus
  messageInput.focus();
}

// Start chat
initChat();
