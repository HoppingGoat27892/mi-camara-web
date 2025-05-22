import cv2
import pytesseract
import numpy as np
from PIL import Image
import qrcode
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import io

# --- Configuración de Tesseract ---
# Si Tesseract no está en tu PATH, descomenta la línea de abajo y ajusta la ruta.
# Ejemplo para Windows:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Ejemplo para macOS/Linux si está en un lugar no estándar:
# pytesseract.pytesseract.tesseract_cmd = r'/usr/local/bin/tesseract' # o donde lo hayas instalado

app = Flask(__name__)
CORS(app) # Habilita CORS para permitir solicitudes desde tu frontend (origin diferente)

@app.route('/process_image', methods=['POST'])
def process_image():
    if 'image' not in request.json:
        return jsonify({"error": "No image data provided"}), 400

    image_data_b64 = request.json['image']
    # La imagen viene como "data:image/png;base64,iVBORw..."
    # Necesitamos quitar la parte del encabezado 'data:image/png;base64,'
    if "," in image_data_b64:
        image_data_b64 = image_data_b64.split(",")[1]

    try:
        # Decodificar la imagen base64
        image_bytes = base64.b64decode(image_data_b64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400

        h, w, _ = img.shape

        # Definir regiones (ajustadas para la carta "The Pig" y para evitar bordes)
        # Las fracciones deben ser muy precisas para cada sección de la carta.
        # Formato: (y1_frac, y2_frac, x1_frac, x2_frac, tesseract_config)
        regs = {
            # Nombre "The Pig": Ligeramente más ajustado en Y y X para evitar cualquier borde.
            "nombre":    (0.09, 0.135, 0.40, 0.65, "--psm 7"),
            # Costo (el '1' superior izquierdo): Aumentado ligeramente x1_frac y reducido x2_frac
            "costo":     (0.08, 0.20, 0.20, 0.35, "--psm 8 -c tessedit_char_whitelist=0123456789"),
            # Paisaje "Rainbow Creature": Ajustado ligeramente para mayor precisión.
            "paisaje":   (0.595, 0.635, 0.30, 0.70, "--psm 7"),
            # Habilidad "FLOOP...": Es la región más grande, debe ser muy precisa.
            "habilidad": (0.64, 0.79, 0.095, 0.905, "--psm 6"),
            # Ataque (el '1' inferior izquierdo): Coordenadas muy ajustadas para el número.
            "ataque":    (0.85, 0.925, 0.22, 0.28, "--psm 8 -c tessedit_char_whitelist=0123456789"),
            # Defensa (el '4' inferior derecho): Coordenadas muy ajustadas para el número.
            "defensa":   (0.85, 0.925, 0.72, 0.78, "--psm 8 -c tessedit_char_whitelist=0123456789"),
        }

        # Función OCR por región (sin visualización para Colab)
        def ocr_region(img_full, key, region_params):
            y1_frac, y2_frac, x1_frac, x2_frac, config = region_params

            y1 = int(y1_frac * h)
            y2 = int(y2_frac * h)
            x1 = int(x1_frac * w)
            x2 = int(x2_frac * w)

            # Asegurar que las coordenadas estén dentro de los límites de la imagen
            y1 = max(0, y1)
            y2 = min(h, y2)
            x1 = max(0, x1)
            x2 = min(w, x2)

            # Asegurar que el recorte no sea vacío
            if y2 <= y1 or x2 <= x1:
                print(f"Warning: Empty crop for region {key}. y1:{y1}, y2:{y2}, x1:{x1}, x2:{x2}")
                return "" # Retorna cadena vacía si el recorte es inválido

            crop = img_full[y1:y2, x1:x2]

            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            text = pytesseract.image_to_string(th, config=config).strip()
            return text

        # Extraer datos
        info = {}
        for key, params in regs.items():
            info[key] = ocr_region(img, key, params)

        # Generar QR con los datos
        datos_json = json.dumps(info, indent=2, ensure_ascii=False)
        qr_img = qrcode.make(datos_json)

        # Convertir la imagen QR a base64 para enviarla al frontend
        buffered = io.BytesIO()
        qr_img.save(buffered, format="PNG")
        qr_image_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        return jsonify({
            "success": True,
            "extracted_data": info,
            "qr_image_b64": qr_image_b64
        })

    except Exception as e:
        app.logger.error(f"Error processing image: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) # Se ejecutará en http://127.0.0.1:5000/
