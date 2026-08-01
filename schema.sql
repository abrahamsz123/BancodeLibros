-- Script para crear la tabla de libros con restricciones y validaciones.
-- Puedes copiar y pegar este código directamente en el "SQL Editor" de tu proyecto de Supabase.

-- 1. Limpiar tablas existentes para evitar conflictos
DROP TABLE IF EXISTS mensajes;
DROP TABLE IF EXISTS conversaciones;
DROP TABLE IF EXISTS libros;
DROP TABLE IF EXISTS perfiles;

-- 2. Tabla de perfiles públicos (sincronizados con Google)
CREATE TABLE perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    avatar_url TEXT
);

-- 3. Tabla de libros
CREATE TABLE libros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL CHECK (char_length(trim(titulo)) > 0),
    autor TEXT NOT NULL CHECK (char_length(trim(autor)) > 0),
    categoria TEXT NOT NULL CHECK (char_length(trim(categoria)) > 0),
    grado TEXT NOT NULL CHECK (char_length(trim(grado)) > 0), -- Año/grado venezolano
    tipo_trato TEXT NOT NULL CHECK (tipo_trato IN ('Venta', 'Regalo', 'Intercambio')),
    precio NUMERIC CHECK (
        (tipo_trato = 'Venta' AND precio IS NOT NULL AND precio >= 0) OR
        (tipo_trato <> 'Venta' AND precio IS NULL)
    ),
    nombre_contacto TEXT NOT NULL CHECK (char_length(trim(nombre_contacto)) > 0),
    telefono_contacto TEXT NOT NULL CHECK (char_length(trim(telefono_contacto)) > 0)
);

-- 4. Tabla de conversaciones (apuntando a perfiles para permitir JOINs de nombres/fotos)
CREATE TABLE conversaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    libro_id UUID REFERENCES libros(id) ON DELETE CASCADE,
    comprador_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (comprador_id, vendedor_id, libro_id)
);

-- 5. Tabla de mensajes de chat (con columna de leido)
CREATE TABLE mensajes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE NOT NULL,
    remitente_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    contenido TEXT NOT NULL CHECK (char_length(trim(contenido)) > 0),
    leido BOOLEAN DEFAULT false NOT NULL
);

-- 6. Índices para mejorar la velocidad
CREATE INDEX idx_libros_grado ON libros(grado);
CREATE INDEX idx_libros_categoria ON libros(categoria);
CREATE INDEX idx_conversaciones_participantes ON conversaciones(comprador_id, vendedor_id);
CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id);

-- 7. Habilitar RLS (Row Level Security)
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE libros ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- 8. Políticas de Seguridad (RLS)
-- Perfiles
CREATE POLICY "Lectura libre de perfiles" ON perfiles FOR SELECT USING (true);
CREATE POLICY "Edición propia de perfiles" ON perfiles FOR ALL USING (auth.uid() = id);

-- Libros
CREATE POLICY "Lectura libre de libros" ON libros FOR SELECT USING (true);
CREATE POLICY "Inserción libre de libros autenticados" ON libros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Edición de libros propios" ON libros FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Borrado de libros propios" ON libros FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Conversaciones
CREATE POLICY "Ver conversaciones propias" ON conversaciones FOR SELECT TO authenticated USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id);
CREATE POLICY "Crear conversaciones" ON conversaciones FOR INSERT TO authenticated WITH CHECK (auth.uid() = comprador_id);

-- Mensajes
CREATE POLICY "Ver mensajes de mis conversaciones" ON mensajes FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM conversaciones WHERE conversaciones.id = mensajes.conversacion_id AND (conversaciones.comprador_id = auth.uid() OR conversaciones.vendedor_id = auth.uid())
    )
);
CREATE POLICY "Enviar mensajes a mis conversaciones" ON mensajes FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = remitente_id AND
    EXISTS (
        SELECT 1 FROM conversaciones WHERE conversaciones.id = mensajes.conversacion_id AND (conversaciones.comprador_id = auth.uid() OR conversaciones.vendedor_id = auth.uid())
    )
);
CREATE POLICY "Permitir marcar como leido" ON mensajes FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM conversaciones WHERE conversaciones.id = mensajes.conversacion_id AND (conversaciones.comprador_id = auth.uid() OR conversaciones.vendedor_id = auth.uid())
    )
);

-- 9. HABILITAR TIEMPO REAL (REALTIME) PARA MENSAJES
-- Esto le indica a Supabase que transmita cualquier inserción o cambio en tiempo real al frontend
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
