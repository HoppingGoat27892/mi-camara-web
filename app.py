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
import os # <-- ¡Añadir esta importación!

app = Flask(__name__)
CORS(app)

# --- CONFIGURACIÓN DE TESSERACT OCR ---
# ¡IMPORTANTE! Para Render, especifica la ruta de instalación de apt.txt
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# --- DIAGNÓSTICO ADICIONAL ---
# Añade esto para intentar ver si tesseract está accesible
try:
    # Verificar si el archivo existe y es ejecutable
    if os.path.exists(pytesseract.pytesseract.tesseract_cmd) and \
       os.access(pytesseract.pytesseract.tesseract_cmd, os.X_OK):
        app.logger.info(f"Tesseract binary found and executable at: {pytesseract.pytesseract.tesseract_cmd}")
        # Intenta ejecutar un comando simple de tesseract para verificar su funcionamiento
        version_info = pytesseract.get_tesseract_version()
        app.logger.info(f"Tesseract version detected: {version_info}")
    else:
        app.logger.error(f"Tesseract binary NOT found or NOT executable at: {pytesseract.pytesseract.tesseract_cmd}")
        # Opcional: imprimir el PATH para depuración (puede ser muy largo)
        # app.logger.info(f"Current PATH: {os.environ.get('PATH')}")
except Exception as e:
    app.logger.error(f"Error checking Tesseract path/version: {e}")
# --- FIN DIAGNÓSTICO ---


@app.route('/')
def home():
    return "¡Backend de BoardScan está activo! Accede a /process_image para el procesamiento."

@app.route('/process_image', methods=['POST'])
def process_image():
    # ... (el resto del código de process_image es el mismo) ...
    if 'image' not in request.files:
        app.logger.error("No se encontró la imagen en la solicitud FormData.")
        return jsonify({"error": "No se encontró la imagen en la solicitud"}), 400

    file = request.files['image']

    if file.filename == '':
        app.logger.error("Nombre de archivo de imagen vacío en la solicitud.")
        return jsonify({"error": "Nombre de archivo de imagen vacío"}), 400

    if file:
        try:
            # ... (tu código de procesamiento de imagen, sin cambios aquí) ...
            img_stream = file.read()
            nparr = np.frombuffer(img_stream, np.uint8)
            img_full = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_full is None:
                app.logger.error("No se pudo decodificar la imagen. Formato no válido.")
                return jsonify({"error": "No se pudo decodificar la imagen. Asegúrate de que sea una imagen válida."}), 400

            gray = cv2.cvtColor(img_full, cv2.COLOR_BGR2GRAY)

            h_img, w_img, _ = img_full.shape

            regs = {
                'numero_serie': [0.10, 0.20, 0.30, 0.25],
                'modelo':       [0.40, 0.20, 0.60, 0.25],
                'descripcion':  [0.10, 0.30, 0.90, 0.40]
            }

            extracted_data = {}
            for key, coords in regs.items():
                x1_frac, y1_frac, x2_frac, y2_frac = coords
                x1 = int(x1_frac * w_img)
                y1 = int(y1_frac * h_img)
                x2 = int(x2_frac * w_img)
                y2 = int(y2_frac * h_img)

                crop = gray[y1:y2, x1:x2]

                text = pytesseract.image_to_string(crop, lang='eng')
                extracted_data[key] = text.strip()

                app.logger.info(f"OCR en {key}: '{text.strip()}'")

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
            # Este es el error que estás viendo
            app.logger.error(f"Error de Tesseract: {e}. Asegúrate de que Tesseract esté instalado y en el PATH del servidor.")
            return jsonify({"error": "Error del motor OCR. Tesseract no encontrado en el servidor. Detalles: " + str(e)}), 500
        except Exception as e:
            app.logger.error(f"Error interno del servidor al procesar la imagen: {e}", exc_info=True)
            return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

    return jsonify({"error": "Error desconocido al procesar la solicitud de imagen."}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
