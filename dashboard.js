const ELEMENTS = {
    viewAllBtn: document.getElementById('view-all-btn'),
    viewCompletedBtn: document.getElementById('view-completed-btn'),
    addNewBtn: document.getElementById('add-new-btn'),
    libraryView: document.getElementById('library-view'),
    completedView: document.getElementById('completed-view'),
    addBookView: document.getElementById('add-book-view'),
    addBookForm: document.getElementById('add-book-form'),
    cancelAddBtn: document.getElementById('cancel-add'),
    bookGrid: document.getElementById('book-grid'),
    completedGrid: document.getElementById('completed-grid'),
    emptyState: document.getElementById('empty-state'),
    completedEmptyState: document.getElementById('completed-empty-state'),
    searchInput: document.getElementById('search-input'),
    editModal: document.getElementById('edit-modal'),
    editBookForm: document.getElementById('edit-book-form'),
    cancelEditBtn: document.getElementById('cancel-edit'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFileInput: document.getElementById('import-file-input'),
};

let books = [];
let editingLogs = []; // in-memory copy for the edit modal

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
    setupEventListeners();
});

// Helper to read file as DataURL
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function handleCoverSourceToggle(radioName, urlGroupId, uploadGroupId) {
    document.querySelectorAll(`input[name="${radioName}"]`).forEach(radio => {
        radio.addEventListener('change', (e) => {
            const urlGroup = document.getElementById(urlGroupId);
            const uploadGroup = document.getElementById(uploadGroupId);
            if (e.target.value === 'url') {
                urlGroup.classList.remove('hidden');
                uploadGroup.classList.add('hidden');
            } else {
                urlGroup.classList.add('hidden');
                uploadGroup.classList.remove('hidden');
            }
        });
    });
}

// Update setupEventListeners
function setupEventListeners() {
    // Navigation
    ELEMENTS.viewAllBtn.addEventListener('click', () => switchView('library'));
    ELEMENTS.viewCompletedBtn.addEventListener('click', () => switchView('completed'));
    ELEMENTS.addNewBtn.addEventListener('click', () => switchView('add'));
    ELEMENTS.cancelAddBtn.addEventListener('click', () => switchView('library'));

    // Forms
    ELEMENTS.addBookForm.addEventListener('submit', handleAddBook);
    ELEMENTS.editBookForm.addEventListener('submit', handleEditBook);
    ELEMENTS.cancelEditBtn.addEventListener('click', closeEditModal);

    // Search
    ELEMENTS.searchInput.addEventListener('input', (e) => {
        renderBooks(e.target.value);
    });

    // Close modal on outside click
    ELEMENTS.editModal.addEventListener('click', (e) => {
        if (e.target === ELEMENTS.editModal) closeEditModal();
    });

    // Cover Source Toggles
    handleCoverSourceToggle('cover-source', 'cover-url-group', 'cover-upload-group');
    handleCoverSourceToggle('edit-cover-source', 'edit-cover-url-group', 'edit-cover-upload-group');

    // Export / Import
    ELEMENTS.exportBtn.addEventListener('click', exportLibrary);
    ELEMENTS.importBtn.addEventListener('click', () => ELEMENTS.importFileInput.click());
    ELEMENTS.importFileInput.addEventListener('change', importLibrary);
}

function exportLibrary() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        audiobooks: books
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audiobookmark-backup-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importLibrary(e) {
    const file = e.target.files[0];
    if (!file) return;
    ELEMENTS.importFileInput.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
        let parsed;
        try {
            parsed = JSON.parse(ev.target.result);
        } catch (_) {
            alert('Invalid file: could not parse JSON.');
            return;
        }

        // Accept both a raw array and the wrapped export format
        const incoming = Array.isArray(parsed) ? parsed
            : (parsed && Array.isArray(parsed.audiobooks)) ? parsed.audiobooks
            : null;

        if (!incoming) {
            alert('Invalid file: no audiobook data found.');
            return;
        }

        // Validate each entry has at minimum an id, title, and url
        const valid = incoming.filter(b =>
            b && typeof b === 'object' &&
            typeof b.id === 'string' &&
            typeof b.title === 'string' &&
            typeof b.url === 'string'
        );

        if (valid.length === 0) {
            alert('No valid audiobook entries found in the file.');
            return;
        }

        const action = confirm(
            `Import ${valid.length} audiobook(s)?\n\n` +
            `OK — Merge with existing library (duplicates by ID are skipped)\n` +
            `Cancel — Cancel import`
        );
        if (!action) return;

        chrome.storage.local.get(['audiobooks'], (result) => {
            const existing = result.audiobooks || [];
            const existingIds = new Set(existing.map(b => b.id));
            const toAdd = valid.filter(b => !existingIds.has(b.id));
            const merged = existing.concat(toAdd);
            chrome.storage.local.set({ audiobooks: merged }, () => {
                alert(`Imported ${toAdd.length} new audiobook(s). ${valid.length - toAdd.length} duplicate(s) skipped.`);
                loadBooks();
            });
        });
    };
    reader.readAsText(file);
}

