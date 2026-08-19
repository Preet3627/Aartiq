"use strict";
/**
 * SnapshotManager — builds a compact, ref-indexed accessibility tree.
 *
 * Refs are identity-bound to a `backendNodeId` when present. On each snapshot the
 * previous generation is retired; surviving nodes reclaim their original ref, new
 * nodes get fresh numbers, and numbers are never reused within a page. A ref whose
 * node left the DOM fails loudly ("stale ref") instead of silently actuating a
 * neighbour. Navigation / full reload clears the map entirely.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotManager = void 0;
const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'slider',
    'menuitem', 'tab', 'switch', 'spinbutton', 'listbox', 'option', 'treeitem',
]);
function isInteractive(node) {
    if (INTERACTIVE_ROLES.has(node.role?.toLowerCase?.() ?? ''))
        return true;
    const tag = node.attributes?.tag;
    const type = node.attributes?.type;
    if (tag === 'a' && node.href)
        return true;
    if (tag === 'input' && type && !['hidden', 'submit', 'button', 'file', 'image'].includes(type))
        return true;
    if (tag === 'textarea' || tag === 'select')
        return true;
    if (node.attributes?.contenteditable === 'true')
        return true;
    return false;
}
class SnapshotManager {
    constructor() {
        this.refByNode = new Map();
        this.nextNum = 1;
        this.usedRefs = new Set();
    }
    /** Map a backendNodeId to a stable ref, minting a new one if needed. */
    refFor(node) {
        const key = node.backendNodeId != null ? String(node.backendNodeId) : `sel:${node.selector ?? ''}:${node.role}:${node.name ?? ''}`;
        const existing = this.refByNode.get(key);
        if (existing)
            return existing;
        let ref;
        do {
            ref = `e${this.nextNum++}`;
        } while (this.usedRefs.has(ref));
        this.usedRefs.add(ref);
        this.refByNode.set(key, ref);
        return ref;
    }
    /** Drop all refs (call on navigation / reload). */
    reset() {
        this.refByNode.clear();
        this.usedRefs.clear();
        this.nextNum = 1;
    }
    build(rawRoots, options = {}) {
        const refs = {};
        const nodes = [];
        const scopeMatch = (node) => {
            if (!options.scopeSelector)
                return true;
            return node.selector === options.scopeSelector || !!node.attributes?.scopeMatched;
        };
        const visit = (raw, depth) => {
            const interactive = isInteractive(raw);
            const node = {
                ref: this.refFor(raw),
                role: raw.role,
                name: raw.name ?? '',
                value: raw.value,
                description: raw.description,
                href: raw.href,
                interactive,
                depth,
                backendNodeId: raw.backendNodeId,
                selector: raw.selector,
                children: [],
            };
            const children = (raw.children ?? [])
                .map((c) => visit(c, depth + 1))
                .filter((c) => c !== null);
            // Compact: drop empty structural nodes (no name, no interactive children).
            const hasContent = node.name || interactive || children.some((c) => c.interactive || c.name);
            if (options.compact && !hasContent && !interactive) {
                // Promote children to this position.
                for (const c of children)
                    node.children.push(c);
            }
            else {
                node.children = children;
            }
            if (options.depth != null && depth > options.depth) {
                node.children = [];
            }
            if (options.interactiveOnly && !interactive && node.children.length === 0) {
                return null;
            }
            if (!scopeMatch(raw) && node.children.length === 0) {
                return null;
            }
            refs[node.ref] = node;
            return node;
        };
        for (const root of rawRoots) {
            const n = visit(root, 0);
            if (n)
                nodes.push(n);
        }
        return { nodes, refs, text: this.render(nodes, options) };
    }
    /** Render a human/LLM-readable tree with refs. */
    render(nodes, _options = {}) {
        const lines = [];
        const walk = (n, indent) => {
            let line = indent;
            if (n.role)
                line += n.role;
            if (n.name)
                line += ` "${truncate(n.name, 80)}"`;
            line += ` [ref=${n.ref}]`;
            if (n.href)
                line += ` [url=${n.href}]`;
            if (n.value != null && n.value !== '')
                line += ` [value=${truncate(n.value, 40)}]`;
            lines.push(line);
            for (const c of n.children)
                walk(c, indent + '  ');
        };
        for (const n of nodes)
            walk(n, '');
        return lines.join('\n');
    }
    findByRef(ref, result) {
        return result.refs[ref];
    }
    /** Semantic search: match by role and/or name (case-insensitive, substring). */
    findByText(result, text, role) {
        const q = text.toLowerCase();
        return Object.values(result.refs).filter((n) => {
            const roleOk = !role || n.role.toLowerCase() === role.toLowerCase();
            const textOk = !text || n.name.toLowerCase().includes(q) || (n.value ?? '').toLowerCase().includes(q);
            return roleOk && textOk;
        });
    }
    /** Return the injected-script body that collects a RawAxNode tree in-page. */
    static collectorScript() {
        return `(function(){
  function collect(el, depth){
    if(depth>40) return null;
    if(!el) return null;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var role = el.getAttribute && el.getAttribute('role') ? el.getAttribute('role') : (tag||'generic');
    var name = (el.getAttribute && (el.getAttribute('aria-label')||el.getAttribute('title'))) || (el.textContent||'').trim().slice(0,120);
    var node = { role: role, name: name, attributes: { tag: tag } };
    if(el.id) node.selector = '#'+el.id;
    var type = el.getAttribute && el.getAttribute('type');
    if(type) node.attributes.type = type;
    if(tag==='a') node.href = el.getAttribute && el.getAttribute('href');
    var ce = el.getAttribute && el.getAttribute('contenteditable');
    if(ce) node.attributes.contenteditable = ce;
    node.children = [];
    var kids = el.children || [];
    for(var i=0;i<kids.length;i++){
      var c = collect(kids[i], depth+1);
      if(c) node.children.push(c);
    }
    return node;
  }
  return JSON.stringify(collect(document.body||document.documentElement, 0));
})();`;
    }
}
exports.SnapshotManager = SnapshotManager;
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
