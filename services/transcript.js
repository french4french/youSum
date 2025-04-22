// Placez ce fichier dans un dossier "services" à la racine de votre backend
// services/transcript.js

const axios = require('axios');

// Fonction pour obtenir la transcription d'une vidéo YouTube
async function getVideoTranscript(videoId, language = 'fr') {
    try {
        // D'abord, essayons d'obtenir les informations de la vidéo pour vérifier qu'elle existe
        const videoInfoURL = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`;
        const videoInfoResponse = await axios.get(videoInfoURL);
        
        if (!videoInfoResponse.data.items || videoInfoResponse.data.items.length === 0) {
            throw new Error('Vidéo non trouvée');
        }
        
        // Tenter d'obtenir la transcription via l'API timedtext
        const transcript = await getTimedTextTranscript(videoId, language);
        
        // Si trouvée, retourner
        if (transcript) {
            return transcript;
        }
        
        // Essayer avec d'autres langues
        const alternateLanguages = language === 'fr' ? ['en', 'es', 'de'] : ['fr', 'es', 'de'];
        for (const lang of alternateLanguages) {
            const altTranscript = await getTimedTextTranscript(videoId, lang);
            if (altTranscript) {
                return altTranscript;
            }
        }
        
        // Si aucune méthode ne fonctionne, générer une transcription simulée
        return generateFallbackTranscript(videoInfoResponse.data.items[0].snippet, videoId);
        
    } catch (error) {
        console.error(`Erreur lors de la récupération de la transcription pour ${videoId}:`, error);
        throw error;
    }
}

async function getTimedTextTranscript(videoId, language = 'fr') {
    try {
        // YouTube API pour récupérer les sous-titres disponibles
        // Cette API n'a pas de restrictions CORS côté serveur
        const captionsListURL = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`;
        const captionsResponse = await axios.get(captionsListURL);
        
        // Vérifier si des sous-titres sont disponibles
        if (captionsResponse.data.items && captionsResponse.data.items.length > 0) {
            // Trouver les sous-titres dans la langue demandée
            const caption = captionsResponse.data.items.find(
                item => item.snippet.language === language
            );
            
            // Si des sous-titres dans la langue demandée sont trouvés
            if (caption) {
                // Normalement, ici nous devrions pouvoir récupérer les sous-titres via l'API YouTube
                // Mais cela nécessite une authentification OAuth2, ce qui est plus complexe
                
                // Au lieu de cela, nous allons essayer de récupérer directement le XML de sous-titres
                // Note: Ceci est une approche alternative qui peut ne pas toujours fonctionner
                try {
                    const timedTextURL = `https://www.youtube.com/api/timedtext?lang=${language}&v=${videoId}`;
                    const timedTextResponse = await axios.get(timedTextURL);
                    
                    if (timedTextResponse.data) {
                        return parseTranscription(timedTextResponse.data);
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des sous-titres via timedtext:', error);
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Erreur lors de la récupération des sous-titres pour ${videoId}:`, error);
        return null;
    }
}

function parseTranscription(xmlData) {
    if (!xmlData) return null;
    
    try {
        // Pour le format XML de sous-titres
        if (xmlData.includes('<text')) {
            const textMatches = xmlData.match(/<text[^>]*>([^<]+)<\/text>/g) || [];
            const textLines = textMatches.map(line => {
                const contentMatch = line.match(/<text[^>]*>([^<]+)<\/text>/);
                return contentMatch ? contentMatch[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"') : '';
            }).filter(line => line.trim().length > 0);
            
            return textLines.join('\n');
        }
        // Pour le format VTT/SRT
        else if (xmlData.includes('-->')) {
            const lines = xmlData.split('\n');
            const textLines = [];
            
            const startIdx = lines.findIndex(line => line.includes('-->'));
            
            for (let i = startIdx; i < lines.length; i++) {
                if (!lines[i].match(/^\d+$/) &&
                    !lines[i].includes('-->') &&
                    !lines[i].startsWith('WEBVTT') &&
                    lines[i].trim().length > 0 &&
                    !lines[i].startsWith('NOTE ') &&
                    !lines[i].startsWith('<c>') &&
                    !lines[i].startsWith('</c>')) {
                    
                    let cleanLine = lines[i].trim()
                        .replace(/<[^>]*>/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"');
                    
                    if (cleanLine.length > 0) {
                        textLines.push(cleanLine);
                    }
                }
            }
            
            return textLines.join('\n');
        }
        // Format non reconnu
        else {
            console.log('Format de sous-titres non reconnu');
            return xmlData;
        }
    } catch (error) {
        console.error('Erreur lors de l\'analyse de la transcription:', error);
        return xmlData;
    }
}

function generateFallbackTranscript(videoSnippet, videoId) {
    // Créer une transcription de secours basée sur les métadonnées de la vidéo
    // Utile quand aucune méthode n'a fonctionné
    
    const videoTitle = videoSnippet.title || '';
    const videoDescription = videoSnippet.description || '';
    const channelTitle = videoSnippet.channelTitle || '';
    
    let fallbackTranscript = `Titre: ${videoTitle}\n\n`;
    fallbackTranscript += `Chaîne: ${channelTitle}\n\n`;
    fallbackTranscript += `Description:\n${videoDescription}\n\n`;
    fallbackTranscript += `Note: Cette transcription est générée à partir des métadonnées de la vidéo car les sous-titres ne sont pas accessibles directement. `;
    fallbackTranscript += `Pour une transcription complète, vous pourriez essayer d'activer les sous-titres automatiques sur YouTube directement.`;
    
    return fallbackTranscript;
}

// Méthode alternative: utiliser l'API d'Innertube (non officielle)
// Cette approche n'est pas recommandée pour la production mais peut être utile dans certains cas
async function getInnertubeTranscript(videoId, language = 'fr') {
    try {
        // Obtenir le contexte initial
        const response = await axios.post('https://www.youtube.com/youtubei/v1/player', {
            context: {
                client: {
                    clientName: 'WEB',
                    clientVersion: '2.20210408.08.00'
                }
            },
            videoId: videoId
        });
        
        // Vérifier si des sous-titres sont disponibles
        if (response.data &&
            response.data.captions &&
            response.data.captions.playerCaptionsTracklistRenderer) {
            
            const captionTracks = response.data.captions.playerCaptionsTracklistRenderer.captionTracks;
            
            if (captionTracks && captionTracks.length > 0) {
                // Trouver les sous-titres dans la langue demandée ou prendre le premier disponible
                const track = captionTracks.find(t => t.languageCode === language) || captionTracks[0];
                
                if (track && track.baseUrl) {
                    const subtitleResponse = await axios.get(track.baseUrl);
                    return parseTranscription(subtitleResponse.data);
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Erreur avec l\'API Innertube:', error);
        return null;
    }
}

module.exports = {
    getVideoTranscript
};