import { createClient } from '@supabase/supabase-js';

// Inicialización de las variables de entorno para Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Inicializar el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* --- MÉTODOS DE AUTENTICACIÓN --- */

/**
 * Inicia sesión con el proveedor de Google OAuth.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Sincroniza la cuenta del usuario logueado en la tabla pública de perfiles.
 * @param {Object} user - Objeto de usuario retornado por supabase.auth
 */
export async function syncUserProfile(user) {
  if (!user) return null;
  const nombreGoogle = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
  const avatarGoogle = user.user_metadata?.avatar_url || '';

  const { data, error } = await supabase
    .from('perfiles')
    .upsert({
      id: user.id,
      nombre: nombreGoogle,
      avatar_url: avatarGoogle,
    })
    .select();

  if (error) throw error;
  return data[0];
}

/* --- MÉTODOS DE LIBROS --- */

/**
 * Obtiene la lista de libros aplicando filtros y ordenamiento en tiempo real.
 * @param {Object} params
 * @param {string} params.search - Filtro por título o autor
 * @param {string} params.categoria - Filtro por materia/categoría
 * @param {string} params.grado - Filtro por año escolar venezolano
 * @param {string} params.tipoTrato - Filtro por tipo de trato
 * @param {string} params.userId - Filtro para traer solo libros de un usuario específico
 * @param {string} params.orderBy - Campo para ordenar
 * @param {boolean} params.ascending - Dirección de la ordenación
 */
export async function fetchLibros({ search, categoria, grado, tipoTrato, userId, orderBy, ascending = false }) {
  let query = supabase.from('libros').select('*');

  // Si queremos traer solo las publicaciones del usuario activo
  if (userId) {
    query = query.eq('user_id', userId);
  }

  // Búsqueda por título o autor usando ILIKE
  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    query = query.or(`titulo.ilike.${term},autor.ilike.${term}`);
  }

  // Filtro por categoría
  if (categoria && categoria !== 'Todas') {
    query = query.eq('categoria', categoria);
  }

  // Filtro por año escolar
  if (grado && grado !== 'Todos') {
    query = query.eq('grado', grado);
  }

  // Filtro por tipo de trato
  if (tipoTrato && tipoTrato !== 'Todos') {
    query = query.eq('tipo_trato', tipoTrato);
  }

  // Aplicar ordenamiento
  if (orderBy) {
    query = query.order(orderBy, { ascending });
  } else {
    // Por defecto, los más nuevos primero
    query = query.order('creado_en', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Guarda un nuevo libro asociado al usuario autenticado.
 * @param {Object} libroData - Datos del libro
 * @param {string} userId - UUID del usuario logueado
 */
export async function insertLibro(libroData, userId) {
  const formattedData = {
    user_id: userId,
    titulo: libroData.titulo.trim(),
    autor: libroData.autor.trim(),
    categoria: libroData.categoria,
    grado: libroData.grado,
    tipo_trato: libroData.tipo_trato,
    precio: libroData.tipo_trato === 'Venta' ? parseFloat(libroData.precio) : null,
    nombre_contacto: libroData.nombre_contacto.trim(),
    telefono_contacto: libroData.telefono_contacto.trim(),
  };

  const { data, error } = await supabase
    .from('libros')
    .insert([formattedData])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Edita un libro existente.
 * @param {string} libroId - ID del libro a editar
 * @param {Object} libroData - Nuevos datos del libro
 */
export async function updateLibro(libroId, libroData) {
  const formattedData = {
    titulo: libroData.titulo.trim(),
    autor: libroData.autor.trim(),
    categoria: libroData.categoria,
    grado: libroData.grado,
    tipo_trato: libroData.tipo_trato,
    precio: libroData.tipo_trato === 'Venta' ? parseFloat(libroData.precio) : null,
    nombre_contacto: libroData.nombre_contacto.trim(),
    telefono_contacto: libroData.telefono_contacto.trim(),
  };

  const { data, error } = await supabase
    .from('libros')
    .update(formattedData)
    .eq('id', libroId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Elimina un libro de la base de datos.
 * @param {string} libroId - ID del libro
 */
export async function deleteLibro(libroId) {
  const { error } = await supabase
    .from('libros')
    .delete()
    .eq('id', libroId);

  if (error) throw error;
  return true;
}

/* --- MÉTODOS DE CHAT --- */

/**
 * Obtiene una conversación existente o crea una nueva si no existe.
 */
export async function getOrCreateConversation(libroId, compradorId, vendedorId) {
  // Evitar chats consigo mismo
  if (compradorId === vendedorId) {
    throw new Error('No puedes chatear contigo mismo por tu propia publicación.');
  }

  // Buscar conversación existente
  const { data: existing, error: searchError } = await supabase
    .from('conversaciones')
    .select('*')
    .eq('libro_id', libroId)
    .eq('comprador_id', compradorId)
    .eq('vendedor_id', vendedorId)
    .maybeSingle();

  if (searchError) throw searchError;
  if (existing) return existing;

  // Si no existe, crear la nueva
  const { data: created, error: createError } = await supabase
    .from('conversaciones')
    .insert([{
      libro_id: libroId,
      comprador_id: compradorId,
      vendedor_id: vendedorId
    }])
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

/**
 * Recupera todas las conversaciones del usuario activo.
 */
export async function fetchConversations(userId) {
  const { data, error } = await supabase
    .from('conversaciones')
    .select(`
      id,
      creado_en,
      libro_id,
      libros (
        titulo
      ),
      comprador_id,
      vendedor_id,
      comprador: comprador_id (nombre, avatar_url),
      vendedor: vendedor_id (nombre, avatar_url),
      mensajes (
        id,
        remitente_id,
        leido
      )
    `)
    .or(`comprador_id.eq.${userId},vendedor_id.eq.${userId}`)
    .order('creado_en', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Obtiene los mensajes de una conversación específica.
 */
export async function fetchMessages(conversacionId) {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('creado_en', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Envía un mensaje en un chat específico.
 */
export async function sendMessage(conversacionId, remitenteId, contenido) {
  const { data, error } = await supabase
    .from('mensajes')
    .insert([{
      conversacion_id: conversacionId,
      remitente_id: remitenteId,
      contenido: contenido.trim(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marca como leídos todos los mensajes recibidos en una conversación.
 */
export async function markMessagesAsRead(conversacionId, userId) {
  const { data, error } = await supabase
    .from('mensajes')
    .update({ leido: true })
    .eq('conversacion_id', conversacionId)
    .neq('remitente_id', userId) // Solo marcar leídos los del otro usuario
    .eq('leido', false)
    .select();

  if (error) throw error;
  return data;
}
