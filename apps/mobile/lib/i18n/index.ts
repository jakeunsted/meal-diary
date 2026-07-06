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
      common: {
        close: 'Close',
        cancel: 'Cancel',
        back: 'Back',
      },
      login: {
        title: 'Meal Diary',
        subtitle: 'Sign in to your account',
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        password: 'Password',
        passwordPlaceholder: 'Your password',
        signIn: 'Sign in',
        networkError: 'Unable to reach the server. Please try again.',
        noAccount: "Don't have an account?",
        register: 'Register',
      },
      registration: {
        title: 'Registration',
        username: 'Username',
        usernamePlaceholder: 'Username',
        email: 'Email',
        emailPlaceholder: 'Email',
        firstName: 'First name',
        firstNamePlaceholder: 'First name',
        lastName: 'Last name',
        lastNamePlaceholder: 'Last name',
        password: 'Password',
        passwordPlaceholder: 'Password',
        confirmPassword: 'Confirm password',
        confirmPasswordPlaceholder: 'Confirm password',
        ageRequirement: 'You must be at least 13 years old to use Meal Diary.',
        termsPrefix: 'I agree to the',
        termsOfService: 'Terms of Service',
        and: 'and',
        privacyPolicy: 'Privacy Policy',
        register: 'Register',
        alreadyHaveAccount: 'Already have an account?',
        signIn: 'Sign in',
        errors: {
          usernameRequired: 'Username is required',
          emailRequired: 'Email is required',
          emailInvalid: 'Please enter a valid email address',
          firstNameRequired: 'First name is required',
          lastNameRequired: 'Last name is required',
          passwordRequired: 'Password is required',
          confirmPasswordRequired: 'You need to confirm your password',
          passwordMismatch: 'Passwords do not match',
          termsRequired: 'You must accept the terms of service and privacy policy',
          duplicateAccount:
            'An account with these details already exists. Try logging in instead.',
          failed: 'Registration failed. Please try again.',
        },
      },
      registrationStep2: {
        title: 'Family Group',
        createNew: 'Create New',
        joinExisting: 'Join Existing',
        familyGroupName: 'Family Group Name',
        familyGroupNamePlaceholder: 'Enter family group name',
        familyGroupCode: 'Family group code',
        familyGroupCodePlaceholder: 'Enter family group code',
        createFamilyGroup: 'Create Family Group',
        joinFamilyGroup: 'Join Family Group',
        familyGroupFull:
          'This family group is full. The owner needs to upgrade to Family Plus before new members can join.',
        createFailed: 'Failed to create family group, please try again!',
        joinFailed: 'Failed to join family group, please try again!',
        familyNotFound: 'Family group not found',
        genericError: 'An error occurred',
      },
      familySettings: {
        title: 'Family settings',
        ownerDescription: 'You are the owner of this family group.',
        memberDescription:
          'Leaving removes your access to shared meal diaries, recipes, and shopping lists.',
        leaveFamily: 'Leave family',
        leaveConfirmMessage:
          "You will lose access to this family's meal diaries, recipes, and shopping lists. The shared content stays with the family.",
        ownerChoiceTitle: 'You own this family group',
        ownerChoiceMessage:
          'Before you can leave, hand the family over to someone else or delete it for everyone.',
        transferOwnership: 'Transfer ownership',
        noMembersToTransfer: 'There are no other members to transfer to.',
        deleteFamily: 'Delete family',
        transferMessage: 'Choose the new owner of this family group.',
        deleteMessage:
          'This permanently deletes the family group for every member: all meal diaries, recipes, and shopping lists. Members keep their accounts and can create or join another family.',
        deleteConfirmLabel: 'Type the family name to confirm:',
        ownershipTransferredTitle: 'Ownership transferred',
        ownershipTransferredMessage:
          'You are now a regular member and can leave the family whenever you like.',
        errors: {
          leaveFailed: 'Failed to leave family group',
          transferFailed: 'Failed to transfer ownership',
          deleteFailed: 'Failed to delete family group',
        },
      },
      profile: {
        familyDetailsTitle: 'Your family details',
        familyGroupName: 'Family group name',
        familyGroupCode: 'Family group code',
        shareCodeHint: 'Share this code with new users to join your family group',
        codeCopied: 'Family code copied to clipboard!',
        familyMembersTitle: 'Your family members',
        owner: 'Owner',
        noMembers: 'Wow its empty here!',
        addFamilyMember: 'Add family member',
        familyMemberLimitOwner: 'Your plan allows up to {{max}} family members.',
        familyMemberLimitNonOwner: 'Ask {{name}} to upgrade to add more family members.',
        familyMemberLimitNonOwnerGeneric:
          'Ask the family owner to upgrade to add more family members.',
        viewPlansToUpgrade: 'View plans to upgrade.',
        inviteTitle: 'Invite Family Member',
        inviteDescription:
          'Share this invite link with your family members to join your family group',
        linkCopied: 'Invite link copied to clipboard!',
        accountTitle: 'Account',
        accountDescription: 'Sign out of Meal Diary on this device.',
        logout: 'Logout',
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
