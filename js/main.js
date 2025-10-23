document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialize Lenis (guard for global availability)
    const LenisCtor = window.Lenis;
    let lenis = null;
    if (typeof LenisCtor === 'function') {
        lenis = new LenisCtor({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothTouch: true,
        });
    } else {
        console.warn('Lenis is not available; falling back to native smooth scrolling.');
        // Enable native smooth behavior
        if ('scrollBehavior' in document.documentElement.style) {
            document.documentElement.style.scrollBehavior = 'smooth';
        }
    }

    // 2. Lenis Scroll Frame Loop (Request Animation Frame)
    // This is the absolute core of making Lenis work.
    if (lenis) {
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
    
    // 3. Mobile Menu Toggle
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navbar = document.querySelector('.navbar');
    const closeWithEscape = (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    };
    
    const closeMenu = () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.removeEventListener('keydown', closeWithEscape);
    };
    
    const openMenu = () => {
        navToggle.classList.add('active');
        navMenu.classList.add('active');
        document.addEventListener('keydown', closeWithEscape);
    };
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Menu toggle clicked'); // Debug log
            
            if (navMenu.classList.contains('active')) {
                closeMenu();
                console.log('Menu closed');
            } else {
                openMenu();
                console.log('Menu opened');
            }
        });
        
        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navbar.contains(e.target) && navMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    }
    
    // 4. Navbar scroll effect
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScrollY = currentScrollY;
    });
    
    
    // 3. Setup Elements and Logic
    
    // Use the official Lenis scroll event to handle all logic
    const handleScrollUpdate = (eventLike) => {
        // You can check if Lenis is active by logging to the console:
        // console.log('Lenis is scrolling!', event.scroll); 
        
        const sections = document.querySelectorAll('.section');
        const navLinks = document.querySelectorAll('.nav-link');
        const indicatorDots = document.querySelectorAll('.dot');
        const progressBar = document.querySelector('.progress-bar');
        
        const scrollPosition = lenis ? eventLike.scroll : window.scrollY;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? scrollPosition / totalHeight : 0;
        
        // Update Scroll Progress Bar
        if (progressBar) {
            progressBar.style.width = `${progress * 100}%`;
        }

        let activeIndex = 0;
        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            
            // Logic for scroll-reveal class (.active)
            if (rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
                if (!section.classList.contains('active')) {
                    section.classList.add('active');
                }
            } else {
                section.classList.remove('active');
            }

            // Logic for indicator activation
            if (rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5) {
                activeIndex = index;
            }
        });
        
        // Update Visual Indicators
        indicatorDots.forEach((dot, index) => {
            dot.classList.remove('active');
            if (index === activeIndex) {
                dot.classList.add('active');
            }
        });
        
        // Update Nav Links
        navLinks.forEach(link => link.classList.remove('active'));
        const targetId = sections[activeIndex].id;
        const activeLink = document.querySelector(`.nav-link[href="#${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');
    };
    if (lenis) {
        lenis.on('scroll', handleScrollUpdate);
    } else {
        window.addEventListener('scroll', () => handleScrollUpdate({ scroll: window.scrollY }));
    }

    // 4. Navigation Handlers (Uses Lenis.scrollTo)
    
    document.querySelectorAll('.dot, .nav-link').forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            
            let targetElement;
            
            if (element.classList.contains('dot')) {
                const index = parseInt(element.dataset.sectionIndex);
                targetElement = document.querySelectorAll('.section')[index];
            } else {
                targetElement = document.querySelector(element.getAttribute('href'));
            }
            
            if (targetElement) {
                if (lenis) {
                    // Offset accounts for fixed navbar height (60px)
                    lenis.scrollTo(targetElement, { duration: 1.5, offset: -59 });
                } else {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // 5. Firebase Contact Form Handler
    const contactForm = document.getElementById('contact-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');
    const formMessage = document.getElementById('form-message');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();
            
            // Validate form
            if (!name || !email || !message) {
                showMessage('Please fill in all fields.', 'error');
                return;
            }
            
            if (!isValidEmail(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }
            
            // Show loading state
            setLoading(true);
            hideMessage();
            
            try {
                // Check if Firebase is available
                if (!window.firebase) {
                    throw new Error('Firebase not initialized');
                }
                
                // Add document to Firestore with retry logic
                const docRef = await addDocumentWithRetry({
                    name: name,
                    email: email,
                    message: message,
                    timestamp: new Date(),
                    ip: await getClientIP(),
                    userAgent: navigator.userAgent
                });
                
                console.log('Document written with ID: ', docRef.id);
                showMessage('Thank you! Your message has been sent successfully.', 'success');
                contactForm.reset();
                
            } catch (error) {
                console.error('Error adding document: ', error);
                
                // More specific error messages
                if (error.message.includes('permission')) {
                    showMessage('Database permission error. Please contact the site administrator.', 'error');
                } else if (error.message.includes('network') || error.message.includes('connection')) {
                    showMessage('Network error. Please check your connection and try again.', 'error');
                } else {
                    showMessage('Sorry, there was an error sending your message. Please try again.', 'error');
                }
            } finally {
                setLoading(false);
            }
        });
    }
    
    // Helper functions
    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }
    
    function showMessage(text, type) {
        formMessage.textContent = text;
        formMessage.className = `form-message ${type}`;
        formMessage.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                hideMessage();
            }, 5000);
        }
    }
    
    function hideMessage() {
        formMessage.style.display = 'none';
    }
    
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'Unknown';
        }
    }
    
    async function addDocumentWithRetry(data, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const docRef = await window.firebase.addDoc(
                    window.firebase.collection(window.firebase.db, 'contact-submissions'), 
                    data
                );
                return docRef;
            } catch (error) {
                console.warn(`Attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

});