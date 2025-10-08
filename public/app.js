const socket = io();

const issuesList = document.getElementById('issuesList');
const createBtn = document.getElementById('createBtn');

createBtn.addEventListener('click', () => {
  const creator = document.getElementById('creator').value.trim() || 'anonymous';
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  if (!title) return alert('Please give a title');

  socket.emit('create_issue', { title, description, creator });
  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
});

socket.on('issues_updated', (issues) => renderIssues(issues || []));
socket.on('error_msg', (msg) => alert(msg));

function renderIssues(issues) {
  issuesList.innerHTML = '';
  if (!issues.length) {
    issuesList.innerHTML = '<div class="small">No issues yet — create one above.</div>';
    return;
  }
  issues.slice().reverse().forEach(issue => {
    const node = document.createElement('div');
    node.className = 'issue';

    const commentsHtml = (issue.comments || []).map(c => `
      <div class="comment">
        <div class="small"><strong>${escapeHtml(c.author)}</strong> · ${new Date(c.created_at).toLocaleString()}</div>
        <div>${escapeHtml(c.text)}</div>
      </div>`).join('');

    node.innerHTML = `
      <h3>${escapeHtml(issue.title)}</h3>
      <div class="meta">#${issue.id} · status: <strong>${escapeHtml(issue.status)}</strong> · created: ${new Date(issue.created_at).toLocaleString()}</div>
      <p>${escapeHtml(issue.description)}</p>

      <div class="actions">
        <label>Change status:</label>
        <select data-id="${issue.id}" class="statusSel">
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="closed">closed</option>
        </select>
        <button data-id="${issue.id}" class="editBtn">Edit</button>
      </div>

      <div class="comments">
        <h4>Comments</h4>
        ${commentsHtml || '<div class="small">No comments</div>'}
        <div class="addComment">
          <input placeholder="Your name" class="cAuthor" />
          <input placeholder="Comment" class="cText" />
          <button class="cAddBtn" data-id="${issue.id}">Add Comment</button>
        </div>
      </div>
    `;

    issuesList.appendChild(node);
    node.querySelector('.statusSel').value = issue.status || 'open';

    node.querySelector('.statusSel').addEventListener('change', (e) => {
      socket.emit('update_status', { id: issue.id, status: e.target.value });
    });

    node.querySelector('.cAddBtn').addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const parent = e.target.closest('.addComment');
      const author = parent.querySelector('.cAuthor').value.trim() || 'anonymous';
      const text = parent.querySelector('.cText').value.trim();
      if (!text) return alert('Comment cannot be empty');
      socket.emit('add_comment', { id, author, text });
      parent.querySelector('.cText').value = '';
    });

    node.querySelector('.editBtn').addEventListener('click', () => {
      const newTitle = prompt('Edit title', issue.title);
      if (newTitle === null) return;
      const newDesc = prompt('Edit description', issue.description);
      if (newDesc === null) return;
      socket.emit('edit_issue', { id: issue.id, title: newTitle, description: newDesc });
    });
  });
}

function escapeHtml(s){
  if (!s) return '';
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}
