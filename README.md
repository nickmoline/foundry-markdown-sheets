# Markdown Sheet Exporter for Foundry VTT

A Foundry VTT module that allows GM and players to export D&D 5e/5.5 character and NPC sheets as structured, beautifully-formatted Markdown files. The exported files are tailored for compatibility with tools like **Obsidian**, **NotebookLM**, and **Archivist.AI**.

## Features

- **PC and NPC Support:** Tailored exports for both Player Characters (focusing on class levels, inventory, feats, and spell lists) and NPCs (focusing on challenge rating, legendary actions, traits, actions, and reactions).
- **YAML Frontmatter:** Basic stats, attributes, speeds, and abilities are formatted as a YAML block at the top of the file for quick parsing by markdown vaults or metadata plugins.
- **Rich Markdown Formatting:** Automatically parses description HTML from items, features, and spells into clean Markdown (retaining bolding, italics, list structures, tables, and blockquotes).
- **Multiclassing Support:** Accurately extracts and lists multiple classes along with their levels and subclass associations.
- **Spellbook Formatting:** Groups spells by level, showing slots, casting times, ranges, components, and durations.

## Compatibility

- **Foundry VTT:** Versions 13 & 14
- **Game System:** D&D 5e (System Versions 4.x and 5.x, supporting the D&D 2024 / 5.5 ruleset)

## Installation

1. Open your Foundry VTT application.
2. Go to the **Add-on Modules** tab on the Setup screen.
3. Click the **Install Module** button.
4. Paste the following Manifest URL in the text box:
   ```
   https://github.com/nick/foundry-markdown-sheets/releases/latest/download/module.json
   ```
5. Click **Install**.

## Usage

1. Activate the **Markdown Sheet Exporter** module in your world settings.
2. Open any Character or NPC sheet.
3. In the sheet window header (next to the Close button), click **Export Markdown**.
4. A `.md` file containing the actor's formatted sheet will be downloaded by your browser.
5. Save the file into your Obsidian vault, or upload it to NotebookLM / Archivist.AI.
