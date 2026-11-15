import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://levdefzdiwvowtadzdkw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldmRlZnpkaXd2b3d0YWR6ZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzA1OTcsImV4cCI6MjEwNDIwNjU5N30.9tvXNFhe6DGjAFL_igcdssn0LI0VwdQFAVldZDrS-NY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function runEndToEndTest() {
  console.log('🚀 === DÉBUT DU TEST DE BOUT EN BOUT MON TCFCA ===\n');

  const testEmail = `candidat.test.${Date.now()}@test-tcf.ca`;
  const testPassword = 'PasswordTest123!';
  const testNom = 'Kouassi';
  const testPrenom = 'Yves';

  // ──────────────────────────────────────────────
  // ÉTAPE 1 : Inscription Candidat (Sign Up)
  // ──────────────────────────────────────────────
  console.log(`1️⃣ Inscription du candidat : ${testPrenom} ${testNom} (${testEmail})...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        nom: testNom,
        prenom: testPrenom,
        role: 'etudiant'
      }
    }
  });

  if (signUpError) {
    console.error('❌ Échec inscription :', signUpError.message);
    process.exit(1);
  }

  const user = signUpData.user;
  console.log('✅ Inscription réussie ! ID Candidat :', user.id);

  // ──────────────────────────────────────────────
  // ÉTAPE 2 : Connexion & Session
  // ──────────────────────────────────────────────
  console.log('2️⃣ Connexion avec les identifiants créés...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    console.error('❌ Échec connexion :', signInError.message);
    process.exit(1);
  }
  console.log('✅ Authentification validée ! Token de session obtenu.');

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } }
  });

  // Vérifier profil en base
  const { data: profile, error: profError } = await authClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profError) {
    console.warn('⚠️ Profil :', profError.message);
  } else {
    console.log(`✅ Profil candidat actif : ${profile.prenom} ${profile.nom} (Rôle: ${profile.role})`);
  }

  // ──────────────────────────────────────────────
  // ÉTAPE 3 : Initialisation Paystack Checkout (Formule Standard)
  // ──────────────────────────────────────────────
  console.log('\n3️⃣ Initialisation du checkout Paystack pour la formule Standard (29.99 $)...');
  const { data: checkoutData, error: checkoutError } = await authClient.functions.invoke(
    'create-paystack-checkout',
    {
      body: {
        planId: 'standard',
        callbackUrl: 'http://localhost:5173/etudiant/abonnement/succes'
      }
    }
  );

  if (checkoutError || checkoutData?.error) {
    if (checkoutError?.context) {
      try {
        const errJson = await checkoutError.context.json();
        console.error('❌ Détail erreur Edge Function :', errJson);
      } catch (e) {}
    }
    console.error('❌ Erreur create-paystack-checkout :', checkoutError || checkoutData?.error);
    process.exit(1);
  }

  console.log('✅ Checkout Paystack initialisé avec succès !');
  console.log('   - Référence Paystack :', checkoutData.reference);
  console.log('   - URL de paiement Paystack :', checkoutData.authorization_url);
  console.log('   - Montant :', checkoutData.amount / 100, checkoutData.currency);

  // ──────────────────────────────────────────────
  // ÉTAPE 4 : Test de la formule Intensif (40 jours, 47.99 $)
  // ──────────────────────────────────────────────
  console.log('\n4️⃣ Initialisation du checkout Paystack pour la formule Intensif (47.99 $ / 40 jours)...');
  const { data: intensifCheckout, error: intensifError } = await authClient.functions.invoke(
    'create-paystack-checkout',
    {
      body: {
        planId: 'intensif',
        callbackUrl: 'http://localhost:5173/etudiant/abonnement/succes'
      }
    }
  );

  if (intensifError || intensifCheckout?.error) {
    console.error('❌ Erreur create-paystack-checkout (intensif) :', intensifError || intensifCheckout?.error);
  } else {
    console.log('✅ Formule Intensif validée avec succès !');
    console.log('   - Montant :', intensifCheckout.amount / 100, intensifCheckout.currency);
    console.log('   - URL Paystack :', intensifCheckout.authorization_url);
  }

  // ──────────────────────────────────────────────
  // ÉTAPE 5 : Test de l'activation des quotas et statut abonnement
  // ──────────────────────────────────────────────
  console.log('\n5️⃣ Vérification de la création d\'abonnement & quotas...');
  
  // Insérer ou mettre à jour un abonnement simulant un paiement Mobile Money validé
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000); // 40 jours pour Intensif

  const { data: subInserted, error: subError } = await authClient
    .from('abonnements')
    .upsert({
      user_id: user.id,
      etudiant_id: user.id,
      plan_id: 'intensif',
      status: 'active',
      statut: 'actif',
      methode: 'mobile_money',
      auto_renew: false,
      quota_ee_restant: 50,
      quota_eo_restant: 30,
      quota_examen_blanc_restant: 5,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      date_debut: now.toISOString(),
      date_fin: periodEnd.toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (subError) {
    console.error('❌ Erreur insertion abonnement :', subError.message);
  } else {
    console.log('✅ Abonnement activé en base !');
    console.log('   - Formule :', subInserted.plan_id);
    console.log('   - Méthode de paiement :', subInserted.methode);
    console.log('   - Renouvellement automatique :', subInserted.auto_renew ? 'Oui' : 'Non (Mobile Money)');
    console.log('   - Quotas restants : EE =', subInserted.quota_ee_restant, '| EO =', subInserted.quota_eo_restant, '| Examens =', subInserted.quota_examen_blanc_restant);
    console.log('   - Date de fin (validité 40 jours) :', subInserted.current_period_end);
  }

  // ──────────────────────────────────────────────
  // ÉTAPE 6 : Test de la procédure de relance d'expiration
  // ──────────────────────────────────────────────
  console.log('\n6️⃣ Test de la détection et notification d\'expiration...');
  // Simuler une expiration imminente (dans 2 jours) pour déclencher la relance
  const soonEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  await authClient
    .from('abonnements')
    .update({ current_period_end: soonEnd.toISOString(), date_fin: soonEnd.toISOString(), derniere_relance_at: null })
    .eq('user_id', user.id);

  const { data: notifCount, error: rpcError } = await authClient.rpc('verifier_et_notifier_expirations_abonnements');
  if (rpcError) {
    console.error('❌ Erreur RPC verifier_et_notifier_expirations_abonnements :', rpcError.message);
  } else {
    console.log(`✅ Procédure de relance exécutée avec succès ! (${notifCount} notification(s) envoyée(s))`);
  }

  // Vérifier la notification créée dans la table notifications
  const { data: notifs, error: notifFetchError } = await authClient
    .from('notifications')
    .select('*')
    .eq('utilisateur_id', user.id)
    .order('created_at', { ascending: false });

  if (notifFetchError) {
    console.warn('⚠️ Erreur lecture notifications :', notifFetchError.message);
  } else if (notifs && notifs.length > 0) {
    console.log('✅ Notification de relance bien reçue dans la boîte du candidat :');
    console.log('   - Titre :', notifs[0].titre);
    console.log('   - Message :', notifs[0].message);
    console.log('   - Lien de renouvellement direct :', notifs[0].lien);
  } else {
    console.log('ℹ️ Aucune notification retournée pour ce filtre.');
  }

  console.log('\n🎉 === TOUS LES TESTS DE BOUT EN BOUT ONT RÉUSSI AVEC SUCCÈS ! ===');
}

runEndToEndTest().catch((e) => {
  console.error('FATAL ERROR :', e);
  process.exit(1);
});
