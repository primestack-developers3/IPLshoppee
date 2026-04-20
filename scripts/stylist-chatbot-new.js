// Reyval Personal Stylist Chatbot
class ReyvalStylist {
    constructor() {
        this.currentStep = 0;
        this.userPreferences = {};
        this.questions = [
            {
                key: 'occasion',
                question: 'What occasion are you dressing for? (formal, casual, party, wedding, office, travel, etc.)',
                options: ['formal', 'casual', 'party', 'wedding', 'office', 'travel', 'sports', 'date']
            },
            {
                key: 'gender',
                question: 'Are you shopping for men, women, or children?',
                options: ['men', 'women', 'children']
            },
            {
                key: 'ageGroup',
                question: 'What age group? (teen, young adult, adult, senior)',
                options: ['teen', 'young adult', 'adult', 'senior']
            },
            {
                key: 'style',
                question: 'What style appeals to you? (modern, traditional, streetwear, luxury, minimal)',
                options: ['modern', 'traditional', 'streetwear', 'luxury', 'minimal']
            },
            {
                key: 'color',
                question: 'Preferred color palette? (dark, light, bold, neutral)',
                options: ['dark', 'light', 'bold', 'neutral']
            },
            {
                key: 'budget',
                question: 'What\'s your budget range? (low, medium, high, premium) - Optional',
                options: ['low', 'medium', 'high', 'premium'],
                optional: true
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
        const lowerInput = input.toLowerCase();

        // Handle special commands
        if (lowerInput.includes('back') || lowerInput.includes('previous')) {
            this.goBack();
            return;
        }

        if (lowerInput.includes('skip') && this.questions[this.currentStep]?.optional) {
            this.skipQuestion();
            return;
        }

        if (lowerInput.includes('reset') || lowerInput.includes('start over')) {
            this.reset();
            return;
        }

        if (this.currentStep < this.questions.length) {
            const question = this.questions[this.currentStep];
            this.userPreferences[question.key] = input.toLowerCase();

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

    reset() {
        this.currentStep = 0;
        this.userPreferences = {};
        this.addMessage('Let\'s start fresh. What occasion are you dressing for?', false, true);
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
        const topProducts = products.filter(p => p.category === gender && p.name.toLowerCase().includes('shirt') || p.name.toLowerCase().includes('dress') || p.name.toLowerCase().includes('top'));
        const bottomProducts = products.filter(p => p.category === gender && (p.name.toLowerCase().includes('pants') || p.name.toLowerCase().includes('jeans') || p.name.toLowerCase().includes('skirt')));
        const accessoryProducts = products.filter(p => p.category === 'accessories');

        // Base outfit generation logic
        let outfit = {
            top: '',
            bottom: '',
            footwear: '',
            accessories: '',
            explanation: '',
            alternative: '',
            products: []
        };

        // Top wear
        if (gender === 'men') {
            if (occasion === 'formal') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('shirt'))?.name || 'Tailored dress shirt in crisp white';
            } else if (occasion === 'casual') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('tshirt') || p.name.toLowerCase().includes('polo'))?.name || 'Premium cotton polo shirt';
            } else if (occasion === 'party') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('shirt'))?.name || 'Designer button-up shirt';
            } else {
                outfit.top = topProducts[0]?.name || 'Classic t-shirt with subtle patterns';
            }
        } else if (gender === 'women') {
            if (occasion === 'formal') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('dress'))?.name || 'Elegant silk blouse';
            } else if (occasion === 'casual') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('dress'))?.name || 'Flowy tunic top';
            } else if (occasion === 'party') {
                outfit.top = topProducts.find(p => p.name.toLowerCase().includes('dress'))?.name || 'Sequined cocktail dress';
            } else {
                outfit.top = topProducts[0]?.name || 'Chic blouse with delicate details';
            }
        } else { // children
            outfit.top = 'Comfortable cotton t-shirt';
        }

        // Bottom wear
        if (gender === 'men') {
            if (occasion === 'formal') {
                outfit.bottom = bottomProducts[0]?.name || 'Tailored wool trousers';
            } else if (occasion === 'casual') {
                outfit.bottom = 'Designer jeans';
            } else {
                outfit.bottom = 'Chinos in neutral tones';
            }
        } else if (gender === 'women') {
            if (occasion === 'formal') {
                outfit.bottom = 'Pencil skirt or tailored pants';
            } else if (occasion === 'casual') {
                outfit.bottom = 'High-waisted jeans';
            } else {
                outfit.bottom = 'Flowy maxi skirt';
            }
        } else {
            outfit.bottom = 'Comfortable shorts or pants';
        }

        // Footwear
        if (occasion === 'formal') {
            outfit.footwear = 'Polished leather shoes';
        } else if (occasion === 'casual') {
            outfit.footwear = 'Premium sneakers';
        } else if (occasion === 'party') {
            outfit.footwear = 'Elegant heels or dress shoes';
        } else {
            outfit.footwear = 'Comfortable loafers';
        }

        // Accessories
        if (occasion === 'formal') {
            outfit.accessories = accessoryProducts[0]?.name || 'Minimalist watch and cufflinks';
        } else if (occasion === 'party') {
            outfit.accessories = accessoryProducts[0]?.name || 'Statement jewelry and clutch';
        } else {
            outfit.accessories = accessoryProducts[0]?.name || 'Subtle necklace and bracelet';
        }

        // Explanation
        outfit.explanation = `This ensemble perfectly balances ${style} aesthetics with ${color} tones, ideal for a ${occasion} setting while maintaining Reyval's signature elegance and sophistication.`;

        // Alternative
        outfit.alternative = `Consider a monochromatic version in ${color === 'dark' ? 'light' : 'dark'} tones for a different sophisticated look.`;

        // Add products to showcase
        outfit.products = products.slice(0, 3);

        return outfit;
    }

    getRelevantProducts(prefs) {
        const { gender, occasion, budget } = prefs;
        const products = window.REYVAL_CATALOG.products || [];

        // Filter by gender
        let relevantProducts = products.filter(p => p.category === gender);

        // If no products for specific gender, get general ones
        if (relevantProducts.length === 0) {
            relevantProducts = products;
        }

        // Filter by budget if specified
        if (budget) {
            const budgetRanges = {
                'low': [0, 300],
                'medium': [300, 600],
                'high': [600, 1000],
                'premium': [1000, Infinity]
            };
            const [min, max] = budgetRanges[budget] || [0, Infinity];
            relevantProducts = relevantProducts.filter(p => p.price >= min && p.price <= max);
        }

        // Shuffle and return
        return relevantProducts.sort(() => Math.random() - 0.5);
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
        } else {
            this.addMessage('I\'m here to assist with your fashion needs. Would you like to see more products, start a new recommendation, or explore our collection?', false, true);
            this.enableInput();
        }
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