import React, { useState, useEffect, useCallback } from 'react';
import { 
  supabase, 
  fetchLibros, 
  insertLibro, 
  updateLibro, 
  deleteLibro, 
  getOrCreateConversation, 
  syncUserProfile, 
  signInWithGoogle, 
  signOut,
  fetchConversations
} from './supabaseClient';
import BookForm from './components/BookForm';
import BookCard from './components/BookCard';
import Filters from './components/Filters';
import Toast from './components/Toast';
import ChatInbox from './components/ChatInbox';

/**
 * Componente principal de la plataforma del Banco de Libros (Colegio Emil Friedman).
 * Gestiona la autenticación con Google, pestañas de navegación y sincronización de datos.
 */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [libros, setLibros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isEnvConfigured, setIsEnvConfigured] = useState(true);
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'mis-libros' | 'mensajes'
  const [targetConversationId, setTargetConversationId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  // Filtros unificados de búsqueda
  const [filters, setFilters] = useState({
    search: '',
    categoria: 'Todas',
    grado: 'Todos',
    tipoTrato: 'Todos',
    sortBy: 'recientes'
  });

  // 1. Verificar variables de entorno
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || url.includes('TU_PROJECT_URL') || !anonKey || anonKey.includes('TU_ANON_KEY')) {
      setIsEnvConfigured(false);
    }
  }, []);

  // 2. Gestionar sesión y perfiles en Supabase Auth
  useEffect(() => {
    if (!isEnvConfigured) return;

    // Obtener sesión activa inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        syncUserProfile(session.user).then(setProfile).catch(console.error);
      }
    });

    // Escuchar cambios de estado en la sesión (Login / Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
          const prof = await syncUserProfile(newSession.user);
          setProfile(prof);
        } catch (err) {
          console.error('Error al sincronizar perfil:', err);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isEnvConfigured]);

  // 3. Contar mensajes no leídos globalmente (para la insignia del tab)
  const loadUnreadCount = useCallback(async () => {
    if (!session?.user) return;
    try {
      const data = await fetchConversations(session.user.id);
      const unread = (data || []).reduce((acc, conv) => {
        const count = (conv.mensajes || []).filter(
          (m) => m.remitente_id !== session.user.id && !m.leido
        ).length;
        return acc + count;
      }, 0);
      setTotalUnread(unread);
    } catch (err) {
      console.error('Error al calcular no leídos:', err);
    }
  }, [session]);

  // Escuchar inserciones/actualizaciones en la tabla de mensajes en tiempo real para refrescar contador
  useEffect(() => {
    if (!session?.user) return;
    loadUnreadCount();

    const channel = supabase
      .channel('global-unread-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes' },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadUnreadCount]);

  // Mensajes emergentes (Toasts)
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Carga de libros filtrados
  const loadLibros = useCallback(async () => {
    if (!isEnvConfigured || !session?.user) return;
    setLoading(true);
    try {
      const onlyOwnBooks = activeTab === 'mis-libros';
      const data = await fetchLibros({
        search: filters.search,
        categoria: filters.categoria,
        grado: filters.grado,
        tipoTrato: filters.tipoTrato,
        userId: onlyOwnBooks ? session.user.id : null,
        orderBy: filters.sortBy === 'recientes' ? 'creado_en' : 'titulo',
        ascending: filters.sortBy === 'alfabetico'
      });
      setLibros(data || []);
    } catch (error) {
      console.error(error);
      addToast('Error al conectar con la base de datos de Supabase.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab, session, isEnvConfigured, addToast]);

  useEffect(() => {
    loadLibros();
  }, [loadLibros]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Login y Logout
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      addToast('Error al iniciar sesión con Google.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      addToast('Sesión cerrada correctamente.', 'success');
      setActiveTab('catalogo');
    } catch (err) {
      console.error(err);
      addToast('Error al cerrar sesión.', 'error');
    }
  };

  // Guardar o Editar libro
  const handleCreateOrUpdateLibro = async (libroData) => {
    if (!session?.user) return;
    try {
      if (editingBook) {
        const updated = await updateLibro(editingBook.id, libroData);
        setLibros((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        addToast('¡Libro actualizado con éxito!', 'success');
      } else {
        const created = await insertLibro(libroData, session.user.id);
        setLibros((prev) => [created, ...prev]);
        addToast('¡Libro publicado con éxito!', 'success');
      }
      setEditingBook(null);
      loadLibros();
    } catch (error) {
      console.error(error);
      addToast('No se pudo guardar la publicación.', 'error');
      throw error;
    }
  };

  // Iniciar edición (abre formulario con datos existentes)
  const handleEditClick = (libro) => {
    setEditingBook(libro);
    setIsModalOpen(true);
  };

  // Eliminar publicación
  const handleDeleteClick = async (libroId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta publicación del libro?')) return;
    try {
      await deleteLibro(libroId);
      setLibros((prev) => prev.filter((l) => l.id !== libroId));
      addToast('Libro eliminado de la plataforma.', 'success');
    } catch (error) {
      console.error(error);
      addToast('Error al intentar eliminar el libro.', 'error');
    }
  };

  // Iniciar chat con vendedor
  const handleStartChat = async (libro) => {
    if (!session?.user) return;
    try {
      const conv = await getOrCreateConversation(libro.id, session.user.id, libro.user_id);
      setTargetConversationId(conv.id);
      setActiveTab('mensajes');
    } catch (err) {
      console.error(err);
      addToast(err.message || 'No se pudo iniciar el chat privado.', 'error');
    }
  };

  // Pantalla de Login
  const renderLogin = () => (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">🏫</div>
        <h2 className="login-title">Colegio Emil Friedman</h2>
        <p className="login-subtitle">
          Bienvenido al Banco de Libros. Inicia sesión de forma segura con tu cuenta de Google para publicar o negociar libros de texto con otros padres y representantes.
        </p>
        <button type="button" className="btn-google" onClick={handleLogin}>
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
            alt="Google logo" 
            className="google-icon" 
          />
          Ingresar con Google
        </button>
      </div>
    </div>
  );

  // Alerta de conexión Supabase
  if (!isEnvConfigured) {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', textAlign: 'center' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--glass-border)', padding: '3.5rem 2rem', borderRadius: 'var(--radius-lg)', maxWidth: '600px', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔌</div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>Configuración de Supabase Requerida</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: '1.6' }}>
            Para que la plataforma funcione, vincula tu base de datos de Supabase.
          </p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, forzar pantalla de login
  if (!session?.user) {
    return renderLogin();
  }

  return (
    <div className="app-container">
      {/* Cabecera */}
      <header className="app-header">
        <div className="brand-section">
          <h1>📚 Banco de Libros</h1>
          <p>Marketplace escolar exclusivo del Colegio Emil Friedman</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {profile && (
            <div className="user-profile-widget">
              <span className="user-profile-name">{profile.nombre}</span>
              {profile.avatar_url && (
                <img src={profile.avatar_url} alt="Avatar" className="user-profile-avatar" />
              )}
            </div>
          )}
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setEditingBook(null);
              setIsModalOpen(true);
            }}
          >
            + Publicar
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.6rem 1rem' }}>
            Salir
          </button>
        </div>
      </header>

      {/* Navegación por pestañas */}
      <nav className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'catalogo' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('catalogo');
            setTargetConversationId(null);
          }}
        >
          🔍 Catálogo General
        </button>
        <button 
          className={`tab-btn ${activeTab === 'mis-libros' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mis-libros');
            setTargetConversationId(null);
          }}
        >
          📖 Mis Publicaciones
        </button>
        <button 
          className={`tab-btn ${activeTab === 'mensajes' ? 'active' : ''}`}
          onClick={() => setActiveTab('mensajes')}
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          💬 Mensajes Privados
          {totalUnread > 0 && <span className="tab-badge">{totalUnread}</span>}
        </button>
      </nav>

      {/* Vistas según pestaña activa */}
      {activeTab === 'mensajes' ? (
        <ChatInbox 
          currentUserId={session.user.id} 
          initialConvId={targetConversationId} 
          onUnreadCountChange={setTotalUnread}
        />
      ) : (
        <>
          {/* Panel de búsqueda y filtros (solo visible en Catálogo o Mis Publicaciones) */}
          <Filters filters={filters} onFilterChange={handleFilterChange} />

          <main style={{ minHeight: '400px' }}>
            {loading ? (
              <div className="loader-container">
                <div className="spinner"></div>
                <p className="spinner-text">Cargando libros...</p>
              </div>
            ) : libros.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📖</div>
                <h3>No se encontraron libros</h3>
                <p>
                  {activeTab === 'mis-libros' 
                    ? 'Aún no has publicado ningún libro escolar.' 
                    : 'Prueba a cambiar tus criterios de búsqueda o sé el primero en subir un libro.'}
                </p>
              </div>
            ) : (
              <div className="books-grid">
                {libros.map((libro) => (
                  <BookCard 
                    key={libro.id} 
                    libro={libro} 
                    currentUserId={session.user.id}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onChat={handleStartChat}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {/* Formulario Modal (para Crear y Editar) */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingBook ? 'Editar Publicación' : 'Publicar un Libro'}</h2>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingBook(null);
                }}
                aria-label="Cerrar modal"
              >
                &times;
              </button>
            </div>
            <BookForm 
              onSubmit={handleCreateOrUpdateLibro} 
              onClose={() => {
                setIsModalOpen(false);
                setEditingBook(null);
              }} 
              libro={editingBook}
            />
          </div>
        </div>
      )}

      {/* Notificaciones */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
