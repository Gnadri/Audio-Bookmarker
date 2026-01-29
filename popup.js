let currentBook = null;
let currentTab = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (currentTab) {
        checkIfBookInLibrary(currentTab.url);
    }
});

// Check if current URL is in library
function checkIfBookInLibrary(url) {
    chrome.storage.local.get(['audiobooks'], (result) => {
        const books = result.audiobooks || [];
        const book = books.find(b => b.url === url);
        
        if (book) {
            // Book found - show edit view
            currentBook = book;
            showEditView();
        } else {
            // Book not found - show add view
            currentBook = null;
            showAddView();
        }
    });
}

// Show the add bookmark view
function showAddView() {
    document.getElementById('not-in-library-view').classList.remove('hidden');
    document.getElementById('in-library-view').classList.add('hidden');
}

// Show the edit view with book details
function showEditView() {
    document.getElementById('not-in-library-view').classList.add('hidden');
    document.getElementById('in-library-view').classList.remove('hidden');
    
    // Update book details
    document.getElementById('current-book-title').textContent = currentBook.title;
    document.getElementById('current-book-author').textContent = currentBook.author || 'Unknown Author';
    
    // Update Cover
    const coverImg = document.getElementById('current-book-cover');
    if (coverImg) {
        coverImg.src = currentBook.cover || 'icons/logo.png';
        coverImg.onerror = () => { coverImg.src = 'icons/logo.png'; };
    }
    
    // Update timestamp
    const timestampInput = document.getElementById('bookmark-timestamp');
    if (currentBook.timestamp) {
        timestampInput.value = currentBook.timestamp;
    } else {
        timestampInput.value = '';
    }
    
    // Update complete button text
    const completeBtnText = document.getElementById('complete-btn-text');
    const toggleBtn = document.getElementById('toggleCompleteBtn');
    if (currentBook.completed) {
        completeBtnText.textContent = 'Ongoing';
        toggleBtn.classList.add('active-state');
    } else {
        completeBtnText.textContent = 'Complete';
        toggleBtn.classList.remove('active-state');
    }
}

// Open Dashboard button handlers
document.getElementById('openDashboard').addEventListener('click', openDashboard);
document.getElementById('openDashboardFromEdit').addEventListener('click', openDashboard);

function openDashboard() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('dashboard.html'));
    }
}

// Add current page to library
document.getElementById('addCurrentPage').addEventListener('click', async () => {
    if (currentTab) {
        const newBook = {
            id: Date.now().toString(),
            title: currentTab.title,
            url: currentTab.url,
            author: '', // User can edit later
            cover: ''
        };

        chrome.storage.local.get(['audiobooks'], (result) => {
            const books = result.audiobooks || [];
            books.push(newBook);

            chrome.storage.local.set({ audiobooks: books }, () => {
                showStatus('Saved to Library!');
                setTimeout(() => {
                    document.getElementById('status-message').classList.add('hidden');
                    // Refresh view to show edit options
                    checkIfBookInLibrary(currentTab.url);
                }, 1500);
            });
        });
    }
});

// Edit book button - toggles edit mode
document.getElementById('editBookBtn').addEventListener('click', () => {
    showEditMode();
});

// Cancel edit button
document.getElementById('cancelEditBtn').addEventListener('click', () => {
    showViewMode();
});

// Save edit form
document.getElementById('edit-book-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveBookEdits();
});

function showEditMode() {
    document.getElementById('view-mode').classList.add('hidden');
    document.getElementById('edit-mode').classList.remove('hidden');
    
    // Populate form with current book data
    document.getElementById('edit-title').value = currentBook.title;
    document.getElementById('edit-author').value = currentBook.author || '';
    document.getElementById('edit-url').value = currentBook.url;
    document.getElementById('edit-cover').value = currentBook.cover || '';
}

function showViewMode() {
    document.getElementById('view-mode').classList.remove('hidden');
    document.getElementById('edit-mode').classList.add('hidden');
}

