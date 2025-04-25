/**
 * YouSummarize - app.js
 * Core client-side logic for fetching video info, transcription,
 * generating summaries, and handling UI interactions.
 */

document.addEventListener('DOMContentLoaded', function() {
    // --- Share Menu Logic (No changes needed here) ---
    const shareOptionsBtn = document.getElementById('shareOptionsBtn');
    const shareMenu = document.getElementById('shareMenu');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    const shareWhatsappBtn = document.getElementById('shareWhatsappBtn');
    const shareTwitterBtn = document.getElementById('shareTwitterBtn');
    const shareFacebookBtn = document.getElementById('shareFacebookBtn');
    const copyToast = document.getElementById('copyToast');
    
    // Afficher/masquer le menu
    shareOptionsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        shareMenu.classList.toggle('hidden');
    });
    
    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', function(e) {
        if (!shareOptionsBtn.contains(e.target) && !shareMenu.contains(e.target)) {
            shareMenu.classList.add('hidden');
        }
    });
    
    // Fonction pour copier le lien
    copyLinkBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(window.location.href).then(function() {
            // Afficher le toast
            copyToast.classList.remove('opacity-0');
            copyToast.classList.add('opacity-100');
            
            // Masquer le toast après 2 secondes
            setTimeout(function() {
                copyToast.classList.remove('opacity-100');
                copyToast.classList.add('opacity-0');
            }, 2000);
            
            // Fermer le menu
            shareMenu.classList.add('hidden');
        });
    });
    
    // Fonction pour les favoris
    addBookmarkBtn.addEventListener('click', function() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const shortcut = isMac ? '⌘+D' : 'Ctrl+D';
        alert('Appuyez sur ' + shortcut + ' pour ajouter cette page à vos favoris');
        shareMenu.classList.add('hidden');
    });
    
    // Fonctions de partage social
    shareWhatsappBtn.addEventListener('click', function() {
        window.open('https://wa.me/?text=' + encodeURIComponent(document.title + ' ' + window.location.href));
        shareMenu.classList.add('hidden');
    });
    
    shareTwitterBtn.addEventListener('click', function() {
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(document.title) + '&url=' + encodeURIComponent(window.location.href));
        shareMenu.classList.add('hidden');
    });
    
    shareFacebookBtn.addEventListener('click', function() {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href));
        shareMenu.classList.add('hidden');
    });
    
    // Utiliser l'API Web Share si disponible (mobile principalement)
    if (navigator.share) {
        const nativeShareBtn = document.createElement('button');
        nativeShareBtn.className = 'group flex items-center px-4 py-2 text-sm text-subtle hover:bg-[#f0eee6] w-full text-left';
        // NOTE: This button's text will be set by applyTranslations on initial load
        // It won't change language afterwards, as requested.
        nativeShareBtn.innerHTML = '<i class="fas fa-share-alt mr-3 text-subtle"></i> <span data-translate-key="shareNative">Partager (natif)</span>';
        
        nativeShareBtn.addEventListener('click', async () => {
            try {
                await navigator.share({
                    title: document.title, // Uses the initial page title
                    url: window.location.href
                });
            } catch (err) {
                console.error('Erreur lors du partage :', err);
            }
            shareMenu.classList.add('hidden');
        });
        
        // Add this button at the top of the menu
        shareMenu.querySelector('.py-1').prepend(nativeShareBtn);
    }
});

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
    const languageSelect = document.getElementById('language'); // Selector for SUMMARY language
    const pasteButton = document.getElementById('pasteButton'); // The new paste button
    const exampleLinks = document.querySelectorAll('.example-link'); // Example link buttons
    const summaryLengthButtons = document.querySelectorAll('#results .btn-option'); // Summary length buttons
    
    // --- State Variables ---
    let currentVideoId = null; // Store the ID of the currently processed video
    let videoData = null; // Store fetched video metadata
    let currentTranscription = null; // Store the fetched transcription text (language is fixed, see getTranscription)
    let currentSummary = null; // Store the generated summary HTML
    let currentSummaryLength = 'medium'; // Default summary length
    let isLoading = false; // Prevent multiple submissions
    let toastTimeout = null; // To manage hiding the toast
    let initialPageLang = 'en'; // Store the language the page UI was initially rendered in
    
    // --- Configuration ---
    const API_BASE_URL = ''; // Backend API URL
    const DEFAULT_TRANSCRIPT_LANG = 'en'; // <-- *** NOUVEAU: Langue par défaut pour la transcription
    
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
     * Uses the initial page language for UI fallbacks/errors.
     * @param {string} videoId - The YouTube video ID.
     * @returns {Promise<object>} Object containing video details.
     */
    async function fetchVideoInfo(videoId) {
        updateLoadingState(getText('fetchingVideoInfo', 'Fetching video info...'), 10);
        try {
            const response = await fetch(`${API_BASE_URL}/api/video-info?videoId=${videoId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
                throw new Error(errorData.error || getText('httpError', 'HTTP Error:') + ` ${response.status}`);
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
                    duration: contentDetails?.duration ? convertDuration(contentDetails.duration) : getText('unknown', 'Unknown')
                };
            }
            throw new Error(getText('videoNotFound', 'Video not found or missing information.'));
        } catch (error) {
            console.error('Error fetchVideoInfo:', error);
            showToast(`${getText('errorVideoInfo', 'Video Info Error')}: ${error.message}`, 'error');
            return { // Fallback object
                id: videoId,
                title: getText('videoInfoUnavailable', 'YouTube Video (Info Unavailable)'),
                channelTitle: getText('unknownChannel', 'Unknown Channel'),
                publishedAt: null,
                description: '',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: getText('unknown', 'Unknown')
            };
        }
    }
    
    /**
     * Converts ISO 8601 duration format (PTnHnMnS) to a readable string.
     * Uses the initial page language for UI fallbacks.
     * @param {string} duration - ISO 8601 duration string.
     * @returns {string} Readable duration (e.g., "1h 23m 45s").
     */
    function convertDuration(duration) {
        const unknownText = getText('unknown', 'Unknown');
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
     * Fetches the video transcript from the backend API in a predefined language.
     * Uses the initial page language for UI fallbacks/errors.
     * @param {string} videoId - The YouTube video ID.
     * @returns {Promise<string|null>} The transcript text or null on failure.
     */
    async function getTranscription(videoId) { // <-- *** MODIFIED: No language parameter needed
        const transcriptLang = DEFAULT_TRANSCRIPT_LANG; // Use the predefined language
        updateLoadingState(getText('fetchingTranscript', 'Fetching transcript ({lang})...').replace('{lang}', transcriptLang), 30);
        try {
            // Fetch using the fixed transcript language
            const response = await fetch(`${API_BASE_URL}/api/transcript?videoId=${videoId}&language=${transcriptLang}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
                // Provide more specific error messages using translations (based on initial page lang)
                if (response.status === 404) {
                    // Mention the language tried
                    throw new Error(getText('transcriptNotFoundLang', "Transcript not found for language '{lang}'. Try another language if available.").replace('{lang}', transcriptLang));
                } else if (response.status === 400 && errorData.error && errorData.error.includes('subtitles disabled')) {
                    throw new Error(getText('subtitlesDisabled', 'Subtitles are disabled for this video.'));
                }
                throw new Error(errorData.error || getText('serverError', 'Server Error') + ` (${response.status})`);
            }
            const data = await response.json();
            updateLoadingState(getText('transcriptRetrieved', 'Transcript retrieved...'), 70);
            if (data.transcript) {
                return data.transcript;
            } else {
                // This case might happen if the backend sends a 200 OK but with an error message
                throw new Error(data.error || getText('invalidTranscriptFormat', 'Invalid transcript response format.'));
            }
        } catch (error) {
            console.error('Error getTranscription:', error);
            showToast(`${getText('errorTranscript', 'Transcript Error')}: ${error.message}`, 'error');
            updateLoadingState(getText('transcriptFailed', 'Transcript Failed'), 70);
            return null; // Indicate failure
        }
    }
    
    /**
     * Sends the transcript to the backend API for summarization.
     * The language for the summary is taken from the languageSelect dropdown.
     * UI messages/errors use the initial page language.
     * @param {string} transcription - The video transcript text.
     * @param {object} videoInfo - Metadata object for context.
     * @param {string} lengthPreference - 'short', 'medium', or 'long'.
     * @returns {Promise<string>} The summarized text in HTML format, OR an error message in HTML format.
     */
    async function summarizeWithBackend(transcription, videoInfo, lengthPreference = 'medium') {
        updateLoadingState(getText('generatingAISummary', 'Generating AI summary...'), 85);
        const summaryLanguage = languageSelect.value; // <-- Language for the SUMMARY output
        
        const MAX_CHARS = 120000;
        const isTruncated = transcription.length > MAX_CHARS;
        const truncatedTranscription = isTruncated
            ? transcription.substring(0, MAX_CHARS) + "... [Transcript truncated client-side]"
            : transcription;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcription: truncatedTranscription,
                    videoInfo: {
                        title: videoInfo?.title || getText('unknownTitle', 'Unknown Title'),
                        channelTitle: videoInfo?.channelTitle || getText('unknownChannel', 'Unknown Channel')
                    },
                    language: summaryLanguage, // Send the desired SUMMARY language
                    lengthPreference: lengthPreference
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
                throw new Error(errorData.error || getText('serverError', 'Server Error') + ` (${response.status})`);
            }
            
            const data = await response.json();
            updateLoadingState(getText('summaryReceived', 'Summary received!'), 100);
            
            if (data.summary) {
                // Use the initial page lang for the warning message itself
                const warningPrefixKey = 'transcriptionTruncatedWarning';
                const warningFallback = "<p><strong>⚠️ Warning:</strong> The transcript was very long and was truncated before analysis. The summary may be incomplete.</p><hr>";
                const warningPrefix = isTruncated ? getText(warningPrefixKey, warningFallback) : "";
                
                return warningPrefix + markdownToHtml(data.summary);
            } else {
                // Handle case where backend returns 200 OK but no summary
                console.error("Backend returned OK but no summary. Response data:", data);
                const backendErrorMsg = data.error;
                // Use initial page lang for the error message structure
                const userMessage = backendErrorMsg
                    ? `${getText('serverError', 'Server Error')}: ${backendErrorMsg}`
                    : getText('summaryGenerationFailed', 'The server responded but could not generate a summary for this video.');
                
                showToast(userMessage, 'error'); // Show toast immediately
                
                // Return the error message formatted as HTML (using initial page lang structure)
                return `<p class="text-red-600"><strong>${getText('error', 'Error')}:</strong> ${userMessage}</p>`;
            }
        } catch (error) {
            // Catch errors from fetch itself or non-OK responses
            console.error('Error summarizeWithBackend:', error);
            // Use initial page lang for the error message structure
            showToast(`${getText('errorSummary', 'Summary Error')}: ${error.message}`, 'error');
            updateLoadingState(getText('summaryFailed', 'Summary Failed'), 100);
            // Return a fallback error message in HTML (using initial page lang structure)
            return `<p class="text-red-600"><strong>${getText('error', 'Error')}:</strong> ${getText('couldNotGenerateSummary', 'Could not generate summary.')} ${error.message}</p>`;
        }
    }
    
    /**
     * Basic Markdown to HTML converter. (No changes needed)
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
        html = html.replace(/^\s*([*-]) (.*?)(?=\n\s*[*-] |\n*$)/gim, (match, _marker, item) => `<li>${item.trim()}</li>`);
        html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ul>\n${match.trim()}\n</ul>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ul>\s*\n?<ul>/g, ''); // Merge consecutive lists
        
        // Ordered Lists (1. item) - Improved handling
        html = html.replace(/^\s*\d+\. (.*?)(?=\n\s*\d+\. |\n*$)/gim, (match, item) => `<li>${item.trim()}</li>`);
        html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ol>\n${match.trim()}\n</ol>\n`); // Wrap consecutive list items
        html = html.replace(/<\/ol>\s*\n?<ol>/g, ''); // Merge consecutive ordered lists
        
        
        // Paragraphs (treat remaining text blocks) - Split by double newline first
        html = html.split(/\n{2,}/).map(paragraph => {
            paragraph = paragraph.trim();
            if (!paragraph) return '';
            // Avoid wrapping existing block elements in <p>
            if (paragraph.match(/^<(?:ul|ol|li|h[1-6]|block|pre|hr|table|thead|tbody|tr|th|td|blockquote)/i)) {
                return paragraph;
            }
            // Avoid wrapping list items possibly separated by \n\n
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
        // Be careful not to add breaks inside <pre> or where markdown doesn't intend them
        html = html.replace(/<(p|li|blockquote)>(.*?)<\/\1>/gs, (match, tag, content) => {
            // Prevent adding <br> inside potential nested block elements like lists within blockquotes
            if (content.match(/<(ul|ol|li|h[1-6]|block|pre|hr|table|thead|tbody|tr|th|td|blockquote)/i)) {
                return match; // Return original if complex content found
            }
            return `<${tag}>${content.replace(/(?<!<br>)\n(?!<br>)/g, '<br>\n')}</${tag}>`; // Convert single \n to <br>
        });
        
        
        // Cleanup potential artifacts
        html = html.replace(/<br>\s*<\/(ul|ol|li|h[1-6]|blockquote|pre|p)>/g, '</$1>'); // Remove <br> before closing block tags
        html = html.replace(/<(ul|ol|li|h[1-6]|blockquote|pre|p)>\s*<br>/g, '<$1>'); // Remove <br> after opening block tags
        html = html.replace(/<p>\s*<\/p>/g, ''); // Remove empty paragraphs
        html = html.replace(/<ul>\s*<\/ul>|<ol>\s*<\/ol>/g, ''); // Remove empty lists
        
        return html.trim();
    }
    
    /**
     * Displays a short-lived notification message (toast).
     * Uses the initial page language for the message text structure.
     * @param {string} message - The message text (already translated or from backend).
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
     * Uses the initial page language for the message text structure.
     * @param {string} text - The status text (already translated).
     * @param {number} percent - The progress percentage (0-100).
     */
    function updateLoadingState(text, percent) {
        if (loadingState.classList.contains('hidden')) return;
        loadingText.textContent = text;
        progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    
    /**
     * Formats a date object or string into a localized string based on the initial page language.
     * @param {Date|string|null} dateInput - The date to format.
     * @returns {string} Formatted date string or a fallback (using initial page lang).
     */
    function formatDate(dateInput) {
        const unknownDateText = getText('unknownDate', 'Unknown date');
        const invalidDateText = getText('invalidDate', 'Invalid date');
        if (!dateInput) return unknownDateText;
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) {
                return invalidDateText;
            }
            // Use the initial page language for date formatting
            const langLocale = initialPageLang === 'fr' ? 'fr-FR' : initialPageLang === 'es' ? 'es-ES' : 'en-US';
            return date.toLocaleDateString(langLocale, {
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
     * Uses the initial page language for fallbacks/alt text.
     * @param {object} data - The video data object from fetchVideoInfo.
     */
    function displayVideoInfo(data) {
        videoData = data;
        if (!data || !data.id) {
            videoInfo.classList.add('hidden');
            return;
        }
        videoThumbnail.src = data.thumbnail || `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`;
        videoThumbnail.alt = `${getText('thumbnailAltPrefix', 'Video thumbnail:')} ${data.title || getText('youtubeVideo', 'YouTube Video')}`;
        videoTitle.textContent = data.title || getText('titleUnavailable', 'Title unavailable');
        channelTitle.textContent = data.channelTitle || getText('unknownChannel', 'Unknown Channel');
        publishedDate.textContent = formatDate(data.publishedAt); // Uses initial page lang for formatting
        videoDuration.textContent = data.duration || getText('unknown', 'Unknown');
        videoLink.href = `https://www.youtube.com/watch?v=${data.id}`;
        videoInfo.classList.remove('hidden');
    }
    
    /**
     * Displays the generated summary in the results area.
     * @param {string} summaryHtml - The summary content (HTML, language determined by backend).
     */
    function displaySummary(summaryHtml) {
        currentSummary = summaryHtml; // Store even if it's an error message
        // Use initial page lang for fallback message
        summaryContent.innerHTML = summaryHtml || `<p>${getText('noSummaryGenerated', 'No summary generated.')}</p>`;
        results.classList.remove('hidden');
        // Scroll only if the results were previously hidden (avoid scrolling on length/lang change)
        if (results.classList.contains('hidden')) {
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    /**
     * Resets the UI state before a new request or on error. (No changes needed)
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
        
        // Reset active state on length buttons (labels are set by initial applyTranslations)
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
     */
    async function handleSubmit(e) {
        e.preventDefault();
        if (isLoading) return;
        
        const url = youtubeUrl.value.trim();
        if (!url) {
            showToast(getText('enterUrl', 'Please enter a YouTube URL.'), 'error');
            youtubeUrl.focus();
            return;
        }
        
        const videoId = extractVideoId(url);
        if (!videoId) {
            showToast(getText('invalidUrl', 'Invalid or unrecognized YouTube URL.'), 'error');
            youtubeUrl.focus();
            return;
        }
        
        isLoading = true;
        resetUI(); // Reset before starting
        loadingState.classList.remove('hidden');
        summarizeBtn.disabled = true;
        updateLoadingState(getText('validatingUrl', 'Validating URL...'), 5);
        currentVideoId = videoId;
        
        try {
            // 1. Fetch Video Info (uses initial page lang for fallbacks)
            const fetchedVideoData = await fetchVideoInfo(videoId);
            displayVideoInfo(fetchedVideoData);
            if (fetchedVideoData.title === getText('videoInfoUnavailable', 'YouTube Video (Info Unavailable)')) {
                showToast(getText('limitedVideoInfo', 'Limited video info retrieved.'), 'info');
            }
            
            // 2. Get Transcription (uses fixed language, e.g., 'en')
            // *** MODIFIED: No language passed here ***
            currentTranscription = await getTranscription(videoId);
            if (!currentTranscription) {
                throw new Error('SKIP_TO_FINALLY'); // Error handled within getTranscription
            }
            
            // 3. Generate Summary (uses selected summary language from dropdown)
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            
            // Display whatever HTML was returned (summary or error message)
            displaySummary(summaryHtml);
            
            // Check if the returned HTML indicates an error
            if (!summaryHtml || !summaryHtml.includes('<p class="text-red-600">')) {
                showToast(getText('summaryGeneratedSuccess', 'Summary generated successfully!'), 'success');
            } else {
                // Error toast already shown inside summarizeWithBackend
                throw new Error('SKIP_TO_FINALLY');
            }
            
        } catch (error) {
            if (error.message !== 'SKIP_TO_FINALLY') {
                console.error('Unexpected error in handleSubmit:', error);
                // Show generic error only if specific ones weren't likely shown
                if (!error.message.includes(getText('errorTranscript', 'Transcript Error')) &&
                    !error.message.includes(getText('errorSummary', 'Summary Error')) &&
                    !error.message.includes(getText('errorVideoInfo', 'Video Info Error'))) {
                    showToast(`${getText('error', 'Error')}: ${error.message}`, 'error');
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
     * Uses initial page language for status messages.
     */
    function copySummary() {
        const noSummaryText = getText('noSummaryToCopy', 'No summary to copy.');
        const summaryEmptyText = getText('summaryEmpty', 'Summary is empty.');
        const copySuccessText = getText('summaryCopied', 'Summary copied!');
        const copyFailText = getText('copyFailed', 'Copy failed.');
        const copyFallbackSuccessText = getText('summaryCopiedFallback', 'Summary copied (fallback method)!');
        
        if (!summaryContent || !currentSummary || currentSummary.includes('<p class="text-red-600">')) { // Don't copy error messages
            showToast(noSummaryText, 'error');
            return;
        }
        
        // Convert HTML summary to plain text (same logic as before)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentSummary;
        tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => h.before('\n\n'));
        tempDiv.querySelectorAll('p, li, blockquote').forEach(el => {
            if (el.tagName === 'LI' ) { // Add bullet point or number mimic if needed
                const parent = el.parentElement;
                if (parent && parent.tagName === 'UL') el.before('\n- ');
                else if (parent && parent.tagName === 'OL') el.before('\n* '); // Simple marker
                else el.before('\n');
            } else {
                el.before('\n');
            }
            el.append('\n');
        });
        tempDiv.querySelectorAll('hr').forEach(hr => hr.replaceWith('\n---\n'));
        
        let textToCopy = tempDiv.textContent || tempDiv.innerText || '';
        textToCopy = textToCopy
            .replace(/(\n\s*){3,}/g, '\n\n') // Collapse multiple (>2) newlines
            .replace(/^\s+|\s+$/g, ''); // Trim leading/trailing whitespace
        
        
        if (!textToCopy) {
            showToast(summaryEmptyText, 'error');
            return;
        }
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(copySuccessText, 'success');
            }).catch(err => {
                console.error('Clipboard API copy error:', err);
                showToast(copyFailText, 'error');
                copyWithExecCommand(textToCopy); // Attempt fallback
            });
        } else {
            copyWithExecCommand(textToCopy); // Use fallback directly
        }
    }
    
    /**
     * Fallback method to copy text using document.execCommand.
     * Uses initial page language for status messages.
     * @param {string} text - The text to copy.
     */
    function copyWithExecCommand(text) {
        const copySuccessText = getText('summaryCopiedFallback', 'Summary copied (fallback method)!');
        const copyFailText = getText('copyFailed', 'Copy failed.');
        
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
            console.error('execCommand copy error:', err);
            showToast(copyFailText, 'error');
        }
        document.body.removeChild(textArea);
    }
    
    
    /**
     * Generates and downloads the summary as a PDF document.
     * Uses initial page language for PDF labels and status messages.
     * Version finale avec nettoyage complet des caractères spéciaux et meilleure mise en page.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version améliorée pour conserver la mise en forme HTML et le contenu exact du résumé.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version améliorée pour conserver la mise en forme HTML et le contenu exact du résumé.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version hybride utilisant html2canvas pour la capture fidèle
     * et un traitement manuel pour assurer une répartition correcte sur les pages.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version avec contrôle manuel strict de la pagination pour garantir que tout le contenu s'affiche correctement.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version spécialement conçue pour gérer correctement les balises HTML et emojis.
     */
    /**
     * Génère et télécharge le résumé sous forme de document PDF.
     * Version corrigée pour gérer correctement les émojis et caractères spéciaux.
     */
    function downloadSummary() {
        const noSummaryDownloadText = getText('noSummaryToDownload', 'No summary to download.');
        const preparingPDFText = getText('preparingPDF', 'Preparing PDF...');
        const pdfLibraryErrorText = getText('pdfLibraryError', 'Error loading PDF library.');
        const pdfDownloadedText = getText('pdfDownloaded', 'PDF Downloaded!');
        const pdfCreationErrorText = getText('pdfCreationError', 'Error creating PDF.');
        
        if (!currentSummary || !videoData || currentSummary.includes('<p class="text-red-600">')) {
            showToast(noSummaryDownloadText, 'error');
            return;
        }
        
        const jspdfSrc = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') {
                    resolve(); return;
                }
                // Check if script is already loading/loaded
                let existingScript = document.querySelector(`script[src="${src}"]`);
                if (existingScript) {
                    if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') {
                        resolve(); // Already loaded
                    } else {
                        // Wait for existing script to load
                        existingScript.addEventListener('load', resolve);
                        existingScript.addEventListener('error', reject);
                    }
                    return;
                }
                
                const script = document.createElement('script');
                script.src = src;
                script.async = true; // Load asynchronously
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        showToast(preparingPDFText, 'info');
        
        loadScript(jspdfSrc)
            .then(() => {
                // Add a small delay to ensure jsPDF is fully available on the window object
                setTimeout(generatePDF, 100);
            })
            .catch(err => {
                console.error("Error loading PDF library:", err);
                showToast(pdfLibraryErrorText, 'error');
            });
        
        function generatePDF() {
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                console.error("jsPDF library not loaded correctly.");
                showToast(pdfLibraryErrorText, 'error');
                return;
            }
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                
                // Register custom fonts if needed (ensure files are accessible)
                // Example: doc.addFont('path/to/MyFont-Regular.ttf', 'MyFont', 'normal');
                //          doc.addFont('path/to/MyFont-Bold.ttf', 'MyFont', 'bold');
                // Then use: doc.setFont('MyFont', 'normal'); or doc.setFont('MyFont', 'bold');
                // Using standard Helvetica/Times/Courier is safer for compatibility
                
                const pageHeight = doc.internal.pageSize.height;
                const pageWidth = doc.internal.pageSize.width;
                const margin = 15; // Reduced margin slightly
                const maxLineWidth = pageWidth - margin * 2;
                let currentY = margin;
                const currentSummaryLang = languageSelect.value; // Lang of the summary content
                const uiLang = initialPageLang; // Lang of the PDF labels/structure
                
                // Use a default font that supports accents better than standard Helvetica
                doc.setFont('helvetica', 'normal'); // Or 'times', 'courier'
                
                
                // Colors (using Tailwind defaults for consistency)
                const accentColor = [79, 70, 229]; // indigo-600
                const textColor = [17, 24, 39];    // gray-900
                const subtleColor = [107, 114, 128]; // gray-500
                const lightBgColor = [243, 244, 246]; // gray-100
                const borderColor = [209, 213, 219]; // gray-300
                
                // ===== UTILITY FUNCTIONS =====
                
                // Amélioré: remplace les émojis par des alternatives textuelles et nettoie les caractères problématiques
                function cleanText(text) {
                    if (!text) return '';
                    
                    // Map des émojis courants vers des alternatives textuelles
                    const emojiMap = {
                        '✨': '[*]',        // Sparkles
                        '🔍': '[Loupe]',    // Magnifying Glass
                        '💡': '[Idée]',     // Light Bulb
                        '📋': '[Liste]',    // Clipboard
                        '🔹': '[>]',        // Blue Diamond
                        '📊': '[Graphique]',// Chart
                        '💼': '[Travail]',  // Briefcase
                        '🔗': '[Lien]',     // Link
                        '🔑': '[Clé]',      // Key
                        '⚠️': '[Attention]' // Warning
                    };
                    
                    // Remplace les émojis par leur alternative textuelle
                    let cleaned = text;
                    Object.keys(emojiMap).forEach(emoji => {
                        cleaned = cleaned.replace(new RegExp(emoji, 'g'), emojiMap[emoji]);
                    });
                    
                    // Nettoie d'autres caractères problématiques
                    cleaned = cleaned
                        .replace(/•/g, '-') // Replace bullet points with hyphen
                        .replace(/[""]/g, '"') // Smart quotes to standard quotes
                        .replace(/['']/g, "'") // Smart apostrophes to standard apostrophes
                        .replace(/…/g, '...') // Ellipsis to three dots
                        .replace(/–/g, '-') // En dash to hyphen
                        .replace(/—/g, '-') // Em dash to hyphen
                        .replace(/[^\x00-\x7F]/g, char => {
                            // Essaie de translittérer les caractères non-ASCII courants
                            const translitMap = {
                                'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
                                'à': 'a', 'â': 'a', 'ä': 'a',
                                'î': 'i', 'ï': 'i',
                                'ô': 'o', 'ö': 'o',
                                'ù': 'u', 'û': 'u', 'ü': 'u',
                                'ç': 'c',
                                'ñ': 'n',
                                // Ajouter d'autres mappings au besoin
                            };
                            return translitMap[char] || ' '; // Remplace par un espace si pas de mapping
                        });
                    
                    // Nettoie les caractères de contrôle
                    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                    
                    // Réduit les espaces multiples
                    cleaned = cleaned.replace(/\s{2,}/g, ' ');
                    
                    return cleaned.trim();
                }
                
                function addPageIfNeeded(neededSpace = 15) {
                    if (currentY + neededSpace >= pageHeight - margin) {
                        doc.addPage();
                        currentY = margin;
                        // Page header (optional, uncomment if desired)
                        /*
                        doc.setFontSize(8);
                        doc.setTextColor(...subtleColor);
                        const headerTitle = cleanText(videoData.title || 'YouTube Summary').substring(0, 70);
                        doc.text(headerTitle + (headerTitle.length === 70 ? '...' : ''), margin, 10);
                        doc.setDrawColor(...borderColor);
                        doc.setLineWidth(0.2);
                        doc.line(margin, 12, pageWidth - margin, 12);
                        currentY = margin + 5; // Adjust starting Y after header
                        */
                    }
                }
                
                // Extracts structured content from the HTML summary
                // Now returns an array of { type: 'p'|'h'|'li', text: '...' }
                function extractStructuredContent() {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = currentSummary;
                    const content = [];
                    
                    // Fonction récursive pour traiter les nœuds
                    function processNode(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const tagName = node.tagName.toLowerCase();
                            
                            // Traitement spécial pour les éléments div et span contenant des emojis
                            if ((tagName === 'div' || tagName === 'span') && node.querySelector('emoji')) {
                                // Traiter les emojis spécialement si nécessaire
                            }
                            
                            // Traitement standard des éléments
                            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                                const text = cleanText(node.textContent || '');
                                if (text) {
                                    content.push({ type: 'h', level: parseInt(tagName.substring(1)), text: text });
                                }
                            } else if (tagName === 'p') {
                                const text = cleanText(node.textContent || '');
                                if (text) {
                                    content.push({ type: 'p', text: text });
                                }
                            } else if (tagName === 'ul' || tagName === 'ol') {
                                const listType = tagName;
                                Array.from(node.querySelectorAll('li')).forEach((li, index) => {
                                    const liText = cleanText(li.textContent || '');
                                    if (liText) {
                                        content.push({
                                            type: 'li',
                                            list: listType,
                                            index: index + 1, // For potential ordered list numbering
                                            text: liText
                                        });
                                    }
                                });
                            } else if (tagName === 'blockquote') {
                                const text = cleanText(node.textContent || '');
                                if (text) {
                                    content.push({ type: 'blockquote', text: text });
                                }
                            } else if (tagName === 'hr') {
                                content.push({ type: 'hr' });
                            } else {
                                // Parcourir les enfants pour les autres éléments
                                Array.from(node.childNodes).forEach(child => processNode(child));
                            }
                        } else if (node.nodeType === Node.TEXT_NODE) {
                            // Handle potential loose text nodes if markdown parser leaves them
                            const text = cleanText(node.textContent || '');
                            if (text) content.push({ type: 'p', text: text });
                        }
                    }
                    
                    // Traiter chaque nœud enfant du div racine
                    Array.from(tempDiv.childNodes).forEach(node => processNode(node));
                    
                    return content;
                }
                
                
                // Helper to add text with line wrapping and page breaks
                function addWrappedText(text, options = {}) {
                    const { fontSize = 10, fontStyle = 'normal', color = textColor, x = margin, maxWidth = maxLineWidth, lineHeightFactor = 1.15, indent = 0 } = options;
                    const effectiveMaxWidth = maxWidth - indent;
                    
                    doc.setFontSize(fontSize);
                    doc.setFont('helvetica', fontStyle); // Ensure font is set correctly
                    doc.setTextColor(...color);
                    
                    const lines = doc.splitTextToSize(text, effectiveMaxWidth);
                    const lineHeight = doc.getLineHeight() * lineHeightFactor / doc.internal.scaleFactor; // Calculate line height in mm
                    
                    lines.forEach((line, index) => {
                        addPageIfNeeded(lineHeight);
                        doc.text(line, x + indent, currentY);
                        currentY += lineHeight;
                    });
                    currentY += lineHeight * 0.3; // Add small space after paragraph/block
                }
                
                // ===== START PDF DOCUMENT =====
                
                // 1. Main Title
                addPageIfNeeded(20);
                addWrappedText('YouSummarize', { fontSize: 20, fontStyle: 'bold', color: accentColor });
                currentY += 2; // Smaller gap
                
                // 2. Video Information Box
                addPageIfNeeded(40);
                const infoBoxY = currentY;
                doc.setFillColor(...lightBgColor);
                doc.setDrawColor(...borderColor);
                doc.setLineWidth(0.3);
                // Draw roundedRect requires X, Y, Width, Height, Rx, Ry, Style (F, D, FD)
                // Calculate height dynamically later
                // doc.roundedRect(margin, infoBoxY, maxLineWidth, 40, 3, 3, 'FD'); // Placeholder rect
                
                currentY += 5; // Padding top
                
                // Video Title
                const videoTitleText = cleanText(videoData.title || getText('videoSummary', 'Video Summary'));
                addWrappedText(videoTitleText, { fontSize: 14, fontStyle: 'bold', x: margin + 3, maxWidth: maxLineWidth - 6});
                currentY += 1;
                
                // Sub-details (Channel, Date, Duration)
                const channelText = `${getText('channel', 'Channel')}: ${cleanText(videoData.channelTitle || getText('unknownChannel', 'Unknown Channel'))}`;
                const dateText = `${getText('published', 'Published')}: ${formatDate(videoData.publishedAt)}`; // formatDate uses uiLang
                const durationText = `${getText('duration', 'Duration')}: ${videoData.duration || getText('unknown', 'Unknown')}`;
                addWrappedText(channelText, { fontSize: 9, color: subtleColor, x: margin + 3, maxWidth: maxLineWidth - 6 });
                addWrappedText(dateText, { fontSize: 9, color: subtleColor, x: margin + 3, maxWidth: maxLineWidth - 6 });
                addWrappedText(durationText, { fontSize: 9, color: subtleColor, x: margin + 3, maxWidth: maxLineWidth - 6 });
                
                // Summary Settings
                const summaryLangName = translations[currentSummaryLang]?.languageName || currentSummaryLang; // Get full language name if available
                const summaryLengthText = getText(`length${capitalize(currentSummaryLength)}`, currentSummaryLength);
                const settingsText = `${getText('summarySettingsLabel', 'Summary Settings')}: ${getText('language', 'Language')}: ${summaryLangName} • ${getText('lengthLabel', 'Detail')}: ${summaryLengthText}`;
                addWrappedText(settingsText, { fontSize: 8, color: subtleColor, x: margin + 3, maxWidth: maxLineWidth - 6 });
                
                
                currentY += 5; // Padding bottom
                const infoBoxHeight = currentY - infoBoxY;
                doc.roundedRect(margin, infoBoxY, maxLineWidth, infoBoxHeight, 3, 3, 'FD'); // Draw actual rect
                
                currentY += 10; // Space after info box
                
                // 3. Render Structured Content
                const content = extractStructuredContent();
                
                content.forEach(item => {
                    addPageIfNeeded(20); // Estimate space needed
                    
                    switch (item.type) {
                        case 'h':
                            const headerSize = Math.max(10, 18 - item.level * 2); // h1=16, h2=14, h3=12, etc.
                            addWrappedText(item.text, { fontSize: headerSize, fontStyle: 'bold', color: accentColor });
                            currentY += 2; // More space after headers
                            break;
                        case 'p':
                            addWrappedText(item.text, { fontSize: 10 });
                            break;
                        case 'li':
                            const bullet = item.list === 'ul' ? '•' : `${item.index}.`;
                            // Indent text slightly after bullet
                            addWrappedText(`${bullet} ${item.text}`, { fontSize: 10, indent: 3, maxWidth: maxLineWidth - 3 });
                            break;
                        case 'blockquote':
                            const blockquoteY = currentY;
                            doc.setFillColor(...lightBgColor);
                            doc.setDrawColor(...borderColor);
                            doc.setLineWidth(0.2);
                            // Estimate height first
                            const lines = doc.splitTextToSize(item.text, maxLineWidth - 8); // Less width for padding
                            const lineHeight = doc.getLineHeight() * 1.15 / doc.internal.scaleFactor;
                            const quoteHeight = lines.length * lineHeight + 6; // Padding top/bottom
                            
                            addPageIfNeeded(quoteHeight); // Check if blockquote fits
                            
                            doc.rect(margin, currentY, maxLineWidth, quoteHeight, 'F'); // Background fill
                            doc.setDrawColor(...accentColor); // Accent border color
                            doc.setLineWidth(1.5);
                            doc.line(margin, currentY, margin, currentY + quoteHeight); // Left accent border
                            
                            // Reset draw color
                            doc.setDrawColor(...borderColor);
                            doc.setLineWidth(0.2);
                            
                            currentY += 3; // Padding top
                            addWrappedText(item.text, { fontSize: 10, fontStyle: 'italic', color: subtleColor, x: margin + 4, maxWidth: maxLineWidth - 8});
                            currentY += 3; // Padding bottom
                            break;
                        case 'hr':
                            doc.setDrawColor(...borderColor);
                            doc.setLineWidth(0.5);
                            doc.line(margin, currentY, pageWidth - margin, currentY);
                            currentY += 5;
                            break;
                    }
                });
                
                // 4. Footer with Page Numbers
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(...subtleColor);
                    const footerText = `${getText('page', 'Page')} ${i} / ${pageCount} - YouSummarize`;
                    const footerWidth = doc.getTextWidth(footerText);
                    doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
                }
                
                // 5. Save the PDF
                const safeTitle = (videoData.title || 'youtube-summary')
                    .replace(/[^a-z0-9]/gi, '_')
                    .toLowerCase()
                    .substring(0, 40);
                doc.save(`YouSummarize_${safeTitle}.pdf`);
                showToast(pdfDownloadedText, 'success');
                
            } catch (pdfError) {
                console.error("Error generating PDF:", pdfError);
                showToast(`${pdfCreationErrorText}${pdfError.message ? ': ' + pdfError.message : ''}`, 'error');
            }
        }
    }
    
    
    /**
     * Handles clicks on the summary length buttons. Regenerates the summary.
     * Uses the currently selected SUMMARY language for the regeneration request.
     * Uses the initial page language for status messages.
     * @param {Event} e - The click event.
     */
    async function handleLengthChange(e) {
        if (!e || !e.target || !e.target.dataset || !e.target.dataset.length) return;
        
        const newLength = e.target.dataset.length;
        
        if (isLoading || !currentTranscription || !videoData) {
            // Prevent action if busy or no data
            return;
        }
        
        if (newLength === currentSummaryLength) return; // No change
        
        // Update button styles immediately (labels are static based on initial lang)
        summaryLengthButtons.forEach(btn => {
            const isActive = btn.dataset.length === newLength;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('bg-[#E9E5D8]', isActive); // Assuming these colors don't change
            btn.classList.toggle('text-main', isActive);
            btn.classList.toggle('font-medium', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('text-subtle', !isActive);
        });
        
        currentSummaryLength = newLength; // Update state
        
        // Regenerate summary
        isLoading = true;
        results.classList.add('opacity-50', 'pointer-events-none'); // Dim results area
        // Use initial page lang for loading message structure
        summaryContent.innerHTML = `<p class="flex items-center justify-center gap-2"><span class="loading-spinner !w-5 !h-5 !border-2"></span> ${getText('recalculatingSummary', 'Recalculating summary...')}</p>`;
        
        try {
            // Call backend with updated length and CURRENTLY SELECTED summary language
            const summaryHtml = await summarizeWithBackend(currentTranscription, videoData, currentSummaryLength);
            displaySummary(summaryHtml); // Display the result (summary or error)
            
            // Show success toast only if it wasn't an error message
            if (!summaryHtml || !summaryHtml.includes('<p class="text-red-600">')) {
                // Use initial page lang for toast message structure
                const lengthText = getText(`length${capitalize(currentSummaryLength)}`, currentSummaryLength);
                showToast(`${getText('summaryUpdated', 'Summary updated')} (${lengthText})`, 'success');
            }
        } catch (error) {
            console.error("Error recalculating summary:", error);
            // Use initial page lang for error toast
            showToast(getText('errorRecalculating', 'Error recalculating.'), 'error');
            // Display error in summary area (using initial page lang structure)
            displaySummary(`<p class="text-red-600">${getText('errorRecalculating', 'Error recalculating.')}</p>`);
        } finally {
            isLoading = false;
            results.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
    
    // Helper to capitalize first letter
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // --- Event Listeners ---
    youtubeForm.addEventListener('submit', handleSubmit);
    copyBtn.addEventListener('click', copySummary);
    downloadBtn.addEventListener('click', downloadSummary);
    
    // Paste Button Listener (no changes needed)
    if (pasteButton && youtubeUrl && navigator.clipboard) {
        pasteButton.addEventListener('click', () => {
            navigator.clipboard.readText()
                .then(text => {
                    if (text) {
                        youtubeUrl.value = text;
                        youtubeUrl.focus();
                        // Use initial page lang for toast
                        showToast(getText('linkPasted', 'Link pasted!'), 'success');
                    } else {
                        showToast(getText('clipboardEmpty', 'Clipboard is empty.'), 'info');
                    }
                })
                .catch(err => {
                    console.error('Error reading clipboard: ', err);
                    // Use initial page lang for toasts
                    if (err.name === 'NotAllowedError') {
                        showToast(getText('pastePermissionError', 'Permission needed to paste.'), 'error');
                    } else {
                        showToast(getText('pasteError', 'Could not paste.'), 'error');
                    }
                });
        });
    } else if (pasteButton) {
        console.warn("Clipboard API not available (HTTPS required?). Paste button disabled.");
        pasteButton.disabled = true;
        pasteButton.style.opacity = '0.5';
        pasteButton.title = getText('pasteButtonDisabledTitle', "Feature unavailable (HTTPS required)");
    }
    
    // Example Links Listeners (no changes needed)
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
                // Use initial page lang for toast
                showToast(getText('waitForCurrentSummary', 'Please wait for the current summary to finish.'), 'info');
            }
        });
    });
    
    // Summary Length Buttons Listeners (no changes needed)
    summaryLengthButtons.forEach(button => {
        button.addEventListener('click', handleLengthChange);
    });
    
    // --- Translations Object (No changes needed here, keep it for initial load) ---
    const translations = {
        fr: {
            title: "YouSummarize - Résumés Vidéo YouTube par IA",
            h1: "YouTube Summary", // Gardé simple, ou "Résumé YouTube"
            heroP: "Collez un lien YouTube, obtenez un résumé clair et concis. Gagnez du temps, comprenez plus vite.",
            heroBadge: "Gratuit · Rapide · Aucune Inscription",
            urlLabel: "Collez votre lien YouTube ici",
            urlPlaceholder: "https://www.youtube.com/watch?v=...",
            urlHelp: "Fonctionne avec les vidéos publiques disposant de sous-titres.",
            submitBtn: "Générer le résumé",
            languageLabel: "Langue du Résumé:", // <-- Clarification
            exampleTitle: "Ou essayez avec un exemple :",
            loadingDefault: "Analyse en cours...",
            loadingFewSecs: "Cela peut prendre quelques secondes.",
            videoInfoTitle: "Résumé Généré", // Titre de la section résultat
            copyBtn: "Copier",
            downloadBtn: "PDF",
            lengthLabel: "Niveau de Détail:", // Changé de "Précision"
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
            shareNative: "Partager (natif)", // For Web Share API button
            // Error/Status Messages
            fetchingVideoInfo: 'Récupération des infos vidéo...', httpError: 'Erreur HTTP:', videoNotFound: 'Vidéo non trouvée ou informations manquantes.',
            errorVideoInfo: 'Erreur infos vidéo', videoInfoUnavailable: 'Vidéo YouTube (Infos Indisponibles)', unknownChannel: 'Chaîne inconnue', unknown: 'Inconnue',
            fetchingTranscript: 'Récupération de la transcription...', transcriptNotFoundLang: "Transcription non trouvée pour la langue. Vérifiez les langues disponibles sur YouTube.", // Message ajusté
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
            transcriptionTruncatedWarning: "<p><strong>⚠️ Attention :</strong> La transcription était très longue et a été tronquée avant l'analyse. Le résumé peut être incomplet.</p><hr>",
            summarySettingsLabel: "Paramètres du résumé", // For PDF
            languageName: "Français", // For PDF, if lang='fr'
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
            languageLabel: "Summary Language:", // <-- Clarification
            exampleTitle: "Or try an example:",
            loadingDefault: "Analyzing...",
            loadingFewSecs: "This may take a few seconds.",
            videoInfoTitle: "Generated Summary", // Title for results section
            copyBtn: "Copy",
            downloadBtn: "PDF",
            lengthLabel: "Detail Level:", // Changed from "Detail"
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
            shareNative: "Share (Native)", // For Web Share API button
            // Error/Status Messages
            fetchingVideoInfo: 'Fetching video info...', httpError: 'HTTP Error:', videoNotFound: 'Video not found or missing information.',
            errorVideoInfo: 'Video Info Error', videoInfoUnavailable: 'YouTube Video (Info Unavailable)', unknownChannel: 'Unknown Channel', unknown: 'Unknown',
            fetchingTranscript: 'Fetching transcript...', transcriptNotFoundLang: "Transcript not found for language. Check available languages on YouTube.", // Adjusted message
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
            transcriptionTruncatedWarning: "<p><strong>⚠️ Warning:</strong> The transcript was very long and was truncated before analysis. The summary may be incomplete.</p><hr>",
            summarySettingsLabel: "Summary Settings", // For PDF
            languageName: "English", // For PDF, if lang='en'
        },
        es: { // Example Spanish - Needs full translation and review
            title: "YouSummarize - Resúmenes IA de Vídeos de YouTube",
            h1: "Resumen de YouTube",
            heroP: "Pega un enlace de YouTube, obtén un resumen claro y conciso. Ahorra tiempo, entiende más rápido.",
            heroBadge: "Gratis · Rápido · Sin Registro",
            urlLabel: "Pega tu enlace de YouTube aquí",
            urlPlaceholder: "https://www.youtube.com/watch?v=...",
            urlHelp: "Funciona con videos públicos que tengan subtítulos.",
            submitBtn: "Generar Resumen",
            languageLabel: "Idioma del Resumen:", // <-- Clarification
            exampleTitle: "O prueba un ejemplo:",
            loadingDefault: "Analizando...",
            loadingFewSecs: "Esto puede tardar unos segundos.",
            videoInfoTitle: "Resumen Generado", // Title for results section
            copyBtn: "Copiar",
            downloadBtn: "PDF",
            lengthLabel: "Nivel de Detalle:", // Changed
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
            shareNative: "Compartir (Nativo)", // For Web Share API button
            // Error/Status Messages (Translate these carefully)
            fetchingVideoInfo: 'Obteniendo información del vídeo...', httpError: 'Error HTTP:', videoNotFound: 'Vídeo no encontrado o falta información.',
            errorVideoInfo: 'Error de información del vídeo', videoInfoUnavailable: 'Vídeo de YouTube (Información no disponible)', unknownChannel: 'Canal desconocido', unknown: 'Desconocido',
            fetchingTranscript: 'Obteniendo transcripción ({lang})...', transcriptNotFoundLang: "Transcripción no encontrada para el idioma '{lang}'. Comprueba los idiomas disponibles en YouTube.", // Adjusted message
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
            transcriptionTruncatedWarning: "<p><strong>⚠️ Aviso:</strong> La transcripción era muy larga y fue truncada antes del análisis. El resumen puede estar incompleto.</p><hr>",
            summarySettingsLabel: "Configuración del resumen", // For PDF
            languageName: "Español", // For PDF, if lang='es'
        }
    };
    
    // Helper to get translated text based on the initial page language
    function getText(key, fallback) {
        // Use initialPageLang stored after detection
        const langToUse = initialPageLang || 'en';
        return translations[langToUse]?.[key] || translations['en']?.[key] || fallback || key;
    }
    
    // Language change listener - NOW ONLY REGENERATES SUMMARY IF NEEDED
    languageSelect.addEventListener('change', function() {
        const newSummaryLang = languageSelect.value;
        console.log(`Summary language selection changed to: ${newSummaryLang}`);
        
        // *** NO LONGER CALL applyTranslations(newSummaryLang); ***
        // The page UI language remains unchanged.
        
        // If a summary exists and we are not loading, regenerate it in the new language
        if (currentTranscription && videoData && !isLoading && !results.classList.contains('hidden')) {
            // Avoid regenerating if the previous result was an error message
            if (!currentSummary || !currentSummary.includes('<p class="text-red-600">')) {
                console.log(`Regenerating summary in ${newSummaryLang}.`);
                // Find the currently active length button to trigger handleLengthChange
                // which will use the new language from the select element.
                const activeLengthButton = document.querySelector('#results .btn-option.active') || document.querySelector(`.btn-option[data-length="${currentSummaryLength}"]`);
                if (activeLengthButton) {
                    // Simulate a click or directly call handleLengthChange
                    // Using handleLengthChange ensures consistent logic
                    handleLengthChange({ target: activeLengthButton });
                } else {
                    // Fallback if no button found (shouldn't happen normally)
                    console.warn("Could not find active length button to trigger regeneration.");
                    // Manually trigger regeneration if needed (less ideal)
                    // regenerateSummary(currentSummaryLength); // You'd need a separate function
                }
            } else {
                console.log(`Summary language changed to ${newSummaryLang}, but previous result was an error. Not regenerating.`);
                // Optionally update the existing error message to reflect the language change intent?
                // Or clear the summary area? For now, do nothing.
                // summaryContent.innerHTML = `<p>${getText('languageChangedErrorInfo', 'Language changed. Submit again or change length to generate summary in the new language.')}</p>`;
            }
        } else if (isLoading){
            console.log(`Summary language changed to ${newSummaryLang}, but process is busy. New language will be used on next generation.`);
            // Update loading text only if necessary and if it makes sense contextually
            // updateLoadingState(getText('loadingDefault', 'Analyzing...'), parseInt(progressBar.style.width || '0'));
        } else {
            console.log(`Summary language changed to ${newSummaryLang}. Will be used when 'Generate Summary' is clicked.`);
        }
    });
    
    // Applies translations ONCE on initial page load
    function applyTranslations(lang) {
        initialPageLang = lang; // Store the language used for the UI
        document.documentElement.lang = lang; // Update html lang attribute
        
        // Helper function to safely update text content/HTML/attributes using getText
        // It now uses the stored initialPageLang via getText implicitly
        const setText = (selector, key, fallback) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = getText(key, fallback || '');
            else console.warn(`Element not found for selector '${selector}' during initial translation`);
        };
        const setHTML = (selector, key, fallback, prefix = '', suffix = '') => {
            const element = document.querySelector(selector);
            if (element) element.innerHTML = `${prefix}${getText(key, fallback || '')}${suffix}`;
            else console.warn(`Element not found for selector '${selector}' during initial translation`);
        };
        const setAttr = (selector, attr, key, fallback) => {
            const element = document.querySelector(selector);
            if (element) element.setAttribute(attr, getText(key, fallback || ''));
            else console.warn(`Element not found for selector '${selector}' during initial translation`);
        };
        const setPlaceh = (selector, key, fallback) => setAttr(selector, 'placeholder', key, fallback);
        const setTitle = (selector, key, fallback) => setAttr(selector, 'title', key, fallback);
        
        
        // --- Apply translations using helpers ---
        document.title = getText('title', "YouSummarize");
        setText('h1', 'h1', "YouTube Summary");
        setText('.max-w-3xl > p.text-subtle', 'heroP');
        setText('.max-w-3xl > p.font-semibold', 'heroBadge');
        setHTML('label[for="youtubeUrl"]', 'urlLabel', 'Paste your YouTube link here', '<i class="fas fa-link accent" aria-hidden="true"></i> ');
        setPlaceh('#youtubeUrl', 'urlPlaceholder', 'https://www.youtube.com/watch?v=...');
        setText('#youtubeForm p.text-xs', 'urlHelp');
        setHTML('#summarizeBtn', 'submitBtn', 'Generate Summary', '<i class="fas fa-magic" aria-hidden="true"></i> ');
        setText('label[for="language"]', 'languageLabel', 'Summary Language:'); // Updated label text key
        setText('.popular-examples h3', 'exampleTitle', 'Or try an example:');
        setText('#loadingText', 'loadingDefault', 'Analyzing...'); // Default loading text
        setText('#loadingState p.text-xs', 'loadingFewSecs', 'This may take a few seconds.');
        setText('#results h2.font-serif', 'videoInfoTitle', 'Generated Summary');
        setHTML('#copyBtn', 'copyBtn', 'Copy', '<i class="far fa-copy" aria-hidden="true"></i> ');
        setTitle('#copyBtn', 'copyBtn', 'Copy'); // Add title attribute too
        setHTML('#downloadBtn', 'downloadBtn', 'PDF', '<i class="fas fa-download" aria-hidden="true"></i> ');
        setTitle('#downloadBtn', 'downloadBtn', 'PDF'); // Add title attribute too
        setText('.summary-length .text-xs', 'lengthLabel', 'Detail Level:'); // Updated label text key
        setText('.btn-option[data-length="short"]', 'lengthShort', 'Short');
        setText('.btn-option[data-length="medium"]', 'lengthMedium', 'Medium');
        setText('.btn-option[data-length="long"]', 'lengthLong', 'Detailed');
        
        // Features Section
        setText('#how-and-why-title', 'howWhyTitle');
        document.querySelectorAll('.feature-card').forEach((card, index) => {
            setText(card.querySelector('h3'), `feature${index+1}Title`);
            setText(card.querySelector('p'), `feature${index+1}Desc`);
        });
        
        // FAQ Section
        setText('#faq-title', 'faqTitle');
        // Potentially translate FAQ items if they have data-translate-key attributes
        
        // CTA Section
        setText('#final-cta-title', 'ctaTitle');
        setText('.cta-container p.text-lg', 'ctaP');
        setText('.cta-actions a.btn-primary', 'ctaBtn'); // More specific selector for main CTA button
        setText('.cta-container p.text-xs', 'ctaHelp');
        
        // Newsletter Section
        setText('.newsletter h3', 'newsletterTitle');
        setText('.newsletter-description', 'newsletterP');
        setPlaceh('.newsletter-input', 'newsletterEmail');
        setText('.newsletter-button', 'newsletterBtn');
        
        // Footer
        const footerByLink = document.querySelector('footer a[href*="github.com/jp-fix"]');
        if (footerByLink && footerByLink.previousSibling && footerByLink.previousSibling.nodeType === Node.TEXT_NODE) {
            footerByLink.previousSibling.textContent = ` ${getText('footerBy', 'by')} `;
        }
        document.querySelectorAll('footer .footer-links a').forEach((link, index) => {
            const keys = ['footerApi', 'footerPrivacy', 'footerTerms', 'footerContact', 'footerSitemap'];
            if (keys[index]) {
                setText(link, keys[index]);
            }
        });
        
        // Update BuyMeACoffee message if widget exists
        const bmcWidget = document.querySelector('.bmc-widget-container');
        if (bmcWidget && bmcWidget.dataset) {
            bmcWidget.dataset.message = getText('bmcMessage');
        }
        
        // Update paste button title if it was disabled
        if (pasteButton && pasteButton.disabled) {
            setTitle('#pasteButton', 'pasteButtonDisabledTitle', "Feature unavailable (HTTPS required)");
        }
        
        // Update Web Share API button text if it exists
        const nativeShareSpan = document.querySelector('[data-translate-key="shareNative"]');
        if(nativeShareSpan) {
            nativeShareSpan.textContent = getText('shareNative', 'Share (Native)');
        }
    }
    
    
    // --- Initialisation ---
    
    // Detect browser language and set initial UI language ONCE
    function detectBrowserLanguageAndSetUI() {
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0]; // Use base language code (e.g., 'en')
        
        let initialLang = 'en'; // Default to English
        if (translations[langCode]) { // Check if we have translations for the detected language
            initialLang = langCode;
        }
        
        // Set the dropdown to match the initial UI language by default
        if (Array.from(languageSelect.options).some(option => option.value === initialLang)) {
            languageSelect.value = initialLang;
        } else {
            // If detected lang not in dropdown, default dropdown to 'en' but keep UI translated if possible
            languageSelect.value = 'en';
        }
        
        // Apply translations for the entire UI based on the determined initial language
        applyTranslations(initialLang);
        console.log(`Initial UI language set to: ${initialLang}. Summary language default: ${languageSelect.value}`);
    }
    
    // Set current year in footer
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    
    // Run initial setup
    detectBrowserLanguageAndSetUI(); // Sets initial UI lang and applies translations
    resetUI(); // Reset dynamic parts of the UI
    
    console.log("YouSummarize App Initialized.");
    
}); // End DOMContentLoaded