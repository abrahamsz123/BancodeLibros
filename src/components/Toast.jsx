import React, { useEffect } from 'react';

/**
 * Componente Toast para mostrar notificaciones de éxito o error.
 * Se auto-desestima tras 4 segundos.
 * 
 * @param {Object} props
 * @param {string} props.message - Mensaje a mostrar
 * @param {'success' | 'error'} props.type - Tipo de notificación
 * @param {Function} props.onClose - Callback al cerrarse la notificación
 */
export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      <span className="toast-message">{message}</span>
      <button 
        className="copy-btn" 
        onClick={onClose} 
        aria-label="Cerrar notificación"
        style={{ fontSize: '1.2rem', padding: '0 0.25rem', display: 'flex', alignItems: 'center' }}
      >
        &times;
      </button>
    </div>
  );
}
