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

const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');

const loadingOverlay = document.getElementById('loadingOverlay');

async function uploadImage() {
    const files = accumulatedFiles;
    const selectedTitle = titleSelect.value;
    if (files.length === 0) {
        showNotification('Please select at least one image.', 'error');
        return;
    }
    if (!selectedTitle) {
        showNotification('Please select a title for the images.', 'error');
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
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (response.ok && data.secure_url) {
                const imageRef = await db.collection('images').add({
                    url: data.secure_url,
                    publicId: data.public_id,
                    name: file.name,
                    uploadedAt: new Date()
                });
                const titleSnapshot = await db.collection('titles').where('name', '==', selectedTitle).get();
                if (!titleSnapshot.empty) {
                    const titleDoc = titleSnapshot.docs[0];
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
    loadImages(selectedTitle);
    populateTitles();
    clearAllFiles(true);
    if (successCount > 0) {
        showNotification(`${successCount} image(s) uploaded successfully!${errorCount > 0 ? ` ${errorCount} failed.` : ''}`, 'success');
    } else {
        showNotification('All uploads failed. Check console for details.', 'error');
    }
    loadingOverlay.style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Images';
}


async function loadImages(query = null) {
    imagesContainer.innerHTML = '<p>Loading images...</p>';
    try {
        let imageQuery;
        let imageIds = [];

        if (query) {
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
                imageQuery = db.collection('images').orderBy('uploadedAt', 'desc');
            } else {
                imagesContainer.innerHTML = '<p>No images found with this title.</p>';
                hidePagination();
                return;
            }
        } else {
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

        const img = document.createElement('img');
        img.src = imgData.url;
        img.alt = imgData.name;
        img.style.cursor = 'pointer';
        img.onclick = () => toggleImageSelection(imageDoc.id);

        let setThumbnailBtn = null;
        if (titleId) {
            setThumbnailBtn = document.createElement('button');
            setThumbnailBtn.textContent = 'Set Thumbnail';
            setThumbnailBtn.className = 'set-thumbnail-btn';
            setThumbnailBtn.style.display = 'block';
            setThumbnailBtn.style.margin = '10px auto 0';
            setThumbnailBtn.onclick = () => setThumbnailDirectly(imageDoc.id, titleId);
        }

        imgWrapper.appendChild(img);
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

            const img = document.createElement('img');
            img.src = e.target.result;

            const name = document.createElement('p');
            name.textContent = file.name;

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
    if (!confirm('Are you sure you want to delete this image?')) return;

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

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
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

            showNotification('Image deleted successfully!', 'success');

            const currentFilter = searchSelect.value;
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
            showNotification('Error deleting image: ' + (data.error ? data.error.message : 'Unknown error'), 'error');
        }

        loadingOverlay.style.display = 'none';
    } catch (error) {
        console.error('Error deleting image:', error);
        showNotification('Error deleting image.', 'error');
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

        searchSelect.innerHTML = '<option value="">Select title</option>';
        oldTitleSelect.innerHTML = '<option value="">Select old title</option>';
        titleSelect.innerHTML = '<option value="">Select title for upload</option>';

        if (snapshot.empty) {
            return;
        }

        snapshot.forEach(doc => {
            const titleData = doc.data();
            const titleName = titleData.name;

            const option1 = document.createElement('option');
            option1.value = titleName;
            option1.textContent = titleName;
            searchSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = titleName;
            option2.textContent = titleName;
            oldTitleSelect.appendChild(option2);

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


searchSelect.addEventListener('change', () => {
    const query = searchSelect.value;
    if (query) {
        loadImages(query);
    } else {
        imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
    }
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
        const titleSnapshot = await db.collection('titles').where('name', '==', oldTitle).get();

        if (!titleSnapshot.empty) {
            const titleDoc = titleSnapshot.docs[0];
            await titleDoc.ref.update({ name: newTitle });

            showNotification('Title updated successfully.', 'success');
            populateTitles();
            searchSelect.value = '';
            imagesContainer.innerHTML = '<p>Please select a title to view images.</p>';
            oldTitleSelect.value = '';
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
    const imgElement = imgWrapper ? imgWrapper.querySelector('img') : null;

    if (index > -1) {
        selectedImages.splice(index, 1);
        if (imgElement) {
            imgElement.style.border = '';
            imgElement.style.opacity = '';
        }
    } else {
        selectedImages.push(imageId);
        if (imgElement) {
            imgElement.style.border = '3px solid #dc3545';
            imgElement.style.opacity = '0.7';
        }
    }

    bulkDeleteBtn.style.display = selectedImages.length > 0 ? 'inline-block' : 'none';
}


async function bulkDeleteSelectedImages() {
    if (selectedImages.length === 0) {
        showNotification('Please select images to delete.', 'error');
        return;
    }

    if (!confirm(`Delete ${selectedImages.length} selected image(s)?`)) return;

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

                const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
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

        showNotification(`${selectedImages.length} image(s) deleted successfully!`, 'success');

        selectedImages = [];
        bulkDeleteBtn.style.display = 'none';

        const currentFilter = searchSelect.value;
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