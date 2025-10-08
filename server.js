const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'issues.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

function loadIssues() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ issues: [] }, null, 2));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load issues.json', err);
    return { issues: [] };
  }
}

function saveIssues(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function gitCommit(action, issueId) {
  const message = `${action}: issue ${issueId} @ ${new Date().toISOString()}`;
  try {
    execFileSync('git', ['add', 'issues.json']);
    execFileSync('git', ['commit', '-m', message]);
    console.log('Git commit created:', message);
  } catch (err) {
    console.warn('git commit failed (is this a git repo?):', err.message);
  }
}

function persistAndBroadcast(action, issue, socket) {
  const data = loadIssues();
  const index = data.issues.findIndex(i => i.id === issue.id);

  if (index === -1) data.issues.push(issue);
  else data.issues[index] = issue;

  saveIssues(data);
  gitCommit(action, issue.id);
  io.emit('issues_updated', data.issues);
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.emit('issues_updated', loadIssues().issues);

  socket.on('create_issue', (payload) => {
    const issue = {
      id: uuidv4(),
      title: String(payload.title || 'Untitled'),
      description: String(payload.description || ''),
      status: 'open',
      creator: String(payload.creator || 'unknown'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      comments: []
    };
    persistAndBroadcast('create', issue, socket);
  });

  socket.on('update_status', (payload) => {
    const data = loadIssues();
    const issue = data.issues.find(i => i.id === payload.id);
    if (!issue) return socket.emit('error_msg', 'Issue not found');

    issue.status = String(payload.status || issue.status);
    issue.updated_at = new Date().toISOString();
    persistAndBroadcast('update_status', issue, socket);
  });

  socket.on('add_comment', (payload) => {
    const data = loadIssues();
    const issue = data.issues.find(i => i.id === payload.id);
    if (!issue) return socket.emit('error_msg', 'Issue not found');

    issue.comments.push({
      id: uuidv4(),
      author: String(payload.author || 'anonymous'),
      text: String(payload.text || ''),
      created_at: new Date().toISOString()
    });
    issue.updated_at = new Date().toISOString();
    persistAndBroadcast('add_comment', issue, socket);
  });

  socket.on('edit_issue', (payload) => {
    const data = loadIssues();
    const issue = data.issues.find(i => i.id === payload.id);
    if (!issue) return socket.emit('error_msg', 'Issue not found');

    issue.title = String(payload.title || issue.title);
    issue.description = String(payload.description || issue.description);
    issue.updated_at = new Date().toISOString();
    persistAndBroadcast('edit_issue', issue, socket);
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
