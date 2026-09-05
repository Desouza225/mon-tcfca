import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn } from 'lucide-react';

interface QuestionImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export default function QuestionImage({ src, alt = "Document / Illustration", className = "" }: QuestionImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <div className={`relative group rounded-lg overflow-hidden border border-border/80 bg-muted/15 p-1.5 transition-all hover:border-primary/40 ${className}`}>
        <img
          src={src}
          alt={alt}
          className="w-full max-h-[550px] object-contain rounded-md mx-auto block cursor-pointer transition-transform duration-200 group-hover:scale-[1.005]"
          onClick={() => setIsOpen(true)}
          loading="lazy"
        />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="absolute bottom-3 right-3 opacity-85 group-hover:opacity-100 bg-background/85 hover:bg-background backdrop-blur-sm border border-border/80 text-foreground text-xs px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          title="Agrandir le document"
        >
          <ZoomIn className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">Agrandir</span>
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[94vh] p-3 md:p-5 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
          <DialogTitle className="sr-only">Aperçu agrandi du document</DialogTitle>
          <div className="relative w-full h-full flex items-center justify-center overflow-auto max-h-[86vh]">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[85vh] object-contain rounded-md shadow-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
