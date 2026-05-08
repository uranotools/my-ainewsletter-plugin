import * as zlib from 'zlib';

export class PublisherPlugin {
    private config: any;
    private readonly REPO_OWNER = 'uranotools';
    private readonly REPO_NAME = 'my-ainewsletter-template';
    private readonly OG_IMAGE_SITES = ['github.com', 'twitter.com', 'x.com', 'linkedin.com', 'npm.com', 'openai.com'];

    constructor(moduleConfig: any) {
        this.config = moduleConfig;
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async executeAction(action: string, payload: any) {
        if (action === 'apiSetupRepository') return await this.apiSetupRepository();
        if (action === 'apiPublishPost') return await this.apiPublishPost(payload);
        if (action === 'apiGetLatestPosts') return await this.apiGetLatestPosts();
        if (action === 'apiGetPublisherConfig') return await this.apiGetPublisherConfig();
        if (action === 'apiFetchSources') return await this.apiFetchSources(payload);
        if (action === 'apiVerifySource') return await this.apiVerifySource(payload);
        if (action === 'apiDownloadAndUploadImage') return await this.apiDownloadAndUploadImage(payload);
        throw new Error(`Action ${action} no encontrada`);
    }

    private async callGitHub(action: string, data: any = {}) {
        return await this.config._callPlugin(
            'GitHub',         // Nombre del módulo MCP de GitHub
            'Issues',   // Nombre de la clase del plugin
            action,
            {
                owner: this.REPO_OWNER,
                repo: this.REPO_NAME,
                ...data
            }
        );
    }

    private async getPostsJson() {
        try {
            // Utilizamos el tool de GitHub para obtener el archivo
            const response = await this.callGitHub('getFileContents', {
                path: 'public/data/posts.json'
            });

            // El servidor MCP suele entregarnos el contenido ya decodificado como string
            let content = '';
            let sha = null;

            if (response && response.content) {
                content = response.content;
                sha = response.sha;

                // Si por alguna razón el contenido viene como buffer binario o GZIP
                if (typeof content === 'string' && content.startsWith('\x1f\x8b')) {
                    try {
                        const buffer = Buffer.from(content, 'binary');
                        content = zlib.gunzipSync(buffer).toString('utf-8');
                    } catch (e) {
                        console.error("Error descomprimiendo GZIP:", e);
                    }
                }
            } else if (typeof response === 'string') {
                content = response;
            }

            if (!content || content.trim() === '') {
                return { posts: [], sha: null };
            }

            try {
                const parsed = JSON.parse(content);
                return { posts: Array.isArray(parsed) ? parsed : [], sha };
            } catch (e) {
                console.error("Error crítico parseando JSON de GitHub:", e);
                throw new Error(`El archivo posts.json no es un JSON válido. Cancelo la operación para evitar pérdida de datos.`);
            }
        } catch (error) {
            // Si es un error de "archivo no encontrado", podemos retornar vacío.
            // Pero si es el error que acabamos de lanzar arriba, debemos relanzarlo.
            if (error.message.includes('corrupto') || error.message.includes('válido')) {
                throw error;
            }

            console.error("Error al obtener posts.json:", error);
            return { posts: [], sha: null };
        }
    }

    private async savePostsJson(posts: any[], sha?: string) {
        const content = JSON.stringify(posts, null, 2);

        const payload: any = {
            path: 'public/data/posts.json',
            message: `Update posts.json with new articles`,
            content: content
        };

        if (sha) {
            payload.sha = sha;
        }

        return await this.callGitHub('createOrUpdateFile', payload);
    }

    private async apiDownloadAndUploadImage(payload: any) {
        const { imageUrl, targetPath } = payload;
        if (!imageUrl) throw new Error('El parámetro "imageUrl" es requerido.');
        
        // Si no se especifica targetPath, generamos uno por defecto
        let finalPath = targetPath;
        if (!finalPath) {
            const filename = `${Date.now()}-${imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg'}`;
            finalPath = `assets/images/${filename}`;
        }

        try {
            const fetchResponse = await fetch(imageUrl);
            if (!fetchResponse.ok) {
                throw new Error(`Error descargando la imagen: ${fetchResponse.statusText}`);
            }

            const arrayBuffer = await fetchResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await this.callGitHub('createOrUpdateFile', {
                path: finalPath,
                message: `Upload image ${finalPath}`,
                content: buffer.toString('binary')
            });

            return {
                success: true,
                remoteUrl: imageUrl,
                localUrl: `/${finalPath}`,
                path: finalPath
            };
        } catch (error: any) {
            console.error("Error en apiDownloadAndUploadImage:", error);
            throw new Error(`No se pudo subir la imagen: ${error.message}`);
        }
    }

    private async apiSetupRepository() {
        // Inicializa el data/posts.json vacio si no existe
        const { posts } = await this.getPostsJson();
        if (posts.length === 0) {
            await this.savePostsJson([]);
            return "Repositorio inicializado correctamente. data/posts.json ha sido creado.";
        }
        return "El repositorio ya está configurado y contiene data/posts.json.";
    }

    private async apiGetLatestPosts() {
        const { posts } = await this.getPostsJson();
        // Ordenamos por fecha descendente
        return posts.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }

    private async apiGetPublisherConfig() {
        const rawSources = this.config.SOURCES ? this.config.SOURCES.split('\n').filter((s: string) => s.trim() !== '') : [];
        const sourcesWithIndex = rawSources.map((url: string, index: number) => ({ id: index, url }));
        return {
            sources: sourcesWithIndex,
            frequency: this.config.FREQUENCY,
            minScore: this.config.MIN_SCORE
        };
    }

    private xmlToJSON(xml: string): any {
        // Un convertidor genérico de XML a JSON (heurístico) mejorado para atributos comunes de imágenes
        const result: any = {};

        // Limpiar comentarios y CDATA para simplificar
        let cleanXml = xml.replace(/<!--[\s\S]*?-->/g, '');
        cleanXml = cleanXml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, p1) => p1.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

        // Función recursiva para procesar tags
        const process = (str: string) => {
            const obj: any = {};
            const tagRegex = /<([^>/\s]+)([^>]*)>([\s\S]*?)<\/\1>|<([^>/\s]+)([^>]*)\/>/g;
            let match;
            let hasChildren = false;

            while ((match = tagRegex.exec(str)) !== null) {
                hasChildren = true;
                const tag = match[1] || match[4];
                const attrs = match[2] || match[5];
                const content = match[3];

                let childValue: any = content !== undefined ? process(content) : {};

                // Capturar atributos comunes (url, href, src) si el objeto está vacío o es un string
                if (attrs) {
                    const attrRegex = /(url|href|src|type)="([^"]*)"/gi;
                    let attrMatch;
                    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                        if (typeof childValue === 'string') {
                            childValue = { _text: childValue };
                        }
                        childValue[attrMatch[1].toLowerCase()] = attrMatch[2];
                    }
                }

