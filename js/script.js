// js/script.js
const video = document.getElementById('videoElement');
const takePhotoButton = document.getElementById('takePhotoButton');
const processPythonButton = document.getElementById('processPythonButton'); 
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const messageDiv = document.getElementById('message');
const cameraOverlayContainer = document.querySelector('.camera-overlay-container');
const bannerContainer = document.getElementById('bannerContainer');

const appOverlayImage = document.getElementById('appOverlayImage'); 
const overlaySelect = document.getElementById('overlaySelect'); 

const thumbnailsContainer = document.getElementById('thumbnailsContainer');
// REINTRODUCIDO: Botón para borrar seleccionadas
const deleteSelectedPhotosButton = document.getElementById('deleteSelectedPhotosButton'); 
const deleteAllPhotosButton = document.getElementById('deleteAllPhotosButton'); 
const downloadZipButton = document.getElementById('downloadZipButton');
const zipFileNameInput = document.getElementById('zipFileName');

const fullscreenPhotoView = document.getElementById('fullscreenPhotoView');
const fullscreenImage = document.getElementById('fullscreenImage');
const backButton = document.getElementById('backButton');

// Estos elementos no se usarán por ahora, pero se mantienen por si se retoma Python
const ocrResultsContainer = document.getElementById('ocrResultsContainer');
const ocrExtractedData = document.getElementById('ocrExtractedData');
const ocrQrImage = document.getElementById('ocrQrImage');
const closeOcrResults = document.getElementById('closeOcrResults');

let photos = []; // Array para almacenar {url: string, name: string} de las fotos
let selectedPhotoIndexes = []; // Array para índices de fotos seleccionadas (para borrar o ZIP)
let clickTimer = null; 
const DBLCLICK_THRESHOLD = 300; 

const LOCAL_STORAGE_KEY = 'camera_app_photos'; 
const LOCAL_STORAGE_OVERLAY_KEY = 'camera_app_selected_overlay'; 

// URL de tu servidor Flask (comentado ya que no se usa ahora mismo)
// const PYTHON_BACKEND_URL = 'http://127.0.0.1:5000/process_image'; 

