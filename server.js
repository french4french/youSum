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
        
        // --- Génération du Prompt pour une mise en page ultra-aérée ---
        let prompt = '';
        const videoTitle = videoInfo && videoInfo.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const channelName = videoInfo && videoInfo.channelTitle ? `${videoInfo.channelTitle}` : 'Chaîne inconnue';
        const transcriptTypeText = isShorter ?
            (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') :
            (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
# MISSION
Tu es un designer de contenus textuels spécialisé dans la création de résumés ultra-lisibles. Ton objectif est de transformer une transcription vidéo en un résumé extrêmement aéré et visuellement structuré qui peut être parcouru en quelques secondes.

# INFORMATIONS SUR LA VIDÉO
- Titre: ${videoTitle}
- Chaîne: ${channelName}
- Type de transcription: ${transcriptTypeText}

# DIRECTIVES VISUELLES ABSOLUES
- Utilise au minimum TROIS sauts de ligne entre chaque section principale pour créer un espacement visuel important (##)
- Utilise DEUX sauts de ligne entre sous-sections (###)
- Ajoute des lignes de séparation horizontales (---) entre les sections principales
- Utilise systématiquement des emojis pertinents comme points de repère visuels
- Limite CHAQUE paragraphe à 2-3 phrases MAXIMUM
- Alterne entre texte normal, **gras**, et *italique* pour créer du rythme visuel
- Utilise abondamment les puces et les listes numérotées
- Mets en évidence tous les concepts clés en **gras**
- Ajoute des blocs de citation pour les informations importantes
- Ajoute des espaces visuels même à l'intérieur des listes à puces

# STRUCTURE IMPOSÉE (MARKDOWN ULTRA-AÉRÉ)

## 🔍 **En Bref**

[2-3 phrases percutantes maximum sur l'essence de la vidéo]



---



## 💡 **Points Essentiels**

• **[Premier concept clé]**: [Explication très concise en une phrase]

• **[Deuxième concept clé]**: [Explication très concise en une phrase]

• **[Troisième concept clé]**: [Explication très concise en une phrase]

• **[Quatrième concept clé]**: [Explication très concise en une phrase]



---



## 📚 **Résumé Détaillé**


### 🔹 **[Premier thème]**

[Paragraphe court de 2-3 phrases maximum avec **mots-clés en gras**]

> **Citation ou point essentiel mis en valeur**

[Second paragraphe très court si nécessaire]


### 🔹 **[Deuxième thème]**

[Paragraphe court de 2-3 phrases maximum avec **mots-clés en gras**]

**Exemples concrets:**
1. [Premier exemple court]
2. [Deuxième exemple court]


### 🔹 **[Troisième thème]**

[Paragraphe court de 2-3 phrases maximum avec **mots-clés en gras**]

💭 *Réflexion:* [Une pensée ou citation pertinente]



---



## 🔗 **Informations Complémentaires**

• **Références citées**: [Liste très concise]

• **Ressources recommandées**: [Liste très concise]

• **Pour aller plus loin**: [Suggestion brève]

🔑 **Conseil final**: [Un conseil pratique pour conclure]

# CONSIGNES STYLISTIQUES SUPPLÉMENTAIRES
- Crée un document qui respire visuellement
- Utilise des phrases courtes et simples
- Présente l'information de façon extrêmement scannable
- Assure-toi que le document peut être compris même en le parcourant en diagonale
- N'hésite pas à utiliser des structures visuelles comme des mini-tableaux pour comparer des informations

# TRANSCRIPTION
${transcription}
`;
        } else { // language 'en' or default
            prompt = `
# MISSION
You are a content designer specializing in creating ultra-readable summaries. Your goal is to transform a video transcript into an extremely airy and visually structured summary that can be scanned in seconds.

# VIDEO INFORMATION
- Title: ${videoTitle}
- Channel: ${channelName}
- Transcript type: ${transcriptTypeText}

# ABSOLUTE VISUAL GUIDELINES
- Use a minimum of THREE line breaks between each main section to create significant visual spacing (##)
- Use TWO line breaks between subsections (###)
- Add horizontal separation lines (---) between main sections
- Systematically use relevant emojis as visual landmarks
- Limit EACH paragraph to 2-3 sentences MAXIMUM
- Alternate between normal text, **bold**, and *italic* to create visual rhythm
- Use bullet points and numbered lists abundantly
- Highlight all key concepts in **bold**
- Add quote blocks for important information
- Add visual spaces even within bullet point lists

# IMPOSED STRUCTURE (ULTRA-AIRY MARKDOWN)

## 🔍 **In Brief**

[2-3 impactful sentences maximum on the essence of the video]



---



## 💡 **Key Takeaways**

• **[First key concept]**: [Very concise explanation in one sentence]

• **[Second key concept]**: [Very concise explanation in one sentence]

• **[Third key concept]**: [Very concise explanation in one sentence]

• **[Fourth key concept]**: [Very concise explanation in one sentence]



---



## 📚 **Detailed Summary**


### 🔹 **[First theme]**

[Short paragraph of 2-3 sentences maximum with **keywords in bold**]

> **Quote or essential point highlighted**

[Very short second paragraph if necessary]


### 🔹 **[Second theme]**

[Short paragraph of 2-3 sentences maximum with **keywords in bold**]

**Concrete examples:**
1. [Short first example]
2. [Short second example]


### 🔹 **[Third theme]**

[Short paragraph of 2-3 sentences maximum with **keywords in bold**]

💭 *Reflection:* [A relevant thought or quote]



---



## 🔗 **Additional Information**

• **Cited references**: [Very concise list]

• **Recommended resources**: [Very concise list]

• **To go further**: [Brief suggestion]

🔑 **Final tip**: [A practical tip to conclude]

# ADDITIONAL STYLISTIC GUIDELINES
- Create a document that breathes visually
- Use short and simple sentences
- Present information in an extremely scannable way
- Ensure the document can be understood even when skimmed diagonally
- Don't hesitate to use visual structures like mini-tables to compare information

# TRANSCRIPT
${transcription}
`;
        }
        // --- Fin de la Génération du Prompt Ultra-Aéré ---
        
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
                // Post-traitement pour garantir l'espacement visuel
                const enhancedMarkdown = textContent.trim()
                    // Ajouter des espacements triple entre sections principales (##)
                    .replace(/\n## /g, '\n\n\n\n## ')
                    // Ajouter des espacements doubles entre sous-sections (###)
                    .replace(/\n### /g, '\n\n\n### ')
                    // Assurer que les séparateurs horizontaux ont de l'espace
                    .replace(/\n---\n/g, '\n\n---\n\n')
                    // Ajouter de l'espace avant chaque puce
                    .replace(/\n• /g, '\n\n• ')
                    // Ajouter un espace après les listes à puces
                    .replace(/\n• (.*?)(?=\n[^•])/gs, '\n• $1\n')
                    // Ajouter de l'espace avant les citations
                    .replace(/\n>/g, '\n\n>')
                    // Ajouter de l'espace après les citations
                    .replace(/\n> (.*?)(?=\n[^>])/gs, '\n> $1\n\n')
                    // Nettoyer les espaces excessifs
                    .replace(/\n\n\n\n+/g, '\n\n\n\n')
                    // Ajouter de l'espace avant les listes numérotées
                    .replace(/\n\d+\./g, '\n\n$&')
                    // Ajouter du caractère visuel avec des emojis si pas assez présents
                    .replace(/## ([^🔍💡📚🔗])/g, '## 📌 $1');
                
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