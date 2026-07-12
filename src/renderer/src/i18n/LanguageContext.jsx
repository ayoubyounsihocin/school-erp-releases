import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './en';
import ar from './ar';

const LanguageContext = createContext(null);

const translations = { en, ar };

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('app-lang') || 'en';
  });

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'ar') {
      setLanguageState(lang);
      localStorage.setItem('app-lang', lang);
    }
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  useEffect(() => {
    // Update HTML root attributes dynamically
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    
    // Optional: Add/remove RTL class for specific styling hooks
    if (isRTL) {
      document.documentElement.classList.add('rtl-mode');
    } else {
      document.documentElement.classList.remove('rtl-mode');
    }
  }, [language, dir, isRTL]);

  // Nested key resolver: e.g. "students.title"
  const t = (key, params) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = null;
        break;
      }
    }

    // Fallback to English if not found in target language
    if (value === null || value === undefined) {
      value = translations['en'];
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          value = null;
          break;
        }
      }
    }

    if (value === null || value === undefined) {
      return key; // return key as fallback
    }

    if (params && typeof params === 'object') {
      let result = value;
      Object.keys(params).forEach((pKey) => {
        result = result.replace(new RegExp(`{${pKey}}`, 'g'), params[pKey]);
      });
      return result;
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
