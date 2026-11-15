import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import dns from "dns";

const PLAN_CATALOG: Record<
  string,
  { nom: string; priceXof: number; dureeJours: number; cleanDescription: string }
> = {
  essentiel: {
    nom: "Formule Essentiel",
    cleanDescription: "Mon TCFCA Formule Essentiel 30 jours",
    priceXof: 9500,
    dureeJours: 30,
  },
  standard: {
    nom: "Formule Standard",
    cleanDescription: "Mon TCFCA Formule Standard 30 jours",
    priceXof: 18500,
    dureeJours: 30,
  },
  intensif: {
    nom: "Formule Intensif",
    cleanDescription: "Mon TCFCA Formule Intensif 40 jours",
    priceXof: 29900,
    dureeJours: 40,
  },
  express: {
    nom: "Formule Express",
    cleanDescription: "Mon TCFCA Formule Express 14 jours",
    priceXof: 9500,
    dureeJours: 14,
  },
  pack_express: {
    nom: "Formule Express",
    cleanDescription: "Mon TCFCA Formule Express 14 jours",
    priceXof: 9500,
    dureeJours: 14,
  },
};

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk: any) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cinetpayLocalProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: "cinetpay-local-proxy",
    configureServer(server) {
      dns.setDefaultResultOrder("ipv4first");

      const apiKey = (env.CINETPAY_API_KEY || "").trim();
      const apiPassword = (env.CINETPAY_API_PASSWORD || "").trim();
      const baseUrl = (env.CINETPAY_BASE_URL || "https://api.cinetpay.net").replace(/\/+$/, "");
      const supabaseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
      const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || "").trim();

      async function getCinetPayToken() {
        const res = await fetch(`${baseUrl}/v1/oauth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ api_key: apiKey, api_password: apiPassword }),
        });
        const data: any = await res.json().catch(() => ({}));
        const token = data?.access_token || data?.data?.token || data?.token;
        if (token) return { token };
        return {
          error:
            data?.description ||
            data?.message ||
            data?.status ||
            `Erreur authentification CinetPay (${res.status})`,
          raw: data,
        };
      }

      server.middlewares.use("/api/cinetpay-local/checkout", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          if (!apiKey || !apiPassword) {
            return sendJson(res, 200, {
              error: "CINETPAY_API_KEY ou CINETPAY_API_PASSWORD manquant dans .env.local",
            });
          }

          const authHeader = req.headers.authorization;
          if (!authHeader) {
            return sendJson(res, 200, {
              error: "Session non autorisée. Veuillez vous connecter.",
            });
          }

          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              Authorization: authHeader,
              apikey: supabaseAnonKey,
            },
          });
          if (!userRes.ok) {
            return sendJson(res, 200, {
              error: "Session expirée. Veuillez vous reconnecter pour payer.",
            });
          }
          const user: any = await userRes.json();

          const body = await readJsonBody(req);
          const { planId, returnUrl, phoneNumber } = body;
          const normalizedPlanId = planId === "pack_express" ? "express" : planId;
          const targetPlan = PLAN_CATALOG[planId];
          if (!targetPlan) {
            return sendJson(res, 200, { error: `Plan invalide sélectionné : ${planId}` });
          }

          const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=nom,prenom,pays,telephone`,
            {
              headers: {
                Authorization: authHeader,
                apikey: supabaseAnonKey,
              },
            }
          );
          const profiles: any = profileRes.ok ? await profileRes.json().catch(() => []) : [];
          const profile = Array.isArray(profiles) ? profiles[0] : null;

          const customerName =
            (profile?.nom || "Candidat").replace(/[^a-zA-Z0-9\s]/g, "").trim() || "Candidat";
          const customerSurname =
            (profile?.prenom || "TCFCA").replace(/[^a-zA-Z0-9\s]/g, "").trim() || "TCFCA";
          const rawPhone = (phoneNumber || profile?.telephone || "+2250707070700").replace(
            /\s+/g,
            ""
          );

          const authResult = await getCinetPayToken();
          if (!authResult.token) {
            return sendJson(res, 200, {
              error: `CinetPay: ${authResult.error}`,
              details: authResult.raw,
            });
          }

          const transactionId = `TCF${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
          const amount = Math.round(targetPlan.priceXof);
          const notifyUrl = `${supabaseUrl}/functions/v1/cinetpay-webhook`;
          const successUrl = `${supabaseUrl}/functions/v1/cinetpay-redirect?tx=${encodeURIComponent(
            transactionId
          )}`;
          const failedUrl = `${supabaseUrl}/functions/v1/cinetpay-redirect?tx=${encodeURIComponent(
            transactionId
          )}&failed=1`;

          const payRes = await fetch(`${baseUrl}/v1/payment`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authResult.token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              currency: "XOF",
              merchant_transaction_id: transactionId,
              amount,
              lang: "FR",
              designation: targetPlan.cleanDescription,
              client_email: user.email || "candidat@montcfca.com",
              client_first_name: customerSurname,
              client_last_name: customerName,
              client_phone_number: rawPhone,
              success_url: successUrl,
              failed_url: failedUrl,
              notify_url: notifyUrl,
              channel: "WEB",
            }),
          });

          const payData: any = await payRes.json().catch(() => ({}));
          const paymentUrl = payData?.payment_url || payData?.data?.payment_url;
          const paymentToken = payData?.payment_token || payData?.data?.payment_token;

          if (!paymentUrl) {
            return sendJson(res, 200, {
              error:
                payData?.description ||
                payData?.message ||
                `Échec création paiement CinetPay (${payData?.code || payRes.status})`,
              details: payData,
            });
          }

          const clientReturnUrl = returnUrl || "http://localhost:5173/etudiant/abonnement/succes";
          await fetch(`${supabaseUrl}/rest/v1/paiements`, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              apikey: supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              user_id: user.id,
              etudiant_id: user.id,
              montant: amount,
              amount,
              devise: "XOF",
              currency: "XOF",
              provider: "cinetpay",
              methode: "cinetpay",
              provider_payment_id: transactionId,
              transaction_id: transactionId,
              status: "en_attente",
              statut: "en_attente",
              metadata: {
                project: "mon-tcfca",
                planId: normalizedPlanId,
                userEmail: user.email || "",
                returnUrl: clientReturnUrl,
                transactionId,
                paymentToken: paymentToken || "",
              },
              created_at: new Date().toISOString(),
            }),
          });

          return sendJson(res, 200, {
            transactionId,
            paymentToken,
            paymentUrl,
            url: paymentUrl,
          });
        } catch (err: any) {
          return sendJson(res, 200, { error: err?.message || "Erreur proxy local CinetPay" });
        }
      });

      server.middlewares.use("/api/cinetpay-local/verify", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          const body = await readJsonBody(req);
          const transactionId = body?.transactionId;
          if (!transactionId) {
            return sendJson(res, 400, { error: "transactionId manquant" });
          }

          const authResult = await getCinetPayToken();
          if (!authResult.token) {
            return sendJson(res, 200, {
              success: false,
              error: `CinetPay: ${authResult.error}`,
            });
          }

          const checkRes = await fetch(
            `${baseUrl}/v1/payment/${encodeURIComponent(transactionId)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${authResult.token}`,
                Accept: "application/json",
              },
            }
          );
          const checkData: any = await checkRes.json().catch(() => ({}));
          const statusStr = String(
            checkData?.status || checkData?.data?.status || "PENDING"
          ).toUpperCase();
          const isSuccess =
            statusStr === "SUCCESS" ||
            statusStr === "ACCEPTED" ||
            String(checkData?.code) === "100";

          return sendJson(res, 200, {
            success: isSuccess,
            status: statusStr,
            transactionId,
            data: checkData,
          });
        } catch (err: any) {
          return sendJson(res, 200, { success: false, error: err?.message || "Erreur vérification" });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      cinetpayLocalProxyPlugin(env),
      svgr({
        svgrOptions: {
          icon: true,
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
