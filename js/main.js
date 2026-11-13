/**
 * Erniza Africa Safaris - Main JavaScript
 * Handles navigation, forms, animations, and core functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== Mobile Menu Toggle =====
  initMobileMenu();
  
  // ===== Active Navigation Link =====
  setActiveNavLink();
  
  // ===== Smooth Scroll for Anchor Links =====
  initSmoothScroll();
  
  // ===== Navbar Scroll Effect =====
  initNavbarScroll();
  
  // ===== Booking Form Handling =====
  initBookingForm();
  
  // ===== Initialize Scroll Animations =====
  initScrollAnimations();
  
  // ===== Counter Animation =====
  initCounters();
  
  // ===== Back to Top Button =====
  initBackToTop();
  
  // ===== Image Lazy Loading =====
  initLazyLoading();
  
 
  
  // ===== Price Calculator (if exists) =====
  initPriceCalculator();
});

/**
 * Mobile Menu Functionality
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  const body = document.body;

  if (toggleBtn && navLinks) {
    // Toggle menu on button click
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navLinks.classList.toggle('active');
      
      // Change icon
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        if (navLinks.classList.contains('active')) {
          icon.classList.remove('fa-bars');
          icon.classList.add('fa-times');
          body.style.overflow = 'hidden'; // Prevent scroll when menu is open
        } else {
          icon.classList.remove('fa-times');
          icon.classList.add('fa-bars');
          body.style.overflow = ''; // Restore scroll
        }
      }
    });

    // Close menu when clicking a link
    const linkItems = navLinks.querySelectorAll('a');
    linkItems.forEach(link => {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 768) {
          closeMobileMenu();
        }
      });
    });

    // Close menu on outside click
    document.addEventListener('click', function(event) {
      if (!toggleBtn.contains(event.target) && !navLinks.contains(event.target)) {
        if (navLinks.classList.contains('active')) {
          closeMobileMenu();
        }
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navLinks.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  }

  function closeMobileMenu() {
    navLinks.classList.remove('active');
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.classList.remove('fa-times');
      icon.classList.add('fa-bars');
    }
    body.style.overflow = '';
  }

  // Handle window resize
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
      closeMobileMenu();
    }
  });
}

/**
 * Set Active Navigation Link Based on Current Page
 */
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    // Remove active class from all links
    link.classList.remove('active');
    
    // Check if link matches current page
    if (href) {
      // Home page check
      if ((currentPath.endsWith('index.html') || currentPath.endsWith('/')) && 
          (href === 'index.html' || href === './' || href === '../index.html')) {
        link.classList.add('active');
      }
      // Other pages check
      else if (href.includes(currentPath.split('/').pop()) && 
               currentPath.split('/').pop() !== '') {
        link.classList.add('active');
      }
    }
  });
}

/**
 * Smooth Scroll for Internal Anchor Links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      
      if (target) {
        e.preventDefault();
        
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        // Update URL hash without jumping
        history.pushState(null, null, targetId);
      }
    });
  });
}

/**
 * Navbar Background Change on Scroll
 */
function initNavbarScroll() {
  const nav = document.getElementById('navFullscreen');
  
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }
}

// Contact form handling with Formspree
document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      
      try {
        const formData = new FormData(contactForm);
        const response = await fetch(contactForm.action, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          showNotification('Thank you! Your message has been sent successfully. We will get back to you within 24 hours.', 'success');
          contactForm.reset();
          // Re-check newsletter if needed
          const newsletter = document.getElementById('newsletter');
          if (newsletter) newsletter.checked = true;
        } else {
          showNotification('Oops! Something went wrong. Please try again or email us directly.', 'error');
        }
      } catch (error) {
        showNotification('Network error. Please check your connection and try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
});

// Notification function
function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    <span>${message}</span>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? '#2c4a2e' : '#dc3545'};
    color: white;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    animation: slideInRight 0.3s ease, fadeOut 0.3s ease 4.7s forwards;
    max-width: 400px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

/**
 * Booking Form Handling
 */
function initBookingForm() {
  const bookingForm = document.getElementById('bookingForm');
  
  if (bookingForm) {
    // Set minimum date to tomorrow
    const dateInput = bookingForm.querySelector('input[type="date"]');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
    }
    
    bookingForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(bookingForm);
      const formValues = Object.fromEntries(formData.entries());
      
      // Validate required fields
      if (!formValues.name || !formValues.email || !formValues.safari) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }
      
      // Simulate booking submission
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      
      setTimeout(() => {
        showNotification('Booking request sent successfully! We will contact you shortly.', 'success');
        bookingForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }, 2000);
    });
  }
}