                if (obj[tag]) {
                    if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]];
                    obj[tag].push(childValue);
                } else {
                    obj[tag] = childValue;
                }
            }

            if (!hasChildren) {
                return str.replace(/<[^>]*>?/gm, '').trim();
            }
            return obj;
        };

        return process(cleanXml);
    }

    /**
     * Puente para llamar a otros plugins desde un módulo del Workspace.
     */
    private async callOtherPlugin(targetModule: string, targetPlugin: string, action: string, data: any) {
        if (typeof this.config?._callPlugin !== 'function') {
            console.error('[Publisher] Error: _callPlugin no está inyectado.');
            throw new Error('Plugin bridge not available');
        }
        return await this.config._callPlugin(targetModule, targetPlugin, action, data);
    }

    async apiVerifySource(data?: any): Promise<any> {
        const url = data?.url;
        try {
            if (!url) throw new Error('El parámetro "url" es requerido.');

            console.log(`[Publisher] Verificación PRO iniciada para: ${url}`);
            const urlObj = new URL(url);

            // 1. Detectar si es una fuente que prefiere OG:Image (ej: GitHub)
            const useOgImage = this.OG_IMAGE_SITES.some(site => url.includes(site));

            // 2. Intentar extracción profesional vía Tavily
            let verifyResult: any;
            try {
                verifyResult = await this.callOtherPlugin('TavilySearch', 'Search', 'search', {
                    query: url,
                    search_depth: 'advanced',
                    include_images: true,
                    max_results: 1
                });
            } catch (e) {
                console.warn('[Publisher] Tavily falló, intentando WebSearch fallback...');
            }

            // Fallback a WebSearch
            if (!verifyResult || verifyResult.isError) {
                verifyResult = await this.callOtherPlugin('WebSearch', 'Search', 'search', {
                    query: url,
                    max_results: 1
                });
            }

            const parts: any[] = [];
            const metadata = (verifyResult.results?.[0] || verifyResult) || {};

            // Parte 1: Metadatos y Feedback (Siempre Texto)
            let foundImageUrl = metadata.image || (verifyResult.images?.[0]);
            
            // Especialización para GitHub
            if (!foundImageUrl && urlObj.hostname.includes('github.com')) {
                foundImageUrl = `https://opengraph.githubassets.com/${Math.random().toString(36).substring(7)}${urlObj.pathname}`;
            }

            parts.push({
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    source: url,
                    verifiedAt: new Date().toISOString(),
                    title: metadata.title || 'No detectado',
                    snippet: metadata.content || metadata.snippet || 'No disponible',
                    imageUrl: foundImageUrl || null,
                    status: 'verified_pro'
                }, null, 2)
            });

            // Parte 2: Imagen (Captura Real con Electron o OG:Image)
            let screenshotBase64 = null;
            let screenshotBuffer: Buffer | null = null;

            // Si es un sitio social/dev, preferimos su OG:Image oficial
            if (useOgImage && foundImageUrl && !foundImageUrl.startsWith('/')) {
                try {
                    const imgRes = await fetch(foundImageUrl);
                    if (imgRes.ok) {
                        screenshotBuffer = Buffer.from(await imgRes.arrayBuffer());
                        screenshotBase64 = screenshotBuffer.toString('base64');
                        console.log(`[Publisher] OG:Image capturada para ${urlObj.hostname}`);
                    }
                } catch (e) {
                    console.warn('[Publisher] Falló captura de OG:Image, intentando Electron...');
                }
            }

            // Si no tenemos imagen (o no es sitio social), usamos el motor de renderizado de Electron
            if (!screenshotBase64) {
                try {
                    console.log(`[Publisher] Iniciando Stealth Screenshot para: ${url}`);
                    const { BrowserWindow } = require('electron');
                    const win = new BrowserWindow({
                        width: 1280,
                        height: 1000,
                        show: false,
                        webPreferences: {
                            offscreen: true,
                            images: true,
                            javascript: true
                        }
                    });

                    // Timeout de carga de 20s
                    await Promise.race([
                        win.loadURL(url),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loading page')), 20000))
                    ]);

                    // Esperar 3s para que termine de renderizar el JS
                    await new Promise(r => setTimeout(r, 3000));

                    let image = await win.webContents.capturePage();
                    if (image.getSize().width > 1280) image = image.resize({ width: 1280 });
                    screenshotBuffer = image.toPNG();
                    screenshotBase64 = screenshotBuffer.toString('base64');
                    win.destroy();
                    console.log("[Publisher] Stealth Screenshot completado.");
                } catch (e: any) {
                    console.warn(`[Publisher] Falló captura visual de Electron: ${e.message}`);
                }
            }

            // Fallback Crítico: Si no había imageUrl remota pero tenemos captura, guardamos la captura y la usamos como imageUrl
            if (!foundImageUrl && screenshotBuffer) {
                try {
                    const filename = `capture-${Date.now()}.png`;
                    const targetPath = `assets/images/captures/${filename}`;
                    
                    await this.callGitHub('createOrUpdateFile', {
                        path: targetPath,
                        message: `Upload automated capture for ${url}`,
                        content: screenshotBuffer.toString('binary')
                    });
                    
                    foundImageUrl = `/${targetPath}`;
                    
                    // Actualizamos la parte de texto para que el agente vea la nueva URL
                    const textPart = parts.find(p => p.type === 'text');
                    if (textPart) {
                        const json = JSON.parse(textPart.text);
                        json.imageUrl = foundImageUrl;
                        json.imageSource = 'stealth-capture';
                        textPart.text = JSON.stringify(json, null, 2);
                    }
                } catch (e) {
                    console.error("[Publisher] Error guardando captura de fallback:", e);
                }
            }

            if (screenshotBase64) {
                parts.push({
                    type: 'image',
                    image: screenshotBase64,
                    mimeType: 'image/png'
                });
            }

            return parts;

        } catch (error: any) {
            console.error('[Publisher] Error crítico en apiVerifySource:', error);

            // Informe detallado para el LLM ( detective mode )
            const errorReport = {
                success: false,
                url: url,
                errorType: error.name || 'RuntimeError',
                message: error.message || 'Error desconocido durante el proceso de verificación.',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                actionRequired: !url ? 'Proporciona una URL válida.' : 'Verifica si el sitio permite el acceso de bots o intenta con otra fuente.',
                timestamp: new Date().toISOString()
            };

            return [
                {
                    type: 'text',
                    text: `❌ ERROR DE VERIFICACIÓN: No se pudo procesar la fuente "${url || 'URL no proporcionada'}".\n\n` +
                        `Razón detectada: ${errorReport.message}\n` +
                        `Sugerencia: ${errorReport.actionRequired}`
                },
                {
                    type: 'text',
                    text: JSON.stringify(errorReport, null, 2)
                }
            ];
        }
    }

    private async apiFetchSources(payload: any) {
        const { index, page = 1, pageSize = 10 } = payload;
        const { sources } = await this.apiGetPublisherConfig();

        let targetSources = sources;
        if (index !== undefined && index !== null && index !== '') {
            const idx = parseInt(index, 10);
            const source = sources.find((s: any) => s.id === idx);
            if (source) {
                targetSources = [source];
            } else {
                throw new Error(`Fuente con id ${index} no encontrada.`);
            }
        }

        const results = [];
        for (const source of targetSources) {
            try {
                const response = await fetch(source.url);
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const text = await response.text();

                let content: any = text;
                const pIndex = Math.max(1, parseInt(page, 10));
                const pSize = parseInt(pageSize, 10);

                // Si es XML, lo convertimos y paginamos si es una lista
                if (text.trim().startsWith('<?xml') || text.includes('<rss') || text.includes('<feed') || text.includes('</')) {
                    try {
                        const parsed = this.xmlToJSON(text);

                        // Intentar encontrar la lista de items principal para paginar
                        // RSS: channel.item, Atom: feed.entry
                        let items = [];
                        if (parsed.rss?.channel?.item) items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
                        else if (parsed.feed?.entry) items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];

                        if (items.length > 0) {
                            const start = (pIndex - 1) * pSize;
                            const paginatedItems = items.slice(start, start + pSize);
                            content = {
                                type: 'paginated-feed',
                                page: pIndex,
                                totalItems: items.length,
                                totalPages: Math.ceil(items.length / pSize),
                                items: paginatedItems
                            };
                        } else {
                            content = { type: 'structured-xml', data: parsed };
                        }
                    } catch (e) {
                        console.error("Error convirtiendo XML:", e);
                    }
                } else {
                    // Paginación por caracteres para texto plano largo
                    const charLimit = 15000;
                    if (text.length > charLimit) {
                        const start = (pIndex - 1) * charLimit;
                        content = {
                            type: 'paginated-text',
                            page: pIndex,
                            totalChars: text.length,
                            content: text.substring(start, start + charLimit) + (text.length > start + charLimit ? '... [CONTINUA EN SIGUIENTE PAGINA]' : '')
                        };
                    }
                }

                results.push({
                    id: source.id,
                    url: source.url,
                    content: content
                });
            } catch (error: any) {
                results.push({ id: source.id, url: source.url, error: error.message });
            }
        }

        return results;
    }

    private async apiPublishPost(payload: any) {
        // Soporte robusto: si el agente envía un objeto 'post', lo usamos como fuente
        const data = payload.post || payload;

        // Mapeo robusto de parámetros (el LLM a veces usa sinónimos)
        const title = data.title;
        const date = data.date || data.publishedAt || new Date().toISOString().split('T')[0];
        const rawCategories = data.categories || (Array.isArray(data.tags) ? data.tags.join(',') : data.tags) || "";
        const excerpt = data.excerpt || data.summary || "";
        const content = data.content || data.body || "";
        const imageUrl = data.imageUrl || data.image || null;
        const source = data.source || (Array.isArray(data.sourceUrls) ? data.sourceUrls[0] : data.sourceUrls) || "";
        const originalUrl = data.originalUrl || data.url || source;

        // Validación inteligente de campos obligatorios
        if (!title || title.trim() === '' || title === 'undefined' || !content || content.trim() === '') {
            return {
                success: false,
                message: "❌ ERROR DE VALIDACIÓN: Faltan campos obligatorios o el formato es incorrecto. El título no puede ser 'undefined' y el contenido no puede estar vacío.",
                instructions: "Asegúrate de proporcionar un objeto JSON completo y bien formado.",
                example: {
                    title: "Claude 3.5 Sonnet: El nuevo estándar en IA",
                    date: new Date().toISOString().split('T')[0],
                    categories: "ia, anthropic, modelos",
                    excerpt: "Un breve resumen de la noticia...",
                    content: "Aquí va el cuerpo completo en Markdown...",
                    imageUrl: imageUrl || "/assets/images/captures/ejemplo.png",
                    source: "Anthropic News",
                    originalUrl: originalUrl || "https://..."
                }
            };
        }

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Obtenemos los posts actuales (DEBE estar dentro del loop para re-intentar con SHA fresco)
                const { posts, sha } = await this.getPostsJson();

                // Creamos el nuevo post
                const newPost = {
                    id: Date.now().toString(),
                    title,
                    date,
                    categories: typeof rawCategories === 'string' ? rawCategories.split(',').map((c: string) => c.trim().toLowerCase()) : [],
                    excerpt,
                    content,
                    imageUrl, // Usamos la URL tal cual viene (el agente debe haberla subido previamente si quería una local)
                    source,
                    originalUrl
                };

                // Añadimos al inicio
                posts.unshift(newPost);

                // Guardamos
                await this.savePostsJson(posts, sha);

                const siteUrl = `https://${this.REPO_OWNER}.github.io/${this.REPO_NAME}`;

                return {
                    success: true,
                    message: `Post "${title}" publicado correctamente.${attempts > 0 ? ` (En el intento ${attempts + 1})` : ''}`,
                    siteUrl: siteUrl,
                    post: newPost
                };
            } catch (error: any) {
                const isConflict = error.message.includes('Conflict') || error.message.includes('sha');

                if (isConflict && attempts < maxAttempts - 1) {
                    attempts++;
                    const delay = 1000 + Math.random() * 2000;
                    console.log(`Conflicto de SHA detectado al publicar "${title}". Reintentando en ${Math.round(delay)}ms... (Intento ${attempts})`);
                    await this.sleep(delay);
                    continue;
                }

                console.error(`Error final al publicar post "${title}":`, error);
                throw error;
            }
        }
    }
}
