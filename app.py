# app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
import qrcode
from PIL import Image
import io
import base64

app = Flask(__name__)
CORS(app) # Esto habilita CORS para todas las rutas

# --- CONFIGURACIÓN DE TESSERACT OCR ---
# Importante: Para el despliegue en Render, esta línea debe estar COMENTADA
# si Tesseract está instalado a nivel de sistema.
# Si estás ejecutando localmente y Tesseract no está en tu PATH, descoméntala
# y reemplaza la ruta con la de tu instalación local de tesseract.exe.
# Ejemplo para Windows:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Ejemplo para Linux (Render): No es necesaria si tesseract-ocr se instala via apt-get

@app.route('/')
def home():
    # Una ruta simple para verificar que el servidor esté corriendo
    return "¡Backend de BoardScan está activo! Accede a /process_image para el procesamiento."

@app.route('/process_image', methods=['POST'])
def process_image():
    # Verifica que se haya enviado un archivo con el nombre 'image'
    if 'image' not in request.files:
        app.logger.error("No se encontró la imagen en la solicitud FormData.")
        return jsonify({"error": "No se encontró la imagen en la solicitud"}), 400

    file = request.files['image']

    # Verifica si el nombre del archivo está vacío
    if file.filename == '':
        app.logger.error("Nombre de archivo de imagen vacío en la solicitud.")
        return jsonify({"error": "Nombre de archivo de imagen vacío"}), 400

    if file:
        try:
            # Leer el archivo de imagen como bytes
            img_stream = file.read()
            # Convertir los bytes a un array de NumPy
            nparr = np.frombuffer(img_stream, np.uint8)
            # Decodificar el array de NumPy a una imagen OpenCV
            img_full = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_full is None:
                app.logger.error("No se pudo decodificar la imagen. Formato no válido.")
                return jsonify({"error": "No se pudo decodificar la imagen. Asegúrate de que sea una imagen válida."}), 400

            # Convertir a escala de grises para Tesseract (opcional, pero a menudo mejora el rendimiento)
            gray = cv2.cvtColor(img_full, cv2.COLOR_BGR2GRAY)

            # Definir las regiones de interés (ROIs) para el OCR
            # Estas coordenadas son relativas a la imagen y probablemente necesiten ajuste fino.
            # Los valores son fracciones del ancho y alto de la imagen.
            # Ejemplo: [x1, y1, x2, y2] donde x1,y1 es la esquina superior izquierda y x2,y2 la inferior derecha
            # Los valores se asumen normalizados entre 0 y 1.
            
            # --- ATENCIÓN: ESTAS COORDENADAS SON DE EJEMPLO Y DEBEN AJUSTARSE A TUS IMÁGENES ---
            # Si tu overlay tiene un aspecto diferente, o la cámara toma fotos con una orientación diferente,
            # DEBERÁS AJUSTAR ESTOS VALORES PARA OBTENER LOS MEJORES RESULTADOS.
            # Puedes usar herramientas de edición de imagen para obtener coordenadas de píxeles,
            # luego dividirlas por el ancho/alto total para obtener las fracciones.
            
            h_img, w_img, _ = img_full.shape # Obtener dimensiones de la imagen

            regs = {
                'numero_serie': [0.10, 0.20, 0.30, 0.25], # Ejemplo: x1, y1, x2, y2 (fracciones)
                'modelo':       [0.40, 0.20, 0.60, 0.25],
                'descripcion':  [0.10, 0.30, 0.90, 0.40]
            }

            extracted_data = {}
            for key, coords in regs.items():
                x1_frac, y1_frac, x2_frac, y2_frac = coords
                
                # Convertir fracciones a coordenadas de píxeles
                x1 = int(x1_frac * w_img)
                y1 = int(y1_frac * h_img)
                x2 = int(x2_frac * w_img)
                y2 = int(y2_frac * h_img)

                crop = gray[y1:y2, x1:x2]
                
                # Opcional: Aplicar preprocesamiento a la región recortada
                # crop = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
                # crop = cv2.medianBlur(crop, 3)

                # Realizar OCR en la región recortada
                text = pytesseract.image_to_string(crop, lang='eng') # Puedes especificar el idioma si es necesario
                extracted_data[key] = text.strip()

                app.logger.info(f"OCR en {key}: '{text.strip()}'")

            # Generar código QR con los datos extraídos
            qr_data_string = "; ".join([f"{k}: {v}" for k, v in extracted_data.items() if v])
            if qr_data_string:
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=10,
                    border=4,
                )
                qr.add_data(qr_data_string)
                qr.make(fit=True)

                img_qr = qr.make_image(fill_color="black", back_color="white").convert('RGB')

                # Convertir la imagen QR a Base64
                buf = io.BytesIO()
                img_qr.save(buf, format='PNG')
                qr_image_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            else:
                qr_image_b64 = None
                app.logger.warning("No se generó QR: datos extraídos vacíos.")

            return jsonify({
                "message": "Imagen procesada con éxito",
                "extracted_data": extracted_data,
                "qr_image_b64": qr_image_b64
            }), 200

        except pytesseract.TesseractNotFoundError as e:
            app.logger.error(f"Error de Tesseract: {e}. Asegúrate de que Tesseract esté instalado y en el PATH del servidor.")
            return jsonify({"error": "Error del motor OCR. Tesseract no encontrado en el servidor. Detalles: " + str(e)}), 500
        except Exception as e:
            app.logger.error(f"Error interno del servidor al procesar la imagen: {e}", exc_info=True)
            return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

    return jsonify({"error": "Error desconocido al procesar la solicitud de imagen."}), 500

if __name__ == '__main__':
    # Para desarrollo local (Flask built-in server)
    # En producción (Render), gunicorn maneja esto.
    app.run(debug=True, host='0.0.0.0', port=5000)
