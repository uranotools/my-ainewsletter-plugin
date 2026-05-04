export const UranoNewsPublisherConfig = {
    name: "UranoNewsPublisher",
    description: "Publicador autónomo de newsletters de IA en GitHub Pages. Usa el GitHub MCP existente.",
    icon: "Newspaper",
    category: 'Utilidades',
    enabledPlugins: ['Publisher'],
    settings: [
        {
            name: 'SOURCES',
            type: 'code',
            title: 'Fuentes de noticias (una URL por línea)',
            default: 'https://news.ycombinator.com/rss\nhttps://arxiv.org/list/cs.AI/recent'
        },
        {
            name: 'FREQUENCY',
            type: 'select',
            title: 'Frecuencia recomendada para el scheduler',
            options: [
                { label: 'Diaria', value: 'daily' },
                { label: 'Cada 6 horas', value: '6h' },
                { label: 'Cada 12 horas', value: '12h' }
            ],
            default: 'daily'
        },
        {
            name: 'MIN_SCORE',
            type: 'text',
            title: 'Puntuación mínima para publicar (0-100)',
            default: '70'
        }
    ],

    pluginSchemas: {
        Publisher: {
            actions: {
                setupRepository: {
                    label: '🔧 Configurar Repositorio (Primera vez)',
                    fields: []
                },
                publishPost: {
                    label: '📤 Publicar Post',
                    fields: [
                        { name: 'title', type: 'required', label: 'Título' },
                        { name: 'date', type: 'text', label: 'Fecha (YYYY-MM-DD)' },
                        { name: 'categories', type: 'text', label: 'Categorías (separadas por coma)' },
                        { name: 'excerpt', type: 'prompt', label: 'Extracto / Resumen' },
                        { name: 'content', type: 'prompt', label: 'Contenido completo (Markdown)' },
                        { name: 'imageUrl', type: 'text', label: 'URL de imagen (opcional)' },
                        { name: 'source', type: 'text', label: 'Fuente' },
                        { name: 'originalUrl', type: 'text', label: 'URL original' }
                    ]
                },
                getLatestPosts: {
                    label: '📜 Ver posts publicados (Contexto / Duplicados)',
                    description: 'Obtiene el historial de noticias ya publicadas. ÚSALO SOLO PARA EVITAR DUPLICADOS. No es una fuente de noticias nuevas.',
                    fields: []
                },
                getPublisherConfig: {
                    label: '⚙️ Obtener Configuración (Fuentes y Reglas)',
                    fields: []
                },
                fetchSources: {
                    label: '📡 Obtener contenido de fuentes RSS/Web',
                    fields: [
                        { name: 'index', type: 'text', label: 'Índice (id) de la fuente (opcional, vacío para todas)' },
                        { name: 'page', type: 'number', label: 'Número de página (opcional, por defecto 1)' },
                        { name: 'pageSize', type: 'number', label: 'Elementos por página (opcional, por defecto 10)' }
                    ]
                }
            }
        }
    }
};
