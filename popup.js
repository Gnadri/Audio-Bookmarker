let currentBook = null;
let currentBookIndex = -1;
let currentTab = null;
let booksCache = [];
let saveTimer = null;

const ui = {};

document.addEventListener('DOMContentLoaded', initPopup);

async function initPopup() {
    cacheElements();
    bindEvents();

    const [tabs, result] = await Promise.all([
        chrome.tabs.query({ active: true, currentWindow: true }),
        storageGet(['audiobooks'])
    ]);

    currentTab = tabs[0] || null;
    booksCache = result.audiobooks || [];

    if (!currentTab?.url) {
        showAddView();
        return;
    }

    syncCurrentBook(currentTab.url);
}

function cacheElements() {
    ui.notInLibraryView = document.getElementById('not-in-library-view');
    ui.inLibraryView = document.getElementById('in-library-view');
    ui.viewMode = document.getElementById('view-mode');
    ui.editMode = document.getElementById('edit-mode');
    ui.currentBookTitle = document.getElementById('current-book-title');
    ui.currentBookAuthor = document.getElementById('current-book-author');
    ui.currentBookCover = document.getElementById('current-book-cover');
    ui.progressLogsList = document.getElementById('progress-logs-list');
    ui.completeBtnText = document.getElementById('complete-btn-text');
    ui.toggleCompleteBtn = document.getElementById('toggleCompleteBtn');
    ui.statusMessage = document.getElementById('status-message');
    ui.editTitle = document.getElementById('edit-title');
    ui.editAuthor = document.getElementById('edit-author');
    ui.editUrl = document.getElementById('edit-url');
    ui.editCover = document.getElementById('edit-cover');
    ui.editBookForm = document.getElementById('edit-book-form');
    ui.openDashboard = document.getElementById('openDashboard');
    ui.openDashboardFromEdit = document.getElementById('openDashboardFromEdit');
    ui.addCurrentPage = document.getElementById('addCurrentPage');
    ui.editBookBtn = document.getElementById('editBookBtn');
    ui.cancelEditBtn = document.getElementById('cancelEditBtn');
    ui.deleteBookBtn = document.getElementById('deleteBookBtn');
    ui.addProgressLogBtn = document.getElementById('addProgressLogBtn');
}

function bindEvents() {
    ui.openDashboard.addEventListener('click', openDashboard);
    ui.openDashboardFromEdit.addEventListener('click', openDashboard);
    ui.addCurrentPage.addEventListener('click', addCurrentPageToLibrary);
    ui.editBookBtn.addEventListener('click', showEditMode);
    ui.cancelEditBtn.addEventListener('click', showViewMode);
    ui.editBookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBookEdits();
    });
    ui.toggleCompleteBtn.addEventListener('click', toggleCompleteStatus);
    ui.deleteBookBtn.addEventListener('click', deleteCurrentBook);
    ui.addProgressLogBtn.addEventListener('click', addProgressLog);
    ui.progressLogsList.addEventListener('input', handleProgressLogInput);
    ui.progressLogsList.addEventListener('click', handleProgressLogClick);
}

function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function syncCurrentBook(url) {
    currentBookIndex = booksCache.findIndex((book) => book.url === url);

    if (currentBookIndex === -1) {
        currentBook = null;
        showAddView();
        return;
    }

    currentBook = booksCache[currentBookIndex];
    showEditView();
}

function showAddView() {
    ui.notInLibraryView.classList.remove('hidden');
    ui.inLibraryView.classList.add('hidden');
}

function showEditView() {
    ui.notInLibraryView.classList.add('hidden');
    ui.inLibraryView.classList.remove('hidden');

    ui.currentBookTitle.textContent = currentBook.title;
    ui.currentBookAuthor.textContent = currentBook.author || 'Unknown Author';

    ui.currentBookCover.src = currentBook.cover || 'icons/logo.png';
    ui.currentBookCover.onerror = () => {
        ui.currentBookCover.src = 'icons/logo.png';
    };

    renderProgressLogs();

    if (currentBook.completed) {
        ui.completeBtnText.textContent = 'Ongoing';
        ui.toggleCompleteBtn.classList.add('active-state');
    } else {
        ui.completeBtnText.textContent = 'Complete';
        ui.toggleCompleteBtn.classList.remove('active-state');
    }
}

function openDashboard() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('dashboard.html'));
    }
}

async function addCurrentPageToLibrary() {
    if (!currentTab) return;

    const newBook = {
        id: Date.now().toString(),
        title: currentTab.title,
        url: currentTab.url,
        author: '',
        cover: ''
    };

    booksCache.push(newBook);
    await persistBooks();
    ui.statusMessage.classList.add('hidden');
    syncCurrentBook(currentTab.url);
}

function showEditMode() {
    ui.viewMode.classList.add('hidden');
    ui.editMode.classList.remove('hidden');

    ui.editTitle.value = currentBook.title;
    ui.editAuthor.value = currentBook.author || '';
    ui.editUrl.value = currentBook.url;
    ui.editCover.value = currentBook.cover || '';
}

