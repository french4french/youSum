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
        
        // --- Génération du Prompt pour HTML avec emojis et espacement optimal ---
        let prompt = '';
        const videoTitle = videoInfo && videoInfo.title ? `"${videoInfo.title}"` : 'Titre inconnu';
        const channelName = videoInfo && videoInfo.channelTitle ? `${videoInfo.channelTitle}` : 'Chaîne inconnue';
        const transcriptTypeText = isShorter ?
            (language === 'fr' ? 'Partielle (début seulement)' : 'Partial (beginning only)') :
            (language === 'fr' ? 'Complète' : 'Complete');
        
        if (language === 'fr') {
            prompt = `
# INSTRUCTIONS PRINCIPALES
Ta mission est de créer un résumé informatif, visuellement structuré et agréable à lire d'une vidéo YouTube. Ce résumé doit extraire l'ESSENCE de la vidéo et toutes les INFORMATIONS CLÉS, tout en étant facile à parcourir.

# INFORMATIONS SUR LA VIDÉO
- Titre: ${videoTitle}
- Chaîne: ${channelName}
- Type de transcription: ${transcriptTypeText}

# FORMAT ET STRUCTURE EXIGÉS
Tu dois suivre ce format HTML avec des styles intégrés pour garantir une lisibilité optimale:

\`\`\`html
<div class="summary-container" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <!-- TITRE PRINCIPAL -->
  <h2 style="font-size: 1.8rem; margin-bottom: 18px; font-weight: 700; color: #111; border-bottom: 2px solid #eee; padding-bottom: 8px;">
    ✨ [Titre résumant parfaitement le sujet principal de la vidéo]
  </h2>

  <!-- SECTION APERÇU RAPIDE -->
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #4f46e5;">
    <p style="font-size: 1rem; margin-bottom: 0; line-height: 1.5;">
      <span style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 1.1rem;">🔍 Aperçu Rapide</span>
      [2-3 phrases concises qui capturent parfaitement l'essence de la vidéo - présenter l'objectif principal et les points clés]
    </p>
  </div>

  <!-- SECTION POINTS CLÉS -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">💡</span> Points Clés
    </h3>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 10px;">
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Point clé 1]:</strong> [Explication claire et concise]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Point clé 2]:</strong> [Explication claire et concise]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Point clé 3]:</strong> [Explication claire et concise]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Point clé 4]:</strong> [Explication claire et concise]
      </li>
    </ul>
  </div>

  <!-- SECTION CONTENU DÉTAILLÉ -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">📋</span> Contenu Détaillé
    </h3>
    
    <!-- PREMIÈRE SECTION THÉMATIQUE -->
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Titre de la première section thématique]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraphe détaillant cette section avec <strong style="font-weight: 600;">points importants en gras</strong>. S'assurer que ce paragraphe est informatif et apporte de la valeur.]
      </p>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Second paragraphe si nécessaire avec d'autres informations importantes.]
      </p>
      
      <!-- ENCART POUR DONNÉES/EXEMPLES SI PERTINENT -->
      <div style="background-color: #f0f4f8; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95rem;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">📊 Chiffres & Données:</p>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          <li style="margin-bottom: 6px;">[Donnée/chiffre spécifique 1]</li>
          <li style="margin-bottom: 6px;">[Donnée/chiffre spécifique 2]</li>
          <li style="margin-bottom: 0;">[Donnée/chiffre spécifique 3]</li>
        </ul>
      </div>
    </div>
    
    <!-- DEUXIÈME SECTION THÉMATIQUE -->
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Titre de la deuxième section thématique]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraphe détaillant cette section avec <strong style="font-weight: 600;">points importants en gras</strong>.]
      </p>
      
      <!-- ENCART EXEMPLE -->
      <div style="background-color: #fff8c5; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95rem;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">💼 Exemple Concret:</p>
        <p style="margin: 0;">[Description d'un exemple mentionné dans la vidéo]</p>
      </div>
    </div>
    
    <!-- TROISIÈME SECTION THÉMATIQUE -->
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Titre de la troisième section thématique]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraphe détaillant cette section avec <strong style="font-weight: 600;">points importants en gras</strong>.]
      </p>
      
      <!-- ENCART CONSEIL/ASTUCE -->
      <div style="background-color: #e6f7ff; padding: 12px; border-radius: 8px; margin: 15px 0; display: flex; align-items: flex-start; font-size: 0.95rem;">
        <span style="margin-right: 8px; font-size: 1.2rem;">💡</span>
        <div>
          <p style="margin: 0 0 5px 0; font-weight: 600;">Astuce importante:</p>
          <p style="margin: 0;">[Conseil ou astuce mentionné dans la vidéo]</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- SECTION INFORMATIONS COMPLÉMENTAIRES -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">🔗</span> Informations Complémentaires
    </h3>
    <ul style="list-style-type: none; padding-left: 0;">
      <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">Références citées:</strong> [Sources, personnes ou documents mentionnés]
      </li>
      <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">Pour aller plus loin:</strong> [Suggestions pour approfondir le sujet]
      </li>
    </ul>
  </div>
  
  <!-- SECTION CONCLUSION -->
  <div style="background-color: #f0f9ff; padding: 15px; border-radius: 10px; margin-top: 10px; border-left: 4px solid #0ea5e9;">
    <p style="margin: 0;">
      <span style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 1.1rem;">🔑 L'essentiel à retenir</span>
      [1-2 phrases résumant les points clés et l'enseignement principal de la vidéo]
    </p>
  </div>
</div>
\`\`\`

# DIRECTIVES DE CONTENU IMPORTANTES

1. **EXTRACTION INTELLIGENTE** - Tu dois identifier et extraire:
   - Le sujet/thème EXACT de la vidéo
   - Les informations factuelles précises (chiffres, dates, données)
   - Les exemples concrets mentionnés
   - Les conseils/astuces pratiques fournis
   - Les concepts clés expliqués

2. **ORGANISATION THÉMATIQUE** - Structure les informations par thèmes cohérents:
   - Adapte les titres de section pour qu'ils reflètent précisément le contenu
   - Organise l'information de manière logique (du général au spécifique)
   - Regroupe les éléments similaires dans des sections dédiées
   - Assure-toi que chaque section apporte une valeur unique

3. **PRÉSENTATION VISUELLE** - Utilise les éléments visuels à bon escient:
   - Choisis des emojis pertinents pour chaque section/concept
   - Utilise les encarts colorés pour mettre en valeur des informations spéciales
   - Mets en gras les termes et concepts importants
   - Utilise les listes à puces pour les énumérations

4. **VALEUR AJOUTÉE** - Assure-toi que ton résumé:
   - Capture l'ESSENCE de la vidéo dans l'aperçu rapide
   - Présente clairement les informations les plus précieuses
   - Rend le contenu plus accessible et digeste
   - Facilite la compréhension des concepts complexes

# TRANSCRIPTION
${transcription}

# IMPORTANT
- Ce résumé doit pouvoir être compris SANS avoir vu la vidéo
- Concentre-toi sur les INFORMATIONS CONCRÈTES plutôt que sur les opinions
- Ne génère que le code HTML, sans explications avant ou après
- Vérifie que ton code HTML est valide et correctement formaté
- Assure-toi que le résumé couvre TOUS les points importants de la vidéo
`;
        } else { // language 'en' or default
            prompt = `
# MAIN INSTRUCTIONS
Your mission is to create an informative, visually structured, and pleasant-to-read summary of a YouTube video. This summary must extract the ESSENCE of the video and all KEY INFORMATION, while being easy to browse.

# VIDEO INFORMATION
- Title: ${videoTitle}
- Channel: ${channelName}
- Transcript type: ${transcriptTypeText}

# REQUIRED FORMAT AND STRUCTURE
You must follow this HTML format with integrated styles to ensure optimal readability:

\`\`\`html
<div class="summary-container" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <!-- MAIN TITLE -->
  <h2 style="font-size: 1.8rem; margin-bottom: 18px; font-weight: 700; color: #111; border-bottom: 2px solid #eee; padding-bottom: 8px;">
    ✨ [Title perfectly summarizing the main topic of the video]
  </h2>

  <!-- QUICK OVERVIEW SECTION -->
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #4f46e5;">
    <p style="font-size: 1rem; margin-bottom: 0; line-height: 1.5;">
      <span style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 1.1rem;">🔍 Quick Overview</span>
      [2-3 concise sentences that perfectly capture the essence of the video - present the main objective and key points]
    </p>
  </div>

  <!-- KEY POINTS SECTION -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">💡</span> Key Points
    </h3>
    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 10px;">
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Key point 1]:</strong> [Clear and concise explanation]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Key point 2]:</strong> [Clear and concise explanation]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Key point 3]:</strong> [Clear and concise explanation]
      </li>
      <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">[Key point 4]:</strong> [Clear and concise explanation]
      </li>
    </ul>
  </div>

  <!-- DETAILED CONTENT SECTION -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">📋</span> Detailed Content
    </h3>
    
    <!-- FIRST THEMATIC SECTION -->
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Title of the first thematic section]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraph detailing this section with <strong style="font-weight: 600;">important points in bold</strong>. Ensure that this paragraph is informative and adds value.]
      </p>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Second paragraph if necessary with other important information.]
      </p>
      
      <!-- DATA/EXAMPLES BOX IF RELEVANT -->
      <div style="background-color: #f0f4f8; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95rem;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">📊 Figures & Data:</p>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          <li style="margin-bottom: 6px;">[Specific data/figure 1]</li>
          <li style="margin-bottom: 6px;">[Specific data/figure 2]</li>
          <li style="margin-bottom: 0;">[Specific data/figure 3]</li>
        </ul>
      </div>
    </div>
    
    <!-- SECOND THEMATIC SECTION -->
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Title of the second thematic section]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraph detailing this section with <strong style="font-weight: 600;">important points in bold</strong>.]
      </p>
      
      <!-- EXAMPLE BOX -->
      <div style="background-color: #fff8c5; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95rem;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">💼 Concrete Example:</p>
        <p style="margin: 0;">[Description of an example mentioned in the video]</p>
      </div>
    </div>
    
    <!-- THIRD THEMATIC SECTION -->
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 1.2rem; color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🔹</span> [Title of the third thematic section]
      </h4>
      <p style="margin-bottom: 12px; padding-left: 10px; border-left: 3px solid #e5e7eb;">
        [Paragraph detailing this section with <strong style="font-weight: 600;">important points in bold</strong>.]
      </p>
      
      <!-- TIP/ADVICE BOX -->
      <div style="background-color: #e6f7ff; padding: 12px; border-radius: 8px; margin: 15px 0; display: flex; align-items: flex-start; font-size: 0.95rem;">
        <span style="margin-right: 8px; font-size: 1.2rem;">💡</span>
        <div>
          <p style="margin: 0 0 5px 0; font-weight: 600;">Important tip:</p>
          <p style="margin: 0;">[Tip or advice mentioned in the video]</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- ADDITIONAL INFORMATION SECTION -->
  <div style="margin-bottom: 25px;">
    <h3 style="font-size: 1.4rem; display: flex; align-items: center; margin-bottom: 15px; color: #333;">
      <span style="margin-right: 8px;">🔗</span> Additional Information
    </h3>
    <ul style="list-style-type: none; padding-left: 0;">
      <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">Cited references:</strong> [Sources, people, or documents mentioned]
      </li>
      <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
        <span style="position: absolute; left: 0; color: #4f46e5; font-weight: bold;">•</span>
        <strong style="font-weight: 600;">To go further:</strong> [Suggestions to explore the topic further]
      </li>
    </ul>
  </div>
  
  <!-- CONCLUSION SECTION -->
  <div style="background-color: #f0f9ff; padding: 15px; border-radius: 10px; margin-top: 10px; border-left: 4px solid #0ea5e9;">
    <p style="margin: 0;">
      <span style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 1.1rem;">🔑 Key Takeaway</span>
      [1-2 sentences summarizing the key points and main teaching of the video]
    </p>
  </div>
</div>
\`\`\`

# IMPORTANT CONTENT DIRECTIVES

1. **INTELLIGENT EXTRACTION** - You must identify and extract:
   - The EXACT subject/theme of the video
   - Precise factual information (figures, dates, data)
   - Concrete examples mentioned
   - Practical tips/advice provided
   - Key concepts explained

2. **THEMATIC ORGANIZATION** - Structure information by coherent themes:
   - Adapt section titles to precisely reflect the content
   - Organize information logically (from general to specific)
   - Group similar elements in dedicated sections
   - Ensure each section provides unique value

3. **VISUAL PRESENTATION** - Use visual elements wisely:
   - Choose relevant emojis for each section/concept
   - Use colored boxes to highlight special information
   - Bold important terms and concepts
   - Use bullet points for enumerations

4. **ADDED VALUE** - Ensure your summary:
   - Captures the ESSENCE of the video in the quick overview
   - Clearly presents the most valuable information
   - Makes content more accessible and digestible
   - Facilitates understanding of complex concepts

# TRANSCRIPT
${transcription}

# IMPORTANT
- This summary should be understandable WITHOUT having watched the video
- Focus on CONCRETE INFORMATION rather than opinions
- Generate only the HTML code, without explanations before or after
- Check that your HTML code is valid and properly formatted
- Make sure the summary covers ALL important points of the video
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