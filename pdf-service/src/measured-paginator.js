export function paginateMeasuredFlows({ safetyGapMm = 8, maxIterations = 1000 } = {}) {
  const pxPerMm = 96 / 25.4;
  const safetyGap = safetyGapMm * pxPerMm;
  const sources = [...document.querySelectorAll('[data-measured-flow]')];
  let pageCount = 0;

  function preparePage(page, flowName) {
    page.removeAttribute('data-measured-flow');
    page.dataset.measuredPage = flowName;
    page.style.height = '210mm';
    page.style.minHeight = '210mm';
    page.style.overflow = 'hidden';
  }

  function configurePage(page, item, continued) {
    page.dataset.reportSection = item.dataset.pageSection || 'executive-summary';
    const kicker = page.querySelector('.report-kicker');
    const title = page.querySelector('.report-title');
    const context = page.querySelector('.report-page-context');
    if (kicker) kicker.textContent = item.dataset.pageKicker || 'Executive Summary';
    if (title) title.textContent = `${item.dataset.pageTitle || 'Executive Summary'}${continued ? ' · Continued' : ''}`;
    if (context) context.textContent = item.dataset.pageContext || '';
  }

  function fits(page) {
    const items = page.querySelector('[data-pdf-flow-items]');
    const footer = page.querySelector('.report-footer');
    if (!items || !footer) return true;
    return items.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top - safetyGap + 0.5;
  }

  function fieldFragment(item, fieldIndex, text, { firstFragment, continuedField }) {
    const fragment = item.cloneNode(true);
    const fields = [...fragment.querySelectorAll('[data-pdf-field]')];
    const selected = fields[fieldIndex];
    fields.forEach((field, index) => {
      if (index !== fieldIndex) field.remove();
    });
    if (!firstFragment) {
      fragment.querySelectorAll('.executive-brief-section-title,.executive-context-intro,.executive-additional-note')
        .forEach(node => node.remove());
      const title = fragment.querySelector('.executive-project-title');
      if (title && !title.textContent.endsWith(' · Continued')) title.textContent += ' · Continued';
    }
    const paragraph = selected?.querySelector('p');
    if (paragraph) paragraph.textContent = text;
    if (continuedField) {
      const label = selected?.querySelector('strong');
      if (label && !label.textContent.endsWith(' · Continued')) label.textContent += ' · Continued';
    }
    return fragment;
  }

  function splitOversizedItem(item, page) {
    const sourceFields = [...item.querySelectorAll('[data-pdf-field]')];
    if (!sourceFields.length) return [];
    const target = page.querySelector('[data-pdf-flow-items]');
    const fragments = [];

    function candidateFits(candidate) {
      target.append(candidate);
      const result = fits(page);
      candidate.remove();
      return result;
    }

    sourceFields.forEach((field, fieldIndex) => {
      const fullText = field.querySelector('p')?.textContent.trim() || '';
      const fullFragment = fieldFragment(item, fieldIndex, fullText, {
        firstFragment: fragments.length === 0,
        continuedField: false
      });
      if (candidateFits(fullFragment)) {
        fragments.push(fullFragment);
        return;
      }

      const words = fullText.split(/\s+/).filter(Boolean);
      let offset = 0;
      let fieldPart = 0;
      while (offset < words.length) {
        let low = 1;
        let high = words.length - offset;
        let best = 0;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const text = words.slice(offset, offset + middle).join(' ');
          const candidate = fieldFragment(item, fieldIndex, text, {
            firstFragment: fragments.length === 0,
            continuedField: fieldPart > 0
          });
          if (candidateFits(candidate)) {
            best = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }

        if (!best) {
          const token = words[offset];
          let charLow = 1;
          let charHigh = token.length;
          let charBest = 0;
          while (charLow <= charHigh) {
            const middle = Math.floor((charLow + charHigh) / 2);
            const candidate = fieldFragment(item, fieldIndex, token.slice(0, middle), {
              firstFragment: fragments.length === 0,
              continuedField: fieldPart > 0
            });
            if (candidateFits(candidate)) {
              charBest = middle;
              charLow = middle + 1;
            } else {
              charHigh = middle - 1;
            }
          }
          if (!charBest) return;
          const fragment = fieldFragment(item, fieldIndex, token.slice(0, charBest), {
            firstFragment: fragments.length === 0,
            continuedField: fieldPart > 0
          });
          fragments.push(fragment);
          words[offset] = token.slice(charBest);
          if (!words[offset]) offset += 1;
          fieldPart += 1;
          continue;
        }

        const text = words.slice(offset, offset + best).join(' ');
        fragments.push(fieldFragment(item, fieldIndex, text, {
          firstFragment: fragments.length === 0,
          continuedField: fieldPart > 0
        }));
        offset += best;
        fieldPart += 1;
      }
    });
    return fragments;
  }

  sources.forEach(source => {
    const flowName = source.dataset.measuredFlow || 'measured-flow';
    const container = source.querySelector('[data-pdf-flow-items]');
    if (!container) return;
    const items = [...container.children];
    const cleanShell = source.cloneNode(true);
    cleanShell.querySelector('[data-pdf-flow-items]').replaceChildren();
    container.replaceChildren();
    preparePage(source, flowName);
    preparePage(cleanShell, flowName);

    let current = source;
    let flowPages = 1;
    let iterations = 0;
    const seenTitles = new Set();

    const queue = [...items];
    while (queue.length) {
      const item = queue.shift();
      if (++iterations > maxIterations) {
        throw new Error('Measured pagination exceeded its iteration limit.');
      }
      let target = current.querySelector('[data-pdf-flow-items]');
      if (!target.children.length) {
        const title = item.dataset.pageTitle || '';
        configurePage(current, item, seenTitles.has(title));
        seenTitles.add(title);
      }
      target.append(item);
      if (fits(current)) continue;

      item.remove();
      if (target.children.length) {
        const next = cleanShell.cloneNode(true);
        preparePage(next, flowName);
        current.after(next);
        current = next;
        flowPages += 1;
        queue.unshift(item);
        continue;
      }

      const fragments = splitOversizedItem(item, current);
      if (!fragments.length) throw new Error('Oversized PDF flow item could not be split safely.');
      queue.unshift(...fragments);
    }

    if (!items.length) source.remove();
    else pageCount += flowPages;
  });

  return { flows: sources.length, pages: pageCount };
}
