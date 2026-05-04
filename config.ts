export const UranoNewsPublisherConfig = {
    name: "UranoNewsPublisher",
    description: "Publicador autónomo de newsletters de IA en GitHub Pages. Usa el GitHub MCP existente.",
    icon: "Newspaper",
    category: 'Utilidades',
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
                    label: '📋 Obtener últimos posts',
                    fields: []
                }
            }
        }
    }
};
