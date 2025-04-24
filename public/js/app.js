/**
 * YouSummarize - app.js
 * Core client-side logic for fetching video info, transcription,
 * generating summaries, and handling UI interactions.
 */
document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    const youtubeForm = document.getElementById('youtubeForm');
    const youtubeUrl = document.getElementById('youtubeUrl'); // Input field
    const summarizeBtn = document.getElementById('summarizeBtn');
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const progressBar = document.getElementById('progressBar');
    const results = document.getElementById('results'); // Results card container
    const summaryContent = document.getElementById('summaryContent'); // Where summary HTML goes
    const videoInfo = document.getElementById('videoInfo'); // Video info card container
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const channelTitle = document.getElementById('channelTitle');
    const publishedDate = document.getElementById('publishedDate');
    const videoDuration = document.getElementById('videoDuration');
    const videoLink = document.getElementById('videoLink'); // Link on thumbnail overlay
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const toast = document.getElementById('toast'); // Toast notification element
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    const languageSelect = document.getElementById('language');
    const pasteButton = document.getElementById('pasteButton'); // The new paste button
    const exampleLinks = document.querySelectorAll('.example-link'); // Example link buttons
    const summaryLengthButtons = document.querySelectorAll('#results .btn-option'); // Summary length buttons
    
    // --- State Variables ---
    let currentVideoId = null; // Store the ID of the currently processed video
    let videoData = null; // Store fetched video metadata
    let currentTranscription = null; // Store the fetched transcription text
    let currentSummary = null; // Store the generated summary HTML
    let currentSummaryLength = 'medium'; // Default summary length
    let isLoading = false; // Prevent multiple submissions
    let toastTimeout = null; // To manage hiding the toast
    
    // --- Configuration ---
    // Backend API URL (empty assumes same origin, adjust if needed)
    const API_BASE_URL = ''; // Example: 'http://localhost:3000' or '/api' if using a proxy
    
    // --- Core Functions ---
    
    /**
     * Extracts the YouTube Video ID from various URL formats.
     * @param {string} url - The YouTube URL.
     * @returns {string|null} The 11-character video ID or null if not found.
     */
    function extractVideoId(url) {
        if (!url) return null;
        url = url.trim();
        const regex = /(?:v=|v\/|embed\/|youtu\.be\/|\/v\/|\/e\/|watch\?v=|\?v=|\&v=)([^#\&\?]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    /**
     * Fetches video metadata from the backend API.
     * @param {string} videoId - The YouTube video ID.
     * @returns {Promise<object>} Object containing video details.
     */
    async function fetchVideoInfo(videoId) {
        updateLoadingState(getText('fetchingVideoInfo', 'Récupération des infos vidéo...'), 10);
        try {
            const response = await fetch(`${API_BASE_URL}/api/video-info?videoId=${videoId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                // Use translated error message
                throw new Error(errorData.error || getText('httpError', 'Erreur HTTP:') + ` ${response.status}`);
            }
            const data = await response.json();
            console.log("Video Info Raw:", data);
            
            if (data.items && data.items.length > 0) {
                const snippet = data.items[0].snippet;
                const contentDetails = data.items[0].contentDetails;
                return {
                    id: videoId,
                    title: snippet.title,
                    channelTitle: snippet.channelTitle,
                    publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
                    description: snippet.description,
                    thumbnail: snippet.thumbnails?.standard?.url || snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    duration: contentDetails?.duration ? convertDuration(contentDetails.duration) : getText('unknown', 'Inconnue')
                };
            }
            // Use translated error message
            throw new Error(getText('videoNotFound', 'Vidéo non trouvée ou informations manquantes.'));
        } catch (error) {
            console.error('Erreur fetchVideoInfo:', error);
            // Use translated error message prefix
            showToast(`${getText('errorVideoInfo', 'Erreur infos vidéo')}: ${error.message}`, 'error');
            return { // Fallback object
                id: videoId,
                title: getText('videoInfoUnavailable', 'Vidéo YouTube (Infos Indisponibles)'),
                channelTitle: getText('unknownChannel', 'Chaîne inconnue'),
                publishedAt: null,
                description: '',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: getText('unknown', 'Inconnue')
            };
        }
    }
    
    /**
     * Converts ISO 8601 duration format (PTnHnMnS) to a readable string.
     * @param {string} duration - ISO 8601 duration string.
     * @returns {string} Readable duration (e.g., "1h 23m 45s").
     */
    function convertDuration(duration) {
        const unknownText = getText('unknown', 'Inconnue');
        if (!duration || typeof duration !== 'string') return unknownText;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return unknownText;
        
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        
        let result = '';
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0 || hours > 0) result += `${String(minutes).padStart(hours > 0 ? 2 : 1, '0')}m `;
        result += `${String(seconds).padStart(2, '0')}s`;
        
        return result.trim() || "0s";
    }
    
    /**
     * Fetches the video transcript from the backend API.
     * @param {string} videoId - The YouTube video ID.
     * @param {string} [language='fr'] - The desired language code (e.g., 'fr', 'en').
     * @returns {Promise<string|null>} The transcript text or null on failure.
     */
    async function getTranscription(videoId, language = 'fr') {
        updateLoadingState(getText('fetchingTranscript', 'Récupération de la transcription ({lang})...').replace('{lang}', language), 30);
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcript?videoId=${videoId}&language=${language}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                // Provide more specific error messages using translations
                if (response.status === 404) {
                    throw new Error(getText('transcriptNotFoundLang', "Transcription non trouvée pour la langue '{lang}'. Essayez une autre langue si disponible.").replace('{lang}', language));
                } else if (response.status === 400 && errorData.error && errorData.error.includes('subtitles disabled')) {
                    throw new Error(getText('subtitlesDisabled', 'Les sous-titres sont désactivés pour cette vidéo.'));
                }
                throw new Error(errorData.error || getText('serverError', 'Erreur serveur') + ` (${response.status})`);
            }
            const data = await response.json();
            updateLoadingState(getText('transcriptRetrieved', 'Transcription récupérée...'), 70);
            if (data.transcript) {
                return data.transcript;
            } else {
                // This case might happen if the backend sends a 200 OK but with an error message
                throw new Error(data.error || getText('invalidTranscriptFormat', 'Format de réponse de transcription invalide.'));
            }
        } catch (error) {
            console.error('Erreur getTranscription:', error);
            showToast(`${getText('errorTranscript', 'Erreur transcription')}: ${error.message}`, 'error');
            updateLoadingState(getText('transcriptFailed', 'Échec transcription'), 70);
            return null; // Indicate failure
        }
    }
    
    /**
     * Sends the transcript to the backend API for summarization.
     * @param {string} transcription - The video transcript text.
     * @param {object} videoInfo - Metadata object for context.
     * @param {string} lengthPreference - 'short', 'medium', or 'long'.
     * @returns {Promise<string>} The summarized text in HTML format, OR an error message in HTML format.
     */
    async function summarizeWithBackend(transcription, videoInfo, lengthPreference = 'medium') {
        updateLoadingState(getText('generatingAISummary', 'Génération du résumé IA...'), 85);
        const language = languageSelect.value;
        
        const MAX_CHARS = 120000;
        const isTruncated = transcription.length > MAX_CHARS;
        const truncatedTranscription = isTruncated
            ? transcription.substring(0, MAX_CHARS) + "... [Transcription tronquée côté client]"
            : transcription;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcription: truncatedTranscription,
                    videoInfo: {
                        title: videoInfo?.title || getText('unknownTitle', 'Titre inconnu'),
                        channelTitle: videoInfo?.channelTitle || getText('unknownChannel', 'Chaîne inconnue')
                    },
                    language: language,
                    lengthPreference: lengthPreference
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.error || getText('serverError', 'Erreur serveur') + ` (${response.status})`);
            }
            
            const data = await response.json();
            updateLoadingState(getText('summaryReceived', 'Résumé reçu !'), 100);
            
            if (data.summary) {
                const warningPrefix = isTruncated
                    ? (language === 'fr'
                        ? "<p><strong>⚠️ Attention :</strong> La transcription était très longue et a été tronquée avant l'analyse. Le résumé peut être incomplet.</p><hr>"
                        : "<p><strong>⚠️ Warning:</strong> The transcript was very long and was truncated before analysis. The summary may be incomplete.</p><hr>")
                    : "";
                return warningPrefix + markdownToHtml(data.summary);
            } else {
                // --- *** MODIFICATION START *** ---
                // Handle case where backend returns 200 OK but no summary
                console.error("Backend returned OK but no summary. Response data:", data); // Log for debugging
                const backendErrorMsg = data.error; // Get potential error message from backend
                const userMessage = backendErrorMsg
                    ? (language === 'fr' ? `Erreur du serveur: ${backendErrorMsg}` : `Server Error: ${backendErrorMsg}`)
                    // Specific translated message for this scenario
                    : getText('summaryGenerationFailed', 'Le serveur a répondu mais n\'a pas pu générer de résumé pour cette vidéo.');
                
                showToast(userMessage, 'error'); // Show toast immediately
                
                // Return the error message formatted as HTML instead of throwing
                return `<p class="text-red-600"><strong>${getText('error', 'Erreur')}:</strong> ${userMessage}</p>`;
                // --- *** MODIFICATION END *** ---
            }
        } catch (error) {
            // Catch errors from fetch itself or non-OK responses
            console.error('Erreur summarizeWithBackend:', error);
            showToast(`${getText('errorSummary', 'Erreur résumé')}: ${error.message}`, 'error');
            updateLoadingState(getText('summaryFailed', 'Échec résumé'), 100);
            // Return a fallback error message in HTML
            return `<p class="text-red-600"><strong>${getText('error', 'Erreur')}:</strong> ${getText('couldNotGenerateSummary', 'Impossible de générer le résumé.')} ${error.message}</p>`;
        }
    }
    
    
    /**
     * Basic Markdown to HTML converter.
     * Handles: Headers (#, ##, ###), Bold (**), Italic (*), Unordered Lists (*, -),
     * Ordered Lists (1.), Blockquotes (>), Links ([]()), Code (`), Code Blocks (```).
     * @param {string} markdown - Markdown text.
     * @returns {string} HTML string.
     */
    function markdownToHtml(markdown) {
        if (!markdown || typeof markdown !== 'string') return '';
        
        let html = markdown;
        
        // Block Elements (order matters)
        // Code Blocks (```lang\ncode``` or ```\ncode```)
        html = html.replace(/```(\w+)?\s*\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const languageClass = lang ? ` class="language-${lang}"` : '';
            // Basic escaping for HTML within code blocks
            const escapedCode = code.replace(/</g, '<').replace(/>/g, '>'); // Use HTML entities
            return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
        });
        
        // Blockquotes ( > quote ) - Must handle multi-line correctly
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
        html = html.replace(/<\/blockquote>\n?<blockquote>/g, '<br>'); // Merge consecutive blockquotes with a line break
        
        // Headers (### Title)
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Horizontal Rules (--- or ***)
        html = html.replace(/^(?:---|\*\*\*)\s*$/gm, '<hr>');
        
        // Unordered Lists (* item or - item) - Improved handling
        // Match list items possibly separated by single newlines
        html = html.replace(/^\s*([*-]) (.*?)(\n(?=\s*[*-] )|$)/gim, (match, _marker, item) => `<li>${item.trim()}</li>\n`);
        html = html.replace(/(?:<li>.*?<\/li>\s*)+/gs, (match) => `<ul>\n${match.trim()}\n</ul>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ul>\s*\n?<ul>/g, ''); // Merge consecutive lists
        
        // Ordered Lists (1. item) - Improved handling
        html = html.replace(/^\s*\d+\. (.*?)(\n(?=\s*\d+\. )|$)/gim, (match, item) => `<li>${item.trim()}</li>\n`);
        html = html.replace(/(?:<li>.*?<\/li>\s*)+/gs, (match) => `<ol>\n${match.trim()}\n</ol>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ol>\s*\n?<ol>/g, ''); // Merge consecutive ordered lists
        
        
        // Paragraphs (treat remaining text blocks) - Split by double newline first
        html = html.split(/\n{2,}/).map(paragraph => {
            paragraph = paragraph.trim();
            if (!paragraph) return '';
            // Avoid wrapping existing block elements in <p>
            if (paragraph.match(/^<(?:ul|ol|li|h[1-6]|block|pre|hr|table|thead|tbody|tr|th|td)/i)) {
                return paragraph;
            }
            // Don't wrap list items that might be separated by \n\n
            if (paragraph.startsWith('<li>') && paragraph.endsWith('</li>')) {
                return paragraph;
            }
            return `<p>${paragraph}</p>`;
        }).join('\n'); // Join with single newline
        
        // Inline Elements (applied within block elements now)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); // Links
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>'); // Inline Code
        
        // Line Breaks (convert single newlines within appropriate blocks to <br>)
        html = html.replace(/<(p|li|blockquote)>(.*?)<\/\1>/gs, (match, tag, content) => `<${tag}>${content.replace(/\n/g, '<br>')}</${tag}>`);
        
        
        // Cleanup potential artifacts
        html = html.replace(/<br>\s*<\/(ul|ol|li|h[1-6]|blockquote|pre|p)>/g, '</$1>'); // Remove <br> before closing block tags
        html = html.replace(/<(ul|ol|li|h[1-6]|blockquote|pre|p)>\s*<br>/g, '<$1>'); // Remove <br> after opening block tags
        html = html.replace(/<p>\s*<\/p>/g, ''); // Remove empty paragraphs
        // html = html.replace(/\n\n/g, '\n'); // Consolidate excessive newlines between blocks - might remove intended spacing
        
        
        return html.trim();
    }
    
    /**
     * Displays a short-lived notification message (toast).
     * @param {string} message - The message to display.
     * @param {'info' | 'success' | 'error'} [type='info'] - The type of toast.
     */
    function showToast(message, type = 'info') {
        if (toastTimeout) clearTimeout(toastTimeout);
        
        toastMessage.textContent = message;
        // Base classes + transition classes
        toast.className = 'fixed bottom-5 right-5 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 text-sm opacity-0 translate-y-3 transition-all duration-300 ease-out z-50';
        toastIcon.className = 'fas'; // Reset icon class
        
        // Add color class based on type
        switch (type) {
            case 'error':
                toast.classList.add('bg-red-600');
                toastIcon.classList.add('fa-exclamation-circle');
                break;
            case 'success':
                toast.classList.add('bg-green-600');
                toastIcon.classList.add('fa-check-circle');
                break;
            default: // 'info'
                toast.classList.add('bg-blue-600');
                toastIcon.classList.add('fa-info-circle');
                break;
        }
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-3');
            toast.classList.add('opacity-100', 'translate-y-0');
        });
        
        // Hide after 3 seconds
        toastTimeout = setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'translate-y-3');
        }, 3000);
    }
    
    /**
     * Updates the loading indicator text and progress bar.
     * @param {string} text - The status text to display.
     * @param {number} percent - The progress percentage (0-100).
     */
    function updateLoadingState(text, percent) {
        if (loadingState.classList.contains('hidden')) return;
        loadingText.textContent = text;
        progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    
    /**
     * Formats a date object or string into a localized string.
     * @param {Date|string|null} dateInput - The date to format.
     * @returns {string} Formatted date string or a fallback.
     */
    function formatDate(dateInput) {
        const unknownDateText = getText('unknownDate', 'Date inconnue');
        const invalidDateText = getText('invalidDate', 'Date invalide');
        if (!dateInput) return unknownDateText;
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) {
                return invalidDateText;
            }
            const lang = languageSelect.value === 'fr' ? 'fr-FR' : languageSelect.value === 'es' ? 'es-ES' : 'en-US'; // Add other locales as needed
            return date.toLocaleDateString(lang, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            console.error("Error formatting date:", dateInput, e);
            return invalidDateText;
        }
    }
    
    /**
     * Updates the UI with fetched video information.
     * @param {object} data - The video data object from fetchVideoInfo.
     */
    function displayVideoInfo(data) {
        videoData = data;
        if (!data || !data.id) {
            videoInfo.classList.add('hidden');
            return;
        }
        videoThumbnail.src = data.thumbnail || `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`;
        videoThumbnail.alt = `${getText('thumbnailAltPrefix', 'Miniature de la vidéo:')} ${data.title || getText('youtubeVideo', 'Vidéo YouTube')}`;
        videoTitle.textContent = data.title || getText('titleUnavailable', 'Titre indisponible');
        channelTitle.textContent = data.channelTitle || getText('unknownChannel', 'Chaîne inconnue');
        publishedDate.textContent = formatDate(data.publishedAt);
        videoDuration.textContent = data.duration || getText('unknown', 'Inconnue');
        videoLink.href = `https://www.youtube.com/watch?v=${data.id}`;
        videoInfo.classList.remove('hidden');
    }
    
    /**
     * Displays the generated summary in the results area.
     * @param {string} summaryHtml - The summary content (HTML).
     */
    function displaySummary(summaryHtml) {
        currentSummary = summaryHtml; // Store even if it's an error message
        summaryContent.innerHTML = summaryHtml || `<p>${getText('noSummaryGenerated', 'Aucun résumé généré.')}</p>`;
        results.classList.remove('hidden');
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Resets the UI state before a new request or on error.
     */
    function resetUI() {
        results.classList.add('hidden');
        videoInfo.classList.add('hidden');
        loadingState.classList.add('hidden');
        summarizeBtn.disabled = false;
        isLoading = false;
        progressBar.style.width = '0%'; // Reset progress bar style
        summaryContent.innerHTML = '';
        videoThumbnail.src = '';
        currentVideoId = null;
        videoData = null;
        currentTranscription = null;
        currentSummary = null;
        currentSummaryLength = 'medium'; // Reset length state
        
        // Reset active state on length buttons
        summaryLengthButtons.forEach((btn) => {
            const isMedium = btn.dataset.length === 'medium';
            btn.classList.toggle('active', isMedium);
            btn.classList.toggle('bg-[#E9E5D8]', isMedium);
            btn.classList.toggle('text-main', isMedium);
            btn.classList.toggle('font-medium', isMedium);
            btn.classList.toggle('bg-white', !isMedium);
            btn.classList.toggle('text-subtle', !isMedium);
        });
    }
    
    /**
     * Handles the main form submission process.
     * @param {Event} e - The form submission event.
     */
    async function handleSubmit(e) {
        e.preventDefault();
        if (isLoading) return;
        
        const url = youtubeUrl.value.trim();
        if (!url) {
            showToast(getText('enterUrl', 'Veuillez entrer une URL YouTube.'), 'error');
            youtubeUrl.focus();
            return;
        }
        
        const videoId = extractVideoId(url);
        if (!videoId) {
            showToast(getText('invalidUrl', 'URL YouTube invalide ou non reconnue.'), 'error');
            youtubeUrl.focus();
            return;
        }
        
        isLoading = true;
        resetUI(); // Reset before starting
        loadingState.classList.remove('hidden');
        summarizeBtn.disabled = true;
        updateLoadingState(getText('validatingUrl', 'Validation de l\'URL...'), 5);
        currentVideoId = videoId;
        
        try {
            // 1. Fetch Video Info
            const fetchedVideoData = await fetchVideoInfo(videoId);
            // Display even if info is limited (fallback object returned)
            displayVideoInfo(fetchedVideoData);
            // Show a warning if the info was limited (check based on fallback title)
            if (fetchedVideoData.title === getText('videoInfoUnavailable', 'Vidéo YouTube (Infos Indisponibles)')) {
                showToast(getText('limitedVideoInfo', 'Infos vidéo limitées récupérées.'), 'info');
            }
            
            // 2. Get Transcription
            currentTranscription = await getTranscription(videoId, languageSelect.value);
            if (!currentTranscription) {
                // Error handled within getTranscription (toast shown)
                throw new Error('SKIP_TO_FINALLY');
            }
            
            // 3. Generate Summary
            // summarizeWithBackend now returns either summary HTML or error HTML
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            
            // --- *** MODIFICATION START *** ---
            // Display whatever HTML was returned (summary or error message)
            displaySummary(summaryHtml);
            
            // Check if the returned HTML indicates an error (based on our error format)
            // If it's NOT an error, show the success toast.
            if (!summaryHtml || !summaryHtml.includes('<p class="text-red-600">')) {
                showToast(getText('summaryGeneratedSuccess', 'Résumé généré avec succès !'), 'success');
            } else {
                // If it WAS an error HTML, the error toast was already shown inside summarizeWithBackend.
                // We still throw SKIP_TO_FINALLY to prevent any further success logic if needed,
                // although in this structure, it mainly just prevents the success toast.
                throw new Error('SKIP_TO_FINALLY');
            }
            // --- *** MODIFICATION END *** ---
            
        } catch (error) {
            if (error.message !== 'SKIP_TO_FINALLY') {
                console.error('Erreur inattendue dans handleSubmit:', error);
                // Show a generic error only if a specific one wasn't likely shown
                if (!error.message.includes(getText('errorTranscript', 'Erreur transcription')) &&
                    !error.message.includes(getText('errorSummary', 'Erreur résumé')) &&
                    !error.message.includes(getText('errorVideoInfo', 'Erreur infos vidéo'))) {
                    showToast(`${getText('error', 'Erreur')}: ${error.message}`, 'error');
                }
            }
        } finally {
            // 5. End Loading State
            loadingState.classList.add('hidden');
            summarizeBtn.disabled = false;
            isLoading = false;
            progressBar.style.width = '0%'; // Reset progress bar style
        }
    }
    
    /**
     * Copies the plain text version of the summary to the clipboard.
     */
    function copySummary() {
        const noSummaryText = getText('noSummaryToCopy', 'Aucun résumé à copier.');
        const summaryEmptyText = getText('summaryEmpty', 'Le résumé est vide.');
        const copySuccessText = getText('summaryCopied', 'Résumé copié !');
        const copyFailText = getText('copyFailed', 'Échec de la copie.');
        const copyFallbackSuccessText = getText('summaryCopiedFallback', 'Résumé copié (méthode alternative) !');
        
        if (!summaryContent || !currentSummary || currentSummary.includes('<p class="text-red-600">')) { // Don't copy error messages
            showToast(noSummaryText, 'error');
            return;
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentSummary;
        tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        tempDiv.querySelectorAll('p, h1, h2, h3, h4, li, blockquote').forEach(el => {
            if(el.tagName === 'LI' || el.tagName.startsWith('H') || el.tagName === 'BLOCKQUOTE') {
                el.before('\n');
            }
            el.append('\n');
        });
        tempDiv.querySelectorAll('hr').forEach(hr => hr.replaceWith('\n---\n'));
        
        let textToCopy = tempDiv.textContent || tempDiv.innerText || '';
        textToCopy = textToCopy.replace(/\n{3,}/g, '\n\n').trim(); // Collapse multiple newlines and trim
        
        if (!textToCopy) {
            showToast(summaryEmptyText, 'error');
            return;
        }
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(copySuccessText, 'success');
            }).catch(err => {
                console.error('Erreur copie Clipboard API:', err);
                showToast(copyFailText, 'error');
                copyWithExecCommand(textToCopy); // Attempt fallback
            });
        } else {
            copyWithExecCommand(textToCopy); // Use fallback directly
        }
    }
    
    /**
     * Fallback method to copy text using document.execCommand.
     * @param {string} text - The text to copy.
     */
    function copyWithExecCommand(text) {
        const copySuccessText = getText('summaryCopiedFallback', 'Résumé copié (méthode alternative) !');
        const copyFailText = getText('copyFailed', 'Échec de la copie.');
        
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showToast(copySuccessText, 'success');
            } else {
                throw new Error('document.execCommand failed');
            }
        } catch (err) {
            console.error('Erreur copie execCommand:', err);
            showToast(copyFailText, 'error');
        }
        document.body.removeChild(textArea);
    }
    
    
    /**
     * Generates and downloads the summary as a PDF document.
     * Dynamically loads jsPDF if not already available.
     */
    function downloadSummary() {
        const noSummaryDownloadText = getText('noSummaryToDownload', 'Aucun résumé à télécharger.');
        const preparingPDFText = getText('preparingPDF', 'Préparation du PDF...');
        const pdfLibraryErrorText = getText('pdfLibraryError', 'Erreur chargement dépendance PDF.');
        const pdfDownloadedText = getText('pdfDownloaded', 'PDF téléchargé !');
        const pdfCreationErrorText = getText('pdfCreationError', 'Erreur lors de la création du PDF.');
        
        if (!currentSummary || !videoData || currentSummary.includes('<p class="text-red-600">')) { // Don't download errors
            showToast(noSummaryDownloadText, 'error');
            return;
        }
        
        const jspdfSrc = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                if (typeof window.jspdf !== 'undefined') {
                    resolve(); return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        showToast(preparingPDFText, 'info');
        
        loadScript(jspdfSrc)
            .then(() => generatePDF())
            .catch(err => {
                console.error("Erreur chargement librairie PDF:", err);
                showToast(pdfLibraryErrorText, 'error');
            });
        
        function generatePDF() {
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
                const margin = 15;
                const maxLineWidth = pageWidth - margin * 2;
                let currentY = margin;
                const lang = languageSelect.value;
                const unknownText = getText('unknown', 'Inconnue');
                
                // --- PDF Content ---
                doc.setFont('Helvetica'); // Use a standard font
                
                // 1. Video Title
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                const titleLines = doc.splitTextToSize(videoData.title || getText('videoSummary', 'Résumé Vidéo'), maxLineWidth);
                if (currentY + titleLines.length * 7 > pageHeight - margin) { doc.addPage(); currentY = margin; }
                doc.text(titleLines, margin, currentY);
                currentY += (titleLines.length * 7) + 5;
                
                // 2. Metadata
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100);
                
                const metadata = [
                    `URL: https://www.youtube.com/watch?v=${currentVideoId}`,
                    `${getText('channel', 'Chaîne')}: ${videoData.channelTitle || unknownText}`,
                    `${getText('published', 'Publié')}: ${formatDate(videoData.publishedAt)}`,
                    `${getText('duration', 'Durée')}: ${videoData.duration || unknownText}`,
                    `${getText('summaryGeneratedOn', 'Résumé généré le')}: ${formatDate(new Date())} (${getText('language', 'Langue')}: ${lang}, ${getText('length', 'Longueur')}: ${getText(`length${capitalize(currentSummaryLength)}`, currentSummaryLength)})`
                ];
                
                metadata.forEach(line => {
                    const metaLines = doc.splitTextToSize(line, maxLineWidth);
                    const neededHeight = metaLines.length * 4;
                    if (currentY + neededHeight > pageHeight - margin) { doc.addPage(); currentY = margin; }
                    doc.text(metaLines, margin, currentY);
                    currentY += neededHeight + 1; // Add small gap
                });
                
                currentY += 5; // Extra space before summary
                doc.setTextColor(0); // Reset text color
                
                // 3. Summary Content
                const summaryContainer = document.createElement('div');
                summaryContainer.innerHTML = currentSummary; // Parse the HTML
                
                function addContentToPdf(element, currentIndent = 0, currentStyle = { size: 11, style: 'normal', color: [0, 0, 0], font: 'Helvetica' }) {
                    const neededSpace = currentStyle.size * 0.5; // Estimate space needed
                    if (currentY > pageHeight - margin - neededSpace) {
                        doc.addPage(); currentY = margin;
                        doc.setFont(currentStyle.font, currentStyle.style); // Reset font on new page
                        doc.setFontSize(currentStyle.size);
                        doc.setTextColor(...currentStyle.color);
                    }
                    
                    let elementStyle = { ...currentStyle }; // Inherit style
                    let elementMargin = 0;
                    let listPrefix = '';
                    let currentX = margin + currentIndent;
                    
                    switch (element.tagName) {
                        case 'H1': elementStyle.size = 14; elementStyle.style = 'bold'; elementMargin = 4; break;
                        case 'H2': elementStyle.size = 13; elementStyle.style = 'bold'; elementMargin = 3; break;
                        case 'H3': elementStyle.size = 12; elementStyle.style = 'bold'; elementMargin = 2; break;
                        case 'STRONG': case 'B': elementStyle.style = 'bold'; break;
                        case 'EM': case 'I': elementStyle.style = 'italic'; break;
                        case 'P': elementMargin = 2; break;
                        case 'LI': listPrefix = '• '; elementMargin = 1; break;
                        case 'BLOCKQUOTE': currentIndent += 5; currentX = margin + currentIndent; elementStyle.color = [100, 100, 100]; elementMargin = 2; break;
                        case 'HR':
                            if (currentY + 4 > pageHeight - margin) { doc.addPage(); currentY = margin; }
                            doc.setDrawColor(150); doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2); currentY += 4; return;
                        case 'A': elementStyle.color = [0, 0, 255]; break; // Basic link styling
                        case 'CODE': elementStyle.font = 'Courier'; elementStyle.size = 10; break; // Inline code
                        case 'PRE': // Code Block
                            if (currentY + 10 > pageHeight - margin) { doc.addPage(); currentY = margin; }
                            elementStyle.font = 'Courier'; elementStyle.size = 9;
                            const preText = element.textContent || '';
                            const preLines = doc.splitTextToSize(preText, maxLineWidth - currentIndent - 2); // Allow padding
                            const preHeight = preLines.length * (elementStyle.size * 0.35) + 4; // Estimate height + padding
                            if (currentY + preHeight > pageHeight - margin) { doc.addPage(); currentY = margin; }
                            doc.setFillColor(240, 240, 240);
                            doc.rect(currentX, currentY, maxLineWidth - currentIndent, preHeight, 'F'); // Background
                            doc.setFont(elementStyle.font, 'normal'); doc.setFontSize(elementStyle.size); doc.setTextColor(0);
                            doc.text(preLines, currentX + 1, currentY + elementStyle.size * 0.35); // Add text
                            currentY += preHeight + 3;
                            return; // Handled pre block
                    }
                    
                    currentY += elementMargin;
                    doc.setFont(elementStyle.font, elementStyle.style);
                    doc.setFontSize(elementStyle.size);
                    doc.setTextColor(...elementStyle.color);
                    
                    // Process child nodes recursively or text content directly
                    if (element.childNodes && element.childNodes.length > 0 && element.tagName !== 'PRE' && element.tagName !== 'CODE') {
                        element.childNodes.forEach(child => {
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                addContentToPdf(child, currentIndent, elementStyle); // Pass current style and indent
                            } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                                processTextNode(child.textContent, currentX, listPrefix, maxLineWidth - currentIndent, elementStyle);
                            }
                        });
                    } else if (element.textContent && element.tagName !== 'PRE') {
                        // Handle simple elements or leaf nodes with text
                        processTextNode(element.textContent, currentX, listPrefix, maxLineWidth - currentIndent, elementStyle, element.tagName === 'A' ? element.href : null);
                    }
                }
                
                function processTextNode(text, x, prefix, availableWidth, style, linkUrl = null) {
                    const fullText = prefix + text.trim() + (linkUrl ? ` (${linkUrl})` : '');
                    if (!fullText) return;
                    
                    const lines = doc.splitTextToSize(fullText, availableWidth - (prefix ? 3 : 0));
                    const neededHeight = lines.length * (style.size * 0.35) + 1;
                    
                    if (currentY + neededHeight > pageHeight - margin) {
                        doc.addPage(); currentY = margin;
                        // Reset font/style/color on new page
                        doc.setFont(style.font, style.style);
                        doc.setFontSize(style.size);
                        doc.setTextColor(...style.color);
                    }
                    // Set styles again before text (might have changed due to page break/other elements)
                    doc.setFont(style.font, style.style);
                    doc.setFontSize(style.size);
                    doc.setTextColor(...style.color);
                    
                    doc.text(lines, x + (prefix ? 3 : 0), currentY);
                    currentY += neededHeight;
                }
                
                // Start processing the summary container's children
                summaryContainer.childNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        addContentToPdf(node, 0); // Start with 0 indent and default style
                    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        // Handle top-level text nodes (wrap in pseudo-P element)
                        addContentToPdf({ tagName: 'P', textContent: node.textContent }, 0);
                    }
                });
                
                // 4. Footer (Page Numbers)
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(9);
                    doc.setTextColor(150);
                    doc.text(`${getText('page', 'Page')} ${i} / ${pageCount} - YouSummarize`, pageWidth / 2, pageHeight - margin / 2, { align: 'center' });
                }
                
                // 5. Save
                const safeTitle = (videoData.title || 'youtube-summary').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 40);
                doc.save(`YouSummarize_${safeTitle}.pdf`);
                showToast(pdfDownloadedText, 'success');
                
            } catch (pdfError) {
                console.error("Erreur génération PDF:", pdfError);
                showToast(pdfCreationErrorText, 'error');
            }
        }
    }
    
    /**
     * Handles clicks on the summary length buttons.
     * @param {Event} e - The click event.
     */
    async function handleLengthChange(e) {
        if (!e || !e.target || !e.target.dataset || !e.target.dataset.length) return; // Guard against invalid events
        
        const newLength = e.target.dataset.length;
        
        if (isLoading || !currentTranscription || !videoData) {
            // Prevent action if busy or no data, visually reset to current active state if needed
            summaryLengthButtons.forEach(btn => {
                const isActive = btn.dataset.length === currentSummaryLength;
                btn.classList.toggle('active', isActive);
                // ... toggle other classes as in resetUI/applyTranslations ...
            });
            return;
        }
        
        if (newLength === currentSummaryLength) return; // No change
        
        // Update button styles immediately
        summaryLengthButtons.forEach(btn => {
            const isActive = btn.dataset.length === newLength;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('bg-[#E9E5D8]', isActive);
            btn.classList.toggle('text-main', isActive);
            btn.classList.toggle('font-medium', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('text-subtle', !isActive);
        });
        
        currentSummaryLength = newLength; // Update state
        
        // Regenerate summary
        isLoading = true;
        results.classList.add('opacity-50', 'pointer-events-none');
        summaryContent.innerHTML = `<p class="flex items-center justify-center gap-2"><span class="loading-spinner !w-5 !h-5 !border-2"></span> ${getText('recalculatingSummary', 'Recalcul du résumé...')}</p>`;
        
        try {
            // summarizeWithBackend returns summary HTML or error HTML
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            displaySummary(summaryHtml); // Display the result (summary or error)
            
            // Show success toast only if it wasn't an error message
            if (!summaryHtml || !summaryHtml.includes('<p class="text-red-600">')) {
                const lengthText = getText(`length${capitalize(currentSummaryLength)}`, currentSummaryLength); // Get translated length name
                showToast(`${getText('summaryUpdated', 'Résumé mis à jour')} (${lengthText})`, 'success');
            }
        } catch (error) {
            // Catch unexpected errors during the process (though summarizeWithBackend should handle most)
            console.error("Erreur recalcul résumé:", error);
            showToast(getText('errorRecalculating', 'Erreur recalcul.'), 'error');
            // Display a generic error in the summary area if needed
            displaySummary(`<p class="text-red-600">${getText('errorRecalculating', 'Erreur recalcul.')}</p>`);
        } finally {
            isLoading = false;
            results.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
    
    // Helper to capitalize first letter for translation keys
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // --- Event Listeners ---
    youtubeForm.addEventListener('submit', handleSubmit);
    copyBtn.addEventListener('click', copySummary);
    downloadBtn.addEventListener('click', downloadSummary);
    
    // Listener for the Paste Button
    if (pasteButton && youtubeUrl && navigator.clipboard) {
        pasteButton.addEventListener('click', () => {
            navigator.clipboard.readText()
                .then(text => {
                    if (text) {
                        youtubeUrl.value = text;
                        youtubeUrl.focus();
                        showToast(getText('linkPasted', 'Lien collé !'), 'success');
                    } else {
                        showToast(getText('clipboardEmpty', 'Presse-papiers vide.'), 'info');
                    }
                })
                .catch(err => {
                    console.error('Erreur lecture presse-papiers : ', err);
                    if (err.name === 'NotAllowedError') {
                        showToast(getText('pastePermissionError', 'Autorisation requise pour coller.'), 'error');
                    } else {
                        showToast(getText('pasteError', 'Impossible de coller.'), 'error');
                    }
                });
        });
    } else if (pasteButton) {
        console.warn("API Clipboard non disponible (HTTPS requis?). Bouton Coller désactivé.");
        pasteButton.disabled = true;
        pasteButton.style.opacity = '0.5';
        // Title will be updated by translation function
    }
    
    // Listeners for Example Links
    exampleLinks.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.currentTarget.dataset.url;
            if (url && !isLoading) {
                youtubeUrl.value = url;
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                youtubeForm.dispatchEvent(submitEvent);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (isLoading) {
                showToast(getText('waitForCurrentSummary', 'Veuillez attendre la fin du résumé actuel.'), 'info');
            }
        });
    });
    
    // Listeners for Summary Length Buttons
    summaryLengthButtons.forEach(button => {
        button.addEventListener('click', handleLengthChange);
    });
    
    // --- Translations ---
    const translations = {
        fr: {
            title: "YouSummarize - Résumés Vidéo YouTube par IA",
            h1: "YouTube Summary",
            heroP: "Collez un lien YouTube, obtenez un résumé clair et concis. Gagnez du temps, comprenez plus vite.",
            heroBadge: "Gratuit · Rapide · Aucune Inscription",
            urlLabel: "Collez votre lien YouTube ici",
            urlPlaceholder: "https://www.youtube.com/watch?v=...",
            urlHelp: "Fonctionne avec les vidéos publiques disposant de sous-titres.",
            submitBtn: "Générer le résumé",
            languageLabel: "Langue:",
            exampleTitle: "Ou essayez avec un exemple :",
            loadingDefault: "Analyse en cours...",
            loadingFewSecs: "Cela peut prendre quelques secondes.",
            videoInfoTitle: "Résumé Généré",
            copyBtn: "Copier",
            downloadBtn: "PDF",
            lengthLabel: "Précision:",
            lengthShort: "Court",
            lengthMedium: "Moyen",
            lengthLong: "Détaillé",
            howWhyTitle: "Simple, Rapide, Efficace",
            feature1Title: "Collez & Gagnez du Temps", feature1Desc: "Entrez l'URL YouTube. Obtenez l'essentiel en quelques secondes, pas en heures.",
            feature2Title: "Analyse IA & Idées Clés", feature2Desc: "L'IA extrait les points importants. Comprenez les concepts clés facilement.",
            feature3Title: "Résumé & Partage Facile", feature3Desc: "Recevez un texte structuré. Copiez ou téléchargez pour partager vos trouvailles.",
            faqTitle: "Questions Fréquentes",
            ctaTitle: "Prêt à accélérer votre veille ?", ctaP: "Arrêtez de perdre du temps. Collez votre premier lien YouTube maintenant.", ctaBtn: "Essayer YouSummarize (Gratuit)", ctaHelp: "Aucune inscription requise",
            newsletterTitle: "Restez informé", newsletterP: "Nouveautés et astuces occasionnelles.", newsletterEmail: "votre.email@exemple.com", newsletterBtn: "S'abonner",
            footerBy: "par", footerApi: "Documentation API", footerPrivacy: "Confidentialité", footerTerms: "Conditions", footerContact: "Contact", footerSitemap: "Plan du site",
            bmcMessage: "Merci pour votre soutien ! Gardons ce service gratuit !",
            // Error/Status Messages
            fetchingVideoInfo: 'Récupération des infos vidéo...', httpError: 'Erreur HTTP:', videoNotFound: 'Vidéo non trouvée ou informations manquantes.',
            errorVideoInfo: 'Erreur infos vidéo', videoInfoUnavailable: 'Vidéo YouTube (Infos Indisponibles)', unknownChannel: 'Chaîne inconnue', unknown: 'Inconnue',
            fetchingTranscript: 'Récupération de la transcription ({lang})...', transcriptNotFoundLang: "Transcription non trouvée pour la langue '{lang}'. Essayez une autre langue si disponible.",
            subtitlesDisabled: 'Les sous-titres sont désactivés pour cette vidéo.', serverError: 'Erreur serveur', invalidTranscriptFormat: 'Format de réponse de transcription invalide.',
            transcriptRetrieved: 'Transcription récupérée...', errorTranscript: 'Erreur transcription', transcriptFailed: 'Échec transcription',
            generatingAISummary: 'Génération du résumé IA...', summaryReceived: 'Résumé reçu !', errorSummary: 'Erreur résumé', summaryFailed: 'Échec résumé',
            couldNotGenerateSummary: 'Impossible de générer le résumé.', summaryGenerationFailed: 'Le serveur a répondu mais n\'a pas pu générer de résumé pour cette vidéo.',
            error: 'Erreur', unknownTitle: 'Titre inconnu',
            enterUrl: 'Veuillez entrer une URL YouTube.', invalidUrl: 'URL YouTube invalide ou non reconnue.', validatingUrl: 'Validation de l\'URL...',
            summaryGeneratedSuccess: 'Résumé généré avec succès !', limitedVideoInfo: 'Infos vidéo limitées récupérées.',
            noSummaryToCopy: 'Aucun résumé à copier.', summaryEmpty: 'Le résumé est vide.', summaryCopied: 'Résumé copié !', copyFailed: 'Échec de la copie.', summaryCopiedFallback: 'Résumé copié (méthode alternative) !',
            noSummaryToDownload: 'Aucun résumé à télécharger.', preparingPDF: 'Préparation du PDF...', pdfLibraryError: 'Erreur chargement dépendance PDF.', pdfDownloaded: 'PDF téléchargé !', pdfCreationErrorText: 'Erreur lors de la création du PDF.',
            recalculatingSummary: 'Recalcul du résumé...', summaryUpdated: 'Résumé mis à jour', errorRecalculating: 'Erreur recalcul.',
            linkPasted: 'Lien collé !', clipboardEmpty: 'Presse-papiers vide.', pastePermissionError: 'Autorisation requise pour coller.', pasteError: 'Impossible de coller.',
            waitForCurrentSummary: 'Veuillez attendre la fin du résumé actuel.',
            thumbnailAltPrefix: 'Miniature de la vidéo:', youtubeVideo: 'Vidéo YouTube', titleUnavailable: 'Titre indisponible',
            unknownDate: 'Date inconnue', invalidDate: 'Date invalide', noSummaryGenerated: 'Aucun résumé généré.',
            channel: 'Chaîne', published: 'Publié', duration: 'Durée', summaryGeneratedOn: 'Résumé généré le', language: 'Langue', length: 'Longueur',
            page: 'Page', videoSummary: 'Résumé Vidéo',
            pasteButtonDisabledTitle: "Fonctionnalité non disponible (HTTPS requis)",
        },
        en: {
            title: "YouSummarize - AI YouTube Video Summaries",
            h1: "YouTube Summary",
            heroP: "Paste a YouTube link, get a clear & concise summary. Save time, understand faster.",
            heroBadge: "Free · Fast · No Sign-up",
            urlLabel: "Paste your YouTube link here",
            urlPlaceholder: "https://www.youtube.com/watch?v=...",
            urlHelp: "Works with public videos that have subtitles.",
            submitBtn: "Generate Summary",
            languageLabel: "Language:",
            exampleTitle: "Or try an example:",
            loadingDefault: "Analyzing...",
            loadingFewSecs: "This may take a few seconds.",
            videoInfoTitle: "Generated Summary",
            copyBtn: "Copy",
            downloadBtn: "PDF",
            lengthLabel: "Detail:",
            lengthShort: "Short",
            lengthMedium: "Medium",
            lengthLong: "Detailed",
            howWhyTitle: "Simple, Fast, Effective",
            feature1Title: "Paste & Save Time", feature1Desc: "Enter the YouTube URL. Get the gist in seconds, not hours.",
            feature2Title: "AI Analysis & Key Insights", feature2Desc: "AI extracts the important points. Understand key concepts easily.",
            feature3Title: "Summary & Easy Sharing", feature3Desc: "Receive structured text. Copy or download to share your findings.",
            faqTitle: "Frequently Asked Questions",
            ctaTitle: "Ready to speed up your learning?", ctaP: "Stop wasting time. Paste your first YouTube link now.", ctaBtn: "Try YouSummarize (Free)", ctaHelp: "No sign-up required",
            newsletterTitle: "Stay Informed", newsletterP: "Occasional updates and tips.", newsletterEmail: "your.email@example.com", newsletterBtn: "Subscribe",
            footerBy: "by", footerApi: "API Docs", footerPrivacy: "Privacy", footerTerms: "Terms", footerContact: "Contact", footerSitemap: "Sitemap",
            bmcMessage: "Thanks for your support! Let's keep this service free!",
            // Error/Status Messages
            fetchingVideoInfo: 'Fetching video info...', httpError: 'HTTP Error:', videoNotFound: 'Video not found or missing information.',
            errorVideoInfo: 'Video Info Error', videoInfoUnavailable: 'YouTube Video (Info Unavailable)', unknownChannel: 'Unknown Channel', unknown: 'Unknown',
            fetchingTranscript: 'Fetching transcript ({lang})...', transcriptNotFoundLang: "Transcript not found for language '{lang}'. Try another language if available.",
            subtitlesDisabled: 'Subtitles are disabled for this video.', serverError: 'Server Error', invalidTranscriptFormat: 'Invalid transcript response format.',
            transcriptRetrieved: 'Transcript retrieved...', errorTranscript: 'Transcript Error', transcriptFailed: 'Transcript Failed',
            generatingAISummary: 'Generating AI summary...', summaryReceived: 'Summary received!', errorSummary: 'Summary Error', summaryFailed: 'Summary Failed',
            couldNotGenerateSummary: 'Could not generate summary.', summaryGenerationFailed: 'The server responded but could not generate a summary for this video.',
            error: 'Error', unknownTitle: 'Unknown Title',
            enterUrl: 'Please enter a YouTube URL.', invalidUrl: 'Invalid or unrecognized YouTube URL.', validatingUrl: 'Validating URL...',
            summaryGeneratedSuccess: 'Summary generated successfully!', limitedVideoInfo: 'Limited video info retrieved.',
            noSummaryToCopy: 'No summary to copy.', summaryEmpty: 'Summary is empty.', summaryCopied: 'Summary copied!', copyFailed: 'Copy failed.', summaryCopiedFallback: 'Summary copied (fallback method)!',
            noSummaryToDownload: 'No summary to download.', preparingPDF: 'Preparing PDF...', pdfLibraryError: 'Error loading PDF library.', pdfDownloaded: 'PDF Downloaded!', pdfCreationErrorText: 'Error creating PDF.',
            recalculatingSummary: 'Recalculating summary...', summaryUpdated: 'Summary updated', errorRecalculating: 'Error recalculating.',
            linkPasted: 'Link pasted!', clipboardEmpty: 'Clipboard is empty.', pastePermissionError: 'Permission needed to paste.', pasteError: 'Could not paste.',
            waitForCurrentSummary: 'Please wait for the current summary to finish.',
            thumbnailAltPrefix: 'Video thumbnail:', youtubeVideo: 'YouTube Video', titleUnavailable: 'Title unavailable',
            unknownDate: 'Unknown date', invalidDate: 'Invalid date', noSummaryGenerated: 'No summary generated.',
            channel: 'Channel', published: 'Published', duration: 'Duration', summaryGeneratedOn: 'Summary generated on', language: 'Language', length: 'Length',
            page: 'Page', videoSummary: 'Video Summary',
            pasteButtonDisabledTitle: "Feature unavailable (HTTPS required)",
        },
        es: { // Example Spanish - Needs full translation
            title: "YouSummarize - Resúmenes IA de Vídeos de YouTube",
            h1: "Resumen de YouTube",
            heroP: "Pega un enlace de YouTube, obtén un resumen claro y conciso. Ahorra tiempo, entiende más rápido.",
            heroBadge: "Gratis · Rápido · Sin Registro",
            urlLabel: "Pega tu enlace de YouTube aquí",
            urlPlaceholder: "https://www.youtube.com/watch?v=...",
            urlHelp: "Funciona con videos públicos que tengan subtítulos.",
            submitBtn: "Generar Resumen",
            languageLabel: "Idioma:",
            exampleTitle: "O prueba un ejemplo:",
            loadingDefault: "Analizando...",
            loadingFewSecs: "Esto puede tardar unos segundos.",
            videoInfoTitle: "Resumen Generado",
            copyBtn: "Copiar",
            downloadBtn: "PDF",
            lengthLabel: "Detalle:",
            lengthShort: "Corto",
            lengthMedium: "Medio",
            lengthLong: "Detallado",
            howWhyTitle: "Simple, Rápido, Eficaz",
            feature1Title: "Pega y Ahorra Tiempo", feature1Desc: "Introduce la URL de YouTube. Obtén lo esencial en segundos, no en horas.",
            feature2Title: "Análisis IA e Ideas Clave", feature2Desc: "La IA extrae los puntos importantes. Entiende los conceptos clave fácilmente.",
            feature3Title: "Resumen y Fácil Compartir", feature3Desc: "Recibe texto estructurado. Copia o descarga para compartir tus hallazgos.",
            faqTitle: "Preguntas Frecuentes",
            ctaTitle: "¿Listo para acelerar tu aprendizaje?", ctaP: "Deja de perder tiempo. Pega tu primer enlace de YouTube ahora.", ctaBtn: "Probar YouSummarize (Gratis)", ctaHelp: "No requiere registro",
            newsletterTitle: "Mantente Informado", newsletterP: "Novedades y consejos ocasionales.", newsletterEmail: "tu.email@ejemplo.com", newsletterBtn: "Suscribirse",
            footerBy: "por", footerApi: "Documentación API", footerPrivacy: "Privacidad", footerTerms: "Términos", footerContact: "Contacto", footerSitemap: "Mapa del sitio",
            bmcMessage: "¡Gracias por tu apoyo! ¡Mantengamos este servicio gratuito!",
            // Error/Status Messages (Translate these)
            fetchingVideoInfo: 'Obteniendo información del vídeo...', httpError: 'Error HTTP:', videoNotFound: 'Vídeo no encontrado o falta información.',
            errorVideoInfo: 'Error de información del vídeo', videoInfoUnavailable: 'Vídeo de YouTube (Información no disponible)', unknownChannel: 'Canal desconocido', unknown: 'Desconocido',
            fetchingTranscript: 'Obteniendo transcripción ({lang})...', transcriptNotFoundLang: "Transcripción no encontrada para el idioma '{lang}'. Pruebe otro idioma si está disponible.",
            subtitlesDisabled: 'Los subtítulos están desactivados para este vídeo.', serverError: 'Error del servidor', invalidTranscriptFormat: 'Formato de respuesta de transcripción inválido.',
            transcriptRetrieved: 'Transcripción recuperada...', errorTranscript: 'Error de transcripción', transcriptFailed: 'Fallo en la transcripción',
            generatingAISummary: 'Generando resumen IA...', summaryReceived: '¡Resumen recibido!', errorSummary: 'Error de resumen', summaryFailed: 'Fallo en el resumen',
            couldNotGenerateSummary: 'No se pudo generar el resumen.', summaryGenerationFailed: 'El servidor respondió pero no pudo generar un resumen para este vídeo.',
            error: 'Error', unknownTitle: 'Título desconocido',
            enterUrl: 'Por favor, introduce una URL de YouTube.', invalidUrl: 'URL de YouTube inválida o no reconocida.', validatingUrl: 'Validando URL...',
            summaryGeneratedSuccess: '¡Resumen generado con éxito!', limitedVideoInfo: 'Información de vídeo limitada recuperada.',
            noSummaryToCopy: 'No hay resumen para copiar.', summaryEmpty: 'El resumen está vacío.', summaryCopied: '¡Resumen copiado!', copyFailed: 'Falló la copia.', summaryCopiedFallback: '¡Resumen copiado (método alternativo)!',
            noSummaryToDownload: 'No hay resumen para descargar.', preparingPDF: 'Preparando PDF...', pdfLibraryError: 'Error al cargar la biblioteca PDF.', pdfDownloaded: '¡PDF descargado!', pdfCreationErrorText: 'Error al crear el PDF.',
            recalculatingSummary: 'Recalculando resumen...', summaryUpdated: 'Resumen actualizado', errorRecalculating: 'Error al recalcular.',
            linkPasted: '¡Enlace pegado!', clipboardEmpty: 'Portapapeles vacío.', pastePermissionError: 'Se necesita permiso para pegar.', pasteError: 'No se pudo pegar.',
            waitForCurrentSummary: 'Por favor, espere a que termine el resumen actual.',
            thumbnailAltPrefix: 'Miniatura del vídeo:', youtubeVideo: 'Vídeo de YouTube', titleUnavailable: 'Título no disponible',
            unknownDate: 'Fecha desconocida', invalidDate: 'Fecha inválida', noSummaryGenerated: 'No se generó ningún resumen.',
            channel: 'Canal', published: 'Publicado', duration: 'Duración', summaryGeneratedOn: 'Resumen generado el', language: 'Idioma', length: 'Longitud',
            page: 'Página', videoSummary: 'Resumen del Vídeo',
            pasteButtonDisabledTitle: "Funcionalidad no disponible (se requiere HTTPS)",
        }
    };
    
    // Helper to get translated text
    function getText(key, fallback) {
        const lang = languageSelect.value || 'en';
        return translations[lang]?.[key] || translations['en']?.[key] || fallback || key;
    }
    
    // Language change - Apply translations
    languageSelect.addEventListener('change', function() {
        const lang = languageSelect.value;
        applyTranslations(lang);
        
        // If a summary exists, regenerate it in the new language
        if (currentTranscription && videoData && !isLoading && !results.classList.contains('hidden')) {
            // Ensure we don't try to regenerate an error message
            if (!currentSummary || !currentSummary.includes('<p class="text-red-600">')) {
                console.log(`Language changed to ${lang}, regenerating summary.`);
                const activeLengthButton = document.querySelector('#results .btn-option.active') || document.querySelector(`.btn-option[data-length="${currentSummaryLength}"]`);
                if (activeLengthButton) {
                    handleLengthChange({ target: activeLengthButton });
                }
            } else {
                console.log(`Language changed to ${lang}, but previous result was an error. Not regenerating.`);
                // Optionally clear the error message? Or leave it?
                // summaryContent.innerHTML = ''; // Or update with a neutral message
            }
        } else if (isLoading){
            console.log(`Language changed to ${lang}, but summary regeneration deferred.`);
            updateLoadingState(getText('loadingDefault', 'Analyzing...'), parseInt(progressBar.style.width || '0'));
        }
    });
    
    function applyTranslations(lang) {
        document.documentElement.lang = lang; // Update html lang attribute
        
        // Helper function to safely update text content/HTML/attributes using getText
        const setText = (selector, key, fallback) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = getText(key, fallback || '');
            else console.warn(`Element not found for selector '${selector}' during translation`);
        };
        const setHTML = (selector, key, fallback, prefix = '', suffix = '') => {
            const element = document.querySelector(selector);
            if (element) element.innerHTML = `${prefix}${getText(key, fallback || '')}${suffix}`;
            else console.warn(`Element not found for selector '${selector}' during translation`);
        };
        const setAttr = (selector, attr, key, fallback) => {
            const element = document.querySelector(selector);
            if (element) element.setAttribute(attr, getText(key, fallback || ''));
            else console.warn(`Element not found for selector '${selector}' during translation`);
        };
        
        // --- Apply translations using helpers ---
        document.title = getText('title', "YouSummarize");
        setText('h1', 'h1', "YouTube Summary");
        setText('.max-w-3xl > p.text-subtle', 'heroP');
        setText('.max-w-3xl > p.font-semibold', 'heroBadge');
        setHTML('label[for="youtubeUrl"]', 'urlLabel', 'Paste your YouTube link here', '<i class="fas fa-link accent" aria-hidden="true"></i> ');
        setAttr('#youtubeUrl', 'placeholder', 'urlPlaceholder', 'https://www.youtube.com/watch?v=...');
        setText('#youtubeForm p.text-xs', 'urlHelp');
        setHTML('#summarizeBtn', 'submitBtn', 'Generate Summary', '<i class="fas fa-magic" aria-hidden="true"></i> ');
        setText('label[for="language"]', 'languageLabel', 'Language:');
        setText('.popular-examples h3', 'exampleTitle', 'Or try an example:');
        setText('#loadingText', 'loadingDefault', 'Analyzing...');
        setText('#loadingState p.text-xs', 'loadingFewSecs', 'This may take a few seconds.');
        setText('#results h2.font-serif', 'videoInfoTitle', 'Generated Summary');
        setHTML('#copyBtn', 'copyBtn', 'Copy', '<i class="far fa-copy" aria-hidden="true"></i> ');
        setHTML('#downloadBtn', 'downloadBtn', 'PDF', '<i class="fas fa-download" aria-hidden="true"></i> ');
        setText('.summary-length .text-xs', 'lengthLabel', 'Detail:');
        setText('.btn-option[data-length="short"]', 'lengthShort', 'Short');
        setText('.btn-option[data-length="medium"]', 'lengthMedium', 'Medium');
        setText('.btn-option[data-length="long"]', 'lengthLong', 'Detailed');
        
        setText('#how-and-why-title', 'howWhyTitle');
        setText('.feature-card:nth-of-type(1) h3', 'feature1Title');
        setText('.feature-card:nth-of-type(1) p', 'feature1Desc');
        setText('.feature-card:nth-of-type(2) h3', 'feature2Title');
        setText('.feature-card:nth-of-type(2) p', 'feature2Desc');
        setText('.feature-card:nth-of-type(3) h3', 'feature3Title');
        setText('.feature-card:nth-of-type(3) p', 'feature3Desc');
        
        setText('#faq-title', 'faqTitle');
        
        setText('#final-cta-title', 'ctaTitle');
        setText('.cta-container p.text-lg', 'ctaP');
        setText('.cta-actions a', 'ctaBtn');
        setText('.cta-container p.text-xs', 'ctaHelp');
        
        setText('.newsletter h3', 'newsletterTitle');
        setText('.newsletter-description', 'newsletterP');
        setAttr('.newsletter-input', 'placeholder', 'newsletterEmail');
        setText('.newsletter-button', 'newsletterBtn');
        
        const footerByLink = document.querySelector('footer a[href*="github.com/jp-fix"]');
        if (footerByLink && footerByLink.previousSibling && footerByLink.previousSibling.nodeType === Node.TEXT_NODE) {
            footerByLink.previousSibling.textContent = ` ${getText('footerBy', 'by')} `;
        }
        
        setText('footer .footer-links a:nth-of-type(1)', 'footerApi');
        setText('footer .footer-links a:nth-of-type(2)', 'footerPrivacy');
        setText('footer .footer-links a:nth-of-type(3)', 'footerTerms');
        setText('footer .footer-links a:nth-of-type(4)', 'footerContact');
        setText('footer .footer-links a:nth-of-type(5)', 'footerSitemap');
        
        // Update BuyMeACoffee message
        const bmcWidget = document.querySelector('.bmc-widget-container');
        if (bmcWidget && bmcWidget.dataset) {
            bmcWidget.dataset.message = getText('bmcMessage');
        }
        
        // Update paste button title if it was disabled
        if (pasteButton && pasteButton.disabled) {
            setAttr('#pasteButton', 'title', 'pasteButtonDisabledTitle', "Feature unavailable (HTTPS required)");
        }
    }
    
    
    // --- Initialisation ---
    
    function detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0];
        
        if (Array.from(languageSelect.options).some(option => option.value === langCode)) {
            languageSelect.value = langCode;
        } else {
            languageSelect.value = 'en';
        }
        // Apply translations based on detected or default language
        applyTranslations(languageSelect.value);
    }
    
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    
    detectBrowserLanguage();
    resetUI();
    
    console.log("YouSummarize App Initialized.");
    
}); // End DOMContentLoaded