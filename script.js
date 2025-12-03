const firebaseConfig = {
    apiKey: "AIzaSyDVVRM2NJGXn_5XhzozETuYFAgmWvpW6ec",
    authDomain: "fresh-girl.firebaseapp.com",
    projectId: "fresh-girl",
    storageBucket: "fresh-girl.firebasestorage.app",
    messagingSenderId: "907721279776",
    appId: "1:907721279776:web:df4fe87ecd7d9b8d82af45"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const cloudName = 'dwsljlcqr';
const uploadPreset = 'fresh-girl';

const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const imagesContainer = document.getElementById('imagesContainer');
const uploadSpinner = document.getElementById('uploadSpinner');
const imagePreview = document.getElementById('imagePreview');
const searchInput = document.getElementById('searchInput');
const suggestions = document.getElementById('suggestions');
const openManageModalBtn = document.getElementById('openManageModalBtn');
const oldTitleInput = document.getElementById('oldTitleInput');
const oldTitleSuggestions = document.getElementById('oldTitleSuggestions');
const newTitleInput = document.getElementById('newTitleInput');
const updateTitleBtn = document.getElementById('updateTitleBtn');
const titleInput = document.getElementById('titleInput');
const titleSuggestions = document.getElementById('titleSuggestions');
const createTitleBtn = document.getElementById('createTitleBtn');
const imageModal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImg');
const closeImageModal = document.querySelector('#imageModal .close');
const manageModal = document.getElementById('manageModal');
const closeManageModal = document.getElementById('closeManageModal');

const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');

const loadingOverlay = document.getElementById('loadingOverlay');

// Global variables for search functionality
let allTitles = [];
let currentSuggestionIndex = -1;
let currentOldTitleSuggestionIndex = -1;
let currentTitleSuggestionIndex = -1;

async function uploadImage() {
    const files = accumulatedFiles;
    const selectedTitle = titleInput.value.trim();
    if (files.length === 0) {
        showNotification('Please select at least one image or video.', 'error');
        return;
    }
    if (!selectedTitle) {
        showNotification('Please enter a title for the images/videos.', 'error');
        return;
    }
    loadingOverlay.style.display = 'flex';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    const uploadPromises = Array.from(files).map(async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);

            // Determine upload endpoint based on file type
            const isVideo = file.type.startsWith('video/');
            const uploadEndpoint = isVideo ? 'video/upload' : 'image/upload';

            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${uploadEndpoint}`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (response.ok && data.secure_url) {
                const fileRef = await db.collection('images').add({
                    url: data.secure_url,
                    publicId: data.public_id,
                    name: file.name,
                    type: isVideo ? 'video' : 'image',
                    uploadedAt: new Date()
                });
                const titleSnapshot = await db.collection('titles').where('name', '==', selectedTitle).get();
                if (!titleSnapshot.empty) {
                    const titleDoc = titleSnapshot.docs[0];
                    await db.collection('image_titles').add({
                        imageId: fileRef.id,
                        titleId: titleDoc.id,
                        createdAt: new Date()
                    });
                }
                return { success: true, name: file.name };
            } else {
                console.error('Cloudinary upload failed for', file.name, ':', data);
                return { success: false, name: file.name, error: data };
            }
        } catch (error) {
            console.error('Error uploading file', file.name, ':', error);
            return { success: false, name: file.name, error };
        }
    });
    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    loadImages(selectedTitle);
    populateTitles();
    clearAllFiles(true);
    if (successCount > 0) {
        showNotification(`${successCount} image(s)/video(s) uploaded successfully!${errorCount > 0 ? ` ${errorCount} failed.` : ''}`, 'success');
    } else {
        showNotification('All uploads failed. Check console for details.', 'error');
    }
    loadingOverlay.style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Files';

    // Clear title input after successful upload
    titleInput.value = '';
}




async function displayImagesForPage(page) {
    imagesContainer.innerHTML = '';

    if (allImages.length === 0) {
        imagesContainer.innerHTML = '<p>No images to display.</p>';
        hidePagination();
        return;
    }

    const totalPages = Math.ceil(totalImages / imagesPerPage);
    const startIndex = (page - 1) * imagesPerPage;
    const endIndex = Math.min(startIndex + imagesPerPage, totalImages);

    for (let i = startIndex; i < endIndex; i++) {
        const { doc: imageDoc, data: imgData } = allImages[i];

        const imageTitlesSnapshot = await db.collection('image_titles')
            .where('imageId', '==', imageDoc.id)
            .get();

        let titleId = null;
        if (!imageTitlesSnapshot.empty) {
            titleId = imageTitlesSnapshot.docs[0].data().titleId;
        }

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-item';
        imgWrapper.setAttribute('data-image-id', imageDoc.id);

        const isVideo = imgData.type === 'video';
        let mediaElement;

        if (isVideo) {
            mediaElement = document.createElement('video');
            mediaElement.src = imgData.url;
            mediaElement.controls = true;
            mediaElement.style.width = '100%';
            mediaElement.style.height = 'auto';
            mediaElement.style.borderRadius = '4px';
            mediaElement.style.cursor = 'pointer';
            mediaElement.onclick = () => toggleImageSelection(imageDoc.id);
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = imgData.url;
            mediaElement.alt = imgData.name;
            mediaElement.style.cursor = 'pointer';
            mediaElement.onclick = () => toggleImageSelection(imageDoc.id);
        }

        let setThumbnailBtn = null;
        if (titleId) {
            setThumbnailBtn = document.createElement('button');
            setThumbnailBtn.textContent = 'Set Thumbnail';
            setThumbnailBtn.className = 'set-thumbnail-btn';
            setThumbnailBtn.style.display = 'block';
            setThumbnailBtn.style.margin = '10px auto 0';
            setThumbnailBtn.onclick = () => setThumbnailDirectly(imageDoc.id, titleId);
        }

        imgWrapper.appendChild(mediaElement);
        if (setThumbnailBtn) {
            imgWrapper.appendChild(setThumbnailBtn);
        }
        imagesContainer.appendChild(imgWrapper);
    }

    updatePaginationUI(page, totalPages);
}


function updatePaginationUI(currentPage, totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (totalPages <= 1) {
        hidePagination();
        return;
    }

    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalImages} images)`;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    paginationContainer.style.display = 'flex';
}


function hidePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }
}


