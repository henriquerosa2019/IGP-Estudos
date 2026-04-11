import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function fetchNotices() {
  const querySnapshot = await getDocs(collection(db, "notices"));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data().name, " | uid: ", doc.data().uid);
  });
  process.exit(0);
}

fetchNotices();
