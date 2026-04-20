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
            };
        } else {
            this.micBtn.style.display = 'none';
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
            voice.name.includes('Samantha')
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        this.speechSynthesis.speak(utterance);
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

    askNextQuestion() {
        const question = this.questions[this.currentStep];
        let questionText = `<p>${question.question}</p>`;

        if (question.options) {
            questionText += '<p><em>Suggestions: ' + question.options.join(', ') + '</em></p>';
        }

        this.addMessage(questionText);
        this.enableInput();
    }

    generateRecommendation() {
        const prefs = this.userPreferences;
        const outfit = this.createOutfit(prefs);

        let recommendation = `
            <div class="outfit-recommendation">
                <h3>👗 Recommended Outfit:</h3>
                <div class="outfit-item"><strong>Top wear:</strong> ${outfit.top}</div>
                <div class="outfit-item"><strong>Bottom wear:</strong> ${outfit.bottom}</div>
                <div class="outfit-item"><strong>Footwear:</strong> ${outfit.footwear}</div>
                <div class="outfit-item"><strong>Accessories:</strong> ${outfit.accessories}</div>
            </div>
            <p><strong>💡 Why it works:</strong> ${outfit.explanation}</p>
            <p><strong>🔁 Alternative option:</strong> ${outfit.alternative}</p>
            <p>Styled for elegance, a perfect royal choice. Would you like me to suggest something else or show you the products?</p>
        `;

        this.addMessage(recommendation);
        this.enableInput();
    }

    createOutfit(prefs) {
        const { occasion, gender, ageGroup, style, color, budget } = prefs;

        // Base outfit generation logic
        let outfit = {
            top: '',
            bottom: '',
            footwear: '',
            accessories: '',
            explanation: '',
            alternative: ''
        };

        // Top wear
        if (gender === 'men') {
            if (occasion === 'formal') {
                outfit.top = 'Tailored dress shirt in crisp white';
            } else if (occasion === 'casual') {
                outfit.top = 'Premium cotton polo shirt';
            } else if (occasion === 'party') {
                outfit.top = 'Designer button-up shirt';
            } else {
                outfit.top = 'Classic t-shirt with subtle patterns';
            }
        } else if (gender === 'women') {
            if (occasion === 'formal') {
                outfit.top = 'Elegant silk blouse';
            } else if (occasion === 'casual') {
                outfit.top = 'Flowy tunic top';
            } else if (occasion === 'party') {
                outfit.top = 'Sequined cocktail top';
            } else {
                outfit.top = 'Chic blouse with delicate details';
            }
        } else { // children
            outfit.top = 'Comfortable cotton t-shirt';
        }

        // Bottom wear
        if (gender === 'men') {
            if (occasion === 'formal') {
                outfit.bottom = 'Tailored wool trousers';
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
            outfit.accessories = 'Minimalist watch and cufflinks';
        } else if (occasion === 'party') {
            outfit.accessories = 'Statement jewelry and clutch';
        } else {
            outfit.accessories = 'Subtle necklace and bracelet';
        }

        // Explanation
        outfit.explanation = `This ensemble perfectly balances ${style} aesthetics with ${color} tones, ideal for a ${occasion} setting while maintaining Reyval's signature elegance.`;

        // Alternative
        outfit.alternative = `Consider a monochromatic version in ${color === 'dark' ? 'light' : 'dark'} tones for a different sophisticated look.`;

        return outfit;
    }

    handleFollowUp(input) {
        const lowerInput = input.toLowerCase();

        if (lowerInput.includes('yes') || lowerInput.includes('show') || lowerInput.includes('products')) {
            this.showProducts();
        } else if (lowerInput.includes('no') || lowerInput.includes('different') || lowerInput.includes('another')) {
            this.currentStep = 0;
            this.userPreferences = {};
            this.addMessage('Very well, let us curate a new ensemble. What occasion shall we prepare for?');
            this.enableInput();
        } else {
            this.addMessage('I\'m here to assist with your fashion needs. Would you like to see the recommended products or try a different style?');
            this.enableInput();
        }
    }

    showProducts() {
        // Get products from catalog based on preferences
        const products = this.getRelevantProducts();

        let productHTML = '<p>Here are some exquisite pieces from our collection:</p>';

        products.forEach(product => {
            productHTML += `
                <div class="product-card">
                    <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                    <div class="product-info">
                        <h4>${product.name}</h4>
                        <p>₹${product.price} (${product.categoryLabel})</p>
                    </div>
                </div>
            `;
        });

        productHTML += '<p>Would you like to explore more options or start a new recommendation?</p>';

        this.addMessage(productHTML);
        this.enableInput();
    }

    getRelevantProducts() {
        const { gender } = this.userPreferences;
        const products = window.REYVAL_CATALOG.products || [];

        // Filter products by gender/category
        const categoryMap = {
            'men': 'men',
            'women': 'women',
            'children': 'children'
        };

        const category = categoryMap[gender] || 'men';
        const relevantProducts = products.filter(p => p.category === category).slice(0, 3);

        return relevantProducts.length > 0 ? relevantProducts : products.slice(0, 3);
    }
}

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReyvalStylist();
});