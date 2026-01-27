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
};

let books = [];

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

    ELEMENTS.editModal.classList.remove('hidden');
}

function closeEditModal() {
    ELEMENTS.editModal.classList.add('hidden');
}

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

    if (ongoingBooks.length === 0) {
        ELEMENTS.emptyState.classList.remove('hidden');
    } else {
        ELEMENTS.emptyState.classList.add('hidden');
        ongoingBooks.forEach(book => ELEMENTS.bookGrid.appendChild(createBookCard(book)));
    }

    if (completedBooks.length === 0) {
        ELEMENTS.completedEmptyState.classList.remove('hidden');
    } else {
        ELEMENTS.completedEmptyState.classList.add('hidden');
        completedBooks.forEach(book => ELEMENTS.completedGrid.appendChild(createBookCard(book)));
    }
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';

    // Default cover if none provided
    const coverUrl = book.cover || 'icons/icon128.png'; // Fallback to icon

    card.innerHTML = `
        <img src="${coverUrl}" alt="${book.title}" class="book-cover" onerror="this.src='icons/icon128.png'">
        <div class="book-info">
            <h3 class="book-title" title="${book.title}">${book.title}</h3>
            <p class="book-author">${book.author || 'Unknown Author'}</p>
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
