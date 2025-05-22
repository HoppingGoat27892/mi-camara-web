console.log("script.js cargado e iniciando.");

// === Elementos del DOM ===
const video = document.getElementById('videoElement');
const appOverlayImage = document.getElementById('appOverlayImage');
const overlaySelect = document.getElementById('overlaySelect');
const takePhotoButton = document.getElementById('takePhotoButton');
// --- Modificación aquí: hacer visible el botón ---
const processPythonButton = document.getElementById('processPythonButton'); 
// --------------------------------------------------
const canvas = document.getElementById('canvas');
const messageElement = document.getElementById('message');
const thumbnailsContainer = document.getElementById('thumbnailsContainer');
const deleteSelectedPhotosButton = document.getElementById('deleteSelectedPhotosButton');
const deleteAllPhotosButton = document.getElementById('deleteAllPhotosButton');
const downloadZipButton = document.getElementById('downloadZipButton');
const zipFileNameInput = document.getElementById('zipFileName');
const fullscreenPhotoView = document.getElementById('fullscreenPhotoView');
const fullscreenImage = document.getElementById('fullscreenImage');
const backButton = document.getElementById('backButton');
const ocrResultsContainer = document.getElementById('ocrResultsContainer');
const ocrExtractedData = document.getElementById('ocrExtractedData');
const ocrQrImage = document.getElementById('ocrQrImage');
const closeOcrResultsButton = document.getElementById('closeOcrResults');

// === Variables Globales ===
let currentStream;
let capturedPhotos = [];
const LOCAL_STORAGE_KEY = 'capturedPhotos';
const LOCAL_STORAGE_OVERLAY_KEY = 'selectedOverlay';

// === Funciones de la Cámara ===

