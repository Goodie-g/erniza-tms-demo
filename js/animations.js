/**
 * Erniza Africa Safaris - Advanced Animations
 * Handles parallax, hover effects, gallery, and interactive animations
 */

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== Initialize All Animation Modules =====
  initParallaxEffects();
  initGalleryModal();
  initGalleryFilters();
  initScrollReveal();
  initTypingEffect();
  initRippleEffect();
  initCardTiltEffect();
  initSmoothAppear();
  initVideoPlayback();
  initMapInteraction();
});

/**
 * Parallax Scrolling Effects
 */
function initParallaxEffects() {
  // Parallax for hero sections
  const heroFullscreen = document.querySelector('.hero-fullscreen');
  const pageBanner = document.querySelector('.page-banner');
  
  if (heroFullscreen || pageBanner) {
    window.addEventListener('scroll', function() {
      const scrolled = window.pageYOffset;
      
      if (heroFullscreen && heroFullscreen.getBoundingClientRect().bottom > 0) {
        heroFullscreen.style.backgroundPositionY = scrolled * 0.5 + 'px';
      }
      
      if (pageBanner && pageBanner.getBoundingClientRect().bottom > 0) {
        pageBanner.style.backgroundPositionY = scrolled * 0.3 + 'px';
      }
    });
  }
  
  // Parallax for individual elements with data-parallax attribute
  document.querySelectorAll('[data-parallax]').forEach(element => {
    const speed = element.getAttribute('data-parallax') || 0.2;
    
    window.addEventListener('scroll', function() {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (rect.top < windowHeight && rect.bottom > 0) {
        const scrolled = window.pageYOffset;
        element.style.transform = `translateY(${scrolled * speed}px)`;
      }
    });
  });
}

/**
 * Gallery Modal with Lightbox
 */
