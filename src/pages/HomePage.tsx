import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/common/BrandLogo';
import { CountryFlag } from '@/components/ui/CountryFlag';
import {
  Headphones,
  FileText,
  PenLine,
  Mic,
  CheckCircle,
  ArrowRight,
  Star,
  Sparkles,
  ShieldCheck,
  Award,
  GraduationCap,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const getDashboardLink = () => {
    if (!profile) return '/connexion';
    if (profile.role === 'etudiant') return '/etudiant';
    return '/admin';
  };

  const handleSelectPlan = (planKey: string) => {
    if (user) {
      navigate(`/etudiant/abonnement?plan=${planKey}`);
    } else {
      navigate(`/inscription?plan=${planKey}`);
    }
  };

  const epreuves = [
    {
      icon: FileText,
      titre: 'Compréhension Écrite',
      detail: '39 questions • 60 minutes',
      badge: 'QCM Auto-corrigé',
      badgeClass: 'bg-[#e5eeff] text-[#0d233a] border-0',
      iconBg: 'bg-[#dce9ff] text-[#0d233a]',
      description: 'Fiches pédagogiques + QCM interactifs à correction instantanée avec explications pas-à-pas sur les textes officiels.',
    },
    {
      icon: Headphones,
      titre: 'Compréhension Orale',
      detail: '39 items audio • 35 minutes',
      badge: 'QCM Auto-corrigé',
      badgeClass: 'bg-[#e5eeff] text-[#0d233a] border-0',
      iconBg: 'bg-[#dce9ff] text-[#0d233a]',
      description: 'Fiches pédagogiques + simulations audio d\'accents canadiens et québécois, validation automatique immédiate.',
    },
    {
      icon: PenLine,
      titre: 'Expression Écrite',
      detail: 'Tâches 1, 2 et 3 • 60 minutes',
      badge: 'Professeur & IA spécialisée',
      badgeClass: 'bg-[#ffdcc3] text-[#6e3900] border-0',
      iconBg: 'bg-[#ffdcc3] text-[#cf7100]',
      description: 'Fiches méthodologiques + double correction : pré-analyse immédiate par IA et relecture détaillée par un professeur certifié FLE selon la grille officielle FEI.',
    },
    {
      icon: Mic,
      titre: 'Expression Orale',
      detail: '3 tâches en continu • 12 minutes',
      badge: 'Professeur & IA spécialisée',
      badgeClass: 'bg-[#ffdad7] text-[#930013] border-0',
      iconBg: 'bg-[#ffdad7] text-[#b51822]',
      description: 'Fiches pratiques + double retour : analyse acoustique/lexicale par IA et retours personnalisés d\'un enseignant expert TCF sur votre prononciation et argumentation.',
    },
  ];

  const testimonials = [
    {
      name: 'Marc D.',
      role: 'Ingénieur logiciel • Montréal',
      score: 'NCLC 8',
      scoreBadge: 'bg-[#ffdcc3] text-[#6e3900]',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      text: 'Le double regard de l\'IA instantanée combiné aux remarques pointues du professeur certifié sur mes rédactions m\'a permis de passer de B1 à C1 en 6 semaines. Dossier Entrée Express validé !',
    },
    {
      name: 'Aïcha B.',
      role: 'Candidate Résidence Permanente • Ottawa',
      score: 'NCLC 9',
      scoreBadge: 'bg-[#ffdcc3] text-[#6e3900]',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      text: 'Les fiches, les QCM et surtout le binôme prof-IA pour l\'oral ont fait toute la différence. Des corrections rapides et une vraie expertise humaine pour éliminer mes blocages.',
    },
    {
      name: 'Kevin L.',
      role: 'Installé à Québec',
      score: '520 pts CO',
      scoreBadge: 'bg-[#dce9ff] text-[#0d233a]',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      text: 'Les fiches méthodologiques par épreuve sont une mine d\'or. La correction automatique et le lecteur audio spécialisé permettent de s\'entraîner 24h/24 sans attendre.',
    },
  ];

  // Carrousel automatique Hero (1 image initiale + 3 nouvelles images avec textes promotionnels)
  const heroSlides: Array<{
    image: string;
    alt: string;
    topBadge: string;
    topBadgeCountry?: string;
    title: string;
    rating: string;
    text: string;
    bottomTitle: string;
    bottomSubtitle: string;
    bottomPill: string;
  }> = [
    {
      image: '/images/hero-slide-1-v8.jpg',
      alt: 'Binôme Pédagogique Mon TCF CA',
      topBadge: 'Norme FEI',
      title: 'Double regard expert',
      rating: '4.9 / 5 (+850 certifiés)',
      text: 'Analyse instantanée par IA spécialisée complétée par la relecture et validation approfondie d\'un enseignant certifié FLE sur vos expressions écrite et orale.',
      bottomTitle: 'Binôme Actif',
      bottomSubtitle: 'IA instantanée + Tuteur certifié',
      bottomPill: '100% Personnalisé',
    },
    {
      image: 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&auto=format&fit=crop&q=80',
      alt: 'Importance du TCF Canada pour Entrée Express',
      topBadge: 'Entrée Express',
      topBadgeCountry: 'CA',
      title: 'Le sésame pour le Canada',
      rating: 'Objectif NCLC 7 à 10',
      text: 'Le TCF Canada est décisif pour votre Résidence Permanente et Arrima : décrocher le niveau NCLC 7+ vous rapporte jusqu\'à 50 points supplémentaires dans le bassin CRS.',
      bottomTitle: 'Impact Immigration',
      bottomSubtitle: 'Boostez votre dossier IRCC & Québec',
      bottomPill: '+50 pts CRS',
    },
    {
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
      alt: 'Simulateur Examen Blanc TCF Canada',
      topBadge: 'Conditions Réelles',
      title: 'Examens blancs & +3 000 QCM',
      rating: 'Chronométrage officiel',
      text: 'Pratiquez sur des simulations fidèles au jour J en Compréhension Orale (39 audios) et Écrite (39 textes) avec calcul immédiat de votre score NCLC et corrigés détaillés.',
      bottomTitle: 'Simulateur Officiel',
      bottomSubtitle: '39 questions CO & 39 questions CE',
      bottomPill: 'Score Immédiat',
    },
    {
      image: '/images/hero-slide-4.jpg',
      alt: 'Fiches méthodologiques et audios canadiens',
      topBadge: 'Méthode C1/C2',
      title: 'Fiches de cours & Accents québécois',
      rating: 'Accès illimité 24h/24',
      text: 'Maîtrisez la structure des 3 tâches d\'Expression Écrite et Orale grâce à nos fiches stratégiques, plans types, connecteurs logiques et dialogues aux accents canadiens.',
      bottomTitle: 'Programme Complet',
      bottomSubtitle: 'Fiches, plans types & audios ciblés',
      bottomPill: '4 Épreuves',
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    if (isCarouselPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isCarouselPaused, heroSlides.length]);

  const currentSlide = heroSlides[activeSlide];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-40 bg-[#f8f9ff]/95 backdrop-blur-md border-b border-[#e2e8f0] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between py-2">
          <Link to="/" className="flex items-center py-1">
            <BrandLogo size="lg" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center space-x-2 bg-[#dce9ff]/60 px-3 py-1.5 rounded-full border border-[#d3e4fe]">
              <span className="w-2 h-2 rounded-full bg-[#e53e3e] animate-pulse" />
              <span className="text-xs font-heading font-semibold text-[#0d233a]">
                Sessions Ouvertes 2026
              </span>
            </div>

            {user ? (
              <Button
                asChild
                className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-sm px-4"
              >
                <Link to={getDashboardLink()} className="flex items-center gap-1.5">
                  <span>Mon Espace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  className="text-[#0d233a] hover:bg-[#eff4ff] rounded-xl text-sm font-semibold"
                >
                  <Link to="/connexion">Connexion</Link>
                </Button>
                <Button
                  asChild
                  className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-sm px-4 text-sm font-semibold"
                >
                  <Link to="/inscription">S'inscrire</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Top Trust Sub-Hero Banner */}
      <section className="bg-[#eff4ff] border-b border-[#d3e4fe]/50 py-3">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-2 bg-[#ffdcc3] text-[#6e3900] px-3 py-1 rounded-full font-bold text-xs shadow-xs">
            <span>Préparation certifiée NCLC 7+ &amp; Entrée Express</span>
          </div>
          <div className="flex items-center gap-2 text-[#475569]">
            <ShieldCheck className="w-4 h-4 text-[#0d233a]" />
            <span>
              <strong className="text-[#0d233a] font-semibold">89% de nos candidats</strong> atteignent le niveau requis dès le premier essai.
            </span>
          </div>
        </div>
      </section>

      {/* 3. Hero Section */}
      <section className="py-12 md:py-20 px-4 sm:px-6 relative overflow-hidden bg-gradient-hero">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Hero Left Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e2e8f0] shadow-xs text-xs font-semibold text-[#0d233a]">
              <Sparkles className="w-3.5 h-3.5 text-[#e53e3e]" />
              <span>Double correction humaine & IA spécialisée</span>
            </div>

            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#0d233a] tracking-tight leading-[1.15]">
              Décrochez votre <span className="text-[#e53e3e]">TCF Canada</span> grâce à l'entraînement intelligent et ciblé
            </h1>

            <p className="text-base sm:text-lg text-[#475569] leading-relaxed max-w-2xl">
              Fiches pédagogiques complètes, double correction experte en binôme (professeur certifié FLE/TCF &amp; IA spécialisée) pour vos expressions écrite et orale, et QCM interactifs pour viser le <strong>NCLC 7+</strong> en toute confiance.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                size="lg"
                className="bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold text-base py-6 px-8 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                onClick={() => {
                  if (user) navigate(getDashboardLink());
                  else navigate('/connexion');
                }}
              >
                <span>Commencer maintenant</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white hover:bg-[#eff4ff] text-[#0d233a] border-[#e2e8f0] font-heading font-bold text-base py-6 px-6 rounded-xl shadow-xs"
                onClick={() => {
                  const el = document.getElementById('epreuves');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Découvrir les 4 épreuves
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm text-[#475569] pt-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#e53e3e]" />
                <span>Simulateur en conditions réelles</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#e53e3e]" />
                <span>Sans engagement</span>
              </div>
            </div>
          </div>

          {/* Hero Right: Coach Spotlight Carousel Card (4 images + textes) */}
          <div className="lg:col-span-5">
            <div
              className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#e2e8f0] space-y-4 relative transition-all duration-300"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
            >
              {/* Image Slider Container */}
              <div className="relative rounded-xl overflow-hidden shadow-xs bg-[#0d233a]/5 h-52 group">
                {heroSlides.map((slide, idx) => (
                  <img
                    key={slide.image}
                    src={slide.image}
                    alt={slide.alt}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${
                      idx === activeSlide
                        ? 'opacity-100 scale-100 z-10'
                        : 'opacity-0 scale-105 z-0 pointer-events-none'
                    }`}
                  />
                ))}

                {/* Gradient overlay subtil en bas de l'image pour les puces */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent z-20 pointer-events-none" />

                {/* Badge supérieur droit */}
                <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#e53e3e]" />
                  <span className="text-[11px] font-heading font-bold text-[#0d233a] uppercase">
                    {currentSlide.topBadge}
                  </span>
                  {currentSlide.topBadgeCountry && (
                    <CountryFlag country={currentSlide.topBadgeCountry} imgClassName="w-3.5 h-2.5" />
                  )}
                </div>

                {/* Compteur de slide en haut à gauche */}
                <div className="absolute top-3 left-3 z-20 bg-[#0d233a]/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold">
                  {activeSlide + 1} / {heroSlides.length}
                </div>

                {/* Flèches Précédent / Suivant */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
                  }
                  aria-label="Image précédente"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-[#0d233a] flex items-center justify-center shadow-sm opacity-80 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((prev) => (prev + 1) % heroSlides.length)}
                  aria-label="Image suivante"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-[#0d233a] flex items-center justify-center shadow-sm opacity-80 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Indicateurs de pagination (4 points cliquables) */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                  {heroSlides.map((slide, idx) => (
                    <button
                      key={slide.title}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      aria-label={`Aller à la diapositive ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeSlide
                          ? 'w-6 bg-white shadow-xs'
                          : 'w-1.5 bg-white/60 hover:bg-white/90'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Texte d'accompagnement dynamique */}
              <div className="space-y-2 min-h-[84px]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading font-bold text-base sm:text-lg text-[#0d233a] transition-all duration-300">
                    {currentSlide.title}
                  </h3>
                  <div className="flex items-center text-[#d97706] text-xs font-bold gap-1 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-[#d97706]" />
                    <span>{currentSlide.rating}</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed transition-all duration-300">
                  {currentSlide.text}
                </p>
              </div>

              {/* Pied de carte dynamique */}
              <div className="bg-[#eff4ff] rounded-xl p-3 flex items-center justify-between border border-[#d3e4fe]/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0d233a] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <GraduationCap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-heading font-bold text-[#0d233a]">
                      {currentSlide.bottomTitle}
                    </p>
                    <p className="text-[11px] text-[#475569]">{currentSlide.bottomSubtitle}</p>
                  </div>
                </div>
                <span className="text-[11px] font-heading font-bold text-[#e53e3e] bg-white px-2.5 py-1 rounded-full shadow-xs border border-[#e2e8f0] shrink-0">
                  {currentSlide.bottomPill}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Les 4 Épreuves du TCF Canada */}
      <section id="epreuves" className="py-16 px-4 sm:px-6 bg-white border-y border-[#e2e8f0]">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-heading font-extrabold tracking-wider text-[#e53e3e]">
              Programme Officiel
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0d233a] tracking-tight">
              Une préparation ciblée sur les 4 épreuves
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Maîtrisez chaque composante selon la grille d'évaluation de France Éducation International.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {epreuves.map((epreuve) => (
              <Card
                key={epreuve.titre}
                className="bg-[#f8f9ff] border border-[#e2e8f0] hover:border-[#0d233a]/30 hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${epreuve.iconBg}`}>
                        <epreuve.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[#0d233a]">
                          {epreuve.titre}
                        </h3>
                        <p className="text-xs text-[#475569] font-medium mt-0.5">
                          {epreuve.detail}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${epreuve.badgeClass}`}>
                      {epreuve.badge}
                    </Badge>
                  </div>

                  <p className="text-sm text-[#475569] leading-relaxed">
                    {epreuve.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Témoignages & Preuve Sociale */}
      <section className="py-16 px-4 sm:px-6 bg-[#f8f9ff]">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-heading font-extrabold tracking-wider text-[#e53e3e]">
              Preuve Sociale
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0d233a] tracking-tight">
              Ils ont validé leur NCLC 7+ et vivent au Canada
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Découvrez les retours d'expérience de nos candidats admis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#e2e8f0] flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={t.avatar}
                        alt={t.name}
                        className="w-11 h-11 rounded-full object-cover border border-[#e2e8f0]"
                      />
                      <div>
                        <p className="font-heading font-bold text-sm text-[#0d233a]">{t.name}</p>
                        <p className="text-[11px] text-[#475569]">{t.role}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-heading font-extrabold px-2.5 py-0.5 rounded-full ${t.scoreBadge}`}>
                      {t.score}
                    </span>
                  </div>

                  <div className="flex text-[#d97706] gap-0.5">
                    {[1, 2, 3, 4, 5].map((starNumber) => (
                      <Star key={`star-${t.name}-${starNumber}`} className="w-4 h-4 fill-[#d97706]" />
                    ))}
                  </div>

                  <p className="text-sm text-[#475569] italic leading-relaxed">
                    "{t.text}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Formules & Tarifs */}
      <section id="tarifs" className="py-16 px-4 sm:px-6 bg-white border-t border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-heading font-extrabold tracking-wider text-[#e53e3e]">
              Investissement &amp; Tarifs
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0d233a] tracking-tight">
              Des formules adaptées à votre date d'examen
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Accélérez votre projet d'immigration canadienne avec le meilleur accompagnement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {/* 1. Essentiel */}
            <div className="bg-[#f8f9ff] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-lg text-[#0d233a]">Essentiel</h3>
                  <div className="font-heading font-extrabold text-2xl text-[#0d233a]">
                    14,99 $<span className="text-xs font-normal text-[#475569]">/mois</span>
                  </div>
                </div>
                <p className="text-xs text-[#475569]">
                  Idéal pour s'entraîner régulièrement et valider ses acquis.
                </p>
                <ul className="space-y-2.5 text-xs text-[#0b1c30] pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Banque illimitée (4 320 items CE &amp; CO)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>8 corrections écrites &amp; 4 audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>1 examen blanc complet noté</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full bg-white hover:bg-[#eff4ff] text-[#0d233a] border-[#e2e8f0] font-heading font-bold rounded-xl py-5"
                onClick={() => handleSelectPlan('essentiel')}
              >
                Choisir Essentiel
              </Button>
            </div>

            {/* 2. Standard (Featured) */}
            <div className="bg-gradient-to-b from-[#0d233a] to-[#1a365d] text-white rounded-2xl p-6 shadow-xl border-2 border-[#e53e3e] flex flex-col justify-between space-y-6 relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e53e3e] text-white text-[11px] font-heading font-extrabold uppercase px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                Le plus choisi (NCLC 7+)
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-lg text-white">Standard</h3>
                  <div className="font-heading font-extrabold text-2xl text-white">
                    29,99 $<span className="text-xs font-normal text-white/70">/mois</span>
                  </div>
                </div>
                <p className="text-xs text-white/80">
                  La formule recommandée pour cibler les niveaux C1 et C2.
                </p>
                <ul className="space-y-2.5 text-xs text-white/90 pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#ffdcc3] shrink-0 mt-0.5" />
                    <span><strong>Banque intégrale 4 320 items</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#ffdcc3] shrink-0 mt-0.5" />
                    <span>20 corrections écrites &amp; 12 audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#ffdcc3] shrink-0 mt-0.5" />
                    <span>2 examens blancs chronométrés</span>
                  </li>
                </ul>
              </div>

              <Button
                className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold rounded-xl py-5 shadow-md transition-all"
                onClick={() => handleSelectPlan('standard')}
              >
                Choisir Standard
              </Button>
            </div>

            {/* 3. Intensif */}
            <div className="bg-[#f8f9ff] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-lg text-[#0d233a]">Intensif</h3>
                  <div className="font-heading font-extrabold text-2xl text-[#0d233a]">
                    47,99 $<span className="text-xs font-normal text-[#475569]">/40 jours</span>
                  </div>
                </div>
                <p className="text-xs text-[#475569]">
                  Coaching d'élite pour viser le C2 et maximiser ses points Entrée Express.
                </p>
                <ul className="space-y-2.5 text-xs text-[#0b1c30] pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Accès VIP illimité (40 jours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>50 corrections écrites &amp; 30 audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>5 examens blancs complets</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full bg-white hover:bg-[#eff4ff] text-[#0d233a] border-[#e2e8f0] font-heading font-bold rounded-xl py-5"
                onClick={() => handleSelectPlan('intensif')}
              >
                Choisir Intensif
              </Button>
            </div>

            {/* 4. Express */}
            <div className="bg-[#f8f9ff] rounded-2xl p-6 border border-[#e2e8f0] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-[#0d233a]">Express</h3>
                    <p className="text-[11px] text-[#475569]">Sprint 14 jours</p>
                  </div>
                  <div className="font-heading font-extrabold text-2xl text-[#0d233a]">
                    14,99 $
                  </div>
                </div>
                <p className="text-xs text-[#475569]">
                  Mêmes avantages que la formule Standard, condensés sur 14 jours.
                </p>
                <ul className="space-y-2.5 text-xs text-[#0b1c30] pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Accès complet illimité 14 jours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>20 corrections écrites &amp; 12 audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>2 examens blancs complets</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full bg-white hover:bg-[#eff4ff] text-[#0d233a] border-[#e2e8f0] font-heading font-bold rounded-xl py-5"
                onClick={() => handleSelectPlan('express')}
              >
                Choisir Express
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-[#0d233a] text-white py-12 px-4 sm:px-6 mt-auto border-t border-[#1a365d]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-heading font-extrabold text-base tracking-tight text-white">
              Mon <span className="text-[#d62828]">TCF</span> CA
            </span>
            <p className="text-xs text-white/60 text-center md:text-left">
              Plateforme indépendante de préparation au Test de Connaissance du Français pour le Canada.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/75 font-medium">
            <a href="mailto:contact@mon-tcfca.com" className="hover:text-white transition-colors">contact@mon-tcfca.com</a>
            <Link to="/connexion" className="hover:text-white transition-colors">Espace Étudiant</Link>
            <Link to="/connexion" className="hover:text-white transition-colors">Espace Enseignant</Link>
            <span className="text-white/30">•</span>
            <span>© 2026 Mon TCF CA. Tous droits réservés.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
