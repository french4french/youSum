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
        
        // --- Génération du Prompt pour HTML directement formaté ---
        let prompt = '';
        const videoTitle = videoInfo && videoInfo.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const channelName = videoInfo && videoInfo.channelTitle ? `${videoInfo.channelTitle}` : 'Chaîne inconnue';
        const transcriptTypeText = isShorter ?
            (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') :
            (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
# CONSIGNE ABSOLUE
Tu dois générer un résumé en HTML directement formaté avec des styles intégrés pour garantir un espacement optimal. N'utilise PAS de Markdown standard mais du HTML complet.

# INFORMATIONS SUR LA VIDÉO
- Titre: ${videoTitle}
- Chaîne: ${channelName}
- Type de transcription: ${transcriptTypeText}

# FORMAT HTML EXIGÉ
Utilise cette structure HTML avec des styles intégrés:

\`\`\`html
<div class="summary-container">
  <!-- En Bref Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">🔍</span> En Bref
    </h2>
    <p style="margin-bottom: 16px; line-height: 1.6;">
      [2-3 phrases sur l'essence de la vidéo]
    </p>
  </div>
  
  <!-- Points Essentiels Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">💡</span> Points Essentiels
    </h2>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 16px;">
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>[Premier concept]</strong>: [Explication en UNE phrase]
      </li>
      <!-- Répéter pour chaque point essentiel -->
    </ul>
  </div>
  
  <!-- Résumé Détaillé Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">📚</span> Résumé Détaillé
    </h2>
    
    <!-- Premier Thème -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [Premier thème]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraphe avec <strong>mots-clés en gras</strong>]
      </p>
      <!-- Citation ou élément supplémentaire si pertinent -->
      <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; font-style: italic;">
        [Citation ou phrase d'impact si pertinente]
      </blockquote>
    </div>
    
    <!-- Deuxième Thème -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [Deuxième thème]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraphe avec <strong>mots-clés en gras</strong>]
      </p>
      <!-- Exemples -->
      <div style="margin-top: 12px; margin-bottom: 16px;">
        <p style="font-weight: 600; margin-bottom: 8px;">Exemples concrets:</p>
        <p style="margin-bottom: 8px; padding-left: 16px;">Bloc de 9h à 12h: travail sur projet X</p>
        <p style="margin-bottom: 8px; padding-left: 16px;">Bloc de 14h à 16h: réunions</p>
      </div>
    </div>
    
    <!-- Troisième Thème -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [Troisième thème]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraphe avec <strong>mots-clés en gras</strong>]
      </p>
      <!-- Réflexion -->
      <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 12px; margin-bottom: 16px; display: flex; align-items: flex-start;">
        <span style="margin-right: 8px;">💭</span>
        <p style="margin: 0; font-style: italic;"><strong>Réflexion:</strong> [Une pensée ou conseil pertinent]</p>
      </div>
    </div>
  </div>
  
  <!-- Informations Complémentaires Section -->
  <div class="summary-section">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">🔗</span> Informations Complémentaires
    </h2>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 16px;">
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>Références citées</strong>: [Liste concise]
      </li>
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>Ressources recommandées</strong>: [Liste concise]
      </li>
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>Pour aller plus loin</strong>: [Suggestion brève]
      </li>
    </ul>
    <!-- Conseil final -->
    <div style="background-color: #f0f9ff; padding: 12px; border-radius: 6px; margin-top: 12px; display: flex; align-items: flex-start;">
      <span style="margin-right: 8px;">🔑</span>
      <p style="margin: 0;"><strong>Conseil final:</strong> [Un conseil pratique]</p>
    </div>
  </div>
</div>
\`\`\`

# INSTRUCTIONS SPÉCIFIQUES
1. Utilise EXACTEMENT cette structure HTML, en remplaçant uniquement le contenu entre crochets.
2. Ne modifie PAS les styles CSS intégrés - ils sont essentiels pour l'espacement.
3. Garde la même hiérarchie des titres et des sections.
4. Les emojis doivent être conservés comme marqueurs visuels.
5. Ajoute tous les points essentiels et thèmes nécessaires dans la même structure.
6. Maintiens les styles définis comme "margin-bottom" et "padding" pour garantir l'espacement.
7. Respecte les attributs style originaux, ne les simplifie pas.

# CONTENU ET STYLE
- Limite strictement le résumé "En Bref" à 2-3 phrases concises.
- Les "Points Essentiels" doivent être clairs, commençant chacun par un terme en gras.
- Dans le "Résumé Détaillé", crée 2-4 thèmes principaux, chacun avec un titre pertinent.
- Pour chaque thème, fournis un paragraphe court de 2-3 phrases maximum.
- Mets en évidence les concepts clés en les encadrant de balises <strong></strong>.
- Les exemples, citations et réflexions sont optionnels - inclus-les seulement s'ils sont pertinents.

# TRANSCRIPTION
${transcription}

# IMPORTANT
N'oublie pas que tu dois générer le HTML directement, pas du Markdown. Cette approche garantit que l'espacement et la mise en forme seront préservés exactement comme nous le souhaitons.
`;
        } else { // language 'en' or default
            prompt = `
# ABSOLUTE DIRECTIVE
You must generate a summary in directly formatted HTML with integrated styles to guarantee optimal spacing. Do NOT use standard Markdown but complete HTML.

# VIDEO INFORMATION
- Title: ${videoTitle}
- Channel: ${channelName}
- Transcript type: ${transcriptTypeText}

# REQUIRED HTML FORMAT
Use this HTML structure with integrated styles:

\`\`\`html
<div class="summary-container">
  <!-- In Brief Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">🔍</span> In Brief
    </h2>
    <p style="margin-bottom: 16px; line-height: 1.6;">
      [2-3 sentences on the essence of the video]
    </p>
  </div>
  
  <!-- Key Takeaways Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">💡</span> Key Takeaways
    </h2>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 16px;">
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>[First concept]</strong>: [Explanation in ONE sentence]
      </li>
      <!-- Repeat for each key point -->
    </ul>
  </div>
  
  <!-- Detailed Summary Section -->
  <div class="summary-section" style="margin-bottom: 24px;">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">📚</span> Detailed Summary
    </h2>
    
    <!-- First Theme -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [First theme]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraph with <strong>keywords in bold</strong>]
      </p>
      <!-- Quote or additional element if relevant -->
      <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; font-style: italic;">
        [Quote or impactful sentence if relevant]
      </blockquote>
    </div>
    
    <!-- Second Theme -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [Second theme]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraph with <strong>keywords in bold</strong>]
      </p>
      <!-- Examples -->
      <div style="margin-top: 12px; margin-bottom: 16px;">
        <p style="font-weight: 600; margin-bottom: 8px;">Concrete examples:</p>
        <p style="margin-bottom: 8px; padding-left: 16px;">9am to 12pm block: work on project X</p>
        <p style="margin-bottom: 8px; padding-left: 16px;">2pm to 4pm block: meetings</p>
      </div>
    </div>
    
    <!-- Third Theme -->
    <div class="theme-section" style="margin-bottom: 20px;">
      <h3 style="display: flex; align-items: center; font-size: 1.25rem; margin-bottom: 12px; color: #4b5563;">
        <span style="margin-right: 8px; color: #4f46e5;">🔹</span> [Third theme]
      </h3>
      <p style="margin-bottom: 16px; line-height: 1.6;">
        [Paragraph with <strong>keywords in bold</strong>]
      </p>
      <!-- Reflection -->
      <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 12px; margin-bottom: 16px; display: flex; align-items: flex-start;">
        <span style="margin-right: 8px;">💭</span>
        <p style="margin: 0; font-style: italic;"><strong>Reflection:</strong> [A relevant thought or advice]</p>
      </div>
    </div>
  </div>
  
  <!-- Additional Information Section -->
  <div class="summary-section">
    <h2 style="display: flex; align-items: center; font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
      <span style="margin-right: 8px;">🔗</span> Additional Information
    </h2>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 16px;">
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>Cited references</strong>: [Concise list]
      </li>
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>Recommended resources</strong>: [Concise list]
      </li>
      <li style="margin-bottom: 12px; padding-left: 24px; position: relative;">
        <span style="position: absolute; left: 0;">•</span>
        <strong>To go further</strong>: [Brief suggestion]
      </li>
    </ul>
    <!-- Final Tip -->
    <div style="background-color: #f0f9ff; padding: 12px; border-radius: 6px; margin-top: 12px; display: flex; align-items: flex-start;">
      <span style="margin-right: 8px;">🔑</span>
      <p style="margin: 0;"><strong>Final tip:</strong> [A practical advice]</p>
    </div>
  </div>
</div>
\`\`\`

# SPECIFIC INSTRUCTIONS
1. Use EXACTLY this HTML structure, replacing only the content in brackets.
2. Do NOT modify the embedded CSS styles - they are essential for spacing.
3. Keep the same hierarchy of titles and sections.
4. Emojis must be kept as visual markers.
5. Add all necessary key points and themes in the same structure.
6. Maintain the styles defined as "margin-bottom" and "padding" to ensure spacing.
7. Respect the original style attributes, do not simplify them.

# CONTENT AND STYLE
- Strictly limit the "In Brief" summary to 2-3 concise sentences.
- "Key Takeaways" should be clear, each starting with a term in bold.
- In the "Detailed Summary", create 2-4 main themes, each with a relevant title.
- For each theme, provide a short paragraph of maximum 2-3 sentences.
- Highlight key concepts by wrapping them in <strong></strong> tags.
- Examples, quotes, and reflections are optional - include them only if relevant.

# TRANSCRIPT
${transcription}

# IMPORTANT
Remember that you must generate HTML directly, not Markdown. This approach ensures that spacing and formatting will be preserved exactly as we want.
`;
        }
        
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
                // Extraire le HTML du contenu retourné (qui peut contenir les backticks et autres textes)
                const htmlMatch = textContent.match(/```html\s*([\s\S]*?)\s*```/);
                const htmlContent = htmlMatch ? htmlMatch[1].trim() : textContent.trim();
                
                // Nettoyer le HTML si nécessaire (enlever les commentaires, etc.)
                const cleanedHtml = htmlContent
                    .replace(/<!--[\s\S]*?-->/g, '') // Enlever les commentaires HTML
                    .replace(/\s*\n\s*\n\s*/g, '\n') // Réduire les multiples sauts de ligne
                    .trim();
                
                return res.json({
                    summary: cleanedHtml
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
        
        if (error.response) {
            return res.status(502).json({
                error: "Erreur API externe",
                message: error.response.data?.error?.message || "Échec de la requête à l'API externe"
            });
        } else if (error.request) {
            return res.status(503).json({
                error: "Erreur réseau",
                message: "Impossible de contacter l'API externe"
            });
        } else {
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