async function startCamera() {
    // ... (Mantén tu código actual de startCamera, no necesita cambios) ...
    console.log("startCamera() llamada.");
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const constraints = {
            video: {
                facingMode: "environment" // <-- Intenta cámara trasera primero
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        video.play(); // Asegúrate de que el video se reproduzca
        console.log("Cámara iniciada con éxito.");
        messageElement.textContent = ''; // Limpiar mensajes de error anteriores

        // === Lógica de rotación de video para móvil ===
        video.onloadedmetadata = () => {
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            const { width, height, facingMode } = settings;
            console.log(`Video metadata: ${width}x${height}, Facing Mode: ${facingMode}`);

            if (width > height && window.innerHeight > window.innerWidth) {
                console.log("Detectado video horizontal en modo retrato del dispositivo. Aplicando rotación 90deg.");
                video.style.transform = 'rotate(90deg)';
                if (facingMode === 'user') {
                    video.style.transform += ' scaleX(-1)';
                }
            } else if (width < height && window.innerWidth > window.innerHeight) {
                console.log("Detectado video vertical en modo paisaje del dispositivo. Aplicando rotación -90deg.");
                video.style.transform = 'rotate(-90deg)';
                if (facingMode === 'user') {
                    video.style.transform += ' scaleX(-1)';
                }
            } else {
                console.log("Video y dispositivo en la misma orientación. Sin rotación.");
                video.style.transform = 'none';
                if (facingMode === 'user') {
                    video.style.transform = 'scaleX(-1)';
                }
            }
            appOverlayImage.style.transform = video.style.transform;
        };


    } catch (err) {
        console.error('Error al acceder a la cámara: ', err);
        messageElement.textContent = `Error al acceder a la cámara: ${err.name}. Asegúrate de permitir el acceso.`;
        if (err.name === 'OverconstrainedError') {
            messageElement.textContent += " Es posible que tu dispositivo no tenga la cámara trasera o que las restricciones sean demasiado estrictas. Intentando con cámara por defecto.";
            try {
                const relaxedConstraints = { video: true };
                const stream = await navigator.mediaDevices.getUserMedia(relaxedConstraints);
                currentStream = stream;
                video.srcObject = stream;
                video.play();
                console.log("Cámara iniciada con restricciones relajadas.");
                messageElement.textContent = 'Cámara iniciada con éxito (usando cámara predeterminada).';
                
                video.onloadedmetadata = () => {
                    const videoTrack = stream.getVideoTracks()[0];
                    const settings = videoTrack.getSettings();
                    if (settings.facingMode === 'user') {
                        console.log("Cámara frontal detectada, aplicando volteo horizontal.");
                        video.style.transform = 'scaleX(-1)';
                        appOverlayImage.style.transform = 'scaleX(-1)';
                    } else {
                        video.style.transform = 'none';
                        appOverlayImage.style.transform = 'none';
                    }
                };

            } catch (relaxedErr) {
                console.error('Error al acceder a la cámara con restricciones relajadas: ', relaxedErr);
                messageElement.textContent = `Error al acceder a la cámara: ${relaxedErr.name}. No se pudo iniciar la cámara.`;
            }
        }
        console.log("Fallo al iniciar la cámara.");
    }
}


function captureFrameWithOverlay() {
    // ... (Mantén tu código actual de captureFrameWithOverlay, ya lo modificamos para no incluir el overlay) ...
    console.log("captureFrameWithOverlay() llamada.");
    if (!video.srcObject) {
        console.log("Error: video.srcObject es null, la cámara no está activa.");
        messageElement.textContent = "Error: La cámara no está activa. Recarga la página o verifica permisos.";
        return null;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const context = canvas.getContext('2d');

    context.save(); 
    const transform = video.style.transform;
    if (transform.includes('rotate(90deg)')) {
        context.translate(canvas.width, 0);
        context.rotate(Math.PI / 2);
    } else if (transform.includes('rotate(-90deg)')) {
        context.translate(0, canvas.height);
        context.rotate(-Math.PI / 2);
    }
    if (transform.includes('scaleX(-1)')) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, videoWidth, videoHeight);
    context.restore();

    const photoURL = canvas.toDataURL('image/png');
    console.log("URL de foto capturada generada.");
    return photoURL;
}

// === Funciones de Galería y Guardado ===
// ... (Mantén todas estas funciones como están) ...
function addPhotoToGallery(photo) {
    console.log("addPhotoToGallery() llamada con:", photo.name);
    if (!capturedPhotos.some(p => p.url === photo.url)) {
        capturedPhotos.push({ ...photo, isSelected: false }); // Añadir isSelected
    }
    savePhotosToLocalStorage();
    renderThumbnails();
    updateButtonsState();
}

function savePhotosToLocalStorage() {
    console.log("Guardando fotos en localStorage.");
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(capturedPhotos));
}

function loadPhotosFromLocalStorage() {
    console.log("Cargando fotos de localStorage.");
    const storedPhotos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedPhotos) {
        capturedPhotos = JSON.parse(storedPhotos);
        capturedPhotos = capturedPhotos.map(photo => ({ ...photo, isSelected: photo.isSelected || false }));
        renderThumbnails();
        updateButtonsState();
    }
}

function renderThumbnails() {
    console.log("Renderizando miniaturas.");
    thumbnailsContainer.innerHTML = '';
    if (capturedPhotos.length === 0) {
        thumbnailsContainer.innerHTML = '<p>No hay fotos en la galería.</p>';
        return;
    }

    capturedPhotos.forEach((photo, index) => {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.classList.add('thumbnail');
        thumbnailDiv.dataset.index = index; 

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.name || `Foto ${index + 1}`;
        img.classList.add('thumbnail-image');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('thumbnail-checkbox');
        checkbox.checked = photo.isSelected;
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            photo.isSelected = checkbox.checked;
            thumbnailDiv.classList.toggle('selected', photo.isSelected);
            updateButtonsState();
            savePhotosToLocalStorage();
        });

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Ver';
        viewButton.classList.add('view-button');
        viewButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showFullscreenPhoto(photo.url);
        });
        
        thumbnailDiv.appendChild(img);
        thumbnailDiv.appendChild(checkbox);
        thumbnailDiv.appendChild(viewButton);
        
        let clickTimeout;
        thumbnailDiv.addEventListener('click', (e) => {
            if (e.target === checkbox || e.target === viewButton) {
                return;
            }

            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                showFullscreenPhoto(photo.url);
            } else {
                clickTimeout = setTimeout(() => {
                    checkbox.checked = !checkbox.checked;
                    photo.isSelected = checkbox.checked;
                    thumbnailDiv.classList.toggle('selected', photo.isSelected);
                    updateButtonsState();
                    savePhotosToLocalStorage();
                    clickTimeout = null;
                }, 300);
            }
        });

        if (photo.isSelected) {
            thumbnailDiv.classList.add('selected');
        }

        thumbnailsContainer.appendChild(thumbnailDiv);
    });
}


