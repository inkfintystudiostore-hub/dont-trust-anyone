import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAycaO--Qw74UNFRyOFd_DxNYZvwvuE5rE',
  authDomain: 'inkfinitystudios-d2cb8.firebaseapp.com',
  projectId: 'inkfinitystudios-d2cb8',
  storageBucket: 'inkfinitystudios-d2cb8.firebasestorage.app',
  messagingSenderId: '1092523943221',
  appId: '1:1092523943221:web:29dd2072b7dfb314bf987c',
  measurementId: 'G-GP749D1QL2',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