// --- Funciones de la Cámara ---
let currentStream; 

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    messageDiv.textContent = 'Solicitando acceso a la cámara...';
    try {
        const constraints = {
            video: {
                video: true 
                //facingMode: "environment" 
                //facingMode: { exact: "environment" } 
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream; 
        video.srcObject = stream;
        messageDiv.textContent = 'Cámara activada.';
        cameraOverlayContainer.style.display = 'flex';
        takePhotoButton.style.display = 'block';
        // processPythonButton.style.display = 'block'; // Quitar esto para ocultarlo por ahora

        video.addEventListener('loadedmetadata', () => {
            if (video.videoWidth && video.videoHeight) {
                cameraOverlayContainer.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
            }
        });

    } catch (err) {
        console.error('Error al acceder a la cámara: ', err);
        if (err.name === 'NotAllowedError') {
            messageDiv.innerHTML = 'Acceso a la cámara denegado. Por favor, concede permiso en la configuración de tu navegador.<br>Para iPhone, ve a "Configuración" > "Safari" (o el navegador que uses) > "Cámara" y asegúrate de que esté permitido el acceso.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            messageDiv.textContent = 'No se encontró ninguna cámara. Asegúrate de que tu dispositivo tenga una cámara y que esté conectada.';
        } else if (err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
            messageDiv.textContent = 'La cámara no está disponible o está siendo utilizada por otra aplicación.';
        } else {
            messageDiv.textContent = 'Error desconocido al iniciar la cámara. Inténtalo de nuevo.';
        }
        cameraOverlayContainer.style.display = 'none';
        takePhotoButton.style.display = 'none';
        // processPythonButton.style.display = 'none'; // Ocultar si no hay cámara
    }
}

// Función para capturar la imagen del video con el overlay
function captureFrameWithOverlay() {
    if (!video.srcObject) {
        messageDiv.textContent = 'La cámara no está activa.';
        return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (appOverlayImage.style.display !== 'none' && appOverlayImage.complete) {
        context.drawImage(appOverlayImage, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/png');
}

takePhotoButton.addEventListener('click', () => {
    const photoURL = captureFrameWithOverlay();
    if (photoURL) {
        const selectedOptionText = overlaySelect.options[overlaySelect.selectedIndex].text
                                    .replace(/--- /g, '') // Eliminar "--- " inicial
                                    .replace(/ ---/g, '') // Eliminar " ---" final
                                    .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
                                    .replace(/[^a-zA-Z0-9_.-]/g, '') // Eliminar caracteres no seguros (excepto _, ., -)
                                    .toLowerCase(); // Convertir a minúsculas

        // Generar un timestamp para asegurar la unicidad de cada foto
        const timestamp = new Date().toISOString().replace(/[:.-]/g, ''); 
        
        // Formato final del nombre de la foto. Puedes cambiar "foto_" o "_png"
        const photoName = `foto_${cleanedFilterName}_${timestamp}.png`;

        addPhotoToGallery({ url: photoURL, name: "foto_" + new Date().toISOString() + ".png" });
    }
});

// Este botón se mantiene oculto por ahora
/*
processPythonButton.addEventListener('click', async () => {
    const photoURL = captureFrameWithOverlay();
    if (!photoURL) return;

    messageDiv.textContent = 'Enviando imagen a Python para procesamiento...';
    processPythonButton.disabled = true; // Deshabilitar el botón mientras procesa

    try {
        const response = await fetch(PYTHON_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_b64: photoURL }), // Enviar la imagen Base64
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.textContent = 'Procesamiento exitoso.';
            console.log('Datos extraídos:', result.extracted_data);
            console.log('QR Base64:', result.qr_image_b64);

            // Mostrar los resultados en el contenedor dedicado
            ocrExtractedData.textContent = JSON.stringify(result.extracted_data, null, 2);
            ocrQrImage.src = `data:image/png;base64,${result.qr_image_b64}`;
            
            // Ocultar la cámara y galería, mostrar resultados
            cameraOverlayContainer.style.display = 'none';
            takePhotoButton.style.display = 'none';
            processPythonButton.style.display = 'none';
            document.querySelector('.gallery-section').style.display = 'none';
            document.querySelector('.camera-controls').style.display = 'none';
            bannerContainer.style.display = 'none';
            ocrResultsContainer.style.display = 'flex'; // Mostrar contenedor de resultados

        } else {
            messageDiv.textContent = `Error en el procesamiento: ${result.error || 'Desconocido'}`;
            console.error('Error del backend:', result.error);
        }
    } catch (error) {
        messageDiv.textContent = 'Error al conectar con el servidor Python. Asegúrate de que esté ejecutándose.';
        console.error('Error de red o del servidor:', error);
    } finally {
        processPythonButton.disabled = false; // Re-habilitar el botón
    }
});

closeOcrResults.addEventListener('click', () => {
    ocrResultsContainer.style.display = 'none';
    cameraOverlayContainer.style.display = 'flex';
    takePhotoButton.style.display = 'block';
    processPythonButton.style.display = 'block';
    document.querySelector('.gallery-section').style.display = 'block';
    document.querySelector('.camera-controls').style.display = 'flex';
    bannerContainer.style.display = 'flex';
    messageDiv.textContent = 'Cámara activada.'; // Restaurar mensaje
});
*/


// --- Funciones de Galería y persistencia ---
function savePhotosToLocalStorage() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(photos));
}

function loadPhotosFromLocalStorage() {
    const storedPhotos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedPhotos) {
        photos = JSON.parse(storedPhotos);
    } else {
        photos = [];
    }
    renderThumbnails(); 
}

function saveSelectedOverlay() {
    localStorage.setItem(LOCAL_STORAGE_OVERLAY_KEY, overlaySelect.value);
}

function loadSelectedOverlay() {
    const storedOverlay = localStorage.getItem(LOCAL_STORAGE_OVERLAY_KEY);
    if (storedOverlay !== null) {
        overlaySelect.value = storedOverlay;
        applySelectedOverlay(); 
    } else {
        // Si no hay selección guardada, esta es la opción por defecto.
        overlaySelect.value = "assets/images/image_f2b0cc.png"; // Cambiar a la ruta relativa
        applySelectedOverlay(); 
    }
}

function addPhotoToGallery(photoData) { 
    photos.push(photoData);
    savePhotosToLocalStorage(); 
    renderThumbnails();
    messageDiv.textContent = `Foto ${photos.length} tomada y añadida a la galería.`;
    const newThumbnail = document.createElement('div');
    newThumbnail.classList.add('thumbnail');
    newThumbnail.dataset.originalName = photo.name; // <--- Importante que uses photo.name aquí

}

function renderThumbnails() {
    thumbnailsContainer.innerHTML = ''; 
    photos.forEach((photoData, index) => { 
        // Asegurarse de que photoData no sea null (por si se eliminó una foto)
        if (!photoData || !photoData.url) return; 

        const img = document.createElement('img');
        img.src = photoData.url; 
        img.classList.add('thumbnail-item');
        img.dataset.index = index; 
        
        // Aplicar clase 'selected' si está en el array de seleccionadas
        if (selectedPhotoIndexes.includes(index)) {
            img.classList.add('selected');
        }

        img.addEventListener('click', (event) => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                return; 
            }
            clickTimer = setTimeout(() => {
                togglePhotoSelection(index);
                updateButtonsState();
                clickTimer = null;
            }, DBLCLICK_THRESHOLD);
        });

        img.addEventListener('dblclick', (event) => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            viewPhotoAtIndex(index);
        });

        thumbnailsContainer.appendChild(img);
    });
    updateButtonsState(); 
}

