import React, { useRef } from 'react';
import { toast } from 'sonner';

interface RestrictedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChangeValue: (value: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
}

/**
 * Textarea hautement sécurisé pour les épreuves d'Expression Écrite TCF :
 * - Interdiction absolue du collage (Ctrl+V, Cmd+V, Shift+Ins, clic droit, appui long mobile, drag & drop)
 * - Désactivation stricte de la correction automatique (Mobile & PC)
 * - Désactivation du révélateur de fautes / orthographe (Spellcheck, Grammarly, LanguageTool, MS Editor)
 * - Désactivation de l'anticipation et prédiction de mots
 */
export default function RestrictedTextarea({
  value,
  onChangeValue,
  className = '',
  placeholder = 'Rédigez votre réponse ici...',
  minHeight = 'min-h-36',
  ...props
}: RestrictedTextareaProps) {
  const lastLengthRef = useRef(value?.length || 0);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toast.error("Le collage de texte est strictement interdit pour cette épreuve.");
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Bloquer le menu contextuel (qui contient l'option 'Coller' sur desktop et mobile)
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bloquer Ctrl+V (Windows/Linux) et Cmd+V (macOS)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
      e.preventDefault();
      e.stopPropagation();
      toast.error("Le collage de texte est strictement interdit pour cette épreuve.");
      return;
    }

    // Bloquer Shift+Insert (raccourci alternatif de collage)
    if (e.shiftKey && (e.key === 'Insert' || e.code === 'Insert')) {
      e.preventDefault();
      e.stopPropagation();
      toast.error("Le collage de texte est strictement interdit pour cette épreuve.");
      return;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const diff = newValue.length - (lastLengthRef.current || 0);

    // Sécurité supplémentaire anti-collage mobile (si le clavier virtuel injecte un bloc de texte)
    if (diff > 15) {
      toast.error("Le collage de texte est strictement interdit pour cette épreuve.");
      return;
    }

    lastLengthRef.current = newValue.length;
    onChangeValue(newValue);
  };

  return (
    <textarea
      {...props}
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      placeholder={placeholder}
      // 1. Pas de correcteur automatique
      autoCorrect="off"
      // 2. Pas de révélateur de fautes / orthographe
      spellCheck={false}
      // 3. Pas d'anticipation ou prédiction de mots
      autoCapitalize="none"
      autoComplete="off"
      inputMode="text"
      aria-autocomplete="none"
      // 4. Bloquage des extensions de correction (Grammarly, LanguageTool, Edge Editor)
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
      data-lt-active="false"
      data-ms-editor="false"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      className={`w-full ${minHeight} text-base px-3.5 py-3 rounded-md border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed ${className}`}
    />
  );
}
