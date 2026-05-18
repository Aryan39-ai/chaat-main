require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const webPush = require('web-push');
const Anthropic = require('@anthropic-ai/sdk');
const User = require('./models/User');
const Message = require('./models/Message');
const Room = require('./models/Room');

// ── AI Bot Configuration ──────────────────────────────────────────
const BOT_USERNAME = 'Aria';
const BOT_AVATAR = 'https://api.dicebear.com/7.x/thumbs/svg?seed=Aria-AI-Bot-Special';
const BOT_SOCKET_ID = '__aria_bot__';
const dmHistories = {};  // username → [{ role, content }] for per-user DM context

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function getAriaReply(userMessage, history = []) {
  if (!anthropic) return "I'm offline right now — ask an admin to configure my API key! 🤖";
  try {
    const messages = [
      ...history.slice(-10),  // last 10 turns for context
      { role: 'user', content: userMessage }
    ];
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are Aria, a friendly and witty AI chat companion living inside Chaat, a real-time chat app.
You keep replies short (1-3 sentences), conversational, and fun.
You can answer questions, chat casually, tell jokes, help with ideas, or just vibe with people.
Never be preachy or overly formal. Use the occasional emoji. You are not an assistant — you are a chat friend.`,
      messages
    });
    return response.content[0].text;
  } catch (err) {
    console.error('Aria AI error:', err.message);
    return "Oops, my brain glitched for a sec 😅 Try again?";
  }
}

// ── Web Push VAPID Configuration ─────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@chaat.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('Web Push configured with VAPID keys');
} else {
  console.warn('VAPID keys not set — Web Push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.');
}

const app = express();
app.use(cors());

// ── Express endpoint: serve VAPID public key to clients ──────────
app.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

let mongoConnected = false;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp', {
  serverSelectionTimeoutMS: 3000
}).then(() => {
  console.log('Connected to MongoDB');
  mongoConnected = true;
}).catch(err => {
  console.warn('MongoDB unavailable, using in-memory fallback.', err.message);
});

// ── In-memory state ──────────────────────────────────────
const onlineUsers   = {};  // socketId → { username, avatarUrl, currentRoom, socketId }
const roomSockets   = {    // roomName → Set of socketIds
  '#general': new Set(), '#gaming': new Set(),
  '#music': new Set(),   '#random': new Set()
};
const memoryMessages = [];
const dmHistoryMap   = {};
const memoryUsers    = {};
const memoryGroups   = {}; // groupName → { name, isPrivate, passwordHash, members[], admins[], description, createdBy }

// ── Register Aria bot as always-online ────────────────────────────
onlineUsers[BOT_SOCKET_ID] = {
  username: BOT_USERNAME, avatarUrl: BOT_AVATAR,
  currentRoom: '#general', socketId: BOT_SOCKET_ID, isBot: true
};
roomSockets['#general'].add(BOT_SOCKET_ID);

// ── Helpers ──────────────────────────────────────────────
function getDmKey(a, b) { return [a, b].sort().join(':'); }

function getUniqueUsers(userList) {
  return [...new Map(userList.map(u => [u.username, u])).values()];
}

function getAvatarForUser(username) {
  const found = Object.values(onlineUsers).find(u => u.username === username);
  if (found) return found.avatarUrl;
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(username)}`;
}

// ── Web Push helper: send notification to all of a user's devices ──
async function sendPushToUser(targetUsername, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !mongoConnected) return;

  try {
    const user = await User.findOne({ username: targetUsername });
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) return;

    const payloadStr = JSON.stringify(payload);
    const expiredEndpoints = [];

    for (const sub of user.pushSubscriptions) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          payloadStr
        );
      } catch (err) {
        // 410 Gone or 404 = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push to ${targetUsername} failed:`, err.statusCode || err.message);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await User.updateOne(
        { username: targetUsername },
        { $pull: { pushSubscriptions: { endpoint: { $in: expiredEndpoints } } } }
      );
    }
  } catch (e) {
    console.error('sendPushToUser error:', e);
  }
}

function emitRoomUsers(roomName) {
  const list = [...(roomSockets[roomName] || [])].map(sid => onlineUsers[sid]).filter(Boolean);
  io.to(roomName).emit('room_users', getUniqueUsers(list));
  io.emit('online_users', getUniqueUsers(Object.values(onlineUsers)));
}

