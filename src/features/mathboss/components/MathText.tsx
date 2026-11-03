import { Fragment } from "react";

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "−", "ᵐ": "m", "ⁿ": "n",
};
const RUN = /([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵐⁿ]+)/;

// Unicode superscripts ("x²", "y⁴", "xᵐ⁺ⁿ") sit detached and high in most
// fonts at display sizes, so each run is rendered as a small <sup> tucked
// against its base instead.
export function MathText({ text }: { text: string }) {
  const parts = text.split(RUN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <sup key={index} className="-ml-[0.04em] text-[0.58em] leading-none">
            {[...part].map((char) => SUPERSCRIPTS[char] ?? char).join("")}
          </sup>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
}
