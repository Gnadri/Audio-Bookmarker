document.getElementById('openDashboard').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('dashboard.html'));
    }
});

document.getElementById('addCurrentPage').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

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
                }, 2000);
            });
        });
    }
});

function showStatus(message) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
}