function showFullscreenPhoto(url) {
    fullscreenImage.src = url;
    fullscreenPhotoView.style.display = 'flex';
    console.log("Mostrando foto en pantalla completa.");
}


function updateButtonsState() {
    const selectedPhotosCount = capturedPhotos.filter(p => p.isSelected).length;
    deleteSelectedPhotosButton.disabled = selectedPhotosCount === 0;
    downloadZipButton.disabled = selectedPhotosCount === 0;
    deleteAllPhotosButton.disabled = capturedPhotos.length === 0;

    // Habilitar/Deshabilitar el botón de procesar IA
    processPythonButton.disabled = selectedPhotosCount !== 1; // Solo si hay exactamente una foto seleccionada
}

// ... (El resto de funciones como applySelectedOverlay, loadSelectedOverlay, etc. no necesitan cambios) ...
function applySelectedOverlay() {
    const selectedValue = overlaySelect.value;
    if (selectedValue) {
        appOverlayImage.src = selectedValue;
        appOverlayImage.style.display = 'block';
        console.log("Patrón aplicado:", selectedValue);
    } else {
        appOverlayImage.style.display = 'none';
        appOverlayImage.src = '';
        console.log("Patrón deshabilitado.");
    }
    localStorage.setItem(LOCAL_STORAGE_OVERLAY_KEY, selectedValue);
}

function loadSelectedOverlay() {
    console.log("Cargando selección de overlay de localStorage.");
    const storedOverlay = localStorage.getItem(LOCAL_STORAGE_OVERLAY_KEY);
    if (storedOverlay !== null && storedOverlay !== undefined) {
        overlaySelect.value = storedOverlay;
        applySelectedOverlay();
    } else {
        overlaySelect.value = "assets/images/image_f2b0cc.png";
        applySelectedOverlay();
    }
}


// === Event Listeners ===

takePhotoButton.addEventListener('click', () => {
    console.log("Botón Tomar Foto clickeado.");
    const photoURL = captureFrameWithOverlay();
    if (photoURL) {
        console.log("Foto capturada, URL generada.");
        addPhotoToGallery({ url: photoURL, name: "foto_" + new Date().toISOString().replace(/[:.-]/g, '') + ".png" }); 
        messageElement.textContent = '¡Foto tomada!';
    } else {
        console.log("No se pudo capturar la foto (photoURL es null).");
        messageElement.textContent = 'No se pudo tomar la foto. ¿La cámara está activa?';
    }
});

overlaySelect.addEventListener('change', applySelectedOverlay);

deleteSelectedPhotosButton.addEventListener('click', () => {
    console.log("Eliminando fotos seleccionadas.");
    capturedPhotos = capturedPhotos.filter(photo => !photo.isSelected);
    savePhotosToLocalStorage();
    renderThumbnails();
    updateButtonsState();
    messageElement.textContent = 'Fotos seleccionadas eliminadas.';
});

deleteAllPhotosButton.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres borrar TODAS las fotos? Esta acción no se puede rehacer.')) {
        console.log("Eliminando todas las fotos.");
        capturedPhotos = [];
        savePhotosToLocalStorage();
        renderThumbnails();
        updateButtonsState();
        messageElement.textContent = 'Todas las fotos eliminadas.';
    }
});

