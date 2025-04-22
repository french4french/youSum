document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const youtubeForm = document.getElementById('youtubeForm');
    const youtubeUrl = document.getElementById('youtubeUrl');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const progressBar = document.getElementById('progressBar');
    const results = document.getElementById('results');
    const summaryContent = document.getElementById('summaryContent');
    const videoInfo = document.getElementById('videoInfo');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const channelTitle = document.getElementById('channelTitle');
    const publishedDate = document.getElementById('publishedDate');
    const videoDuration = document.getElementById('videoDuration');
    const videoLink = document.getElementById('videoLink');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    const languageSelect = document.getElementById('language');
    
    // Variables
    let currentVideoId = null;
    let videoData = null;
    let transcription = null;
    let summary = null;
    
    // Configuration du serveur backend
    // À modifier si votre serveur est sur un port différent ou un hôte différent
    const API_BASE_URL = ''; // URL vide pour le même domaine, par ex. '/api'
    
    // Functions
    function extractVideoId(url) {
        if (!url) return null;
        
        url = url.trim();
        
        // Handle YouTube watch URLs
        const watchRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const watchMatch = url.match(watchRegex);
        if (watchMatch) return watchMatch[1];
        
        // Handle YouTube embed URLs
        const embedRegex = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/;
        const embedMatch = url.match(embedRegex);
        if (embedMatch) return embedMatch[1];
        
        // Handle YouTube shortened URLs
        const shortRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
        const shortMatch = url.match(shortRegex);
        if (shortMatch) return shortMatch[1];
        
        // Try to extract a generic 11-character YouTube ID
        const idRegex = /([a-zA-Z0-9_-]{11})/;
        const idMatch = url.match(idRegex);
        if (idMatch) return idMatch[1];
        
        return null;
    }
    
    async function fetchVideoInfo(videoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/video-info?videoId=${videoId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                return {
                    id: videoId,
                    title: data.items[0].snippet.title,
                    channelTitle: data.items[0].snippet.channelTitle,
                    publishedAt: new Date(data.items[0].snippet.publishedAt),
                    description: data.items[0].snippet.description,
                    thumbnail: data.items[0].snippet.thumbnails.high.url,
                    duration: convertDuration(data.items[0].contentDetails.duration)
                };
            }
            
            throw new Error('Video not found');
        } catch (error) {
            console.error('Error fetching video info:', error);
            
            // Fallback to basic info
            return {
                id: videoId,
                title: 'YouTube Video',
                channelTitle: 'Unknown Channel',
                publishedAt: null,
                description: '',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: 'Unknown'
            };
        }
    }
    
    function convertDuration(duration) {
        // Convert ISO 8601 duration to readable format
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        
        const hours = (match[1]) ? parseInt(match[1].slice(0, -1)) : 0;
        const minutes = (match[2]) ? parseInt(match[2].slice(0, -1)) : 0;
        const seconds = (match[3]) ? parseInt(match[3].slice(0, -1)) : 0;
        
        let result = '';
        if (hours > 0) {
            result += `${hours}h `;
        }
        if (minutes > 0 || hours > 0) {
            result += `${minutes}m `;
        }
        result += `${seconds}s`;
        
        return result.trim();
    }
    
    async function getTranscription(videoId, language = 'fr') {
        updateLoadingText('Récupération de la transcription...');
        updateProgressBar(30);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcript?videoId=${videoId}&language=${language}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            updateProgressBar(70);
            
            if (data.transcript) {
                return data.transcript;
            } else {
                throw new Error(data.error || 'Impossible de récupérer la transcription');
            }
        } catch (error) {
            console.error('Error fetching transcript:', error);
            updateLoadingText('Échec de la récupération de la transcription');
            return null;
        }
    }
    
    async function summarizeWithGemini(transcription, videoInfo) {
        updateLoadingText('Génération du résumé avec Gemini...');
        updateProgressBar(85);
        
        // Limit transcription size if needed
        const MAX_CHARS = 100000;
        const truncatedTranscription = transcription.length > MAX_CHARS
            ? transcription.substring(0, MAX_CHARS) + "... [Transcription tronquée]"
            : transcription;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcription: truncatedTranscription,
                    videoInfo: {
                        title: videoInfo.title,
                        channelTitle: videoInfo.channelTitle,
                        publishedAt: videoInfo.publishedAt,
                        duration: videoInfo.duration
                    },
                    language: languageSelect.value
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            updateProgressBar(100);
            
            if (data.candidates && data.candidates.length > 0) {
                const summary = data.candidates[0].content.parts[0].text;
                return markdownToHtml(summary);
            } else {
                throw new Error('No summary generated');
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            
            // Try with a shorter transcription if error
            if (transcription.length > 50000) {
                updateLoadingText('Essai avec une transcription plus courte...');
                
                // Cette partie devrait être adaptée pour utiliser le backend également
                // Mais je la laisse ici pour illustrer la gestion des erreurs
                return await retryWithShorterTranscription(transcription, videoInfo);
            } else {
                return markdownToHtml(languageSelect.value === 'fr'
                    ? "**Impossible de générer un résumé.** Veuillez réessayer plus tard."
                    : "**Unable to generate summary.** Please try again later.");
            }
        }
    }
    
    async function retryWithShorterTranscription(transcription, videoInfo) {
        const shorterTranscription = transcription.substring(0, 50000) + "... [Transcription tronquée]";
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcription: shorterTranscription,
                    videoInfo: {
                        title: videoInfo.title,
                        channelTitle: videoInfo.channelTitle,
                        publishedAt: videoInfo.publishedAt,
                        duration: videoInfo.duration
                    },
                    language: languageSelect.value,
                    isShorter: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0) {
                const partialSummary = data.candidates[0].content.parts[0].text;
                
                const warningPrefix = languageSelect.value === 'fr'
                    ? "⚠️ RÉSUMÉ PARTIEL (basé uniquement sur une partie de la vidéo) ⚠️\n\n"
                    : "⚠️ PARTIAL SUMMARY (based only on a portion of the video) ⚠️\n\n";
                
                return markdownToHtml(warningPrefix + partialSummary);
            } else {
                throw new Error('No summary generated on second attempt');
            }
        } catch (error) {
            console.error('Error with shorter summary attempt:', error);
            return markdownToHtml(languageSelect.value === 'fr'
                ? "**Impossible de générer un résumé.** L'API a rencontré une erreur. Veuillez réessayer plus tard."
                : "**Unable to generate summary.** The API encountered an error. Please try again later.");
        }
    }
    
    function markdownToHtml(markdown) {
        // Basic markdown to HTML conversion
        if (!markdown) return '';
        
        return markdown
            // Headers
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            
            // Bold and Italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Lists
            .replace(/^\s*\n\* (.*)/gm, '<ul>\n<li>$1</li>')
            .replace(/^\* (.*)/gm, '<li>$1</li>')
            .replace(/^\s*\n- (.*)/gm, '<ul>\n<li>$1</li>')
            .replace(/^- (.*)/gm, '<li>$1</li>')
            .replace(/^\s*\n\d+\. (.*)/gm, '<ol>\n<li>$1</li>')
            .replace(/^\d+\. (.*)/gm, '<li>$1</li>')
            .replace(/<\/ul>\s*\n<ul>/g, '')
            .replace(/<\/ol>\s*\n<ol>/g, '')
            .replace(/<\/li>\s*\n<\/ul>/g, '</li></ul>')
            .replace(/<\/li>\s*\n<\/ol>/g, '</li></ol>')
            
            // Blockquotes
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            
            // Code blocks
            .replace(/`{3}(\w+)?\n([\s\S]*?)\n`{3}/g, '<pre><code>$2</code></pre>')
            
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Line breaks
            .replace(/\n/g, '<br>');
    }
    
    function showToast(message, type = 'info') {
        // Show toast notification
        toastMessage.textContent = message;
        
        if (type === 'error') {
            toast.classList.add('error');
            toastIcon.className = 'fas fa-exclamation-circle text-red-500';
        } else if (type === 'success') {
            toast.classList.add('success');
            toastIcon.className = 'fas fa-check-circle text-green-500';
        } else {
            toastIcon.className = 'fas fa-info-circle text-blue-500';
        }
        
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(function() {
            toast.classList.remove('show', 'error', 'success');
        }, 3000);
    }
    
    function updateLoadingText(text) {
        loadingText.textContent = text;
    }
    
    function updateProgressBar(percent) {
        progressBar.style.width = `${percent}%`;
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'Date inconnue';
        
        const date = new Date(dateString);
        return date.toLocaleDateString(languageSelect.value === 'fr' ? 'fr-FR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        
        const url = youtubeUrl.value.trim();
        if (!url) {
            showToast(languageSelect.value === 'fr' ? 'Veuillez entrer une URL valide' : 'Please enter a valid URL', 'error');
            return;
        }
        
        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            showToast(languageSelect.value === 'fr' ? 'URL YouTube invalide' : 'Invalid YouTube URL', 'error');
            return;
        }
        
        // Save for reference
        currentVideoId = videoId;
        
        // Reset UI
        results.classList.add('hidden');
        videoInfo.classList.add('hidden');
        summarizeBtn.disabled = true;
        loadingState.classList.remove('hidden');
        updateProgressBar(0);
        updateLoadingText(languageSelect.value === 'fr' ? 'Récupération des informations de la vidéo...' : 'Fetching video information...');
        
        try {
            // 1. Get video info
            updateProgressBar(10);
            videoData = await fetchVideoInfo(videoId);
            
            // Update video info section
            videoThumbnail.src = videoData.thumbnail;
            videoTitle.textContent = videoData.title;
            channelTitle.textContent = videoData.channelTitle;
            publishedDate.textContent = formatDate(videoData.publishedAt);
            videoDuration.textContent = videoData.duration;
            videoLink.href = `https://www.youtube.com/watch?v=${videoId}`;
            
            // Show video info
            videoInfo.classList.remove('hidden');
            
            // 2. Get transcription
            updateProgressBar(20);
            transcription = await getTranscription(videoId, languageSelect.value);
            
            if (!transcription) {
                updateProgressBar(100);
                loadingState.classList.add('hidden');
                summarizeBtn.disabled = false;
                showToast(
                    languageSelect.value === 'fr'
                        ? 'Impossible de récupérer la transcription pour cette vidéo'
                        : 'Could not retrieve transcript for this video',
                    'error'
                );
                return;
            }
            
            // 3. Generate summary
            summary = await summarizeWithGemini(transcription, videoData);
            
            // 4. Display results
            summaryContent.innerHTML = summary;
            results.classList.remove('hidden');
            
            // 5. Complete
            loadingState.classList.add('hidden');
            summarizeBtn.disabled = false;
            showToast(
                languageSelect.value === 'fr'
                    ? 'Résumé généré avec succès!'
                    : 'Summary generated successfully!',
                'success'
            );
            
        } catch (error) {
            console.error('Error in summarize process:', error);
            loadingState.classList.add('hidden');
            summarizeBtn.disabled = false;
            showToast(
                languageSelect.value === 'fr'
                    ? `Erreur: ${error.message || 'Impossible de traiter cette vidéo'}`
                    : `Error: ${error.message || 'Could not process this video'}`,
                'error'
            );
        }
    }
    
    // Function to copy summary to clipboard
    function copySummary() {
        // Create a temporary textarea to hold the raw text
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = summaryContent.innerText;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        
        try {
            // Execute copy command
            document.execCommand('copy');
            showToast(
                languageSelect.value === 'fr'
                    ? 'Résumé copié dans le presse-papiers'
                    : 'Summary copied to clipboard',
                'success'
            );
        } catch (err) {
            showToast(
                languageSelect.value === 'fr'
                    ? 'Impossible de copier le texte'
                    : 'Failed to copy text',
                'error'
            );
        }
        
        // Remove the temporary textarea
        document.body.removeChild(tempTextArea);
    }
    
    // Function to download summary as PDF
    function downloadSummary() {
        if (!summary || !videoData) {
            showToast(
                languageSelect.value === 'fr'
                    ? 'Aucun résumé à télécharger'
                    : 'No summary to download',
                'error'
            );
            return;
        }
        
        // Chargement de la bibliothèque jsPDF si elle n'est pas déjà chargée
        if (typeof jsPDF === 'undefined') {
            // Montrer un toast de chargement
            showToast(
                languageSelect.value === 'fr'
                    ? 'Préparation du PDF...'
                    : 'Preparing PDF...'
            );
            
            // Ajouter le script jsPDF
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            
            script.onload = function() {
                // Une fois le script chargé, charger aussi html2canvas
                const canvasScript = document.createElement('script');
                canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                
                canvasScript.onload = function() {
                    // Maintenant que tout est chargé, créer le PDF
                    generatePDF();
                };
                
                document.head.appendChild(canvasScript);
            };
            
            document.head.appendChild(script);
        } else {
            // Si jsPDF est déjà chargé
            generatePDF();
        }
        
        function generatePDF() {
            // Créer un nouvel objet jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Nettoyer le titre pour le nom de fichier
            const title = videoData.title.replace(/[^\w\s]/gi, '-').substring(0, 30);
            
            // Ajouter les métadonnées de la vidéo
            doc.setFontSize(18);
            doc.text(videoData.title, 20, 20, { maxWidth: 170 });
            
            doc.setFontSize(12);
            doc.text(`URL: https://www.youtube.com/watch?v=${currentVideoId}`, 20, doc.previousAutoTable ? doc.previousAutoTable.finalY + 10 : 40);
            doc.text(`Chaîne: ${videoData.channelTitle}`, 20, doc.previousAutoTable ? doc.previousAutoTable.finalY + 10 : 50);
            
            if (videoData.publishedAt) {
                doc.text(`Date de publication: ${formatDate(videoData.publishedAt)}`, 20, doc.previousAutoTable ? doc.previousAutoTable.finalY + 10 : 60);
            }
            
            doc.text(`Date du résumé: ${formatDate(new Date())}`, 20, doc.previousAutoTable ? doc.previousAutoTable.finalY + 10 : 70);
            
            // Titre du résumé
            doc.setFontSize(16);
            doc.text(`Résumé généré par l'IA`, 20, doc.previousAutoTable ? doc.previousAutoTable.finalY + 20 : 85);
            
            // Contenu du résumé
            doc.setFontSize(11);
            
            // Obtenir le contenu texte du résumé
            const rawText = summaryContent.innerText;
            
            // Diviser le contenu en paragraphes pour la mise en page
            const paragraphs = rawText.split('\n\n');
            
            let y = doc.previousAutoTable ? doc.previousAutoTable.finalY + 30 : 95;
            
            paragraphs.forEach(paragraph => {
                // Vérifier si c'est un titre (commence par #)
                if (paragraph.startsWith('#')) {
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                } else {
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');
                }
                
                // Ajouter du texte avec retour à la ligne automatique
                const textLines = doc.splitTextToSize(paragraph, 170);
                
                // Vérifier si nous avons besoin d'une nouvelle page
                if (y + textLines.length * 7 > 280) {
                    doc.addPage();
                    y = 20; // réinitialiser y après l'ajout d'une nouvelle page
                }
                
                doc.text(textLines, 20, y);
                y += textLines.length * 7 + 5; // espace entre les paragraphes
            });
            
            // Ajouter un pied de page
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${pageCount} - Generated with YouTube Summary`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
            }
            
            // Télécharger le PDF
            doc.save(`resume-${title}.pdf`);
            
            showToast(
                languageSelect.value === 'fr'
                    ? 'Résumé téléchargé en PDF'
                    : 'Summary downloaded as PDF',
                'success'
            );
        }
    }
    
    // Event listeners
    youtubeForm.addEventListener('submit', handleSubmit);
    copyBtn.addEventListener('click', copySummary);
    downloadBtn.addEventListener('click', downloadSummary);
    
    // Language change handler
    languageSelect.addEventListener('change', function() {
        // Update UI text based on language
        const lang = languageSelect.value;
        
        if (lang === 'fr') {
            document.querySelector('h1').textContent = "YouTube Summary";
            document.querySelector('header p').textContent = "Résumez n'importe quelle vidéo YouTube avec l'IA";
            document.querySelector('label[for="youtubeUrl"]').innerHTML = '<i class="fas fa-link text-gray-500"></i> URL de la vidéo YouTube';
            youtubeUrl.placeholder = 'https://www.youtube.com/watch?v=...';
            document.querySelector('#youtubeForm p').textContent = "Collez l'URL d'une vidéo YouTube pour en générer un résumé";
            summarizeBtn.innerHTML = '<i class="fas fa-magic"></i> Résumer la vidéo';
            document.querySelector('label[for="language"]').textContent = 'Langue:';
            document.querySelector('h2').textContent = 'Résumé de la vidéo';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copier';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Télécharger';
        } else {
            document.querySelector('h1').textContent = "YouTube Summary";
            document.querySelector('header p').textContent = "Summarize any YouTube video with AI";
            document.querySelector('label[for="youtubeUrl"]').innerHTML = '<i class="fas fa-link text-gray-500"></i> YouTube Video URL';
            youtubeUrl.placeholder = 'https://www.youtube.com/watch?v=...';
            document.querySelector('#youtubeForm p').textContent = "Paste a YouTube video URL to generate a summary";
            summarizeBtn.innerHTML = '<i class="fas fa-magic"></i> Summarize Video';
            document.querySelector('label[for="language"]').textContent = 'Language:';
            document.querySelector('h2').textContent = 'Video Summary';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
        }
    });
    
    // Auto-detect browser language
    var detectBrowserLanguage = function() {
        var browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith('fr')) {
            languageSelect.value = 'fr';
        } else {
            languageSelect.value = 'en';
        }
        
        // Trigger change event to update UI
        var event = new Event('change');
        languageSelect.dispatchEvent(event);
    };
    
    // Initialize
    detectBrowserLanguage();
});