async function sendRoomHistory(socket, roomName) {
  let history = [];
  if (mongoConnected) {
    try {
      const docs = await Message.find({ room: roomName, type: { $ne: 'dm' } })
        .sort({ timestamp: 1 }).limit(50);
      history = docs.map(d => ({
        room: d.room, username: d.fromUsername, fromUsername: d.fromUsername,
        avatarUrl: getAvatarForUser(d.fromUsername), type: d.type,
        text: d.text, imageData: d.imageData, timestamp: d.timestamp
      }));
    } catch (e) { console.error('History fetch error:', e); }
  } else {
    history = memoryMessages.filter(m => m.room === roomName && m.type !== 'dm').slice(-50);
  }
  socket.emit('history', history);
  socket.emit('room_history', history);
}

async function sendPrivateGroupsToUser(socket, username) {
  let groups = [];
  if (mongoConnected) {
    try {
      const docs = await Room.find({ isPrivate: true, members: username });
      groups = docs.map(g => ({
        name: g.name, description: g.description, createdBy: g.createdBy,
        members: g.members, admins: g.admins, isAdmin: g.admins.includes(username)
      }));
    } catch (e) { console.error('Private groups fetch error:', e); }
  } else {
    groups = Object.values(memoryGroups)
      .filter(g => g.isPrivate && g.members.includes(username))
      .map(g => ({
        name: g.name, description: g.description, createdBy: g.createdBy,
        members: g.members, admins: g.admins, isAdmin: g.admins.includes(username)
      }));
  }
  socket.emit('private_groups_list', groups);
}

