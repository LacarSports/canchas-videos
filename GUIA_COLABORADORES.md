# Guía para trabajar en la plataforma Lacar Sports

Esta guía es para quien se suma a mejorar la plataforma (lacarsports.cl) desde su propio
computador, usando Claude Code como lo hace el equipo.

## Cómo está armado (en 30 segundos)

- **El código vive en GitHub**: `github.com/LacarSports/canchas-videos`.
- **Vercel publica lo que hay en GitHub**:
  - lo que entra a la rama **`main`** sale al sitio oficial **lacarsports.cl**;
  - cualquier **otra rama** genera una **versión de prueba** con su propio enlace, que no
    afecta al sitio oficial.
- **Regla de oro:** nadie trabaja directo en `main`. Cada uno trabaja en su rama, la revisa
  en su versión de prueba y pide que la publiquen. La dueña aprueba antes de que llegue al
  sitio oficial.

> Ojo: las versiones de prueba usan la **misma base de datos real** que el sitio oficial.
> Si creas una jugada probando, queda creada de verdad.

---

## 1. Lo que hay que instalar (una sola vez)

1. **Git**: <https://git-scm.com/downloads>. Instalar con las opciones por defecto.
2. **Node.js versión 24** (LTS): <https://nodejs.org>.
3. **Claude Code** (app de escritorio o terminal) con tu propia cuenta: <https://claude.com/claude-code>.
4. Una cuenta de **GitHub** (<https://github.com>). Envíale tu usuario a la dueña para que te
   invite al repositorio, y **acepta la invitación** que llega a tu correo.

## 2. Descargar el proyecto (una sola vez)

En una terminal, en la carpeta donde quieras guardar el proyecto:

```bash
git clone https://github.com/LacarSports/canchas-videos.git
cd canchas-videos
npm install
```

Luego crea tu archivo de configuración copiando la plantilla:

```bash
cp .env.example .env.local
```

La plantilla ya trae las claves **públicas** necesarias para ver la plataforma. Las claves
secretas no hacen falta para diseño (ver el detalle dentro de `.env.example`).

## 3. Ver la plataforma en tu computador

```bash
npm run dev
```

Abre <http://localhost:3000>. Cada cambio que guardes se ve al instante.

Algunas páginas exigen iniciar sesión (por ejemplo, ver un partido). Usa tu propia cuenta de
la plataforma: créala en el sitio oficial, en "Iniciar sesión" → "Crear cuenta".

## 4. Hacer un cambio, paso a paso

Puedes pedirle cada paso a Claude en palabras simples, por ejemplo: *"crea una rama nueva para
cambiar los colores del buscador"*. Por debajo pasa esto:

1. **Traer lo último del sitio oficial** antes de empezar (evita trabajar sobre algo viejo):
   ```bash
   git checkout main
   git pull
   ```
2. **Crear una rama** con un nombre que diga qué vas a hacer:
   ```bash
   git checkout -b diseno-buscador
   ```
3. **Hacer los cambios** (con Claude) y revisarlos en <http://localhost:3000>.
4. **Guardar y subir la rama** a GitHub:
   ```bash
   git add -A
   git commit -m "Nuevo diseño del buscador"
   git push -u origin diseno-buscador
   ```
5. En unos 2 minutos **Vercel arma la versión de prueba** de tu rama. El enlace aparece en
   GitHub, en la página de tu rama o de tu solicitud (el ✓ de "Vercel" → "Details"). Ábrelo
   en el celular también: la mayoría de los jugadores entra desde el teléfono.
6. **Pedir que se publique**: en GitHub aparece el botón amarillo **"Compare & pull request"**.
   Ábrelo, escribe qué cambiaste (idealmente con capturas antes/después) y créalo.
7. La dueña lo revisa en la versión de prueba y, si está bien, lo **aprueba y publica**
   ("Merge"). En ~2 minutos queda en lacarsports.cl.

Si te pide cambios, sigues trabajando en la **misma rama** y vuelves a hacer `git push`: la
solicitud y la versión de prueba se actualizan solas.

## 5. Trabajar dos personas a la vez

Se puede trabajar en paralelo sin problema: cada uno en su rama. Para evitar choques:

- **Antes de empezar algo nuevo**, siempre `git checkout main` + `git pull` y una rama nueva.
- **Ramas cortas**: un cambio = una rama = una solicitud. Mejor varias chicas que una gigante
  de dos semanas.
- **Avisarse en qué archivos se está trabajando.** Si los dos cambian el mismo archivo, al
  publicar el segundo GitHub avisa de un "conflicto". Claude lo puede resolver: pídele *"trae
  los últimos cambios de main a mi rama y resuelve los conflictos"*.
- **Si tu solicitud lleva días abierta** y en `main` ya se publicaron otras cosas, actualízala
  antes de pedir la aprobación (la misma frase de arriba).

## 6. Qué tocar y qué no (por ahora)

**Libre (diseño):** textos, colores, tipografías, imágenes, la página de inicio, el buscador,
las tarjetas de partidos, la página de complejos, el pie de página, etc. La paleta de colores
está en `app/globals.css`.

**Consultar antes de tocar** (son delicados y es fácil romper algo que no se ve a simple vista):
- El reproductor de video y la creación/descarga de jugadas: `app/partido/[id]/`
  (`VideoClipSelector.tsx`, `exportarNucleo.ts`, `exportarClip.*`), `app/components/InlineClipPlayer.tsx`,
  `lib/encuadre.ts`, `lib/marcaAgua.ts`.
- El panel de los complejos: `app/auth/complejo/`.
- Todo lo de `app/api/`, `supabase/`, `SUPABASE.md` y la carpeta `Lacar System/` (la Raspberry).

Claude lee automáticamente las reglas del proyecto (`CLAUDE.md`, `AGENTS.md`, `SUPABASE.md`).

## 7. Cuidados

- **Nunca subas claves a GitHub.** El repositorio es **público**: cualquiera puede leer el
  código. `.env.local` está excluido a propósito; no lo saques de esa lista.
- No publiques directo en `main`: siempre por una solicitud ("pull request").
- Si algo se rompe en tu computador, `git status` muestra qué cambiaste y Claude puede
  ayudarte a deshacerlo.