function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayImagesForPage(currentPage);
    }
}


function goToNextPage() {
    const totalPages = Math.ceil(totalImages / imagesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayImagesForPage(currentPage);
    }
}


function displayPreviews(files) {
    imagePreview.innerHTML = '';

    if (files.length === 0) {
        uploadBtn.style.display = 'none';
        return;
    }

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';

            const isVideo = file.type.startsWith('video/');
            let mediaElement;

            if (isVideo) {
                mediaElement = document.createElement('video');
                mediaElement.src = e.target.result;
                mediaElement.controls = true;
                mediaElement.style.maxWidth = '100%';
                mediaElement.style.height = 'auto';
                mediaElement.style.borderRadius = '4px';
            } else {
                mediaElement = document.createElement('img');
                mediaElement.src = e.target.result;
            }

            const name = document.createElement('p');
            name.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'remove-preview-btn';
            removeBtn.title = 'Remove this file';
            removeBtn.onclick = () => removePreviewItem(index);

            previewItem.appendChild(mediaElement);
            previewItem.appendChild(name);
            previewItem.appendChild(removeBtn);
            imagePreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    uploadBtn.style.display = files.length > 0 ? 'inline-block' : 'none';
    clearAllBtn.style.display = files.length > 0 ? 'inline-block' : 'none';
}

function removePreviewItem(indexToRemove) {
    accumulatedFiles.splice(indexToRemove, 1);

    const dt = new DataTransfer();
    accumulatedFiles.forEach(file => dt.items.add(file));

    imageInput.files = dt.files;

    displayPreviews(imageInput.files);
}