downloadZipButton.addEventListener('click', async () => {
    console.log("Iniciando descarga ZIP.");
    const selectedPhotos = capturedPhotos.filter(photo => photo.isSelected);
    if (selectedPhotos.length === 0) {
        messageElement.textContent = 'Selecciona al menos una foto para descargar.';
        return;
    }

    messageElement.textContent = 'Preparando ZIP de fotos...';
    const zip = new JSZip();

    for (const photo of selectedPhotos) {
        try {
            const base64Data = photo.url.split(',')[1];
            const cleanName = photo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_'); 
            zip.file(cleanName, base64Data, { base64: true });
            console.log(`Añadida ${cleanName} al ZIP.`);
        } catch (error) {
            console.error(`Error al añadir la foto ${photo.name} al ZIP:`, error);
            messageElement.textContent = `Error al añadir una foto al ZIP: ${photo.name}`;
            return;
        }
    }

    try {
        const zipFileName = (zipFileNameInput.value || 'mis_fotos').replace(/[^a-zA-Z0-9.\-_]/g, '_') + '.zip';
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, zipFileName);
        messageElement.textContent = `¡${selectedPhotos.length} fotos descargadas en ${zipFileName}!`;
        console.log("ZIP generado y descargado con éxito.");
    } catch (error) {
        console.error("Error al generar o descargar el ZIP:", error);
        messageElement.textContent = `Error al descargar el ZIP: ${error.message}`;
    }
});

backButton.addEventListener('click', () => {
    fullscreenPhotoView.style.display = 'none';
    fullscreenImage.src = '';
    console.log("Regresando de la vista de pantalla completa.");
});

closeOcrResultsButton.addEventListener('click', () => {
    ocrResultsContainer.style.display = 'none';
    ocrExtractedData.textContent = '';
    ocrQrImage.src = '';
    console.log("Cerrando resultados de OCR.");
});

// === NUEVO EVENT LISTENER para el botón de Procesar con IA ===
processPythonButton.addEventListener('click', async () => {
    console.log("Botón Procesar con IA clickeado.");
    const selectedPhoto = capturedPhotos.find(p => p.isSelected);

    if (!selectedPhoto) {
        messageElement.textContent = "Por favor, selecciona una foto para procesar con IA.";
        return;
    }

    messageElement.textContent = "Enviando foto a la IA para procesamiento...";
    ocrResultsContainer.style.display = 'none'; // Ocultar resultados anteriores
    ocrExtractedData.textContent = '';
    ocrQrImage.src = '';

    try {
        const response = await fetch('https://mi-camara-web.onrender.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: selectedPhoto.url }) // Envía la URL base64 de la foto
        });

        const result = await response.json();

        if (response.ok) {
            console.log("Procesamiento IA exitoso:", result);
            messageElement.textContent = "Procesamiento IA completado. Resultados mostrados.";
            ocrResultsContainer.style.display = 'flex'; // Mostrar contenedor de resultados
            
            let extractedText = "Datos Extraídos:\n";
            for (const key in result.extracted_data) {
                extractedText += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${result.extracted_data[key]}\n`;
            }
            ocrExtractedData.textContent = extractedText;

            // Mostrar la imagen QR si se recibió
            if (result.qr_image_b64) {
                ocrQrImage.src = `data:image/png;base64,${result.qr_image_b64}`;
                ocrQrImage.style.display = 'block';
            } else {
                ocrQrImage.style.display = 'none';
            }

        } else {
            console.error("Error del backend IA:", result.error);
            messageElement.textContent = `Error al procesar con IA: ${result.error || 'Error desconocido'}`;
            ocrResultsContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Error de conexión o de red con el backend IA:", error);
        messageElement.textContent = `Error de conexión con el servidor IA. Asegúrate de que Python (Flask) esté corriendo. Detalles: ${error.message}`;
        ocrResultsContainer.style.display = 'none';
    }
});


// === Inicialización de la aplicación ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded, iniciando la aplicación.");
    startCamera(); // Inicia la cámara al cargar la página
    loadPhotosFromLocalStorage(); // Carga las fotos guardadas
    loadSelectedOverlay(); // Carga el overlay seleccionado
    updateButtonsState(); // Actualiza el estado de los botones
    // --- Modificación aquí: Mostrar el botón de procesar con IA al inicio ---
    processPythonButton.style.display = 'block';
});
