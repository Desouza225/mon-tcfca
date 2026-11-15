import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  PROMPT_SYSTEME_EXPRESSION_ECRITE,
  PROMPT_SYSTEME_EXPRESSION_ORALE,
  JSON_OUTPUT_INSTRUCTION,
} from './prompts.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Modèle de notation (surchargeable via le secret ANTHROPIC_MODEL)
const CLAUDE_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
// Modèle de transcription audio (surchargeable via le secret GEMINI_MODEL)
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash';

interface CorrectionPayload {
  task_type: 'EE_tache1' | 'EE_tache2' | 'EE_tache3' | 'EO_tache1' | 'EO_tache2' | 'EO_tache3';
  consigne: string;
  raw_text?: string;
  audio_url?: string;
  audio_base64?: string;
  mime_type?: string;
  reference?: string;
  session_id?: string;
  production_id?: string;
}

// Nettoyage et parsing sécurisé d'un JSON renvoyé par un LLM
function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  // Retirer les blocs markdown ```json ... ``` si présents
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
}

// Validation de la complétude du JSON de correction (Garde-fou qualité)
function isCorrectionValid(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.total !== 'number' || isNaN(data.total)) return false;
  if (!data.niveau_cecrl || typeof data.niveau_cecrl !== 'string') return false;
  if (!data.note_linguistique || !data.note_pragmatique || !data.note_sociolinguistique) return false;
  
  // Vérifier feedback_par_critere non vide pour chaque sous-critère
  const fb = data.feedback_par_critere;
  if (!fb || typeof fb !== 'object') return false;
  const values = Object.values(fb);
  if (values.length === 0) return false;
  for (const v of values) {
    if (typeof v !== 'string' || v.trim().length < 5) {
      return false;
    }
  }

  return true;
}

