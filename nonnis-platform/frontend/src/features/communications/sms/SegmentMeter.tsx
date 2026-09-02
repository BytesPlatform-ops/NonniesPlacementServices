"use client";

import { AlertTriangle } from "lucide-react";
import { MAX_SMS_BODY_CHARS, type SegmentInfo } from "@/lib/sms-segments";

/**
 * Live character / encoding / segment readout. Always framed as an ESTIMATE —
 * the backend recomputes per recipient at queue time, and carrier billing varies.
 */
export function SegmentMeter({ info, bodyLength }: { info: SegmentInfo; bodyLength: number }) {
  const overLimit = bodyLength > MAX_SMS_BODY_CHARS;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          <strong className={overLimit ? "text-rose-600" : "text-umber"}>{bodyLength}</strong>
          <span className="text-slate-400"> / {MAX_SMS_BODY_CHARS} characters</span>
        </span>
        <span>
          Encoding: <strong className="text-umber">{info.encoding === "GSM7" ? "GSM-7" : "UCS-2 (Unicode)"}</strong>
        </span>
        <span>
          Est. segments: <strong className="text-umber">{info.segmentCount}</strong>
        </span>
        {info.segmentCount > 0 ? <span className="text-slate-400">{info.charactersRemainingCurrentSegment} left in this segment</span> : null}
      </div>

      {overLimit ? (
        <p className="flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          This message is longer than the {MAX_SMS_BODY_CHARS}-character limit and cannot be sent.
        </p>
      ) : info.encoding === "UCS2" ? (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          A non-GSM character (emoji, curly quote or accent) switched this message to Unicode, cutting each segment from 160 to 70 characters.
        </p>
      ) : info.multiSegment ? (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          This message spans {info.segmentCount} segments and is billed per segment, per recipient.
        </p>
      ) : null}
    </div>
  );
}
