# Urano MCP - Guía de Creación e Instalación

Esta guía técnica está orientada a desarrolladores que deseen crear e integrar **Paquetes MCP (Model Context Protocol)** externos en la arquitectura de Agentes de Urano. Aquí aprenderás desde el concepto básico hasta configuraciones avanzadas para exponer herramientas dinámicas o estáticas y definir contextos (`Skills`) especializados.

---

## Índice
1. [Quick Start](#1-quick-start)
2. [Estructura del Proyecto MCP](#2-estructura-del-proyecto-mcp)
3. [El Archivo `config.ts` (Core Manifest)](#3-el-archivo-configts-core-manifest)
4. [Añadiendo Lógica a los Plugins](#4-añadiendo-lógica-a-los-plugins)
5. [Inyectando Contexto con `SKILL.md`](#5-inyectando-contexto-con-skillmd)
6. [Empaquetado y Distribución (.zip)](#6-empaquetado-y-distribución-zip)

---

## 1. Quick Start

Para arrancar de inmediato, esto es lo único que necesitas hacer para crear e instalar tu primer MCP llamado "HelloWorld":

1. Crea una carpeta local llamada `HelloWorld`.
2. Dentro de esa carpeta, crea el archivo `config.ts`:
```typescript
export const HelloWorldConfig = {
    name: "HelloWorld",
    description: "Mi primer módulo MCP de prueba",
    icon: "Rocket",
    category: "Desarrollo",
    pluginSchemas: {
        Tests: {
            actions: {
                ping: { label: 'Saludar API', fields: [] }
            }
        }
    }
}
```
3. Crea la ruta de plugin `Plugins/Tests/TestsPlugin.ts`:
```typescript
export class TestsPlugin {
    async executeAction(action: string, data: any) {
        if (action === 'ping') return "Pong! Hola desde MCP";
        throw new Error("Action not found");
    }
}
```
4. Comprime el interior de la carpeta en disco como `HelloWorld.zip`.
5. Ve a **Urano (Desktop o UI) > Integraciones / MCP Manager**.
6. Haz clic en **Instalar MCP (.zip)**, sube tu archivo, y ¡listo! Los agentes con permisos podrán automáticamente ver y utilizar tu nueva herramienta `urano_helloworld_tests_ping`.

---

## 2. Estructura del Proyecto MCP

Un paquete MCP bien estructurado consta de configuraciones centrales, código de ejecución y documentación contextual. Cuando instalas un ZIP en Urano, el sistema extrae todo hacia la bóveda aislada `~/.urano/workspace/mcp/{ModuleName}/`.

```text
📁 MiModuloMCP/
├── 📄 config.ts                 <-- (Requerido) Manifiesto y esquemas de entorno
├── 📄 package.json              <-- (Opcional) Define dependencias propias si se requieren
├── 📄 SKILL.md                  <-- (Recomendado) Sirve de System Prompt inyectable (`type: mcp`)
└── 📁 Plugins/
    └── 📁 {PluginName}/
        └── 📄 {PluginName}Plugin.ts  <-- Clase ejecutora que resuelve las acciones declaradas en config
```

---

## 3. El Archivo `config.ts` (Core Manifest)

Tu `config.ts` es el cerebro del entorno. Urano lee este archivo para renderizar las interfaces gráficas y configurar la Bóveda de contraseñas de forma transparente.

### Anatomía Avanzada

```typescript
export const SlackConfig = {
    name: "SlackIntegration",
    description: "Conecta a Slack directamente en el workspace comercial",
    icon: "MessageSquare",
    category: "Comunicaciones",

    // 1. Opciones de Entorno (Bóveda / UI visual)
    settings: [
        { name: 'SLACK_TOKEN', type: 'password', title: 'Bot OAuth Token' },
        { name: 'DEFAULT_CHANNEL', type: 'text', title: 'Canal Default (Ej: #general)' },
    ],

    // 2. Conectores Nativos MCP Server (Opcional)
    // Si tu módulo es un wrapper de un módulo MCP open source:
    mcpServer: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        requiredEnv: ['SLACK_TOKEN']
    },

    // 3. Declaración Explicita de Esquemas de Herramientas
    pluginSchemas: {
        Chat: {
            actions: {
                sendMessage: {
                    label: 'Enviar Mensaje',
                    fields: [
                        { name: 'channel', type: 'required', label: 'ID Canal' },
                        { name: 'text', type: 'required', label: 'Cuerpo del mensaje' },
                        { name: 'attachmentFolder', type: 'dir', label: 'Carpeta de Adjuntos' },
                    ]
                }
            }
        }
    }
};
```

### Tipos de Campos en `fields`
Urano Front renderiza automáticamente los formularios basándose en el atributo `type`:
- `required`: Campo de texto obligatorio.
- `text`: Campo de texto opcional.
- `password`: Campo oculto (Bóveda).
- `dir`: **(Urano >= 1.3.5)** Selector de directorios nativo de Windows.
- `select`: Menú desplegable (requiere atributo `options: [{ label, value }]`).
- `prompt`: Área de texto multilínea para bloques de instrucciones.

> **NOTA SOBRE SEGURIDAD:** Todos los campos variables estipulados en `settings` alimentan el motor criptográfico local de Urano. Los agentes jamas ven los tokens estáticos en sus contextos.

---

## 4. Añadiendo Lógica a los Plugins

Las herramientas estructuradas en el `config.ts` bajo la clave `pluginSchemas` esperan que haya una clase homóloga bajo el árbol `Plugins/{Name}/{Name}Plugin.ts`. 

Para el schema anterior (`Chat`), necesitarías crear `Plugins/Chat/ChatPlugin.ts`:

```typescript
export class ChatPlugin {
    private configStore: any;

    constructor(moduleConfigRecopiladoPorUrano: any) {
        // En este paso, Urano inyectará en tiempo real desencriptado las keys de la boda
        this.configStore = moduleConfigRecopiladoPorUrano; 
    }

    async executeAction(action: string, payload: any) {
        if (action === 'sendMessage') {
            const { channel, text } = payload;
            // ... Aquí ejecuta fetch o lógica local ...
            return { sent: true, timestamp: Date.now() };
        }
        throw new Error(`Acción ${action} no soportada en el plugin de Chat`);
    }
}
```

Urano enlazará el puente dinámicamente y creará un schema oficial en formato OpenAI Functions llamado `urano_slackintegration_chat_sendmessage`.

> [!NOTE]
> **Resolución de Nombres (Urano >= 1.3.5):** El sistema ahora resuelve el nombre del módulo de forma **insensible a mayúsculas** (`case-insensitive`) escaneando el sistema de archivos. Esto significa que si tu carpeta es `SlackIntegration`, las llamadas dirigidas a `slackintegration` funcionarán correctamente.
```typescript
    async executeAction(action: string, payload: any) {
        if (action === 'capture') {
            const rawBuffer = await miLibreriaDeCaptura();
            
            // Patrón A: Mensaje Multimodal Mixto (Urano >= 1.2.5)
            // Útil para retornar texto + imagen de forma explícita.
            // return [
            //    { type: 'text', text: 'Aquí tienes la captura:' },
            //    { type: 'image', image: rawBuffer.toString('base64'), mimeType: 'image/png' }
            // ];

            // Patrón B: Vision Interception (Recomendado Urano >= 1.4.0)
            // Al retornar un objeto con base64 y mimeType, el RuntimeLoop activará 
            // la intercepción automática, moviendo la imagen a un rol de usuario 
            // para evitar bloat en el contexto.
            return {
                path: payload.targetPath,
                base64: rawBuffer.toString('base64'),
                mimeType: 'image/png'
            };
        }
    }
```
> **¿Qué hace Urano con estos objetos?** Para garantizar que APIs que no soportan visión en roles de herramientas (como OpenAI vía OpenRouter) no colapsen la memoria al tratar los Base64 como texto crudo, el **RuntimeLoop** interceptará tu respuesta si contiene `base64` y `mimeType`. 
> 1. Dejará una mención en texto en el log de la herramienta.
> 2. Recreará un mensaje invisible bajo el `role: "user"` justo abajo con la imagen real. 
> De esta forma, el modelo recibe la imagen de forma 100% nativa y segura.

---

## 5. Inyectando Badges desde de tu Plugin MCP (Opcional)

Si desarrollas una herramienta MCP que lanza procesos de fondo, abre sub-pestañas, u obtiene documentos extensos, tal vez desees ofrecer al usuario un clic de acceso rápido arriba de su barra de texto. Puedes inyectar un **SessionBadge** universal:

```typescript
// Desde tu archivo MyPlugin.ts
public async apiEjecutarTarea(payload: any) {
    const { CoreFactory } = await import('@core/CoreFactory');
    const manager = await CoreFactory.getSessionManager();
    const session = manager.get(payload.sessionId);
    
    if (session) {
        const badges = session.metadata.badges || [];
        // Evitar duplicados
        if (!badges.some(b => b.id === 'mi-reporte')) {
            badges.push({
                id: 'mi-reporte',
                label: 'Abrir Reporte Generado',
                icon: '📊',
                color: 'success', // 'default' | 'info' | 'success' | 'warning' | 'error'
                actionRoute: '/module/MyPlugin/plugins/Report/apiAbrirReporte',
                actionData: { reportId: '123' }
            });
            await manager.updateSessionMetadata(payload.sessionId, { badges });
        }
    }
    
    return { success: true };
}
```

Urano Front pintará tu badge usando la paleta de colores indicada, y desencadenará el IPC Request a tu endpoint proporcionado de manera transparente.

### Manejando la Acción en tu Plugin

Para que el badge sea funcional, tu clase de Plugin debe implementar el método que definiste en `actionRoute`. Si tu ruta es `/module/MyPlugin/plugins/Report/apiAbrirReporte`, tu plugin debe tener el método `apiAbrirReporte`:

```typescript
// En src/main/Modules/MyPlugin/Plugins/Report/ReportPlugin.ts
export class ReportPlugin extends PluginBase {
    
    // Este método se invoca cuando el usuario hace clic en el Badge
    async apiAbrirReporte(payload: { reportId: string }) {
        console.log("El usuario pidió abrir el reporte:", payload.reportId);
        
        // Aquí puedes lanzar procesos, abrir archivos locales, o
        // incluso inyectar un mensaje nuevo en el chat.
        return { success: true };
    }
}
```

> [!TIP]
> **Sobre los Imports**: Nota que usamos `await import(...)` para cargar `CoreFactory`. Esto es una **buena práctica mandatoria** en Urano Desktop para evitar "Circular Dependencies" (errores de importación cíclica) ya que los plugins se cargan al inicio del sistema antes de que el Core esté 100% inicializado.

---

## 6. Inyectando Contexto con `SKILL.md`

Las herramientas sueltas de API no son suficientes si deseas dotar al LLM de la inteligencia sobre cómo usar tu MCP, o si quieres enseñarle **políticas empresariales específicas** al utilizar el módulo.

---

### ¿Es mandatorio el `SKILL.md`? (Urano >= 1.3.5)
A diferencia de versiones anteriores, **ya no es obligatorio** tener un `SKILL.md` válido para que las herramientas técnicas del módulo se registren. Si el archivo falta o está mal formado, el agente aún podrá ver y ejecutar tus acciones definidas en `config.ts`, pero carecerá de las instrucciones narrativas sobre *cómo* y *cuándo* usarlas.

> [!TIP]
> **Uso recomendado:** Siempre incluye un `SKILL.md`. Sin él, el agente puede alucinar con los parámetros o ignorar las políticas de seguridad que definas.

Aquí tienes un ejemplo completo y real de un archivo `SKILL.md` (basado en el módulo MiniChat de Urano):

```markdown
---
name: MiniChat
description: Capacidades de visión contextual, captura de pantalla y control del floating chat para asistencia en escritorio.
tools: [urano_minichat_capture_get_consent, urano_minichat_capture_set_consent, urano_minichat_capture_capture_screen_with_consent, urano_minichat_tools_open]
type: mcp
---

# Skill: MiniChat Desktop Intelligence

Este módulo otorga al agente "ojos" sobre el escritorio del usuario y la capacidad de controlar la ventana de chat flotante para ofrecer una experiencia de asistencia proactiva y contextual.

## Herramientas de Visión (Capture)

### `urano_minichat_capture_capture_screen_with_consent`
Captura la pantalla actual del usuario, respetando su configuración de privacidad.
- **Uso**: Fundamental cuando el usuario dice "Mira esto", "¿Qué opinas de lo que tengo abierto?", o cuando necesitas contexto visual para resolver una duda técnica.
- **Resultado**: Devuelve una confirmación textual y una imagen en base64 que se inyecta automáticamente en tu contexto de visión (si tu modelo soporta visión).

## Protocolo de Uso

1.  **Visión Contextual**: Siempre que el usuario haga referencias deícticas ("esto", "aquí", "esta ventana"), utiliza `capture_screen_with_consent` para obtener la verdad visual.
2.  **Privacidad**: Si el usuario deniega el consentimiento, no insistas excesivamente. Explica por qué la visión te ayudaría a ser más útil.

> [!IMPORTANT]
> Cuando realices una captura de pantalla exitosa, la imagen NO aparecerá en el historial de texto como una URL, sino que se enviará directamente a tu arquitectura multimodal. Podrás "verla" en el siguiente paso del loop de razonamiento.
```

### ¿Por qué `type: mcp`?
Gracias a esta etiqueta en el `frontmatter`, el **SkillRegistry** de Urano sabe que este skill **no debe listarse globalmente** en el panel universal del "Editor de Agentes", dado que de lo contrario, saturaría la experiencia de un editor humano listándole un sin fin de herramientas técnicas irrelevantes (Ej. *bases de datos postgres, conectores git*). El skill permanece escondido y disponible enteramente para rehidratarse de trasfondo siempre y cuando el Agente tenga los *Módulos MCP Autorizados* explícitos.

### 🧠 El Protocolo Skill-First (Mandatorio)
A partir de la versión 1.3.0, Urano Core impone un bloque de instrucciones `<mcp_protocol>` al Agente. Este bloque le prohíbe usar tus herramientas `urano_*` si no ha ejecutado primero `urano_read_skill`.

**¿Qué significa esto para ti?**
- Tu `SKILL.md` **siempre** será consultado antes de que el agente use tu API.
- Debes incluir reglas de validación y ejemplos claros de JSON en el `SKILL.md`.
- No necesitas saturar las descripciones de las herramientas en `config.ts`, ya que el "manual de instrucciones" completo reside en el skill y será leído bajo demanda.


---

## 6. Desarrollo, Empaquetado y Distribución (Marketplace)

Urano implementa un robusto **Ecosistema de Plugins (Marketplace)** y un **Modo Desarrollador (Live Test)**. Atrás quedaron los días de compilar y subir ZIPs manualmente durante la fase de desarrollo.

### 🛠️ Modo Desarrollador (Dev Mode / Live Test)

Para probar tu plugin en tiempo real mientras escribes código, utiliza la pestaña **Desarrollador** en el **MCP Manager** de Urano:

1.  **Vincular Carpeta (Symlink):** En la interfaz, haz clic en "Vincular Carpeta Local" y selecciona el directorio raíz de tu proyecto MCP (donde está tu `config.ts`).
2.  **Edición en Caliente (Hot Reload):** Urano creará un enlace simbólico (Junction en Windows) hacia tu bóveda. Un servicio en segundo plano (`fs.watch`) monitorizará tus archivos TypeScript/JavaScript.
3.  **Recarga Automática:** Cuando guardas un archivo, Urano invalidará el caché de Node (`require.cache`) y recargará tus esquemas y clases en milisegundos. Verás el evento `HOT_RELOAD` en el panel de actividad.
4.  **No se requiere código fuente:** Los desarrolladores no necesitan compilar Urano Desktop ni tener acceso a su código fuente para probar sus plugins nativamente.

### 📦 Construcción y Bundling (esbuild)

Instalar carpetas enteras de `node_modules` directamente dentro de un archivo final no es escalable, protege poco tu propiedad intelectual y genera problemas de límites de ruta (MAX_PATH en Windows).

La **práctica mandatoria** para distribuir tu MCP es crear un bundle con **esbuild**:

1.  Instala las dependencias: `npm install --save-dev esbuild`
2.  Ejecuta esbuild apuntando a tus puntos de entrada (ejemplo):
    `npx esbuild config.ts Plugins/**/*.ts --bundle --platform=node --outdir=dist --format=cjs`
3.  **Resultado:** Obtendrás un código minificado y unificado en la carpeta `dist`.
4.  Copia cualquier archivo estático necesario (como `SKILL.md` o imágenes) a la carpeta `dist`.
5.  Comprime **el contenido** de la carpeta `dist` en un archivo `.zip`. *(No comprimas la carpeta dist en sí, sino los archivos que están dentro).*

### 🚀 Publicación en el Marketplace (GitHub Registry)

Urano gestiona su Marketplace a través de un archivo remoto `registry.json` alojado en un repositorio público de GitHub.

1.  **Sube tu Release:** Crea un Release en tu repositorio de GitHub o en cualquier servidor accesible públicamente, y sube tu archivo `.zip` compilado como un asset.
2.  **Solicita Inclusión (Pull Request):** Modifica el archivo `registry.json` del repositorio oficial del ecosistema Urano añadiendo la entrada de tu plugin:

```json
{
  "id": "MiSuperMcp",
  "name": "Super MCP",
  "author": "Tu Nombre",
  "description": "Breve descripción de qué hace el plugin.",
  "version": "1.0.0",
  "category": "Productividad",
  "icon": "Zap", 
  "tags": ["herramienta", "ia"],
  "downloadUrl": "https://github.com/tu-usuario/tu-repo/releases/download/v1.0.0/misupermcp.zip",
  "verified": false
}
```

### 🔄 Sistema de Versionamiento y Actualizaciones

El backend de Urano Desktop se encargará del resto:
-   **Instalación Remota:** El usuario hace clic en "Instalar" y Urano descarga el ZIP, valida la integridad (Zip Slip protection) y lo extrae en la bóveda aislada de producción.
-   **Archivo de Control:** Urano genera automáticamente un archivo `_installed.json` dentro de la carpeta del plugin para rastrear la `version` actual instalada y el `source` (registry o dev-link).
-   **Actualizaciones Automáticas:** Un servicio en segundo plano revisa el `registry.json` periódicamente (cada 6 horas). Si detecta una versión superior (SemVer), notifica al usuario en la pestaña de Marketplace para actualizar a 1-clic. Antes de actualizar, Urano crea un backup automático de la versión anterior en `.mcp_backups`.

### 🛡️ Desarrollo Responsable: Whitelisting
Si tu MCP tiene acceso a recursos sensibles (archivos, procesos, red), es **obligatorio** implementar una capa de validación en tu Plugin.
1. Define un campo en `settings` del `config.ts` (ej: `ALLOWED_APPS`).
2. En tu `executeAction`, lee ese valor desde el `configStore`.
3. Valida la petición contra ese valor. Si falla, retorna un error descriptivo: `"ATENCIÓN IA: El recurso solicitado está fuera de la lista blanca permitida por el usuario."`.

---

## 7. Creando MCPs con Conciencia de Audio (Audio-Aware Plugins)

Urano incluye un **Audio Engine nativo** (`useAudioEngine`) que permite capturar voz del usuario sin que tu MCP tenga que manejar micrófonos directamente. Los chunks de voz ya transcritos llegan a tu plugin como texto plano.

### Patrón: Plugin que procesa chunks de voz en tiempo real

Ideal para MCPs como presentaciones en vivo, asistentes de dictado, o comandos de voz.

```typescript
// Plugins/Presentation/PresentationPlugin.ts
export class PresentationPlugin {
    private currentStageIndex = 0
    private stages: { keywords: string[]; uiSpec: any }[] = []

    // Acción estándar: carga el guión
    async apiLoadpresentation(payload: { stages: any[] }) {
        this.stages = payload.stages
        this.currentStageIndex = 0
        return { loaded: true, totalStages: this.stages.length }
    }

    // Acción de alta frecuencia: recibe chunks de voz directamente del AudioEngine
    // Esta acción NO invoca el LLM en cada llamada — es pura lógica de Plugin.
    async apiProcessvoicechunk(payload: { chunk: string }) {
        const current = this.stages[this.currentStageIndex]
        if (!current) return { action: 'none' }

        // Verificar si el chunk contiene palabras clave de la etapa actual
        const match = current.keywords.some(kw =>
            payload.chunk.toLowerCase().includes(kw.toLowerCase())
        )

        if (match) {
            this.currentStageIndex++
            return { action: 'advance', newStage: this.currentStageIndex }
        }

        return { action: 'none' }
    }
}
```

### Cómo el Frontend llama tu plugin directamente (sin agente)

Para latencia ultra-baja (< 600ms), el frontend puede bypasear el LLM y llamar tu plugin directo:

```typescript
// En el componente React que controla la sesión
const handleVoiceChunk = async (text: string) => {
    const res = await window.electronAPI.customIpcCall(
        '/module/LivePresenter/plugins/Presentation/processvoicechunk',
        { chunk: text }
    )
    if (res.action === 'advance') {
        // Disparar generateDynamicUI en MultiverseTabs para la nueva etapa
    }
}

// Pasarlo al AudioEngine
audioEngine.start({
    mode: 'chunk',
    onChunk: handleVoiceChunk
})
```

### Flujo Completo: Voz → Plugin → Visual

```
Micrófono
   ↓  (Web Speech API, ~150ms)
AudioEngine.onChunk(text)
   ↓  (IPC directo, <10ms)
PresentationPlugin.processVoiceChunk()
   ↓  (lógica interna, <5ms)
generateDynamicUI() → MultiverseTab
   ↓  (React render, ~100ms)
Visual actualizado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ~265ms (sin LLM) ✅
```

> [!TIP]
> Reserva el LLM para generar el **contenido** de los stages al inicio (cuando cargas el guión), no para procesar cada fragmento de voz. Así obtienes la máxima inteligencia con la mínima latencia operativa.

### Selección de Dispositivo de Audio por el Usuario

Desde el **AgentsDashboard > Configuración de Audio**, el usuario puede elegir el micrófono que se usará. No necesitas gestionar esto en tu plugin.


## 8. Renderizado Dinámico y el Patrón LivePresenter

A partir de la versión 1.3.0, los módulos MCP pueden renderizar interfaces React complejas en el frontend utilizando el módulo **MultiverseTabs**. Esto permite que un agente no solo "hable", sino que "construya" aplicaciones en tiempo real.

### Invocando un Renderizado desde un Plugin

Si tu plugin necesita mostrar un dashboard, una gráfica o una presentación, debe invocar la acción `generatedynamicui` de MultiverseTabs.

```typescript
// Plugins/Visualization/VizPlugin.ts
public async apiRenderDashboard(payload: { data: any, sessionId: string }) {
    const { CoreFactory } = await import('@core/CoreFactory');
    const pluginManager = await CoreFactory.getPluginManager();
    
    // Invocamos el plugin de MultiverseTabs directamente
    await pluginManager.executeAction('MultiverseTabs', 'Tabs', 'generatedynamicui', {
        sessionId: payload.sessionId,
        purpose: 'dashboard-analytics',
        spec: {
            title: "Análisis de Datos Pro",
            component: "DynamicGrid", // Componente React registrado en UranoFront
            props: {
                dataset: payload.data,
                refreshInterval: 5000
            }
        }
    });

    return { status: 'Rendering started in Multiverse' };
}
```

### El Patrón de "Ejecución Híbrida" (Recomendado)

Para una experiencia de usuario fluida, sigue este patrón en tus plugins:

1.  **Respuesta Estática Inmediata**: Retorna un resumen en texto o un `MessagePart[]` multimodal para que el usuario sepa que la acción comenzó.
2.  **Mejora Dinámica Asíncrona**: Dispara el `generatedynamicui` de trasfondo para abrir la pestaña interactiva.

```typescript
async executeAction(action: string, payload: any) {
    if (action === 'analyze') {
        // 1. Disparar UI pesada asíncronamente
        this.apiRenderDashboard(payload); 

        // 2. Retornar confirmación instantánea al Agent context
        return "He iniciado el análisis visual en una nueva pestaña del Multiverso. Mientras se carga, puedo confirmarte que los datos preliminares muestran un crecimiento del 20%.";
    }
}
```

---

## 9. Lista Blanca y Seguridad (FileSystem)

Si tu módulo maneja archivos locales, es vital que el agente sepa qué rutas tiene permitidas de antemano.

1.  **Acción `listAllowed`**: Implementa siempre una acción que devuelva el contenido de tus `settings` de rutas autorizadas.
2.  **Protocolo en `SKILL.md`**: Instruye al agente para que **siempre** ejecute `listAllowed` antes de intentar leer o escribir archivos. Esto evita errores de permisos (`ENOENT`) y mejora la confianza del modelo.

```markdown
# Instrucciones de FileSystem
Antes de realizar cualquier operación de archivos, DEBES llamar a `urano_filesystem_localfiles_listallowed` para conocer las rutas seguras autorizadas por el usuario. No intentes acceder a rutas fuera de esta lista.
```


## 🛠️ Protocolo de Resiliencia y Estabilidad (AI SDK v6)

Urano Desktop implementa capas de protección automática en el **RuntimeLoop** para garantizar que los agentes MCP no corrompan las sesiones:

### 1. Limpieza de Herramientas Huérfanas
Si un turno es interrumpido (cancelación manual, crash de red), el motor detecta automáticamente los mensajes de tipo `assistant` que contienen llamadas a herramientas sin resultado. Antes de iniciar un nuevo turno, el sistema limpia estas llamadas para evitar el error `AI_MissingToolResultsError`.

### 2. Validación Nativa de Visión (Hybrid Pattern)
Antes de inyectar imágenes en el contexto de un plugin MCP (ej. capturas de pantalla), el sistema valida si el modelo configurado soporta visión (GPT-4o, Claude 3.5, etc.). 

**Lógica de Intercepción**: Para asegurar la estabilidad, el **RuntimeLoop** intercepta automáticamente cualquier respuesta de herramienta (ya sea un objeto plano o dentro de un Array) que contenga las propiedades `base64` o `image`. En lugar de dejar el binario pesado en la respuesta de la herramienta, lo extrae y lo mueve a un mensaje inyectado adyacente, dejando un texto placeholder ligero en su lugar.

**Estándar de Retorno para Desarrolladores:**
Para que tus herramientas nativas o servidores MCP envíen archivos multimodales (imágenes) al LLM de forma segura sin provocar errores de validación de tokens, simplemente retorna la data usando una de estas estructuras:

```javascript
// Opción 1: Objeto Directo (Ej. LocalFilesPlugin)
return {
    base64: "iVBORw0KGgo...", 
    mimeType: "image/png" 
};

// Opción 2: Partes Nativas de AI SDK (Ej. DesktopPlugin / SystemEye)
return [
    { type: "text", text: "Imagen procesada" },
    { type: "image", image: "iVBORw0KGgo...", mimeType: "image/png" }
];
```
Al cumplir este estándar, no importa si tu tool es MCP o Nativo: el motor de Urano manejará la imagen de la misma manera universal, asegurando que llegue limpia a los modelos multimodales.

---

## 🎨 Extensión de UI: Session Badges

Para módulos MCP que generan documentos o abren contextos externos, se recomienda utilizar el **API de Session Badges** (`badges: SessionBadge[]` en `SessionMetadata`). Esto permite inyectar botones nativos interactivos de acceso rápido directamente en la conversación del usuario, permitiendo a tu MCP desencadenar rutas IPC sin interacción adicional del LLM. Consulta la guía técnica de desarrollo para ejemplos de código.

---

## 🔌 Uso de Funciones Nativas (@core)

Los módulos MCP en Urano Desktop no están limitados a responder al LLM; tienen acceso total a las capacidades del sistema operativo y del motor de Urano a través del alias `@core`.

### Importación Centralizada
A partir de la versión v2.2, puedes importar los servicios principales desde el index del core:

```typescript
import { NotificationService, AIManager, CoreFactory } from '@core';
```

### Ejemplo: Notificación de Fin de Proceso
Si tu MCP ejecuta una tarea que tarda varios segundos/minutos (ej: exportar una base de datos), puedes notificar al usuario nativamente cuando termine, permitiéndole volver al chat con un clic:

```typescript
async apiExportData(payload: { format: string }) {
    // 1. Ejecutar tarea pesada...
    const result = await this.longRunningTask(payload.format);

    // 2. Notificar nativamente al usuario
    // El sistema automáticamente enfocará la ventana correcta al hacer clic
    await NotificationService.send(
        "Exportación Completa", 
        `Tu archivo ${payload.format} está listo para descargar.`,
        {
            sessionId: this.sessionId, // Permite volver a este chat específico
            isMiniChat: this.isMiniChat // Detecta si debe abrir la burbuja o el Dashboard
        }
    );

    return { success: true, fileUrl: result.url };
}
```

---

## 🎙️ Integración con el Audio Engine Nativo

Urano cuenta con un sistema nativo de captura de voz (`useAudioEngine`) disponible en el frontend. Los módulos MCP pueden recibir audio como entrada de los siguientes modos:

### Cómo llegan los chunks de voz a tu MCP

El `AudioEngine` transcribe el audio y lo envía al agente **como texto plano** a través del canal IPC normal (`agentSessionSend`). Tu MCP no necesita escuchar el micrófono directamente: el agente recibirá el texto ya procesado.

Para un MCP como `LivePresenter` que necesita reaccionar a cada chunk sin invocar el LLM, se puede registrar un handler directo:

```typescript
// En tu Plugin, expón una acción para recibir chunks de voz del frontend
async apiProcessvoicechunk(payload: { chunk: string, sessionId: string }) {
    // Lógica interna: comparar chunk con stage actual, decidir si avanzar
    // Sin invocar el LLM si no es necesario
    return { action: 'none' | 'advance' | 'update' }
}
```

El frontend llama directamente al IPC:
```typescript
// Desde AudioEngine en modo LivePresenter (Phase 2)
window.electronAPI.customIpcCall('/module/LivePresenter/plugins/Presentation/processvoicechunk', {
    chunk: transcribedText,
    sessionId: activeSessionId,
})
```

> [!TIP]
> Este patrón (Audio → Plugin directo, sin LLM por chunk) es la clave para lograr latencia **< 600ms** de voz a visual en tiempo real.

### Selección de Dispositivo de Audio

Los usuarios pueden seleccionar su micrófono preferido desde el **AgentsDashboard > Configuración de Audio**. El `deviceId` seleccionado se pasa al `AudioEngine.start()` y está disponible para Whisper en implementaciones futuras.

---

## ✋ Protocolo de Aprobación Interactiva (Tool Approval)

A partir de la versión reciente, el motor de Urano soporta pausar la ejecución de herramientas que realizan acciones destructivas o críticas (como ejecución de comandos de terminal, envío de correos masivos, etc.) para solicitar confirmación interactiva al usuario.

### ¿Cómo implementarlo en un Plugin Nativo?

Al definir la herramienta en el método `apiList`, simplemente añade la propiedad `requiresApproval: true`:

```typescript
export default class SystemTerminal extends PluginBase {
    async apiList() {
        return [{
            name: 'execute_command',
            description: 'Ejecuta comandos de terminal. El motor pausará y pedirá permiso al usuario.',
            parametersSchema: z.object({
                command: z.string()
            }),
            requiresApproval: true, // <-- Activa la pausa en el motor y la UI
            execute: async (args) => {
                // Solo se ejecutará si el usuario hace clic en "Aprobar" en el frontend
                return await miEjecutor(args.command);
            }
        }];
    }
}
```

### Ciclo de Vida del Evento:
1. El Agente decide usar la herramienta y el motor intercepta `requiresApproval: true`.
2. El **RuntimeLoop** pausa su hilo asíncrono y emite el evento IPC `agent-tool-approval-requested`.
3. El **Dashboard (React)** transforma la burbuja de estado en un diálogo amarillo interactivo de "Aprobación Requerida" mostrando los argumentos (ej. el comando a ejecutar) junto a dos botones: Aprobar o Rechazar.
4. Al hacer clic, se emite el IPC de vuelta `agent-tool-approval-response`.
5. Si es aprobado, el **RuntimeLoop** resume y ejecuta la función `execute()`. Si es rechazado, se aborta y se devuelve un `ToolError` diciendo "User rejected the action", permitiendo que el Agente entienda que se le denegó el permiso.

---

## ⚡ Patrón: Rate Limiter para APIs de Terceros (Serial Queue)

### El Problema

El **RuntimeLoop** ejecuta todas las herramientas generadas en un mismo turno usando `Promise.all()`. Esto significa que si el agente emite tres tool calls en un mismo paso:

```
user_feed()  ─┐
user_stats() ─┼─ Promise.all → disparo simultáneo → 429 Rate Limit
search()      ─┘
```

Si las tres tools llaman a la misma API externa con límite de 1 req/seg (como apiexternalexample), las tres requests HTTP llegan concurrentemente y las últimas dos fallan con `429 Too Many Requests`.

### Por Qué NO Añadir una Bandera `parallel: false` al Core

Podría parecer tentador añadir `parallel: false` al schema de la tool en `config.ts` para que el `RuntimeLoop` las ejecute en serie. Sin embargo, esto no es la solución correcta porque:

- Requeriría cambiar `ModuleConfig.ts`, `SkillRegistry.ts`, `McpTool.ts` y `RuntimeLoop.ts` — alto riesgo por un caso muy específico.
- Haría que **todas** las herramientas del turno esperasen, incluso las que no usan la API limitada.
- Violaría el principio de responsabilidad única: el RuntimeLoop no debe conocer las políticas de rate-limiting de APIs externas.

### La Solución: Cola Serial a Nivel HTTP (Serial Queue)

La solución correcta es implementar un **semáforo de promesas** que serialice únicamente las llamadas HTTP a la API limitada, **completamente invisible** para el agente y el RuntimeLoop.

**Implementación de referencia** (ver `MarketsPlugin.ts`):

```typescript
// ── Constantes de rate limiting ────────────────────────────────────────────
const MI_API_MIN_INTERVAL_MS = 1100; // 1.1s entre requests (margen sobre 1/s)
let miApiLastCall = 0;
let miApiQueue: Promise<any> = Promise.resolve();

// Encola la función 'fn' para ejecución serial con delay mínimo entre calls.
function miApiEnqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = miApiQueue.then(async () => {
        const now = Date.now();
        const wait = MI_API_MIN_INTERVAL_MS - (now - miApiLastCall);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        miApiLastCall = Date.now();
        return fn();
    });
    // Encadenar para que la siguiente llamada espere ESTA, no solo la anterior.
    miApiQueue = result.catch(() => {});
    return result;
}

// Wrapper de fetch que usa la cola
async function miFetch(path: string, apiKey: string): Promise<any> {
    return miApiEnqueue(async () => {
        const res = await fetch(`https://api.mi-servicio.com${path}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        // Manejo de 429 con retry automático usando Retry-After
        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
            await new Promise(r => setTimeout(r, retryAfter * 1000 + 100));
            const retry = await fetch(`https://api.mi-servicio.com${path}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!retry.ok) throw new Error(`API error ${retry.status}`);
            return retry.json();
        }
        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
        return res.json();
    });
}
```

### Cómo Funciona la Cola

```
Promise.all dispara:       user_feed()   user_stats()   search()
                                │               │              │
                           llaman a:        miFetch()     miFetch()     miFetch()
                                │               │              │
                         miApiEnqueue()  miApiEnqueue() miApiEnqueue()
                                │               │              │
                         ┌──────▼───────────────▼──────────────▼──────┐
                         │          COLA SERIAL (miApiQueue)           │
                         │   Req 1 → [espera 1.1s] → Req 2 → [1.1s]  │
                         │   → Req 3                                   │
                         └────────────────────────────────────────────┘
```

El `Promise.all` del RuntimeLoop termina cuando **las tres promesas resuelven**, lo cual sucede secuencialmente con 1.1s de separación. Desde el punto de vista del agente y del RuntimeLoop, la diferencia es solo de latencia, no de comportamiento.

### Cuándo Usar Este Patrón

Usa una cola serial cuando tu plugin integra una API externa que:

| Condición | Ejemplo |
|-----------|---------|
| Tiene rate limit de escritura O lectura | apiexternalexample: ~1 req/s, Twitter API: 300 req/15min |
| El agente puede llamar múltiples herramientas del mismo proveedor en un turno | `user_feed` + `user_stats` + `search` → todas usan apiexternalexample |
| El error de rate limit no es recuperable en esa misma request | `429` sin Retry-After header |

> [!TIP]
> La cola es un **singleton a nivel de módulo** (declarada fuera de la clase del plugin). Esto garantiza que incluso si múltiples sesiones del mismo agente están activas simultáneamente, todas las llamadas a la API comparten la misma cola y respetan el rate limit global.

> [!NOTE]
> Si la API no retorna el header `Retry-After`, usa un valor conservador de 1–2 segundos como fallback. El retry es opcional pero muy recomendado para evitar que un pico momentáneo de tráfico derribe toda la funcionalidad.

> [!CAUTION]
> **Timeout Crítico**: Cuando uses una cola serial, es obligatorio que el `fetch` dentro de la cola tenga un timeout (usando `AbortController`). Si una petición se queda colgada sin timeout, **bloqueará toda la cola** para el resto de herramientas y usuarios, dejando el módulo inutilizable hasta reiniciar.
> También se recomienda un timeout para el tiempo de espera *en* la cola (ej. abortar si la petición lleva >15s esperando su turno).

---

## 💎 Patrones Avanzados MCP (Urano Standard)

Para asegurar la consistencia entre módulos complejos (como UranoMaps o SystemEye), se han estandarizado los siguientes patrones de desarrollo:

### 1. Gestión de Ventanas por Sesión (`label:sessionId`)

Cuando un plugin abre pestañas en `MultiverseTabs`, debe evitar duplicar ventanas innecesariamente y permitir que el agente recupere contextos específicos.

**Patrón de Registro:**
```typescript
// Registro dinámico: "nombre_amigable:sessionId" -> tabId
const dashboardRegistry = new Map<string, string>();
const dashboardParams = new Map<string, any>();

async apiLaunch(params: { label: string, sessionId: string, ... }) {
    const key = `${params.label}:${params.sessionId}`;
    let tabId = dashboardRegistry.get(key);
    
    if (tabId && this.tabExists(tabId)) {
        // Si ya existe, solo la enfocamos y actualizamos
        return this.apiUpdate({ tabId, ... });
    }
    
    // Si no existe, creamos una nueva y registramos
    tabId = await this.createNewTab();
    dashboardRegistry.set(key, tabId);
    return { tabId, status: 'launched' };
}
```

### 2. Persistencia de Estado de Ventanas (`state.json`)

Los plugins que manejan datos en memoria (alertas, órdenes, posiciones) deben persistir su estado en el `userData` del usuario para sobrevivir a reinicios.

**Ubicación Recomendada:**
- **Windows**: `%APPDATA%/Urano Desktop/[plugin]_state.json`
- **Fallback**: `~/.urano/[plugin]_state.json`

**Implementación de Referencia:**
```typescript
function saveState() {
    const p = path.join(os.homedir(), '.urano', 'mi_plugin_state.json');
    const data = { registry: Object.fromEntries(dashboardRegistry) };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
```

### 3. Lógica de Captura y Caché de Archivos

Para que un agente pueda "ver" el contenido de una ventana o mapa, el plugin debe implementar una herramienta de captura que genere URLs locales.

**Estándares de Captura:**
1. **Directorio de Caché**: Siempre usar `path.join(os.homedir(), '.urano', 'cache', 'screenshots')`.
2. **Retorno Multimodal**: La herramienta debe devolver un array con el path local y el base64 para que el `RuntimeLoop` lo procese.

**Ejemplo de retorno:**
```typescript
return [
    { type: 'text', text: `Captura guardada en: ${filePath}` },
    { type: 'image', image: buffer.toString('base64'), mimeType: 'image/png' }
];
```

### 4. Estándares de Renderizado Dinámico (`JsonLive`)

Al crear nuevos componentes UI (como el widget `Map`), se deben seguir estas reglas para asegurar compatibilidad con `JsonLiveRenderer`:

- **Atomicidad**: Cada componente debe ser autónomo y usar `extractStyle()` para sus propiedades CSS.
- **Patching Fluido**: El plugin debe preferir `patchDynamicUI` sobre `generateDynamicUI` para actualizaciones de tiempo real (evita parpadeos).
- **Estructura de Nodo**:
    ```json
    {
      "type": "NuevoComponente",
      "props": { "glass": true, "glow": "#ff0000", ... },
      "children": [ ... ]
    }
    ```

> [!TIP]
> Si tu componente requiere librerías pesadas (como Leaflet o ECharts), impleméntalo usando **Lazy Loading** en el frontend para no degradar el tiempo de carga inicial de la aplicación.

---

## 🔒 Sistema de Permisos OS Genérico

Urano implementa un mecanismo centralizado para que cualquier MCP pueda solicitar permisos a nivel de sistema operativo de manera nativa, con **verificación real** (no solo registro) antes de guardar el estado.

### Tipos de Permiso Soportados

| `permissionType` | Descripción | macOS | Windows | Linux |
|---|---|---|---|---|
| `screen` | Captura de pantalla | Dialog del sistema / Ajustes | Configuración de privacidad | Ninguno requerido |
| `microphone` | Acceso al micrófono | `askForMediaAccess` nativo | `ms-settings:privacy-microphone` | Ninguno requerido |
| `camera` | Acceso a la cámara | `askForMediaAccess` nativo | `ms-settings:privacy-webcam` | Ninguno requerido |
| `desktop-audio` | Audio del escritorio (loopback) | ⚠️ Requiere dispositivo virtual | WASAPI loopback vía renderer | PulseAudio/PipeWire |

> [!WARNING]
> En **macOS**, la captura de audio del escritorio (`desktop-audio`) no está disponible de forma nativa. Se requiere instalar **BlackHole** (gratuito) o **Loopback** y configurarlo como salida de audio del sistema.

### 1. Definición en `config.ts`
Agrega un campo de tipo `button` en el array de `settings` de tu módulo. El `name` servirá como slug en la bovéda (`Vault`) para persistir si el usuario otorgó el permiso.

```typescript
// config.ts de tu módulo
settings: [
    {
        name: 'capture-permission',          // Slug del permiso guardado en Vault
        title: 'Captura de Pantalla',
        type: 'button',
        buttonText: 'Solicitar Permiso OS',
        description: 'Permite al agente ver el contexto visual de tu pantalla',
        actionRoute: 'mcp-request-os-permission',
        actionPayload: { permissionType: 'screen' },
    },
    {
        name: 'microphone-access',
        title: 'Acceso al Micrófono',
        type: 'button',
        buttonText: 'Solicitar Permiso OS',
        description: 'Permite al agente escuchar audio del micrófono',
        actionRoute: 'mcp-request-os-permission',
        actionPayload: { permissionType: 'microphone' },
    },
    {
        name: 'desktop-audio-access',
        title: 'Audio del Escritorio',
        type: 'button',
        buttonText: 'Solicitar Permiso OS',
        description: 'Permite al agente escuchar el audio del sistema (loopback)',
        actionRoute: 'mcp-request-os-permission',
        actionPayload: { permissionType: 'desktop-audio' },
    },
],
```

### 2. Comportamiento Automático
- El frontend inyecta automáticamente `moduleName` y `permissionSlug` (= `name` del campo) en el payload.
- El backend **verifica el permiso real** antes de guardar:
  - `screen`: Captura un thumbnail real; si está vacío, retorna error y abre los Ajustes del Sistema en macOS.
  - `microphone`/`camera`: Usa `systemPreferences.getMediaAccessStatus()` en macOS para verificar el estado antes de pedir; en caso de `'denied'` abre directamente la pantalla de privacidad.
  - `desktop-audio`: Informa al usuario sobre limitaciones de plataforma.
- El estado `'granted'` se guarda en el Vault **solo si el permiso es real**.
- Si la captura posterior detecta que el thumbnail está vacío, **revoca automáticamente** el estado `'granted'` y resetea el badge a ámbar.

### 3. Leer el permiso desde un Plugin

Verifica si el permiso fue otorgado consultando directamente el `Vault` desde tu plugin:

```typescript
import { Vault } from '../../../../core/Security/Vault';

async apiMyAction() {
    const isGranted = Vault.getSecret(this.moduleName, 'capture-permission') === 'granted';
    if (!isGranted) {
        return { success: false, consentRequired: true, message: 'Permiso no otorgado' };
    }
    // ... usar el permiso
}
```

> [!TIP]
> El `McpManager` muestra automáticamente la sección "Permisos del Sistema" con badges de estado para todos los campos de tipo `button`. Los badges en ámbar indican que se requiere acción; los verdes que el permiso está otorgado y verificado.

---

### 4. Usar los Permisos Dentro de un Plugin

Una vez que el usuario otorgó el permiso, aquí tienes la implementación de referencia para cada tipo.

#### 📸 `screen` — Capturar la pantalla

Usa `desktopCapturer` de Electron directamente desde el proceso **main**. No requiere el renderer.

```typescript
// En tu Plugin (Proceso Main — Node.js / Electron)
import { desktopCapturer } from 'electron';
import { Vault } from '../../../../core/Security/Vault';

export default class MiPlugin extends PluginBase {

    async apiCaptureScreen() {
        // 1. Verificar permiso
        const isGranted = Vault.getSecret(this.moduleName, 'capture-permission') === 'granted';
        if (!isGranted) {
            return { success: false, consentRequired: true, message: 'Permiso de captura no otorgado. Ve a la configuración del módulo.' };
        }

        // 2. Capturar
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 },
        });

        const primary = sources[0];
        const thumb = primary?.thumbnail;

        if (!thumb || thumb.isEmpty()) {
            // Revocar si el OS ya no lo permite
            Vault.deleteSecret(this.moduleName, 'capture-permission');
            return { success: false, message: 'El SO denegó la captura. El permiso fue revocado.' };
        }

        const base64 = thumb.toPNG().toString('base64');

        // 3. Retornar imagen — el RuntimeLoop la inyectará como parte multimodal
        return [
            { type: 'text', text: 'Captura de pantalla tomada exitosamente.' },
            { type: 'image', image: base64, mimeType: 'image/png' },
        ];
    }
}
```

---

#### 🎙️ `microphone` — Grabar audio del micrófono

La captura de micrófono ocurre en el **proceso renderer** (React/Web Audio API), no en el main. Tu plugin expone una herramienta que el agente llama; el frontend reacciona y graba.

**Paso 1 — Plugin expone la herramienta (Main Process):**

```typescript
// En tu Plugin
export default class MiPlugin extends PluginBase {

    async apiStartMicCapture(payload: { durationMs?: number }) {
        const isGranted = Vault.getSecret(this.moduleName, 'microphone-access') === 'granted';
        if (!isGranted) {
            return { success: false, consentRequired: true, message: 'Permiso de micrófono no otorgado.' };
        }

        // Emitir evento al renderer para que inicie la grabación
        // El renderer escucha 'plugin-mic-start' y retorna el audio vía IPC
        this.emitToRenderer('plugin-mic-start', {
            durationMs: payload.durationMs || 5000,
            sessionId: this.sessionId,
        });

        return { success: true, message: 'Grabación de micrófono iniciada.' };
    }
}
```

**Paso 2 — Renderer captura y devuelve el audio:**

```typescript
// En tu componente React (Renderer)
api.on('plugin-mic-start', async ({ durationMs, sessionId }) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        // Enviar de regreso al main process
        api.customIpcCall('plugin-mic-result', { sessionId, base64, mimeType: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
    };

    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
});
```

> [!NOTE]
> Si ya tienes `useAudioEngine` activo en el frontend, puedes reciclarlo directamente en lugar de crear un nuevo `MediaRecorder`. Consulta la sección **Integración con el Audio Engine Nativo** de esta guía.

---

#### 🔊 `desktop-audio` — Capturar audio del escritorio (loopback)

Solo disponible en **Windows** (y Linux). Captura lo que está sonando en el sistema en tiempo real.

**Paso 1 — Plugin emite la señal (Main Process):**

```typescript
export default class MiPlugin extends PluginBase {

    async apiStartDesktopAudio(payload: { durationMs?: number }) {
        const isGranted = Vault.getSecret(this.moduleName, 'desktop-audio-access') === 'granted';
        if (!isGranted) {
            return { success: false, consentRequired: true, message: 'Permiso de audio del escritorio no otorgado.' };
        }
        if (process.platform === 'darwin') {
            return { success: false, message: 'macOS no soporta captura de audio del escritorio nativamente. Instala BlackHole.' };
        }

        this.emitToRenderer('plugin-desktop-audio-start', {
            durationMs: payload.durationMs || 5000,
            sessionId: this.sessionId,
        });

        return { success: true, message: 'Captura de audio del escritorio iniciada.' };
    }
}
```

**Paso 2 — Renderer captura con WASAPI loopback:**

```typescript
// En el renderer (React) — solo funciona en Windows/Linux
api.on('plugin-desktop-audio-start', async ({ durationMs, sessionId }) => {
    // Obtener fuentes de escritorio con audio habilitado
    const sources = await (window as any).electronAPI.customIpcCall(
        'desktop-capturer-get-sources', { types: ['screen'], fetchWindowIcons: false }
    );

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[0]?.id,  // Primera pantalla
            }
        } as any,
        video: false,
    });

    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        api.customIpcCall('plugin-desktop-audio-result', { sessionId, base64, mimeType: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
    };

    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
});
```

> [!IMPORTANT]
> Para que `getUserMedia` con `chromeMediaSource: 'desktop'` funcione en el renderer de Electron, la ventana debe tener habilitado `contextIsolation: false` o el preload debe exponer los IDs de las fuentes de captura. En Urano, esto se gestiona mediante el IPC `desktop-capturer-get-sources`.

> [!WARNING]
> En **macOS**, este bloque de código fallará silenciosamente porque el sistema no expone el audio del sistema a través de `getUserMedia`. Verifica con `process.platform === 'darwin'` antes de ejecutar.
