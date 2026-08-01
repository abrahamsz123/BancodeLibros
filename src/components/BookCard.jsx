import React, { useState } from 'react';

/**
 * Componente para mostrar un libro individual en el catálogo.
 * Soporta opciones de edición/borrado para el propietario y botón de chat para interesados.
 * 
 * @param {Object} props
 * @param {Object} props.libro - Objeto del libro
 * @param {string} [props.currentUserId] - ID del usuario logueado actualmente
 * @param {Function} [props.onEdit] - Callback al hacer clic en Editar
 * @param {Function} [props.onDelete] - Callback al hacer clic en Eliminar
 * @param {Function} [props.onChat] - Callback al hacer clic en Chatear
 */
export default function BookCard({ libro, currentUserId, onEdit, onDelete, onChat }) {
  const [copied, setCopied] = useState(false);

  const { id, user_id, titulo, autor, categoria, grado, tipo_trato, precio, nombre_contacto, telefono_contacto } = libro;

  const isOwner = currentUserId === user_id;

  const handleCopyPhone = (e) => {
    e.stopPropagation(); // Evitar eventos del padre
    navigator.clipboard.writeText(telefono_contacto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDealClass = () => {
    switch (tipo_trato) {
      case 'Venta': return 'venta';
      case 'Regalo': return 'regalo';
      case 'Intercambio': return 'intercambio';
      default: return '';
    }
  };

  const formatPrecio = (num) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD', // Generalmente se cotiza en dólares en Venezuela para estas plataformas
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className={`book-card ${getDealClass()}`}>
      <div className="card-header">
        <div className="card-badges">
          <span className="badge badge-category">{categoria}</span>
          <span className="badge badge-category" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
            {grado}
          </span>
          <span className={`badge badge-deal-${getDealClass()}`}>
            {tipo_trato === 'Venta' && precio ? `${tipo_trato}: ${formatPrecio(precio)}` : tipo_trato}
          </span>
        </div>
        <h3 className="book-title" title={titulo}>{titulo}</h3>
        <p className="book-author" title={autor}>por {autor}</p>
      </div>

      <div className="card-body">
        <div className="contact-info">
          <span className="contact-label">Publicado por</span>
          <span className="contact-name">{nombre_contacto}</span>
          
          <div className="contact-phone-wrapper" style={{ marginBottom: '0.75rem' }}>
            <span className="phone-number" aria-label="Número de teléfono">{telefono_contacto}</span>
            <button 
              className="copy-btn" 
              onClick={handleCopyPhone} 
              title="Copiar número"
              aria-label="Copiar número de teléfono"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Acciones contextuales */}
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', gap: '0.5rem' }}>
          {isOwner ? (
            <>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' }}
                onClick={() => onEdit(libro)}
              >
                ✏️ Editar
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-sm)' }}
                onClick={() => onDelete(id)}
              >
                🗑️ Borrar
              </button>
            </>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-sm)', gap: '0.4rem' }}
              onClick={() => onChat(libro)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Chatear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