/**
 * Scroll Animations using Intersection Observer
 */
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Add delay based on index for staggered effect
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
        
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all elements with animation classes
  const animatedElements = document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right');
  
  animatedElements.forEach(el => {
    observer.observe(el);
  });
}

/**
 * Counter Animation for Statistics
 */
function initCounters() {
  const counters = document.querySelectorAll('.counter');
  
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counter = entry.target;
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000; // 2 seconds
        const steps = 50;
        const stepValue = target / steps;
        let current = 0;
        
        const updateCounter = () => {
          current += stepValue;
          
          if (current < target) {
            counter.innerText = Math.ceil(current);
            requestAnimationFrame(updateCounter);
          } else {
            counter.innerText = target;
          }
        };
        
        updateCounter();
        counterObserver.unobserve(counter);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(counter => {
    counterObserver.observe(counter);
  });
}

/**
 * Back to Top Button
 */
function initBackToTop() {
  // Create back to top button if it doesn't exist
  if (!document.getElementById('backToTop')) {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--savanna-gold);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      z-index: 999;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    document.body.appendChild(backToTopBtn);
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', function() {
      if (window.scrollY > 500) {
        backToTopBtn.style.opacity = '1';
        backToTopBtn.style.visibility = 'visible';
      } else {
        backToTopBtn.style.opacity = '0';
        backToTopBtn.style.visibility = 'hidden';
      }
    });
    
    // Scroll to top on click
    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    
    // Hover effect
    backToTopBtn.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-3px)';
      this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
    });
    
    backToTopBtn.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    });
  }
}

/**
 * Lazy Loading for Images
 */
function initLazyLoading() {
  const images = document.querySelectorAll('img[loading="lazy"]');
  
  if ('loading' in HTMLImageElement.prototype) {
    // Browser supports native lazy loading
    return;
  }
  
  // Fallback for browsers that don't support lazy loading
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        imageObserver.unobserve(img);
      }
    });
  });
  
  images.forEach(img => {
    if (img.dataset.src) {
      imageObserver.observe(img);
    }
  });
}

/**
 * Price Calculator for Custom Tours
 */
function initPriceCalculator() {
  const calculator = document.getElementById('priceCalculator');
  
  if (calculator) {
    const daysInput = document.getElementById('daysInput');
    const peopleInput = document.getElementById('peopleInput');
    const accommodationSelect = document.getElementById('accommodationSelect');
    const totalDisplay = document.getElementById('totalPrice');
    const calculateBtn = document.getElementById('calculateBtn');
    
    const prices = {
      budget: 350,
      midrange: 500,
      luxury: 800
    };
    
    function calculatePrice() {
      const days = parseInt(daysInput.value) || 1;
      const people = parseInt(peopleInput.value) || 1;
      const accommodation = accommodationSelect.value;
      
      const pricePerDay = prices[accommodation] || prices.midrange;
      const total = days * people * pricePerDay;
      
      totalDisplay.innerHTML = `$${total.toLocaleString()}`;
    }
    
    if (calculateBtn) {
      calculateBtn.addEventListener('click', calculatePrice);
    }
    
    // Real-time calculation
    [daysInput, peopleInput, accommodationSelect].forEach(input => {
      if (input) {
        input.addEventListener('change', calculatePrice);
        input.addEventListener('input', calculatePrice);
      }
    });
  }
}

/**
 * Show Notification Toast
 */
function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    <span>${message}</span>
  `;
  
  // Style notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? '#2c4a2e' : '#dc3545'};
    color: white;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
    max-width: 400px;
  `;
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Add animation keyframes for notification
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;
document.head.appendChild(notificationStyles);

/**
 * Handle Window Load
 */
window.addEventListener('load', function() {
  // Remove loading screen if exists
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 500);
  }
  
  // Initialize AOS-like animations for elements that should animate on load
  document.querySelectorAll('.animate-on-load').forEach(el => {
    el.style.animationPlayState = 'running';
  });
});

/**
 * Handle errors globally
 */
window.addEventListener('error', function(e) {
  console.error('An error occurred:', e.error);
  // You could add error reporting service here
});

/**
 * Export functions for use in other scripts
 */
window.ErnizaSafaris = {
  showNotification,
  initMobileMenu,
  setActiveNavLink,
  initScrollAnimations,
  initCounters
};