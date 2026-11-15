import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuotaExhaustedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'ee' | 'eo';
}

export default function QuotaExhaustedModal({
  open,
  onOpenChange,
  type,
}: QuotaExhaustedModalProps) {
  const navigate = useNavigate();
  const isEE = type === 'ee';

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/etudiant/abonnement');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl">
        <DialogHeader className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-heading font-extrabold text-[#0d233a]">
            Quota de corrections {isEE ? 'écrites' : 'orales'} épuisé
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed text-pretty">
            Vous avez utilisé la totalité de vos crédits de correction automatique par IA pour cette épreuve. Mettez à niveau votre formule d'abonnement pour continuer à vous entraîner en illimité et progresser rapidement vers le niveau C1/C2.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Formule recommandée :</span>
            <Badge className="bg-[#eff4ff] text-[#0d233a] border-[#d3e4fe]">Standard ou Intensif</Badge>
          </div>
          <p className="text-slate-600 text-[11px]">
            ✓ Accès à 20 ou 50 corrections écrites &amp; 12 à 30 orales
            <br />
            ✓ Analyse rigoureuse et transcription haute précision par notre IA
            <br />
            ✓ Moyens de paiement locaux : Wave, Orange, MTN, Moov &amp; Carte
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Plus tard
          </Button>
          <Button onClick={handleUpgrade} className="w-full sm:flex-1 gap-2 shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Voir les formules &amp; Recharger
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
