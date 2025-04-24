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
        
        // --- Génération du Prompt Amélioré avec Formatage Visuel Optimisé ---
        let prompt = '';
        const videoTitle = videoInfo && videoInfo.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const channelName = videoInfo && videoInfo.channelTitle ? `${videoInfo.channelTitle}` : 'Chaîne inconnue';
        const transcriptTypeText = isShorter ?
            (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') :
            (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
# CONTEXTE
Tu es un expert en création de résumés vidéo clairs, concis et visuellement structurés. Ta mission est de générer un résumé d'une vidéo YouTube avec une mise en page exceptionnelle et une hiérarchisation claire des informations.

# INFORMATIONS SUR LA VIDÉO
- Titre: ${videoTitle}
- Chaîne: ${channelName}
- Type de transcription: ${transcriptTypeText}

# INSTRUCTIONS DE MISE EN FORME ET HIÉRARCHISATION

## Structure et espacement
- Utilise **deux sauts de ligne** entre les sections principales
- Utilise **un saut de ligne** entre les paragraphes et sous-sections
- Ajoute un espacement visuel avant et après les listes à puces
- Assure-toi que chaque section est visuellement distincte des autres

## Hiérarchisation visuelle
- Utilise les niveaux de titres de façon cohérente: ## pour sections principales, ### pour sous-sections
- **Mets en gras les concepts clés** et les termes importants dans chaque section
- *Utilise l'italique* pour les nuances, exemples ou expressions spécifiques
- Utilise le formatage ~~barré~~ uniquement si nécessaire pour montrer une correction ou alternative
- Crée une hiérarchie visuelle claire avec l'indentation des listes

## Formatage spécial pour l'impact
- Pour les définitions importantes: **Terme clé**: explication...
- Pour les citations: > Citation importante ou exemple concret
- Pour les astuces ou conseils pratiques: 💡 *Astuce:* conseil pratique...
- Pour les avertissements si nécessaire: ⚠️ *Attention:* point de vigilance...

# FORMAT DE SORTIE (MARKDOWN AMÉLIORÉ)
Ton résumé doit suivre précisément cette structure avec la mise en forme indiquée:

## **En Bref**

Un résumé concis et impactant de 2-3 phrases qui présente l'essence de la vidéo. Cette section doit être facilement scannable et donner envie de lire la suite.


## **Points Essentiels**

Une liste aérée des informations cruciales, chaque point commençant par un verbe d'action ou un concept clé en **gras**:

• **[Concept clé]**: Explication concise et claire...
• **[Action recommandée]**: Description de l'action et son bénéfice...
• **[Technique principale]**: Explication de la technique et son application...


## **Résumé Détaillé**

### **[Premier thème principal]**

Un paragraphe introductif qui présente ce thème spécifique. Les **termes importants** sont en gras, et les *nuances ou exemples* en italique.

Un second paragraphe si nécessaire pour développer davantage ce thème, avec toujours une attention particulière à la **mise en valeur des éléments clés**.

### **[Deuxième thème principal]**

Description claire et concise, en mettant l'accent sur les **concepts essentiels** et leur application pratique.

> Si pertinent, inclure une citation ou un exemple concret dans un bloc de citation qui se démarque visuellement.

### **[Troisième thème principal]**

Explication détaillée avec **mise en évidence** des informations cruciales. Conserver des paragraphes courts et aérés pour faciliter la lecture.

💡 *Astuce pratique:* Inclure un conseil directement applicable en lien avec ce thème.


## **Informations Complémentaires**

Une liste bien espacée et hiérarchisée d'informations additionnelles pertinentes:

• **Références citées**: Personnes, livres, études mentionnés dans la vidéo...
• **Ressources recommandées**: Outils, sites web, applications suggérés...
• **Pour aller plus loin**: Suggestions de sujets connexes ou d'approfondissement...

# CONSIGNES STYLISTIQUES
- Utilise un ton professionnel mais accessible
- Préfère les phrases courtes et directes
- Emploie un vocabulaire précis mais non jargonnant
- Assure une cohérence visuelle dans l'ensemble du document
- Utilise les listes à puces pour faciliter la lecture en diagonale
- Crée un document qui invite à la lecture par sa structure aérée

# TRANSCRIPTION
${transcription}
`;
        } else { // language 'en' or default
            prompt = `
# CONTEXT
You are an expert in creating clear, concise, and visually structured video summaries. Your mission is to generate a summary of a YouTube video with exceptional layout and clear information hierarchy.

# VIDEO INFORMATION
- Title: ${videoTitle}
- Channel: ${channelName}
- Transcript type: ${transcriptTypeText}

# FORMATTING AND HIERARCHY INSTRUCTIONS

## Structure and spacing
- Use **two line breaks** between main sections
- Use **one line break** between paragraphs and subsections
- Add visual spacing before and after bullet point lists
- Ensure each section is visually distinct from others

## Visual hierarchy
- Use heading levels consistently: ## for main sections, ### for subsections
- **Bold key concepts** and important terms in each section
- *Italicize* nuances, examples, or specific expressions
- Use ~~strikethrough~~ formatting only if necessary to show a correction or alternative
- Create a clear visual hierarchy with list indentation

## Special formatting for impact
- For important definitions: **Key Term**: explanation...
- For quotes: > Important quote or concrete example
- For tips or practical advice: 💡 *Tip:* practical advice...
- For warnings if necessary: ⚠️ *Caution:* point to watch out for...

# OUTPUT FORMAT (ENHANCED MARKDOWN)
Your summary must follow this structure precisely with the indicated formatting:

## **In Brief**

A concise and impactful summary of 2-3 sentences that presents the essence of the video. This section should be easily scannable and make the reader want to continue.


## **Key Takeaways**

A well-spaced list of crucial information, each point starting with an action verb or key concept in **bold**:

• **[Key concept]**: Concise and clear explanation...
• **[Recommended action]**: Description of the action and its benefit...
• **[Main technique]**: Explanation of the technique and its application...


## **Detailed Summary**

### **[First main theme]**

An introductory paragraph that presents this specific theme. **Important terms** are in bold, and *nuances or examples* in italics.

A second paragraph if necessary to further develop this theme, always with particular attention to **highlighting key elements**.

### **[Second main theme]**

Clear and concise description, emphasizing **essential concepts** and their practical application.

> If relevant, include a quote or concrete example in a visually distinct quote block.

### **[Third main theme]**

Detailed explanation with **highlighting** of crucial information. Keep paragraphs short and well-spaced for easy reading.

💡 *Practical tip:* Include a directly applicable tip related to this theme.


## **Additional Information**

A well-spaced and hierarchical list of relevant additional information:

• **Cited references**: People, books, studies mentioned in the video...
• **Recommended resources**: Suggested tools, websites, applications...
• **To go further**: Suggestions for related topics or deeper exploration...

# STYLISTIC GUIDELINES
- Use a professional but accessible tone
- Prefer short and direct sentences
- Use precise but non-jargon vocabulary
- Ensure visual consistency throughout the document
- Use bullet points to facilitate diagonal reading
- Create a document that invites reading through its airy structure

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
                maxOutputTokens: 6000
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
                // Améliorer davantage le rendu Markdown pour assurer un affichage optimal
                const enhancedMarkdown = textContent.trim()
                    // S'assurer que les titres principaux ont un espacement adéquat
                    .replace(/\n## /g, '\n\n## ')
                    // S'assurer que les sous-titres ont un espacement adéquat
                    .replace(/\n### /g, '\n\n### ')
                    // Ajouter un espacement avant les listes à puces
                    .replace(/\n• /g, '\n\n• ')
                    // Normaliser l'espacement entre les sections
                    .replace(/\n\n\n+/g, '\n\n')
                    // Ajouter un espacement après les listes à puces
                    .replace(/\n• (.*?)(?=\n[^•])/gs, '\n• $1\n');
                
                return res.json({
                    summary: enhancedMarkdown
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