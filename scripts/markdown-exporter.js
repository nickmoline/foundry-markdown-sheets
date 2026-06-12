import { htmlToMarkdown } from "./html-to-markdown.js";

// Hook into character/NPC sheet header button generation
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor;
  if (!actor) return;
  
  // We support exporting "character" and "npc" types in dnd5e
  if (actor.type !== "character" && actor.type !== "npc") return;
  
  buttons.unshift({
    label: "Export Markdown",
    class: "export-markdown-sheet",
    icon: "fas fa-file-markdown",
    onclick: () => exportActorToMarkdown(actor)
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
      ui.notifications.warn("Exporting to Markdown is only supported for Player Characters and NPCs.");
      return;
    }
    
    const safeName = actor.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeName}_sheet.md`;
    downloadMarkdown(filename, markdown);
    ui.notifications.info(`Successfully exported character sheet for ${actor.name}!`);
  } catch (error) {
    console.error("Markdown Exporter | Error exporting actor sheet:", error);
    ui.notifications.error("An error occurred while exporting the sheet to Markdown. Check console logs.");
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
  const alignment = system.details?.alignment || "Neutral";
  
  // Class & Level calculation (multi-class friendly)
  const classes = actor.items.filter(i => i.type === "class");
  const subclasses = actor.items.filter(i => i.type === "subclass");
  const classStrings = classes.map(cls => {
    const classId = cls.system.identifier || cls.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchingSubclass = subclasses.find(sc => sc.system.classIdentifier === classId);
    const level = cls.system.levels || 1;
    return matchingSubclass ? `${cls.name} (${matchingSubclass.name}) ${level}` : `${cls.name} ${level}`;
  });
  const classLine = classStrings.join(" / ") || "None";
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
  
  // Frontmatter construction
  let md = `---
name: ${escapeYamlString(name)}
type: "character"
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
*Level ${totalLevel} ${species} ${classLine} | Background: ${background} | Alignment: ${alignment}*

## Core Stats
- **Armor Class:** ${acVal}
- **Hit Points:** ${hpVal} / ${hpMax}${hpTemp ? ` (Temp: ${hpTemp})` : ""}
- **Speed:** ${speedStr}
- **Initiative:** ${initMod}
- **Proficiency Bonus:** ${profBonus}
- **Senses:** ${sensesStr}
- **Languages:** ${langStr}

### Saving Throws
`;

  // Append saves
  const abilities = system.abilities;
  if (abilities) {
    for (const [key, abName] of Object.entries({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" })) {
      const ability = abilities[key];
      if (ability) {
        const saveMod = formatMod(ability.save || ability.mod || 0);
        const isProf = ability.proficient ? " (Proficient)" : "";
        md += `- **${abName}:** ${saveMod}${isProf}\n`;
      }
    }
  }
  
  md += `
