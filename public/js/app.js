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
        // Flexible regex to catch video IDs from various URL patterns
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
        updateLoadingState('Récupération des infos vidéo...', 10);
        try {
            const response = await fetch(`${API_BASE_URL}/api/video-info?videoId=${videoId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
            }
            const data = await response.json();
            console.log("Video Info Raw:", data); // Debug log
            
            if (data.items && data.items.length > 0) {
                const snippet = data.items[0].snippet;
                const contentDetails = data.items[0].contentDetails;
                return {
                    id: videoId,
                    title: snippet.title,
                    channelTitle: snippet.channelTitle,
                    publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
                    description: snippet.description,
                    // Use standard or high quality thumbnail if available
                    thumbnail: snippet.thumbnails?.standard?.url || snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    duration: contentDetails?.duration ? convertDuration(contentDetails.duration) : 'Inconnue'
                };
            }
            throw new Error('Vidéo non trouvée ou informations manquantes.');
        } catch (error) {
            console.error('Erreur fetchVideoInfo:', error);
            showToast(`Erreur infos vidéo: ${error.message}`, 'error');
            // Provide a fallback object so the UI doesn't completely break
            return {
                id: videoId,
                title: 'Vidéo YouTube (Infos Indisponibles)',
                channelTitle: 'Chaîne inconnue',
                publishedAt: null,
                description: '',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: 'Inconnue'
            };
        }
    }
    
    /**
     * Converts ISO 8601 duration format (PTnHnMnS) to a readable string.
     * @param {string} duration - ISO 8601 duration string.
     * @returns {string} Readable duration (e.g., "1h 23m 45s").
     */
    function convertDuration(duration) {
        if (!duration || typeof duration !== 'string') return 'Inconnue';
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 'Inconnue';
        
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        
        let result = '';
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0 || hours > 0) result += `${String(minutes).padStart(hours > 0 ? 2 : 1, '0')}m `; // Pad minutes if hours exist
        result += `${String(seconds).padStart(2, '0')}s`; // Always show seconds, padded
        
        return result.trim() || "0s"; // Return "0s" if duration is zero
    }
    
    /**
     * Fetches the video transcript from the backend API.
     * @param {string} videoId - The YouTube video ID.
     * @param {string} [language='fr'] - The desired language code (e.g., 'fr', 'en').
     * @returns {Promise<string|null>} The transcript text or null on failure.
     */
    async function getTranscription(videoId, language = 'fr') {
        updateLoadingState(`Récupération de la transcription (${language})...`, 30);
        try {
            const response = await fetch(`${API_BASE_URL}/api/transcript?videoId=${videoId}&language=${language}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                // Provide more specific error messages
                if (response.status === 404) {
                    throw new Error(`Transcription non trouvée pour la langue '${language}'. Essayez une autre langue si disponible.`);
                } else if (response.status === 400 && errorData.error.includes('subtitles disabled')) {
                    throw new Error('Les sous-titres sont désactivés pour cette vidéo.');
                }
                throw new Error(errorData.error || `Erreur serveur (${response.status})`);
            }
            const data = await response.json();
            updateLoadingState('Transcription récupérée...', 70);
            if (data.transcript) {
                return data.transcript;
            } else {
                // This case might happen if the backend sends a 200 OK but with an error message
                throw new Error(data.error || 'Format de réponse de transcription invalide.');
            }
        } catch (error) {
            console.error('Erreur getTranscription:', error);
            showToast(`Erreur transcription: ${error.message}`, 'error');
            updateLoadingState('Échec transcription', 70); // Keep progress visually
            return null; // Indicate failure
        }
    }
    
    /**
     * Sends the transcript to the backend API for summarization.
     * @param {string} transcription - The video transcript text.
     * @param {object} videoInfo - Metadata object for context.
     * @param {string} lengthPreference - 'short', 'medium', or 'long'.
     * @returns {Promise<string|null>} The summarized text in HTML format or null on failure.
     */
    async function summarizeWithBackend(transcription, videoInfo, lengthPreference = 'medium') {
        updateLoadingState('Génération du résumé IA...', 85);
        const language = languageSelect.value;
        
        // Simple truncation (backend should ideally handle this more gracefully)
        const MAX_CHARS = 120000; // Increased limit slightly
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
                    videoInfo: { // Send relevant info
                        title: videoInfo?.title || 'Titre inconnu',
                        channelTitle: videoInfo?.channelTitle || 'Chaîne inconnue'
                        // Avoid sending dates or complex objects unless necessary
                    },
                    language: language,
                    lengthPreference: lengthPreference // Send length preference
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.error || `Erreur serveur (${response.status})`);
            }
            
            const data = await response.json();
            updateLoadingState('Résumé reçu !', 100);
            
            if (data.summary) {
                // Add truncation warning if applicable
                const warningPrefix = isTruncated
                    ? (language === 'fr'
                        ? "<p><strong>⚠️ Attention :</strong> La transcription était très longue et a été tronquée avant l'analyse. Le résumé peut être incomplet.</p><hr>"
                        : "<p><strong>⚠️ Warning:</strong> The transcript was very long and was truncated before analysis. The summary may be incomplete.</p><hr>")
                    : "";
                // Assume backend returns markdown, convert it
                return warningPrefix + markdownToHtml(data.summary);
            } else {
                throw new Error(data.error || 'Aucun résumé retourné par le serveur.');
            }
        } catch (error) {
            console.error('Erreur summarizeWithBackend:', error);
            showToast(`Erreur résumé: ${error.message}`, 'error');
            updateLoadingState('Échec résumé', 100);
            // Provide a fallback error message in HTML
            return `<p class="text-red-600"><strong>${language === 'fr' ? 'Erreur' : 'Error'}:</strong> ${language === 'fr' ? 'Impossible de générer le résumé.' : 'Could not generate summary.'} ${error.message}</p>`;
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
        html = html.replace(/^\s*([*-]) (.*?)($|\n(?!\s*[*-] ))/gim, (match, marker, item) => `<li>${item.trim()}</li>`);
        html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ul>${match.trim()}</ul>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ul>\s*\n?<ul>/g, ''); // Merge consecutive lists
        
        // Ordered Lists (1. item) - Improved handling
        html = html.replace(/^\s*\d+\. (.*?)($|\n(?!\s*\d+\. ))/gim, (match, item) => `<li>${item.trim()}</li>`);
        html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ol>${match.trim()}</ol>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ol>\s*\n?<ol>/g, ''); // Merge consecutive ordered lists
        
        
        // Paragraphs (treat remaining text blocks) - Split by double newline first
        html = html.split(/\n{2,}/).map(paragraph => {
            paragraph = paragraph.trim();
            if (!paragraph) return '';
            // Avoid wrapping existing block elements in <p>
            if (paragraph.match(/^<(?:ul|ol|li|h[1-6]|block|pre|hr|table|thead|tbody|tr|th|td)/i)) {
                return paragraph;
            }
            // Also avoid wrapping paragraphs that are just list items (already handled)
            if (paragraph.startsWith('<li>') && paragraph.endsWith('</li>')) {
                return paragraph; // Let list wrapping handle this
            }
            return `<p>${paragraph}</p>`;
        }).join('\n\n'); // Join with double newline to preserve separation
        
        // Inline Elements (applied within block elements now)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); // Links
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>'); // Inline Code
        
        // Line Breaks (convert single newlines within paragraphs/lists to <br>)
        html = html.replace(/<p>(.*?)<\/p>/gs, (match, content) => `<p>${content.replace(/\n/g, '<br>')}</p>`);
        html = html.replace(/<li>(.*?)<\/li>/gs, (match, content) => `<li>${content.replace(/\n/g, '<br>')}</li>`);
        // Add similar replacements for other block elements if needed (e.g., blockquotes)
        
        // Cleanup potential artifacts
        html = html.replace(/<br>\s*<\/(ul|ol|li|h[1-6]|blockquote|pre|p)>/g, '</$1>'); // Remove <br> before closing block tags
        html = html.replace(/<(ul|ol|li|h[1-6]|blockquote|pre|p)>\s*<br>/g, '<$1>'); // Remove <br> after opening block tags
        html = html.replace(/<p>\s*<\/p>/g, ''); // Remove empty paragraphs
        html = html.replace(/\n\n/g, '\n'); // Consolidate excessive newlines between blocks
        
        
        return html.trim();
    }
    
    /**
     * Displays a short-lived notification message (toast).
     * @param {string} message - The message to display.
     * @param {'info' | 'success' | 'error'} [type='info'] - The type of toast.
     */
    function showToast(message, type = 'info') {
        if (toastTimeout) clearTimeout(toastTimeout); // Clear previous timeout if any
        
        toastMessage.textContent = message;
        toast.className = 'fixed bottom-5 right-5 bg-main text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 text-sm opacity-0 translate-y-3 transition-all duration-300 ease-out z-50'; // Reset classes
        toastIcon.className = 'fas'; // Reset icon class
        
        switch (type) {
            case 'error':
                toast.classList.add('bg-red-600'); // Use Tailwind red for error
                toastIcon.classList.add('fa-exclamation-circle');
                break;
            case 'success':
                toast.classList.add('bg-green-600'); // Use Tailwind green for success
                toastIcon.classList.add('fa-check-circle');
                break;
            default: // 'info'
                toast.classList.add('bg-blue-600'); // Use Tailwind blue for info
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
            // Optional: Reset classes after hiding animation completes
            // setTimeout(() => { toast.className = '... initial hidden classes ...'; }, 300);
        }, 3000);
    }
    
    /**
     * Updates the loading indicator text and progress bar.
     * @param {string} text - The status text to display.
     * @param {number} percent - The progress percentage (0-100).
     */
    function updateLoadingState(text, percent) {
        if (loadingState.classList.contains('hidden')) return; // Don't update if not visible
        loadingText.textContent = text;
        progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    
    /**
     * Formats a date object or string into a localized string.
     * @param {Date|string|null} dateInput - The date to format.
     * @returns {string} Formatted date string or a fallback.
     */
    function formatDate(dateInput) {
        if (!dateInput) return 'Date inconnue';
        try {
            const date = new Date(dateInput);
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return 'Date invalide';
            }
            const lang = languageSelect.value === 'fr' ? 'fr-FR' : 'en-US';
            return date.toLocaleDateString(lang, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            console.error("Error formatting date:", dateInput, e);
            return 'Date invalide';
        }
    }
    
    /**
     * Updates the UI with fetched video information.
     * @param {object} data - The video data object from fetchVideoInfo.
     */
    function displayVideoInfo(data) {
        videoData = data; // Store globally for later use (e.g., download)
        if (!data || !data.id) {
            videoInfo.classList.add('hidden');
            return;
        }
        videoThumbnail.src = data.thumbnail || `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`; // Fallback thumb
        videoThumbnail.alt = `Miniature de la vidéo: ${data.title || 'Vidéo YouTube'}`;
        videoTitle.textContent = data.title || 'Titre indisponible';
        channelTitle.textContent = data.channelTitle || 'Chaîne inconnue';
        publishedDate.textContent = formatDate(data.publishedAt);
        videoDuration.textContent = data.duration || 'Inconnue';
        videoLink.href = `https://www.youtube.com/watch?v=${data.id}`;
        videoInfo.classList.remove('hidden'); // Show the info card
    }
    
    /**
     * Displays the generated summary in the results area.
     * @param {string} summaryHtml - The summary content (HTML).
     */
    function displaySummary(summaryHtml) {
        currentSummary = summaryHtml; // Store for copy/download
        summaryContent.innerHTML = summaryHtml || `<p>${languageSelect.value === 'fr' ? 'Aucun résumé généré.' : 'No summary generated.'}</p>`;
        results.classList.remove('hidden'); // Show results card
        // Scroll to results smoothly
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
        // updateProgressBar(0); // <<-- ERROR WAS HERE
        progressBar.style.width = '0%'; // <<-- FIX: Directly reset progress bar style
        summaryContent.innerHTML = '';
        videoThumbnail.src = ''; // Clear previous thumbnail
        // Do NOT clear the youtubeUrl input field automatically
        currentVideoId = null;
        videoData = null;
        currentTranscription = null;
        currentSummary = null;
        currentSummaryLength = 'medium'; // Reset length state
        
        // Reset active state on length buttons (optional but good practice)
        summaryLengthButtons.forEach((btn) => {
            btn.classList.remove('active', 'bg-[#E9E5D8]', 'text-main', 'font-medium');
            btn.classList.add('bg-white', 'text-subtle');
            if (btn.dataset.length === 'medium') { // Reset to medium visually
                btn.classList.add('active', 'bg-[#E9E5D8]', 'text-main', 'font-medium');
                btn.classList.remove('bg-white', 'text-subtle');
            }
        });
    }
    
    /**
     * Handles the main form submission process.
     * @param {Event} e - The form submission event.
     */
    async function handleSubmit(e) {
        e.preventDefault(); // Prevent default form submission
        if (isLoading) return; // Prevent concurrent requests
        
        const url = youtubeUrl.value.trim();
        if (!url) {
            showToast(languageSelect.value === 'fr' ? 'Veuillez entrer une URL YouTube.' : 'Please enter a YouTube URL.', 'error');
            youtubeUrl.focus();
            return;
        }
        
        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            showToast(languageSelect.value === 'fr' ? 'URL YouTube invalide ou non reconnue.' : 'Invalid or unrecognized YouTube URL.', 'error');
            youtubeUrl.focus();
            return;
        }
        
        // Start loading state
        isLoading = true;
        resetUI(); // Clear previous results before starting
        loadingState.classList.remove('hidden');
        summarizeBtn.disabled = true;
        updateLoadingState(languageSelect.value === 'fr' ? 'Validation de l\'URL...' : 'Validating URL...', 5);
        currentVideoId = videoId; // Store the ID
        
        try {
            // 1. Fetch Video Info
            const fetchedVideoData = await fetchVideoInfo(videoId);
            if (!fetchedVideoData || fetchedVideoData.title.includes('Infos Indisponibles')) { // Check if fallback was used meaningfully or real error occurred
                // If fetchVideoInfo returns the fallback object, display it but warn
                if(fetchedVideoData && fetchedVideoData.title.includes('Infos Indisponibles')){
                    displayVideoInfo(fetchedVideoData); // Display minimal info
                    showToast(languageSelect.value === 'fr' ? 'Infos vidéo limitées récupérées.' : 'Limited video info retrieved.', 'info');
                } else {
                    // If fetchVideoInfo truly failed (e.g., network error before returning fallback)
                    throw new Error(languageSelect.value === 'fr' ? 'Impossible de récupérer les informations de base de la vidéo.' : 'Could not retrieve basic video information.');
                }
            } else {
                displayVideoInfo(fetchedVideoData); // Display full info
            }
            
            
            // 2. Get Transcription
            currentTranscription = await getTranscription(videoId, languageSelect.value);
            if (!currentTranscription) {
                // Error handled within getTranscription (toast shown)
                throw new Error('SKIP_TO_FINALLY'); // Use a specific signal to stop processing but enable button
            }
            
            // 3. Generate Summary (using current length preference)
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            if (!summaryHtml || summaryHtml.includes('Impossible de générer le résumé')) {
                // Error handled within summarizeWithBackend (toast shown), display the error message itself
                displaySummary(summaryHtml || `<p class="text-red-600">${languageSelect.value === 'fr' ? 'Erreur lors de la génération du résumé.' : 'Error generating summary.'}</p>`);
                throw new Error('SKIP_TO_FINALLY'); // Stop further success messages but keep UI enabled
            }
            
            // 4. Display Summary
            displaySummary(summaryHtml);
            showToast(languageSelect.value === 'fr' ? 'Résumé généré avec succès !' : 'Summary generated successfully!', 'success');
            
        } catch (error) {
            if (error.message !== 'SKIP_TO_FINALLY') {
                console.error('Erreur dans le processus handleSubmit:', error);
                // Don't show generic toast if specific ones were likely shown already by sub-functions
                if (!error.message.includes('transcription:') && !error.message.includes('résumé:') && !error.message.includes('infos vidéo:')) {
                    showToast(languageSelect.value === 'fr' ? `Erreur: ${error.message}` : `Error: ${error.message}`, 'error');
                }
                // Optionally reset more aggressively on critical errors, but resetUI was already called at start
                // resetUI();
            }
        } finally {
            // 5. End Loading State (always run)
            loadingState.classList.add('hidden');
            summarizeBtn.disabled = false;
            isLoading = false;
            // updateProgressBar(0); // <<-- ERROR WAS HERE
            progressBar.style.width = '0%'; // <<-- FIX: Reset progress bar style
        }
    }
    
    /**
     * Copies the plain text version of the summary to the clipboard.
     */
    function copySummary() {
        if (!summaryContent || !currentSummary) {
            showToast(languageSelect.value === 'fr' ? 'Aucun résumé à copier.' : 'No summary to copy.', 'error');
            return;
        }
        
        // Get plain text from the summary HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentSummary;
        // Replace <br> with newlines, handle paragraphs, lists etc. for better text structure
        tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        tempDiv.querySelectorAll('p, h1, h2, h3, h4, li, blockquote').forEach(el => {
            // Add newline *before* list items and headers for better spacing
            if(el.tagName === 'LI' || el.tagName.startsWith('H') || el.tagName === 'BLOCKQUOTE') {
                el.before('\n');
            }
            el.append('\n'); // Add newline after block elements
        });
        tempDiv.querySelectorAll('hr').forEach(hr => hr.replaceWith('\n---\n')); // Represent HR
        
        let textToCopy = tempDiv.textContent || tempDiv.innerText || ''; // Get text content
        textToCopy = textToCopy.replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
        
        if (!textToCopy.trim()) {
            showToast(languageSelect.value === 'fr' ? 'Le résumé est vide.' : 'Summary is empty.', 'error');
            return;
        }
        
        // Use Clipboard API for better security and user experience
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                showToast(languageSelect.value === 'fr' ? 'Résumé copié !' : 'Summary copied!', 'success');
            }).catch(err => {
                console.error('Erreur copie Clipboard API:', err);
                showToast(languageSelect.value === 'fr' ? 'Échec de la copie.' : 'Copy failed.', 'error');
                // Fallback to execCommand if needed (less reliable)
                copyWithExecCommand(textToCopy.trim());
            });
        } else {
            // Fallback for older browsers or non-HTTPS
            copyWithExecCommand(textToCopy.trim());
        }
    }
    
    /**
     * Fallback method to copy text using document.execCommand.
     * @param {string} text - The text to copy.
     */
    function copyWithExecCommand(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed'; // Prevent scrolling to bottom
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showToast(languageSelect.value === 'fr' ? 'Résumé copié (méthode alternative) !' : 'Summary copied (fallback method)!', 'success');
            } else {
                throw new Error('document.execCommand failed');
            }
        } catch (err) {
            console.error('Erreur copie execCommand:', err);
            showToast(languageSelect.value === 'fr' ? 'Échec de la copie.' : 'Copy failed.', 'error');
        }
        document.body.removeChild(textArea);
    }
    
    
    /**
     * Generates and downloads the summary as a PDF document.
     * Dynamically loads jsPDF if not already available.
     */
    function downloadSummary() {
        if (!currentSummary || !videoData) {
            showToast(languageSelect.value === 'fr' ? 'Aucun résumé à télécharger.' : 'No summary to download.', 'error');
            return;
        }
        
        const jspdfSrc = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                // Check if already loaded
                if (typeof window.jspdf !== 'undefined') {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        showToast(languageSelect.value === 'fr' ? 'Préparation du PDF...' : 'Preparing PDF...');
        
        loadScript(jspdfSrc)
            .then(() => {
                generatePDF(); // Call the PDF generation function
            })
            .catch(err => {
                console.error("Erreur chargement librairie PDF:", err);
                showToast(languageSelect.value === 'fr' ? 'Erreur chargement dépendance PDF.' : 'Error loading PDF library.', 'error');
            });
        
        
        function generatePDF() {
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
                const margin = 15; // Page margin
                const maxLineWidth = pageWidth - margin * 2;
                let currentY = margin; // Start Y position
                
                // --- Add Custom Font (Optional - improves character support) ---
                // Example using a Google Font URL (replace with actual font files if self-hosting)
                // Note: jsPDF needs the font file itself, not just CSS. This requires more setup
                // typically involving font files (ttf) and jsPDF's addFont() method.
                // For simplicity, we'll stick to standard fonts. Consider using standard 'Helvetica', 'Times', 'Courier'.
                // doc.setFont('Helvetica'); // Example: Set a standard font
                
                
                // --- PDF Content ---
                
                // 1. Video Title (allow multiple lines)
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                const titleLines = doc.splitTextToSize(videoData.title || 'Résumé Vidéo', maxLineWidth);
                doc.text(titleLines, margin, currentY);
                currentY += (titleLines.length * 7) + 5; // Adjust spacing based on lines
                
                // 2. Metadata
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100); // Subtle grey for metadata
                
                const metadata = [
                    `URL: https://www.youtube.com/watch?v=${currentVideoId}`,
                    `Chaîne: ${videoData.channelTitle || 'Inconnue'}`,
                    `Publié: ${formatDate(videoData.publishedAt)}`,
                    `Durée: ${videoData.duration || 'Inconnue'}`,
                    `Résumé généré le: ${formatDate(new Date())} (Langue: ${languageSelect.value}, Longueur: currentSummaryLength)`
                ];
                
                metadata.forEach(line => {
                    if (currentY > pageHeight - margin) { // Check for page break BEFORE adding text
                        doc.addPage();
                        currentY = margin;
                    }
                    // Handle potential long lines in metadata
                    const metaLines = doc.splitTextToSize(line, maxLineWidth);
                    doc.text(metaLines, margin, currentY);
                    currentY += (metaLines.length * 4); // Increment Y based on number of lines * font size factor
                });
                
                currentY += 5; // Extra space before summary
                
                // 3. Summary Content (Process HTML for basic formatting)
                doc.setTextColor(0); // Reset to black text
                
                const summaryContainer = document.createElement('div');
                summaryContainer.innerHTML = currentSummary; // Parse the HTML
                
                function addContentToPdf(element, currentIndent = 0) {
                    // Recursive function to handle nested elements (basic list/blockquote nesting)
                    
                    // Check for page break BEFORE adding text
                    const neededSpace = 10; // Estimate space needed for potential text line
                    if (currentY > pageHeight - margin - neededSpace) { // Leave some bottom margin
                        doc.addPage();
                        currentY = margin;
                        doc.setFontSize(11); // Reset font size after page break
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0);
                    }
                    
                    let textContent = (element.textContent || element.innerText || '').trim();
                    let isBold = false;
                    let isItalic = false; // jsPDF standard fonts might not support both bold+italic well
                    let fontSize = 11;
                    let textStyle = 'normal'; // 'normal', 'bold', 'italic', 'bolditalic'
                    let elementMargin = 0; // Space before element
                    let listPrefix = '';
                    let currentX = margin + currentIndent;
                    let elementColor = 0; // Default black
                    
                    // Apply styles based on tag name
                    switch (element.tagName) {
                        case 'H1': fontSize = 14; textStyle = 'bold'; elementMargin = 4; break;
                        case 'H2': fontSize = 13; textStyle = 'bold'; elementMargin = 3; break;
                        case 'H3': fontSize = 12; textStyle = 'bold'; elementMargin = 2; break;
                        case 'STRONG': case 'B': textStyle = 'bold'; break; // Apply bold style
                        case 'EM': case 'I': textStyle = 'italic'; break; // Apply italic style
                        case 'P': elementMargin = 2; break; // Add space before paragraphs
                        case 'LI':
                            listPrefix = '• '; // Use bullet for lists
                            elementMargin = 1; // Smaller space for list items
                            break;
                        case 'BLOCKQUOTE':
                            currentIndent += 5; // Indent blockquotes
                            currentX = margin + currentIndent;
                            elementColor = 100; // Grey text for quote
                            elementMargin = 2;
                            break;
                        case 'HR':
                            if (currentY + 4 > pageHeight - margin) { doc.addPage(); currentY = margin; } // Page break for HR
                            doc.setDrawColor(150);
                            doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
                            currentY += 4;
                            return; // Don't process text for HR
                        case 'A':
                            // Links: Add URL in parentheses or handle differently if needed
                            textContent = `${textContent} (${element.href})`;
                            elementColor = [0, 0, 255]; // Blue for links
                            break;
                        case 'CODE':
                            // Basic code styling: Monospace font, maybe background?
                            doc.setFont('Courier', 'normal'); // Use a monospace font
                            fontSize = 10;
                            // Background for inline code is hard without complex coordinates
                            break;
                        case 'PRE':
                            // Preformatted text / Code blocks
                            if (currentY + 10 > pageHeight - margin) { doc.addPage(); currentY = margin; } // Ensure space
                            doc.setFont('Courier', 'normal');
                            fontSize = 9;
                            doc.setFillColor(240, 240, 240); // Light grey background
                            // Calculate background dimensions (approximate)
                            const preLines = doc.splitTextToSize(textContent, maxLineWidth - currentIndent);
                            const preHeight = preLines.length * (fontSize * 0.35) + 2;
                            doc.rect(currentX, currentY, maxLineWidth - currentIndent, preHeight, 'F');
                            doc.setTextColor(0);
                            doc.text(preLines, currentX + 1, currentY + fontSize * 0.35); // Add slight padding
                            currentY += preHeight + 3;
                            doc.setFont('Helvetica', 'normal'); // Reset font
                            return; // Handled preformatted text
                        // Add cases for UL, OL if specific styling is needed beyond LI handling
                    }
                    
                    currentY += elementMargin; // Add space before element
                    
                    // Handle elements with potential nested styling (strong/em within p/li)
                    // This is complex with jsPDF's text(). A simpler approach is to process node children.
                    
                    // If element has children, process them recursively
                    if (element.childNodes && element.childNodes.length > 0 && element.tagName !== 'PRE') {
                        element.childNodes.forEach(child => {
                            if (child.nodeType === Node.ELEMENT_NODE) {
                                // Recursive call for element nodes
                                addContentToPdf(child, currentIndent + (element.tagName === 'BLOCKQUOTE' ? 5 : 0)); // Pass indent
                            } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                                // Process text nodes directly if they contain text
                                const nodeText = child.textContent.trim();
                                if (!nodeText) return;
                                
                                if (currentY > pageHeight - margin - 5) { doc.addPage(); currentY = margin; } // Check page break for text
                                
                                doc.setFontSize(fontSize);
                                doc.setFont(undefined, textStyle); // Apply parent style for now
                                doc.setTextColor(elementColor);
                                
                                // Apply list prefix if inside LI (check parent or context)
                                let effectivePrefix = '';
                                if (element.tagName === 'LI' || element.closest('li')) {
                                    effectivePrefix = listPrefix;
                                }
                                
                                const lines = doc.splitTextToSize(effectivePrefix + nodeText, maxLineWidth - currentIndent - (effectivePrefix ? 3 : 0));
                                doc.text(lines, currentX + (effectivePrefix ? 3 : 0), currentY);
                                currentY += lines.length * (fontSize * 0.35) + 1; // Adjust spacing based on lines
                                
                                // Reset potential temporary styles like color/font
                                doc.setTextColor(0);
                                doc.setFont('Helvetica', 'normal');
                            }
                        });
                    } else if (textContent && element.tagName !== 'PRE') {
                        // Handle simple elements with only text content
                        if (currentY > pageHeight - margin - 5) { doc.addPage(); currentY = margin; } // Check page break
                        
                        doc.setFontSize(fontSize);
                        doc.setFont(undefined, textStyle);
                        doc.setTextColor(elementColor);
                        
                        const lines = doc.splitTextToSize(listPrefix + textContent, maxLineWidth - currentIndent - (listPrefix ? 3 : 0));
                        doc.text(lines, currentX + (listPrefix ? 3 : 0), currentY);
                        currentY += lines.length * (fontSize * 0.35) + 1; // Adjust spacing based on lines
                        
                        // Reset potential temporary styles like color/font
                        doc.setTextColor(0);
                        doc.setFont('Helvetica', 'normal');
                    }
                    
                    // Reset indent if it was specific to this element (e.g., blockquote)
                    // currentIndent management needs refinement for deeper nesting
                }
                
                // Iterate through direct children of the summary container
                summaryContainer.childNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) { // Process only element nodes
                        addContentToPdf(node, 0); // Start with 0 indent
                    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        // Handle top-level text nodes if any (wrap in a pseudo-element for processing)
                        addContentToPdf({ tagName: 'P', textContent: node.textContent }, 0);
                    }
                });
                
                
                // 4. Footer (Page Numbers)
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(9);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} / ${pageCount} - YouSummarize`, pageWidth / 2, pageHeight - margin / 2, { align: 'center' });
                }
                
                // 5. Save
                const safeTitle = (videoData.title || 'youtube-summary').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 40);
                doc.save(`YouSummarize_${safeTitle}.pdf`);
                showToast(languageSelect.value === 'fr' ? 'PDF téléchargé !' : 'PDF Downloaded!', 'success');
                
            } catch (pdfError) {
                console.error("Erreur génération PDF:", pdfError);
                showToast(languageSelect.value === 'fr' ? 'Erreur lors de la création du PDF.' : 'Error creating PDF.', 'error');
            }
        }
    }
    
    /**
     * Handles clicks on the summary length buttons.
     * @param {Event} e - The click event.
     */
    async function handleLengthChange(e) {
        if (isLoading || !currentTranscription || !videoData) {
            // Don't regenerate if not ready or already loading
            // Visually re-select the currently active button if click is ignored
            summaryLengthButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.length === currentSummaryLength);
                btn.classList.toggle('bg-[#E9E5D8]', btn.dataset.length === currentSummaryLength);
                btn.classList.toggle('text-main', btn.dataset.length === currentSummaryLength);
                btn.classList.toggle('font-medium', btn.dataset.length === currentSummaryLength);
                btn.classList.toggle('bg-white', btn.dataset.length !== currentSummaryLength);
                btn.classList.toggle('text-subtle', btn.dataset.length !== currentSummaryLength);
            });
            return;
        }
        
        const newLength = e.target.dataset.length;
        if (!newLength || newLength === currentSummaryLength) return; // No change or invalid target
        
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
        
        // Regenerate summary with new length preference
        isLoading = true; // Set loading flag
        results.classList.add('opacity-50', 'pointer-events-none'); // Dim results while loading
        summaryContent.innerHTML = `<p class="flex items-center justify-center gap-2"><span class="loading-spinner !w-5 !h-5 !border-2"></span> ${languageSelect.value === 'fr' ? 'Recalcul du résumé...' : 'Recalculating summary...'}</p>`;
        
        try {
            // Pass the *original* transcription, not the potentially truncated one used initially
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            if (!summaryHtml || summaryHtml.includes('Impossible de générer le résumé')) {
                // Error handled inside, display the error message returned
                displaySummary(summaryHtml || `<p class="text-red-600">${languageSelect.value === 'fr' ? 'Erreur lors du recalcul.' : 'Error recalculating.'}</p>`);
            } else {
                displaySummary(summaryHtml); // Display the new summary
                showToast(`${languageSelect.value === 'fr' ? 'Résumé mis à jour' : 'Summary updated'} (${languageSelect.value === 'fr' ? (translations.fr[`length${capitalize(currentSummaryLength)}`] || currentSummaryLength) : (translations.en[`length${capitalize(currentSummaryLength)}`] || currentSummaryLength)})`, 'success'); // Show translated length name
            }
            
        } catch (error) {
            // Should be caught inside summarizeWithBackend, but just in case
            console.error("Erreur recalcul résumé:", error);
            showToast(languageSelect.value === 'fr' ? 'Erreur recalcul.' : 'Error recalculating.', 'error');
            // Optionally restore previous summary? For now, the error message stays.
            // displaySummary(currentSummary);
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
                        youtubeUrl.focus(); // Focus the input after pasting
                        // Optionally trigger validation or clear previous results slightly later
                        showToast(languageSelect.value === 'fr' ? 'Lien collé !' : 'Link pasted!', 'success');
                        // Maybe auto-submit if the user prefers?
                        // handleSubmit(new Event('submit', { cancelable: true, bubbles: true }));
                    } else {
                        showToast(languageSelect.value === 'fr' ? 'Presse-papiers vide.' : 'Clipboard is empty.', 'info');
                    }
                })
                .catch(err => {
                    console.error('Erreur lecture presse-papiers : ', err);
                    // Provide more context about permissions if possible
                    if (err.name === 'NotAllowedError') {
                        showToast(languageSelect.value === 'fr' ? 'Autorisation requise pour coller.' : 'Permission needed to paste.', 'error');
                    } else {
                        showToast(languageSelect.value === 'fr' ? 'Impossible de coller.' : 'Could not paste.', 'error');
                    }
                });
        });
    } else if (pasteButton) {
        // Hide or disable the button if Clipboard API is not available (e.g., non-HTTPS)
        console.warn("API Clipboard non disponible (HTTPS requis?). Bouton Coller désactivé.");
        pasteButton.disabled = true;
        pasteButton.style.opacity = '0.5';
        pasteButton.title = languageSelect.value === 'fr' ? "Fonctionnalité non disponible (HTTPS requis)" : "Feature unavailable (HTTPS required)";
    }
    
    // Listeners for Example Links
    exampleLinks.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent potential default behavior if it's an <a> tag
            const url = e.currentTarget.dataset.url;
            if (url && !isLoading) { // Only process if not already loading
                youtubeUrl.value = url;
                // Automatically submit the form when an example is clicked
                // Create a synthetic event that bubbles and is cancelable
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                youtubeForm.dispatchEvent(submitEvent);
                // Scroll to top smoothly to see loading indicator/results area
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (isLoading) {
                showToast(languageSelect.value === 'fr' ? 'Veuillez attendre la fin du résumé actuel.' : 'Please wait for the current summary to finish.', 'info');
            }
        });
    });
    
    // Listeners for Summary Length Buttons
    summaryLengthButtons.forEach(button => {
        button.addEventListener('click', handleLengthChange);
    });
    
    // Store translations globally after definition
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
            videoInfoTitle: "Résumé Généré", // Title above the summary itself
            copyBtn: "Copier",
            downloadBtn: "PDF",
            lengthLabel: "Précision:",
            lengthShort: "Court",
            lengthMedium: "Moyen",
            lengthLong: "Détaillé",
            howWhyTitle: "Simple, Rapide, Efficace",
            feature1Title: "Collez & Gagnez du Temps",
            feature1Desc: "Entrez l'URL YouTube. Obtenez l'essentiel en quelques secondes, pas en heures.",
            feature2Title: "Analyse IA & Idées Clés",
            feature2Desc: "L'IA extrait les points importants. Comprenez les concepts clés facilement.",
            feature3Title: "Résumé & Partage Facile",
            feature3Desc: "Recevez un texte structuré. Copiez ou téléchargez pour partager vos trouvailles.",
            faqTitle: "Questions Fréquentes",
            ctaTitle: "Prêt à accélérer votre veille ?",
            ctaP: "Arrêtez de perdre du temps. Collez votre premier lien YouTube maintenant.",
            ctaBtn: "Essayer YouSummarize (Gratuit)",
            ctaHelp: "Aucune inscription requise",
            newsletterTitle: "Restez informé",
            newsletterP: "Nouveautés et astuces occasionnelles.",
            newsletterEmail: "votre.email@exemple.com",
            newsletterBtn: "S'abonner",
            footerBy: "par",
            footerApi: "Documentation API",
            footerPrivacy: "Confidentialité",
            footerTerms: "Conditions",
            footerContact: "Contact",
            footerSitemap: "Plan du site",
            bmcMessage: "Merci pour votre soutien ! Gardons ce service gratuit !"
            
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
            feature1Title: "Paste & Save Time",
            feature1Desc: "Enter the YouTube URL. Get the gist in seconds, not hours.",
            feature2Title: "AI Analysis & Key Insights",
            feature2Desc: "AI extracts the important points. Understand key concepts easily.",
            feature3Title: "Summary & Easy Sharing",
            feature3Desc: "Receive structured text. Copy or download to share your findings.",
            faqTitle: "Frequently Asked Questions",
            ctaTitle: "Ready to speed up your learning?",
            ctaP: "Stop wasting time. Paste your first YouTube link now.",
            ctaBtn: "Try YouSummarize (Free)",
            ctaHelp: "No sign-up required",
            newsletterTitle: "Stay Informed",
            newsletterP: "Occasional updates and tips.",
            newsletterEmail: "your.email@example.com",
            newsletterBtn: "Subscribe",
            footerBy: "by",
            footerApi: "API Docs",
            footerPrivacy: "Privacy",
            footerTerms: "Terms",
            footerContact: "Contact",
            footerSitemap: "Sitemap",
            bmcMessage: "Thanks for your support! Let's keep this service free!"
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
            feature1Title: "Pega y Ahorra Tiempo",
            feature1Desc: "Introduce la URL de YouTube. Obtén lo esencial en segundos, no en horas.",
            feature2Title: "Análisis IA e Ideas Clave",
            feature2Desc: "La IA extrae los puntos importantes. Entiende los conceptos clave fácilmente.",
            feature3Title: "Resumen y Fácil Compartir",
            feature3Desc: "Recibe texto estructurado. Copia o descarga para compartir tus hallazgos.",
            faqTitle: "Preguntas Frecuentes",
            ctaTitle: "¿Listo para acelerar tu aprendizaje?",
            ctaP: "Deja de perder tiempo. Pega tu primer enlace de YouTube ahora.",
            ctaBtn: "Probar YouSummarize (Gratis)",
            ctaHelp: "No requiere registro",
            newsletterTitle: "Mantente Informado",
            newsletterP: "Novedades y consejos ocasionales.",
            newsletterEmail: "tu.email@ejemplo.com",
            newsletterBtn: "Suscribirse",
            footerBy: "por",
            footerApi: "Documentación API",
            footerPrivacy: "Privacidad",
            footerTerms: "Términos",
            footerContact: "Contacto",
            footerSitemap: "Mapa del sitio",
            bmcMessage: "¡Gracias por tu apoyo! ¡Mantengamos este servicio gratuito!"
        }
    };
    
    // Language change - Apply translations
    languageSelect.addEventListener('change', function() {
        const lang = languageSelect.value;
        applyTranslations(lang);
        
        // If a summary exists, regenerate it in the new language
        // Check if results area is visible and we are not currently loading/recalculating
        if (currentTranscription && videoData && !isLoading && !results.classList.contains('hidden')) {
            console.log(`Language changed to ${lang}, regenerating summary.`);
            // Find the currently active button to trigger handleLengthChange correctly
            const activeLengthButton = document.querySelector('#results .btn-option.active') || document.querySelector(`.btn-option[data-length="${currentSummaryLength}"]`);
            if (activeLengthButton) {
                // Trigger handleLengthChange as if the current length button was clicked again
                handleLengthChange({ target: activeLengthButton });
            } else {
                console.warn("Could not find active length button to trigger regeneration.");
            }
        } else if (isLoading){
            console.log(`Language changed to ${lang}, but summary regeneration deferred until current process finishes.`);
            // Optionally update loading text if needed:
            updateLoadingState(translations[lang]?.loadingDefault || translations['en'].loadingDefault, parseInt(progressBar.style.width || '0'));
        }
    });
    
    function applyTranslations(lang) {
        const t = translations[lang] || translations['en']; // Fallback to English
        document.documentElement.lang = lang; // Update html lang attribute
        
        // Helper function to safely update text content
        const setText = (selector, key) => {
            const element = document.querySelector(selector);
            if (element && t[key]) element.textContent = t[key];
            else if (element && !t[key]) console.warn(`Missing translation key '${key}' for selector '${selector}' in lang '${lang}'`);
            else if (!element) console.warn(`Element not found for selector '${selector}' during translation`);
        };
        // Helper function to safely update inner HTML
        const setHTML = (selector, key, prefix = '', suffix = '') => {
            const element = document.querySelector(selector);
            if (element && t[key]) element.innerHTML = `${prefix}${t[key]}${suffix}`;
            else if (element && !t[key]) console.warn(`Missing translation key '${key}' for selector '${selector}' in lang '${lang}'`);
            else if (!element) console.warn(`Element not found for selector '${selector}' during translation`);
        };
        // Helper function to safely update attributes
        const setAttr = (selector, attr, key) => {
            const element = document.querySelector(selector);
            if (element && t[key]) element.setAttribute(attr, t[key]);
            else if (element && !t[key]) console.warn(`Missing translation key '${key}' for attribute '${attr}' on selector '${selector}' in lang '${lang}'`);
            else if (!element) console.warn(`Element not found for selector '${selector}' during translation`);
        };
        
        // --- Apply translations using helpers ---
        document.title = t.title;
        setText('h1', 'h1');
        setText('.max-w-3xl > p.text-subtle', 'heroP'); // Hero P
        setText('.max-w-3xl > p.font-semibold', 'heroBadge'); // Hero Badge
        setHTML('label[for="youtubeUrl"]', 'urlLabel', '<i class="fas fa-link accent" aria-hidden="true"></i> ');
        setAttr('#youtubeUrl', 'placeholder', 'urlPlaceholder');
        setText('#youtubeForm p.text-xs', 'urlHelp');
        setHTML('#summarizeBtn', 'submitBtn', '<i class="fas fa-magic" aria-hidden="true"></i> ');
        setText('label[for="language"]', 'languageLabel');
        setText('.popular-examples h3', 'exampleTitle');
        setText('#loadingText', 'loadingDefault'); // Update default loading text
        setText('#loadingState p.text-xs', 'loadingFewSecs');
        setText('#results h2.font-serif', 'videoInfoTitle');
        setHTML('#copyBtn', 'copyBtn', '<i class="far fa-copy" aria-hidden="true"></i> ');
        setHTML('#downloadBtn', 'downloadBtn', '<i class="fas fa-download" aria-hidden="true"></i> ');
        setText('.summary-length .text-xs', 'lengthLabel');
        setText('.btn-option[data-length="short"]', 'lengthShort');
        setText('.btn-option[data-length="medium"]', 'lengthMedium');
        setText('.btn-option[data-length="long"]', 'lengthLong');
        
        setText('#how-and-why-title', 'howWhyTitle');
        const features = document.querySelectorAll('.feature-card');
        if(features.length >= 3) {
            setText('.feature-card:nth-of-type(1) h3', 'feature1Title');
            setText('.feature-card:nth-of-type(1) p', 'feature1Desc');
            setText('.feature-card:nth-of-type(2) h3', 'feature2Title');
            setText('.feature-card:nth-of-type(2) p', 'feature2Desc');
            setText('.feature-card:nth-of-type(3) h3', 'feature3Title');
            setText('.feature-card:nth-of-type(3) p', 'feature3Desc');
        }
        
        setText('#faq-title', 'faqTitle');
        // Update FAQ text if needed (requires IDs or more specific selectors for Q&A pairs)
        
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
            footerByLink.previousSibling.textContent = ` ${t.footerBy} `; // Update 'par'/'by' text node
        }
        
        // Update footer links by their assumed order or more specific selectors/IDs
        setText('footer .footer-links a:nth-of-type(1)', 'footerApi');
        setText('footer .footer-links a:nth-of-type(2)', 'footerPrivacy');
        setText('footer .footer-links a:nth-of-type(3)', 'footerTerms');
        setText('footer .footer-links a:nth-of-type(4)', 'footerContact');
        setText('footer .footer-links a:nth-of-type(5)', 'footerSitemap');
        
        // Update BuyMeACoffee message if widget is present and uses data-message
        const bmcWidget = document.querySelector('.bmc-widget-container');
        if (bmcWidget && bmcWidget.dataset && t.bmcMessage) {
            bmcWidget.dataset.message = t.bmcMessage;
            // Note: The widget might need reinitialization for the message to update visually
            // if it's already rendered. This simple update might not work reliably without widget API.
        }
        
        // Update paste button title if it was disabled
        if (pasteButton && pasteButton.disabled) {
            pasteButton.title = t.pasteButtonDisabledTitle || "Feature unavailable (HTTPS required)";
        }
    }
    
    
    // --- Initialisation ---
    
    // Auto-detect browser language and set default
    function detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0]; // Get 'fr' from 'fr-FR'
        
        // Check if the detected language is available in the select options
        if (Array.from(languageSelect.options).some(option => option.value === langCode)) {
            languageSelect.value = langCode;
        } else {
            languageSelect.value = 'en'; // Default to English if browser lang not supported
        }
        // Trigger change event manually to apply initial language settings from detection
        applyTranslations(languageSelect.value);
    }
    
    // Update current year in footer
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    
    // Initial setup
    detectBrowserLanguage(); // Detect language and apply translations
    resetUI(); // Ensure clean state on load
    
    console.log("YouSummarize App Initialized.");
    
}); // End DOMContentLoaded