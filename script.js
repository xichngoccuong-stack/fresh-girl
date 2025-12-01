// Firebase configuration - Replace with your actual Firebase project values
const firebaseConfig = {
    apiKey: "AIzaSyDVVRM2NJGXn_5XhzozETuYFAgmWvpW6ec",
    authDomain: "fresh-girl.firebaseapp.com",
    projectId: "fresh-girl",
    storageBucket: "fresh-girl.firebasestorage.app",
    messagingSenderId: "907721279776",
    appId: "1:907721279776:web:df4fe87ecd7d9b8d82af45"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Cloudinary configuration - Replace with your actual Cloudinary values
const cloudName = 'dwsljlcqr';
const uploadPreset = 'fresh-girl';

// DOM elements
const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const imagesContainer = document.getElementById('imagesContainer');
const uploadSpinner = document.getElementById('uploadSpinner');
const imagePreview = document.getElementById('imagePreview');
const titleInput = document.getElementById('titleInput');
const searchSelect = document.getElementById('searchSelect');
const openManageModalBtn = document.getElementById('openManageModalBtn');
const oldTitleSelect = document.getElementById('oldTitleSelect');
const newTitleInput = document.getElementById('newTitleInput');
const updateTitleBtn = document.getElementById('updateTitleBtn');
const titleSelect = document.getElementById('titleSelect');
const createTitleBtn = document.getElementById('createTitleBtn');
const imageModal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImg');
const closeImageModal = document.querySelector('#imageModal .close');
const manageModal = document.getElementById('manageModal');
const closeManageModal = document.getElementById('closeManageModal');

// Thumbnail modal elements
const thumbnailModal = document.getElementById('thumbnailModal');
const closeThumbnailModal = document.getElementById('closeThumbnailModal');
const thumbnailImagesContainer = document.getElementById('thumbnailImagesContainer');
const saveThumbnailBtn = document.getElementById('saveThumbnailBtn');
const removeThumbnailBtn = document.getElementById('removeThumbnailBtn');
const thumbnailTitleText = document.getElementById('thumbnailTitleText').querySelector('strong');

// Notification elements
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');

// Loading overlay elements
const loadingOverlay = document.getElementById('loadingOverlay');

// Function to upload image to Cloudinary and save metadata to Firebase
async function uploadImage() {
    const files = imageInput.files;
    const selectedTitle = titleSelect.value;

    if (files.length === 0) {
        showNotification('Please select at least one image.', 'error');
        return;
    }

    if (!selectedTitle) {
        showNotification('Please select a title for the images.', 'error');
        return;
    }

    // Show loading overlay and disable button
    loadingOverlay.style.display = 'flex';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    const uploadPromises = Array.from(files).map(async (file) => {
        try {
            // Prepare form data for Cloudinary upload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);

            // Upload to Cloudinary
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.secure_url) {
                // Save image metadata to Firebase Firestore
                const imageRef = await db.collection('images').add({
                    url: data.secure_url,
                    publicId: data.public_id,
                    name: file.name,
                    uploadedAt: new Date()
                });

                // Get title document ID
                const titleSnapshot = await db.collection('titles').where('name', '==', selectedTitle).get();
                if (!titleSnapshot.empty) {
                    const titleDoc = titleSnapshot.docs[0];

                    // Create image-title relationship
                    await db.collection('image_titles').add({
                        imageId: imageRef.id,
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
            console.error('Error uploading image', file.name, ':', error);
            return { success: false, name: file.name, error };
        }
    });

    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    // Reload images to display the new ones (show images for the uploaded title)
    loadImages(selectedTitle);
    // Update titles list
    populateTitles();
    // Clear the input and preview (keep title selection)
    imageInput.value = '';
    imagePreview.innerHTML = '';
    uploadBtn.style.display = 'none';

    // Show result
    if (successCount > 0) {
        showNotification(`${successCount} image(s) uploaded successfully!${errorCount > 0 ? ` ${errorCount} failed.` : ''}`, 'success');
    } else {
        showNotification('All uploads failed. Check console for details.', 'error');
    }

    // Hide loading overlay and enable button
    loadingOverlay.style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Images';
}

// Function to load and display images individually from Firebase with pagination
async function loadImages(query = null) {
    imagesContainer.innerHTML = '<p>Loading images...</p>';

    try {
        let imageQuery;
        let imageIds = []; // Initialize as empty array

        if (query) {
            // If filtering by title, get images for that specific title
            const titleSnapshot = await db.collection('titles').where('name', '==', query).get();
            if (!titleSnapshot.empty) {
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

                // Instead of using 'in' query with limit, we'll load all images and filter client-side
                // This allows us to show all images for a title without Firestore limitations
                imageQuery = db.collection('images').orderBy('uploadedAt', 'desc');
            } else {
                imagesContainer.innerHTML = '<p>No images found with this title.</p>';
                hidePagination();
                return;
            }
        } else {
            // Show message when no title is selected
            imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
            hidePagination();
            return;
        }

        const imagesSnapshot = await imageQuery.get();

        if (imagesSnapshot.empty) {
            imagesContainer.innerHTML = query ? '<p>No images found with this title.</p>' : '<p>No images uploaded yet.</p>';
            hidePagination();
            return;
        }

        // Collect all valid images first, then sort them by uploadedAt
        const validImages = [];

        for (const imageDoc of imagesSnapshot.docs) {
            const imgData = imageDoc.data();

            // For filtered queries, check if this image belongs to the selected title
            if (query) {
                const isImageInTitle = imageIds.includes(imageDoc.id);
                if (!isImageInTitle) {
                    continue; // Skip images that don't belong to the selected title
                }
            }

            validImages.push({ doc: imageDoc, data: imgData });
        }

        // Sort by uploadedAt descending (newest first)
        validImages.sort((a, b) => {
            const dateA = a.data.uploadedAt?.toDate?.() || new Date(a.data.uploadedAt);
            const dateB = b.data.uploadedAt?.toDate?.() || new Date(b.data.uploadedAt);
            return dateB - dateA; // Newest first
        });

        // Store all images for pagination
        allImages = validImages;
        totalImages = validImages.length;

        // Reset to first page when loading new images
        currentPage = 1;

        // Display current page
        displayImagesForPage(currentPage);

    } catch (error) {
        console.error('Error loading images:', error);
        imagesContainer.innerHTML = '<p>Error loading images.</p>';
        hidePagination();
    }
}

// Function to display images for a specific page
async function displayImagesForPage(page) {
    imagesContainer.innerHTML = ''; // Clear previous content

    if (allImages.length === 0) {
        imagesContainer.innerHTML = '<p>No images to display.</p>';
        hidePagination();
        return;
    }

    const totalPages = Math.ceil(totalImages / imagesPerPage);
    const startIndex = (page - 1) * imagesPerPage;
    const endIndex = Math.min(startIndex + imagesPerPage, totalImages);

    // Display images for current page
    for (let i = startIndex; i < endIndex; i++) {
        const { doc: imageDoc, data: imgData } = allImages[i];

        // Get title information for delete function
        const imageTitlesSnapshot = await db.collection('image_titles')
            .where('imageId', '==', imageDoc.id)
            .get();

        let titleId = null;
        if (!imageTitlesSnapshot.empty) {
            titleId = imageTitlesSnapshot.docs[0].data().titleId;
        }

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-item';

        const img = document.createElement('img');
        img.src = imgData.url;
        img.alt = imgData.name;
        img.style.cursor = 'pointer';
        img.onclick = () => openModal(imgData.url);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Del';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => deleteImage(imageDoc.id, imgData.publicId, titleId);

        // Add set thumbnail button if we have titleId
        let setThumbnailBtn = null;
        if (titleId) {
            setThumbnailBtn = document.createElement('button');
            setThumbnailBtn.textContent = 'Set Thumbnail';
            setThumbnailBtn.className = 'set-thumbnail-btn';
            setThumbnailBtn.onclick = async () => {
                // Get title name
                const titleDoc = await db.collection('titles').doc(titleId).get();
                if (titleDoc.exists) {
                    const titleName = titleDoc.data().name;
                    openThumbnailModal(titleId, titleName);
                }
            };
        }

        imgWrapper.appendChild(img);
        if (setThumbnailBtn) {
            imgWrapper.appendChild(setThumbnailBtn);
        }
        imgWrapper.appendChild(deleteBtn);
        imagesContainer.appendChild(imgWrapper);
    }

    // Update pagination UI
    updatePaginationUI(page, totalPages);
}

// Function to update pagination UI
function updatePaginationUI(currentPage, totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (totalPages <= 1) {
        hidePagination();
        return;
    }

    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalImages} images)`;

    // Enable/disable buttons
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    // Show pagination
    paginationContainer.style.display = 'flex';
}

// Function to hide pagination
function hidePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }
}

// Function to go to previous page
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayImagesForPage(currentPage);
    }
}

// Function to go to next page
function goToNextPage() {
    const totalPages = Math.ceil(totalImages / imagesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayImagesForPage(currentPage);
    }
}

// Function to display image previews with remove functionality
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

            const img = document.createElement('img');
            img.src = e.target.result;

            const name = document.createElement('p');
            name.textContent = file.name;

            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'remove-preview-btn';
            removeBtn.title = 'Remove this image';
            removeBtn.onclick = () => removePreviewItem(index);

            previewItem.appendChild(img);
            previewItem.appendChild(name);
            previewItem.appendChild(removeBtn);
            imagePreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    uploadBtn.style.display = files.length > 0 ? 'inline-block' : 'none';
}

// Function to remove a preview item and update the file input
function removePreviewItem(indexToRemove) {
    const dt = new DataTransfer();
    const files = Array.from(imageInput.files);

    // Add all files except the one to remove
    files.forEach((file, index) => {
        if (index !== indexToRemove) {
            dt.items.add(file);
        }
    });

    // Update the file input with the new file list
    imageInput.files = dt.files;

    // Refresh the preview display
    displayPreviews(imageInput.files);
}

// Event listener for file input change
imageInput.addEventListener('change', (e) => {
    displayPreviews(e.target.files);
});

// Event listener for upload button
uploadBtn.addEventListener('click', uploadImage);

// Function to delete image from Cloudinary and Firebase
async function deleteImage(docId, publicId, titleId) {
    if (!confirm('Are you sure you want to delete this image?')) return;

    // Show loading overlay
    loadingOverlay.style.display = 'flex';

    // Note: Deleting from Cloudinary requires API key and secret, which should not be exposed in client-side code.
    // For security, this should be done server-side. For demo purposes, replace with your API credentials.
    const apiKey = '131831462832194';
    const apiSecret = '0aMeGCztYAn09WkM_Y0ekYmLBPw';

    // Note: In production, do not expose API keys in client-side code

    // Generate timestamp and signature for Cloudinary delete
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(publicId, timestamp, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.result === 'ok') {
            // Delete from Firebase
            await db.collection('images').doc(docId).delete();

            // Also delete the image-title relationship
            const imageTitleSnapshot = await db.collection('image_titles')
                .where('imageId', '==', docId)
                .where('titleId', '==', titleId)
                .get();

            const deletePromises = [];
            imageTitleSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            await Promise.all(deletePromises);

            showNotification('Image deleted successfully!', 'success');
            // Preserve current filter state and page
            const currentFilter = searchSelect.value;
            if (currentFilter) {
                // Remove the deleted image from allImages array
                allImages = allImages.filter(item => item.doc.id !== docId);
                totalImages = allImages.length;

                // If we're on a page that no longer exists, go to the last page
                const totalPages = Math.ceil(totalImages / imagesPerPage);
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                }

                // Reload current page
                if (totalImages > 0) {
                    displayImagesForPage(currentPage);
                } else {
                    loadImages(currentFilter); // Reload to show "no images" message
                }
            } else {
                imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
            }
        } else {
            showNotification('Error deleting image: ' + (data.error ? data.error.message : 'Unknown error'), 'error');
        }

        // Hide loading overlay
        loadingOverlay.style.display = 'none';
    } catch (error) {
        console.error('Error deleting image:', error);
        showNotification('Error deleting image.', 'error');
        // Hide loading overlay
        loadingOverlay.style.display = 'none';
    }
}

// Helper function to generate Cloudinary signature
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
        // Fallback for environments where crypto.subtle is not available
        console.warn('crypto.subtle not available, using fallback signature generation');
        // For demo purposes, return a simple hash-like string
        // In production, this should be done server-side
        const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
}

// Function to populate search select with titles from titles collection
async function populateTitles() {
    try {
        const snapshot = await db.collection('titles').orderBy('createdAt', 'desc').get();

        searchSelect.innerHTML = '<option value="">Select title</option>';
        oldTitleSelect.innerHTML = '<option value="">Select old title</option>';
        titleSelect.innerHTML = '<option value="">Select title for upload</option>';

        if (snapshot.empty) {
            return;
        }

        snapshot.forEach(doc => {
            const titleData = doc.data();
            const titleName = titleData.name;

            // For search dropdown
            const option1 = document.createElement('option');
            option1.value = titleName;
            option1.textContent = titleName;
            searchSelect.appendChild(option1);

            // For management dropdown
            const option2 = document.createElement('option');
            option2.value = titleName;
            option2.textContent = titleName;
            oldTitleSelect.appendChild(option2);

            // For upload dropdown
            const option3 = document.createElement('option');
            option3.value = titleName;
            option3.textContent = titleName;
            titleSelect.appendChild(option3);
        });

    } catch (error) {
        console.error('Error loading titles:', error);
        showNotification('Error loading titles: ' + error.message, 'error');
    }
}

// Event listeners
searchSelect.addEventListener('change', () => {
    const query = searchSelect.value;
    if (query) {
        loadImages(query); // Load images for specific title
    } else {
        imagesContainer.innerHTML = '<p>Please select a title to view images.</p>'; // Show message when no title selected
    }
});



// Manage modal
openManageModalBtn.addEventListener('click', () => {
    manageModal.style.display = 'block';
    populateTitles(); // Refresh titles in modal
});

closeManageModal.addEventListener('click', () => {
    manageModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === manageModal) {
        manageModal.style.display = 'none';
    }
});

// Function to update title
updateTitleBtn.addEventListener('click', async () => {
    const oldTitle = oldTitleSelect.value;
    const newTitle = newTitleInput.value.trim();

    if (!oldTitle) {
        showNotification('Please select the old title.', 'error');
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
        // Find the title document and update it
        const titleSnapshot = await db.collection('titles').where('name', '==', oldTitle).get();

        if (!titleSnapshot.empty) {
            const titleDoc = titleSnapshot.docs[0];
            await titleDoc.ref.update({ name: newTitle });

            showNotification('Title updated successfully.', 'success');
            // Refresh
            populateTitles();
            // Clear search selection and show message
            searchSelect.value = '';
            imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
            // Clear
            oldTitleSelect.value = '';
            newTitleInput.value = '';
            // Close modal
            manageModal.style.display = 'none';
        } else {
            showNotification('Title not found.', 'error');
        }
    } catch (error) {
        console.error('Error updating title:', error);
        showNotification('Error updating title.', 'error');
    }
});

// Function to open modal with full image
function openModal(src) {
    modalImg.src = src;
    imageModal.style.display = 'block';
}

// Function to close modal
function closeModalFunc() {
    imageModal.style.display = 'none';
}

// Event listeners for image modal
closeImageModal.addEventListener('click', closeModalFunc);

window.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        closeModalFunc();
    }
});

// Create new title functionality
createTitleBtn.addEventListener('click', async () => {
    const newTitleName = prompt('Enter new title name:');
    if (!newTitleName || !newTitleName.trim()) {
        return;
    }

    const trimmedTitle = newTitleName.trim();

    try {
        // Check if title already exists
        const existingTitle = await db.collection('titles').where('name', '==', trimmedTitle).get();
        if (!existingTitle.empty) {
            showNotification('Title already exists!', 'error');
            return;
        }

        // Create new title
        await db.collection('titles').add({
            name: trimmedTitle,
            createdAt: new Date()
        });

        showNotification('Title created successfully!', 'success');
        populateTitles(); // Refresh dropdowns
    } catch (error) {
        console.error('Error creating title:', error);
        showNotification('Error creating title.', 'error');
    }
});

// Notification functions
function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'flex';

    // Auto-hide after 3 seconds
    setTimeout(() => {
        hideNotification();
    }, 3000);
}

function hideNotification() {
    notification.style.display = 'none';
}

// Load titles on page load
window.addEventListener('load', populateTitles);

// Global variables for thumbnail functionality
let currentThumbnailTitleId = null;
let selectedThumbnailImageId = null;

// Pagination variables
let currentPage = 1;
const imagesPerPage = 20;
let totalImages = 0;
let allImages = []; // Store all images for pagination

// Function to open thumbnail modal for a specific title
async function openThumbnailModal(titleId, titleName) {
    currentThumbnailTitleId = titleId;
    thumbnailTitleText.textContent = titleName;
    thumbnailModal.style.display = 'block';

    // Load images for this title
    await loadThumbnailImages(titleId);
}

// Function to load images for thumbnail selection
async function loadThumbnailImages(titleId) {
    thumbnailImagesContainer.innerHTML = '<p>Loading images...</p>';

    try {
        // Get current thumbnail for this title
        const currentThumbnailSnapshot = await db.collection('title_thumbnails')
            .where('titleId', '==', titleId)
            .get();

        let currentThumbnailImageId = null;
        if (!currentThumbnailSnapshot.empty) {
            currentThumbnailImageId = currentThumbnailSnapshot.docs[0].data().imageId;
        }

        // Get all images for this title
        const imageTitlesSnapshot = await db.collection('image_titles')
            .where('titleId', '==', titleId)
            .get();

        if (imageTitlesSnapshot.empty) {
            thumbnailImagesContainer.innerHTML = '<p>No images found for this title.</p>';
            return;
        }

        thumbnailImagesContainer.innerHTML = '';

        for (const imageTitleDoc of imageTitlesSnapshot.docs) {
            const imageDoc = await db.collection('images').doc(imageTitleDoc.data().imageId).get();

            if (imageDoc.exists) {
                const imgData = imageDoc.data();

                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = 'thumbnail-image-item';
                if (currentThumbnailImageId === imageDoc.id) {
                    thumbnailItem.classList.add('selected');
                }

                const img = document.createElement('img');
                img.src = imgData.url;
                img.alt = imgData.name;

                thumbnailItem.appendChild(img);
                thumbnailItem.onclick = () => selectThumbnailImage(imageDoc.id, thumbnailItem);

                thumbnailImagesContainer.appendChild(thumbnailItem);
            }
        }

    } catch (error) {
        console.error('Error loading thumbnail images:', error);
        thumbnailImagesContainer.innerHTML = '<p>Error loading images.</p>';
    }
}

// Function to select thumbnail image
function selectThumbnailImage(imageId, element) {
    // Remove selected class from all items
    document.querySelectorAll('.thumbnail-image-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selected class to clicked item
    element.classList.add('selected');
    selectedThumbnailImageId = imageId;
}

// Function to save thumbnail
async function saveThumbnail() {
    if (!currentThumbnailTitleId || !selectedThumbnailImageId) {
        showNotification('Please select an image first.', 'error');
        return;
    }

    try {
        // Remove existing thumbnail for this title
        const existingThumbnailSnapshot = await db.collection('title_thumbnails')
            .where('titleId', '==', currentThumbnailTitleId)
            .get();

        const deletePromises = [];
        existingThumbnailSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);

        // Add new thumbnail
        await db.collection('title_thumbnails').add({
            titleId: currentThumbnailTitleId,
            imageId: selectedThumbnailImageId,
            createdAt: new Date()
        });

        showNotification('Thumbnail set successfully!', 'success');
        thumbnailModal.style.display = 'none';

    } catch (error) {
        console.error('Error saving thumbnail:', error);
        showNotification('Error saving thumbnail.', 'error');
    }
}

// Function to remove thumbnail
async function removeThumbnail() {
    if (!currentThumbnailTitleId) return;

    try {
        const existingThumbnailSnapshot = await db.collection('title_thumbnails')
            .where('titleId', '==', currentThumbnailTitleId)
            .get();

        const deletePromises = [];
        existingThumbnailSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);

        showNotification('Thumbnail removed successfully!', 'success');
        thumbnailModal.style.display = 'none';

    } catch (error) {
        console.error('Error removing thumbnail:', error);
        showNotification('Error removing thumbnail.', 'error');
    }
}

// Pagination event listeners
document.getElementById('prevPageBtn').addEventListener('click', goToPrevPage);
document.getElementById('nextPageBtn').addEventListener('click', goToNextPage);

// Event listeners for thumbnail modal
closeThumbnailModal.addEventListener('click', () => {
    thumbnailModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === thumbnailModal) {
        thumbnailModal.style.display = 'none';
    }
});

saveThumbnailBtn.addEventListener('click', saveThumbnail);
removeThumbnailBtn.addEventListener('click', removeThumbnail);