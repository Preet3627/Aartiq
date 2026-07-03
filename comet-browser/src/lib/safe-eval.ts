const OPERATORS: Record<string, { prec: number; assoc: "L" | "R" }> = {
  "+": { prec: 2, assoc: "L" },
  "-": { prec: 2, assoc: "L" },
  "*": { prec: 3, assoc: "L" },
  "/": { prec: 3, assoc: "L" },
  "^": { prec: 4, assoc: "R" },
  "%": { prec: 3, assoc: "L" },
};

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");
  while (i < s.length) {
    if (/[0-9.]/.test(s[i])) {
      let num = "";
      while (i < s.length && /[0-9.eE]/.test(s[i])) {
        num += s[i];
        i++;
      }
      if (num === "." || num === "e" || num === "E") return [];
      tokens.push(num);
    } else if ("+-*/^%()".includes(s[i])) {
      tokens.push(s[i]);
      i++;
    } else {
      return [];
    }
  }
  return tokens;
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
    case "^": return Math.pow(a, b);
    case "%": return a % b;
    default: return NaN;
  }
}

export function safeEval(expression: string): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) throw new Error("Invalid expression");

  const output: number[] = [];
  const ops: string[] = [];

  let i = 0;
  let expectUnary = true;

  while (i < tokens.length) {
    const token = tokens[i];

    if (/^[0-9]/.test(token)) {
      output.push(parseFloat(token));
      expectUnary = false;
    } else if (token === "(") {
      ops.push(token);
      expectUnary = true;
    } else if (token === ")") {
      let found = false;
      while (ops.length > 0) {
        const op = ops.pop()!;
        if (op === "(") { found = true; break; }
        if (output.length < 2) throw new Error("Invalid expression");
        const b = output.pop()!;
        const a = output.pop()!;
        output.push(applyOp(op, a, b));
      }
      if (!found) throw new Error("Mismatched parentheses");
      expectUnary = false;
    } else if (token === "-" && expectUnary) {
      if (i + 1 >= tokens.length || !/^[0-9(]/.test(tokens[i + 1])) throw new Error("Invalid expression");
      i++;
      if (tokens[i] === "(") {
        ops.push("(");
        ops.push("_");  // unary minus marker
        expectUnary = true;
      } else {
        output.push(-parseFloat(tokens[i]));
        expectUnary = false;
      }
    } else if (token === "+" && expectUnary) {
      i++;
      continue;
    } else if (token in OPERATORS) {
      const cur = OPERATORS[token];
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top === "(" || top === "_") break;
        const prev = OPERATORS[top];
        if (!prev) break;
        if ((cur.assoc === "L" && cur.prec <= prev.prec) || (cur.assoc === "R" && cur.prec < prev.prec)) {
          ops.pop();
          if (output.length < 2) throw new Error("Invalid expression");
          const b = output.pop()!;
          const a = output.pop()!;
          output.push(applyOp(top, a, b));
        } else break;
      }
      ops.push(token);
      expectUnary = true;
    } else {
      throw new Error("Invalid character");
    }
    i++;
  }

  while (ops.length > 0) {
    const op = ops.pop()!;
    if (op === "(" || op === "_") throw new Error("Mismatched parentheses");
    if (output.length < 2) throw new Error("Invalid expression");
    const b = output.pop()!;
    const a = output.pop()!;
    output.push(applyOp(op, a, b));
  }

  if (output.length !== 1) throw new Error("Invalid expression");
  return output[0];
}
