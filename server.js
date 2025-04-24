const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Importer nos services
const transcriptService = require('./services/transcript');
const sitemapService = require('./services/sitemap');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Gère les problèmes CORS
app.use(express.json()); // Parse le JSON

// Servir les fichiers statiques frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
// 1. Endpoint pour récupérer les informations d'une vidéo YouTube
app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.videoId;
        if (!videoId) {
            return res.status(400).json({ error: 'ID de vidéo requis' });
        }
        
        // Requête à l'API YouTube
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
                part: 'snippet,contentDetails',
                id: videoId,
                key: process.env.YOUTUBE_API_KEY
            }
        });
        
        // Vérifier la réponse
        if (!response.data.items || response.data.items.length === 0) {
            return res.status(404).json({ error: 'Vidéo non trouvée' });
        }
        
        // Renvoyer les données au client
        res.json(response.data);
    } catch (error) {
        console.error('Erreur lors de la récupération des infos vidéo:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
});

// 2. Endpoint pour récupérer la transcription d'une vidéo
app.get('/api/transcript', async (req, res) => {
    try {
        const videoId = req.query.videoId;
        const language = req.query.language || 'fr';
        
        if (!videoId) {
            return res.status(400).json({ error: 'ID de vidéo requis' });
        }
        
        // Utiliser notre service de transcription
        const transcript = await transcriptService.getVideoTranscript(videoId, language);
        
        if (!transcript) {
            return res.status(404).json({ error: 'Transcription non disponible pour cette vidéo' });
        }
        
        // Renvoyer la transcription
        res.json({ transcript });
    } catch (error) {
        console.error('Erreur lors de la récupération de la transcription:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
});

// 3. Endpoint pour générer un résumé avec Gemini
/*app.post('/api/summarize', async (req, res) => {
    try {
        const { transcription, videoInfo, language = 'fr', isShorter = false } = req.body;
        
        if (!transcription) {
            return res.status(400).json({ error: 'Transcription requise' });
        }
        
        // Préparer le prompt en fonction de la langue
        let prompt = '';
        if (language === 'fr') {
            prompt = `
        ${isShorter ? 'Voici le début de la transcription d\'une vidéo YouTube.' : 'Voici la transcription d\'une vidéo YouTube'}
        ${videoInfo ? `intitulée "${videoInfo.title}".` : ''}

        Je voudrais que tu me fournisses:

        1. Un résumé détaillé de la vidéo (environ 5-10 paragraphes) qui capture tous les points clés et les arguments principaux.

        2. Les points clés/principaux enseignements de la vidéo sous forme de liste à puces.

        3. Si applicable, une liste des sources, références ou personnes mentionnées dans la vidéo.

        4. Tout conseil pratique ou action recommandée dans la vidéo.

        ${isShorter ? 'Note: Cette transcription est partielle (seulement le début de la vidéo), alors indique clairement qu\'il s\'agit d\'un résumé partiel.' : ''}

        Voici la transcription:

        ${transcription}
      `;
        } else {
            prompt = `
        ${isShorter ? 'Here is the beginning of a YouTube video transcript.' : 'Here is the transcript of a YouTube video'}
        ${videoInfo ? `titled "${videoInfo.title}".` : ''}

        I would like you to provide:

        1. A detailed summary of the video (about 5-10 paragraphs) that captures all the key points and main arguments.

        2. The key points/main lessons from the video in bullet point form.

        3. If applicable, a list of sources, references, or people mentioned in the video.

        4. Any practical advice or recommended actions from the video.

        ${isShorter ? 'Note: This is a partial transcript (only the beginning of the video), so please clearly indicate that this is a partial summary.' : ''}

        Here's the transcript:

        ${transcription}
      `;
        }
        
        // Requête à l'API Gemini
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY
                }
            }
        );
        
        // Transformation de la réponse pour la rendre compatible avec le client
        let responseData;
        
        try {
            // Extraire le texte du résumé de la structure Gemini
            if (response.data &&
                response.data.candidates &&
                response.data.candidates[0] &&
                response.data.candidates[0].content &&
                response.data.candidates[0].content.parts &&
                response.data.candidates[0].content.parts[0] &&
                response.data.candidates[0].content.parts[0].text) {
                
                // Format attendu par le client
                responseData = {
                    summary: response.data.candidates[0].content.parts[0].text,
                    // Optionnellement, conserver les données brutes pour debugging
                    _raw: response.data
                };
            } else {
                // Si la structure n'est pas celle attendue
                console.error("Structure de réponse Gemini inattendue:", JSON.stringify(response.data));
                responseData = {
                    error: "Structure de réponse de l'API inattendue",
                    _raw: response.data
                };
            }
        } catch (parseError) {
            console.error("Erreur lors de l'extraction du résumé:", parseError);
            responseData = {
                error: "Impossible d'extraire le résumé de la réponse de l'API",
                _raw: response.data
            };
        }
        
        // Renvoyer la réponse transformée au client
        res.json(responseData);
    } catch (error) {
        console.error('Erreur lors de la génération du résumé:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
});*/
app.post('/api/summarize', async (req, res) => {
    try {
        const { transcription, videoInfo, language = 'fr', isShorter = false } = req.body;
        
        if (!transcription) {
            return res.status(400).json({ error: 'Transcription requise' });
        }
        
        // --- Génération du Prompt Amélioré pour la Présentation ---
        let prompt = '';
        const videoTitle = videoInfo && videoInfo.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const channelName = videoInfo && videoInfo.channelTitle ? `${videoInfo.channelTitle}` : 'Chaîne inconnue';
        const transcriptTypeText = isShorter ?
            (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') :
            (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
# CONTEXTE
Tu es un expert en création de résumés vidéo clairs, concis et informatifs. Ta mission est de générer un résumé structuré d'une vidéo YouTube qui sera facile à lire et à comprendre pour n'importe quel lecteur.

# INFORMATIONS SUR LA VIDÉO
- Titre: ${videoTitle}
- Chaîne: ${channelName}
- Type de transcription: ${transcriptTypeText}

# INSTRUCTIONS DE RÉSUMÉ
Crée un résumé qualitatif et bien structuré qui capture l'essentiel de la vidéo. Le résumé doit:

1. Commencer par une introduction qui contextualise le sujet de la vidéo en 1-2 phrases
2. Être organisé en sections claires avec des titres pertinents
3. Utiliser des paragraphes courts (2-3 phrases maximum)
4. Présenter les informations dans un ordre logique et cohérent
5. Employer un style naturel, fluide et agréable à lire
6. Être précis et factuel, sans embellissement inutile
${isShorter ? '7. Indiquer clairement que ce résumé est basé sur une transcription partielle et peut ne pas couvrir l\'intégralité du contenu' : ''}

# FORMAT DE SORTIE (MARKDOWN)
Utilise exactement cette structure pour ton résumé:

## En Bref
Synthétise l'ensemble du contenu en 2-3 phrases percutantes qui donnent l'essentiel de la vidéo.

## Points Essentiels
Liste sous forme de puces (•) les 3-5 informations les plus importantes à retenir de la vidéo:
• Point 1
• Point 2
• etc.

## Résumé Détaillé
Organise cette section en 2-4 sous-sections avec des sous-titres (###) pertinents. Chaque sous-section doit:
- Contenir 1-3 paragraphes courts et concis
- Présenter un aspect spécifique du contenu
- Être facile à lire rapidement

### Sous-titre 1
Paragraphe 1...

Paragraphe 2...

### Sous-titre 2
Paragraphe...

## Informations Complémentaires
Ajoute toute information pertinente qui enrichit la compréhension:
• Références citées: personnes, livres, études (si mentionnées)
• Concepts clés expliqués
• Contexte supplémentaire pour mieux comprendre le sujet
• Conseils ou actions recommandées (si applicables)

# CONSIGNES STYLISTIQUES
- Sois concis et direct
- Évite le jargon sauf s'il est essentiel au sujet
- Utilise un ton neutre mais engageant
- Préfère la voix active à la voix passive
- Emploie des connecteurs logiques pour assurer la fluidité
- Priorise les phrases courtes et claires
- N'ajoute jamais d'information qui n'est pas présente dans la transcription

# TRANSCRIPTION
${transcription}
`;
        } else { // language 'en' or default
            prompt = `
# CONTEXT
You are an expert at creating clear, concise, and informative video summaries. Your mission is to generate a structured summary of a YouTube video that will be easy to read and understand for any reader.

# VIDEO INFORMATION
- Title: ${videoTitle}
- Channel: ${channelName}
- Transcript type: ${transcriptTypeText}

# SUMMARY INSTRUCTIONS
Create a qualitative, well-structured summary that captures the essence of the video. The summary must:

1. Begin with an introduction that contextualizes the video's subject in 1-2 sentences
2. Be organized into clear sections with relevant headings
3. Use short paragraphs (maximum 2-3 sentences)
4. Present information in a logical and coherent order
5. Employ a natural, fluid, and pleasant-to-read style
6. Be precise and factual, without unnecessary embellishment
${isShorter ? '7. Clearly indicate that this summary is based on a partial transcript and may not cover the entire content' : ''}

# OUTPUT FORMAT (MARKDOWN)
Use exactly this structure for your summary:

## In Brief
Synthesize the entire content in 2-3 impactful sentences that convey the essence of the video.

## Key Takeaways
List in bullet points (•) the 3-5 most important pieces of information to remember from the video:
• Point 1
• Point 2
• etc.

## Detailed Summary
Organize this section into 2-4 subsections with relevant subtitles (###). Each subsection should:
- Contain 1-3 short and concise paragraphs
- Present a specific aspect of the content
- Be easy to quickly read

### Subtitle 1
Paragraph 1...

Paragraph 2...

### Subtitle 2
Paragraph...

## Additional Information
Add any relevant information that enhances understanding:
• Cited references: people, books, studies (if mentioned)
• Key concepts explained
• Additional context to better understand the subject
• Tips or recommended actions (if applicable)

# STYLISTIC GUIDELINES
- Be concise and direct
- Avoid jargon unless essential to the subject
- Use a neutral but engaging tone
- Prefer active voice over passive voice
- Use logical connectors to ensure fluidity
- Prioritize short and clear sentences
- Never add information that is not present in the transcript

# TRANSCRIPT
${transcription}
`;
        }
        // --- Fin de la Génération du Prompt Amélioré ---
        
        if (!process.env.GEMINI_API_KEY) {
            console.error('Erreur: Clé API Gemini (GEMINI_API_KEY) manquante dans .env');
            return res.status(500).json({ error: 'Configuration serveur incomplète (Clé API manquante)' });
        }
        
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        const geminiPayload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.8,
                maxOutputTokens: 4000
            }
        };
        const geminiHeaders = {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY
        };
        
        // Effectuer la requête à l'API Gemini
        const response = await axios.post(geminiUrl, geminiPayload, { headers: geminiHeaders });
        
        // Traiter la réponse
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            const textContent = candidate.content?.parts?.[0]?.text;
            const finishReason = candidate.finishReason;
            
            if (textContent && finishReason === 'STOP') {
                return res.json({
                    summary: textContent.trim()
                });
            } else {
                const blockReason = response.data.promptFeedback?.blockReason || 'Inconnue';
                const errorMessage = `Génération incomplète. Raison: ${finishReason || blockReason}`;
                console.error("Erreur Gemini:", errorMessage);
                return res.status(502).json({ error: errorMessage });
            }
        } else {
            console.error("Réponse Gemini invalide:", response.data);
            return res.status(500).json({ error: "Format de réponse invalide de l'API" });
        }
        
    } catch (error) {
        console.error('Erreur dans /api/summarize:', error.message || error);
        
        // Déterminer le type d'erreur et renvoyer une réponse appropriée
        if (error.response) {
            // Erreur de l'API Gemini
            return res.status(502).json({
                error: "Erreur API externe",
                message: error.response.data?.error?.message || "Échec de la requête à l'API externe"
            });
        } else if (error.request) {
            // Erreur de réseau
            return res.status(503).json({
                error: "Erreur réseau",
                message: "Impossible de contacter l'API externe"
            });
        } else {
            // Autre erreur
            return res.status(500).json({
                error: "Erreur serveur",
                message: error.message || "Une erreur inattendue s'est produite"
            });
        }
    }
});

// Route explicite pour le sitemap.xml
app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Route pour le robots.txt
app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

// Route par défaut pour servir l'application frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route par défaut pour servir l'application frontend (SPA)
app.get('*', (req, res, next) => {
    // Vérifier si l'URL correspond à une extension de fichier
    const fileExtension = path.extname(req.path);
    
    if (fileExtension) {
        // Si c'est une demande de fichier (comme .js, .css, .png, etc.)
        // et que le fichier n'a pas été trouvé par express.static,
        // on passe au middleware suivant qui sera notre gestionnaire 404
        next();
    } else {
        // Pour les routes SPA (sans extension), servir index.html
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Gestionnaire pour les fichiers non trouvés (404)
app.use((req, res) => {
    // Vérifier si la demande concerne un fichier
    const fileExtension = path.extname(req.path);
    
    if (fileExtension) {
        // Si c'est un fichier non trouvé, retourner une simple erreur 404
        res.status(404).send('File not found');
    } else {
        // Pour les routes non trouvées, servir notre page 404 personnalisée
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
});

// Fonction de configuration du sitemap
function setupSitemap() {
    // Définissez votre URL de base en fonction de l'environnement
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    
    // Générer le sitemap au démarrage
    sitemapService.generateSitemap(baseUrl);
    
    // Programmer une regénération périodique
    setInterval(() => {
        sitemapService.generateSitemap(baseUrl);
    }, 24 * 60 * 60 * 1000); // Une fois par jour
}

// Générer le sitemap avant de démarrer le serveur
setupSitemap();

// Démarrer le serveur (une seule fois)
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à l'application: http://localhost:${PORT}`);
});