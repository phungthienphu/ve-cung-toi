// Checks an AI-written exercise's answer by machine, from the "check" it
// declares alongside the problem: substitute the solutions back into the
// equations it set up, recompute a value, or compare both sides of an
// identity at sample points. A tiny expression parser of our own — the
// strings come from the AI, so nothing here may ever be eval'd.

export interface ExerciseCheck {
  type: "equations" | "value" | "identity" | "none";
  variables: string[];
  equations: string[];
  /** One entry per solution, values in the order of `variables`. */
  solutions: string[][];
  /** Conditions the solutions must also meet ("x > 0", "x > y"). */
  conditions: string[];
  expression: string;
  value: string;
}

export type CheckResult = { status: "ok" } | { status: "none" } | { status: "wrong" | "unreadable"; issue: string };

type Vars = Record<string, number>;
type Node = (vars: Vars) => number;

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  // Grade 9 trigonometry works in degrees.
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
};
const CONSTANTS: Record<string, number> = { pi: Math.PI };

class ParseError extends Error {}

/** Undo the usual ways the AI strays from plain ASCII maths: Unicode signs, a bit of LaTeX, decimal commas. */
function normalize(source: string) {
  let text = source.replace(/\\left|\\right|\\displaystyle/g, "");
  // Innermost first, so \frac{\sqrt{2}}{2} unwraps too.
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text
      .replace(/\\sqrt\s*\[3\]\s*\{([^{}]*)\}/g, "cbrt($1)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
  }
  text = text
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\(?:le|leq)\b/g, "<=")
    .replace(/\\(?:ge|geq)\b/g, ">=")
    .replace(/\\(?:ne|neq)\b/g, "!=")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\(sin|cos|tan)\b/g, "$1")
    .replace(/\^\{([^{}]*)\}/g, "^($1)")
    .replace(/[{}]/g, (brace) => (brace === "{" ? "(" : ")"))
    .replace(/°|\$/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/π/g, "pi")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/∛/g, "cbrt")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/√/g, "sqrt ");
  return text;
}

type Token = { kind: "num"; value: number } | { kind: "id"; name: string } | { kind: "op"; op: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const number = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(index));
    if (number) {
      tokens.push({ kind: "num", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(index));
    if (name) {
      tokens.push({ kind: "id", name: name[0] });
      index += name[0].length;
      continue;
    }
    if ("+-*/^()".includes(char)) {
      tokens.push({ kind: "op", op: char });
      index++;
      continue;
    }
    throw new ParseError(`ký tự lạ "${char}"`);
  }
  return tokens;
}

function parseExpression(source: string, variables: string[]): Node {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const isOp = (op: string) => peek()?.kind === "op" && (peek() as { op: string }).op === op;
  const expectOp = (op: string) => {
    if (!isOp(op)) throw new ParseError(`thiếu "${op}"`);
    position++;
  };

  const variable = (name: string): Node => {
    if (variables.includes(name)) return (vars) => vars[name];
    if (name in CONSTANTS) return () => CONSTANTS[name];
    // "xy" with variables x and y: implicit product.
    if ([...name].every((letter) => variables.includes(letter))) return (vars) => [...name].reduce((product, letter) => product * vars[letter], 1);
    throw new ParseError(`không biết "${name}" là gì`);
  };

  const primary = (): Node => {
    const token = peek();
    if (!token) throw new ParseError("biểu thức bị cụt");
    if (token.kind === "num") {
      position++;
      return () => token.value;
    }
    if (token.kind === "id") {
      position++;
      const fn = FUNCTIONS[token.name];
      if (fn) {
        // "sqrt(2)", or "sqrt 2" from "√2": the argument is the next factor.
        const argument = isOp("(") ? primary() : power();
        return (vars) => fn(argument(vars));
      }
      return variable(token.name);
    }
    if (token.op === "(") {
      position++;
      const inner = sum();
      expectOp(")");
      return inner;
    }
    throw new ParseError(`không đọc được "${token.op}"`);
  };

  const power = (): Node => {
    const base = primary();
    if (!isOp("^")) return base;
    position++;
    const exponent = unary();
    return (vars) => Math.pow(base(vars), exponent(vars));
  };

  function unary(): Node {
    if (isOp("-")) {
      position++;
      const inner = unary();
      return (vars) => -inner(vars);
    }
    if (isOp("+")) {
      position++;
      return unary();
    }
    return power();
  }

  const startsFactor = () => {
    const token = peek();
    return Boolean(token) && (token.kind !== "op" || token.op === "(");
  };

  const product = (): Node => {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const divide = isOp("/");
        position++;
        const right = unary();
        const previous = left;
        left = divide ? (vars) => previous(vars) / right(vars) : (vars) => previous(vars) * right(vars);
      } else if (startsFactor()) {
        // "2x", "3(x + 1)", "x sqrt(2)".
        const right = power();
        const previous = left;
        left = (vars) => previous(vars) * right(vars);
      } else {
        return left;
      }
    }
  };

  function sum(): Node {
    let left = product();
    while (isOp("+") || isOp("-")) {
      const minus = isOp("-");
      position++;
      const right = product();
      const previous = left;
      left = minus ? (vars) => previous(vars) - right(vars) : (vars) => previous(vars) + right(vars);
    }
    return left;
  }

  const node = sum();
  if (position < tokens.length) throw new ParseError("thừa ký tự ở cuối");
  return node;
}

