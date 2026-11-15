import type React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, AlertCircle, Lightbulb, Check } from 'lucide-react';
import { InteractiveQcm, type QcmQuestion } from '@/components/common/InteractiveQcm';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  if (!content) return null;

  // Découpage par lignes pour un parsing structuré
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2.5 my-3 pl-1">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    // 1. Remplacer les résidus mathématiques / LaTeX et barres verticales isolées
    const cleaned = text
      .replace(/\$\\rightarrow\$/g, '→')
      .replace(/\\rightarrow/g, '→')
      .replace(/\$\\neq\$/g, '≠')
      .replace(/\\neq/g, '≠')
      .replace(/\|/g, ' '); // Élimination définitive de toute barre verticale résiduelle

    // 2. Découpage du gras, italique et code en ligne
    const parts = cleaned.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    let offset = 0;
    return parts.map((part) => {
      const partKey = `${offset}-${part.slice(0, 12)}`;
      offset += part.length;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partKey} className="font-bold text-[#0d233a] dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={partKey} className="italic text-[#1a365d] dark:text-slate-200">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={partKey} className="px-2 py-0.5 rounded-lg bg-[#eff4ff] dark:bg-slate-800 text-[#0d233a] dark:text-blue-200 font-sans text-sm sm:text-[15px] font-bold border border-[#bcd7fd] dark:border-slate-700 shadow-2xs inline-block my-0.5 mx-0.5 tracking-tight">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Ligne vide
    if (!trimmed) {
      flushList();
      continue;
    }

    // Séparateur horizontal --- ou ***
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-6 border-slate-200/80 dark:border-slate-800" />);
      continue;
    }

    // ═══ BLOC QCM INTERACTIF (:::qcm ou ```qcm) ═══
    if (trimmed.startsWith(':::qcm') || trimmed.startsWith('```qcm')) {
      flushList();
      const isFence = trimmed.startsWith('```');
      const closingTag = isFence ? '```' : ':::';
      const qcmLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== closingTag) {
        qcmLines.push(lines[i]);
        i++;
      }
      const rawText = qcmLines.join('\n').trim();
      let questions: QcmQuestion[] = [];

      // Tentative de parsing JSON d'abord
      if (rawText.startsWith('[') || rawText.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawText);
          questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        } catch (e) {
          console.warn('Erreur parsing JSON QCM:', e);
        }
      }

      // Si le JSON n'est pas utilisé ou a échoué, parsing textuel structuré (Q: / - / R:)
      if (questions.length === 0 && rawText.length > 0) {
        let curQuestion: Partial<QcmQuestion> | null = null;
        const textLines = rawText.split('\n');
        for (const tLine of textLines) {
          const tTrim = tLine.trim();
          if (!tTrim) continue;

          if (tTrim.startsWith('Q:') || tTrim.startsWith('Question:')) {
            if (curQuestion?.question && curQuestion.options && curQuestion.options.length > 0) {
              questions.push({
                question: curQuestion.question,
                options: curQuestion.options,
                answer: curQuestion.answer ?? 0,
                explanation: curQuestion.explanation ?? '',
              });
            }
            curQuestion = {
              question: tTrim.replace(/^(Q:|Question:)\s*/, ''),
              options: [],
              answer: 0,
              explanation: '',
            };
          } else if (tTrim.startsWith('- ') || tTrim.startsWith('* ')) {
            if (curQuestion) {
              const optText = tTrim.slice(2).trim();
              const isCorrect = optText.toLowerCase().includes('(correct)') || optText.toLowerCase().includes('(bonne réponse)');
              const cleanOpt = optText.replace(/\s*\((correct|bonne réponse)\)/i, '').trim();
              curQuestion.options = curQuestion.options || [];
              if (isCorrect) {
                curQuestion.answer = curQuestion.options.length;
              }
              curQuestion.options.push(cleanOpt);
            }
          } else if (tTrim.startsWith('R:') || tTrim.startsWith('E:') || tTrim.startsWith('Explication:')) {
            if (curQuestion) {
              curQuestion.explanation = tTrim.replace(/^(R:|E:|Explication:)\s*/, '');
            }
          }
        }
        if (curQuestion?.question && curQuestion.options && curQuestion.options.length > 0) {
          questions.push({
            question: curQuestion.question,
            options: curQuestion.options,
            answer: curQuestion.answer ?? 0,
            explanation: curQuestion.explanation ?? '',
          });
        }
      }

      if (questions.length > 0) {
        elements.push(
          <InteractiveQcm
            key={`qcm-${elements.length}-${i}`}
            questions={questions}
          />
        );
      }
      continue;
    }

    // ═══ TABLEAU MARKDOWN (| ... | ... |) ═══
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--; // Réajuster le curseur

      const isSeparator = (lineStr: string) => {
        // Ligne de délimitation type | :--- | :--- | ou | --- | --- |
        return /^\|(\s*:?-+:?\s*\|)+$/.test(lineStr);
      };

      const parseRow = (lineStr: string) => {
        const rawCells = lineStr.split('|');
        // slice(1, -1) retire le premier et dernier élément vide issu du split
        return rawCells.slice(1, rawCells.length - 1).map((c) => c.trim());
      };

      let headers: string[] = [];
      let rows: string[][] = [];

      if (tableLines.length >= 2 && isSeparator(tableLines[1])) {
        headers = parseRow(tableLines[0]);
        rows = tableLines.slice(2).filter((l) => !isSeparator(l)).map(parseRow);
      } else {
        rows = tableLines.filter((l) => !isSeparator(l)).map(parseRow);
      }

      if (headers.length > 0 || rows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}-${i}`} className="my-6 overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              {headers.length > 0 && (
                <thead className="bg-[#0d233a] text-white">
                  <tr>
                    {headers.map((h) => (
                      <th key={`th-${h}`} className="px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider border-b border-slate-800">
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, rIdx) => (
                  <tr key={`tr-${row.join('-')}`} className={cn('hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors', rIdx % 2 === 1 && 'bg-slate-50/40 dark:bg-slate-900/40')}>
                    {row.map((cell, cIdx) => (
                      <td key={`td-${headers[cIdx] ?? cIdx}-${cell}`} className="px-4 py-3 text-slate-700 dark:text-slate-300 align-top leading-relaxed">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Titre H1 #
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] dark:text-white mt-6 mb-3 tracking-tight border-b pb-2 border-slate-100">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Titre H2 ##
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl sm:text-2xl font-heading font-bold text-[#0d233a] dark:text-white mt-6 mb-3 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e53e3e]" />
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    // Titre H3 ###
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-heading font-semibold text-[#1a365d] dark:text-slate-200 mt-5 mb-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#d97706]" />
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    // Blockquote / Encadré pédagogique >
    if (trimmed.startsWith('> ') || trimmed === '>') {
      flushList();
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const curTrim = lines[i].trim();
        if (curTrim.startsWith('> ') || curTrim === '>') {
          quoteLines.push(curTrim.replace(/^>\s?/, ''));
          i++;
        } else if (curTrim === '' && i + 1 < lines.length && (lines[i + 1].trim().startsWith('> ') || lines[i + 1].trim() === '>')) {
          quoteLines.push('');
          i++;
        } else {
          break;
        }
      }
      i--; // Réajuster le curseur de boucle

      const fullQuoteText = quoteLines.join(' ');
      const isTip = fullQuoteText.toLowerCase().includes('conseil') || fullQuoteText.toLowerCase().includes('astuce');
      const isWarning = fullQuoteText.toLowerCase().includes('attention') || fullQuoteText.toLowerCase().includes('important') || fullQuoteText.toLowerCase().includes('interdit') || fullQuoteText.toLowerCase().includes('pénalité');

      elements.push(
        <div
          key={`quote-${elements.length}-${i}`}
          className={cn(
            'p-4 rounded-xl my-4 text-sm leading-relaxed border flex items-start gap-3 shadow-xs',
            isTip
              ? 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
              : isWarning
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]'
          )}
        >
          {isTip ? (
            <Lightbulb className="w-5 h-5 shrink-0 text-[#d97706] mt-0.5" />
          ) : isWarning ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-[#e53e3e] mt-0.5" />
          ) : (
            <Sparkles className="w-5 h-5 shrink-0 text-[#2563eb] mt-0.5" />
          )}
          <div className="flex-1 font-medium space-y-2">
            {quoteLines.map((qLine, qIdx) => {
              const qKey = `${qLine || 'empty'}-${qIdx.toString()}`;
              if (!qLine) return <div key={qKey} className="h-1.5" />;
              return <div key={qKey}>{parseInline(qLine)}</div>;
            })}
          </div>
        </div>
      );
      continue;
    }

    // Liste à puces (* ou -)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const itemText = trimmed.slice(2);

      // Cas spécifique : Checklist (* [ ] ou * [x])
      if (itemText.startsWith('[ ] ') || itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
        flushList();
        const checked = itemText.startsWith('[x] ') || itemText.startsWith('[X] ');
        const taskText = itemText.slice(4);
        elements.push(
          <div key={`checklist-${i}`} className="flex items-center gap-3 my-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200/90 text-sm text-slate-700">
            <div className={cn('w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors', checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent')}>
              <Check className={cn('w-3.5 h-3.5', checked ? 'text-white' : 'text-transparent')} />
            </div>
            <span className={cn('flex-1 font-medium', checked && 'line-through text-slate-400')}>
              {parseInline(taskText)}
            </span>
          </div>
        );
        continue;
      }

      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e53e3e] mt-2 shrink-0" />
          <span className="flex-1">{parseInline(itemText)}</span>
        </li>
      );
      continue;
    }

    // Liste numérotée (1. 2. etc)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      flushList();
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-3 my-2 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="w-6 h-6 rounded-lg bg-[#eff4ff] text-[#0d233a] font-heading font-bold text-xs flex items-center justify-center shrink-0 border border-[#d3e4fe]">
            {numMatch[1]}
          </span>
          <div className="flex-1 pt-0.5">{parseInline(numMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Paragraphe standard
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed my-2.5">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: content protection handlers prevent copy/cut/drag on course material
    <div
      className={cn('prose prose-slate max-w-none dark:prose-invert font-sans select-none', className)}
      onCopy={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clipboardData) {
          e.clipboardData.clearData();
          e.clipboardData.setData('text/plain', '');
        }
        window.getSelection()?.removeAllRanges();
      }}
      onCut={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clipboardData) {
          e.clipboardData.clearData();
          e.clipboardData.setData('text/plain', '');
        }
        window.getSelection()?.removeAllRanges();
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {elements}
    </div>
  );
}
