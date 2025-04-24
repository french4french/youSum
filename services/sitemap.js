// services/sitemap.js
const fs = require('fs');
const path = require('path');

/**
 * Classe pour générer un sitemap XML
 */
class SitemapGenerator {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.urls = [];
    }
    
    /**
     * Ajoute une URL au sitemap
     * @param {string} url - Chemin relatif (ex: '/contact')
     * @param {Object} options - Options supplémentaires
     * @param {string} options.lastmod - Date de dernière modification (YYYY-MM-DD)
     * @param {string} options.changefreq - Fréquence de changement (daily, weekly, monthly, etc.)
     * @param {number} options.priority - Priorité (0.0 à 1.0)
     */
    addUrl(url, options = {}) {
        const defaults = {
            lastmod: new Date().toISOString().split('T')[0],
            changefreq: 'monthly',
            priority: 0.8
        };
        
        const settings = { ...defaults, ...options };
        
        // Assurer que l'URL commence par '/'
        const path = url.startsWith('/') ? url : `/${url}`;
        
        this.urls.push({
            loc: `${this.baseUrl}${path}`,
            ...settings
        });
        
        return this;
    }
    
    /**
     * Génère le contenu XML du sitemap
     * @returns {string} - Le contenu XML
     */
    generate() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        for (const url of this.urls) {
            xml += '  <url>\n';
            xml += `    <loc>${url.loc}</loc>\n`;
            xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
            xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
            xml += `    <priority>${url.priority}</priority>\n`;
            xml += '  </url>\n';
        }
        
        xml += '</urlset>';
        return xml;
    }
    
    /**
     * Écrit le sitemap dans un fichier
     * @param {string} filePath - Chemin où sauvegarder le fichier
     */
    async save(filePath) {
        const xml = this.generate();
        
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, xml, 'utf8', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

/**
 * Génère le sitemap de l'application
 * @param {string} baseUrl - URL de base du site
 * @param {string} outputPath - Chemin où sauvegarder le sitemap.xml
 */
async function generateSitemap(baseUrl, outputPath = 'public/sitemap.xml') {
    const sitemap = new SitemapGenerator(baseUrl);
    
    // Ajout des pages principales
    sitemap
        .addUrl('/', { priority: 1.0, changefreq: 'weekly' })
        .addUrl('/privacy', { priority: 0.7, changefreq: 'monthly' })
        .addUrl('/terms', { priority: 0.7, changefreq: 'monthly' })
        .addUrl('/contact', { priority: 0.8, changefreq: 'monthly' })
        .addUrl('/sitemap.html', { priority: 0.5, changefreq: 'monthly' });
    
    try {
        await sitemap.save(outputPath);
        console.log(`Sitemap généré avec succès à ${outputPath}`);
        return true;
    } catch (error) {
        console.error('Erreur lors de la génération du sitemap:', error);
        return false;
    }
}

module.exports = {
    generateSitemap,
    SitemapGenerator
};