function clearAllFiles(autoClear = false) {
    if (autoClear || confirm('Clear all selected images?')) {
        accumulatedFiles = [];
        imageInput.value = '';
        imagePreview.innerHTML = '';
        uploadBtn.style.display = 'none';
        clearAllBtn.style.display = 'none';
    }
}

let accumulatedFiles = [];

imageInput.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);

    accumulatedFiles = accumulatedFiles.concat(newFiles);

    const dt = new DataTransfer();
    accumulatedFiles.forEach(file => dt.items.add(file));
    imageInput.files = dt.files;

    displayPreviews(imageInput.files);
});

uploadBtn.addEventListener('click', uploadImage);

clearAllBtn.addEventListener('click', clearAllFiles);

bulkDeleteBtn.addEventListener('click', bulkDeleteSelectedImages);

async function deleteImage(docId, publicId, titleId) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    loadingOverlay.style.display = 'flex';

    const apiKey = '131831462832194';
    const apiSecret = '0aMeGCztYAn09WkM_Y0ekYmLBPw';

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(publicId, timestamp, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    // Get file type from database to determine destroy endpoint
    const imageDoc = await db.collection('images').doc(docId).get();
    const isVideo = imageDoc.exists && imageDoc.data().type === 'video';
    const destroyEndpoint = isVideo ? 'video/destroy' : 'image/destroy';

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${destroyEndpoint}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.result === 'ok') {
            await db.collection('images').doc(docId).delete();

            const imageTitleSnapshot = await db.collection('image_titles')
                .where('imageId', '==', docId)
                .where('titleId', '==', titleId)
                .get();

            const deletePromises = [];
            imageTitleSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            await Promise.all(deletePromises);

            showNotification('File deleted successfully!', 'success');

            const currentFilter = searchInput.value;
            if (currentFilter) {
                allImages = allImages.filter(item => item.doc.id !== docId);
                totalImages = allImages.length;

                const totalPages = Math.ceil(totalImages / imagesPerPage);
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                }

                if (totalImages > 0) {
                    displayImagesForPage(currentPage);
                } else {
                    loadImages(currentFilter);
                }
            } else {
                imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
            }
        } else {
            showNotification('Error deleting file: ' + (data.error ? data.error.message : 'Unknown error'), 'error');
        }

        loadingOverlay.style.display = 'none';
    } catch (error) {
        console.error('Error deleting file:', error);
        showNotification('Error deleting file.', 'error');
        loadingOverlay.style.display = 'none';
    }
}

