import { htmlToMarkdown } from "./html-to-markdown.js";

// 1. Hook for ApplicationV2 (Modern) sheet headers/context controls (Foundry v13/v14)
Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  const actor = app.actor || (app.document && app.document.documentName === "Actor" ? app.document : null);
  if (!actor || (actor.type !== "character" && actor.type !== "npc")) return;

  // Dynamically register the action on the application instance options
  if (!app.options.actions) app.options.actions = {};
  app.options.actions["export-markdown-sheet-v2"] = function(event, target) {
    exportActorToMarkdown(actor);
  };

  // Also bind to static actions config for security
  if (app.constructor.DEFAULT_OPTIONS) {
    if (!app.constructor.DEFAULT_OPTIONS.actions) app.constructor.DEFAULT_OPTIONS.actions = {};
    app.constructor.DEFAULT_OPTIONS.actions["export-markdown-sheet-v2"] = function(event, target) {
      exportActorToMarkdown(actor);
    };
  }

  // Prevent duplicate additions
  if (controls.some(c => c.action === "export-markdown-sheet-v2")) return;

  controls.push({
    action: "export-markdown-sheet-v2",
    icon: "fas fa-file-markdown",
    label: game.i18n.localize("MarkdownSheets.ExportButton"),
    visible: true,
    onclick: () => exportActorToMarkdown(actor) // Direct execution fallback
  });
});

// Helper to retrieve Actor from context menu target (handles raw DOM target)
function getActorFromContextTarget(target) {
  if (!target) return null;
  const el = target instanceof HTMLElement ? target : (target[0] || target);
  if (!el) return null;
  const actorId = el.dataset?.documentId || el.getAttribute?.("data-document-id") || el.dataset?.entryId;
  return game.actors.get(actorId);
}

