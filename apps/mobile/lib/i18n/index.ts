import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

const resources = {
  en: {
    translation: {
      tabs: {
        diary: 'Home',
        recipes: 'Recipes',
        shoppingList: 'Shopping List',
        profile: 'Profile',
      },
      screens: {
        diary: 'Meal Diary',
        recipes: 'Recipes',
        shoppingList: 'Shopping List',
        profile: 'Profile',
        login: 'Login',
        comingSoon: 'Coming soon',
      },
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