// Fonction de transcription audio avec Gemini API
async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType = 'audio/webm'
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("La variable d'environnement GEMINI_API_KEY n'est pas configurée côté serveur.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Transcris fidèlement, mot à mot et avec la plus grande précision cet enregistrement audio en français pour une épreuve du TCF Canada. Ne traduis pas, n'ajoute aucun commentaire, ne reformule pas. Retourne uniquement la transcription textuelle brute en français.",
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Erreur transcription IA:', errorText);
    throw new Error(`Échec de la transcription audio par l'IA (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate || !candidate.trim()) {
    throw new Error("Le moteur de transcription IA n'a renvoyé aucun texte transcrit pour cet enregistrement.");
  }

  return candidate.trim();
}

// Fonction de notation avec Claude Sonnet
async function evaluateWithClaude(
  systemPrompt: string,
  userMessage: string,
  isRetry = false
): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("La variable d'environnement ANTHROPIC_API_KEY n'est pas configurée côté serveur.");
  }

  const retryInstruction = isRetry
    ? "\n\nATTENTION : La réponse précédente était incomplète ou invalide. Assure-toi de fournir un objet JSON STRICT et COMPLET sans markdown, avec tous les critères notés et un feedback détaillé non vide pour CHAQUE critère de la grille."
    : "";

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: `${systemPrompt}\n\n${JSON_OUTPUT_INSTRUCTION}${retryInstruction}`,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Erreur API notation IA:', errText);
    throw new Error(`Échec de l'évaluation par l'IA (${response.status}): ${errText}`);
  }

  const result = await response.json();
  
  // Extraire le texte de tous les blocs de type "text" (gère les modèles avec blocs de thinking / reasoning)
  let textContent = '';
  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textContent += block.text;
      }
    }
  }

  if (!textContent.trim()) {
    console.error('Réponse brute inattendue du moteur IA:', JSON.stringify(result));
    throw new Error("Le moteur d'évaluation IA n'a renvoyé aucun contenu textuel exploitable.");
  }

  return cleanAndParseJSON(textContent);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Vérification de l'authentification utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autorisation manquante' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey;

    // Client avec le token de l'utilisateur pour vérifier son identité
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session utilisateur invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client admin service-role pour insertions protégées et décrémentation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Extraction du payload
    const payload: CorrectionPayload = await req.json();
    const {
      task_type,
      consigne,
      raw_text: inputRawText,
      audio_url,
      audio_base64,
      mime_type = 'audio/webm',
      reference,
      session_id,
      production_id,
    } = payload;

    const ALLOWED_TASK_TYPES = ['EE_tache1', 'EE_tache2', 'EE_tache3', 'EO_tache1', 'EO_tache2', 'EO_tache3'];
    if (!task_type || !consigne || !ALLOWED_TASK_TYPES.includes(task_type)) {
      return new Response(JSON.stringify({ error: 'Paramètres task_type valide et consigne obligatoires' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isEE = task_type.startsWith('EE');
    const isEO = task_type.startsWith('EO');
    const quotaType = isEE ? 'ee' : 'eo';

    // 3. Vérification du quota de l'étudiant
    // Dans le mode examen blanc, le quota d'examen blanc complet a déjà été validé/décompté
    let isExamenBlancSession = false;
    if (session_id) {
      try {
        const { data: sessData } = await supabaseAdmin
          .from('sessions_examen')
          .select('id, mode, etudiant_id')
          .eq('id', session_id)
          .maybeSingle();
        if (sessData && sessData.mode === 'examen_blanc' && sessData.etudiant_id === user.id) {
          isExamenBlancSession = true;
        }
      } catch (errSess) {
        console.warn('Erreur vérification session examen blanc:', errSess);
      }
    }

    let remaining = 1;
    let quotaCheck: any = null;

    if (!isExamenBlancSession) {
      const { data: qData, error: quotaCheckErr } = await supabaseAdmin.rpc('check_user_quota', {
        p_user_id: user.id,
        p_type: quotaType,
      });

      if (quotaCheckErr) {
        console.error('Erreur vérification quota:', quotaCheckErr);
      }

      quotaCheck = qData;
      remaining = qData?.remaining ?? 0;
      if (remaining <= 0) {
        return new Response(
          JSON.stringify({
            error: 'QUOTA_EXHAUSTED',
            message: `Votre quota de corrections ${isEE ? 'écrites' : 'orales'} est épuisé. Veuillez recharger ou mettre à niveau votre abonnement pour continuer.`,
            remaining: 0,
            plan_id: quotaCheck?.plan_id,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 4. Expression Orale : Transcription audio avec Gemini si nécessaire
    let rawText = inputRawText?.trim() || '';

    if (isEO && !rawText) {
      let base64ToTranscribe = audio_base64;

      // Si audio_url est fourni mais pas audio_base64, télécharger l'audio depuis Supabase Storage uniquement (anti-SSRF)
      if (!base64ToTranscribe && audio_url) {
        try {
          const parsedAudioUrl = new URL(audio_url);
          const allowedOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
          if (parsedAudioUrl.protocol !== 'https:' || (allowedOrigin && parsedAudioUrl.origin !== allowedOrigin)) {
            return new Response(JSON.stringify({ error: 'URL audio non autorisée.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          const audioResp = await fetch(parsedAudioUrl.toString());
          if (audioResp.ok) {
            const arrayBuf = await audioResp.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuf);
            let binary = '';
            for (let i = 0; i < uint8.byteLength; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            base64ToTranscribe = btoa(binary);
          }
        } catch (fetchErr) {
          console.error("Erreur téléchargement audio_url:", fetchErr);
        }
      }

      if (!base64ToTranscribe) {
        return new Response(JSON.stringify({ error: "Fichier audio ou transcription requis pour l'expression orale." }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Appel de transcription Gemini
      rawText = await transcribeAudioWithGemini(base64ToTranscribe, mime_type);
    }

    if (!rawText) {
      return new Response(JSON.stringify({ error: "Aucun texte ou transcription disponible à évaluer." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Enregistrement de la soumission dans `submissions`
    const { data: submission, error: subInsertErr } = await supabaseAdmin
      .from('submissions')
      .insert({
        user_id: user.id,
        task_type,
        raw_text: rawText,
        file_url: audio_url || null,
        consigne,
        reference: reference || null,
        session_id: session_id || null,
        production_id: production_id || null,
      })
      .select()
      .single();

    if (subInsertErr || !submission) {
      console.error('Erreur insertion submission:', subInsertErr);
      throw new Error("Impossible d'enregistrer la soumission dans la base de données.");
    }

    // 6. Préparation du prompt et évaluation par Claude
    const systemPrompt = isEE ? PROMPT_SYSTEME_EXPRESSION_ECRITE : PROMPT_SYSTEME_EXPRESSION_ORALE;
    const taskTitle = isEE
      ? `EXPRESSION ÉCRITE — ${task_type.replace('_', ' ').toUpperCase()}`
      : `EXPRESSION ORALE — ${task_type.replace('_', ' ').toUpperCase()}`;

    const userMessage = `
ÉVALUATION TCF CANADA — ${taskTitle}

CONSIGNE OFFICIELLE DE L'ÉPREUVE :
"""
${consigne}
"""

${isEO ? "TRANSCRIPTION DE LA PRESTATION ORALE DU CANDIDAT :" : "RÉDACTION DU CANDIDAT :"}
"""
${rawText}
"""

Confronte la consigne et la prestation du candidat selon la grille de notation officielle sur 20 points.
Attribue les notes détaillées pour chaque critère, justifie chaque score, relève les erreurs avec corrections précises, rédige la version améliorée et propose le plan de progression personnalisé.
Retourne impérativement le résultat au format JSON strict spécifié.
`.trim();

    // Premier essai d'évaluation par Claude
    let evaluationData: any = null;
    try {
      evaluationData = await evaluateWithClaude(systemPrompt, userMessage, false);
      // Garde-fou qualité : vérification de validité
      if (!isCorrectionValid(evaluationData)) {
        console.warn('JSON Claude incomplet ou invalide lors du premier essai. Tentative de retry...');
        evaluationData = await evaluateWithClaude(systemPrompt, userMessage, true);
      }
    } catch (evalErr) {
      console.warn('Erreur au 1er appel Claude, tentative de retry immédiate:', evalErr);
      evaluationData = await evaluateWithClaude(systemPrompt, userMessage, true);
    }

    // Validation finale après retry
    if (!isCorrectionValid(evaluationData)) {
      throw new Error("La correction automatique n'a pas pu générer une grille complète conforme aux normes de qualité.");
    }

    // 7. Décrémentation atomique du quota (uniquement hors session examen blanc)
    let quotaRestantApres = remaining;
    if (!isExamenBlancSession) {
      const { data: decrementResult, error: decrementErr } = await supabaseAdmin.rpc('decrement_user_quota', {
        p_user_id: user.id,
        p_type: quotaType,
      });

      if (decrementErr) {
        console.error('Erreur décrémentation quota:', decrementErr);
      }

      quotaRestantApres = decrementResult?.remaining ?? (remaining - 1);
    }

    // 8. Insertion de la correction dans `corrections`
    const { data: correction, error: corrInsertErr } = await supabaseAdmin
      .from('corrections')
      .insert({
        submission_id: submission.id,
        note_linguistique: evaluationData.note_linguistique || {},
        note_pragmatique: evaluationData.note_pragmatique || {},
        note_sociolinguistique: evaluationData.note_sociolinguistique || {},
        total: evaluationData.total,
        niveau_cecrl: evaluationData.niveau_cecrl,
        feedback_par_critere: {
          ...(evaluationData.feedback_par_critere || {}),
          appreciation_generale: evaluationData.appreciation_generale || '',
          points_forts: evaluationData.points_forts || [],
          points_faibles: evaluationData.points_faibles || [],
        },
        erreurs_et_corrections: evaluationData.erreurs_et_corrections || [],
        analyse_consigne: typeof evaluationData.analyse_consigne === 'object'
          ? JSON.stringify(evaluationData.analyse_consigne)
          : evaluationData.analyse_consigne || null,
        version_amelioree: evaluationData.version_amelioree || null,
        plan_progression: evaluationData.plan_progression || {},
        ai_model_used: CLAUDE_MODEL,
        prompt_version: 'v1.0',
      })
      .select()
      .single();

    if (corrInsertErr || !correction) {
      console.error('Erreur insertion correction:', corrInsertErr);
      throw new Error("Impossible d'enregistrer la correction dans la base de données.");
    }

    // 9. Synchronisation avec `productions` si existant ou applicable
    try {
      const epreuveLabel = isEE ? 'expression_ecrite' : 'expression_orale';
      const numTache = parseInt(task_type.slice(-1), 10) || 1;

      if (production_id) {
        await supabaseAdmin.from('productions').update({
          statut_correction: 'corrige',
          score: evaluationData.total,
          commentaire: evaluationData.appreciation_generale || 'Correction automatique par IA',
          grille_notation: {
            dimensions: [
              evaluationData.note_linguistique,
              evaluationData.note_pragmatique,
              evaluationData.note_sociolinguistique,
            ],
            total: evaluationData.total,
            niveau_cecrl: evaluationData.niveau_cecrl,
            feedback_par_critere: evaluationData.feedback_par_critere,
            erreurs: evaluationData.erreurs_et_corrections,
            version_amelioree: evaluationData.version_amelioree,
          },
          corrige_at: new Date().toISOString(),
        }).eq('id', production_id).eq('etudiant_id', user.id);
      } else if (session_id) {
        // Mettre à jour la production dans la session
        await supabaseAdmin.from('productions').update({
          statut_correction: 'corrige',
          score: evaluationData.total,
          commentaire: evaluationData.appreciation_generale || 'Correction automatique par IA',
          grille_notation: {
            total: evaluationData.total,
            niveau_cecrl: evaluationData.niveau_cecrl,
            feedback_par_critere: evaluationData.feedback_par_critere,
            version_amelioree: evaluationData.version_amelioree,
          },
          corrige_at: new Date().toISOString(),
        }).eq('session_id', session_id).eq('etudiant_id', user.id).eq('epreuve', epreuveLabel).eq('numero_tache', numTache);
      }
    } catch (syncErr) {
      console.warn('Avertissement sync productions:', syncErr);
    }

    // 10. Réponse finale avec résultat complet
    return new Response(
      JSON.stringify({
        success: true,
        submission,
        correction: {
          ...correction,
          evaluation: evaluationData,
        },
        quota_restant: quotaRestantApres,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Erreur globale correct-expression:', err);
    return new Response(
      JSON.stringify({
        error: 'CORRECTION_FAILED',
        message: err?.message || 'Une erreur inattendue est survenue lors de la correction par IA.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
