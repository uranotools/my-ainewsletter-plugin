import * as zlib from 'zlib';

export class PublisherPlugin {
    private config: any;
    private readonly REPO_OWNER = 'uranotools';
    private readonly REPO_NAME = 'my-ainewsletter-template';

    constructor(moduleConfig: any) {
        this.config = moduleConfig;
    }

    async executeAction(action: string, payload: any) {
        if (action === 'apiSetupRepository') return await this.apiSetupRepository();
        if (action === 'apiPublishPost') return await this.apiPublishPost(payload);
        if (action === 'apiGetLatestPosts') return await this.apiGetLatestPosts();
        if (action === 'apiGetPublisherConfig') return await this.apiGetPublisherConfig();
        if (action === 'apiFetchSources') return await this.apiFetchSources(payload);
        if (action === 'apiVerifySource') return await this.apiVerifySource(payload);
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

    private async downloadAndUploadImage(imageUrl: string, targetPath: string) {
        try {
            const fetchResponse = await fetch(imageUrl);
            if (!fetchResponse.ok) {
                throw new Error(`Error descargando la imagen: ${fetchResponse.statusText}`);
            }

            const arrayBuffer = await fetchResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Content = buffer.toString('base64');

            return await this.callGitHub('createOrUpdateFile', {
                path: targetPath,
                message: `Upload image ${targetPath}`,
                content: base64Content
            });
        } catch (error) {
            console.error("Error en downloadAndUploadImage:", error);
            throw error;
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
        // Un convertidor genérico de XML a JSON (heurístico)
        const result: any = {};
        
        // Limpiar comentarios y CDATA para simplificar
        let cleanXml = xml.replace(/<!--[\s\S]*?-->/g, '');
        cleanXml = cleanXml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, p1) => p1.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

        // Función recursiva para procesar tags
        const process = (str: string) => {
            const obj: any = {};
            const tagRegex = /<([^>/\s]+)([^>]*)>([\s\S]*?)<\/\1>/g;
            let match;
            let hasChildren = false;

            while ((match = tagRegex.exec(str)) !== null) {
                hasChildren = true;
                const [_, tag, attrs, content] = match;
                const childValue = process(content);
                
                if (obj[tag]) {
                    if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]];
                    obj[tag].push(childValue);
                } else {
                    obj[tag] = childValue;
                }
            }

            if (!hasChildren) {
                // Si no tiene hijos, devolver el texto limpio de HTML
                return str.replace(/<[^>]*>?/gm, '').trim();
            }
            return obj;
        };

        return process(cleanXml);
    }

    private async apiVerifySource(payload: { url: string }) {
        const { url } = payload;
        if (!url) throw new Error('El parámetro "url" es requerido.');
        
        try {
            console.log(`[Publisher] Verificando fuente con visión y metadatos: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                }
            });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const html = await response.text();
            
            let cheerio;
            try {
                cheerio = require('cheerio');
            } catch (e) {
                console.error("[Publisher] cheerio not found in paths:", e);
                throw new Error("El motor de análisis (cheerio) no está disponible en este entorno. Por favor, contacta al administrador.");
            }
            const $ = cheerio.load(html);
            
            // Extraer metadatos clave para evitar alucinaciones de fecha
            const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
            const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
            
            // Estrategia multi-tag para encontrar la fecha real de publicación
            const publishDate = $('meta[property="article:published_time"]').attr('content') || 
                                $('meta[name="pubdate"]').attr('content') || 
                                $('meta[name="publish-date"]').attr('content') ||
                                $('meta[name="date"]').attr('content') ||
                                $('time[datetime]').attr('datetime') || 
                                $('time').text().trim() || '';
                                
            const ogImage = $('meta[property="og:image"]').attr('content') || null;
            
            // Intentar detectar fecha en el texto si no hay meta tags (heurística simple)
            let inferredDate = publishDate;
            if (!inferredDate) {
                const dateMatch = html.match(/\d{4}[-/]\d{2}[-/]\d{2}/) || html.match(/\d{1,2} [a-zA-Z]+ \d{4}/);
                if (dateMatch) inferredDate = `[Detectado en texto]: ${dateMatch[0]}`;
            }

            const metadata = {
                title,
                description,
                publishDate: inferredDate || "No detectada (Ten cuidado con la antigüedad)",
                url,
                hasOgImage: !!ogImage
            };

            // Si hay imagen, la descargamos para enviarla como parte de visión (Pattern B de Urano)
            if (ogImage && ogImage.startsWith('http')) {
                try {
                    const imgRes = await fetch(ogImage);
                    if (imgRes.ok) {
                        const buffer = Buffer.from(await imgRes.arrayBuffer());
                        return {
                            metadata,
                            base64: buffer.toString('base64'),
                            mimeType: imgRes.headers.get('content-type') || 'image/jpeg'
                        };
                    }
                } catch (e) {
                    console.warn("[Publisher] Falló la descarga de og:image para visión:", e);
                }
            }

            return metadata;
        } catch (error: any) {
            console.error("[Publisher] Error en apiVerifySource:", error);
            return { error: error.message, url };
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
        // Mapeo robusto de parámetros (el LLM a veces usa sinónimos)
        const title = payload.title;
        const date = payload.date || payload.publishedAt || new Date().toISOString().split('T')[0];
        const rawCategories = payload.categories || (Array.isArray(payload.tags) ? payload.tags.join(',') : payload.tags) || "";
        const excerpt = payload.excerpt || payload.summary || "";
        const content = payload.content || payload.body || "";
        const imageUrl = payload.imageUrl || payload.image || null;
        const source = payload.source || (Array.isArray(payload.sourceUrls) ? payload.sourceUrls[0] : payload.sourceUrls) || "";
        const originalUrl = payload.originalUrl || payload.url || source;

        let localImageUrl = null;

        if (imageUrl) {
            // Descargar imagen y subir al repo
            const filename = `${Date.now()}-${imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg'}`;
            const targetPath = `assets/images/${filename}`;
            await this.downloadAndUploadImage(imageUrl, targetPath);
            localImageUrl = `/${targetPath}`;
        }

        // Obtenemos los posts actuales
        const { posts, sha } = await this.getPostsJson();

        // Creamos el nuevo post
        const newPost = {
            id: Date.now().toString(),
            title,
            date,
            categories: typeof rawCategories === 'string' ? rawCategories.split(',').map((c: string) => c.trim().toLowerCase()) : [],
            excerpt,
            content,
            imageUrl: localImageUrl || imageUrl, // usa local si se descargó, o la remota como fallback
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
            message: `Post "${title}" publicado correctamente.`,
            siteUrl: siteUrl,
            post: newPost
        };
    }
}
