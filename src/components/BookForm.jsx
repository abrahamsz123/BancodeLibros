import React, { useState, useEffect } from 'react';

// Categorías/Materias definidas para la plataforma
export const CATEGORIAS = [
  'Matemáticas',
  'Literatura',
  'Ciencias',
  'Historia',
  'Idiomas',
  'Arte',
  'Tecnología',
  'Otros'
];

// Grados escolares venezolanos
export const GRADOS = [
  '1er Grado',
  '2do Grado',
  '3er Grado',
  '4to Grado',
  '5to Grado',
  '6to Grado',
  '1er Año',
  '2do Año',
  '3er Año',
  '4to Año',
  '5to Año'
];

/**
 * Componente del Formulario de Publicación y Edición de Libros.
 * 
 * @param {Object} props
 * @param {Function} props.onSubmit - Función ejecutada al guardar exitosamente
 * @param {Function} props.onClose - Función para cerrar el modal
 * @param {Object} [props.libro] - Objeto del libro (si se está editando)
 */
export default function BookForm({ onSubmit, onClose, libro }) {
  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    categoria: '',
    grado: '',
    tipo_trato: 'Venta',
    precio: '',
    nombre_contacto: '',
    telefono_contacto: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  // Inicializar el formulario si viene un libro para editar
  useEffect(() => {
    if (libro) {
      setFormData({
        titulo: libro.titulo || '',
        autor: libro.autor || '',
        categoria: libro.categoria || '',
        grado: libro.grado || '',
        tipo_trato: libro.tipo_trato || 'Venta',
        precio: libro.precio !== null && libro.precio !== undefined ? libro.precio.toString() : '',
        nombre_contacto: libro.nombre_contacto || '',
        telefono_contacto: libro.telefono_contacto || ''
      });
    }
  }, [libro]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Si cambia el trato y no es Venta, limpiamos el precio
      ...(name === 'tipo_trato' && value !== 'Venta' ? { precio: '' } : {})
    }));

    // Limpiar error al escribir
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    setScanError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result;
      const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      if (!n8nWebhookUrl) {
        setScanError('La URL del Webhook de n8n no está configurada en las variables de entorno (.env).');
        setScanning(false);
        return;
      }

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64Data }),
        });

        if (!response.ok) throw new Error('Error al conectar con el servidor de escaneo.');
        
        const data = await response.json();
        console.log('Respuesta recibida de n8n:', data);
        
        let resultData = data;
        let textContent = null;
        if (data) {
          if (typeof data.text === 'string') {
            textContent = data.text;
          } else if (typeof data.output === 'string') {
            textContent = data.output;
          } else if (data.content && data.content.parts && data.content.parts[0] && typeof data.content.parts[0].text === 'string') {
            textContent = data.content.parts[0].text;
          }
        }

        if (typeof textContent === 'string') {
          try {
            const cleanText = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
            resultData = JSON.parse(cleanText);
          } catch (e) {
            console.error('Error al parsear el JSON dentro del texto de la IA:', e);
          }
        }
        
        if (resultData) {
          setFormData((prev) => ({
            ...prev,
            titulo: resultData.titulo || prev.titulo,
            autor: resultData.autor || prev.autor,
            categoria: CATEGORIAS.includes(resultData.categoria) ? resultData.categoria : prev.categoria,
            grado: GRADOS.includes(resultData.grado) ? resultData.grado : prev.grado,
          }));
        }
      } catch (err) {
        console.error(err);
        setScanError('No se pudo analizar la foto. Asegúrate de que el flujo de n8n esté activo y funcione.');
      } finally {
        setScanning(false);
      }
    };
    reader.onerror = () => {
      setScanError('Error al leer el archivo de imagen.');
      setScanning(false);
    };
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.titulo.trim()) newErrors.titulo = 'El título es obligatorio';
    if (!formData.autor.trim()) newErrors.autor = 'El autor es obligatorio';
    if (!formData.categoria) newErrors.categoria = 'La categoría/materia es obligatoria';
    if (!formData.grado) newErrors.grado = 'El grado/año escolar es obligatorio';
    if (!formData.tipo_trato) newErrors.tipo_trato = 'El tipo de trato es obligatorio';
    
    if (formData.tipo_trato === 'Venta') {
      if (!formData.precio) {
        newErrors.precio = 'El precio es obligatorio para la venta';
      } else if (isNaN(formData.precio) || parseFloat(formData.precio) < 0) {
        newErrors.precio = 'El precio debe ser un número válido mayor o igual a 0';
      }
    }

    if (!formData.nombre_contacto.trim()) newErrors.nombre_contacto = 'El nombre de contacto es obligatorio';
    if (!formData.telefono_contacto.trim()) {
      newErrors.telefono_contacto = 'El teléfono de contacto es obligatorio';
    } else if (!/^\+?[0-9\s-]{7,15}$/.test(formData.telefono_contacto.trim())) {
      newErrors.telefono_contacto = 'Introduce un número de teléfono válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      console.error(err);
      const errMsg = err.message || 'Revisa tu conexión o si la sesión expiró.';
      const errDetails = err.details ? ` (${err.details})` : '';
      setErrors((prev) => ({ 
        ...prev, 
        general: `Error al publicar: ${errMsg}${errDetails}` 
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      {errors.general && (
        <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem', backgroundColor: 'var(--danger-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
          {errors.general}
        </div>
      )}

      {/* Sección del Escáner con IA */}
      <div className="form-group scan-ai-section" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem', backgroundColor: 'rgba(159, 122, 234, 0.03)', border: '1px dashed var(--primary)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>Escáner de Libros Inteligente</h4>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.4' }}>
          Sube o toma una foto de la portada del libro escolar y la IA completará los campos de título, autor, materia y grado escolar de forma automática.
        </p>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          id="scanner-file-input"
          disabled={scanning}
        />
        
        <label 
          htmlFor="scanner-file-input" 
          className="btn btn-secondary" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            cursor: scanning ? 'not-allowed' : 'pointer',
            opacity: scanning ? 0.7 : 1,
            padding: '0.6rem 1.25rem',
            margin: 0
          }}
        >
          {scanning ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'var(--primary)' }}></div>
              Analizando portada...
            </>
          ) : (
            <>
              <span>📷</span>
              Subir Foto / Tomar Foto
            </>
          )}
        </label>

        {scanError && (
          <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            ⚠️ {scanError}
          </span>
        )}
      </div>

      {/* Título del libro */}
      <div className="form-group">
        <label htmlFor="titulo">Título del Libro *</label>
        <input
          type="text"
          id="titulo"
          name="titulo"
          value={formData.titulo}
          onChange={handleChange}
          className={`form-input ${errors.titulo ? 'error' : ''}`}
          placeholder="Ej. Álgebra de Baldor"
        />
        {errors.titulo && <span className="error-message">{errors.titulo}</span>}
      </div>

      {/* Autor */}
      <div className="form-group">
        <label htmlFor="autor">Autor *</label>
        <input
          type="text"
          id="autor"
          name="autor"
          value={formData.autor}
          onChange={handleChange}
          className={`form-input ${errors.autor ? 'error' : ''}`}
          placeholder="Ej. Aurelio Baldor"
        />
        {errors.autor && <span className="error-message">{errors.autor}</span>}
      </div>

      {/* Fila: Categoría y Grado */}
      <div className="form-row-2">
        {/* Categoría/Materia */}
        <div className="form-group">
          <label htmlFor="categoria">Materia / Categoría *</label>
          <select
            id="categoria"
            name="categoria"
            value={formData.categoria}
            onChange={handleChange}
            className={`select-custom ${errors.categoria ? 'error' : ''}`}
          >
            <option value="">-- Selecciona Materia --</option>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.categoria && <span className="error-message">{errors.categoria}</span>}
        </div>

        {/* Grado / Año Escolar */}
        <div className="form-group">
          <label htmlFor="grado">Grado o Año Escolar *</label>
          <select
            id="grado"
            name="grado"
            value={formData.grado}
            onChange={handleChange}
            className={`select-custom ${errors.grado ? 'error' : ''}`}
          >
            <option value="">-- Selecciona Grado --</option>
            {GRADOS.map((gr) => (
              <option key={gr} value={gr}>{gr}</option>
            ))}
          </select>
          {errors.grado && <span className="error-message">{errors.grado}</span>}
        </div>
      </div>

      {/* Tipo de Trato */}
      <div className="form-group">
        <label>Tipo de Trato *</label>
        <div className="radio-cards">
          {['Venta', 'Regalo', 'Intercambio'].map((type) => (
            <label key={type} className="radio-card-label">
              <input
                type="radio"
                name="tipo_trato"
                value={type}
                checked={formData.tipo_trato === type}
                onChange={handleChange}
              />
              <div className="radio-card-custom">{type}</div>
            </label>
          ))}
        </div>
      </div>

      {/* Precio Condicional */}
      {formData.tipo_trato === 'Venta' && (
        <div className="form-group" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <label htmlFor="precio">Precio ($) *</label>
          <input
            type="number"
            id="precio"
            name="precio"
            value={formData.precio}
            onChange={handleChange}
            min="0"
            step="any"
            className={`form-input ${errors.precio ? 'error' : ''}`}
            placeholder="Ej. 15"
          />
          {errors.precio && <span className="error-message">{errors.precio}</span>}
        </div>
      )}

      {/* Datos del Vendedor */}
      <div className="form-row-2">
        <div className="form-group">
          <label htmlFor="nombre_contacto">Nombre del Vendedor *</label>
          <input
            type="text"
            id="nombre_contacto"
            name="nombre_contacto"
            value={formData.nombre_contacto}
            onChange={handleChange}
            className={`form-input ${errors.nombre_contacto ? 'error' : ''}`}
            placeholder="Ej. Juan Pérez"
          />
          {errors.nombre_contacto && <span className="error-message">{errors.nombre_contacto}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="telefono_contacto">Teléfono Móvil *</label>
          <input
            type="text"
            id="telefono_contacto"
            name="telefono_contacto"
            value={formData.telefono_contacto}
            onChange={handleChange}
            className={`form-input ${errors.telefono_contacto ? 'error' : ''}`}
            placeholder="Ej. +584121234567"
          />
          {errors.telefono_contacto && <span className="error-message">{errors.telefono_contacto}</span>}
        </div>
      </div>

      {/* Acciones */}
      <div className="form-actions">
        <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Guardando...' : libro ? 'Actualizar Publicación' : 'Publicar Libro'}
        </button>
      </div>
    </form>
  );
}
