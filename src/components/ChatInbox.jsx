import React, { useState, useEffect, useRef } from 'react';
import { supabase, fetchConversations, fetchMessages, sendMessage, markMessagesAsRead } from '../supabaseClient';

/**
 * Componente que gestiona el inbox de chat privado y la mensajería en tiempo real.
 * Incorpora actualizaciones instantáneas (optimistas), notificaciones de no leídos
 * e integración con canales en tiempo real globales.
 * 
 * @param {Object} props
 * @param {string} props.currentUserId - ID del usuario logueado
 * @param {string} [props.initialConvId] - ID de conversación seleccionada por defecto
 */
export default function ChatInbox({ currentUserId, initialConvId, onUnreadCountChange }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const messagesEndRef = useRef(null);

  // Cargar las conversaciones activas y calcular los no leídos
  const loadConversations = async (selectId = null) => {
    try {
      const data = await fetchConversations(currentUserId);
      const processed = (data || []).map((c) => {
        // Contar cuántos mensajes son del otro usuario y no están leídos
        const unreadCount = (c.mensajes || []).filter(
          (m) => m.remitente_id !== currentUserId && !m.leido
        ).length;
        return { ...c, unreadCount };
      });
      setConversations(processed);
      
      // Auto-seleccionar conversación
      const targetId = selectId || initialConvId;
      if (targetId && processed.length > 0) {
        const found = processed.find((c) => c.id === targetId);
        if (found) {
          setSelectedConv(found);
          // Si tiene no leídos, marcarlos como leídos en base de datos
          if (found.unreadCount > 0) {
            await markMessagesAsRead(found.id, currentUserId);
            setConversations((prev) => 
              prev.map((c) => c.id === found.id ? { ...c, unreadCount: 0 } : c)
            );
          }
        }
      }
    } catch (err) {
      console.error('Error al cargar conversaciones:', err);
    } finally {
      setLoadingConvs(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    loadConversations();
  }, [currentUserId, initialConvId]);

  // Sincronizar el total de no leídos con el componente principal (App.jsx)
  useEffect(() => {
    if (onUnreadCountChange) {
      const total = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      onUnreadCountChange(total);
    }
  }, [conversations, onUnreadCountChange]);

  // Cargar mensajes cuando cambia la conversación seleccionada
  useEffect(() => {
    if (!selectedConv) return;

    const loadMessages = async () => {
      setLoadingMsgs(true);
      try {
        const data = await fetchMessages(selectedConv.id);
        setMessages(data || []);
      } catch (err) {
        console.error('Error al cargar mensajes:', err);
      } finally {
        setLoadingMsgs(false);
      }
    };

    loadMessages();
  }, [selectedConv]);

  // Escuchar mensajes nuevos globales en tiempo real para todos los chats propios
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
        },
        (payload) => {
          const newMsg = payload.new;
          
          setConversations((prev) => {
            // Verificar si ya conocemos la conversación
            const exists = prev.some((c) => c.id === newMsg.conversacion_id);
            if (!exists) {
              // Si es una conversación totalmente nueva (iniciada por otro), recargar bandeja
              loadConversations();
              return prev;
            }

            return prev.map((c) => {
              if (c.id === newMsg.conversacion_id) {
                // Incrementar contador si el mensaje es del otro y no tenemos abierto ese chat
                const isForMe = newMsg.remitente_id !== currentUserId;
                const isActive = selectedConv && selectedConv.id === c.id;
                const newUnreadCount = (isForMe && !isActive) ? (c.unreadCount || 0) + 1 : c.unreadCount;
                return { ...c, unreadCount: newUnreadCount };
              }
              return c;
            });
          });

          // Si el mensaje es del chat activo actual, agregarlo al historial
          if (selectedConv && newMsg.conversacion_id === selectedConv.id) {
            setMessages((prev) => {
              // Evitar duplicados con la inserción optimista
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Si es un mensaje recibido, marcarlo como leído inmediatamente en base de datos
            if (newMsg.remitente_id !== currentUserId) {
              markMessagesAsRead(selectedConv.id, currentUserId).catch(console.error);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, currentUserId]);

  // Scroll automático al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMsgs]);

  // Enviar mensaje con actualización optimista
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    // 1. Mensaje optimista temporal (aparece instantáneamente)
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversacion_id: selectedConv.id,
      remitente_id: currentUserId,
      contenido: textToSend,
      creado_en: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      // 2. Enviar a Supabase
      const realMsg = await sendMessage(selectedConv.id, currentUserId, textToSend);
      // 3. Reemplazar el temporal con el guardado real de Supabase
      setMessages((prev) => 
        prev.map((msg) => msg.id === tempId ? realMsg : msg)
      );
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      // Eliminar temporal si falló la red
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const getOtherParticipant = (conv) => {
    const isComprador = conv.comprador_id === currentUserId;
    const profile = isComprador ? conv.vendedor : conv.comprador;
    return {
      nombre: profile?.nombre || 'Usuario del Colegio',
      avatar: profile?.avatar_url || '',
    };
  };

  return (
    <div className="chat-layout">
      {/* 1. Lista de conversaciones a la izquierda */}
      <aside className="chat-sidebar">
        <h3 className="chat-sidebar-title">Bandeja de Mensajes</h3>
        {loadingConvs ? (
          <div className="chat-sidebar-loading">
            <div className="spinner" style={{ width: '25px', height: '25px' }}></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="chat-sidebar-empty">
            No tienes chats activos. Inicia uno desde el catálogo de libros.
          </div>
        ) : (
          <div className="chat-list">
            {conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isSelected = selectedConv && selectedConv.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  className={`chat-item-btn ${isSelected ? 'active' : ''}`}
                  onClick={async () => {
                    setSelectedConv(conv);
                    // Marcar como leídos al hacer clic
                    if (conv.unreadCount > 0) {
                      try {
                        await markMessagesAsRead(conv.id, currentUserId);
                        setConversations((prev) => 
                          prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c)
                        );
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                >
                  <div className="chat-avatar-wrapper">
                    {other.avatar ? (
                      <img src={other.avatar} alt={other.nombre} className="chat-avatar" />
                    ) : (
                      <div className="chat-avatar-placeholder">
                        {other.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="chat-item-info">
                    <span className="chat-item-name">{other.nombre}</span>
                    <span className="chat-item-book">Libro: {conv.libros?.titulo || 'Desconocido'}</span>
                  </div>
                  {/* Puntito de mensajes sin leer (Estilo Whatsapp) */}
                  {conv.unreadCount > 0 && (
                    <span className="chat-unread-dot" title="Mensajes sin leer"></span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* 2. Conversación activa a la derecha */}
      <section className="chat-window">
        {selectedConv ? (
          <>
            {/* Cabecera del chat */}
            <div className="chat-header">
              <div className="chat-header-user">
                <div className="chat-avatar-wrapper">
                  {getOtherParticipant(selectedConv).avatar ? (
                    <img
                      src={getOtherParticipant(selectedConv).avatar}
                      alt={getOtherParticipant(selectedConv).nombre}
                      className="chat-avatar"
                    />
                  ) : (
                    <div className="chat-avatar-placeholder">
                      {getOtherParticipant(selectedConv).nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="chat-header-info">
                  <h4>{getOtherParticipant(selectedConv).nombre}</h4>
                  <p>Interés: {selectedConv.libros?.titulo || 'Libro del Colegio'}</p>
                </div>
              </div>
            </div>

            {/* Historial de mensajes */}
            <div className="chat-messages-container">
              {loadingMsgs ? (
                <div className="loader-container" style={{ minHeight: '100%' }}>
                  <div className="spinner"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-conversation-empty">
                  Saluda al vendedor para iniciar la negociación del libro.
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.remitente_id === currentUserId;
                  const time = new Date(msg.creado_en).toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div key={msg.id} className={`message-row ${isMe ? 'me' : 'other'}`}>
                      <div className="message-bubble">
                        <p className="message-text">{msg.contenido}</p>
                        <span className="message-time">{time}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para redactar mensaje */}
            <form onSubmit={handleSend} className="chat-input-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 1.5rem' }}>
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="chat-window-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            <h3>Tu Bandeja de Chats</h3>
            <p>Selecciona un chat de la lista de la izquierda para ver los mensajes o inicia una nueva conversación desde las tarjetas del catálogo.</p>
          </div>
        )}
      </section>
    </div>
  );
}
