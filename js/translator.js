// Initialize Google Translate
function googleTranslateElementInit() {
new google.translate.TranslateElement({
    pageLanguage: 'en',
    includedLanguages: 'en,fr,de,es,it,pt,ru,zh-CN,ja,ko,ar,nl',
    layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL,
    autoDisplay: false,
    multilanguagePage: true
}, 'google_translate_element_hidden');
}

// Language name mapping
var langNames = {
'en': 'English',
'fr': 'Français',
'de': 'Deutsch',
'es': 'Español',
'it': 'Italiano',
'pt': 'Português',
'ru': 'Русский',
'zh-CN': '中文',
'ja': '日本語',
'ko': '한국어',
'ar': 'العربية',
'nl': 'Nederlands'
};

// Change language function
function changeLanguage(lang) {
// Set cookie for Google Translate
var cookiePath = ';path=/';
var cookieDomain = ';domain=' + window.location.hostname;
document.cookie = 'googtrans=/en/' + lang + cookiePath + cookieDomain;

// Find the Google Translate select and trigger change
var select = document.querySelector('.goog-te-combo');
if (select) {
    select.value = lang;
    select.dispatchEvent(new Event('change'));
} else {
    // If widget hasn't loaded yet, reload the page
    window.location.reload();
}

// Update active state in menu
document.querySelectorAll('.language-menu a').forEach(function(a) {
    a.classList.remove('active');
});

// Find and activate the clicked language
var links = document.querySelectorAll('.language-menu a');
for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('onclick').indexOf("'" + lang + "'") > -1) {
    links[i].classList.add('active');
    break;
    }
}

// Update button text
document.getElementById('currentLang').textContent = langNames[lang] || 'English';

// Close menu
document.getElementById('languageMenu').classList.remove('show');
}

// Toggle language menu
function toggleLanguageMenu() {
document.getElementById('languageMenu').classList.toggle('show');
}

// Close menu when clicking outside
document.addEventListener('click', function(e) {
var switcher = document.getElementById('languageSwitcher');
if (switcher && !switcher.contains(e.target)) {
    document.getElementById('languageMenu').classList.remove('show');
}
});

// Check for saved language preference
document.addEventListener('DOMContentLoaded', function() {
var savedLang = getCookie('googtrans');
if (savedLang) {
    var lang = savedLang.split('/')[2]; // Extract language code
    if (lang && langNames[lang]) {
    document.getElementById('currentLang').textContent = langNames[lang];
    // Update active state
    var links = document.querySelectorAll('.language-menu a');
    for (var i = 0; i < links.length; i++) {
        links[i].classList.remove('active');
        if (links[i].getAttribute('onclick').indexOf("'" + lang + "'") > -1) {
        links[i].classList.add('active');
        }
    }
    }
}
});

// Helper function to get cookie
function getCookie(name) {
var value = '; ' + document.cookie;
var parts = value.split('; ' + name + '=');
if (parts.length === 2) return parts.pop().split(';').shift();
return null;
}