// 2. Hook for ApplicationV2 (Modern) Actor directory context menu (Foundry v13/v14)
Hooks.on("getActorContextOptions", (application, menuItems) => {
  menuItems.push({
    name: game.i18n.localize("MarkdownSheets.ExportButton"),
    icon: '<i class="fas fa-file-markdown"></i>',
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



/**
 * Main function to export Actor document to Markdown and download it.
 * @param {Actor} actor - The actor document.
 */
function exportActorToMarkdown(actor) {
  try {
    let markdown = "";
    if (actor.type === "character") {
      markdown = generatePCMarkdown(actor);
    } else if (actor.type === "npc") {
      markdown = generateNPCMarkdown(actor);
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
function generatePCMarkdown(actor) {
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
hp: ${hpVal} / ${hpMax}${hpTemp ? ` (Temp: ${hpTemp})` : ""}
ac: ${acVal}
initiative: ${escapeYamlString(initMod)}
speed: ${escapeYamlString(speedStr)}
proficiency_bonus: ${escapeYamlString(profBonus)}
senses: ${escapeYamlString(sensesStr)}
languages: ${escapeYamlString(langStr)}
abilities:
  strength: ${escapeYamlString(ab.strength)}
  dexterity: ${escapeYamlString(ab.dexterity)}
  constitution: ${escapeYamlString(ab.constitution)}
  intelligence: ${escapeYamlString(ab.intelligence)}
  wisdom: ${escapeYamlString(ab.wisdom)}
  charisma: ${escapeYamlString(ab.charisma)}
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
        const saveMod = formatMod(ability.save || ability.mod || 0);
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
      md += `\n### ${f.name}\n- **${game.i18n.localize("MarkdownSheets.LabelType")}:** ${typeLabel}${requirement}${uses}\n\n${formatItemDescription(f)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Inventory
  const hasInventory = weaponsList.length || armorList.length || equipmentList.length || consumablesList.length || toolsList.length || containersList.length || lootList.length;
  if (hasInventory) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelInventory")}\n`;
    
    const appendInvSection = (titleKey, list) => {
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
        
        sec += `\n#### ${i.name}${eq}\n- **${game.i18n.localize("MarkdownSheets.LabelQuantity")}:** ${qty} | **${game.i18n.localize("MarkdownSheets.LabelWeight")}:** ${totalWt} lbs${propsStr}\n\n${formatItemDescription(i)}\n`;
      }
      return sec;
    };
    
    md += appendInvSection("MarkdownSheets.InvWeapons", weaponsList);
    md += appendInvSection("MarkdownSheets.InvArmorShield", armorList);
    md += appendInvSection("MarkdownSheets.InvEquipmentGear", equipmentList);
    md += appendInvSection("MarkdownSheets.InvConsumables", consumablesList);
    md += appendInvSection("MarkdownSheets.InvTools", toolsList);
    md += appendInvSection("MarkdownSheets.InvContainers", containersList);
    md += appendInvSection("MarkdownSheets.InvOtherLoot", lootList);
    
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
        md += `${formatItemDescription(s)}\n`;
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
      md += `\n### ${game.i18n.localize("MarkdownSheets.LabelAppearance")}\n${appearance}\n`;
    }
    if (bio) {
      md += `\n### ${game.i18n.localize("MarkdownSheets.LabelBiography")}\n${htmlToMarkdown(bio)}\n`;
    }
  }
  
  return md;
}

/**
 * Generates Markdown for a Non-Player Character.
 * @param {Actor} actor - The NPC actor.
 * @returns {string} Fully formatted markdown content.
 */
function generateNPCMarkdown(actor) {
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
hp: ${hpVal} / ${hpMax}${hpFormula ? ` ${hpFormula}` : ""}
ac: ${acVal}${acFormula ? ` ${acFormula}` : ""}
speed: ${escapeYamlString(speedStr)}
senses: ${escapeYamlString(sensesStr)}
languages: ${escapeYamlString(langStr)}
abilities:
  strength: ${escapeYamlString(ab.strength)}
  dexterity: ${escapeYamlString(ab.dexterity)}
  constitution: ${escapeYamlString(ab.constitution)}
  intelligence: ${escapeYamlString(ab.intelligence)}
  wisdom: ${escapeYamlString(ab.wisdom)}
  charisma: ${escapeYamlString(ab.charisma)}
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
      md += `\n### ${t.name}\n${formatItemDescription(t)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Actions
  if (actionsList.length > 0) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelActions")}\n`;
    for (const a of actionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      const props = getItemProperties(a);
      const propsStr = props ? ` - *${game.i18n.localize("MarkdownSheets.LabelProperties")}: ${props}*\n` : "";
      md += `\n### ${a.name}\n${propsStr}${formatItemDescription(a)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Bonus Actions
  if (bonusActionsList.length > 0) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelBonusActions")}\n`;
    for (const ba of bonusActionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${ba.name}\n${formatItemDescription(ba)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Reactions
  if (reactionsList.length > 0) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelReactions")}\n`;
    for (const r of reactionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${r.name}\n${formatItemDescription(r)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Legendary Actions
  if (legendaryList.length > 0) {
    const legMax = system.resources?.legact?.max ? ` (${game.i18n.format("MarkdownSheets.LabelMaxActions", { max: system.resources.legact.max })})` : "";
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelLegendaryActions")}${legMax}\n`;
    for (const la of legendaryList.sort((a, b) => a.name.localeCompare(b.name))) {
      const cost = la.system.activation?.cost ? ` (${game.i18n.format("MarkdownSheets.LabelCostsActions", { cost: la.system.activation.cost })})` : "";
      md += `\n### ${la.name}${cost}\n${formatItemDescription(la)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Lair Actions
  if (lairList.length > 0) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelLairActions")}\n`;
    for (const la of lairList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${la.name}\n${formatItemDescription(la)}\n`;
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
        md += `${formatItemDescription(s)}\n`;
      }
    }
    md += `\n---\n`;
  }
  
  // Section: Biography
  const bio = system.details?.biography?.value || "";
  if (bio) {
    md += `\n## ${game.i18n.localize("MarkdownSheets.LabelBiographyDescription")}\n`;
    md += `${htmlToMarkdown(bio)}\n`;
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
  const speed = actor.system.attributes?.speed;
  if (!speed) return "0 ft";
  
  const parts = [];
  if (speed.walk) parts.push(`${speed.walk} ft (walk)`);
  if (speed.fly) parts.push(`${speed.fly} ft (fly)${speed.hover ? ' (hover)' : ''}`);
  if (speed.swim) parts.push(`${speed.swim} ft (swim)`);
  if (speed.climb) parts.push(`${speed.climb} ft (climb)`);
  if (speed.burrow) parts.push(`${speed.burrow} ft (burrow)`);
  
  if (parts.length === 0 && speed.value) {
    return typeof speed.value === 'string' ? speed.value : `${speed.value} ft`;
  }
  
  return parts.join(", ") || "0 ft";
}

function getSenses(actor) {
  const senses = actor.system.attributes?.senses;
  if (!senses) return game.i18n.localize("MarkdownSheets.LabelNone");
  
  const parts = [];
  if (senses.darkvision) parts.push(`Darkvision ${senses.darkvision} ft`);
  if (senses.blindsight) parts.push(`Blindsight ${senses.blindsight} ft`);
  if (senses.tremorsense) parts.push(`Tremorsense ${senses.tremorsense} ft`);
  if (senses.truesight) parts.push(`Truesight ${senses.truesight} ft`);
  if (senses.special) parts.push(senses.special);
  
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
      result[name] = "10 (+0)";
      continue;
    }
    const val = ab.value || 10;
    const mod = formatMod(ab.mod || 0);
    const saveMod = formatMod(ab.save || ab.mod || 0);
    const isProf = ab.proficient ? ` (${game.i18n.localize("DND5E.Proficient")})` : "";
    result[name] = `${val} (${mod}, Save: ${saveMod}${isProf})`;
  }
  return result;
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

function formatItemDescription(item) {
  const descHtml = item.system.description?.value || "";
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
