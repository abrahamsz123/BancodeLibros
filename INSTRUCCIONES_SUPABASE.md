# Guía de Configuración de Supabase - Banco de Libros

¡Hola! Esta guía te explicará paso a paso cómo configurar tu base de datos en Supabase y cómo conectar la aplicación. No te preocupes si nunca has usado Supabase, es muy sencillo. Sigue estos pasos:

---

## Paso 1: Crear un Proyecto en Supabase
1. Inicia sesión en tu cuenta en [Supabase](https://supabase.com/).
2. En el panel principal (Dashboard), haz clic en el botón **"New project"** (Nuevo proyecto).
3. Selecciona tu Organización (si tienes una) o usa la por defecto.
4. Rellena los datos de tu proyecto:
   - **Name (Nombre)**: `Banco de Libros` (o el que tú prefieras).
   - **Database Password (Contraseña de Base de Datos)**: Haz clic en "Generate a password" (Generar contraseña) o escribe una de tu preferencia. **Guárdala bien**, la podrías necesitar en el futuro.
   - **Region**: Elige una cercana a tu ubicación (por ejemplo, `South America (São Paulo)` o `East US`).
   - **Pricing Plan**: Asegúrate de seleccionar el plan **Free** (Gratuito).
5. Haz clic en **"Create new project"**. Espera un par de minutos a que Supabase termine de configurar tu base de datos (verás un indicador de carga).

---

## Paso 2: Crear la Tabla de Datos
Una vez que el proyecto esté listo (el panel de control cargue por completo):
1. En el menú lateral izquierdo de Supabase, busca y haz clic en el icono del **SQL Editor** (parece una caja con una terminal o una hoja con un rayo).
2. Haz clic en **"New query"** (Nueva consulta) o **"Quickstart"** -> **"Blank query"**.
3. Abre el archivo [schema.sql](file:///c:/Users/Jose%20Zambrano/OneDrive/Desktop/Antigravity%20P/Banco%20de%20Libros/schema.sql) que he creado en este proyecto. Copia todo su contenido.
4. Pega ese código en la caja de texto del SQL Editor en Supabase.
5. Haz clic en el botón **"Run"** (Ejecutar) en la esquina inferior derecha.
6. Deberías ver un mensaje que dice `Success. No rows returned.` en la consola. ¡Listo! Tu tabla `libros` y sus índices se han creado con éxito.

---

## Paso 3: Obtener tus Claves de Conexión (API Keys)
Para que nuestra aplicación React pueda guardar y leer los libros de Supabase, necesitamos dos datos: la URL de tu proyecto y la Clave Anónima.
1. En el menú lateral izquierdo de Supabase, haz clic en el icono del engranaje (**Project Settings** o Configuración del Proyecto).
2. Entra en la sección **"API"**.
3. En la parte superior de esa página verás:
   - **Project URL**: Es una dirección web que termina en `.supabase.co`. Haz clic en **"Copy"** para copiarla.
   - **Project API Keys** (específicamente la clave que dice **`anon` / `public`**): Es una cadena muy larga de caracteres. Haz clic en **"Copy"** para copiarla. *(¡No uses la clave service_role, usa únicamente la anon/public!)*

---

## Paso 4: Configurar el Archivo de Entorno en React
1. En la raíz de este proyecto (aquí mismo donde está esta guía), crea un archivo llamado `.env` (si no existe ya).
2. Añade las siguientes líneas, reemplazando los valores de ejemplo con tus datos copiados en el Paso 3:

```env
VITE_SUPABASE_URL=TU_PROJECT_URL_AQUÍ
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUÍ
```

*(Nota: En Vite, todas las variables de entorno deben comenzar con `VITE_` para que se puedan leer desde el frontend).*

3. Guarda el archivo `.env`.

¡Listo! Cuando inicies la aplicación con `npm run dev`, React se conectará de manera automática y segura a tu base de datos de Supabase.
