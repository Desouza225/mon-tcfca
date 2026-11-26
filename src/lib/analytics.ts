import { supabase } from '@/db/supabase';

const VISITOR_ID_KEY = 'mon_tcfca_visitor_id';
const LEGACY_SESSION_KEY = 'mon_tcfca_session_id';

function getSessionId(): string {
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
      visitorId = legacy || 'vis_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  } catch {
    let sessionId = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      sessionStorage.setItem(LEGACY_SESSION_KEY, sessionId);
    }
    return sessionId;
  }
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Enregistre une visite de page de manière asynchrone et résiliente.
 * Exclut systématiquement les visites administrateurs et les routes /admin.
 */
export async function trackPageView(
  pagePath: string,
  pageTitle?: string,
  userId?: string | null,
  options?: { isAdmin?: boolean }
): Promise<void> {
  try {
    const resolvedPath = pagePath || window.location.pathname;
    if (options?.isAdmin === true || resolvedPath.startsWith('/admin')) {
      return;
    }

    const sessionId = getSessionId();
    const deviceType = getDeviceType();
    const referrer = document.referrer ? new URL(document.referrer).hostname : 'direct';

    // Insertion asynchrone sans bloquer l'UI
    await supabase.from('site_visits').insert({
      session_id: sessionId,
      page_path: resolvedPath,
      page_title: pageTitle || document.title,
      referrer,
      device_type: deviceType,
      user_id: userId || null,
    });
  } catch (err) {
    // Échouer silencieusement pour ne jamais bloquer la navigation de l'utilisateur
    console.debug('Analytics tracking debug:', err);
  }
}
