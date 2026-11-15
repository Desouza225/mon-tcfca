import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const setupSecret = Deno.env.get('SETUP_SECRET_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variables SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes.');
    }

    // Utiliser le service role key pour l'API Admin
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authentification obligatoire : SETUP_SECRET_KEY, SERVICE_ROLE_KEY, ou utilisateur super_admin existant
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const headerSetupSecret = req.headers.get('x-setup-secret') || '';

    let isAuthorized = false;
    if (setupSecret && (headerSetupSecret === setupSecret || bearerToken === setupSecret)) {
      isAuthorized = true;
    } else if (serviceRoleKey && bearerToken === serviceRoleKey) {
      isAuthorized = true;
    } else if (bearerToken) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authData } = await userClient.auth.getUser();
      if (authData?.user) {
        const { data: callerProfile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (callerProfile?.role === 'super_admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Non autorisé : secret de configuration ou rôle super_admin requis.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = Deno.env.get('SUPER_ADMIN_EMAIL') || 'moralessedesouza@gmail.com';
    const password = Deno.env.get('SUPER_ADMIN_INITIAL_PASSWORD');

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    if (existing) {
      // Mettre à jour le profil si l'utilisateur existe déjà
      await supabaseAdmin.from('profiles').update({
        nom: 'De Souza',
        prenom: 'Morales',
        role: 'super_admin',
      }).eq('id', existing.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Super Admin déjà existant — profil mis à jour',
        userId: existing.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password || password.length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Variable SUPER_ADMIN_INITIAL_PASSWORD non définie ou trop courte dans les secrets Supabase.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Créer l'utilisateur via l'API Admin officielle
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom: 'De Souza', prenom: 'Morales' },
    });

    if (createError) {
      throw new Error(`Erreur création utilisateur: ${createError.message}`);
    }

    if (!newUser?.user?.id) {
      throw new Error('Aucun ID utilisateur retourné');
    }

    // Mettre à jour le profil avec le rôle super_admin
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nom: 'De Souza',
        prenom: 'Morales',
        role: 'super_admin',
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      throw new Error(`Erreur mise à jour profil: ${profileError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Super Admin créé avec succès',
      userId: newUser.user.id,
      email: newUser.user.email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Erreur setup-super-admin:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