async function handleAddBook(e) {
    e.preventDefault();

    let cover = '';
    const sourceType = document.querySelector('input[name="cover-source"]:checked').value;

    if (sourceType === 'url') {
        cover = document.getElementById('book-cover').value;
    } else {
        const fileInput = document.getElementById('book-cover-file');
        if (fileInput.files.length > 0) {
            try {
                cover = await readFile(fileInput.files[0]);
            } catch (err) {
                console.error("Error reading file", err);
            }
        }
    }

    const newBook = {
        id: Date.now().toString(),
        title: document.getElementById('book-title').value,
        author: document.getElementById('book-author').value,
        url: document.getElementById('book-url').value,
        cover: cover
    };

    books.push(newBook);
    saveBooks();
    e.target.reset();
    // Reset file input manually since reset() might not clear it visibly in custom UI logic sometimes, but safe to do:
    document.getElementById('book-cover-file').value = '';
    switchView('library');
}

function deleteBook(id) {
    if (confirm('Are you sure you want to delete this audiobook?')) {
        books = books.filter(b => b.id !== id);
        saveBooks();
    }
}

function openEditModal(book) {
    document.getElementById('edit-book-id').value = book.id;
    document.getElementById('edit-book-title').value = book.title;
    document.getElementById('edit-book-author').value = book.author || '';
    document.getElementById('edit-book-url').value = book.url;

    // Reset edit form cover inputs
    document.getElementById('edit-book-cover').value = book.cover.startsWith('data:') ? '' : book.cover;
    document.getElementById('edit-book-cover-file').value = '';

    // Default to URL view unless we want to show something else, sticking to URL default for simplicity
    document.querySelector('input[name="edit-cover-source"][value="url"]').checked = true;
    document.getElementById('edit-cover-url-group').classList.remove('hidden');
    document.getElementById('edit-cover-upload-group').classList.add('hidden');

    // Load progress logs into memory and render
    editingLogs = JSON.parse(JSON.stringify(book.progressLogs || []));
    renderEditProgressLogs();

    ELEMENTS.editModal.classList.remove('hidden');
}

function closeEditModal() {
    ELEMENTS.editModal.classList.add('hidden');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderEditProgressLogs() {
    const container = document.getElementById('edit-progress-logs-list');
    container.innerHTML = '';

    if (editingLogs.length === 0) {
        container.innerHTML = '<p class="edit-no-logs-hint">No entries yet.</p>';
        return;
    }

    editingLogs.forEach((log, idx) => {
        const isTs = log.type === 'timestamp';
        const row = document.createElement('div');
        row.className = 'edit-log-entry';
        row.innerHTML = `
            <div class="edit-log-entry-top">
                <input type="url" class="edit-log-url" placeholder="Link (optional)" value="${escapeHtml(log.url || '')}" />
                <button type="button" class="edit-log-remove" title="Remove entry">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="edit-log-entry-bottom">
                <div class="edit-log-type-toggle">
                    <button type="button" class="edit-log-type-btn${!isTs ? ' active' : ''}" data-type="page">Page</button>
                    <button type="button" class="edit-log-type-btn${isTs ? ' active' : ''}" data-type="timestamp">Time</button>
                </div>
                <input type="${isTs ? 'text' : 'number'}" class="edit-log-value" placeholder="${isTs ? '0:00:00' : '#'}" value="${escapeHtml(String(log.value || ''))}" ${!isTs ? 'min="1"' : ''} />
            </div>
        `;

        row.querySelector('.edit-log-url').addEventListener('input', (e) => {
            editingLogs[idx].url = e.target.value.trim();
        });

        row.querySelector('.edit-log-value').addEventListener('input', (e) => {
            const v = e.target.value.trim();
            editingLogs[idx].value = !isTs && v ? (parseInt(v) || '') : v;
        });

        row.querySelectorAll('.edit-log-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editingLogs[idx].type = btn.dataset.type;
                editingLogs[idx].value = '';
                renderEditProgressLogs();
            });
        });

        row.querySelector('.edit-log-remove').addEventListener('click', () => {
            editingLogs.splice(idx, 1);
            renderEditProgressLogs();
        });

        container.appendChild(row);
    });
}

document.getElementById('edit-add-log-btn').addEventListener('click', () => {
    editingLogs.push({ url: '', type: 'timestamp', value: '' });
    renderEditProgressLogs();
});

async function handleEditBook(e) {
    e.preventDefault();

    const id = document.getElementById('edit-book-id').value;
    const title = document.getElementById('edit-book-title').value;
    const author = document.getElementById('edit-book-author').value;
    const url = document.getElementById('edit-book-url').value;

    let cover = null;
    const sourceType = document.querySelector('input[name="edit-cover-source"]:checked').value;

    if (sourceType === 'url') {
        const urlValue = document.getElementById('edit-book-cover').value;
        if (urlValue) cover = urlValue;
    } else {
        const fileInput = document.getElementById('edit-book-cover-file');
        if (fileInput.files.length > 0) {
            try {
                cover = await readFile(fileInput.files[0]);
            } catch (err) {
                console.error("Error reading file", err);
            }
        }
    }

    const bookIndex = books.findIndex(b => b.id === id);
    if (bookIndex > -1) {
        books[bookIndex].title = title;
        books[bookIndex].author = author;
        books[bookIndex].url = url;
        if (cover !== null) { // Only update cover if a new one was provided
            books[bookIndex].cover = cover;
        }
        books[bookIndex].progressLogs = editingLogs;
        saveBooks();
        closeEditModal();
    }
}