function saveBookEdits() {
    const newTitle = document.getElementById('edit-title').value.trim();
    const newAuthor = document.getElementById('edit-author').value.trim();
    const newUrl = document.getElementById('edit-url').value.trim();
    const newCover = document.getElementById('edit-cover').value.trim();
    
    if (!newTitle || !newUrl) {
        showStatus('Title and URL are required!');
        return;
    }
    
    chrome.storage.local.get(['audiobooks'], (result) => {
        const books = result.audiobooks || [];
        const bookIndex = books.findIndex(b => b.id === currentBook.id);
        
        if (bookIndex > -1) {
            books[bookIndex].title = newTitle;
            books[bookIndex].author = newAuthor;
            books[bookIndex].url = newUrl;
            books[bookIndex].cover = newCover;
            
            chrome.storage.local.set({ audiobooks: books }, () => {
                currentBook = books[bookIndex];
                showStatus('Book updated!');
                setTimeout(() => {
                    document.getElementById('status-message').classList.add('hidden');
                    showViewMode();
                    showEditView(); // Refresh the view with new data
                }, 1500);
            });
        }
    });
}

// Toggle complete status
document.getElementById('toggleCompleteBtn').addEventListener('click', () => {
    if (currentBook) {
        chrome.storage.local.get(['audiobooks'], (result) => {
            const books = result.audiobooks || [];
            const bookIndex = books.findIndex(b => b.id === currentBook.id);
            
            if (bookIndex > -1) {
                books[bookIndex].completed = !books[bookIndex].completed;
                
                chrome.storage.local.set({ audiobooks: books }, () => {
                    showStatus(books[bookIndex].completed ? 'Marked as Complete!' : 'Marked as Ongoing!');
                    setTimeout(() => {
                        document.getElementById('status-message').classList.add('hidden');
                    }, 1500);
                    // Update current book and view
                    currentBook = books[bookIndex];
                    showEditView();
                });
            }
        });
    }
});

// Delete book
document.getElementById('deleteBookBtn').addEventListener('click', () => {
    if (currentBook && confirm('Are you sure you want to delete this audiobook?')) {
        chrome.storage.local.get(['audiobooks'], (result) => {
            const books = result.audiobooks || [];
            const filteredBooks = books.filter(b => b.id !== currentBook.id);
            
            chrome.storage.local.set({ audiobooks: filteredBooks }, () => {
                showStatus('Book Deleted!');
                setTimeout(() => {
                    document.getElementById('status-message').classList.add('hidden');
                    // Switch back to add view
                    currentBook = null;
                    showAddView();
                }, 1500);
            });
        });
    }
});

// Update timestamp
document.getElementById('bookmark-timestamp').addEventListener('change', (e) => {
    if (currentBook) {
        let newTimestamp = e.target.value.trim();
        
        // Validate timestamp format (H:MM:SS or HH:MM:SS or M:SS)
        const timestampRegex = /^(\d+):([0-5]?[0-9]):([0-5]?[0-9])$/;
        
        if (newTimestamp && !timestampRegex.test(newTimestamp)) {
            showStatus('Invalid format! Use H:MM:SS');
            e.target.value = currentBook.timestamp || '';
            return;
        }
        
        chrome.storage.local.get(['audiobooks'], (result) => {
            const books = result.audiobooks || [];
            const bookIndex = books.findIndex(b => b.id === currentBook.id);
            
            if (bookIndex > -1) {
                books[bookIndex].timestamp = newTimestamp;
                
                chrome.storage.local.set({ audiobooks: books }, () => {
                    currentBook.timestamp = newTimestamp;
                    showStatus('Position saved!');
                    setTimeout(() => {
                        document.getElementById('status-message').classList.add('hidden');
                    }, 1500);
                });
            }
        });
    }
});

// Clear timestamp
document.getElementById('clearTimestampBtn').addEventListener('click', () => {
    if (currentBook) {
        chrome.storage.local.get(['audiobooks'], (result) => {
            const books = result.audiobooks || [];
            const bookIndex = books.findIndex(b => b.id === currentBook.id);
            
            if (bookIndex > -1) {
                books[bookIndex].timestamp = '';
                
                chrome.storage.local.set({ audiobooks: books }, () => {
                    currentBook.timestamp = '';
                    document.getElementById('bookmark-timestamp').value = '';
                    showStatus('Position cleared!');
                    setTimeout(() => {
                        document.getElementById('status-message').classList.add('hidden');
                    }, 1500);
                });
            }
        });
    }
});

function showStatus(message) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
}