### Skills
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
    md += `\n## Features & Talents\n`;
    for (const f of featuresList.sort((a, b) => a.name.localeCompare(b.name))) {
      const typeLabel = getFeatureSource(f);
      const requirement = f.system.requirements ? ` (${f.system.requirements})` : "";
      const uses = f.system.uses?.max ? ` | Uses: ${f.system.uses.value}/${f.system.uses.max}` : "";
      md += `\n### ${f.name}\n- **Type:** ${typeLabel}${requirement}${uses}\n\n${formatItemDescription(f)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Inventory
  const hasInventory = weaponsList.length || armorList.length || equipmentList.length || consumablesList.length || toolsList.length || containersList.length || lootList.length;
  if (hasInventory) {
    md += `\n## Inventory\n`;
    
    const appendInvSection = (title, list) => {
      if (list.length === 0) return "";
      let sec = `\n### ${title}\n`;
      for (const i of list.sort((a, b) => a.name.localeCompare(b.name))) {
        const qty = i.system.quantity ?? 1;
        const wt = i.system.weight ?? 0;
        const totalWt = (qty * wt).toFixed(1);
        const eq = i.system.equipped ? " (Equipped)" : "";
        const props = getItemProperties(i);
        const propsStr = props ? ` | Properties: ${props}` : "";
        
        sec += `\n#### ${i.name}${eq}\n- **Quantity:** ${qty} | **Weight:** ${totalWt} lbs${propsStr}\n\n${formatItemDescription(i)}\n`;
      }
      return sec;
    };
    
    md += appendInvSection("Weapons", weaponsList);
    md += appendInvSection("Armor & Shield", armorList);
    md += appendInvSection("Equipment & Gear", equipmentList);
    md += appendInvSection("Consumables", consumablesList);
    md += appendInvSection("Tools", toolsList);
    md += appendInvSection("Containers", containersList);
    md += appendInvSection("Other Loot", lootList);
    
    md += `\n---\n`;
  }
  
  // Section: Spellcasting
  if (spellsList.length > 0) {
    md += `\n## Spellcasting\n`;
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
      const title = lvl === 0 ? "Cantrips" : `Level ${lvl} Spells`;
      let slotsStr = "";
      if (lvl > 0 && system.spells?.[`spell${lvl}`]) {
        const slots = system.spells[`spell${lvl}`];
        if (slots.max > 0) {
          slotsStr = ` (${slots.value}/${slots.max} slots)`;
        }
      }
      
      md += `\n### ${title}${slotsStr}\n`;
      for (const s of spellGroups[lvl].sort((a, b) => a.name.localeCompare(b.name))) {
        const activation = s.system.activation ? `${s.system.activation.cost || ""} ${s.system.activation.type || ""}` : "";
        const sRange = s.system.range ? `${s.system.range.value || ""} ${s.system.range.units || ""}`.trim() : "";
        const components = getSpellProperties(s);
        const duration = s.system.duration ? `${s.system.duration.value || ""} ${s.system.duration.units || ""}`.trim() : "";
        const schoolKey = s.system.school;
        const school = CONFIG.DND5E?.spellSchools?.[schoolKey]?.label || schoolKey || "";
        
        md += `\n#### ${s.name}\n`;
        md += `- **School:** ${school}\n`;
        md += `- **Casting Time:** ${activation}\n`;
        md += `- **Range:** ${sRange}\n`;
        md += `- **Components:** ${components}\n`;
        md += `- **Duration:** ${duration}\n\n`;
        md += `${formatItemDescription(s)}\n`;
      }
    }
    md += `\n---\n`;
  }
  
  // Section: Biography
  const bio = system.details?.biography?.value || "";
  const appearance = system.details?.appearance || "";
  if (bio || appearance) {
    md += `\n## Biography & Appearance\n`;
    if (appearance) {
      md += `\n### Appearance\n${appearance}\n`;
    }
    if (bio) {
      md += `\n### Biography\n${htmlToMarkdown(bio)}\n`;
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
  const alignment = system.details?.alignment || "Neutral";
  
  // Size and Type
  const sizeKey = system.traits?.size || "med";
  const size = CONFIG.DND5E?.actorSizes?.[sizeKey]?.label || sizeKey.toUpperCase();
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
  
  // Frontmatter construction
  let md = `---
name: ${escapeYamlString(name)}
type: "npc"
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
*${size} ${npcType}, ${alignment}*

- **Challenge Rating:** ${cr} (${xp} XP)
- **Armor Class:** ${acVal}${acFormula ? ` ${acFormula}` : ""}
- **Hit Points:** ${hpVal} / ${hpMax}${hpFormula ? ` ${hpFormula}` : ""}
- **Speed:** ${speedStr}
- **Senses:** ${sensesStr}
- **Languages:** ${langStr}

### Ability Scores
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
    md += `\n## Traits & Passive Abilities\n`;
    for (const t of traitsList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${t.name}\n${formatItemDescription(t)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Actions
  if (actionsList.length > 0) {
    md += `\n## Actions\n`;
    for (const a of actionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      const props = getItemProperties(a);
      const propsStr = props ? ` - *Properties: ${props}*\n` : "";
      md += `\n### ${a.name}\n${propsStr}${formatItemDescription(a)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Bonus Actions
  if (bonusActionsList.length > 0) {
    md += `\n## Bonus Actions\n`;
    for (const ba of bonusActionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${ba.name}\n${formatItemDescription(ba)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Reactions
  if (reactionsList.length > 0) {
    md += `\n## Reactions\n`;
    for (const r of reactionsList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${r.name}\n${formatItemDescription(r)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Legendary Actions
  if (legendaryList.length > 0) {
    const legMax = system.resources?.legact?.max ? ` (Max Actions: ${system.resources.legact.max})` : "";
    md += `\n## Legendary Actions${legMax}\n`;
    for (const la of legendaryList.sort((a, b) => a.name.localeCompare(b.name))) {
      const cost = la.system.activation?.cost ? ` (Costs ${la.system.activation.cost} Actions)` : "";
      md += `\n### ${la.name}${cost}\n${formatItemDescription(la)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Lair Actions
  if (lairList.length > 0) {
    md += `\n## Lair Actions\n`;
    for (const la of lairList.sort((a, b) => a.name.localeCompare(b.name))) {
      md += `\n### ${la.name}\n${formatItemDescription(la)}\n`;
    }
    md += `\n---\n`;
  }
  
  // Section: Spells (if NPC is spellcaster)
  if (spellsList.length > 0) {
    md += `\n## Spellcasting\n`;
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
      const title = lvl === 0 ? "Cantrips" : `Level ${lvl} Spells`;
      let slotsStr = "";
      if (lvl > 0 && system.spells?.[`spell${lvl}`]) {
        const slots = system.spells[`spell${lvl}`];
        if (slots.max > 0) {
          slotsStr = ` (${slots.value}/${slots.max} slots)`;
        }
      }
      
      md += `\n### ${title}${slotsStr}\n`;
      for (const s of spellGroups[lvl].sort((a, b) => a.name.localeCompare(b.name))) {
        const activation = s.system.activation ? `${s.system.activation.cost || ""} ${s.system.activation.type || ""}` : "";
        const sRange = s.system.range ? `${s.system.range.value || ""} ${s.system.range.units || ""}`.trim() : "";
        const components = getSpellProperties(s);
        const duration = s.system.duration ? `${s.system.duration.value || ""} ${s.system.duration.units || ""}`.trim() : "";
        const schoolKey = s.system.school;
        const school = CONFIG.DND5E?.spellSchools?.[schoolKey]?.label || schoolKey || "";
        
        md += `\n#### ${s.name}\n`;
        md += `- **School:** ${school}\n`;
        md += `- **Casting Time:** ${activation}\n`;
        md += `- **Range:** ${sRange}\n`;
        md += `- **Components:** ${components}\n`;
        md += `- **Duration:** ${duration}\n\n`;
        md += `${formatItemDescription(s)}\n`;
      }
    }
    md += `\n---\n`;
  }
  
  // Section: Biography
  const bio = system.details?.biography?.value || "";
  if (bio) {
    md += `\n## Biography & Description\n`;
    md += `${htmlToMarkdown(bio)}\n`;
  }
  
  return md;
}

/* ========================================================================= */
/* HELPERS                                                                   */
/* ========================================================================= */

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
  return actor.system.details?.race || "Unknown Species";
}

function getBackground(actor) {
  const bgItem = actor.items.find(i => i.type === "background");
  if (bgItem) return bgItem.name;
  return actor.system.details?.background || "None";
}

function getNPCType(actor) {
  const details = actor.system.details;
  if (!details || !details.type) return "Unknown Type";
  let typeStr = details.type.value || "";
  typeStr = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
  if (details.type.subtype) {
    typeStr += ` (${details.type.subtype})`;
  }
  if (details.type.swarm) {
    typeStr = `Swarm of ${details.type.swarm} ${typeStr}`;
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
  if (!senses) return "None";
  
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
  if (!langs) return "None";
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
  return list.join(", ") || "None";
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
    const isProf = ab.proficient ? " (Proficient)" : "";
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
    
    const modStr = formatMod(skill.total);
    let profLabel = "";
    if (skill.value === 1) profLabel = " (Proficient)";
    else if (skill.value === 2) profLabel = " (Expertise)";
    else if (skill.value === 0.5) profLabel = " (Half-Proficient)";
    
    block += `- **${name}:** ${modStr}${profLabel} (Passive: ${skill.passive || 10})\n`;
  }
  return block;
}

function getFeatureSource(item) {
  const typeValue = item.system.type?.value;
  if (typeValue === "class") return "Class Feature";
  if (typeValue === "subclass") return "Subclass Feature";
  if (typeValue === "race") return "Species Trait";
  if (typeValue === "background") return "Background Feature";
  if (typeValue === "feat") return "Feat";
  return "Feature";
}

function getItemProperties(item) {
  const sys = item.system;
  if (!sys.properties) return "";
  
  const props = [];
  const pSet = sys.properties instanceof Set ? sys.properties : new Set(sys.properties || []);
  
  pSet.forEach(p => {
    const label = CONFIG.DND5E?.itemProperties?.[p]?.label || CONFIG.DND5E?.weaponProperties?.[p]?.label || p;
    props.push(label);
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
  return label || "None";
}

function getSpellcastingInfo(actor) {
  const sc = actor.system.attributes?.spellcasting;
  if (!sc) return null;
  
  const abilityLabel = CONFIG.DND5E?.abilities?.[sc]?.label || sc.toUpperCase();
  const spelldc = actor.system.attributes?.spelldc || 8;
  
  const prof = actor.system.attributes?.prof || 0;
  const mod = actor.system.abilities?.[sc]?.mod || 0;
  const attackBonus = formatMod(prof + mod);
  
  return `**Spellcasting Ability:** ${abilityLabel} (Spell Save DC: ${spelldc}, Spell Attack Bonus: ${attackBonus})`;
}

function formatItemDescription(item) {
  const descHtml = item.system.description?.value || "";
  const mdDesc = htmlToMarkdown(descHtml);
  return mdDesc || "*No description provided.*";
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