function togglePhotoSelection(index) {
    const idxInSelected = selectedPhotoIndexes.indexOf(index);
    if (idxInSelected > -1) {
        selectedPhotoIndexes.splice(idxInSelected, 1);
    } else {
        selectedPhotoIndexes.push(index);
    }
    renderThumbnails(); // Para actualizar los bordes de selección
}

// FUNCIÓN RESTAURADA: Borrar Fotos Seleccionadas
async function deleteSelectedPhotos() {
    if (selectedPhotoIndexes.length === 0) {
        messageDiv.textContent = 'No hay fotos seleccionadas para borrar.';
        return;
    }

    const confirmDelete = confirm(`¿Estás seguro de que quieres borrar ${selectedPhotoIndexes.length} foto(s) seleccionada(s)?`);
    if (confirmDelete) {
        // Ordenar los índices de mayor a menor para evitar problemas al eliminar elementos del array
        selectedPhotoIndexes.sort((a, b) => b - a); 
        
        selectedPhotoIndexes.forEach(index => {
            if (index < photos.length) {
                // Marcar como null en lugar de eliminar directamente para no cambiar los índices de los elementos restantes en esta iteración
                photos[index] = null; 
            }
        });

        // Filtrar los elementos null para reconstruir el array
        photos = photos.filter(photo => photo !== null);

        selectedPhotoIndexes = []; // Limpiar las selecciones después de borrar
        savePhotosToLocalStorage(); 
        
        // Reiniciar la cámara y re-renderizar para reflejar los cambios
        await startCamera(); 
        renderThumbnails(); 
        messageDiv.textContent = `Foto(s) borrada(s) y cámara reiniciada.`;
    }
}

// FUNCIÓN: Borrar todas las fotos
async function deleteAllPhotos() {
    if (photos.length === 0) {
        messageDiv.textContent = 'No hay fotos para borrar.';
        return;
    }

    const confirmDelete = confirm(`¿Estás seguro de que quieres borrar TODAS las ${photos.length} fotos? Esta acción no se puede deshacer.`);
    if (confirmDelete) {
        photos = []; // Vacía el array de fotos
        selectedPhotoIndexes = []; // Vacía las selecciones
        savePhotosToLocalStorage(); // Guarda el estado vacío en Local Storage
        
        await startCamera(); // Opcional: reiniciar la cámara
        renderThumbnails(); // Re-renderiza la galería (ahora vacía)
        messageDiv.textContent = `Todas las fotos han sido borradas y la cámara reiniciada.`;
    }
}
        
