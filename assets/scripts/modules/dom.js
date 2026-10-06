// dom.js - one tiny helper shared by the UI code

// getElementById that complains loudly (naming the element) instead of returning null
export function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id} in index.html`);
    return el;
}
