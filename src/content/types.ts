// Shape of the long-form content pages (Privacy, Terms, About, Accessibility).
// A block is a paragraph (string), a bullet list (string[]), or a term/definition list.
export type Block = string | string[] | { dl: [term: string, description: string][] };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface Doc {
  intro?: Block[];
  sections: Section[];
}
