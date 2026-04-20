// Reyval Personal Stylist Chatbot
class ReyvalStylist {
    constructor() {
        this.currentStep = 0;
        this.userPreferences = {};
        this.conversationHistory = [];
        this.questions = [
            {
                key: 'occasion',
                question: 'What occasion are you dressing for? (formal, casual, party, wedding, office, travel, etc.)',
                options: ['formal', 'casual', 'party', 'wedding', 'office', 'travel', 'sports', 'date', 'business', 'vacation'],
                keywords: {
                    'formal': ['formal', 'business', 'meeting', 'presentation', 'interview', 'ceremony'],
                    'casual': ['casual', 'everyday', 'relaxed', 'comfortable', 'weekend'],
                    'party': ['party', 'celebration', 'event', 'night out', 'dinner', 'club'],
                    'wedding': ['wedding', 'marriage', 'reception', 'bridal'],
                    'office': ['office', 'work', 'professional', 'corporate'],
                    'travel': ['travel', 'vacation', 'trip', 'journey', 'holiday'],
                    'sports': ['sports', 'gym', 'workout', 'exercise', 'active'],
                    'date': ['date', 'romantic', 'dinner date', 'special night'],
                    'business': ['business', 'meeting', 'presentation', 'corporate'],
                    'vacation': ['vacation', 'holiday', 'beach', 'resort', 'leisure']
                }
            },
            {
                key: 'gender',
                question: 'Are you shopping for men, women, or children?',
                options: ['men', 'women', 'children'],
                keywords: {
                    'men': ['men', 'male', 'man', 'gentleman', 'boy'],
                    'women': ['women', 'female', 'woman', 'lady', 'girl'],
                    'children': ['children', 'kids', 'child', 'kid', 'baby', 'teen']
                }
            },
            {
                key: 'ageGroup',
                question: 'What age group? (teen, young adult, adult, senior)',
                options: ['teen', 'young adult', 'adult', 'senior'],
                keywords: {
                    'teen': ['teen', 'teenager', '13-19', 'adolescent'],
                    'young adult': ['young adult', '20-35', 'young', 'millennial'],
                    'adult': ['adult', '35-55', 'mature', 'middle-aged'],
                    'senior': ['senior', 'elderly', '55+', 'older']
                }
            },
            {
                key: 'style',
                question: 'What style appeals to you? (modern, traditional, streetwear, luxury, minimal, bohemian, classic)',
                options: ['modern', 'traditional', 'streetwear', 'luxury', 'minimal', 'bohemian', 'classic'],
                keywords: {
                    'modern': ['modern', 'contemporary', 'current', 'trendy', 'fashionable'],
                    'traditional': ['traditional', 'classic', 'timeless', 'conservative'],
                    'streetwear': ['streetwear', 'urban', 'hip-hop', 'casual', 'edgy'],
                    'luxury': ['luxury', 'premium', 'high-end', 'elegant', 'sophisticated'],
                    'minimal': ['minimal', 'simple', 'clean', 'understated', 'basic'],
                    'bohemian': ['bohemian', 'boho', 'free-spirited', 'artsy', 'flowy'],
                    'classic': ['classic', 'timeless', 'elegant', 'refined', 'sophisticated']
                }
            },
            {
                key: 'color',
                question: 'Preferred color palette? (dark, light, bold, neutral, pastel, monochromatic)',
                options: ['dark', 'light', 'bold', 'neutral', 'pastel', 'monochromatic'],
                keywords: {
                    'dark': ['dark', 'black', 'navy', 'charcoal', 'deep', 'rich'],
                    'light': ['light', 'white', 'cream', 'beige', 'bright'],
                    'bold': ['bold', 'vibrant', 'colorful', 'bright', 'statement'],
                    'neutral': ['neutral', 'beige', 'gray', 'taupe', 'earth tones'],
                    'pastel': ['pastel', 'soft', 'gentle', 'light colors', 'subtle'],
                    'monochromatic': ['monochromatic', 'single color', 'tonal', 'same color']
                }
            },
            {
                key: 'budget',
                question: 'What\'s your budget range? (low, medium, high, premium) - Optional',
                options: ['low', 'medium', 'high', 'premium'],
                optional: true,
                keywords: {
                    'low': ['low', 'budget', 'affordable', 'cheap', 'under 500'],
                    'medium': ['medium', 'moderate', 'reasonable', '500-1000'],
                    'high': ['high', 'expensive', 'luxury', '1000-2000'],
                    'premium': ['premium', 'high-end', 'luxury', 'over 2000']
                }
            }
        ];

        this.init();
        this.initVoice();
        this.loadPreferences();
    }

