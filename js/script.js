console.log("script.js cargado e iniciando.");

// === Elementos del DOM ===
const video = document.getElementById('videoElement');
const appOverlayImage = document.getElementById('appOverlayImage');
const overlaySelect = document.getElementById('overlaySelect');
const takePhotoButton = document.getElementById('takePhotoButton');
const processPythonButton = document.getElementById('processPythonButton'); // Botón para IA
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
let currentStream; // Para almacenar el stream de la cámara y poder detenerlo
let capturedPhotos = []; // Almacena los objetos { url, name, isSelected }
const LOCAL_STORAGE_KEY = 'capturedPhotos';
const LOCAL_STORAGE_OVERLAY_KEY = 'selectedOverlay';

// === Funciones de la Cámara ===

async function startCamera() {
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
        // Esto es crucial para la vista previa y puede depender de la orientación del dispositivo
        video.onloadedmetadata = () => {
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            const { width, height, facingMode } = settings;
            console.log(`Video metadata: ${width}x${height}, Facing Mode: ${facingMode}`);

            // Determinar si el video necesita rotación para verse correctamente en la orientación del dispositivo
            // Si el video es más ancho que alto (horizontal) y la ventana es más alta que ancha (vertical)
            if (width > height && window.innerHeight > window.innerWidth) {
                console.log("Detectado video horizontal en modo retrato del dispositivo. Aplicando rotación 90deg.");
                video.style.transform = 'rotate(90deg)';
                // Si es cámara frontal, también voltear horizontalmente
                if (facingMode === 'user') {
                    video.style.transform += ' scaleX(-1)';
                }
            } else if (width < height && window.innerWidth > window.innerHeight) { // Video vertical en modo paisaje
                console.log("Detectado video vertical en modo paisaje del dispositivo. Aplicando rotación -90deg.");
                video.style.transform = 'rotate(-90deg)';
                if (facingMode === 'user') {
                    video.style.transform += ' scaleX(-1)';
                }
            } else {
                console.log("Video y dispositivo en la misma orientación. Sin rotación.");
                video.style.transform = 'none'; // Asegurarse de que no haya transformaciones residuales
                if (facingMode === 'user') {
                    video.style.transform = 'scaleX(-1)'; // Solo volteo horizontal para selfie
                }
            }
            // Asegurarse que el overlay también se ajuste a la rotación si es necesario
            appOverlayImage.style.transform = video.style.transform;
        };


    } catch (err) {
        console.error('Error al acceder a la cámara: ', err);
        messageElement.textContent = `Error al acceder a la cámara: ${err.name}. Asegúrate de permitir el acceso.`;
        if (err.name === 'OverconstrainedError') {
            messageElement.textContent += " Es posible que tu dispositivo no tenga la cámara trasera o que las restricciones sean demasiado estrictas. Intentando con cámara por defecto.";
            // Intentar con una restricción más relajada si la cámara trasera no es compatible
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
                    // Si la cámara relajada es la frontal (user), aplicar flip horizontal
                    if (settings.facingMode === 'user') {
                        console.log("Cámara frontal detectada, aplicando volteo horizontal.");
                        video.style.transform = 'scaleX(-1)'; // Voltear horizontalmente
                        appOverlayImage.style.transform = 'scaleX(-1)';
                    } else {
                        video.style.transform = 'none'; // Asegurarse de que no haya volteo
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

    // Dibuja el frame del video en el canvas
    // Si el video fue rotado en CSS para visualización, aquí se dibuja en su orientación nativa
    // Si se aplicó un transform en el video (rotate, scaleX), debemos aplicarlo al contexto del canvas
    // para que la imagen capturada refleje lo que el usuario ve.
    context.save(); // Guarda el estado actual del contexto
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
    context.restore(); // Restaura el estado del contexto

    // Dibuja el overlay si está visible
    if (appOverlayImage.style.display !== 'none' && appOverlayImage.src) {
        if (appOverlayImage.naturalWidth > 0 && appOverlayImage.naturalHeight > 0) {
            // Dibuja el overlay con las mismas transformaciones que el video
            context.save();
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
            context.drawImage(appOverlayImage, 0, 0, videoWidth, videoHeight);
            context.restore();
            console.log("Overlay dibujado en el canvas.");
        } else {
            console.warn("La imagen de overlay no está completamente cargada, no se dibujó.");
        }
    }

    const photoURL = canvas.toDataURL('image/png');
    console.log("URL de foto capturada generada.");
    return photoURL;
}

// === Funciones de Galería y Guardado ===

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
        // Asegurarse de que 'isSelected' exista en objetos antiguos si no lo tenían
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
        // Usar data-index para referencia, no para selección visual directa
        thumbnailDiv.dataset.index = index; 

        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = photo.name || `Foto ${index + 1}`;
        img.classList.add('thumbnail-image'); // Nueva clase para la imagen dentro del thumbnail

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('thumbnail-checkbox');
        checkbox.checked = photo.isSelected;
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation(); // Evita que el clic en el checkbox active el evento del div
            photo.isSelected = checkbox.checked;
            // Toggle 'selected' class on the parent div
            thumbnailDiv.classList.toggle('selected', photo.isSelected);
            updateButtonsState();
            savePhotosToLocalStorage(); // Guardar el estado de selección
        });

        const viewButton = document.createElement('button');
        viewButton.textContent = 'Ver';
        viewButton.classList.add('view-button');
        viewButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que el clic en el botón active el evento del div
            showFullscreenPhoto(photo.url);
        });
        
        thumbnailDiv.appendChild(img);
        thumbnailDiv.appendChild(checkbox);
        thumbnailDiv.appendChild(viewButton);
        
        // <<-- CORRECCIÓN: Lógica para un clic (seleccionar) y doble clic (ver) -->>
        let clickTimeout;
        thumbnailDiv.addEventListener('click', (e) => {
            // Si el clic viene del checkbox o del botón "Ver", no hacer nada aquí
            if (e.target === checkbox || e.target === viewButton) {
                return;
            }

            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                // Doble clic: Ver foto
                showFullscreenPhoto(photo.url);
            } else {
                clickTimeout = setTimeout(() => {
                    // Un solo clic: Seleccionar/deseleccionar
                    checkbox.checked = !checkbox.checked;
                    photo.isSelected = checkbox.checked;
                    thumbnailDiv.classList.toggle('selected', photo.isSelected); // Aplicar clase CSS
                    updateButtonsState();
                    savePhotosToLocalStorage();
                    clickTimeout = null;
                }, 300); // 300ms es un buen umbral para doble clic
            }
        });

        // Asegurarse de que la clase 'selected' esté aplicada al cargar
        if (photo.isSelected) {
            thumbnailDiv.classList.add('selected');
        }

        thumbnailsContainer.appendChild(thumbnailDiv);
    });
}