const RELATIONS = ["<=", ">=", "!=", "=", "<", ">"] as const;
type Relation = (typeof RELATIONS)[number];

/** "x + y = 10", "0 < x < 5" → the sides and the signs between them. */
function parseRelation(source: string, variables: string[]) {
  const text = normalize(source).replace(/==/g, "=");
  const parts: string[] = [];
  const signs: Relation[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (depth !== 0) continue;
    const sign = RELATIONS.find((relation) => text.startsWith(relation, index));
    if (!sign) continue;
    parts.push(text.slice(start, index));
    signs.push(sign);
    index += sign.length - 1;
    start = index + 1;
  }
  parts.push(text.slice(start));
  if (signs.length === 0) throw new ParseError("không có dấu =, <, >");
  return { sides: parts.map((part) => parseExpression(part, variables)), signs };
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function holds(sign: Relation, a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (sign) {
    case "=":
      return close(a, b);
    case "!=":
      return !close(a, b);
    case "<":
      return a < b && !close(a, b);
    case ">":
      return a > b && !close(a, b);
    case "<=":
      return a < b || close(a, b);
    case ">=":
      return a > b || close(a, b);
  }
}

const show = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, ""));

/** Is the relation true at these values? Returns the two sides that failed, for the AI's repair prompt. */
function checkRelation(source: string, variables: string[], vars: Vars): string | null {
  const { sides, signs } = parseRelation(source, variables);
  const values = sides.map((side) => side(vars));
  for (let index = 0; index < signs.length; index++) {
    if (!holds(signs[index], values[index], values[index + 1])) return `"${source}": vế trái = ${show(values[index])}, vế phải = ${show(values[index + 1])}`;
  }
  return null;
}

const constant = (source: string) => {
  const value = parseExpression(normalize(source), [])({});
  if (!Number.isFinite(value)) throw new ParseError(`"${source}" không ra một số`);
  return value;
};

// Sample points for identities: positive (so square roots stay defined) and
// far from integers (so a lucky coincidence can't pass for an identity).
const SAMPLES = [1.37, 2.71, 0.43, 3.19, 5.58, 7.32, 11.7, 0.83];

/** Checks the answer the exercise declares. Never throws. */
export function runCheck(check: ExerciseCheck): CheckResult {
  try {
    const variables = check.variables.map((name) => name.trim()).filter(Boolean);
    if (variables.some((name) => !/^[A-Za-z_][A-Za-z_0-9]*$/.test(name))) throw new ParseError(`tên ẩn không hợp lệ: ${variables.join(", ")}`);
    switch (check.type) {
      case "none":
        return { status: "none" };
      case "value": {
        const expected = constant(check.value);
        const actual = constant(check.expression);
        return close(actual, expected) ? { status: "ok" } : { status: "wrong", issue: `"${check.expression}" tính ra ${show(actual)}, không phải ${check.value}` };
      }
      case "equations": {
        if (variables.length === 0 || check.equations.length === 0 || check.solutions.length === 0) throw new ParseError("thiếu ẩn, phương trình hoặc nghiệm");
        for (const solution of check.solutions) {
          if (solution.length !== variables.length) throw new ParseError(`nghiệm [${solution.join(", ")}] không khớp số ẩn ${variables.join(", ")}`);
          const vars = Object.fromEntries(variables.map((name, index) => [name, constant(solution[index])]));
          const label = variables.map((name) => `${name} = ${solution[variables.indexOf(name)]}`).join(", ");
          for (const equation of check.equations) {
            const failed = checkRelation(equation, variables, vars);
            if (failed) return { status: "wrong", issue: `Với ${label}: ${failed}` };
          }
          for (const condition of check.conditions) {
            const failed = checkRelation(condition, variables, vars);
            if (failed) return { status: "wrong", issue: `Với ${label}: điều kiện ${failed}` };
          }
        }
        return { status: "ok" };
      }
      case "identity": {
        const left = parseExpression(normalize(check.expression), variables);
        const right = parseExpression(normalize(check.value), variables);
        let tested = 0;
        for (let sample = 0; sample < SAMPLES.length; sample++) {
          const vars = Object.fromEntries(variables.map((name, index) => [name, SAMPLES[(sample + index * 3) % SAMPLES.length]]));
          if (check.conditions.some((condition) => checkRelation(condition, variables, vars) !== null)) continue;
          const a = left(vars);
          const b = right(vars);
          if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
          if (!close(a, b)) {
            const at = variables.map((name) => `${name} = ${vars[name]}`).join(", ");
            return { status: "wrong", issue: `Tại ${at}: "${check.expression}" = ${show(a)} nhưng "${check.value}" = ${show(b)}` };
          }
          tested++;
        }
        return tested >= 3 ? { status: "ok" } : { status: "unreadable", issue: "không thử được đủ điểm để so hai vế" };
      }
    }
    return { status: "unreadable", issue: `loại kiểm tra lạ "${check.type}"` };
  } catch (error) {
    return { status: "unreadable", issue: error instanceof ParseError ? error.message : "không đọc được phần kiểm tra" };
  }
}
