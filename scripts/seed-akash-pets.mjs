/* global fetch */

// One-off dev seed: publishes real pet listings for "Akash pet shop" so
// petza-app's newly-real Home rail, store page and pet-details screen have
// something to browse. Deliberately goes through `petListingService.create`
// — the exact function `POST /partner/pets` calls — rather than inserting
// rows directly, so slug generation, the duplicate-name guard and the
// attributes split all run for real. Photos are downloaded from Dog CEO /
// TheCatAPI (same two sources AGENTS.md already documents for this repo's
// mock images) and written into uploads/pets/ exactly as multer would, so
// mediaUrl() on the client resolves them like any partner-uploaded photo.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import 'dotenv/config';

import { petMediaUrl, UPLOAD_ROOT } from '../src/middleware/upload.js';
import db from '../src/models/index.js';
import { petListingService } from '../src/services/partner/petListing.service.js';

const STORE_ID = '3abec5f3-9950-4242-a5ea-331ce5b39c99'; // Akash pet shop

const DOGS = [
  { name: 'Rocky', breed: 'labrador-retriever', dogCeoBreed: 'labrador', gender: 'male', size: 'large', colors: ['golden'], weightKg: 28, priceInInr: 32000, dob: '2024-05-10' },
  { name: 'Bruno', breed: 'golden-retriever', dogCeoBreed: 'retriever/golden', gender: 'male', size: 'large', colors: ['golden'], weightKg: 30, priceInInr: 45000, dob: '2024-03-02' },
  { name: 'Tyson', breed: 'rottweiler', dogCeoBreed: 'rottweiler', gender: 'male', size: 'extra-large', colors: ['black', 'brown'], weightKg: 40, priceInInr: 55000, dob: '2023-11-18' },
  { name: 'Coco', breed: 'beagle', dogCeoBreed: 'beagle', gender: 'female', size: 'medium', colors: ['brown', 'white'], weightKg: 12, priceInInr: 25000, dob: '2024-07-22' },
  { name: 'Bubbles', breed: 'pug', dogCeoBreed: 'pug', gender: 'female', size: 'small', colors: ['fawn'], weightKg: 8, priceInInr: 18000, dob: '2024-09-01' },
  { name: 'Snowy', breed: 'pomeranian', dogCeoBreed: 'pomeranian', gender: 'female', size: 'small', colors: ['white'], weightKg: 3, priceInInr: 22000, dob: '2024-10-15' },
];

const CATS = [
  { name: 'Misty', breed: 'persian', catApiBreedId: 'pers', gender: 'female', size: 'medium', colors: ['white', 'cream'], weightKg: 4, priceInInr: 20000, dob: '2024-04-12' },
  { name: 'Simba', breed: 'siamese', catApiBreedId: 'siam', gender: 'male', size: 'medium', colors: ['cream', 'brown'], weightKg: 3.5, priceInInr: 18000, dob: '2024-06-05' },
  { name: 'Leo', breed: 'maine-coon', catApiBreedId: 'mcoo', gender: 'male', size: 'large', colors: ['brown'], weightKg: 6, priceInInr: 35000, dob: '2023-12-20' },
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function downloadDogPhoto(breed) {
  const { message: imageUrl, status } = await fetchJson(`https://dog.ceo/api/breed/${breed}/images/random`);
  if (status !== 'success') throw new Error(`Dog CEO had no photo for breed "${breed}"`);
  return imageUrl;
}

async function downloadCatPhoto(breedId) {
  const [entry] = await fetchJson(`https://api.thecatapi.com/v1/images/search?breed_ids=${breedId}`);
  if (!entry?.url) throw new Error(`TheCatAPI had no photo for breed "${breedId}"`);
  return entry.url;
}

/** Downloads one photo and writes it into uploads/pets/ exactly as multer's disk storage would, returning the server-relative URL. */
async function saveAsUpload(sourceUrl) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`${sourceUrl} -> HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const extension = (sourceUrl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1] ?? 'jpg').toLowerCase();
  const filename = `${randomUUID()}.${extension}`;
  const dir = join(UPLOAD_ROOT, 'pets');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  return petMediaUrl(filename);
}

async function publish({ name, breed, gender, size, colors, weightKg, priceInInr, dob, photoUrl, petType }) {
  const answers = {
    name,
    petType,
    breed,
    gender: gender === 'male' ? 'male' : 'female',
    dateOfBirth: dob,
    colors,
    size,
    weightKg,
    priceInInr,
    priceType: 'negotiable',
    description: `Healthy, well-socialized ${breed.replaceAll('-', ' ')} looking for a loving home.`,
    healthStatus: 'healthy',
    vaccinationStatus: 'fully-vaccinated',
    temperament: ['friendly', 'playful'],
  };

  const listing = await petListingService.create({
    storeId: STORE_ID,
    answers,
    media: [{ url: photoUrl, type: 'PHOTO', isMain: true }],
  });
  return listing;
}

async function main() {
  const created = [];
  const skipped = [];

  for (const dog of DOGS) {
    try {
      const sourceUrl = await downloadDogPhoto(dog.dogCeoBreed);
      const photoUrl = await saveAsUpload(sourceUrl);
      const listing = await publish({ ...dog, photoUrl, petType: 'DOG' });
      created.push(listing.name);
      console.log(`✓ dog  ${listing.name} (${dog.breed}) — ${photoUrl}`);
    } catch (err) {
      skipped.push({ name: dog.name, reason: err.message });
      console.warn(`✗ dog  ${dog.name} skipped: ${err.message}`);
    }
  }

  for (const cat of CATS) {
    try {
      const sourceUrl = await downloadCatPhoto(cat.catApiBreedId);
      const photoUrl = await saveAsUpload(sourceUrl);
      const listing = await publish({ ...cat, photoUrl, petType: 'CAT' });
      created.push(listing.name);
      console.log(`✓ cat  ${listing.name} (${cat.breed}) — ${photoUrl}`);
    } catch (err) {
      skipped.push({ name: cat.name, reason: err.message });
      console.warn(`✗ cat  ${cat.name} skipped: ${err.message}`);
    }
  }

  console.log(`\nCreated ${created.length}/${DOGS.length + CATS.length} listings for store ${STORE_ID}.`);
  if (skipped.length) console.log('Skipped:', skipped);

  await db.sequelize.close();
  process.exit(skipped.length && created.length === 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await db.sequelize.close();
  process.exit(1);
});
