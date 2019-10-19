/**
 * Fork from https://github.com/antonmedv/finder
 * Add content-selector feature
 */

import cssesc from "cssesc";

interface Node {
  name: string;
  content: string | null;
  contentUnique: boolean;
  penalty: number;
  level?: number;
}

type Path = Node[];

export interface Fragment {
  name: string;
  content: string | null;
}

enum Limit {
  All,
  Two,
  One
}

export interface Options {
  root: Element;
  idName: (name: string) => boolean;
  className: (name: string) => boolean;
  tagName: (name: string) => boolean;
  attr: (name: string, value: string) => boolean;
  seedMinLength: number;
  optimizedMinLength: number;
  threshold: number;
}

let config: Options;
let rootDocument: Document | Element;

function findRootDocument(rootNode: Element | Document, defaults: Options) {
  if (rootNode.nodeType === Node.DOCUMENT_NODE) {
    return rootNode;
  }
  if (rootNode === defaults.root) {
    return rootNode.ownerDocument as Document;
  }
  return rootNode;
}

function selector(path: Path): string {
  let node = path[0];
  let query = node.name;
  for (let i = 1; i < path.length; i++) {
    const level = path[i].level || 0;

    if (node.level === level - 1) {
      query = `${path[i].name} > ${query}`;
    } else {
      query = `${path[i].name} ${query}`;
    }

    node = path[i];
  }
  return query;
}

function penalty(path: Path): number {
  return path.map(node => node.penalty).reduce((acc, i) => acc + i, 0);
}

function uniqueInAncestorContent(path: Path) {
  let isUnique = false;
  let stack = path.slice();

  while (stack.length > 1) {
    const [first, ...others] = stack;

    const selector1 = selector(others);
    const selector2 = selector([first]);
    let els = Array.from(rootDocument.querySelectorAll(selector1));
    if (els.length > 1 && others[0].content) {
      els = els.filter(el => {
        const isUniqueInContent =
          el.textContent && el.textContent.includes(others[0].content!);
        const hasUniqueChild = el.querySelectorAll(selector2).length === 1;
        return isUniqueInContent && hasUniqueChild;
      });
      if (els.length === 1) {
        others[0].contentUnique = true;
      }
    }

    if (els.length === 1) {
      isUnique = true;
      break;
    }

    stack = others;
  }

  return isUnique;
}

function unique(path: Path) {
  let els = Array.from(rootDocument.querySelectorAll(selector(path)));
  /**
   * this loop make things slow
   */
  if (els.length > 1 && path[0].content) {
    els = els.filter(
      el => el.textContent && el.textContent.includes(path[0].content!)
    );
    if (els.length === 1) {
      path[0].contentUnique = true;
    }
  }
  switch (els.length) {
    case 0:
      throw new Error(
        `Can't select any node with this selector: ${selector(path)}`
      );
    case 1:
      return true;
    default:
      return uniqueInAncestorContent(path);
  }
}

function id(input: Element): Node | null {
  const elementId = input.getAttribute("id");
  if (elementId && config.idName(elementId)) {
    return {
      name: "#" + cssesc(elementId, { isIdentifier: true }),
      penalty: 0,
      content: input.textContent,
      contentUnique: false
    };
  }
  return null;
}

function attr(input: Element): Node[] {
  const attrs = Array.from(input.attributes).filter(attr =>
    config.attr(attr.name, attr.value)
  );

  return attrs.map(
    (attr): Node => ({
      name:
        "[" +
        cssesc(attr.name, { isIdentifier: true }) +
        '="' +
        cssesc(attr.value) +
        '"]',
      penalty: 0.5,
      content: input.textContent,
      contentUnique: false
    })
  );
}

function classNames(input: Element): Node[] {
  const names = Array.from(input.classList).filter(config.className);

  return names.map(
    (name): Node => ({
      name: "." + cssesc(name, { isIdentifier: true }),
      penalty: 1,
      content: input.textContent,
      contentUnique: false
    })
  );
}

function tagName(input: Element): Node | null {
  const name = input.tagName.toLowerCase();
  if (config.tagName(name)) {
    return {
      name,
      penalty: 2,
      content: input.textContent,
      contentUnique: false
    };
  }
  return null;
}

function any(): Node {
  return {
    name: "*",
    penalty: 3,
    content: null,
    contentUnique: false
  };
}

function index(input: Element): number | null {
  const parent = input.parentNode;
  if (!parent) {
    return null;
  }

  let child = parent.firstChild;
  if (!child) {
    return null;
  }

  let i = 0;
  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      i++;
    }

    if (child === input) {
      break;
    }

    child = child.nextSibling;
  }

  return i;
}

