# 📰 UranoNewsPublisher MCP Plugin

Bienvenido al plugin **UranoNewsPublisher**, un módulo diseñado específicamente para integrarse con [Urano Desktop](https://github.com/uranotools/UranoDesktop) y permitir la creación de newsletters autónomas impulsadas por IA.

Este plugin permite que un Agente de Urano investigue noticias, redacte artículos en formato Markdown y los publique automáticamente en un sitio estático (como GitHub Pages) utilizando un flujo de trabajo profesional y desacoplado.

Your personal Newsletter AI Tutorial: [Go to tutorial](https://uranoproject.medium.com/how-to-create-your-own-personal-ai-newsletter-with-urano-desktop-4c8a714cf311)
Tu sitio de Noticias con IA, Tutorial: [Go to tutorial](https://uranoproject.medium.com/c%C3%B3mo-crear-tu-propia-newsletter-de-ia-personal-y-aut%C3%B3noma-con-urano-desktop-45436d24d240)

### 🚀 Una Nueva Era para Escritores de Newsletters
Este plugin abre las puertas a que miles de escritores y creadores de contenido puedan conectar sus conocimientos con la potencia de la IA. Al lanzar un **Agente Autónomo en Urano Desktop**, cualquier escritor puede:
*   **Delegar la Curaduría**: Dejar que la IA filtre las noticias más relevantes según su criterio experto configurado en el System Prompt.
*   **Publicación Ininterrumpida**: El agente se mantiene "corriendo" de forma autónoma, convirtiéndose en un póster incansable que mantiene la newsletter activa 24/7.
*   **Escalabilidad**: Un solo escritor puede supervisar múltiples agentes (newsletters) de nichos distintos, todos operando de forma independiente.

---

## 🏗️ Estructura del Proyecto

El plugin sigue la arquitectura estándar de Urano MCP:

```text
my-ainewsletter-plugin/
├── 📄 config.ts                 # Manifiesto y esquemas de herramientas
├── 📄 SKILL.md                  # Instrucciones narrativas para el Agente (System Prompt)
├── 📄 package.json              # Metadatos del plugin
├── 📁 Plugins/
│   └── 📁 Publisher/
│       └── 📄 PublisherPlugin.ts # Lógica principal (Interacción con GitHub y procesamiento)
└── 📁 docs/                     # Documentación técnica adicional
```

---

## 🧠 Lógica de Funcionamiento

El plugin no funciona de forma aislada, sino que actúa como un puente inteligente:

1.  **Investigación**: El Agente utiliza sus herramientas de búsqueda (o las `SOURCES` configuradas) para encontrar noticias relevantes.
2.  **Procesamiento**: El Agente redacta el post siguiendo el tono configurado en su System Prompt.
3.  **Publicación**: Se invoca la acción `publishPost`, la cual:
    *   Descarga imágenes externas y las sube al repositorio de GitHub (`assets/images/`).
    *   Actualiza el archivo central de datos `data/posts.json` mediante el **GitHub MCP** de Urano.
    *   Retorna la URL final del sitio para confirmar la publicación.
4.  **Ciclo Autónomo**: Mediante la instrucción `schedule_next_action` definida en el `SKILL.md`, el agente se reprograma para su próxima jornada laboral sin intervención humana.

---

## 💡 Ideas de Newsletter que puedes crear

Gracias a la flexibilidad de Urano, puedes configurar diferentes agentes para distintos nichos:

*   **IA Daily Digest**: Resumen diario de los últimos papers en ArXiv y lanzamientos en Twitter/X.
*   **Crypto Journalist**: Un agente que monitorea precios y noticias de blockchain para publicar alertas y resúmenes.
*   **Tech Curator**: Una newsletter que solo publica noticias sobre lenguajes de programación específicos (Rust, Go, TypeScript).
*   **Local News Bot**: Un agente enfocado en recopilar y resumir noticias de una ciudad o región específica.

---

## 🛠️ Datos Técnicos para Desarrolladores

*   **Integración GitHub**: Este plugin requiere que el módulo **GitHub MCP** esté instalado y configurado en Urano Desktop. Utiliza el puente dinámico `pm.executeAction('GitHub', ...)` para evitar manejar tokens de forma manual.
*   **Almacenamiento**: Los posts se guardan en un array JSON. Esto facilita el consumo desde cualquier frontend (React, Vue, Astro) que simplemente lea un archivo estático.
*   **Imágenes**: El plugin maneja la persistencia de imágenes convirtiéndolas a `base64` durante la subida para asegurar que el contenido nunca se rompa por enlaces externos caídos.
*   **Hooks de Urano**: Utiliza el protocolo de `type: mcp` en `SKILL.md` para inyectar las reglas de periodismo directamente en el contexto del agente.

---

## 🛠️ Comandos de Desarrollo

Si eres desarrollador, puedes utilizar los siguientes comandos para gestionar el ciclo de vida del plugin:

*   **`npm run build`**: Instala `esbuild` y prepara el entorno de desarrollo.
*   **`npm run deploy`**: Compila y empaqueta el plugin en la carpeta `dist/`.
*   **`npm run urano-launch`**: Comprime el contenido de `dist/` en un archivo `.zip` listo para su distribución.

---

## 📚 Documentación y Recursos

Para profundizar en el desarrollo de plugins para Urano, consulta los siguientes recursos:

*   🌐 **Documentación Oficial**: [uranoai.com/documentation](https://uranoai.com/documentation)
*   🤖 **Herramienta para IA (llms.txt)**: [uranoai.com/llms.txt](https://uranoai.com/llms.txt)
*   📦 **Guía de Distribución**: [Plugin Distribution Guide](https://uranoai.com/documentation/plugin-distribution_en.md)
*   🛠️ **Plugins SDK & Debugging**: [Plugins SDK Guide](https://uranoai.com/documentation/plugins-sdk_en.md)

---

## 🚀 Instalación en Urano

1.  Clona este repositorio o descarga el ZIP.
2.  En Urano Desktop, ve a **Integraciones > MCP Manager > Desarrollador**.
3.  Haz clic en **Vincular Carpeta Local** y selecciona esta carpeta.
4.  ¡Listo! Tu agente ahora tiene las herramientas `urano_uranonewspublisher_...`.

---

Desarrollado con ❤️ por la comunidad de [UranoTools](https://uranoai.com).
