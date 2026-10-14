# Guía para trabajar en la plataforma Lacar Sports (Mac)

Esta guía es para mejorar el diseño de **lacarsports.cl** desde tu Mac, con Claude Code.
No necesitas saber programar: le pides las cosas a Claude en palabras normales y él hace
el trabajo técnico.

## Cómo funciona

1. Le pides a Claude un cambio (por ejemplo: *"cambia el color del botón de buscar"*).
2. Claude lo guarda en **tu propia copia de prueba** (una "rama") y la sube a internet.
3. En unos **2 minutos** tienes un **enlace de prueba** para verlo en el celular o el computador.
   El sitio oficial no cambia.
4. Cuando te guste, le pides a Claude que **pida la publicación**. El dueño lo revisa y lo
   aprueba, y recién ahí sale en lacarsports.cl.

> Las versiones de prueba usan la **misma base de datos real** que el sitio oficial.
> Si creas una jugada probando, queda creada de verdad.

---

## 1. Preparar tu Mac (una sola vez, ~15 minutos)

1. **Cuenta de GitHub**: créala en <https://github.com> (gratis). Envíale tu usuario al
   dueño para que te invite al proyecto, y **acepta la invitación** que te llega por correo.
2. **Claude Code**: descarga la app de escritorio en <https://claude.com/download> e inicia
   sesión con tu cuenta.
3. **Git**: abre la app **Terminal** (búscala con ⌘ + espacio), escribe `git --version` y
   presiona Enter. Si el Mac ofrece instalar las "herramientas de línea de comandos",
   acepta y espera a que termine.
4. **GitHub CLI** (para que Claude pueda subir tus cambios con tu cuenta): descarga el
   instalador para macOS en <https://cli.github.com> (archivo `.pkg`) e instálalo como
   cualquier programa.

## 2. Conectar todo (una sola vez)

Abre Claude Code y pégale este mensaje:

> Quiero trabajar en el proyecto github.com/LacarSports/canchas-videos.
> 1. Conecta GitHub CLI con mi cuenta de GitHub (`gh auth login` por el navegador) y
>    configura git para usarla (`gh auth setup-git`).
> 2. Descarga el proyecto en una carpeta "Lacar Sports" dentro de Documentos.
> 3. Ábrelo como carpeta de trabajo y lee CLAUDE.md, AGENTS.md y GUIA_COLABORADORES.md.

Se va a abrir el navegador para que autorices el acceso a tu cuenta de GitHub. Acepta.

## 3. Hacer un cambio

Cada vez que quieras cambiar algo, empieza así:

> Trae lo último de main y crea una rama nueva llamada `diseno-[tema]`
> (por ejemplo `diseno-buscador`).

Luego pide los cambios que quieras, uno por uno. Cuando quieras verlos:

> Sube mis cambios a mi rama y pásame el enlace de la versión de prueba de Vercel.

Claude te va a dar un enlace. Ábrelo en el celular: la mayoría de los jugadores entra desde
el teléfono. Si quieres ajustar algo, sigue pidiendo cambios en la misma rama y vuelve a
pedir *"sube mis cambios"*. El enlace se actualiza solo en ~2 minutos.

## 4. Pedir que se publique

Cuando el cambio esté listo:

> Crea una pull request de mi rama hacia main, con una descripción simple de lo que cambié
> y el enlace de la versión de prueba.

La dueña recibe el aviso, lo revisa y lo aprueba. Si te pide ajustes, haces los cambios en
**la misma rama** y pides *"sube mis cambios"*: la solicitud se actualiza sola.

Después de que se publique, para el siguiente tema vuelve al paso 3: **siempre una rama nueva
por tema**.

## 5. Trabajar dos personas al mismo tiempo

Se puede, porque cada uno trabaja en su rama. Para evitar choques:

- **Siempre empieza con "trae lo último de main"** antes de un tema nuevo.
- **Avísale a la dueña en qué parte estás trabajando** (por ejemplo, "la página de inicio"),
  para no cambiar los dos la misma cosa.
- **Temas cortos**: mejor varias solicitudes chicas que una enorme.
- Si GitHub avisa de un **"conflicto"** (los dos cambiaron lo mismo), pídele a Claude:
  *"trae los últimos cambios de main a mi rama y resuelve los conflictos"*.

## 6. Qué tocar y qué no (por ahora)

**Libre (diseño):** textos, colores, tipografías, imágenes, la página de inicio, el buscador,
las tarjetas de partidos, la página para complejos, el pie de página, etc.

**Consultar con la dueña antes de tocar** (son delicados y es fácil romper algo que no se ve):
- El reproductor de video y la creación/descarga de jugadas.
- El panel de los complejos.
- La base de datos, las rutas `app/api/` y la carpeta `Lacar System/` (las cámaras).

Claude conoce estas reglas porque lee los archivos del proyecto.

## 7. Cuidados

- **Nunca publiques directo en `main`**: siempre por una solicitud (pull request). GitHub
  igual lo bloquea.
- **Nunca pegues claves ni contraseñas en el proyecto.** El código es **público**.

---

### Opcional: ver los cambios al instante en tu Mac

Si algún día quieres ver los cambios sin esperar los 2 minutos de Vercel, pídele a Claude:
*"instala Node.js, copia .env.example como .env.local y levanta el servidor local"*. Los
cambios se ven al instante en <http://localhost:3000>, pero solo en tu Mac, no en el celular.