function switchView(viewName) {
    const sections = [ELEMENTS.libraryView, ELEMENTS.completedView, ELEMENTS.addBookView];
    const navItems = [ELEMENTS.viewAllBtn, ELEMENTS.viewCompletedBtn, ELEMENTS.addNewBtn];

    sections.forEach(s => s.classList.add('hidden'));
    navItems.forEach(n => n.classList.remove('active'));

    if (viewName === 'library') {
        ELEMENTS.libraryView.classList.remove('hidden');
        ELEMENTS.viewAllBtn.classList.add('active');
    } else if (viewName === 'completed') {
        ELEMENTS.completedView.classList.remove('hidden');
        ELEMENTS.viewCompletedBtn.classList.add('active');
    } else if (viewName === 'add') {
        ELEMENTS.addBookView.classList.remove('hidden');
        ELEMENTS.addNewBtn.classList.add('active');
    }
}

function toggleComplete(id, status) {
    const bookIndex = books.findIndex(b => b.id === id);
    if (bookIndex > -1) {
        books[bookIndex].completed = status;
        saveBooks();
    }
}

function loadBooks() {
    chrome.storage.local.get(['audiobooks'], (result) => {
        books = result.audiobooks || [];
        renderBooks();
    });
}

function saveBooks() {
    chrome.storage.local.set({ audiobooks: books }, () => {
        loadBooks();
    });
}

function renderBooks(filter = '') {
    ELEMENTS.bookGrid.innerHTML = '';
    ELEMENTS.completedGrid.innerHTML = '';

    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(filter.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(filter.toLowerCase()))
    );

    const ongoingBooks = filteredBooks.filter(b => !b.completed);
    const completedBooks = filteredBooks.filter(b => b.completed);

    if (filteredBooks.length === 0) {
        ELEMENTS.emptyState.classList.remove('hidden');
    } else {
        ELEMENTS.emptyState.classList.add('hidden');
        ongoingBooks.forEach(book => ELEMENTS.bookGrid.appendChild(createBookCard(book, true)));
        completedBooks.forEach(book => ELEMENTS.bookGrid.appendChild(createBookCard(book, true)));
    }

    if (completedBooks.length === 0) {
        ELEMENTS.completedEmptyState.classList.remove('hidden');
    } else {
        ELEMENTS.completedEmptyState.classList.add('hidden');
        completedBooks.forEach(book => ELEMENTS.completedGrid.appendChild(createBookCard(book, false)));
    }
}

function createBookCard(book, showProgress = true) {
    const card = document.createElement('div');
    card.className = 'book-card';

    // Default cover if none provided
    const coverUrl = book.cover || 'icons/icon128.png'; // Fallback to icon

    const progressLogs = showProgress && book.progressLogs ? book.progressLogs.filter(l => l.value) : [];
    const progressHtml = progressLogs.length > 0 ? `
        <div class="book-progress-logs">
            ${progressLogs.map(log => {
                const label = log.type === 'page' ? 'p.' + log.value : String(log.value);
                let safeUrl = null;
                if (log.url) {
                    try {
                        const u = new URL(log.url);
                        if (u.protocol === 'http:' || u.protocol === 'https:') safeUrl = log.url;
                    } catch (_) {}
                }
                return safeUrl
                    ? `<a href="${safeUrl}" target="_blank" class="book-progress-entry book-progress-link" title="${safeUrl}">${label}</a>`
                    : `<span class="book-progress-entry">${label}</span>`;
            }).join('')}
        </div>` : '';

    card.innerHTML = `
        <img src="${coverUrl}" alt="${book.title}" class="book-cover" onerror="this.src='icons/icon128.png'">
        <div class="book-info">
            <h3 class="book-title" title="${book.title}">${book.title}</h3>
            <p class="book-author">${book.author || 'Unknown Author'}</p>
            ${progressHtml}
        </div>
        <div class="book-actions">
            ${!book.completed ? `
                <button class="btn-icon complete" title="Mark as Complete">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                </button>
            ` : `
                <button class="btn-icon undo" title="Mark as Ongoing">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 010 10H3M3 10l4-4m-4 4l4 4"></path></svg>
                </button>
            `}
            <button class="btn-icon edit" title="Edit">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button class="btn-icon delete" title="Delete">
                 <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
            <a href="${book.url}" target="_blank" class="btn-link">
                Open Book
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
        </div>
    `;

    // Attach event listeners to buttons
    if (!book.completed) {
        card.querySelector('.complete').addEventListener('click', () => toggleComplete(book.id, true));
    } else {
        card.querySelector('.undo').addEventListener('click', () => toggleComplete(book.id, false));
    }
    card.querySelector('.edit').addEventListener('click', () => openEditModal(book));
    card.querySelector('.delete').addEventListener('click', () => deleteBook(book.id));

    return card;
}
