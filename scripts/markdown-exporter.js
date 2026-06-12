(() => {
  "use strict";

  console.log("Markdown Sheets | scripts/markdown-exporter.js is executing...");

  /* ========================================================================= */
  /* HTML TO MARKDOWN PARSER                                                   */
  /* ========================================================================= */

  /**
   * Converts HTML string to clean Markdown.
   * Runs in the browser context using standard DOM APIs.
   * 
   * @param {string} htmlString - The raw HTML from actor/item descriptions.
   * @returns {string} Clean Markdown text.
   */
  function htmlToMarkdown(htmlString) {
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

  /* ========================================================================= */
  /* HOOK REGISTRATION & MONKEY PATCHES                                        */
  /* ========================================================================= */

  // Initialize and register global event handlers on startup
  Hooks.once("init", () => {
    console.log("Markdown Sheets | Initializing module...");

    // Monkey-patch ApplicationV2._onClickAction globally to handle the export action
    if (foundry?.applications?.api?.ApplicationV2) {
      const originalOnClickAction = foundry.applications.api.ApplicationV2.prototype._onClickAction;
      foundry.applications.api.ApplicationV2.prototype._onClickAction = function(event, target) {
        if (target.dataset.action === "export-markdown-sheet-v2") {
          console.log("Markdown Sheets | ApplicationV2 custom action 'export-markdown-sheet-v2' intercepted.");
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const actor = this.actor || (this.document && this.document.documentName === "Actor" ? this.document : null);
          if (actor && (actor.type === "character" || actor.type === "npc")) {
            exportActorToMarkdown(actor);
          } else {
            ui.notifications.warn(game.i18n.localize("MarkdownSheets.NotifyTypeWarning"));
          }
          return;
        }
        return originalOnClickAction.call(this, event, target);
      };
      console.log("Markdown Sheets | ApplicationV2._onClickAction monkey-patch applied successfully.");
    }
  });

  // 1. Hook for ApplicationV1 (Legacy) sheet headers (still active in v13/v14 for V1 sheets)
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    console.log("Markdown Sheets | getActorSheetHeaderButtons hook triggered");
    const actor = sheet.actor;
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) return;
    
    buttons.unshift({
      label: game.i18n.localize("MarkdownSheets.ExportButton"),
      class: "export-markdown-sheet",
      icon: "fab fa-markdown",
      onclick: () => exportActorToMarkdown(actor)
    });
  });

  // 2. Hook callback for ApplicationV2 (Modern) sheet headers/context controls (Foundry v13/v14)
  const registerAppV2HeaderControl = (app, controls) => {
    console.log("Markdown Sheets | getHeaderControls hook triggered for app:", app.constructor.name);
    const actor = app.actor || (app.document && app.document.documentName === "Actor" ? app.document : null);
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) {
      return;
    }

    // Prevent duplicate additions
    if (controls.some(c => c.action === "export-markdown-sheet-v2")) return;

    controls.push({
      action: "export-markdown-sheet-v2",
      icon: "fab fa-markdown",
      label: game.i18n.localize("MarkdownSheets.ExportButton"),
      visible: true,
      onclick: () => exportActorToMarkdown(actor)
    });
  };

  // Register on multiple possible Hook names along the ApplicationV2 inheritance chain for maximum compatibility
  const headerHooksToRegister = [
    "getHeaderControlsApplicationV2",
    "getHeaderControlsDocumentSheetV2",
    "getHeaderControlsActorSheetV2",
    "getHeaderControlsActorSheet5e",
    "getHeaderControlsActorSheet5eCharacter",
    "getHeaderControlsActorSheet5eNPC",
    "getHeaderControlsActorSheet5eCharacter2",
    "getHeaderControlsActorSheet5eNPC2"
  ];

  for (const hookName of headerHooksToRegister) {
    Hooks.on(hookName, registerAppV2HeaderControl);
  }

  // Helper to retrieve Actor from context menu target (handles raw DOM / jQuery targets)
  function getActorFromContextTarget(target) {
    if (!target) return null;
    const el = target instanceof HTMLElement ? target : (target[0] || target);
    if (!el) return null;
    const actorId = el.dataset?.documentId || el.getAttribute?.("data-document-id") || el.dataset?.entryId;
    return game.actors.get(actorId);
  }

  // 3. Hook for ApplicationV1 (Legacy) Actor directory context menu (still active in v13/v14)
  Hooks.on("getActorDirectoryEntryContext", (html, entryOptions) => {
    console.log("Markdown Sheets | getActorDirectoryEntryContext hook triggered");
    entryOptions.push({
      name: game.i18n.localize("MarkdownSheets.ExportButton"),
      icon: '<i class="fab fa-markdown"></i>',
      callback: (target) => {
        const actor = getActorFromContextTarget(target);
        if (actor && (actor.type === "character" || actor.type === "npc")) {
          exportActorToMarkdown(actor);
        } else {
          ui.notifications.warn(game.i18n.localize("MarkdownSheets.NotifyTypeWarning"));
        }
      }
    });
  });

  // 4. Hook callback for ApplicationV2 (Modern) Actor directory context menu (Foundry v13/v14)
  const registerActorContextOptions = (application, menuItems) => {
    console.log("Markdown Sheets | getActorContextOptions hook triggered. Current menuItems:", menuItems);
    
    // Avoid duplicates
    if (menuItems.some(item => item.name === game.i18n.localize("MarkdownSheets.ExportButton") || item.icon?.includes("fa-markdown"))) {
      return;
    }
    
    menuItems.push({
      name: game.i18n.localize("MarkdownSheets.ExportButton"),
      icon: '<i class="fab fa-markdown"></i>',
      callback: (target) => {
        console.log("Markdown Sheets | Actor context menu option clicked. Target element:", target);
        const actor = getActorFromContextTarget(target);
        console.log("Markdown Sheets | Retrieved actor from target:", actor);
        if (actor && (actor.type === "character" || actor.type === "npc")) {
          exportActorToMarkdown(actor);
        } else {
          ui.notifications.warn(game.i18n.localize("MarkdownSheets.NotifyTypeWarning"));
        }
      }
    });
  };

  const contextHooksToRegister = [
    "getActorContextOptions",
    "getActorDirectoryEntryContextOptions",
    "getActorDirectoryContextOptions"
  ];

  for (const hookName of contextHooksToRegister) {
    Hooks.on(hookName, registerActorContextOptions);
  }

  /* ========================================================================= */
  /* CORE EXPORTER LOGIC                                                       */
  /* ========================================================================= */

  /**
   * Main function to export Actor document to Markdown and download it.
   * @param {Actor} actor - The actor document.
   */
  async function exportActorToMarkdown(actor) {
    try {
      let markdown = "";
      if (actor.type === "character") {
        markdown = await generatePCMarkdown(actor);
      } else if (actor.type === "npc") {
        markdown = await generateNPCMarkdown(actor);
      } else {
        ui.notifications.warn(game.i18n.localize("MarkdownSheets.NotifyTypeWarning"));
        return;
      }
      
      const cleanName = actor.name.replace(/[\\/:*?"<>|]/g, "");
      const filename = `${cleanName}.md`;
      downloadMarkdown(filename, markdown);
      ui.notifications.info(game.i18n.format("MarkdownSheets.NotifySuccess", { name: actor.name }));
    } catch (error) {
      console.error("Markdown Exporter | Error exporting actor sheet:", error);
      ui.notifications.error(game.i18n.localize("MarkdownSheets.NotifyError"));
    }
  }

  /**
   * Generates Markdown for a Player Character.
   * @param {Actor} actor - The player character actor.
   * @returns {string} Fully formatted markdown content.
   */
  async function generatePCMarkdown(actor) {
    const system = actor.system;
    
    // Basic attributes
    const name = actor.name;
    const species = getSpecies(actor);
    const background = getBackground(actor);
    const alignment = system.details?.alignment || game.i18n.localize("MarkdownSheets.LabelNone");
    
    // Class & Level calculation (multi-class friendly)
    const classes = actor.items.filter(i => i.type === "class");
    const subclasses = actor.items.filter(i => i.type === "subclass");
    const classStrings = classes.map(cls => {
      const classId = cls.system.identifier || cls.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matchingSubclass = subclasses.find(sc => sc.system.classIdentifier === classId);
      const level = cls.system.levels || 1;
      return matchingSubclass ? `${cls.name} (${matchingSubclass.name}) ${level}` : `${cls.name} ${level}`;
    });
    const classLine = classStrings.join(" / ") || game.i18n.localize("MarkdownSheets.LabelNone");
    const totalLevel = system.details?.level || classes.reduce((sum, cls) => sum + (cls.system.levels || 0), 0) || 1;
    
    // Core stats
    const hpVal = system.attributes?.hp?.value ?? 0;
    const hpMax = system.attributes?.hp?.max ?? 0;
    const hpTemp = system.attributes?.hp?.temp ?? 0;
    const acVal = system.attributes?.ac?.value ?? 10;
    
    const initMod = formatMod(system.attributes?.init?.total ?? system.abilities?.dex?.mod ?? 0);
    const speedStr = getSpeedString(actor);
    
    // Senses and Languages
    const sensesStr = getSenses(actor);
    const langStr = getLanguages(actor);
    const profBonus = formatMod(system.attributes?.prof ?? 0);
    
    const ab = getAbilitiesBlock(actor);
    
    const imgUrl = getImageUrl(actor);
    const imgMarkdown = imgUrl ? `![${name}](${imgUrl})\n\n` : "";

    // Frontmatter construction
    let md = `---
name: ${escapeYamlString(name)}
type: "character"
image: ${escapeYamlString(imgUrl)}
species: ${escapeYamlString(species)}
class: ${escapeYamlString(classLine)}
background: ${escapeYamlString(background)}
alignment: ${escapeYamlString(alignment)}
level: ${totalLevel}
hp:
  value: ${hpVal}
  max: ${hpMax}
  temp: ${hpTemp}
ac: ${acVal}
initiative: ${escapeYamlString(initMod)}
speed: ${escapeYamlString(speedStr)}
proficiency_bonus: ${escapeYamlString(profBonus)}
senses: ${toYamlArray(sensesStr, 2)}
languages: ${toYamlArray(langStr, 2)}
abilities:
  strength:
    score: ${ab.strength.score}
    modifier: ${escapeYamlString(ab.strength.modifier)}
    saves: ${escapeYamlString(ab.strength.save)}
    proficiency: ${escapeYamlString(ab.strength.proficiency)}
  dexterity:
    score: ${ab.dexterity.score}
    modifier: ${escapeYamlString(ab.dexterity.modifier)}
    saves: ${escapeYamlString(ab.dexterity.save)}
    proficiency: ${escapeYamlString(ab.dexterity.proficiency)}
  constitution:
    score: ${ab.constitution.score}
    modifier: ${escapeYamlString(ab.constitution.modifier)}
    saves: ${escapeYamlString(ab.constitution.save)}
    proficiency: ${escapeYamlString(ab.constitution.proficiency)}
  intelligence:
    score: ${ab.intelligence.score}
    modifier: ${escapeYamlString(ab.intelligence.modifier)}
    saves: ${escapeYamlString(ab.intelligence.save)}
    proficiency: ${escapeYamlString(ab.intelligence.proficiency)}
  wisdom:
    score: ${ab.wisdom.score}
    modifier: ${escapeYamlString(ab.wisdom.modifier)}
    saves: ${escapeYamlString(ab.wisdom.save)}
    proficiency: ${escapeYamlString(ab.wisdom.proficiency)}
  charisma:
    score: ${ab.charisma.score}
    modifier: ${escapeYamlString(ab.charisma.modifier)}
    saves: ${escapeYamlString(ab.charisma.save)}
    proficiency: ${escapeYamlString(ab.charisma.proficiency)}
---

# ${name}
${imgMarkdown}*${game.i18n.localize("MarkdownSheets.LabelLevel")} ${totalLevel} ${species} ${classLine} | ${game.i18n.localize("MarkdownSheets.LabelBackground")}: ${background} | ${game.i18n.localize("MarkdownSheets.LabelAlignment")}: ${alignment}*

## ${game.i18n.localize("MarkdownSheets.LabelCoreStats")}
- **${game.i18n.localize("MarkdownSheets.LabelAC")}:** ${acVal}
- **${game.i18n.localize("MarkdownSheets.LabelHP")}:** ${hpVal} / ${hpMax}${hpTemp ? ` (Temp: ${hpTemp})` : ""}
- **${game.i18n.localize("MarkdownSheets.LabelSpeed")}:** ${speedStr}
- **${game.i18n.localize("MarkdownSheets.LabelInitiative")}:** ${initMod}
- **${game.i18n.localize("MarkdownSheets.LabelProficiencyBonus")}:** ${profBonus}
- **${game.i18n.localize("MarkdownSheets.LabelSenses")}:** ${sensesStr}
- **${game.i18n.localize("MarkdownSheets.LabelLanguages")}:** ${langStr}

### ${game.i18n.localize("MarkdownSheets.LabelAbilityScores")}
| STR | DEX | CON | INT | WIS | CHA |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ${system.abilities?.str?.value ?? 10} (${formatMod(system.abilities?.str?.mod ?? 0)}) | ${system.abilities?.dex?.value ?? 10} (${formatMod(system.abilities?.dex?.mod ?? 0)}) | ${system.abilities?.con?.value ?? 10} (${formatMod(system.abilities?.con?.mod ?? 0)}) | ${system.abilities?.int?.value ?? 10} (${formatMod(system.abilities?.int?.mod ?? 0)}) | ${system.abilities?.wis?.value ?? 10} (${formatMod(system.abilities?.wis?.mod ?? 0)}) | ${system.abilities?.cha?.value ?? 10} (${formatMod(system.abilities?.cha?.mod ?? 0)}) |

### ${game.i18n.localize("MarkdownSheets.LabelSavingThrows")}
`;

    // Append saves
    const abilities = system.abilities;
    if (abilities) {
      const abKeys = {
        str: CONFIG.DND5E?.abilities?.str?.label ? game.i18n.localize(CONFIG.DND5E.abilities.str.label) : "Strength",
        dex: CONFIG.DND5E?.abilities?.dex?.label ? game.i18n.localize(CONFIG.DND5E.abilities.dex.label) : "Dexterity",
        con: CONFIG.DND5E?.abilities?.con?.label ? game.i18n.localize(CONFIG.DND5E.abilities.con.label) : "Constitution",
        int: CONFIG.DND5E?.abilities?.int?.label ? game.i18n.localize(CONFIG.DND5E.abilities.int.label) : "Intelligence",
        wis: CONFIG.DND5E?.abilities?.wis?.label ? game.i18n.localize(CONFIG.DND5E.abilities.wis.label) : "Wisdom",
        cha: CONFIG.DND5E?.abilities?.cha?.label ? game.i18n.localize(CONFIG.DND5E.abilities.cha.label) : "Charisma"
      };
      
      for (const [key, abName] of Object.entries(abKeys)) {
        const ability = abilities[key];
        if (ability) {
          const saveVal = getAbilitySaveValue(ability, actor);
          const saveMod = formatMod(saveVal);
          const isProf = ability.proficient ? ` (${game.i18n.localize("DND5E.Proficient")})` : "";
          md += `- **${abName}:** ${saveMod}${isProf}\n`;
        }
      }
    }
    
    md += `
### ${game.i18n.localize("MarkdownSheets.LabelSkills")}
${getSkillsBlock(actor)}
---
`;

    // Sort actor items
    const featuresList = [];
    const weaponsList = [];
    const armorList = [];
    const equipmentList = [];
    const consumablesList = [];
    const toolsList = [];
    const containersList = [];
    const lootList = [];
    const spellsList = [];
    
    for (const item of actor.items) {
      if (item.type === "spell") {
        spellsList.push(item);
      } else if (item.type === "feat" || item.type === "race" || item.type === "species" || item.type === "background") {
        featuresList.push(item);
      } else if (item.type === "weapon") {
        weaponsList.push(item);
      } else if (item.type === "equipment") {
        const armorTypes = ["light", "medium", "heavy", "shield"];
        const isArmor = armorTypes.includes(item.system.armor?.type);
        if (isArmor) {
          armorList.push(item);
        } else {
          equipmentList.push(item);
        }
      } else if (item.type === "consumable") {
        consumablesList.push(item);
      } else if (item.type === "tool") {
        toolsList.push(item);
      } else if (item.type === "container" || item.type === "backpack") {
        containersList.push(item);
      } else if (item.type === "loot") {
        lootList.push(item);
      }
    }
    
    // Section: Features
    if (featuresList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelFeaturesTalents")}\n`;
      for (const f of featuresList.sort((a, b) => a.name.localeCompare(b.name))) {
        const typeLabel = getFeatureSource(f);
        const requirement = f.system.requirements ? ` (${f.system.requirements})` : "";
        const uses = f.system.uses?.max ? ` | ${game.i18n.localize("MarkdownSheets.LabelUsage")}: ${f.system.uses.value}/${f.system.uses.max}` : "";
        const enrichedDesc = await formatItemDescription(f, actor);
        md += `\n### ${f.name}\n- **${game.i18n.localize("MarkdownSheets.LabelType")}:** ${typeLabel}${requirement}${uses}\n\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Inventory
    const hasInventory = weaponsList.length || armorList.length || equipmentList.length || consumablesList.length || toolsList.length || containersList.length || lootList.length;
    if (hasInventory) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelInventory")}\n`;
      
      const appendInvSection = async (titleKey, list) => {
        if (list.length === 0) return "";
        const title = game.i18n.localize(titleKey);
        let sec = `\n### ${title}\n`;
        for (const i of list.sort((a, b) => a.name.localeCompare(b.name))) {
          const qty = i.system.quantity ?? 1;
          const wt = i.system.weight ?? 0;
          const totalWt = (qty * wt).toFixed(1);
          const eq = i.system.equipped ? ` (${game.i18n.localize("MarkdownSheets.LabelEquipped")})` : "";
          const props = getItemProperties(i);
          const propsStr = props ? ` | ${game.i18n.localize("MarkdownSheets.LabelProperties")}: ${props}` : "";
          
          const enrichedDesc = await formatItemDescription(i, actor);
          sec += `\n#### ${i.name}${eq}\n- **${game.i18n.localize("MarkdownSheets.LabelQuantity")}:** ${qty} | **${game.i18n.localize("MarkdownSheets.LabelWeight")}:** ${totalWt} lbs${propsStr}\n\n${enrichedDesc}\n`;
        }
        return sec;
      };
      
      md += await appendInvSection("MarkdownSheets.InvWeapons", weaponsList);
      md += await appendInvSection("MarkdownSheets.InvArmorShield", armorList);
      md += await appendInvSection("MarkdownSheets.InvEquipmentGear", equipmentList);
      md += await appendInvSection("MarkdownSheets.InvConsumables", consumablesList);
      md += await appendInvSection("MarkdownSheets.InvTools", toolsList);
      md += await appendInvSection("MarkdownSheets.InvContainers", containersList);
      md += await appendInvSection("MarkdownSheets.InvOtherLoot", lootList);
      
      md += `\n---\n`;
    }
    
    // Section: Spellcasting
    if (spellsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelSpellcasting")}\n`;
      const scInfo = getSpellcastingInfo(actor);
      if (scInfo) md += `${scInfo}\n\n`;
      
      const spellGroups = {};
      for (const s of spellsList) {
        const lvl = s.system.level ?? 0;
        if (!spellGroups[lvl]) spellGroups[lvl] = [];
        spellGroups[lvl].push(s);
      }
      
      const sortedLevels = Object.keys(spellGroups).map(Number).sort((a, b) => a - b);
      for (const lvl of sortedLevels) {
        const title = lvl === 0 ? game.i18n.localize("MarkdownSheets.LabelCantrips") : game.i18n.format("MarkdownSheets.LabelLevelSpells", { level: lvl });
        let slotsStr = "";
        if (lvl > 0 && system.spells?.[`spell${lvl}`]) {
          const slots = system.spells[`spell${lvl}`];
          if (slots.max > 0) {
            slotsStr = ` (${slots.value}/${slots.max} ${game.i18n.localize("MarkdownSheets.LabelSlots")})`;
          }
        }
        
        md += `\n### ${title}${slotsStr}\n`;
        for (const s of spellGroups[lvl].sort((a, b) => a.name.localeCompare(b.name))) {
          const activation = s.system.activation ? `${s.system.activation.cost || ""} ${s.system.activation.type || ""}` : "";
          const sRange = s.system.range ? `${s.system.range.value || ""} ${s.system.range.units || ""}`.trim() : "";
          const components = getSpellProperties(s);
          const duration = s.system.duration ? `${s.system.duration.value || ""} ${s.system.duration.units || ""}`.trim() : "";
          const schoolKey = s.system.school;
          const school = CONFIG.DND5E?.spellSchools?.[schoolKey]?.label ? game.i18n.localize(CONFIG.DND5E.spellSchools[schoolKey].label) : (schoolKey || "");
          
          md += `\n#### ${s.name}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelSchool")}:** ${school}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelCastingTime")}:** ${activation}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelRange")}:** ${sRange}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelComponents")}:** ${components}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelDuration")}:** ${duration}\n\n`;
          const enrichedDesc = await formatItemDescription(s, actor);
          md += `${enrichedDesc}\n`;
        }
      }
      md += `\n---\n`;
    }
    
    // Section: Biography
    const bio = system.details?.biography?.value || "";
    const appearance = system.details?.appearance || "";
    if (bio || appearance) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelBiographyAppearance")}\n`;
      if (appearance) {
        let enrichedAppearance = appearance;
        try {
          enrichedAppearance = await TextEditor.enrichHTML(appearance, { relativeTo: actor, async: true });
        } catch (err) {
          console.warn("Markdown Sheets | Failed to enrich appearance:", err);
        }
        md += `\n### ${game.i18n.localize("MarkdownSheets.LabelAppearance")}\n${htmlToMarkdown(enrichedAppearance)}\n`;
      }
      if (bio) {
        let enrichedBio = bio;
        try {
          enrichedBio = await TextEditor.enrichHTML(bio, { relativeTo: actor, async: true });
        } catch (err) {
          console.warn("Markdown Sheets | Failed to enrich biography:", err);
        }
        md += `\n### ${game.i18n.localize("MarkdownSheets.LabelBiography")}\n${htmlToMarkdown(enrichedBio)}\n`;
      }
    }
    
    return md;
  }

  /**
   * Generates Markdown for a Non-Player Character.
   * @param {Actor} actor - The NPC actor.
   * @returns {string} Fully formatted markdown content.
   */
  async function generateNPCMarkdown(actor) {
    const system = actor.system;
    
    // Basic attributes
    const name = actor.name;
    const cr = system.details?.cr ?? "0";
    const xp = system.details?.xp?.value ?? 0;
    const alignment = system.details?.alignment || game.i18n.localize("MarkdownSheets.LabelNone");
    
    // Size and Type
    const sizeKey = system.traits?.size || "med";
    const size = CONFIG.DND5E?.actorSizes?.[sizeKey]?.label ? game.i18n.localize(CONFIG.DND5E.actorSizes[sizeKey].label) : sizeKey.toUpperCase();
    const npcType = getNPCType(actor);
    
    // AC and HP
    const acVal = system.attributes?.ac?.value ?? 10;
    const acFormula = system.attributes?.ac?.formula ? ` (${system.attributes.ac.formula})` : "";
    const hpVal = system.attributes?.hp?.value ?? 0;
    const hpMax = system.attributes?.hp?.max ?? 0;
    const hpTemp = system.attributes?.hp?.temp ?? 0;
    const hpFormula = system.attributes?.hp?.formula ? ` (${system.attributes.hp.formula})` : "";
    
    // Speed, Senses, Languages
    const speedStr = getSpeedString(actor);
    const sensesStr = getSenses(actor);
    const langStr = getLanguages(actor);
    
    const ab = getAbilitiesBlock(actor);
    
    const imgUrl = getImageUrl(actor);
    const imgMarkdown = imgUrl ? `![${name}](${imgUrl})\n\n` : "";

    // Frontmatter construction
    let md = `---
name: ${escapeYamlString(name)}
type: "npc"
image: ${escapeYamlString(imgUrl)}
cr: "${cr}"
xp: ${xp}
size: ${escapeYamlString(size)}
type_tags: ${escapeYamlString(npcType)}
alignment: ${escapeYamlString(alignment)}
hp:
  value: ${hpVal}
  max: ${hpMax}
  temp: ${hpTemp}
  formula: ${escapeYamlString(system.attributes?.hp?.formula || "")}
ac: ${acVal}${acFormula ? ` ${acFormula}` : ""}
speed: ${escapeYamlString(speedStr)}
senses: ${toYamlArray(sensesStr, 2)}
languages: ${toYamlArray(langStr, 2)}
abilities:
  strength:
    score: ${ab.strength.score}
    modifier: ${escapeYamlString(ab.strength.modifier)}
    saves: ${escapeYamlString(ab.strength.save)}
    proficiency: ${escapeYamlString(ab.strength.proficiency)}
  dexterity:
    score: ${ab.dexterity.score}
    modifier: ${escapeYamlString(ab.dexterity.modifier)}
    saves: ${escapeYamlString(ab.dexterity.save)}
    proficiency: ${escapeYamlString(ab.dexterity.proficiency)}
  constitution:
    score: ${ab.constitution.score}
    modifier: ${escapeYamlString(ab.constitution.modifier)}
    saves: ${escapeYamlString(ab.constitution.save)}
    proficiency: ${escapeYamlString(ab.constitution.proficiency)}
  intelligence:
    score: ${ab.intelligence.score}
    modifier: ${escapeYamlString(ab.intelligence.modifier)}
    saves: ${escapeYamlString(ab.intelligence.save)}
    proficiency: ${escapeYamlString(ab.intelligence.proficiency)}
  wisdom:
    score: ${ab.wisdom.score}
    modifier: ${escapeYamlString(ab.wisdom.modifier)}
    saves: ${escapeYamlString(ab.wisdom.save)}
    proficiency: ${escapeYamlString(ab.wisdom.proficiency)}
  charisma:
    score: ${ab.charisma.score}
    modifier: ${escapeYamlString(ab.charisma.modifier)}
    saves: ${escapeYamlString(ab.charisma.save)}
    proficiency: ${escapeYamlString(ab.charisma.proficiency)}
---

# ${name}
${imgMarkdown}*${size} ${npcType}, ${alignment}*

- **${game.i18n.localize("MarkdownSheets.LabelChallengeRating")}:** ${cr} (${xp} ${game.i18n.localize("MarkdownSheets.LabelXP")})
- **${game.i18n.localize("MarkdownSheets.LabelAC")}:** ${acVal}${acFormula ? ` ${acFormula}` : ""}
- **${game.i18n.localize("MarkdownSheets.LabelHP")}:** ${hpVal} / ${hpMax}${hpFormula ? ` ${hpFormula}` : ""}
- **${game.i18n.localize("MarkdownSheets.LabelSpeed")}:** ${speedStr}
- **${game.i18n.localize("MarkdownSheets.LabelSenses")}:** ${sensesStr}
- **${game.i18n.localize("MarkdownSheets.LabelLanguages")}:** ${langStr}

### ${game.i18n.localize("MarkdownSheets.LabelAbilityScores")}
| STR | DEX | CON | INT | WIS | CHA |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ${system.abilities?.str?.value ?? 10} (${formatMod(system.abilities?.str?.mod ?? 0)}) | ${system.abilities?.dex?.value ?? 10} (${formatMod(system.abilities?.dex?.mod ?? 0)}) | ${system.abilities?.con?.value ?? 10} (${formatMod(system.abilities?.con?.mod ?? 0)}) | ${system.abilities?.int?.value ?? 10} (${formatMod(system.abilities?.int?.mod ?? 0)}) | ${system.abilities?.wis?.value ?? 10} (${formatMod(system.abilities?.wis?.mod ?? 0)}) | ${system.abilities?.cha?.value ?? 10} (${formatMod(system.abilities?.cha?.mod ?? 0)}) |

---
`;

    // Sort items into actions, traits, reactions etc.
    const traitsList = [];
    const actionsList = [];
    const bonusActionsList = [];
    const reactionsList = [];
    const legendaryList = [];
    const lairList = [];
    const spellsList = [];
    
    for (const item of actor.items) {
      if (item.type === "spell") {
        spellsList.push(item);
      } else {
        const act = item.system.activation?.type || "";
        if (act === "action" || item.type === "weapon") {
          actionsList.push(item);
        } else if (act === "bonus") {
          bonusActionsList.push(item);
        } else if (act === "reaction") {
          reactionsList.push(item);
        } else if (act === "legendary") {
          legendaryList.push(item);
        } else if (act === "lair") {
          lairList.push(item);
        } else {
          if (item.type === "feat" || item.type === "race" || item.type === "species" || item.type === "background") {
            traitsList.push(item);
          } else {
            if (act) {
              actionsList.push(item);
            } else {
              traitsList.push(item);
            }
          }
        }
      }
    }

    // Section: Traits
    if (traitsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelTraitsPassiveAbilities")}\n`;
      for (const t of traitsList.sort((a, b) => a.name.localeCompare(b.name))) {
        const enrichedDesc = await formatItemDescription(t, actor);
        md += `\n### ${t.name}\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Actions
    if (actionsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelActions")}\n`;
      for (const a of actionsList.sort((a, b) => a.name.localeCompare(b.name))) {
        const props = getItemProperties(a);
        const propsStr = props ? ` - *${game.i18n.localize("MarkdownSheets.LabelProperties")}: ${props}*\n` : "";
        const enrichedDesc = await formatItemDescription(a, actor);
        md += `\n### ${a.name}\n${propsStr}${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Bonus Actions
    if (bonusActionsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelBonusActions")}\n`;
      for (const ba of bonusActionsList.sort((a, b) => a.name.localeCompare(b.name))) {
        const enrichedDesc = await formatItemDescription(ba, actor);
        md += `\n### ${ba.name}\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Reactions
    if (reactionsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelReactions")}\n`;
      for (const r of reactionsList.sort((a, b) => a.name.localeCompare(b.name))) {
        const enrichedDesc = await formatItemDescription(r, actor);
        md += `\n### ${r.name}\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Legendary Actions
    if (legendaryList.length > 0) {
      const legMax = system.resources?.legact?.max ? ` (${game.i18n.format("MarkdownSheets.LabelMaxActions", { max: system.resources.legact.max })})` : "";
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelLegendaryActions")}${legMax}\n`;
      for (const la of legendaryList.sort((a, b) => a.name.localeCompare(b.name))) {
        const cost = la.system.activation?.cost ? ` (${game.i18n.format("MarkdownSheets.LabelCostsActions", { cost: la.system.activation.cost })})` : "";
        const enrichedDesc = await formatItemDescription(la, actor);
        md += `\n### ${la.name}${cost}\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Lair Actions
    if (lairList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelLairActions")}\n`;
      for (const la of lairList.sort((a, b) => a.name.localeCompare(b.name))) {
        const enrichedDesc = await formatItemDescription(la, actor);
        md += `\n### ${la.name}\n${enrichedDesc}\n`;
      }
      md += `\n---\n`;
    }
    
    // Section: Spells (if NPC is spellcaster)
    if (spellsList.length > 0) {
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelSpellcasting")}\n`;
      const scInfo = getSpellcastingInfo(actor);
      if (scInfo) md += `${scInfo}\n\n`;
      
      const spellGroups = {};
      for (const s of spellsList) {
        const lvl = s.system.level ?? 0;
        if (!spellGroups[lvl]) spellGroups[lvl] = [];
        spellGroups[lvl].push(s);
      }
      
      const sortedLevels = Object.keys(spellGroups).map(Number).sort((a, b) => a - b);
      for (const lvl of sortedLevels) {
        const title = lvl === 0 ? game.i18n.localize("MarkdownSheets.LabelCantrips") : game.i18n.format("MarkdownSheets.LabelLevelSpells", { level: lvl });
        let slotsStr = "";
        if (lvl > 0 && system.spells?.[`spell${lvl}`]) {
          const slots = system.spells[`spell${lvl}`];
          if (slots.max > 0) {
            slotsStr = ` (${slots.value}/${slots.max} ${game.i18n.localize("MarkdownSheets.LabelSlots")})`;
          }
        }
        
        md += `\n### ${title}${slotsStr}\n`;
        for (const s of spellGroups[lvl].sort((a, b) => a.name.localeCompare(b.name))) {
          const activation = s.system.activation ? `${s.system.activation.cost || ""} ${s.system.activation.type || ""}` : "";
          const sRange = s.system.range ? `${s.system.range.value || ""} ${s.system.range.units || ""}`.trim() : "";
          const components = getSpellProperties(s);
          const duration = s.system.duration ? `${s.system.duration.value || ""} ${s.system.duration.units || ""}`.trim() : "";
          const schoolKey = s.system.school;
          const school = CONFIG.DND5E?.spellSchools?.[schoolKey]?.label ? game.i18n.localize(CONFIG.DND5E.spellSchools[schoolKey].label) : (schoolKey || "");
          
          md += `\n#### ${s.name}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelSchool")}:** ${school}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelCastingTime")}:** ${activation}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelRange")}:** ${sRange}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelComponents")}:** ${components}\n`;
          md += `- **${game.i18n.localize("MarkdownSheets.LabelDuration")}:** ${duration}\n\n`;
          const enrichedDesc = await formatItemDescription(s, actor);
          md += `${enrichedDesc}\n`;
        }
      }
      md += `\n---\n`;
    }
    
    // Section: Biography
    const bio = system.details?.biography?.value || "";
    if (bio) {
      let enrichedBio = bio;
      try {
        enrichedBio = await TextEditor.enrichHTML(bio, { relativeTo: actor, async: true });
      } catch (err) {
        console.warn("Markdown Sheets | Failed to enrich biography:", err);
      }
      md += `\n## ${game.i18n.localize("MarkdownSheets.LabelBiographyDescription")}\n`;
      md += `${htmlToMarkdown(enrichedBio)}\n`;
    }
    
    return md;
  }

  /* ========================================================================= */
  /* HELPERS                                                                   */
  /* ========================================================================= */

  function getImageUrl(actor) {
    const img = actor.img;
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    const cleanImg = img.startsWith("/") ? img.slice(1) : img;
    return `${window.location.origin}/${cleanImg}`;
  }

  function formatMod(mod) {
    if (mod === undefined || mod === null) return "+0";
    const num = Number(mod);
    return num >= 0 ? `+${num}` : `${num}`;
  }

  function escapeYamlString(str) {
    if (!str) return '""';
    const escaped = str.toString().replace(/"/g, '\\"').replace(/\n/g, ' ');
    return `"${escaped}"`;
  }

  function toYamlArray(str, indent = 2) {
    if (!str || str === "None" || str === "none" || str === game.i18n.localize("MarkdownSheets.LabelNone")) {
      return "[]";
    }
    const parts = str.split(",").map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length === 0) return "[]";
    
    const spaces = " ".repeat(indent);
    let yaml = "\n";
    for (const part of parts) {
      yaml += `${spaces}- ${escapeYamlString(part)}\n`;
    }
    return yaml.trimEnd();
  }

  function getSpecies(actor) {
    const raceItem = actor.items.find(i => i.type === "race" || i.type === "species");
    if (raceItem) return raceItem.name;
    return actor.system.details?.race || game.i18n.localize("MarkdownSheets.LabelUnknownSpecies");
  }

  function getBackground(actor) {
    const bgItem = actor.items.find(i => i.type === "background");
    if (bgItem) return bgItem.name;
    return actor.system.details?.background || game.i18n.localize("MarkdownSheets.LabelNone");
  }

  function getNPCType(actor) {
    const details = actor.system.details;
    if (!details || !details.type) return game.i18n.localize("MarkdownSheets.LabelUnknownType");
    let typeStr = details.type.value || "";
    typeStr = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
    if (details.type.subtype) {
      typeStr += ` (${details.type.subtype})`;
    }
    if (details.type.swarm) {
      typeStr = game.i18n.format("MarkdownSheets.LabelSwarmOf", { swarm: details.type.swarm, type: typeStr });
    }
    return typeStr;
  }

  function getSpeedString(actor) {
    const movement = actor.system.attributes?.movement;
    if (!movement) return "0 ft";
    
    const parts = [];
    const units = movement.units || "ft";
    
    if (movement.walk) parts.push(`${movement.walk} ${units} (walk)`);
    if (movement.fly) parts.push(`${movement.fly} ${units} (fly)${movement.hover ? ' (hover)' : ''}`);
    if (movement.swim) parts.push(`${movement.swim} ${units} (swim)`);
    if (movement.climb) parts.push(`${movement.climb} ${units} (climb)`);
    if (movement.burrow) parts.push(`${movement.burrow} ${units} (burrow)`);
    
    if (parts.length === 0 && movement.value) {
      return typeof movement.value === 'string' ? movement.value : `${movement.value} ${units}`;
    }
    
    // If walk exists but is the only speed, just return e.g. "30 ft" instead of "30 ft (walk)"
    if (parts.length === 1 && movement.walk) {
      return `${movement.walk} ${units}`;
    }
    
    return parts.join(", ") || "0 ft";
  }

  function getSenses(actor) {
    const senses = actor.system.attributes?.senses;
    if (!senses) return game.i18n.localize("MarkdownSheets.LabelNone");
    
    const parts = [];
    const darkvision = senses.darkvision || senses.ranges?.darkvision;
    const blindsight = senses.blindsight || senses.ranges?.blindsight;
    const tremorsense = senses.tremorsense || senses.ranges?.tremorsense;
    const truesight = senses.truesight || senses.ranges?.truesight;
    const special = senses.special;
    
    const units = senses.units || "ft";
    
    if (darkvision) parts.push(`Darkvision ${darkvision} ${units}`);
    if (blindsight) parts.push(`Blindsight ${blindsight} ${units}`);
    if (tremorsense) parts.push(`Tremorsense ${tremorsense} ${units}`);
    if (truesight) parts.push(`Truesight ${truesight} ${units}`);
    if (special) parts.push(special);
    
    const passivePer = actor.system.skills?.prc?.passive ?? 10;
    parts.push(`Passive Perception ${passivePer}`);
    
    return parts.join(", ");
  }

  function getLanguages(actor) {
    const langs = actor.system.traits?.languages;
    if (!langs) return game.i18n.localize("MarkdownSheets.LabelNone");
    const list = [];
    if (langs.value) {
      const keys = langs.value instanceof Set ? Array.from(langs.value) : (Array.isArray(langs.value) ? langs.value : []);
      keys.forEach(k => {
        const label = CONFIG.DND5E?.languages?.[k]?.label || k.charAt(0).toUpperCase() + k.slice(1);
        list.push(label);
      });
    }
    if (langs.custom) {
      list.push(...langs.custom.split(/[,;]/).map(s => s.trim()));
    }
    return list.join(", ") || game.i18n.localize("MarkdownSheets.LabelNone");
  }

  function getAbilitiesBlock(actor) {
    const abilities = actor.system.abilities;
    if (!abilities) return {};
    
    const result = {};
    const ABILITIES = {
      str: "strength",
      dex: "dexterity",
      con: "constitution",
      int: "intelligence",
      wis: "wisdom",
      cha: "charisma"
    };
    
    for (const [key, name] of Object.entries(ABILITIES)) {
      const ab = abilities[key];
      if (!ab) {
        result[name] = {
          score: 10,
          modifier: "+0",
          save: "+0",
          proficiency: "none"
        };
        continue;
      }
      const val = ab.value || 10;
      const mod = formatMod(ab.mod || 0);
      const saveVal = getAbilitySaveValue(ab, actor);
      const saveMod = formatMod(saveVal);
      const proficiency = ab.proficient ? "proficient" : "none";
      result[name] = {
        score: val,
        modifier: mod,
        save: saveMod,
        proficiency: proficiency
      };
    }
    return result;
  }

  function getAbilitySaveValue(ab, actor) {
    if (!ab) return 0;
    if (typeof ab.save === "number") {
      return ab.save;
    }
    if (ab.save && typeof ab.save === "object") {
      if (typeof ab.save.value === "number") {
        return ab.save.value;
      }
      if (typeof ab.save.total === "number") {
        return ab.save.total;
      }
      if (typeof ab.save.mod === "number") {
        return ab.save.mod;
      }
    }
    // Fallback to manual calculation
    const profBonus = actor?.system?.attributes?.prof || 0;
    return (ab.mod || 0) + (ab.proficient ? profBonus : 0);
  }

  function getSkillsBlock(actor) {
    const skills = actor.system.skills;
    if (!skills) return "";
    
    const SKILLS = {
      acr: "Acrobatics",
      ani: "Animal Handling",
      arc: "Arcana",
      ath: "Athletics",
      dec: "Deception",
      his: "History",
      ins: "Insight",
      itm: "Intimidation",
      inv: "Investigation",
      med: "Medicine",
      nat: "Nature",
      prc: "Perception",
      prf: "Performance",
      per: "Persuasion",
      rel: "Religion",
      slt: "Sleight of Hand",
      ste: "Stealth",
      sur: "Survival"
    };
    
    let block = "";
    for (const [key, name] of Object.entries(SKILLS)) {
      const skill = skills[key];
      if (!skill) continue;
      
      // Resolve dynamically localized skill label if available in the game system, falling back to name
      const skillLabel = CONFIG.DND5E?.skills?.[key]?.label ? game.i18n.localize(CONFIG.DND5E.skills[key].label) : name;
      
      const modStr = formatMod(skill.total);
      let profLabel = "";
      if (skill.value === 1) profLabel = ` (${game.i18n.localize("DND5E.Proficient")})`;
      else if (skill.value === 2) profLabel = ` (${game.i18n.localize("DND5E.Expertise")})`;
      else if (skill.value === 0.5) profLabel = ` (${game.i18n.localize("DND5E.HalfProficient")})`;
      
      block += `- **${skillLabel}:** ${modStr}${profLabel} (Passive: ${skill.passive || 10})\n`;
    }
    return block;
  }

  function getFeatureSource(item) {
    const typeValue = item.system.type?.value;
    if (typeValue === "class") return game.i18n.localize("MarkdownSheets.FeatureClass");
    if (typeValue === "subclass") return game.i18n.localize("MarkdownSheets.FeatureSubclass");
    if (typeValue === "race") return game.i18n.localize("MarkdownSheets.FeatureRace");
    if (typeValue === "background") return game.i18n.localize("MarkdownSheets.FeatureBackground");
    if (typeValue === "feat") return game.i18n.localize("MarkdownSheets.FeatureFeat");
    return game.i18n.localize("MarkdownSheets.FeatureFeature");
  }

  function getItemProperties(item) {
    const sys = item.system;
    if (!sys.properties) return "";
    
    const props = [];
    const pSet = sys.properties instanceof Set ? sys.properties : new Set(sys.properties || []);
    
    pSet.forEach(p => {
      const label = CONFIG.DND5E?.itemProperties?.[p]?.label || CONFIG.DND5E?.weaponProperties?.[p]?.label || p;
      props.push(game.i18n.localize(label));
    });
    
    return props.join(", ");
  }

  function getSpellProperties(item) {
    const props = [];
    const sys = item.system;
    
    if (sys.properties instanceof Set || Array.isArray(sys.properties)) {
      const pSet = sys.properties instanceof Set ? sys.properties : new Set(sys.properties);
      if (pSet.has("vocal")) props.push("V");
      if (pSet.has("somatic")) props.push("S");
      if (pSet.has("material")) props.push("M");
      if (pSet.has("concentration")) props.push("C");
      if (pSet.has("ritual")) props.push("R");
    } else if (sys.components) {
      if (sys.components.vocal) props.push("V");
      if (sys.components.somatic) props.push("S");
      if (sys.components.material) props.push("M");
      if (sys.components.concentration) props.push("C");
      if (sys.components.ritual) props.push("R");
    }
    
    let label = props.join(", ");
    if (sys.materials?.value) {
      label += ` (${sys.materials.value})`;
    }
    return label || game.i18n.localize("MarkdownSheets.LabelNone");
  }

  function getSpellcastingInfo(actor) {
    const sc = actor.system.attributes?.spellcasting;
    if (!sc) return null;
    
    const abilityLabel = CONFIG.DND5E?.abilities?.[sc]?.label ? game.i18n.localize(CONFIG.DND5E.abilities[sc].label) : sc.toUpperCase();
    const spelldc = actor.system.attributes?.spelldc || 8;
    
    const prof = actor.system.attributes?.prof || 0;
    const mod = actor.system.abilities?.[sc]?.mod || 0;
    const attackBonus = formatMod(prof + mod);
    
    return `**${game.i18n.localize("MarkdownSheets.LabelSpellcastingAbility")}:** ${abilityLabel} (${game.i18n.localize("MarkdownSheets.LabelSpellSaveDC")}: ${spelldc}, ${game.i18n.localize("MarkdownSheets.LabelSpellAttackBonus")}: ${attackBonus})`;
  }

  async function formatItemDescription(item, actor) {
    let descHtml = item.system.description?.value || "";
    try {
      descHtml = await TextEditor.enrichHTML(descHtml, {
        relativeTo: item,
        rollData: actor?.getRollData() || item?.getRollData() || {},
        async: true
      });
    } catch (err) {
      console.warn("Markdown Sheets | Failed to enrich HTML for item:", item.name, err);
    }
    const mdDesc = htmlToMarkdown(descHtml);
    return mdDesc || `*${game.i18n.localize("MarkdownSheets.LabelNoDescription")}*`;
  }

  function downloadMarkdown(filename, content) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, filename);
    } else {
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }
  }

})();