    init() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.micBtn = document.getElementById('mic-btn');

        this.sendBtn.addEventListener('click', () => this.handleUserInput());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUserInput();
        });
        this.micBtn.addEventListener('click', () => this.toggleVoiceInput());

        this.enableInput();
    }

    initVoice() {
        // Check for browser support
        this.speechSynthesis = window.speechSynthesis;
        this.speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (this.speechRecognition) {
            this.recognition = new this.speechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.chatInput.value = transcript;
                this.handleUserInput();
            };

            this.recognition.onend = () => {
                this.micBtn.classList.remove('listening');
                this.micBtn.disabled = false;
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.micBtn.classList.remove('listening');
                this.micBtn.disabled = false;
                this.addMessage('I didn\'t catch that. Could you please type or try speaking again?', false, false);
                this.enableInput();
            };
        } else {
            this.micBtn.style.display = 'none';
        }

        // Stop speech when user starts speaking
        if (this.speechRecognition) {
            this.recognition.onstart = () => {
                if (this.speechSynthesis.speaking) {
                    this.speechSynthesis.cancel();
                }
            };
        }
    }

    toggleVoiceInput() {
        if (!this.recognition) return;

        if (this.micBtn.classList.contains('listening')) {
            this.recognition.stop();
        } else {
            this.micBtn.classList.add('listening');
            this.micBtn.disabled = true;
            this.recognition.start();
        }
    }

    addMessage(content, isUser = false, speak = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content;

        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        if (!isUser && speak && this.speechSynthesis) {
            this.speakText(content.replace(/<[^>]*>/g, ''));
        }
    }

    speakText(text) {
        if (!this.speechSynthesis) return;

        // Stop any ongoing speech
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 0.9;
        utterance.volume = 0.8;

        // Try to find a smooth, calm voice
        const voices = this.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice =>
            voice.name.includes('Female') ||
            voice.name.includes('Google') ||
            voice.name.includes('Samantha') ||
            voice.name.includes('Zira')
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.speechSynthesis.speak(utterance);
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot-message typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    enableInput() {
        this.chatInput.disabled = false;
        this.sendBtn.disabled = false;
        this.micBtn.disabled = false;
        this.chatInput.focus();
    }

    disableInput() {
        this.chatInput.disabled = true;
        this.sendBtn.disabled = true;
        this.micBtn.disabled = true;
    }

    handleUserInput() {
        const input = this.chatInput.value.trim();
        if (!input) return;

        this.addMessage(input, true, false);
        this.chatInput.value = '';
        this.disableInput();

        setTimeout(() => {
            this.processInput(input);
        }, 500);
    }

    processInput(input) {
        const lowerInput = input.toLowerCase().trim();
        this.conversationHistory.push({ input: input, timestamp: new Date() });

        // Handle special commands
        if (this.handleSpecialCommands(lowerInput)) return;

        if (this.currentStep < this.questions.length) {
            const question = this.questions[this.currentStep];
            const processedInput = this.processNaturalLanguageInput(lowerInput, question);
            this.userPreferences[question.key] = processedInput;

            this.currentStep++;

            if (this.currentStep < this.questions.length) {
                this.askNextQuestion();
            } else {
                this.generateRecommendation();
            }
        } else {
            // Handle follow-up conversations
            this.handleFollowUp(input);
        }
    }

    handleSpecialCommands(input) {
        if (input.includes('back') || input.includes('previous') || input.includes('change')) {
            this.goBack();
            return true;
        }

        if (input.includes('skip') && this.questions[this.currentStep] && this.questions[this.currentStep].optional) {
            this.skipQuestion();
            return true;
        }

        if (input.includes('reset') || input.includes('start over') || input.includes('restart')) {
            this.reset();
            return true;
        }

        if (input.includes('help') || input.includes('what can you do')) {
            this.showHelp();
            return true;
        }

        return false;
    }

    processNaturalLanguageInput(input, question) {
        // First check for exact matches with options
        for (const option of question.options) {
            if (input.includes(option)) {
                return option;
            }
        }

        // Check keywords for each option
        if (question.keywords) {
            for (const [option, keywords] of Object.entries(question.keywords)) {
                for (const keyword of keywords) {
                    if (input.includes(keyword)) {
                        return option;
                    }
                }
            }
        }

        // For occasion, try to infer from context
        if (question.key === 'occasion') {
            return this.inferOccasion(input);
        }

        // For other questions, try to find closest match or return first option as default
        return question.options[0];
    }

    inferOccasion(input) {
        const occasionKeywords = {
            'formal': ['meeting', 'business', 'interview', 'presentation', 'ceremony', 'dinner party', 'black tie'],
            'casual': ['everyday', 'weekend', 'relaxed', 'home', 'shopping', 'coffee'],
            'party': ['celebration', 'birthday', 'event', 'night out', 'club', 'bar', 'dance'],
            'wedding': ['wedding', 'marriage', 'reception', 'bridal', 'groom'],
            'office': ['office', 'work', 'corporate', 'professional', 'meeting'],
            'travel': ['travel', 'vacation', 'trip', 'flight', 'beach', 'resort'],
            'sports': ['gym', 'workout', 'running', 'sports', 'active', 'exercise'],
            'date': ['date', 'romantic', 'dinner', 'special', 'anniversary']
        };

        for (const [occasion, keywords] of Object.entries(occasionKeywords)) {
            for (const keyword of keywords) {
                if (input.includes(keyword)) {
                    return occasion;
                }
            }
        }

        return 'casual'; // Default fallback
    }

    goBack() {
        if (this.currentStep > 0) {
            this.currentStep--;
            const question = this.questions[this.currentStep];
            delete this.userPreferences[question.key];
            this.addMessage('Let\'s go back. ' + question.question, false, true);
            this.enableInput();
        } else {
            this.addMessage('We\'re at the beginning. What occasion are you dressing for?', false, true);
            this.enableInput();
        }
    }

    skipQuestion() {
        const question = this.questions[this.currentStep];
        if (question.optional) {
            this.currentStep++;
            if (this.currentStep < this.questions.length) {
                this.askNextQuestion();
            } else {
                this.generateRecommendation();
            }
        } else {
            this.addMessage('This question is required. ' + question.question, false, true);
            this.enableInput();
        }
    }

    showHelp() {
        const helpMessage = `
            <p>I'm here to help you find the perfect Reyval ensemble! Here's what I can do:</p>
            <ul>
                <li><strong>Style Recommendations:</strong> Tell me about your occasion, preferences, and I'll curate outfits</li>
                <li><strong>Navigation:</strong> Say "back" to change previous answers, "skip" for optional questions</li>
                <li><strong>Commands:</strong> "reset" to start over, "help" to see this message</li>
                <li><strong>More Options:</strong> After recommendations, ask for "more products" or "different style"</li>
            </ul>
            <p>What would you like to do?</p>
        `;
        this.addMessage(helpMessage, false, true);
        this.enableInput();
    }

    askNextQuestion() {
        const question = this.questions[this.currentStep];
        let questionText = `<p>${question.question}</p>`;

        if (question.options) {
            questionText += '<p><em>Suggestions: ' + question.options.join(', ') + '</em></p>';
        }

        if (this.currentStep > 0) {
            questionText += '<p><em>You can say "back" to go to the previous question, or "skip" if optional.</em></p>';
        }

        this.addMessage(questionText);
        this.enableInput();
    }

    generateRecommendation() {
        this.showTypingIndicator();

        setTimeout(() => {
            this.hideTypingIndicator();
            const outfit = this.createOutfit(this.userPreferences);
            this.savePreferences();

            let recommendation = `
                <div class="outfit-recommendation">
                    <h3>👗 Your Perfect Reyval Ensemble</h3>
                    <div class="outfit-item"><strong>Top wear:</strong> ${outfit.top}</div>
                    <div class="outfit-item"><strong>Bottom wear:</strong> ${outfit.bottom}</div>
                    <div class="outfit-item"><strong>Footwear:</strong> ${outfit.footwear}</div>
                    <div class="outfit-item"><strong>Accessories:</strong> ${outfit.accessories}</div>
                </div>
                <p><strong>💡 Why it works:</strong> ${outfit.explanation}</p>
                <p><strong>🔁 Alternative option:</strong> ${outfit.alternative}</p>
                <div class="product-showcase">
                    ${outfit.products.map(product => `
                        <div class="product-card">
                            <img src="${product.imageUrl}" alt="${product.name}" class="product-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUVDIi8+Cjx0ZXh0IHg9IjMwIiB5PSIzMCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMERGRjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5PI0vdGV4dD4KPHN2Zz4='">
                            <div class="product-info">
                                <h4>${product.name}</h4>
                                <p>₹${product.price}</p>
                                <button class="shop-btn" onclick="window.open('${product.sourceUrl || '#'}', '_blank')">View Product</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <p>Would you like to see more options, start a new recommendation, or explore our collection? You can also say "back" to change your preferences.</p>
            `;

            this.addMessage(recommendation);
            this.enableInput();
        }, 2000); // Simulate thinking time
    }

    createOutfit(prefs) {
        const { occasion, gender, ageGroup, style, color, budget } = prefs;

        // Get relevant products from catalog
        const products = this.getRelevantProducts(prefs);
        const topProducts = products.filter(p => this.isTopWear(p, gender));
        const bottomProducts = products.filter(p => this.isBottomWear(p, gender));
        const accessoryProducts = products.filter(p => p.category === 'accessories');

        // Base outfit generation logic with more sophistication
        let outfit = {
            top: '',
            bottom: '',
            footwear: '',
            accessories: '',
            explanation: '',
            alternative: '',
            products: []
        };

        // Enhanced top wear selection
        outfit.top = this.selectTopWear(occasion, gender, ageGroup, style, color, topProducts);

        // Enhanced bottom wear selection
        outfit.bottom = this.selectBottomWear(occasion, gender, ageGroup, style, color, bottomProducts);

        // Enhanced footwear selection
        outfit.footwear = this.selectFootwear(occasion, gender, style, color);

        // Enhanced accessories selection
        outfit.accessories = this.selectAccessories(occasion, gender, style, color, accessoryProducts);

        // Generate sophisticated explanation
        outfit.explanation = this.generateExplanation(prefs);

        // Generate alternative suggestion
        outfit.alternative = this.generateAlternative(prefs);

        // Add products to showcase (up to 4 now)
        outfit.products = products.slice(0, 4);

        return outfit;
    }

    isTopWear(product, gender) {
        const name = (product.name || '').toLowerCase();
        const topKeywords = ['shirt', 'top', 'blouse', 'dress', 'jacket', 'sweater', 't-shirt', 'polo', 'kurti', 'tunic'];
        return topKeywords.some(keyword => name.includes(keyword));
    }

    isBottomWear(product, gender) {
        const name = (product.name || '').toLowerCase();
        const bottomKeywords = ['pants', 'jeans', 'trousers', 'skirt', 'shorts', 'leggings', 'palazzo'];
        return bottomKeywords.some(keyword => name.includes(keyword));
    }

    selectTopWear(occasion, gender, ageGroup, style, color, products) {
        let candidates = products;

        // Filter by occasion appropriateness
        if (occasion === 'formal') {
            candidates = candidates.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('shirt') || name.includes('blouse') || name.includes('dress');
            });
        } else if (occasion === 'casual') {
            candidates = candidates.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('t-shirt') || name.includes('polo') || name.includes('top');
            });
        }

        // Style-based selection
        if (style === 'luxury') {
            candidates = candidates.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('silk') || name.includes('premium') || (typeof p.price === 'number' && p.price > 800);
            });
        }

        if (candidates.length === 0) candidates = products;

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        return selected ? selected.name : this.getFallbackTopWear(occasion, gender, style);
    }

    selectBottomWear(occasion, gender, ageGroup, style, color, products) {
        let candidates = products;

        if (occasion === 'formal') {
            if (gender === 'men') {
                candidates = candidates.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    return name.includes('trouser') || name.includes('pants');
                });
            } else {
                candidates = candidates.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    return name.includes('skirt') || name.includes('pants');
                });
            }
        }

        if (candidates.length === 0) candidates = products;

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        return selected ? selected.name : this.getFallbackBottomWear(occasion, gender);
    }

    selectFootwear(occasion, gender, style, color) {
        const footwearOptions = {
            formal: {
                men: ['Polished leather oxfords', 'Classic leather loafers', 'Patent leather shoes'],
                women: ['Elegant heels', 'Classic pumps', 'Strappy sandals'],
                children: ['Polished school shoes', 'Smart loafers']
            },
            casual: {
                men: ['Premium sneakers', 'Canvas shoes', 'Loafers'],
                women: ['Comfortable sneakers', 'Ballet flats', 'Espadrilles'],
                children: ['Colorful sneakers', 'Casual sandals']
            },
            party: {
                men: ['Dress shoes', 'Leather boots', 'Designer sneakers'],
                women: ['Statement heels', 'Ankle boots', 'Platform shoes'],
                children: ['Sparkly shoes', 'Fun boots']
            }
        };

        const options = footwearOptions[occasion] || footwearOptions.casual;
        const genderOptions = options[gender] || options.men;
        return genderOptions[Math.floor(Math.random() * genderOptions.length)];
    }

    selectAccessories(occasion, gender, style, color, products) {
        let candidates = products;

        if (occasion === 'formal') {
            candidates = candidates.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('watch') || name.includes('tie') || name.includes('jewelry');
            });
        }

        if (candidates.length === 0) candidates = products;

        const selected = candidates.slice(0, 2).map(p => p.name);
        return selected.length > 0 ? selected.join(', ') : this.getFallbackAccessories(occasion, gender);
    }

    getFallbackTopWear(occasion, gender, style) {
        const fallbacks = {
            formal: { men: 'Tailored dress shirt', women: 'Silk blouse', children: 'Smart shirt' },
            casual: { men: 'Cotton polo shirt', women: 'Casual tunic', children: 'Fun t-shirt' },
            party: { men: 'Designer button-up', women: 'Sparkly top', children: 'Festive shirt' }
        };
        return fallbacks[occasion]?.[gender] || 'Stylish top';
    }

    getFallbackBottomWear(occasion, gender) {
        const fallbacks = {
            formal: { men: 'Wool trousers', women: 'Tailored pants', children: 'Dress pants' },
            casual: { men: 'Chinos', women: 'Denim jeans', children: 'Comfortable pants' },
            party: { men: 'Slim-fit trousers', women: 'Designer skirt', children: 'Smart shorts' }
        };
        return fallbacks[occasion]?.[gender] || 'Stylish bottoms';
    }

    getFallbackAccessories(occasion, gender) {
        const fallbacks = {
            formal: { men: 'Leather watch and tie', women: 'Pearl earrings', children: 'Smart bow tie' },
            casual: { men: 'Sports watch', women: 'Layered necklace', children: 'Fun backpack' },
            party: { men: 'Designer belt', women: 'Statement earrings', children: 'Colorful scarf' }
        };
        return fallbacks[occasion]?.[gender] || 'Stylish accessories';
    }

    generateExplanation(prefs) {
        const { occasion, gender, ageGroup, style, color } = prefs;

        let explanation = `This ensemble perfectly captures ${style} elegance for your ${occasion} occasion. `;

        if (color === 'monochromatic') {
            explanation += `The tonal color scheme creates a sophisticated, cohesive look. `;
        } else if (color === 'bold') {
            explanation += `The vibrant colors add personality while maintaining elegance. `;
        } else {
            explanation += `The ${color} palette provides the perfect balance of comfort and style. `;
        }

        explanation += `Designed for ${ageGroup} ${gender}, this outfit reflects Reyval's commitment to timeless fashion.`;

        return explanation;
    }

    generateAlternative(prefs) {
        const { occasion, style, color } = prefs;

        const alternatives = [
            `Consider a monochromatic version in ${color === 'dark' ? 'light' : 'dark'} tones for a different sophisticated look.`,
            `For a bolder statement, try incorporating metallic accents or patterns.`,
            `A layered approach with a lightweight jacket would add versatility for changing weather.`,
            `Mix textures by combining matte and shiny fabrics for added visual interest.`,
            `Try the same silhouette in a complementary color palette for variety.`
        ];

        return alternatives[Math.floor(Math.random() * alternatives.length)];
    }

    getRelevantProducts(prefs) {
        const { gender, occasion, budget, style, color, ageGroup } = prefs;
        const products = (window.REYVAL_CATALOG && window.REYVAL_CATALOG.products) || [];

        // Start with gender filtering
        let relevantProducts = products.filter(p => p.category === gender);

        // If no products for specific gender, get general ones
        if (relevantProducts.length === 0) {
            relevantProducts = products;
        }

        // Filter by budget if specified
        if (budget) {
            const budgetRanges = {
                'low': [0, 500],
                'medium': [500, 1000],
                'high': [1000, 2000],
                'premium': [2000, Infinity]
            };
            const [min, max] = budgetRanges[budget] || [0, Infinity];
            relevantProducts = relevantProducts.filter(p => p.price >= min && p.price <= max);
        }

        // Style-based filtering
        if (style) {
            relevantProducts = this.filterByStyle(relevantProducts, style);
        }

        // Occasion-based filtering
        if (occasion) {
            relevantProducts = this.filterByOccasion(relevantProducts, occasion, gender);
        }

        // Color preference (basic filtering based on product names)
        if (color) {
            relevantProducts = this.filterByColor(relevantProducts, color);
        }

        // Age group consideration (basic)
        if (ageGroup) {
            relevantProducts = this.filterByAgeGroup(relevantProducts, ageGroup);
        }

        // If we have too few products, relax constraints
        if (relevantProducts.length < 3) {
            relevantProducts = products.filter(p => p.category === gender);
            if (relevantProducts.length < 3) {
                relevantProducts = products;
            }
        }

        // Shuffle and return
        return relevantProducts.sort(() => Math.random() - 0.5);
    }

    filterByStyle(products, style) {
        const styleKeywords = {
            'luxury': ['premium', 'luxury', 'designer', 'silk', 'cashmere', 'leather'],
            'modern': ['modern', 'contemporary', 'sleek', 'minimal'],
            'traditional': ['classic', 'traditional', 'timeless', 'elegant'],
            'streetwear': ['street', 'urban', 'casual', 'edgy'],
            'minimal': ['minimal', 'simple', 'clean', 'basic'],
            'bohemian': ['boho', 'flowy', 'artsy', 'ethnic'],
            'classic': ['classic', 'timeless', 'refined']
        };

        const keywords = styleKeywords[style] || [];
        if (keywords.length === 0) return products;

        return products.filter(p => {
            const name = (p.name || '').toLowerCase();
            return keywords.some(keyword => name.includes(keyword)) || (typeof p.price === 'number' && p.price > (style === 'luxury' ? 800 : 0));
        });
    }

    filterByOccasion(products, occasion, gender) {
        const occasionKeywords = {
            'formal': ['formal', 'dress', 'suit', 'blazer', 'shirt', 'trouser', 'blouse'],
            'casual': ['casual', 't-shirt', 'jeans', 'polo', 'shorts', 'top'],
            'party': ['party', 'dress', 'shirt', 'skirt', 'jacket', 'heels'],
            'wedding': ['wedding', 'dress', 'suit', 'formal', 'elegant'],
            'office': ['office', 'shirt', 'trouser', 'blazer', 'professional'],
            'travel': ['travel', 'comfortable', 'casual', 'easy', 'practical'],
            'sports': ['sports', 'active', 'gym', 'comfortable', 'breathable'],
            'date': ['date', 'romantic', 'dress', 'shirt', 'elegant']
        };

        const keywords = occasionKeywords[occasion] || [];
        if (keywords.length === 0) return products;

        return products.filter(p => {
            const name = (p.name || '').toLowerCase();
            return keywords.some(keyword => name.includes(keyword));
        });
    }

    filterByColor(products, color) {
        const colorKeywords = {
            'dark': ['black', 'navy', 'charcoal', 'dark', 'midnight'],
            'light': ['white', 'cream', 'beige', 'light', 'pastel'],
            'bold': ['red', 'blue', 'green', 'yellow', 'bright', 'colorful'],
            'neutral': ['gray', 'beige', 'taupe', 'brown', 'neutral'],
            'pastel': ['pastel', 'light', 'soft', 'gentle'],
            'monochromatic': [] // No specific filtering for monochromatic
        };

        const keywords = colorKeywords[color] || [];
        if (keywords.length === 0) return products;

        return products.filter(p => {
            const name = (p.name || '').toLowerCase();
            return keywords.some(keyword => name.includes(keyword));
        });
    }

    filterByAgeGroup(products, ageGroup) {
        // Basic age group filtering based on product names and pricing
        switch (ageGroup) {
            case 'teen':
                return products.filter(p => typeof p.price === 'number' && p.price < 800 && (p.name || '').toLowerCase().includes('casual'));
            case 'young adult':
                return products; // No specific filtering
            case 'adult':
                return products.filter(p => typeof p.price === 'number' && p.price > 300);
            case 'senior':
                return products.filter(p => typeof p.price === 'number' && p.price > 500 && !(p.name || '').toLowerCase().includes('trendy'));
            default:
                return products;
        }
    }

    handleFollowUp(input) {
        const lowerInput = input.toLowerCase();

        if (lowerInput.includes('yes') || lowerInput.includes('show') || lowerInput.includes('products') || lowerInput.includes('more')) {
            this.showMoreProducts();
        } else if (lowerInput.includes('no') || lowerInput.includes('different') || lowerInput.includes('another') || lowerInput.includes('new')) {
            this.currentStep = 0;
            this.userPreferences = {};
            this.addMessage('Very well, let us curate a new ensemble. What occasion shall we prepare for?', false, true);
            this.enableInput();
        } else if (lowerInput.includes('explore') || lowerInput.includes('collection')) {
            this.addMessage('Excellent choice! Let me direct you to our main collection.', false, true);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else if (lowerInput.includes('cart') || lowerInput.includes('buy') || lowerInput.includes('purchase')) {
            this.addMessage('Wonderful! Let me take you to your shopping bag where you can review and complete your purchases.', false, true);
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 1000);
        } else if (lowerInput.includes('similar') || lowerInput.includes('like this') || lowerInput.includes('more like')) {
            this.generateSimilarRecommendation();
        } else if (lowerInput.includes('help') || lowerInput.includes('what can') || lowerInput.includes('options')) {
            this.showHelp();
        } else {
            // Try to understand natural language requests
            const understood = this.handleNaturalLanguageRequest(lowerInput);
            if (!understood) {
                this.addMessage('I\'m here to assist with your fashion needs. Would you like to see more products, start a new recommendation, explore our collection, or need help with anything specific?', false, true);
                this.enableInput();
            }
        }
    }

    handleNaturalLanguageRequest(input) {
        // Handle requests for specific categories
        if (input.includes('men') || input.includes('women') || input.includes('children')) {
            const category = input.includes('men') ? 'men' : input.includes('women') ? 'women' : 'children';
            this.addMessage(`Excellent choice! Let me show you our ${category} collection.`, false, true);
            setTimeout(() => {
                window.location.href = `${category}.html`;
            }, 1000);
            return true;
        }

        // Handle accessory requests
        if (input.includes('accessories') || input.includes('jewelry') || input.includes('bags')) {
            this.addMessage('Our accessories collection features exquisite pieces to complete any ensemble.', false, true);
            setTimeout(() => {
                window.location.href = 'accessories.html';
            }, 1000);
            return true;
        }

        // Handle search requests
        if (input.includes('search') || input.includes('find') || input.includes('look for')) {
            this.addMessage('Our search feature allows you to find specific items across our entire collection.', false, true);
            setTimeout(() => {
                window.location.href = 'search.html';
            }, 1000);
            return true;
        }

        return false;
    }

    generateSimilarRecommendation() {
        // Generate a similar recommendation based on current preferences
        this.showTypingIndicator();

        setTimeout(() => {
            this.hideTypingIndicator();
            const outfit = this.createOutfit(this.userPreferences); // Will generate different products due to randomization
            this.savePreferences();

            let recommendation = `
                <div class="outfit-recommendation">
                    <h3>👗 Similar Ensemble Recommendation</h3>
                    <div class="outfit-item"><strong>Top wear:</strong> ${outfit.top}</div>
                    <div class="outfit-item"><strong>Bottom wear:</strong> ${outfit.bottom}</div>
                    <div class="outfit-item"><strong>Footwear:</strong> ${outfit.footwear}</div>
                    <div class="outfit-item"><strong>Accessories:</strong> ${outfit.accessories}</div>
                </div>
                <p><strong>💡 Why it works:</strong> ${outfit.explanation}</p>
                <p><strong>🔁 Alternative option:</strong> ${outfit.alternative}</p>
                <div class="product-showcase">
                    ${outfit.products.map(product => `
                        <div class="product-card">
                            <img src="${product.imageUrl}" alt="${product.name}" class="product-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUVDIi8+Cjx0ZXh0IHg9IjMwIiB5PSIzMCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMERGRjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5PI0vdGV4dD4KPHN2Zz4K'>
                            <div class="product-info">
                                <h4>${product.name}</h4>
                                <p>₹${product.price}</p>
                                <button class="shop-btn" onclick="window.open('${product.sourceUrl || '#'}', '_blank')">View Product</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <p>Would you like to see more options, start a new recommendation, or explore our collection?</p>
            `;

            this.addMessage(recommendation);
            this.enableInput();
        }, 1500);
    }

    showMoreProducts() {
        const products = this.getRelevantProducts(this.userPreferences).slice(3, 6);

        if (products.length === 0) {
            this.addMessage('I\'ve shown you our best recommendations. Would you like to explore our full collection or start a new recommendation?', false, true);
            this.enableInput();
            return;
        }

        let productHTML = '<p>Here are some additional exquisite pieces that might interest you:</p>';
        productHTML += '<div class="product-showcase">';

        products.forEach(product => {
            productHTML += `
                <div class="product-card">
                    <img src="${product.imageUrl}" alt="${product.name}" class="product-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUVDIi8+Cjx0ZXh0IHg9IjMwIiB5PSIzMCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMERGRjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5PI0vdGV4dD4KPHN2Zz4='">
                    <div class="product-info">
                        <h4>${product.name}</h4>
                        <p>₹${product.price}</p>
                        <button class="shop-btn" onclick="window.open('${product.sourceUrl || '#'}', '_blank')">View Product</button>
                    </div>
                </div>
            `;
        });

        productHTML += '</div><p>Would you like to see more or start a new recommendation?</p>';

        this.addMessage(productHTML);
        this.enableInput();
    }

    savePreferences() {
        try {
            localStorage.setItem('reyval-stylist-preferences', JSON.stringify(this.userPreferences));
        } catch (e) {
            console.warn('Could not save preferences to localStorage');
        }
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem('reyval-stylist-preferences');
            if (saved) {
                this.userPreferences = JSON.parse(saved);
                this.addMessage('Welcome back! I remember your preferences. Would you like to use them for a new recommendation or start fresh?', false, false);
            }
        } catch (e) {
            console.warn('Could not load preferences from localStorage');
        }
    }
}

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReyvalStylist();
});