function initGalleryModal() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  if (galleryItems.length === 0) return;
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('galleryModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'galleryModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <span class="modal-close">&times;</span>
      <div class="modal-nav modal-prev"><i class="fas fa-chevron-left"></i></div>
      <img src="" alt="Gallery Image" id="modalImage">
      <div class="modal-nav modal-next"><i class="fas fa-chevron-right"></i></div>
      <div class="modal-caption" id="modalCaption"></div>
    `;
    document.body.appendChild(modal);
    
    // Style navigation arrows
    const navStyles = document.createElement('style');
    navStyles.textContent = `
      .modal-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        color: white;
        font-size: 2rem;
        cursor: pointer;
        padding: 20px;
        transition: all 0.3s ease;
        z-index: 1001;
        background: rgba(0,0,0,0.3);
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-nav:hover {
        background: rgba(201, 156, 74, 0.8);
        transform: translateY(-50%) scale(1.1);
      }
      
      .modal-prev {
        left: 30px;
      }
      
      .modal-next {
        right: 30px;
      }
      
      .modal-caption {
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        background: rgba(0,0,0,0.7);
        padding: 10px 25px;
        border-radius: 25px;
        font-size: 1.1rem;
        z-index: 1001;
      }
      
      @media (max-width: 768px) {
        .modal-nav {
          width: 45px;
          height: 45px;
          font-size: 1.5rem;
        }
        
        .modal-prev {
          left: 15px;
        }
        
        .modal-next {
          right: 15px;
        }
      }
    `;
    document.head.appendChild(navStyles);
  }
  
  const modalImg = document.getElementById('modalImage');
  const modalClose = modal.querySelector('.modal-close');
  const modalPrev = modal.querySelector('.modal-prev');
  const modalNext = modal.querySelector('.modal-next');
  const modalCaption = document.getElementById('modalCaption');
  
  let currentIndex = 0;
  const galleryArray = Array.from(galleryItems);
  
  // Open modal
  galleryItems.forEach((item, index) => {
    item.addEventListener('click', function() {
      currentIndex = index;
      updateModalImage();
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    
    // Add cursor pointer
    item.style.cursor = 'pointer';
  });
  
  // Update modal image
  function updateModalImage() {
    const currentItem = galleryArray[currentIndex];
    const img = currentItem.querySelector('img');
    const overlay = currentItem.querySelector('.gallery-overlay');
    
    modalImg.src = img.src;
    modalImg.alt = img.alt;
    
    if (overlay) {
      const title = overlay.querySelector('h3');
      modalCaption.textContent = title ? title.textContent : '';
    } else {
      modalCaption.textContent = img.alt || '';
    }
    
    // Add zoom animation
    modalImg.style.animation = 'none';
    modalImg.offsetHeight; // Trigger reflow
    modalImg.style.animation = 'zoomIn 0.4s ease';
  }
  
  // Navigate previous
  modalPrev.addEventListener('click', function(e) {
    e.stopPropagation();
    currentIndex = (currentIndex - 1 + galleryArray.length) % galleryArray.length;
    updateModalImage();
  });
  
  // Navigate next
  modalNext.addEventListener('click', function(e) {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % galleryArray.length;
    updateModalImage();
  });
  
  // Close modal
  modalClose.addEventListener('click', function() {
    closeModal();
  });
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!modal.classList.contains('active')) return;
    
    switch(e.key) {
      case 'Escape':
        closeModal();
        break;
      case 'ArrowLeft':
        currentIndex = (currentIndex - 1 + galleryArray.length) % galleryArray.length;
        updateModalImage();
        break;
      case 'ArrowRight':
        currentIndex = (currentIndex + 1) % galleryArray.length;
        updateModalImage();
        break;
    }
  });
  
  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;
  
  modal.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  modal.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const swipeThreshold = 50;
    
    if (touchEndX < touchStartX - swipeThreshold) {
      // Swipe left - next
      currentIndex = (currentIndex + 1) % galleryArray.length;
      updateModalImage();
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
      // Swipe right - previous
      currentIndex = (currentIndex - 1 + galleryArray.length) % galleryArray.length;
      updateModalImage();
    }
  }
}

/**
 * Gallery Filter Functionality
 */
function initGalleryFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  if (filterButtons.length === 0 || galleryItems.length === 0) return;
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Update active button
      filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const filter = this.getAttribute('data-filter');
      
      galleryItems.forEach(item => {
        const category = item.getAttribute('data-category');
        
        if (filter === 'all' || category === filter) {
          // Show item
          item.style.display = 'block';
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
          item.style.transition = 'all 0.4s ease';
        } else {
          // Hide item
          item.style.opacity = '0';
          item.style.transform = 'scale(0.8)';
          setTimeout(() => {
            item.style.display = 'none';
          }, 400);
        }
      });
    });
  });
}

/**
 * Scroll Reveal Animation
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const delay = element.getAttribute('data-delay') || 0;
        const direction = element.getAttribute('data-direction') || 'up';
        
        setTimeout(() => {
          element.classList.add('revealed');
          
          switch(direction) {
            case 'up':
              element.style.transform = 'translateY(0)';
              break;
            case 'down':
              element.style.transform = 'translateY(0)';
              break;
            case 'left':
              element.style.transform = 'translateX(0)';
              break;
            case 'right':
              element.style.transform = 'translateX(0)';
              break;
          }
          
          element.style.opacity = '1';
        }, delay);
        
        revealObserver.unobserve(element);
      }
    });
  }, { threshold: 0.15 });
  
  revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    
    const direction = el.getAttribute('data-direction') || 'up';
    
    switch(direction) {
      case 'up':
        el.style.transform = 'translateY(50px)';
        break;
      case 'down':
        el.style.transform = 'translateY(-50px)';
        break;
      case 'left':
        el.style.transform = 'translateX(-50px)';
        break;
      case 'right':
        el.style.transform = 'translateX(50px)';
        break;
    }
    
    revealObserver.observe(el);
  });
}

/**
 * Typing Effect for Hero Titles
 */
function initTypingEffect() {
  const typingElements = document.querySelectorAll('[data-typing]');
  
  typingElements.forEach(element => {
    const words = JSON.parse(element.getAttribute('data-typing'));
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let currentWord = '';
    
    function type() {
      const fullWord = words[wordIndex];
      
      if (isDeleting) {
        currentWord = fullWord.substring(0, charIndex - 1);
        charIndex--;
      } else {
        currentWord = fullWord.substring(0, charIndex + 1);
        charIndex++;
      }
      
      element.textContent = currentWord;
      
      let typeSpeed = isDeleting ? 50 : 100;
      
      if (!isDeleting && charIndex === fullWord.length) {
        // Pause at end of word
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 500;
      }
      
      setTimeout(type, typeSpeed);
    }
    
    if (words && words.length > 0) {
      setTimeout(type, 1000);
    }
  });
}

/**
 * Ripple Effect on Buttons
 */
function initRippleEffect() {
  document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.4);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
  
  // Add ripple keyframes
  const rippleStyles = document.createElement('style');
  rippleStyles.textContent = `
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(rippleStyles);
}

/**
 * Card Tilt Effect
 */
function initCardTiltEffect() {
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', function(e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    
    card.addEventListener('mouseleave', function() {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s ease';
    });
    
    card.addEventListener('mouseenter', function() {
      card.style.transition = 'transform 0.1s ease';
    });
  });
}

/**
 * Smooth Appear on Scroll
 */
function initSmoothAppear() {
  const appearElements = document.querySelectorAll('.appear');
  
  const appearObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0) scale(1)';
        appearObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  
  appearElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px) scale(0.95)';
    el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    appearObserver.observe(el);
  });
}

