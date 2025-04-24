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
        
        if (!transcription || transcription.trim() === '') {
            // Ajout d'une vérification pour une transcription vide
            return res.status(400).json({ error: 'Transcription requise et non vide' });
        }
        
        // --- Génération du Prompt Amélioré ---
        let prompt = '';
        const videoTitle = videoInfo?.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const transcriptTypeText = isShorter ? (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') : (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
Tâche: Analyser et structurer un résumé de transcription vidéo YouTube.
Vidéo: ${videoTitle}
Type de Transcription: ${transcriptTypeText}

Instructions (Format de sortie: Markdown):

## Résumé Détaillé
Fournis un résumé complet et fidèle du contenu.
${isShorter ? '**Note:** Indique clairement que ce résumé est basé sur une transcription partielle.' : ''}

## Points Clés
Liste à puces (\`* point\`) des idées et enseignements principaux.

## Références (si applicable)
Liste à puces (\`* point\`) des sources, références ou personnes mentionnées.

## Actions Recommandées (si applicable)
Liste à puces (\`* point\`) des conseils pratiques ou actions suggérés.

---
Transcription:
${transcription}
`;
        } else { // language 'en' or default
            prompt = `
Task: Analyze and structure a summary of a YouTube video transcript.
Video: ${videoTitle}
Transcript Type: ${transcriptTypeText}

Instructions (Output Format: Markdown):

## Detailed Summary
Provide a comprehensive and faithful summary of the content.
${isShorter ? '**Note:** Clearly state this summary is based on a partial transcript.' : ''}

## Key Points
Bulleted list (\`* point\`) of main ideas and takeaways.

## References (if applicable)
Bulleted list (\`* point\`) of mentioned sources, references, or people.

## Recommended Actions (if applicable)
Bulleted list (\`* point\`) of practical advice or suggested actions.

---
Transcript:
${transcription}
`;
        }
        // --- Fin de la Génération du Prompt Amélioré ---
        
        // Validation simple de la clé API (pour le débogage)
        if (!process.env.GEMINI_API_KEY) {
            console.error('Erreur: Clé API Gemini (GEMINI_API_KEY) manquante dans .env');
            return res.status(500).json({ error: 'Configuration serveur incomplète (Clé API manquante)' });
        }
        
        // Requête à l'API Gemini
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'; // Utilisation de Flash pour potentiellement plus de rapidité/moins de coût
        const geminiPayload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            // Optionnel: Ajouter des configurations de génération si nécessaire
            // generationConfig: {
            //   temperature: 0.7,
            //   // ... autres paramètres
            // }
        };
        const geminiHeaders = {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY
        };
        
        console.log("Envoi de la requête à Gemini avec prompt:", prompt.substring(0, 200) + "..."); // Log tronqué pour la lisibilité
        
        const response = await axios.post(geminiUrl, geminiPayload, { headers: geminiHeaders });
        
        // Transformation de la réponse pour la rendre compatible avec le client
        let responseData;
        
        try {
            // Extraire le texte du résumé de la structure Gemini attendue
            // Le texte retourné DOIT contenir le Markdown structuré demandé dans le prompt
            const candidate = response.data?.candidates?.[0];
            const textContent = candidate?.content?.parts?.[0]?.text;
            
            if (textContent) {
                // Le client s'attend à recevoir le Markdown complet dans le champ 'summary'
                responseData = {
                    summary: textContent.trim(), // Nettoyer les espaces blancs potentiels
                    // Conserver les informations de feedback si disponibles et utiles
                    promptFeedback: candidate?.promptFeedback,
                    finishReason: candidate?.finishReason
                };
                console.log("Résumé généré avec succès (début):", responseData.summary.substring(0, 150) + "...");
            } else {
                // Si la structure ou le contenu n'est pas celui attendu
                console.error("Structure de réponse Gemini inattendue ou contenu textuel manquant:", JSON.stringify(response.data, null, 2));
                // Essayer de fournir plus de détails sur l'erreur si possible (ex: finishReason)
                const finishReason = candidate?.finishReason || response.data?.promptFeedback?.blockReason;
                const blockMessage = response.data?.promptFeedback?.blockReasonMessage;
                responseData = {
                    error: `Structure de réponse de l'API inattendue ou contenu manquant. Raison: ${finishReason || 'Inconnue'} ${blockMessage ? `(${blockMessage})` : ''}`,
                    _raw: response.data // Fournir les données brutes pour le débogage
                };
                // Retourner un statut d'erreur approprié si la réponse de l'API indique un problème
                res.status(502); // Bad Gateway - indique un problème avec la réponse de l'API externe
            }
        } catch (parseError) {
            console.error("Erreur lors de l'extraction/traitement du résumé:", parseError);
            responseData = {
                error: "Impossible d'extraire ou traiter le résumé de la réponse de l'API",
                _raw: response.data // Fournir les données brutes pour le débogage
            };
            res.status(500); // Erreur interne du serveur
        }
        
        // Renvoyer la réponse (éventuellement avec un statut d'erreur défini ci-dessus)
        res.json(responseData);
        
    } catch (error) {
        console.error('Erreur lors de la génération du résumé (catch global):', error.response?.data || error.message);
        // Fournir une erreur plus spécifique si elle provient d'axios/Gemini
        const status = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message || 'Erreur serveur inconnue';
        res.status(status).json({
            error: 'Erreur serveur lors de l\'appel à l\'API de génération',
            message: message,
            details: error.response?.data // Inclure les détails de l'erreur API si disponibles
        });
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