/**
 * Converts HTML string to clean Markdown.
 * Runs in the browser context using standard DOM APIs.
 * 
 * @param {string} htmlString - The raw HTML from actor/item descriptions.
 * @returns {string} Clean Markdown text.
 */
export function htmlToMarkdown(htmlString) {
  if (!htmlString) return "";
  
  // Remove or simplify Foundry-specific link syntax (e.g. @UUID[Item.xxx]{Spell Name} or @Compendium[...])
  // We keep the label inside the curly brackets.
  let cleanedHtml = htmlString.replace(/@[a-zA-Z]+\[[^\]]+\]\{([^}]+)\}/g, '$1');

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedHtml, 'text/html');
  
  return parseNode(doc.body).trim().replace(/\n{3,}/g, '\n\n');
}

/**
 * Recursively parses a DOM node into Markdown.
 * 
 * @param {Node} node - The DOM node to parse.
 * @param {number} listDepth - Current depth of list nesting.
 * @param {boolean} isNumberedList - Whether the parent list is ordered.
 * @param {number} listIndex - Index of the item in ordered list.
 * @returns {string} Markdown representation of the node.
 */
function parseNode(node, listDepth = 0, isNumberedList = false, listIndex = 1) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  
  const tagName = node.tagName.toUpperCase();
  let childrenContent = "";
  
  // Track list depth
  let currentListDepth = listDepth;
  if (tagName === 'UL' || tagName === 'OL') {
    currentListDepth = listDepth + 1;
  }
  
  // Process all child nodes
  let liIndex = 1;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    const childTagName = child.nodeType === Node.ELEMENT_NODE ? child.tagName.toUpperCase() : null;
    
    if (tagName === 'OL' && childTagName === 'LI') {
      childrenContent += parseNode(child, currentListDepth, true, liIndex++);
    } else if (tagName === 'UL' && childTagName === 'LI') {
      childrenContent += parseNode(child, currentListDepth, false, 1);
    } else {
      childrenContent += parseNode(child, currentListDepth, isNumberedList, listIndex);
    }
  }
  
  switch (tagName) {
    case 'P':
      return `\n\n${childrenContent}\n\n`;
    case 'BR':
      return `\n`;
    case 'STRONG':
    case 'B':
      return `**${childrenContent}**`;
    case 'EM':
    case 'I':
      return `*${childrenContent}*`;
    case 'CODE':
      return `\`${childrenContent}\``;
    case 'PRE':
      return `\n\`\`\`\n${childrenContent}\n\`\`\`\n`;
    case 'A':
      const href = node.getAttribute('href') || '';
      return `[${childrenContent}](${href})`;
    case 'H1': return `\n# ${childrenContent}\n\n`;
    case 'H2': return `\n## ${childrenContent}\n\n`;
    case 'H3': return `\n### ${childrenContent}\n\n`;
    case 'H4': return `\n#### ${childrenContent}\n\n`;
    case 'H5': return `\n##### ${childrenContent}\n\n`;
    case 'H6': return `\n###### ${childrenContent}\n\n`;
    case 'BLOCKQUOTE':
      return `\n> ${childrenContent.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'UL':
    case 'OL':
      return `\n${childrenContent}\n`;
    case 'LI': {
      const prefix = isNumberedList ? `${listIndex}. ` : "- ";
      const cleanContent = childrenContent.trim().replace(/\n/g, '\n  ');
      return `${prefix}${cleanContent}\n`;
    }
    case 'TABLE':
      return `\n\n${formatTable(node)}\n\n`;
    case 'TR':
    case 'TD':
    case 'TH':
    case 'THEAD':
    case 'TBODY':
      return childrenContent;
    default: {
      const isBlock = ['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'].includes(tagName);
      return isBlock ? `\n${childrenContent}\n` : childrenContent;
    }
  }
}

/**
 * Formats an HTML table into a Markdown table.
 * 
 * @param {Element} tableEl - The table element.
 * @returns {string} Markdown table content.
 */
function formatTable(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return "";
  
  let markdownTable = "";
  
  // Use first row to determine columns
  const firstRowCells = Array.from(rows[0].querySelectorAll('th, td'));
  const colCount = firstRowCells.length;
  
  // Headers
  const headers = firstRowCells.map(cell => cleanTableCell(cell.textContent));
  markdownTable += `| ${headers.join(' | ')} |\n`;
  
  // Div divider row
  const separators = Array(colCount).fill('---');
  markdownTable += `| ${separators.join(' | ')} |\n`;
  
  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td, th'));
    const rowContent = cells.map(cell => cleanTableCell(cell.textContent));
    
    // Match header column length
    if (rowContent.length < colCount) {
      while (rowContent.length < colCount) rowContent.push("");
    } else if (rowContent.length > colCount) {
      rowContent.length = colCount;
    }
    markdownTable += `| ${rowContent.join(' | ')} |\n`;
  }
  
  return markdownTable;
}

/**
 * Escapes pipe characters and removes newlines inside table cells.
 * 
 * @param {string} text - Cell text.
 * @returns {string} Clean cell text.
 */
function cleanTableCell(text) {
  if (!text) return "";
  return text.replace(/\n/g, ' ').replace(/\|/g, '\\|').trim();
}