/**
 * Video Background Playback
 */
function initVideoPlayback() {
  const videoBg = document.querySelector('.video-background');
  
  if (videoBg) {
    // Attempt to autoplay
    const playPromise = videoBg.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay was prevented, show play button
        const playButton = document.createElement('button');
        playButton.className = 'video-play-btn';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        playButton.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          border: 2px solid white;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          z-index: 10;
          transition: all 0.3s ease;
        `;
        
        videoBg.parentElement.appendChild(playButton);
        
        playButton.addEventListener('click', () => {
          videoBg.play();
          playButton.remove();
        });
        
        playButton.addEventListener('mouseenter', function() {
          this.style.background = 'rgba(255,255,255,0.5)';
          this.style.transform = 'translate(-50%, -50%) scale(1.1)';
        });
        
        playButton.addEventListener('mouseleave', function() {
          this.style.background = 'rgba(255,255,255,0.3)';
          this.style.transform = 'translate(-50%, -50%) scale(1)';
        });
      });
    }
  }
}

/**
 * Map Interaction
 */
function initMapInteraction() {
  const mapContainer = document.querySelector('.map-container');
  
  if (mapContainer) {
    mapContainer.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.02)';
      this.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
    });
    
    mapContainer.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
    });
  }
}

/**
 * Progress Bar Animation
 */
function animateProgressBars() {
  const progressBars = document.querySelectorAll('.progress-bar');
  
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const target = bar.getAttribute('data-progress') || 100;
        
        bar.style.width = target + '%';
        bar.style.transition = 'width 1.5s ease-in-out';
        
        progressObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.5 });
  
  progressBars.forEach(bar => {
    bar.style.width = '0%';
    progressObserver.observe(bar);
  });
}

// Initialize progress bars if they exist
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelectorAll('.progress-bar').length > 0) {
    animateProgressBars();
  }
});

/**
 * Snowfall Effect for Kilimanjaro Page
 */
function initSnowfallEffect() {
  const snowContainer = document.querySelector('.snowfall-container');
  
  if (snowContainer) {
    function createSnowflake() {
      const snowflake = document.createElement('div');
      snowflake.className = 'snowflake';
      snowflake.innerHTML = '❄';
      snowflake.style.cssText = `
        position: absolute;
        color: white;
        font-size: ${Math.random() * 20 + 10}px;
        left: ${Math.random() * 100}%;
        top: -20px;
        opacity: ${Math.random() * 0.7 + 0.3};
        animation: snowfall ${Math.random() * 3 + 2}s linear infinite;
        animation-delay: ${Math.random() * 5}s;
      `;
      
      snowContainer.appendChild(snowflake);
      
      setTimeout(() => {
        snowflake.remove();
      }, 5000);
    }
    
    setInterval(createSnowflake, 200);
    
    // Add snowfall animation
    const snowStyles = document.createElement('style');
    snowStyles.textContent = `
      @keyframes snowfall {
        0% {
          transform: translateY(-20px) rotate(0deg);
        }
        100% {
          transform: translateY(100vh) rotate(360deg);
        }
      }
    `;
    document.head.appendChild(snowStyles);
  }
}

// Initialize snowfall if on Kilimanjaro page
if (window.location.pathname.includes('kilimanjaro')) {
  document.addEventListener('DOMContentLoaded', initSnowfallEffect);
}

/**
 * Pulse Animation for Important Elements
 */
function initPulseAnimation() {
  const pulseElements = document.querySelectorAll('.pulse');
  
  pulseElements.forEach(el => {
    el.style.animation = 'pulse 2s infinite';
  });
  
  const pulseStyles = document.createElement('style');
  pulseStyles.textContent = `
    @keyframes pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(201, 156, 74, 0.7);
      }
      70% {
        transform: scale(1.05);
        box-shadow: 0 0 0 15px rgba(201, 156, 74, 0);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(201, 156, 74, 0);
      }
    }
  `;
  document.head.appendChild(pulseStyles);
}

document.addEventListener('DOMContentLoaded', initPulseAnimation);

/**
 * Floating Animation for Decorative Elements
 */
function initFloatingAnimation() {
  const floatingElements = document.querySelectorAll('.floating');
  
  floatingElements.forEach((el, index) => {
    el.style.animation = `floating ${3 + index}s ease-in-out infinite`;
    el.style.animationDelay = `${index * 0.5}s`;
  });
  
  const floatStyles = document.createElement('style');
  floatStyles.textContent = `
    @keyframes floating {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-20px);
      }
    }
  `;
  document.head.appendChild(floatStyles);
}

document.addEventListener('DOMContentLoaded', initFloatingAnimation);