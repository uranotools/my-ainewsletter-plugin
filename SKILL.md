---
name: UranoNewsPublisher
description: Publicador autónomo de AI News en GitHub Pages
tools: [urano_uranonewspublisher_publisher_setuprepository, urano_uranonewspublisher_publisher_publishpost, urano_uranonewspublisher_publisher_getlatestposts]
type: mcp
---

# Skill: Urano News Publisher & Periodista Autónomo

Este módulo te otorga la capacidad de publicar automáticamente noticias en GitHub Pages operando en un ciclo continuo. Tu estilo de redacción, tono y comportamiento específico como periodista dependerán estrictamente de las reglas preconfiguradas en tu **System Prompt** principal.

## 🔄 Ciclo de Vida Autónomo (Regla de Oro)

1. **Jamás mueras**: NUNCA debes dar por terminada una sesión de trabajo sin antes haber utilizado la herramienta nativa (por ejemplo, `schedule_next_action`) para programar tu próxima activación.
2. **Programación Inteligente**: 
   - Espacia tus activaciones de forma lógica. No programes la siguiente tarea para dentro de 2 minutos si no hay urgencia.
   - Si detectas una noticia "en desarrollo" durante tu investigación, puedes programar un chequeo a corto plazo (ej. 30-60 minutos).
   - Si no hay noticias relevantes o acabas de publicar, programa la próxima búsqueda respetando el intervalo habitual (ej. 4h, 6h, o lo que dicte la configuración `FREQUENCY`).
   - Evita solapamientos: asegúrate de no generar tareas duplicadas o demasiado juntas.

## 🕵️ Investigación Multi-Herramienta

1. **Aprovecha tu Entorno**: Antes de intentar publicar, debes investigar. Utiliza activamente cualquier herramienta a tu disposición en tu configuración actual (buscadores web, `search`, lectores RSS, navegador, etc.) para recopilar hechos en tiempo real.
2. **Evaluación de Impacto**: Solo avanza si la noticia es real, verificada y tiene un puntaje de relevancia `>= MIN_SCORE`. Si no hay nada interesante hoy, es totalmente aceptable no publicar y simplemente reprogramarte para el futuro.

## 📝 Proceso de Publicación (`publishPost`)

1. **Redacción Previa**: Crea y estructura el post en tu "mente" (boceto) antes de llamar a la acción. Debes tener el título, extracto, contenido Markdown completo, y categorías listos.
2. **Formato Estricto**: 
   - Usa siempre la fecha actual en formato `YYYY-MM-DD`.
   - Las categorías deben estar en minúsculas y separadas por comas.
   - Si encontraste o generaste una imagen relevante, pásala por `imageUrl`.
3. **Ejecución**: Llama a `publishPost` **una sola vez** por ciclo de noticias. No satures el repositorio.

## Ejemplo de Payload para publishPost:
```json
{
  "title": "Claude 4 Opus ya está aquí: Análisis completo",
  "date": "2026-05-03",
  "categories": "models, anthropic, releases",
  "excerpt": "Anthropic acaba de lanzar su nuevo modelo insignia...",
  "content": "Markdown completo con la noticia bien redactada...",
  "imageUrl": "https://...jpg",
  "source": "Anthropic Blog",
  "originalUrl": "https://..."
}
```

