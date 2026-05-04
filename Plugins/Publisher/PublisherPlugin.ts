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
        throw new Error(`Action ${action} no encontrada`);
    }

    private async callGitHub(action: string, data: any = {}) {
        const { CoreFactory } = await import('@core/CoreFactory');
        const pm = await CoreFactory.getPluginManager();

        return await pm.executeAction(
            'GitHub',                    // Nombre del MCP de GitHub
            'GitHubPlugin',              // Ajustar según el nombre real del plugin de GitHub
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
                path: 'data/posts.json'
            });

            // La respuesta de GitHub MCP suele venir en un formato específico, extraemos el contenido.
            let content = '';
            let sha = null;
            if (response && response.content) {
                // Puede que esté en base64 u otro formato
                content = response.content;
                sha = response.sha;
            } else if (typeof response === 'string') {
                content = response;
            } else if (response && response.fileContent) {
                content = response.fileContent;
                sha = response.sha;
            }

            // Limpiamos y parseamos
            if (!content) {
                return { posts: [], sha: null };
            }

            const parsed = JSON.parse(content);
            return { posts: Array.isArray(parsed) ? parsed : [], sha };
        } catch (error) {
            // Si el archivo no existe, retornamos un array vacío
            console.error("Error al obtener posts.json:", error);
            return { posts: [], sha: null };
        }
    }

    private async savePostsJson(posts: any[], sha?: string) {
        const content = JSON.stringify(posts, null, 2);

        const payload: any = {
            path: 'data/posts.json',
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

    private async apiFetchSources(payload: any) {
        const { index } = payload;
        const { sources } = await this.apiGetPublisherConfig();

        let targetSources = sources;
        // Si el agente envía un índice, filtramos para buscar solo esa fuente
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
                // Retornamos el texto del feed/página truncado a un tamaño razonable para el LLM
                results.push({
                    id: source.id,
                    url: source.url,
                    content: text.length > 20000 ? text.substring(0, 20000) + '... [TRUNCATED]' : text
                });
            } catch (error: any) {
                results.push({ id: source.id, url: source.url, error: error.message });
            }
        }

        return results;
    }

    private async apiPublishPost(payload: any) {
        const { title, date, categories, excerpt, content, imageUrl, source, originalUrl } = payload;

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
            categories: categories ? categories.split(',').map((c: string) => c.trim().toLowerCase()) : [],
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
