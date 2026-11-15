#!/usr/bin/env node

/**
 * Script de configuration des produits & prix Mon TCFCA sur Stripe.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs
 */

import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error("❌ Erreur : La variable d'environnement STRIPE_SECRET_KEY est requise.");
  console.log("👉 Exemple : STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs");
  process.exit(1);
}

const stripe = new Stripe(apiKey, {
  apiVersion: '2023-10-16',
});

const PLANS = [
  {
    id: 'essentiel',
    name: 'Formule Essentiel — Mon TCFCA',
    description: '8 corrections écrites, 4 oraux, 1 examen blanc et accès aux 4 320 items.',
    unit_amount: 1500, // 15.00 EUR (~10 000 FCFA)
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan_id: 'essentiel', fcfa_price: '10000' },
  },
  {
    id: 'standard',
    name: 'Formule Standard (Recommandée) — Mon TCFCA',
    description: '20 corrections écrites, 12 oraux, 2 examens blancs et accès complet.',
    unit_amount: 2700, // 27.00 EUR (~18 000 FCFA)
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan_id: 'standard', fcfa_price: '18000' },
  },
  {
    id: 'intensif',
    name: 'Formule Intensif (Viser C2) — Mon TCFCA',
    description: '50 corrections écrites, 30 oraux, 5 examens blancs et coaching maximal.',
    unit_amount: 4200, // 42.00 EUR (~28 000 FCFA)
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan_id: 'intensif', fcfa_price: '28000' },
  },
  {
    id: 'pack_express',
    name: 'Pack Express (14 Jours) — Mon TCFCA',
    description: '20 corrections écrites, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
    unit_amount: 1500, // 15.00 EUR (~10 000 FCFA)
    currency: 'eur',
    recurring: { interval: 'day', interval_count: 14 },
    metadata: { plan_id: 'pack_express', fcfa_price: '10000' },
  },
];

async function main() {
  console.log("🚀 Initialisation des produits Mon TCFCA sur Stripe...\n");

  const createdPrices = {};

  for (const plan of PLANS) {
    try {
      console.log(`📦 Configuration du produit : ${plan.name}`);

      // 1. Rechercher si le produit existe déjà par metadata
      const existingProducts = await stripe.products.search({
        query: `metadata['plan_id']:'${plan.id}' AND active:'true'`,
      });

      let product;
      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        console.log(`   ✓ Produit existant trouvé : ${product.id}`);
      } else {
        product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: plan.metadata,
        });
        console.log(`   ✓ Nouveau produit créé : ${product.id}`);
      }

      // 2. Créer ou récupérer le prix
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 1,
      });

      let price;
      if (prices.data.length > 0) {
        price = prices.data[0];
        console.log(`   ✓ Prix existant : ${price.id} (${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()})\n`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.unit_amount,
          currency: plan.currency,
          recurring: plan.recurring,
          metadata: plan.metadata,
        });
        console.log(`   ✓ Nouveau prix créé : ${price.id} (${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()})\n`);
      }

      createdPrices[plan.id] = {
        productId: product.id,
        priceId: price.id,
        amount: plan.unit_amount,
        currency: plan.currency,
      };
    } catch (err) {
      console.error(`❌ Erreur pour ${plan.name} :`, err.message);
    }
  }

  console.log("🎉 Résumé des identifiants de prix configurés :");
  console.log(JSON.stringify(createdPrices, null, 2));
}

main().catch(console.error);
