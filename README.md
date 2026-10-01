# Sirensence

Sitio musical y creativo de Sirensence. Página oficial prevista: https://sirensence.com/

## Contenido

- Discografía con portadas, búsqueda por discos y canciones, filtros y listas de temas.
- Waterful Ring Toss 2D: imagen oficial, modos, plataformas, tráiler y enlace a itch.io.
- Enlaces a Spotify, Apple Music, Crystal Soul Records y Alejandro Emmanuel Arroyo Vargas.

## Actualizaciones automáticas

`.github/workflows/sync-releases.yml` revisa el catálogo cada seis horas y permite ejecución manual en Actions → Sync music releases → Run workflow.

Usa la API pública de Apple/iTunes para el artista Sirensence (1792750613), mercado México. No necesita Spotify Premium, claves de Spotify ni servicios de pago. Un lanzamiento se añade cuando está disponible en esa fuente; no necesariamente al mismo tiempo que en Spotify.

Se conservan los enlaces directos de Spotify en `data/manual-links.json`. Si todavía no hay un enlace directo conocido para un lanzamiento nuevo, el botón abre una búsqueda en Spotify. La portada, la fecha y las canciones se actualizan automáticamente. El contador se calcula a partir del catálogo.

Una respuesta vacía o una lista incompleta de canciones detiene la actualización antes de escribir datos. Los lanzamientos históricos no se eliminan automáticamente si una fuente regional los omite. La fecha mostrada es la última modificación del catálogo, no la última revisión sin cambios.

El flujo valida el código, actualiza `data/auto-catalog.json`, guarda un commit cuando hay cambios y solicita una reconstrucción de GitHub Pages. Usa únicamente el token temporal de GitHub Actions con escritura de contenido y Pages en este repositorio.

## Desarrollo

Requiere Node.js 24. Sin dependencias de npm.

```sh
npm test
npm run sync
```

GitHub Pages: publicar desde `main`, carpeta raíz. Las imágenes del juego y las portadas se muestran desde sus fuentes oficiales en itch.io y Apple.

## Dominio

La conexión a `sirensence.com` requiere configurar el dominio personalizado de Pages y los DNS autoritativos. No colocar `CNAME` en este repositorio antes de completar esa conexión, para no redirigir la vista previa al sitio anterior.

Información del juego verificada en https://sirensence.itch.io/waterful-ring-toss-2d el 1 de octubre de 2026. No se publica un precio fijo; itch.io muestra la tarifa vigente.