function nthChild(node: Node, i: number): Node {
  return {
    name: node.name + `:nth-child(${i})`,
    penalty: node.penalty + 1,
    content: node.content,
    contentUnique: false
  };
}

function dispensableNth(node: Node) {
  return node.name !== "html" && !node.name.startsWith("#");
}

function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function maybe(...level: (Node | null)[]): Node[] | null {
  const list = level.filter(notEmpty);
  if (list.length > 0) {
    return list;
  }
  return null;
}

function* combinations(stack: Node[][], path: Node[] = []): Iterable<Path> {
  if (stack.length > 0) {
    for (let node of stack[0]) {
      yield* combinations(stack.slice(1, stack.length), path.concat(node));
    }
  } else {
    yield path;
  }
}

function sort(paths: Iterable<Path>): Path[] {
  return Array.from(paths).sort((a, b) => penalty(a) - penalty(b));
}

function same(path: Path, input: Element) {
  return rootDocument.querySelector(selector(path)) === input;
}

function* optimize(
  path: Path,
  input: Element,
  content: string | null
): Iterable<Path> {
  if (path.length > 2 && path.length > config.optimizedMinLength) {
    for (let i = 1; i < path.length - 1; i++) {
      const newPath = [...path];
      newPath.splice(i, 1);

      if (unique(newPath) && same(newPath, input)) {
        yield newPath;
        yield* optimize(newPath, input, content);
      }
    }
  }
}

function findUniquePath(
  stack: Node[][],
  fallback?: () => Path | null
): Path | null {
  const paths = sort(combinations(stack));

  if (paths.length > config.threshold) {
    return fallback ? fallback() : null;
  }

  for (let candidate of paths) {
    if (unique(candidate)) {
      return candidate;
    }
  }

  return null;
}

function bottomUpSearch(
  input: Element,
  limit: Limit,
  fallback?: () => Path | null
): Path | null {
  let path: Path | null = null;
  let stack: Node[][] = [];
  let current: Element | null = input;
  let i = 0;

  while (current && current !== config.root.parentElement) {
    let level: Node[] = maybe(id(current)) ||
      maybe(...attr(current)) ||
      maybe(...classNames(current)) ||
      maybe(tagName(current)) || [any()];

    const nth = index(current);

    if (limit === Limit.All) {
      if (nth) {
        level = level.concat(
          level.filter(dispensableNth).map(node => nthChild(node, nth))
        );
      }
    } else if (limit === Limit.Two) {
      level = level.slice(0, 1);

      if (nth) {
        level = level.concat(
          level.filter(dispensableNth).map(node => nthChild(node, nth))
        );
      }
    } else if (limit === Limit.One) {
      const [node] = (level = level.slice(0, 1));

      if (nth && dispensableNth(node)) {
        level = [nthChild(node, nth)];
      }
    }

    for (let node of level) {
      node.level = i;
    }

    stack.push(level);

    if (stack.length >= config.seedMinLength) {
      path = findUniquePath(stack, fallback);
      if (path) {
        break;
      }
    }

    current = current.parentElement;
    i++;
  }

  if (!path) {
    path = findUniquePath(stack, fallback);
  }

  return path;
}

function toFragment(path: Path): Fragment[] {
  return path.reverse().map(node => ({
    name: node.name,
    content: node.contentUnique ? node.content : null
  }));
}

export default function(
  input: Element,
  options?: Partial<Options>
): Fragment[] {
  if (input.nodeType !== Node.ELEMENT_NODE) {
    throw new Error("Can't generate CSS selector for non-element node type.");
  }

  if ("html" === input.tagName.toLowerCase()) {
    return [{ name: "html", content: null }];
  }

  const defaults: Options = {
    root: document.body,
    idName: (_name: string) => true,
    className: (_name: string) => true,
    tagName: (_name: string) => true,
    attr: (_name: string, _value: string) => false,
    seedMinLength: 1,
    optimizedMinLength: 2,
    threshold: 1000
  };

  config = { ...defaults, ...options };

  rootDocument = findRootDocument(config.root, defaults);

  let path = bottomUpSearch(input, Limit.All, () =>
    bottomUpSearch(input, Limit.Two, () => bottomUpSearch(input, Limit.One))
  );

  if (path) {
    const optimized = sort(optimize(path, input, input.textContent));

    if (optimized.length > 0) {
      path = optimized[0];
    }

    return toFragment(path);
  } else {
    throw new Error(`Selector was not found.`);
  }
}