function showFullscreenPhoto(url) {
    fullscreenImage.src = url;
    fullscreenPhotoView.style.display = 'flex'; // <<-- CORRECCIÓN: Mostrar la vista
    console.log("Mostrando foto en pantalla completa.");
}


function updateButtonsState() {
    const selectedPhotosCount = capturedPhotos.filter(p => p.isSelected).length;
    deleteSelectedPhotosButton.disabled = selectedPhotosCount === 0;
    downloadZipButton.disabled = selectedPhotosCount === 0;
    deleteAllPhotosButton.disabled = capturedPhotos.length === 0;
}

// === Funciones de Patrón (Overlay) ===

function applySelectedOverlay() {
    const selectedValue = overlaySelect.value;
    if (selectedValue) {
        appOverlayImage.src = selectedValue;
        appOverlayImage.style.display = 'block';
        console.log("Patrón aplicado:", selectedValue);
    } else {
        appOverlayImage.style.display = 'none';
        appOverlayImage.src = ''; // Limpiar src para evitar intentos de carga
        console.log("Patrón deshabilitado.");
    }
    localStorage.setItem(LOCAL_STORAGE_OVERLAY_KEY, selectedValue); // Guardar la selección
}

function loadSelectedOverlay() {
    console.log("Cargando selección de overlay de localStorage.");
    const storedOverlay = localStorage.getItem(LOCAL_STORAGE_OVERLAY_KEY);
    if (storedOverlay !== null && storedOverlay !== undefined) {
        overlaySelect.value = storedOverlay;
        applySelectedOverlay();
    } else {
        // Si no hay selección guardada, establece el valor por defecto (Patrón Dispensador)
        overlaySelect.value = "assets/images/image_f2b0cc.png"; //
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
    // Reemplazado confirm() por un modal personalizado en una versión anterior.
    // Si quieres el modal de nuevo, necesitarías el HTML/CSS y JS de ese modal.
    // Por ahora, vuelvo a confirm() para simplicidad si no tienes el modal.
    if (confirm('¿Estás seguro de que quieres borrar TODAS las fotos? Esta acción no se puede deshacer.')) {
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
    const zip = new JSZip(); // Asegúrate de que JSZip esté cargado

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
        saveAs(content, zipFileName); // Asegúrate de que FileSaver esté cargado
        messageElement.textContent = `¡${selectedPhotos.length} fotos descargadas en ${zipFileName}!`;
        console.log("ZIP generado y descargado con éxito.");
    } catch (error) {
        console.error("Error al generar o descargar el ZIP:", error);
        messageElement.textContent = `Error al descargar el ZIP: ${error.message}`;
    }
});

backButton.addEventListener('click', () => {
    fullscreenPhotoView.style.display = 'none'; // Ocultar la vista de pantalla completa
    fullscreenImage.src = ''; // Limpiar la imagen
    console.log("Regresando de la vista de pantalla completa.");
});

closeOcrResultsButton.addEventListener('click', () => {
    ocrResultsContainer.style.display = 'none';
    ocrExtractedData.textContent = '';
    ocrQrImage.src = '';
    console.log("Cerrando resultados de OCR.");
});

// === Inicialización de la aplicación ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded, iniciando la aplicación.");
    startCamera(); // Inicia la cámara al cargar la página
    loadPhotosFromLocalStorage(); // Carga las fotos guardadas
    loadSelectedOverlay(); // Carga el overlay seleccionado
    updateButtonsState(); // Actualiza el estado de los botones
});
