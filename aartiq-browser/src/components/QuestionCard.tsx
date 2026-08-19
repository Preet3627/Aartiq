"use client";

import React, { memo, useState } from "react";
import { HelpCircle, ArrowRight, CornerDownRight, SkipForward, Send } from "lucide-react";
import type { AartiqQuestion } from "@/lib/aiQuestion";

interface QuestionCardProps {
  question: AartiqQuestion;
  answered: boolean;
  answer?: string;
  skipped?: boolean;
  onAnswer: (text: string) => void;
  onSkip: () => void;
}

const QuestionCard = memo(function QuestionCard({
  question,
  answered,
  answer,
  skipped,
  onAnswer,
  onSkip,
}: QuestionCardProps) {
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    onAnswer(v);
  };

  const toggleOption = (opt: string) => {
    if (!question.multi) {
      submit(opt);
      return;
    }
    setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  };

  const submitMulti = () => {
    if (selected.length === 0) return;
    onAnswer(selected.join(", "));
  };

  return (
    <div
      className="mt-2 w-full rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_45%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_92%,transparent)] p-3.5 shadow-sm"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
          <HelpCircle size={12} />
        </div>
        <p className="text-[13px] font-semibold leading-snug text-[var(--primary-text)]">{question.question}</p>
      </div>

      {answered ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--primary-text)]">
          <CornerDownRight size={13} className="shrink-0 text-[var(--accent)]" />
          {skipped ? (
            <span className="italic text-[color-mix(in_srgb,var(--secondary-text)_80%,transparent)]">Skipped — continuing with a reasonable default.</span>
          ) : (
            <span className="truncate">{answer}</span>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {question.options.map((opt, i) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all ${
                    isSel
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)] hover:brightness-110"
                  }`}
                >
                  {question.multi && (
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[9px] ${
                        isSel ? "border-white bg-white/20 text-white" : "border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                      }`}
                    >
                      {isSel ? "✓" : ""}
                    </span>
                  )}
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {question.multi && selected.length > 0 && (
            <button
              type="button"
              onClick={submitMulti}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:brightness-110"
            >
              <Send size={12} /> Submit selection
            </button>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCustom((v) => !v)}
              className="text-[11px] font-medium text-[var(--secondary-text)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
            >
              {showCustom ? "Hide custom answer" : "Type your own answer"}
            </button>
            {showCustom && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit(custom))}
                  placeholder="Write your own answer…"
                  className="min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] bg-[color-mix(in_srgb,var(--primary-bg)_60%,transparent)] px-3 py-2 text-[12px] text-[var(--primary-text)] outline-none placeholder:text-[var(--secondary-text)]/60 focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => submit(custom)}
                  disabled={!custom.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all hover:brightness-110 disabled:opacity-40"
                  title="Send answer"
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--secondary-text)]/80 transition-colors hover:text-[var(--primary-text)]"
          >
            <SkipForward size={12} /> Skip this question
          </button>
        </div>
      )}
    </div>
  );
});

export default QuestionCard;