async function generateSignature(publicId, timestamp, apiSecret) {
    try {
        const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.warn('crypto.subtle not available, using fallback signature generation');
        const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}


async function populateTitles() {
    try {
        const snapshot = await db.collection('titles').orderBy('createdAt', 'desc').get();

        // Clear existing options - titleSelect is now replaced with titleInput

        // Clear titles array
        allTitles = [];

        if (snapshot.empty) {
            return;
        }

        snapshot.forEach(doc => {
            const titleData = doc.data();
            const titleName = titleData.name;

            // Store in global array for search functionality
            allTitles.push(titleName);

            // titleSelect is now replaced with titleInput - no need to populate
        });

    } catch (error) {
        console.error('Error loading titles:', error);
        showNotification('Error loading titles: ' + error.message, 'error');
    }
}


// Search input functionality
function showSuggestions(query) {
    suggestions.innerHTML = '';

    let filteredTitles;
    if (!query.trim()) {
        // Show all titles when no query
        filteredTitles = allTitles.slice(0, 10); // Limit to 10 items
    } else {
        // Filter titles based on query
        filteredTitles = allTitles.filter(title =>
            title.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
    }

    if (filteredTitles.length === 0) {
        suggestions.style.display = 'none';
        return;
    }

    filteredTitles.forEach((title, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';

        if (query.trim()) {
            // Highlight matching text
            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedText = title.replace(regex, '<strong>$1</strong>');
            suggestionItem.innerHTML = highlightedText;
        } else {
            suggestionItem.textContent = title;
        }

        suggestionItem.onclick = () => selectSuggestion(title);
        suggestions.appendChild(suggestionItem);
    });

    suggestions.style.display = 'block';
    currentSuggestionIndex = -1;
}

function selectSuggestion(title) {
    searchInput.value = title;
    suggestions.style.display = 'none';
    loadImages(title);
}

async function loadImages(query = null) {
    imagesContainer.innerHTML = '<p>Loading images...</p>';
    try {
        let imageQuery;
        let imageIds = [];

        if (query) {
            // Check if title exists
            const titleSnapshot = await db.collection('titles').where('name', '==', query).get();
            if (titleSnapshot.empty) {
                imagesContainer.innerHTML = `<p>No title found with name "${query}". Please check the spelling or create this title first.</p>`;
                hidePagination();
                return;
            }

            const titleDoc = titleSnapshot.docs[0];
            const imageTitlesSnapshot = await db.collection('image_titles')
                .where('titleId', '==', titleDoc.id)
                .get();
            if (imageTitlesSnapshot.empty) {
                imagesContainer.innerHTML = '<p>No images found with this title.</p>';
                hidePagination();
                return;
            }
            imageIds = imageTitlesSnapshot.docs.map(doc => doc.data().imageId);
            imageQuery = db.collection('images').orderBy('uploadedAt', 'desc');
        } else {
            imagesContainer.innerHTML = '<p>Please enter a title to view images.</p>';
            hidePagination();
            return;
        }
        const imagesSnapshot = await imageQuery.get();

        if (imagesSnapshot.empty) {
            imagesContainer.innerHTML = query ? '<p>No images found with this title.</p>' : '<p>No images uploaded yet.</p>';
            hidePagination();
            return;
        }
        const validImages = [];

        for (const imageDoc of imagesSnapshot.docs) {
            const imgData = imageDoc.data();

            if (query) {
                const isImageInTitle = imageIds.includes(imageDoc.id);
                if (!isImageInTitle) {
                    continue;
                }
            }
            validImages.push({ doc: imageDoc, data: imgData });
        }

        validImages.sort((a, b) => {
            const dateA = a.data.uploadedAt?.toDate?.() || new Date(a.data.uploadedAt);
            const dateB = b.data.uploadedAt?.toDate?.() || new Date(b.data.uploadedAt);
            return dateB - dateA;
        });
        allImages = validImages;
        totalImages = validImages.length;
        currentPage = 1;
        displayImagesForPage(currentPage);

    } catch (error) {
        console.error('Error loading images:', error);
        imagesContainer.innerHTML = '<p>Error loading images.</p>';
        hidePagination();
    }
}

function hideSuggestions() {
    suggestions.style.display = 'none';
    currentSuggestionIndex = -1;
}

function highlightSuggestion(index) {
    const items = suggestions.querySelectorAll('.suggestion-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Search input event listeners
searchInput.addEventListener('input', (e) => {
    showSuggestions(e.target.value);
});

searchInput.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, items.length - 1);
        highlightSuggestion(currentSuggestionIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
        highlightSuggestion(currentSuggestionIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentSuggestionIndex >= 0 && items[currentSuggestionIndex]) {
            selectSuggestion(items[currentSuggestionIndex].textContent);
        } else if (searchInput.value.trim()) {
            loadImages(searchInput.value.trim());
            hideSuggestions();
        }
    } else if (e.key === 'Escape') {
        hideSuggestions();
    }
});

searchInput.addEventListener('blur', () => {
    // Delay hiding to allow click on suggestions
    setTimeout(hideSuggestions, 150);
});

searchInput.addEventListener('focus', () => {
    showSuggestions(searchInput.value);
});

// Old title search functionality
function showOldTitleSuggestions(query) {
    oldTitleSuggestions.innerHTML = '';

    let filteredTitles;
    if (!query.trim()) {
        // Show all titles when no query
        filteredTitles = allTitles.slice(0, 10); // Limit to 10 items
    } else {
        // Filter titles based on query
        filteredTitles = allTitles.filter(title =>
            title.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
    }

    if (filteredTitles.length === 0) {
        oldTitleSuggestions.style.display = 'none';
        return;
    }

    filteredTitles.forEach((title, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';

        if (query.trim()) {
            // Highlight matching text
            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedText = title.replace(regex, '<strong>$1</strong>');
            suggestionItem.innerHTML = highlightedText;
        } else {
            suggestionItem.textContent = title;
        }

        suggestionItem.onclick = () => selectOldTitleSuggestion(title);
        oldTitleSuggestions.appendChild(suggestionItem);
    });

    oldTitleSuggestions.style.display = 'block';
    currentOldTitleSuggestionIndex = -1;
}

function selectOldTitleSuggestion(title) {
    oldTitleInput.value = title;
    oldTitleSuggestions.style.display = 'none';
}

function hideOldTitleSuggestions() {
    oldTitleSuggestions.style.display = 'none';
    currentOldTitleSuggestionIndex = -1;
}

function highlightOldTitleSuggestion(index) {
    const items = oldTitleSuggestions.querySelectorAll('.suggestion-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Old title input event listeners
oldTitleInput.addEventListener('input', (e) => {
    showOldTitleSuggestions(e.target.value);
});

oldTitleInput.addEventListener('keydown', (e) => {
    const items = oldTitleSuggestions.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentOldTitleSuggestionIndex = Math.min(currentOldTitleSuggestionIndex + 1, items.length - 1);
        highlightOldTitleSuggestion(currentOldTitleSuggestionIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentOldTitleSuggestionIndex = Math.max(currentOldTitleSuggestionIndex - 1, -1);
        highlightOldTitleSuggestion(currentOldTitleSuggestionIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentOldTitleSuggestionIndex >= 0 && items[currentOldTitleSuggestionIndex]) {
            selectOldTitleSuggestion(items[currentOldTitleSuggestionIndex].textContent);
        } else if (oldTitleInput.value.trim()) {
            // Just set the value without selecting from suggestions
            hideOldTitleSuggestions();
        }
    } else if (e.key === 'Escape') {
        hideOldTitleSuggestions();
    }
});

oldTitleInput.addEventListener('blur', () => {
    // Delay hiding to allow click on suggestions
    setTimeout(hideOldTitleSuggestions, 150);
});

oldTitleInput.addEventListener('focus', () => {
    showOldTitleSuggestions(oldTitleInput.value);
});

// Upload title search functionality
function showTitleSuggestions(query) {
    titleSuggestions.innerHTML = '';

    let filteredTitles;
    if (!query.trim()) {
        // Show all titles when no query
        filteredTitles = allTitles.slice(0, 10); // Limit to 10 items
    } else {
        // Filter titles based on query
        filteredTitles = allTitles.filter(title =>
            title.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10); // Limit to 10 suggestions
    }

    if (filteredTitles.length === 0) {
        titleSuggestions.style.display = 'none';
        return;
    }

    filteredTitles.forEach((title, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';

        if (query.trim()) {
            // Highlight matching text
            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedText = title.replace(regex, '<strong>$1</strong>');
            suggestionItem.innerHTML = highlightedText;
        } else {
            suggestionItem.textContent = title;
        }

        suggestionItem.onclick = () => selectTitleSuggestion(title);
        titleSuggestions.appendChild(suggestionItem);
    });

    titleSuggestions.style.display = 'block';
    currentTitleSuggestionIndex = -1;
}

function selectTitleSuggestion(title) {
    titleInput.value = title;
    titleSuggestions.style.display = 'none';
}

function hideTitleSuggestions() {
    titleSuggestions.style.display = 'none';
    currentTitleSuggestionIndex = -1;
}

function highlightTitleSuggestion(index) {
    const items = titleSuggestions.querySelectorAll('.suggestion-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Upload title input event listeners
titleInput.addEventListener('input', (e) => {
    showTitleSuggestions(e.target.value);
});

titleInput.addEventListener('keydown', (e) => {
    const items = titleSuggestions.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentTitleSuggestionIndex = Math.min(currentTitleSuggestionIndex + 1, items.length - 1);
        highlightTitleSuggestion(currentTitleSuggestionIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentTitleSuggestionIndex = Math.max(currentTitleSuggestionIndex - 1, -1);
        highlightTitleSuggestion(currentTitleSuggestionIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentTitleSuggestionIndex >= 0 && items[currentTitleSuggestionIndex]) {
            selectTitleSuggestion(items[currentTitleSuggestionIndex].textContent);
        } else if (titleInput.value.trim()) {
            // Just set the value without selecting from suggestions
            hideTitleSuggestions();
        }
    } else if (e.key === 'Escape') {
        hideTitleSuggestions();
    }
});

titleInput.addEventListener('blur', () => {
    // Delay hiding to allow click on suggestions
    setTimeout(hideTitleSuggestions, 150);
});

titleInput.addEventListener('focus', () => {
    showTitleSuggestions(titleInput.value);
});


openManageModalBtn.addEventListener('click', () => {
    manageModal.style.display = 'block';
    populateTitles();
});

closeManageModal.addEventListener('click', () => {
    manageModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === manageModal) {
        manageModal.style.display = 'none';
    }
});

updateTitleBtn.addEventListener('click', async () => {
    const oldTitle = oldTitleInput.value.trim();
    const newTitle = newTitleInput.value.trim();

    if (!oldTitle) {
        showNotification('Please enter the old title.', 'error');
        return;
    }
    if (!newTitle) {
        showNotification('Please enter a new title.', 'error');
        return;
    }
    if (oldTitle === newTitle) {
        showNotification('New title must be different from old title.', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to rename title "${oldTitle}" to "${newTitle}"?`)) return;

    try {
        const titleSnapshot = await db.collection('titles').where('name', '==', oldTitle).get();

        if (!titleSnapshot.empty) {
            const titleDoc = titleSnapshot.docs[0];
            await titleDoc.ref.update({ name: newTitle });

            showNotification('Title updated successfully.', 'success');
            populateTitles();
            searchInput.value = '';
            imagesContainer.innerHTML = '<p>Please enter a title to view images.</p>';
            oldTitleInput.value = '';
            newTitleInput.value = '';
            manageModal.style.display = 'none';
        } else {
            showNotification('Title not found.', 'error');
        }
    } catch (error) {
        console.error('Error updating title:', error);
        showNotification('Error updating title.', 'error');
    }
});


function openModal(src) {
    modalImg.src = src;
    imageModal.style.display = 'block';
}


function closeModalFunc() {
    imageModal.style.display = 'none';
}


closeImageModal.addEventListener('click', closeModalFunc);

window.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        closeModalFunc();
    }
});

createTitleBtn.addEventListener('click', async () => {
    const newTitleName = prompt('Enter new title name:');
    if (!newTitleName || !newTitleName.trim()) {
        return;
    }

    const trimmedTitle = newTitleName.trim();

    try {
        const existingTitle = await db.collection('titles').where('name', '==', trimmedTitle).get();
        if (!existingTitle.empty) {
            showNotification('Title already exists!', 'error');
            return;
        }

        await db.collection('titles').add({
            name: trimmedTitle,
            createdAt: new Date()
        });

        showNotification('Title created successfully!', 'success');
        populateTitles();
    } catch (error) {
        console.error('Error creating title:', error);
        showNotification('Error creating title.', 'error');
    }
});


function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'flex';

    setTimeout(() => {
        hideNotification();
    }, 3000);
}


function hideNotification() {
    notification.style.display = 'none';
}


window.addEventListener('load', populateTitles);

let currentPage = 1;
const imagesPerPage = 20;
let totalImages = 0;
let allImages = [];

let selectedImages = [];

async function setThumbnailDirectly(imageId, titleId) {
    if (!confirm('Set this image as the thumbnail for this title?')) return;

    try {
        const existingThumbnailSnapshot = await db.collection('title_thumbnails')
            .where('titleId', '==', titleId)
            .get();

        const deletePromises = [];
        existingThumbnailSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);

        await db.collection('title_thumbnails').add({
            titleId: titleId,
            imageId: imageId,
            createdAt: new Date()
        });

        showNotification('Thumbnail set successfully!', 'success');

    } catch (error) {
        console.error('Error setting thumbnail:', error);
        showNotification('Error setting thumbnail.', 'error');
    }
}


function toggleImageSelection(imageId) {
    const index = selectedImages.indexOf(imageId);
    const imgWrapper = document.querySelector(`[data-image-id="${imageId}"]`);
    const mediaElement = imgWrapper ? imgWrapper.querySelector('img, video') : null;

    if (index > -1) {
        selectedImages.splice(index, 1);
        if (mediaElement) {
            mediaElement.style.border = '';
            mediaElement.style.opacity = '';
        }
    } else {
        selectedImages.push(imageId);
        if (mediaElement) {
            mediaElement.style.border = '3px solid #dc3545';
            mediaElement.style.opacity = '0.7';
        }
    }

    bulkDeleteBtn.style.display = selectedImages.length > 0 ? 'inline-block' : 'none';
}


async function bulkDeleteSelectedImages() {
    if (selectedImages.length === 0) {
        showNotification('Please select files to delete.', 'error');
        return;
    }

    if (!confirm(`Delete ${selectedImages.length} selected file(s)?`)) return;

    loadingOverlay.style.display = 'flex';

    try {
        const deletePromises = [];

        for (const imageId of selectedImages) {
            const imageDoc = allImages.find(item => item.doc.id === imageId);
            if (imageDoc) {
                const { data: imgData } = imageDoc;

                const imageTitlesSnapshot = await db.collection('image_titles')
                    .where('imageId', '==', imageId)
                    .get();

                let titleId = null;
                if (!imageTitlesSnapshot.empty) {
                    titleId = imageTitlesSnapshot.docs[0].data().titleId;
                }

                const apiKey = '131831462832194';
                const apiSecret = '0aMeGCztYAn09WkM_Y0ekYmLBPw';
                const timestamp = Math.floor(Date.now() / 1000);
                const signature = await generateSignature(imgData.publicId, timestamp, apiSecret);

                const formData = new FormData();
                formData.append('public_id', imgData.publicId);
                formData.append('api_key', apiKey);
                formData.append('timestamp', timestamp);
                formData.append('signature', signature);

                // Determine destroy endpoint based on file type
                const isVideo = imgData.type === 'video';
                const destroyEndpoint = isVideo ? 'video/destroy' : 'image/destroy';

                const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${destroyEndpoint}`, {
                    method: 'POST',
                    body: formData
                });

                if (cloudinaryResponse.ok) {
                    deletePromises.push(db.collection('images').doc(imageId).delete());

                    if (titleId) {
                        const imageTitleSnapshot = await db.collection('image_titles')
                            .where('imageId', '==', imageId)
                            .where('titleId', '==', titleId)
                            .get();

                        imageTitleSnapshot.forEach(doc => {
                            deletePromises.push(doc.ref.delete());
                        });
                    }
                }
            }
        }

        await Promise.all(deletePromises);

        showNotification(`${selectedImages.length} file(s) deleted successfully!`, 'success');

        selectedImages = [];
        bulkDeleteBtn.style.display = 'none';

        const currentFilter = searchInput.value;
        if (currentFilter) {
            loadImages(currentFilter);
        } else {
            imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
        }

    } catch (error) {
        console.error('Error deleting images:', error);
        showNotification('Error deleting images.', 'error');
    } finally {
        loadingOverlay.style.display = 'none';
    }
}


document.getElementById('prevPageBtn').addEventListener('click', goToPrevPage);
document.getElementById('nextPageBtn').addEventListener('click', goToNextPage);