function showViewMode() {
    ui.viewMode.classList.remove('hidden');
    ui.editMode.classList.add('hidden');
}

async function saveBookEdits() {
    const newTitle = ui.editTitle.value.trim();
    const newAuthor = ui.editAuthor.value.trim();
    const newUrl = ui.editUrl.value.trim();
    const newCover = ui.editCover.value.trim();

    if (!newTitle || !newUrl) {
        showStatus('Title and URL are required!');
        return;
    }

    if (currentBookIndex === -1) return;

    booksCache[currentBookIndex] = {
        ...booksCache[currentBookIndex],
        title: newTitle,
        author: newAuthor,
        url: newUrl,
        cover: newCover
    };
    currentBook = booksCache[currentBookIndex];

    await persistBooks();

    showStatus('Book updated!');
    setTimeout(() => {
        ui.statusMessage.classList.add('hidden');
        showViewMode();
        showEditView();
    }, 1500);
}

async function toggleCompleteStatus() {
    if (currentBookIndex === -1) return;

    booksCache[currentBookIndex].completed = !booksCache[currentBookIndex].completed;
    currentBook = booksCache[currentBookIndex];

    await persistBooks();

    showStatus(currentBook.completed ? 'Marked as Complete!' : 'Marked as Ongoing!');
    setTimeout(() => {
        ui.statusMessage.classList.add('hidden');
    }, 1500);

    showEditView();
}

async function deleteCurrentBook() {
    if (!currentBook || !confirm('Are you sure you want to delete this audiobook?')) {
        return;
    }

    booksCache = booksCache.filter((book) => book.id !== currentBook.id);
    currentBook = null;
    currentBookIndex = -1;

    await persistBooks();

    showStatus('Book Deleted!');
    setTimeout(() => {
        ui.statusMessage.classList.add('hidden');
        showAddView();
    }, 1500);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function debounceSaveLogs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        persistBooks();
    }, 250);
}

function renderProgressLogs() {
    const logs = (currentBook && currentBook.progressLogs) || [];

    if (logs.length === 0) {
        ui.progressLogsList.innerHTML = '<p class="no-logs-hint">No entries yet. Press Add to log progress.</p>';
        return;
    }

    ui.progressLogsList.innerHTML = logs.map((log, index) => {
        const isTimestamp = log.type === 'timestamp';

        return `
            <div class="log-entry" data-index="${index}">
                <div class="log-entry-top">
                    <input type="url" class="log-url-input" data-field="url" placeholder="Link (optional)" value="${escapeHtml(log.url || '')}" />
                    <button type="button" class="log-remove-btn" data-action="remove" title="Remove entry">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="log-entry-bottom">
                    <div class="log-type-toggle">
                        <button type="button" class="log-type-btn${!isTimestamp ? ' active' : ''}" data-action="type" data-type="page">Page</button>
                        <button type="button" class="log-type-btn${isTimestamp ? ' active' : ''}" data-action="type" data-type="timestamp">Time</button>
                    </div>
                    <input
                        type="${isTimestamp ? 'text' : 'number'}"
                        class="log-value-input"
                        data-field="value"
                        placeholder="${isTimestamp ? '0:00:00' : '#'}"
                        value="${escapeHtml(String(log.value || ''))}"
                        ${!isTimestamp ? 'min="1"' : ''}
                    />
                </div>
            </div>
        `;
    }).join('');
}

function handleProgressLogInput(event) {
    const entry = event.target.closest('.log-entry');
    if (!entry || !currentBook?.progressLogs) return;

    const index = Number(entry.dataset.index);
    const log = currentBook.progressLogs[index];
    if (!log) return;

    if (event.target.dataset.field === 'url') {
        log.url = event.target.value.trim();
        debounceSaveLogs();
        return;
    }

    if (event.target.dataset.field === 'value') {
        const value = event.target.value.trim();
        log.value = log.type === 'timestamp' ? value : (value ? parseInt(value, 10) || '' : '');
        debounceSaveLogs();
    }
}

function handleProgressLogClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || !currentBook?.progressLogs) return;

    const entry = actionButton.closest('.log-entry');
    if (!entry) return;

    const index = Number(entry.dataset.index);
    if (!Number.isInteger(index)) return;

    if (actionButton.dataset.action === 'remove') {
        currentBook.progressLogs.splice(index, 1);
        persistBooks();
        renderProgressLogs();
        return;
    }

    if (actionButton.dataset.action === 'type') {
        const nextType = actionButton.dataset.type;
        const log = currentBook.progressLogs[index];
        if (!log || log.type === nextType) return;

        log.type = nextType;
        log.value = '';
        persistBooks();
        renderProgressLogs();
    }
}

async function addProgressLog() {
    if (!currentBook) return;

    if (!currentBook.progressLogs) {
        currentBook.progressLogs = [];
    }

    currentBook.progressLogs.push({ url: '', type: 'timestamp', value: '' });
    renderProgressLogs();
    await persistBooks();
}

function persistBooks() {
    return storageSet({ audiobooks: booksCache });
}

function showStatus(message) {
    ui.statusMessage.textContent = message;
    ui.statusMessage.classList.remove('hidden');
}
