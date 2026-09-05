import fs from 'fs';
import path from 'path';

const sourcePath = 'C:\\Users\\HP\\Desktop\\EDUDESK-TCF\\967 expression_ecrite_PN_1787291411906\\expression_ecrite_banque.json';
const destPath = 'c:\\Users\\HP\\Desktop\\EDUDESK-TCF\\EDUDESK-TCF\\public\\data\\questions_ee_autonome.json';

console.log('Reading source JSON from:', sourcePath);
const rawData = fs.readFileSync(sourcePath, 'utf8');
const items = JSON.parse(rawData);

console.log(`Found ${items.length} Expression Écrite subjects in source.`);

const formatted = items.map((item, idx) => {
  const tacheNum = item.tache_numero || (item.id.includes('_T1_') ? 1 : item.id.includes('_T2_') ? 2 : 3);
  let niveau = 'B1';
  if (tacheNum === 1) niveau = 'A2';
  else if (tacheNum === 2) niveau = 'B2';
  else if (tacheNum === 3) niveau = 'C1';

  let fullText = '';
  if (tacheNum === 3 && (item.document_a || item.document_b)) {
    const titre = item.titre_sujet ? `Thème du débat : « ${item.titre_sujet} »\n\n` : '';
    const docA = item.document_a ? `Document 1 :\n${item.document_a}\n\n` : '';
    const docB = item.document_b ? `Document 2 :\n${item.document_b}\n\n` : '';
    const cons = item.consigne ? `Consigne :\n${item.consigne}` : '';
    fullText = `[${item.id}]\n${titre}${docA}${docB}${cons}`.trim();
  } else {
    fullText = `[${item.id}]\n${item.consigne || item.titre_sujet || ''}`.trim();
  }

  return {
    id: item.id,
    epreuve: 'expression_ecrite',
    theme: 'EE',
    tache_numero: tacheNum,
    niveau,
    titre_sujet: item.titre_sujet || null,
    consigne: item.consigne || null,
    document_a: item.document_a || null,
    document_b: item.document_b || null,
    texte: fullText,
    audio_url: null,
    image_url: null,
    choix: null,
    bonne_reponse: null,
    explication: `Tâche ${tacheNum} : ${tacheNum === 1 ? 'Message court / Courriel (60 à 120 mots · ~10 min)' : tacheNum === 2 ? 'Article ou compte-rendu (120 à 150 mots · ~20 min)' : 'Expression de point de vue (120 à 180 mots · ~30 min)'}`,
    nombre_mots_min: item.nombre_mots_min || (tacheNum === 1 ? 60 : 120),
    nombre_mots_max: item.nombre_mots_max || (tacheNum === 1 ? 120 : tacheNum === 2 ? 150 : 180),
    nombre_mots_label: item.nombre_mots_label || (tacheNum === 1 ? '60 à 120 mots' : tacheNum === 2 ? '120 à 150 mots' : '120 à 180 mots'),
    source_url: item.source_url || null,
    ordre: idx + 1,
    actif: true,
  };
});

fs.writeFileSync(destPath, JSON.stringify(formatted, null, 2), 'utf8');
console.log(`Saved ${formatted.length} subjects to ${destPath}`);

const t1Count = formatted.filter(f => f.tache_numero === 1).length;
const t2Count = formatted.filter(f => f.tache_numero === 2).length;
const t3Count = formatted.filter(f => f.tache_numero === 3).length;
console.log(`Breakdown: Tâche 1: ${t1Count}, Tâche 2: ${t2Count}, Tâche 3: ${t3Count}, Total: ${formatted.length}`);