// ── Socket.io ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  // ── Auth ─────────────────────────────────────────────
  socket.on('register', async ({ username, password } = {}) => {
    if (!username?.trim() || !password?.trim())
      return socket.emit('auth_error', 'Username and password are required.');
    const name = username.trim();
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const avatarUrl = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(name)}`;
      if (mongoConnected) {
        if (await User.findOne({ username: name })) return socket.emit('auth_error', 'Username already taken.');
        await User.create({ username: name, passwordHash, avatarUrl });
      } else {
        if (memoryUsers[name]) return socket.emit('auth_error', 'Username already taken.');
        memoryUsers[name] = { username: name, passwordHash, avatarUrl };
      }
      socket.emit('auth_success', { username: name, avatarUrl });
    } catch (e) { console.error('Register error:', e); socket.emit('auth_error', 'Registration failed.'); }
  });

  socket.on('login', async ({ username, password } = {}) => {
    if (!username?.trim() || !password?.trim())
      return socket.emit('auth_error', 'Username and password are required.');
    const name = username.trim();
    try {
      const user = mongoConnected ? await User.findOne({ username: name }) : memoryUsers[name] || null;
      if (!user) return socket.emit('auth_error', 'No account found. Please register first.');
      if (!user.passwordHash) return socket.emit('auth_error', 'Account has no password. Please register again.');
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return socket.emit('auth_error', 'Incorrect password.');
      socket.emit('auth_success', { username: name, avatarUrl: user.avatarUrl });
    } catch (e) { console.error('Login error:', e); socket.emit('auth_error', 'Login failed.'); }
  });

  // ── Join chat ────────────────────────────────────────
  socket.on('join', async (data) => {
    const username = typeof data === 'string' ? data : data?.username;
    const providedAvatar = typeof data === 'object' ? data?.avatarUrl : null;
    if (!username) return;
    const avatarUrl = providedAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(username)}`;

    if (mongoConnected) {
      try { await User.findOneAndUpdate({ username }, { avatarUrl }, { upsert: true, new: true }); }
      catch (e) { console.error('Upsert user error:', e); }
    }

    const defaultRoom = '#general';
    onlineUsers[socket.id] = { username, avatarUrl, currentRoom: defaultRoom, socketId: socket.id };
    socket.join(defaultRoom);
    if (!roomSockets[defaultRoom]) roomSockets[defaultRoom] = new Set();
    roomSockets[defaultRoom].add(socket.id);

    socket.emit('rooms_list', Object.keys(roomSockets).filter(r => !isPrivateGroup(r)));
    io.emit('user_joined', { username, avatarUrl, users: getUniqueUsers(Object.values(onlineUsers)) });
    emitRoomUsers(defaultRoom);
    sendRoomHistory(socket, defaultRoom);
    sendPrivateGroupsToUser(socket, username);
  });

  function isPrivateGroup(roomName) {
    if (mongoConnected) return false; // can't sync check; handled via private_groups_list
    return !!memoryGroups[roomName]?.isPrivate;
  }

  // ── Avatar ───────────────────────────────────────────
  socket.on('update_avatar', async (avatarDataUrl) => {
    if (typeof avatarDataUrl !== 'string' || !avatarDataUrl.startsWith('data:image/')) return;
    const user = onlineUsers[socket.id];
    if (!user) return;
    user.avatarUrl = avatarDataUrl;
    if (mongoConnected) {
      try { await User.findOneAndUpdate({ username: user.username }, { avatarUrl: avatarDataUrl }); }
      catch (e) { console.error('Avatar update error:', e); }
    } else if (memoryUsers[user.username]) {
      memoryUsers[user.username].avatarUrl = avatarDataUrl;
    }
    io.emit('avatar_updated', { username: user.username, avatarUrl: avatarDataUrl });
  });

  // ── Public rooms ─────────────────────────────────────
  socket.on('join_room', (roomName) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const oldRoom = user.currentRoom;
    if (oldRoom && roomSockets[oldRoom]) {
      socket.leave(oldRoom); roomSockets[oldRoom].delete(socket.id); emitRoomUsers(oldRoom);
    }
    let target = roomName.trim();
    if (!target.startsWith('#')) target = '#' + target;
    if (!roomSockets[target]) { roomSockets[target] = new Set(); io.emit('rooms_list', Object.keys(roomSockets).filter(r => !memoryGroups[r]?.isPrivate)); }
    socket.join(target); roomSockets[target].add(socket.id);
    user.currentRoom = target;
    emitRoomUsers(target);
    sendRoomHistory(socket, target);
  });

  socket.on('create_room', (name) => {
    if (!name?.trim()) return;
    let roomName = name.trim();
    if (!roomName.startsWith('#')) roomName = '#' + roomName;
    if (!roomSockets[roomName]) {
      roomSockets[roomName] = new Set();
      io.emit('new_room', roomName);
      io.emit('rooms_list', Object.keys(roomSockets).filter(r => !memoryGroups[r]?.isPrivate));
    }
  });

  // ── Private groups ───────────────────────────────────
  socket.on('create_group', async ({ name, description, password, inviteList } = {}) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    if (!name?.trim()) return socket.emit('group_error', 'Group name is required.');

    let groupName = name.trim();
    if (!groupName.startsWith('#')) groupName = '#' + groupName;

    const passwordHash = password ? await bcrypt.hash(password, 10) : '';
    const members = [...new Set([user.username, ...(inviteList || [])])];
    const admins  = [user.username];

    const groupData = { name: groupName, isPrivate: true, passwordHash, members, admins, description: description || '', createdBy: user.username };

    if (mongoConnected) {
      try {
        const existing = await Room.findOne({ name: groupName });
        if (existing) return socket.emit('group_error', 'A room with that name already exists.');
        await Room.create(groupData);
      } catch (e) { console.error('Create group error:', e); return socket.emit('group_error', 'Failed to create group.'); }
    } else {
      if (memoryGroups[groupName]) return socket.emit('group_error', 'A room with that name already exists.');
      memoryGroups[groupName] = { ...groupData };
    }

    if (!roomSockets[groupName]) roomSockets[groupName] = new Set();

    // Notify invited users who are online
    for (const invitedUsername of (inviteList || [])) {
      const invitedUser = Object.values(onlineUsers).find(u => u.username === invitedUsername);
      if (invitedUser) {
        io.to(invitedUser.socketId).emit('group_invite', { groupName, invitedBy: user.username, description: description || '' });
        sendPrivateGroupsToUser(io.sockets.sockets.get(invitedUser.socketId), invitedUsername);
      }
    }

    socket.emit('group_created', { name: groupName });
    sendPrivateGroupsToUser(socket, user.username);
  });

  socket.on('join_private_group', async ({ roomName, password } = {}) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    let group = null;
    if (mongoConnected) {
      try { group = await Room.findOne({ name: roomName, isPrivate: true }); }
      catch (e) { console.error('Find group error:', e); }
    } else {
      group = memoryGroups[roomName] || null;
    }

    if (!group) return socket.emit('group_error', 'Group not found.');

    // Already a member — join directly
    if (group.members.includes(user.username)) {
      return doJoinRoom(socket, user, roomName);
    }

    // Verify password
    if (!group.passwordHash) return socket.emit('group_error', 'This group is invite-only. Ask an admin to invite you.');
    const valid = await bcrypt.compare(password || '', group.passwordHash);
    if (!valid) return socket.emit('group_error', 'Incorrect group password.');

    // Add to members
    if (mongoConnected) {
      try { await Room.findOneAndUpdate({ name: roomName }, { $addToSet: { members: user.username } }); }
      catch (e) { console.error('Add member error:', e); }
    } else {
      memoryGroups[roomName].members.push(user.username);
    }

    sendPrivateGroupsToUser(socket, user.username);
    doJoinRoom(socket, user, roomName);
  });

  socket.on('invite_to_group', async ({ roomName, targetUsername } = {}) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    let group = mongoConnected
      ? await Room.findOne({ name: roomName, isPrivate: true }).catch(() => null)
      : memoryGroups[roomName] || null;

    if (!group) return socket.emit('group_error', 'Group not found.');
    if (!group.admins.includes(user.username)) return socket.emit('group_error', 'Only admins can invite users.');
    if (group.members.includes(targetUsername)) return socket.emit('group_error', `${targetUsername} is already a member.`);

    if (mongoConnected) {
      try { await Room.findOneAndUpdate({ name: roomName }, { $addToSet: { members: targetUsername } }); }
      catch (e) { console.error('Invite error:', e); return socket.emit('group_error', 'Invite failed.'); }
    } else {
      memoryGroups[roomName].members.push(targetUsername);
    }

    const targetUser = Object.values(onlineUsers).find(u => u.username === targetUsername);
    if (targetUser) {
      const targetSocket = io.sockets.sockets.get(targetUser.socketId);
      if (targetSocket) {
        targetSocket.emit('group_invite', { groupName: roomName, invitedBy: user.username });
        sendPrivateGroupsToUser(targetSocket, targetUsername);
      }
    }

    socket.emit('group_invite_sent', { targetUsername, groupName: roomName });
    sendPrivateGroupsToUser(socket, user.username);
  });

  socket.on('kick_from_group', async ({ roomName, targetUsername } = {}) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    let group = mongoConnected
      ? await Room.findOne({ name: roomName, isPrivate: true }).catch(() => null)
      : memoryGroups[roomName] || null;

    if (!group) return socket.emit('group_error', 'Group not found.');
    if (!group.admins.includes(user.username)) return socket.emit('group_error', 'Only admins can kick members.');
    if (targetUsername === user.username) return socket.emit('group_error', 'You cannot kick yourself.');

    if (mongoConnected) {
      try { await Room.findOneAndUpdate({ name: roomName }, { $pull: { members: targetUsername, admins: targetUsername } }); }
      catch (e) { console.error('Kick error:', e); return socket.emit('group_error', 'Kick failed.'); }
    } else {
      memoryGroups[roomName].members = memoryGroups[roomName].members.filter(m => m !== targetUsername);
      memoryGroups[roomName].admins  = memoryGroups[roomName].admins.filter(a => a !== targetUsername);
    }

    // Force kicked user out of the room socket
    const kickedUser = Object.values(onlineUsers).find(u => u.username === targetUsername);
    if (kickedUser) {
      const kickedSocket = io.sockets.sockets.get(kickedUser.socketId);
      if (kickedSocket) {
        kickedSocket.leave(roomName);
        if (roomSockets[roomName]) roomSockets[roomName].delete(kickedUser.socketId);
        if (kickedUser.currentRoom === roomName) {
          kickedUser.currentRoom = '#general';
          kickedSocket.join('#general');
          if (roomSockets['#general']) roomSockets['#general'].add(kickedUser.socketId);
        }
        kickedSocket.emit('kicked_from_group', { groupName: roomName });
        sendPrivateGroupsToUser(kickedSocket, targetUsername);
      }
    }

    socket.emit('kick_success', { targetUsername, groupName: roomName });
    sendPrivateGroupsToUser(socket, user.username);
  });

  function doJoinRoom(socket, user, roomName) {
    const oldRoom = user.currentRoom;
    if (oldRoom && roomSockets[oldRoom]) {
      socket.leave(oldRoom); roomSockets[oldRoom].delete(socket.id); emitRoomUsers(oldRoom);
    }
    if (!roomSockets[roomName]) roomSockets[roomName] = new Set();
    socket.join(roomName); roomSockets[roomName].add(socket.id);
    user.currentRoom = roomName;
    emitRoomUsers(roomName);
    sendRoomHistory(socket, roomName);
  }

  // ── Messages ─────────────────────────────────────────
  socket.on('message', async (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const msgObj = typeof data === 'string'
      ? { room: user.currentRoom, username: user.username, fromUsername: user.username,
          avatarUrl: user.avatarUrl, type: 'text', text: data, timestamp: new Date() }
      : { room: user.currentRoom, username: user.username, fromUsername: user.username,
          avatarUrl: user.avatarUrl, type: data.type || 'text',
          text: data.filename || data.text || '', imageData: data.data || '', timestamp: new Date() };

    if (mongoConnected) {
      try { await Message.create({ room: msgObj.room, fromUsername: msgObj.fromUsername, type: msgObj.type, text: msgObj.text, imageData: msgObj.imageData, timestamp: msgObj.timestamp }); }
      catch (e) { console.error('Message save error:', e); }
    } else { memoryMessages.push(msgObj); }

    io.to(user.currentRoom).emit('message', msgObj);

    // ── Aria @mention handler ────────────────────────────────────
    if (msgObj.type === 'text' && msgObj.text.toLowerCase().includes(`@${BOT_USERNAME.toLowerCase()}`)) {
      const question = msgObj.text.replace(new RegExp(`@${BOT_USERNAME}`, 'gi'), '').trim() || msgObj.text;
      const channelKey = `channel:${msgObj.room}`;
      if (!dmHistories[channelKey]) dmHistories[channelKey] = [];
      dmHistories[channelKey].push({ role: 'user', content: `${user.username} says: ${question}` });
      const reply = await getAriaReply(`${user.username} says: ${question}`, dmHistories[channelKey].slice(0, -1));
      dmHistories[channelKey].push({ role: 'assistant', content: reply });

      const botMsg = {
        room: user.currentRoom, username: BOT_USERNAME, fromUsername: BOT_USERNAME,
        avatarUrl: BOT_AVATAR, type: 'text',
        text: `@${user.username} ${reply}`, timestamp: new Date()
      };
      setTimeout(() => io.to(user.currentRoom).emit('message', botMsg), 600);
    }

    // Push to offline members of private groups
    if (mongoConnected && VAPID_PUBLIC_KEY) {
      try {
        const group = await Room.findOne({ name: user.currentRoom, isPrivate: true });
        if (group) {
          const onlineUsernames = new Set(Object.values(onlineUsers).map(u => u.username));
          const offlineMembers = group.members.filter(m => m !== user.username && !onlineUsernames.has(m));
          const body = msgObj.type === 'text' ? (msgObj.text || '').slice(0, 100) : '📷 Image';
          for (const member of offlineMembers) {
            sendPushToUser(member, {
              title: `${user.username} in ${user.currentRoom}`,
              body,
              icon: '/icons/icon-192.png',
              url: '/',
              tag: `room-${user.currentRoom}`
            });
          }
        }
      } catch (_) { /* not a private group or DB error, skip */ }
    }
  });

  // ── DMs ──────────────────────────────────────────────
  socket.on('send_dm', async ({ toSocketId, toUsername, text, type, data, filename }) => {
    const sender = onlineUsers[socket.id];
    if (!sender) return;
    const target = (toSocketId && onlineUsers[toSocketId])
      ? onlineUsers[toSocketId]
      : Object.values(onlineUsers).find(u => u.username === toUsername) || null;
    const targetUsername = target?.username || toUsername;
    if (!targetUsername) return;

    // ── Aria bot DM handler ──────────────────────────────────────
    if (targetUsername === BOT_USERNAME && type !== 'image') {
      const userMsg = text || '';
      const dmKey = `dm:${sender.username}`;
      if (!dmHistories[dmKey]) dmHistories[dmKey] = [];

      const userDmObj = {
        room: `${sender.username}:${BOT_USERNAME}`, username: sender.username,
        fromUsername: sender.username, toUsername: BOT_USERNAME,
        avatarUrl: sender.avatarUrl, type: 'dm', text: userMsg,
        timestamp: new Date(), isDm: true
      };
      socket.emit('receive_dm', userDmObj);

      dmHistories[dmKey].push({ role: 'user', content: userMsg });
      const reply = await getAriaReply(userMsg, dmHistories[dmKey].slice(0, -1));
      dmHistories[dmKey].push({ role: 'assistant', content: reply });

      const botDmObj = {
        room: `${sender.username}:${BOT_USERNAME}`, username: BOT_USERNAME,
        fromUsername: BOT_USERNAME, toUsername: sender.username,
        avatarUrl: BOT_AVATAR, type: 'dm', text: reply,
        timestamp: new Date(), isDm: true
      };
      socket.emit('receive_dm', botDmObj);
      return;
    }

    const dmKey = getDmKey(sender.username, targetUsername);
    if (!dmHistoryMap[dmKey]) dmHistoryMap[dmKey] = [];
    const dmObj = {
      room: dmKey, username: sender.username, fromUsername: sender.username,
      toUsername: targetUsername, avatarUrl: sender.avatarUrl,
      type: (type === 'image' || data) ? 'image' : 'dm',
      text: filename || text || '', imageData: data || '',
      timestamp: new Date(), isDm: true
    };
    dmHistoryMap[dmKey].push(dmObj);
    if (mongoConnected) {
      try { await Message.create({ room: dmKey, fromUsername: sender.username, toUsername: targetUsername, type: dmObj.type, text: dmObj.text, imageData: dmObj.imageData, timestamp: dmObj.timestamp }); }
      catch (e) { console.error('DM save error:', e); }
    }
    socket.emit('receive_dm', dmObj);
    if (target?.socketId) io.to(target.socketId).emit('receive_dm', dmObj);

    // Push only if target has no active socket connection
    const isTargetOnline = !!Object.values(onlineUsers).find(u => u.username === targetUsername);
    if (!isTargetOnline) {
      sendPushToUser(targetUsername, {
        title: `💬 DM from ${sender.username}`,
        body: dmObj.type === 'image' ? '📷 Sent you an image' : (dmObj.text || '').slice(0, 120),
        icon: '/icons/icon-192.png',
        url: '/',
        tag: `dm-${sender.username}`
      });
    }
  });

  socket.on('get_dm_history', async (targetUsername) => {
    const sender = onlineUsers[socket.id];
    if (!sender || !targetUsername) return;
    const dmKey = getDmKey(sender.username, targetUsername);
    let history = [];
    if (mongoConnected) {
      try {
        const docs = await Message.find({ $or: [
          { fromUsername: sender.username, toUsername: targetUsername },
          { fromUsername: targetUsername, toUsername: sender.username },
          { room: dmKey }
        ]}).sort({ timestamp: 1 }).limit(50);
        history = docs.map(d => ({
          room: dmKey, username: d.fromUsername, fromUsername: d.fromUsername,
          toUsername: d.toUsername, avatarUrl: getAvatarForUser(d.fromUsername),
          type: d.imageData ? 'image' : 'dm', text: d.text, imageData: d.imageData,
          timestamp: d.timestamp, isDm: true
        }));
      } catch (e) { console.error('DM history error:', e); }
    } else { history = dmHistoryMap[dmKey] || []; }
    socket.emit('dm_history', { targetUsername, messages: history });
  });

  // ── Typing & disconnect ──────────────────────────────
  socket.on('typing', (isTyping) => {
    const user = onlineUsers[socket.id];
    if (user?.currentRoom) socket.broadcast.to(user.currentRoom).emit('typing', { username: user.username, isTyping });
  });

  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      const oldRoom = user.currentRoom;
      if (oldRoom && roomSockets[oldRoom]) { roomSockets[oldRoom].delete(socket.id); emitRoomUsers(oldRoom); }
      delete onlineUsers[socket.id];
      io.emit('user_left', { username: user.username, users: getUniqueUsers(Object.values(onlineUsers)) });
      io.emit('online_users', Object.values(onlineUsers));
    }
  });

  // ── Push Subscription Management ────────────────────────────
  socket.on('push_subscribe', async ({ username: subUsername, subscription }) => {
    if (!subUsername || !subscription?.endpoint || !subscription?.keys) return;
    if (!mongoConnected) return;

    try {
      // Remove any existing subscription with the same endpoint, then add the new one
      await User.updateOne(
        { username: subUsername },
        { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
      );
      await User.updateOne(
        { username: subUsername },
        { $push: { pushSubscriptions: { endpoint: subscription.endpoint, keys: subscription.keys } } }
      );
      console.log(`Push subscription saved for ${subUsername}`);
    } catch (e) {
      console.error('push_subscribe error:', e);
    }
  });

  socket.on('push_unsubscribe', async ({ username: subUsername, endpoint }) => {
    if (!subUsername || !endpoint || !mongoConnected) return;

    try {
      await User.updateOne(
        { username: subUsername },
        { $pull: { pushSubscriptions: { endpoint } } }
      );
      console.log(`Push subscription removed for ${subUsername}`);
    } catch (e) {
      console.error('push_unsubscribe error:', e);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
