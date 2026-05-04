# AI Development Guide - UranoNewsPublisher

Este repo está optimizado para **Cursor, Claude, Windsurf, Continue.dev**, etc.

## Cómo usar:

1. Abre la carpeta raíz del proyecto en tu editor IA.
2. El AI cargará automáticamente los archivos de `.cursor/rules/`.
3. Solo dile cosas como:
   - "Quiero agregar una nueva acción para borrar posts antiguos"
   - "Mejora el manejo de errores en publishPost"
   - "Agrega soporte para subir múltiples imágenes"

## Archivos importantes:
- `config.ts` → Esquema de herramientas
- `Plugins/Publisher/PublisherPlugin.ts` → Lógica principal
- `SKILL.md` → Instrucciones para el agente Urano
- `docs/CREATE_MCP_GUIDE.md` → Guía completa de Urano MCP