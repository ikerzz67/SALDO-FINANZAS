# SALDO — Finanzas personales

Aplicación web adaptable a móvil y ordenador para gestionar ingresos, gastos, presupuestos, estadísticas, objetivos de ahorro y gastos recurrentes. Incluye tema claro/oscuro.

## Importante: dos móviles y privacidad

- **Modo local (sin configurar Supabase):** funciona en ese navegador y guarda los datos en `localStorage`. No sincroniza con otro móvil y los datos no están protegidos por una cuenta.
- **Modo nube (recomendado para dos móviles):** conecta con Supabase Auth y una base de datos PostgreSQL. Cada persona crea su propia cuenta. Las políticas Row Level Security (RLS) de `supabase-schema.sql` limitan cada tabla a las filas del usuario autenticado. Los datos se sincronizan entre dispositivos al iniciar sesión con la misma cuenta.
- Si quieres que tú y tu padre tengáis espacios privados, cada uno debe crear su **propia cuenta y correo/contraseña**. No compartáis credenciales.
- GitHub Pages solo aloja los archivos estáticos. Supabase es el servicio que autentica y sincroniza. El frontend incluye la clave pública `anon/publishable`, nunca la `service_role`.
- No conectes cuentas bancarias ni guardes datos bancarios sensibles en esta app. Es un registro manual de finanzas, no una app bancaria regulada.

## 1. Publicar gratis en GitHub Pages

1. Descarga y descomprime `saldo-finanzas.zip`.
2. Entra en GitHub y pulsa **New repository**.
3. Ponle un nombre, por ejemplo `saldo-finanzas`. Puedes marcarlo **Public** para usar GitHub Pages gratis.
4. Pulsa **Add file → Upload files**.
5. Sube los archivos y carpetas descomprimidos, no el ZIP en sí. `index.html` debe quedar en la raíz del repositorio.
6. Pulsa **Commit changes**.
7. En el repositorio entra en **Settings → Pages**.
8. En **Build and deployment**, selecciona **Deploy from a branch**; branch `main`, folder `/(root)` y pulsa **Save**.
9. Espera a que GitHub publique la web y abre la URL que aparece en esa página.
10. En el iPhone, abre la URL en Safari → botón **Compartir** → **Añadir a pantalla de inicio**. En Android, abre la URL en Chrome → menú ⋮ → **Instalar aplicación** o **Añadir a pantalla de inicio**.

## 2. Activar sincronización privada entre móviles (Supabase)

### A. Crear proyecto

1. Ve a https://supabase.com y crea una cuenta/proyecto.
2. Guarda la contraseña de la base de datos en un gestor seguro.
3. En el proyecto, abre **SQL Editor → New query**.
4. Copia todo el contenido de `supabase-schema.sql`, pégalo y pulsa **Run**.
5. En **Project Settings → API** (o **Connect**, según la interfaz), copia la **Project URL** y la clave **anon/publicable**. Los nombres de menú pueden cambiar.

### B. Configurar la app

1. En GitHub, abre `config.js` y pulsa el lápiz para editar.
2. Rellena los dos valores, conservando las comillas:

```js
window.SALDO_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabaseAnonKey: "TU_CLAVE_ANON_O_PUBLISHABLE"
};
```

3. Guarda los cambios con **Commit changes** y espera a que Pages actualice la web.
4. En Supabase, entra en **Authentication → URL Configuration**.
5. Añade la URL exacta de GitHub Pages como **Site URL** y como URL de redirección permitida. Ejemplo: `https://TU-USUARIO.github.io/saldo-finanzas/`. Usa tu URL real, no el ejemplo.
6. Para facilitar las pruebas, puedes desactivar temporalmente la confirmación de correo en Authentication → Providers → Email. Para uso real, es preferible mantenerla activada y configurar el envío de correo.

### C. Crear los dos espacios privados

1. Abre la web publicada.
2. Pulsa **Crear cuenta** y crea tu cuenta con tu propio correo y una contraseña de al menos 8 caracteres.
3. Tu padre debe abrir la misma web y crear una cuenta distinta con su propio correo.
4. Si la confirmación por correo está activada, cada uno debe confirmar su email antes de iniciar sesión.
5. Cada uno inicia sesión con su propia cuenta. Al abrir la web desde otro dispositivo, iniciad sesión con la misma cuenta de ese usuario para ver sus datos sincronizados.

## 3. Copias de seguridad

En **Cuenta y ajustes** puedes exportar una copia JSON. Guarda el archivo en un lugar privado y seguro. También puedes exportar movimientos a CSV para abrirlos en Excel o Google Sheets. La exportación CSV contiene movimientos; la copia JSON incluye los datos de la aplicación.

## 4. Qué incluye

- Panel de resumen mensual.
- Ingresos y gastos con categorías, búsqueda, filtros y edición.
- Presupuestos por categoría.
- Estadísticas y comparativa de los últimos seis meses.
- Objetivos de ahorro.
- Gastos recurrentes con botón para registrar cada pago.
- Tema claro/oscuro.
- Exportación CSV y copia de seguridad JSON.
- Diseño responsive para móvil y escritorio.

## 5. Limitaciones conocidas

- No importa movimientos automáticamente desde bancos.
- Los gastos recurrentes no se registran solos: son recordatorios y hay que pulsar **Registrar pago**.
- La nube requiere que configures Supabase y ejecutes el SQL antes de crear cuentas.
- Si no se configura Supabase, los datos permanecen en el navegador local y no se sincronizan.
- Si modificas los archivos, vuelve a subirlos/confirmar los cambios en GitHub para que Pages publique la nueva versión.