function viewPhotoAtIndex(index) {
    if (index !== -1 && index < photos.length && photos[index] !== null) { 
        fullscreenImage.src = photos[index].url; 
        fullscreenPhotoView.style.display = 'flex';
        cameraOverlayContainer.style.display = 'none';
        takePhotoButton.style.display = 'none';
        processPythonButton.style.display = 'none'; // Ocultar el botón de Python
        document.querySelector('.gallery-section').style.display = 'none';
        document.querySelector('.camera-controls').style.display = 'none'; 
        bannerContainer.style.display = 'none'; 
    } else {
        messageDiv.textContent = 'No se encontró la foto para ver.';
    }
}
            
function hideFullscreenPhotoView() {
    fullscreenPhotoView.style.display = 'none';
    cameraOverlayContainer.style.display = 'flex';
    takePhotoButton.style.display = 'block';
    // processPythonButton.style.display = 'block'; // Mostrar el botón de Python si lo tenías activo
    document.querySelector('.gallery-section').style.display = 'block';
    document.querySelector('.camera-controls').style.display = 'flex'; 
    bannerContainer.style.display = 'flex'; 
}

function updateButtonsState() {
    const hasPhotos = photos.length > 0;
    const hasSelectedPhotos = selectedPhotoIndexes.length > 0;

    // Habilitar/deshabilitar los botones de la galería
    deleteSelectedPhotosButton.disabled = !hasSelectedPhotos;
    deleteAllPhotosButton.disabled = !hasPhotos;
    downloadZipButton.disabled = !hasSelectedPhotos; 
}

// --- Funciones de Descarga ZIP ---
async function downloadSelectedPhotosAsZip() {
    if (selectedPhotoIndexes.length === 0) {
        messageDiv.textContent = 'No hay fotos seleccionadas para descargar.';
        return;
    }

    let zipName = zipFileNameInput.value.trim();
    if (zipName === '') {
        zipName = 'fotos_seleccionadas';
    }
    zipName = zipName.replace(/[^a-zA-Z0-9_.-]/g, '_'); 
    zipName += '.zip';

    messageDiv.textContent = `Preparando ZIP de ${selectedPhotoIndexes.length} foto(s) seleccionada(s)... Esto puede tomar un momento.`;
    const zip = new JSZip();
    
    let photoCounter = 0;
    // Iterar sobre los índices seleccionados, no sobre el array `photos` directamente
    for (const index of selectedPhotoIndexes) {
        // Asegurarse de que la foto exista y no sea null (por si se borró de otra forma)
        if (index < photos.length && photos[index] !== null) { 
            photoCounter++;
            const photoData = photos[index]; 
            const base64Data = photoData.url.split(',')[1];
            const blob = base64ToBlob(base64Data, 'image/png');
            // Usamos el nombre almacenado en photoData.name para el archivo individual
            zip.file(photoData.name, blob); 
        }
    }

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, zipName); 
        messageDiv.textContent = `ZIP con ${selectedPhotoIndexes.length} foto(s) descargado como "${zipName}".`;
    } catch (error) {
        messageDiv.textContent = 'Error al generar el archivo ZIP.';
        console.error('Error al generar ZIP:', error);
    }
}

// Función auxiliar para convertir Base64 a Blob (necesario para JSZip y FileSaver)
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
}

// --- Event Listeners ---
overlaySelect.addEventListener('change', (event) => {
    applySelectedOverlay();
    saveSelectedOverlay(); 
});

function applySelectedOverlay() {
    const selectedValue = overlaySelect.value;
    if (selectedValue) {
        appOverlayImage.src = selectedValue;
        appOverlayImage.style.display = 'block';
    } else {
        appOverlayImage.style.display = 'none';
        appOverlayImage.src = ''; // Limpiar src para evitar intentos de carga
    }
}

deleteSelectedPhotosButton.addEventListener('click', deleteSelectedPhotos);
deleteAllPhotosButton.addEventListener('click', deleteAllPhotos);
downloadZipButton.addEventListener('click', downloadSelectedPhotosAsZip);
backButton.addEventListener('click', hideFullscreenPhotoView);


// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    startCamera();
    loadPhotosFromLocalStorage();
    loadSelectedOverlay(); // Cargar la selección de overlay al inicio
    updateButtonsState(); // Actualizar el estado de los botones al cargar
});
