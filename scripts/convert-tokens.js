/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @file scripts/convert-tokens.js
 * @description Translates Figma Design Tokens (JSON) into modular, documented CSS Custom Properties.
 * 
 * ============================================================================
 * ARCHITECTURAL PRINCIPLES & USAGE RULES
 * ============================================================================
 * 
 * 1. FOUNDATIONAL PRIMITIVE COLORS (`--color-primitive-*`):
 *    - Extracted from `primitive colors` in the design token file.
 *    - Represents key colors, full chromatic tint/shade scales (0-100), and neutral tones.
 *    - ⚠️ RULE: NEVER apply primitive tokens directly in UI component styles.
 *      They are raw palette variables meant only to establish themes and feed semantic roles.
 * 
 * 2. SEMANTIC COLOR ROLES (`--color-ui-*`, `--color-role-*`):
 *    - Extracted from `color roles` in the design token file.
 *    - PRIMARY UI COLOR ROLES:
 *      * `primary color2` & `secondary color2` are designated UI role colors
 *        intended for interactive components, primary buttons, highlights, and active states.
 *      * Aliased to `--color-ui-primary`, `--color-ui-secondary`, `--color-primary-2`, etc.
 *    - Standard Semantic Hierarchy:
 *      * Mappings for surface, outline, error, primary container, and on-surface states.
 *      * Cross-token references (e.g. `{primitive colors.key colors group.primary key color}`)
 *        are dynamically resolved to CSS `var(--color-primitive-*, fallbackColor)`.
 * 
 * 3. SPACING SCALE (`--spacing-*`):
 *    - Converted from `spacing` tokens with both numeric/pixel tokens and friendly semantic aliases
 *      (--spacing-none, --spacing-xs, --spacing-sm, --spacing-md, --spacing-base, etc.).
 * 
 * 4. ELEVATION & SHADOWS (`--shadow-*`):
 *    - Drop-shadow specifications converted directly to valid CSS `box-shadow` values.
 * 
 * 5. TYPOGRAPHY SYSTEM (`--typography-*`):
 *    - Deconstructed into discrete CSS variables for font-family, font-size, font-weight,
 *      line-height, and letter-spacing for each display/headline/title/body/label scale.
 *    - Provides optional utility classes (e.g., `.text-display-large`, `.text-body-large`).
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// String & Color Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes any string into a clean kebab-case identifier.
 * @param {string} str 
 * @returns {string}
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]/g, '')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Formats hex8 (#rrggbbaa) to rgba(...) or standard hex.
 * Modern browsers support #rrggbbaa, but rgba is provided for broad tooling compatibility.
 * @param {string} hex 
 * @returns {string}
 */
function formatColor(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 8) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const a = (parseInt(cleanHex.slice(6, 8), 16) / 255).toFixed(3).replace(/\.?0+$/, '');
    if (a === '1') {
      return `#${cleanHex.slice(0, 6)}`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return hex;
}

/**
 * Traverses an object using an array of keys.
 * @param {object} obj 
 * @param {string[]} pathArray 
 * @returns {any}
 */
function getByPath(obj, pathArray) {
  let curr = obj;
  for (const p of pathArray) {
    if (!curr || typeof curr !== 'object') return null;
    curr = curr[p];
  }
  return curr;
}

/**
 * Resolves a token reference like "{primitive colors.key colors group.primary key color}".
 * @param {string} refStr 
 * @param {object} rootTokens 
 * @returns {{ resolvedValue: any, cssVarName: string, pathParts: string[] } | null}
 */
function resolveReference(refStr, rootTokens) {
  if (typeof refStr !== 'string' || !refStr.startsWith('{') || !refStr.endsWith('}')) {
    return null;
  }
  const inner = refStr.slice(1, -1);
  const parts = inner.split('.');
  const targetToken = getByPath(rootTokens, parts);
  
  let targetVarName = '';
  if (parts[0] === 'primitive colors') {
    const subParts = parts.slice(1);
    targetVarName = `--color-primitive-${subParts.map(toKebabCase).join('-')}`;
  } else {
    targetVarName = `--${parts.map(toKebabCase).join('-')}`;
  }

  return {
    targetToken,
    resolvedValue: targetToken ? targetToken.value : null,
    cssVarName: targetVarName,
    pathParts: parts
  };
}

// ---------------------------------------------------------------------------
// Processing Modules
// ---------------------------------------------------------------------------

/**
 * Extracts Primitive Colors.
 * Foundational tokens: key colors, palette scales (0-100), neutral tones.
 */
function processPrimitiveColors(primitiveGroup) {
  const lines = [];
  let count = 0;

  lines.push('  /* ==========================================================================');
  lines.push('     1. FOUNDATIONAL PRIMITIVE COLORS (DO NOT APPLY DIRECTLY TO UI)');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     ⚠️ ARCHITECTURE RULE:');
  lines.push('     These values represent the chromatic foundation of the design system.');
  lines.push('     They MUST NOT be applied directly to UI components.');
  lines.push('     Use the semantic UI Color Roles defined in Section 2 instead.');
  lines.push('     ========================================================================== */\n');

  function walk(obj, currentPath = []) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object') {
        if (val.type === 'color' || val.value !== undefined) {
          const varName = `--color-primitive-${[...currentPath, key].map(toKebabCase).join('-')}`;
          const formattedVal = formatColor(val.value);
          lines.push(`  ${varName}: ${formattedVal};`);
          count++;
        } else {
          lines.push(`\n  /* Primitive Palette: ${[...currentPath, key].join(' > ')} */`);
          walk(val, [...currentPath, key]);
        }
      }
    }
  }

  walk(primitiveGroup);
  return { css: lines.join('\n'), count };
}

/**
 * Extracts Color Roles for UI application.
 * Highlights role set 2 (primary color2, secondary color2) and resolves references.
 */
function processColorRoles(colorRolesGroup, rootTokens) {
  const lines = [];
  let count = 0;

  lines.push('\n  /* ==========================================================================');
  lines.push('     2. SEMANTIC COLOR ROLES (APPLY DIRECTLY TO UI)');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     These tokens represent semantic UI colors for buttons, surfaces, text, etc.');
  lines.push('     HIGHLIGHTED ROLES:');
  lines.push('     "primary color2" and "secondary color2" are designated as primary UI colors.');
  lines.push('     ========================================================================== */\n');

  lines.push('  /* --- Primary Brand Roles (Role Set 2: Direct UI Application) --- */');

  const roleSet2Definitions = [
    { key: 'primary color2', uiAlias: '--color-ui-primary', shortAlias: '--color-primary-2' },
    { key: 'primary container 2', uiAlias: '--color-ui-primary-container', shortAlias: '--color-primary-container-2' },
    { key: 'on primary container 2', uiAlias: '--color-ui-on-primary-container', shortAlias: '--color-on-primary-container-2' },
    { key: 'secondary color2', uiAlias: '--color-ui-secondary', shortAlias: '--color-secondary-2' },
    { key: 'secondary container 2', uiAlias: '--color-ui-secondary-container', shortAlias: '--color-secondary-container-2' },
    { key: 'on secondary container 2', uiAlias: '--color-ui-on-secondary-container', shortAlias: '--color-on-secondary-container-2' },
    { key: 'tertiary color2', uiAlias: '--color-ui-tertiary', shortAlias: '--color-tertiary-2' },
    { key: 'tertiary container 2', uiAlias: '--color-ui-tertiary-container', shortAlias: '--color-tertiary-container-2' },
    { key: 'on tertiary container 2', uiAlias: '--color-ui-on-tertiary-container', shortAlias: '--color-on-tertiary-container-2' },
    { key: 'color', uiAlias: '--color-ui-accent', shortAlias: '--color-accent' }
  ];

  const processedKeys = new Set();

  for (const item of roleSet2Definitions) {
    if (colorRolesGroup[item.key]) {
      const token = colorRolesGroup[item.key];
      processedKeys.add(item.key);
      const varName = `--color-ui-${toKebabCase(item.key)}`;
      const formatted = formatColor(token.value);
      lines.push(`  ${varName}: ${formatted};`);
      if (item.shortAlias) {
        lines.push(`  ${item.shortAlias}: var(${varName});`);
      }
      if (item.uiAlias) {
        lines.push(`  ${item.uiAlias}: var(${varName});`);
      }
      count++;
    }
  }

  lines.push('\n  /* --- Semantic Material Roles (Linked to Foundations with Fallbacks) --- */');
  for (const [groupName, groupObj] of Object.entries(colorRolesGroup)) {
    if (processedKeys.has(groupName)) continue;

    if (groupObj && typeof groupObj === 'object' && !groupObj.type && !groupObj.value) {
      lines.push(`\n  /* Semantic Role Group: ${groupName.toUpperCase()} */`);
      for (const [tokenName, tokenData] of Object.entries(groupObj)) {
        if (!tokenData) continue;
        const varName = `--color-role-${toKebabCase(groupName)}-${toKebabCase(tokenName)}`;
        const aliasName = groupName === tokenName ? `--color-role-${toKebabCase(groupName)}` : null;

        let valStr = '';
        if (typeof tokenData.value === 'string' && tokenData.value.startsWith('{')) {
          const res = resolveReference(tokenData.value, rootTokens);
          if (res) {
            const fallbackColor = formatColor(res.resolvedValue);
            valStr = `var(${res.cssVarName}, ${fallbackColor})`;
          } else {
            valStr = tokenData.value;
          }
        } else {
          valStr = formatColor(tokenData.value);
        }

        lines.push(`  ${varName}: ${valStr};`);
        if (aliasName && aliasName !== varName) {
          lines.push(`  ${aliasName}: var(${varName});`);
        }
        count++;
      }
    }
  }

  return { css: lines.join('\n'), count };
}

/**
 * Extracts Spacing Tokens.
 */
function processSpacing(spacingGroup) {
  const lines = [];
  let count = 0;

  lines.push('\n  /* ==========================================================================');
  lines.push('     3. SPACING SCALE');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     System spacing values converted to CSS custom properties.');
  lines.push('     ========================================================================== */\n');

  const semanticAliases = {
    'no spacing': '--spacing-none',
    'extra small spacing': '--spacing-xs',
    'small spacing': '--spacing-sm',
    'medium spacing': '--spacing-md',
    'base spacing': '--spacing-base',
    'large spacing': '--spacing-lg',
    'extra large spacing': '--spacing-xl',
    'very large sacing': '--spacing-2xl'
  };

  for (const [key, token] of Object.entries(spacingGroup)) {
    if (token && token.value !== undefined) {
      const pxVal = `${token.value}px`;
      const remVal = token.value === 0 ? '0' : `${token.value / 16}rem`;
      const varName = `--spacing-${toKebabCase(key)}`;
      lines.push(`  ${varName}: ${pxVal}; /* ${remVal} */`);
      
      const alias = semanticAliases[key.toLowerCase()];
      if (alias && alias !== varName) {
        lines.push(`  ${alias}: var(${varName});`);
      }
      count++;
    }
  }

  return { css: lines.join('\n'), count };
}

/**
 * Extracts Shadow / Effect tokens.
 */
function processEffects(effectGroup) {
  const lines = [];
  let count = 0;

  lines.push('\n  /* ==========================================================================');
  lines.push('     4. ELEVATION & SHADOW EFFECTS');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     Elevation levels formatted as standard CSS box-shadow declarations.');
  lines.push('     ========================================================================== */\n');

  for (const [key, token] of Object.entries(effectGroup)) {
    if (token && token.value) {
      const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = '#000000' } = token.value;
      const formattedColor = formatColor(color);
      const varName = `--shadow-${toKebabCase(key)}`;
      const shadowValue = `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${formattedColor}`;
      lines.push(`  ${varName}: ${shadowValue};`);
      count++;
    }
  }

  return { css: lines.join('\n'), count };
}

/**
 * Extracts Typography tokens and generates both variables and optional utility classes.
 */
function processTypography(typographyGroup) {
  const lines = [];
  const utilityClasses = [];
  let count = 0;

  lines.push('\n  /* ==========================================================================');
  lines.push('     5. TYPOGRAPHY SYSTEM');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     Type scales including font-family, sizes, weights, and line heights.');
  lines.push('     ========================================================================== */\n');

  utilityClasses.push('/* ==========================================================================');
  utilityClasses.push('   TYPOGRAPHY UTILITY CLASSES');
  utilityClasses.push('   ========================================================================== */');

  for (const [styleName, props] of Object.entries(typographyGroup)) {
    if (props && typeof props === 'object') {
      const groupKebab = toKebabCase(styleName);
      lines.push(`  /* Typography: ${styleName} */`);

      for (const [propKey, propToken] of Object.entries(props)) {
        if (!propToken || propToken.value === undefined) continue;
        const propKebab = toKebabCase(propKey);
        const varName = `--typography-${groupKebab}-${propKebab}`;
        
        let formattedVal = propToken.value;
        if (propToken.type === 'dimension') {
          formattedVal = `${propToken.value}px`;
        } else if (propKey === 'fontFamily') {
          formattedVal = `'${propToken.value}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        }
        
        lines.push(`  ${varName}: ${formattedVal};`);
        count++;
      }
      lines.push('');

      // Build corresponding utility class
      utilityClasses.push(`\n.type-${groupKebab} {`);
      utilityClasses.push(`  font-family: var(--typography-${groupKebab}-font-family);`);
      utilityClasses.push(`  font-size: var(--typography-${groupKebab}-font-size);`);
      utilityClasses.push(`  font-weight: var(--typography-${groupKebab}-font-weight);`);
      utilityClasses.push(`  line-height: var(--typography-${groupKebab}-line-height);`);
      utilityClasses.push(`  letter-spacing: var(--typography-${groupKebab}-letter-spacing);`);
      utilityClasses.push(`  text-decoration: var(--typography-${groupKebab}-text-decoration);`);
      utilityClasses.push('}');
    }
  }

  return {
    cssVars: lines.join('\n'),
    utilities: utilityClasses.join('\n'),
    count
  };
}

// ---------------------------------------------------------------------------
// Pipeline & CLI Execution
// ---------------------------------------------------------------------------

/**
 * Builds full CSS output string from tokens JSON object.
 * @param {object} tokensData 
 * @returns {{ css: string, stats: object }}
 */
function buildDesignTokensCSS(tokensData) {
  const parts = [];
  const stats = {};

  parts.push(`/**
 * ----------------------------------------------------------------------------
 * DESIGN SYSTEM CSS TOKENS
 * ----------------------------------------------------------------------------
 * AUTO-GENERATED from design-tokens.tokens.json
 * Generated at: ${new Date().toISOString()}
 * 
 * CORE RULES:
 * 1. Primitive Colors (--color-primitive-*):
 *    Foundations only. DO NOT USE directly in UI components.
 * 
 * 2. UI Color Roles (--color-ui-*, --color-role-*):
 *    For direct UI consumption. Roles such as "primary color2" and
 *    "secondary color2" are the primary colors for UI components.
 * 
 * 3. Spacing & Elevation (--spacing-*, --shadow-*):
 *    Standardized design system scales.
 * ----------------------------------------------------------------------------
 */

:root {`);

  if (tokensData['primitive colors']) {
    const { css, count } = processPrimitiveColors(tokensData['primitive colors']);
    parts.push(css);
    stats.primitives = count;
  }

  if (tokensData['color roles']) {
    const { css, count } = processColorRoles(tokensData['color roles'], tokensData);
    parts.push(css);
    stats.roles = count;
  }

  if (tokensData['spacing']) {
    const { css, count } = processSpacing(tokensData['spacing']);
    parts.push(css);
    stats.spacing = count;
  }

  if (tokensData['effect']) {
    const { css, count } = processEffects(tokensData['effect']);
    parts.push(css);
    stats.effects = count;
  }

  let typoUtilities = '';
  if (tokensData['typography']) {
    const { cssVars, utilities, count } = processTypography(tokensData['typography']);
    parts.push(cssVars);
    typoUtilities = utilities;
    stats.typography = count;
  }

  parts.push('}\n');

  if (typoUtilities) {
    parts.push(typoUtilities);
  }

  return { css: parts.join('\n'), stats };
}

/**
 * Main script runner
 */
function run() {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(process.cwd(), 'design-tokens.tokens.json');
  let outputPath = path.resolve(process.cwd(), 'src/app/design-tokens.css');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(process.cwd(), args[i + 1]);
      i++;
    }
  }

  console.log('====================================================');
  console.log('🎨 Design Tokens -> CSS Variables Converter');
  console.log('====================================================');
  console.log(`Input tokens : ${inputPath}`);
  console.log(`Output CSS   : ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input tokens file not found at ${inputPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(inputPath, 'utf8');
  let tokensData;
  try {
    tokensData = JSON.parse(rawJson);
  } catch (err) {
    console.error(`❌ Error parsing tokens JSON: ${err.message}`);
    process.exit(1);
  }

  const { css, stats } = buildDesignTokensCSS(tokensData);

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, css, 'utf8');

  console.log('\n📊 Conversion Summary:');
  console.log(`   - Foundational Primitive Colors : ${stats.primitives || 0} tokens`);
  console.log(`   - Semantic UI Color Roles        : ${stats.roles || 0} tokens`);
  console.log(`   - Spacing Tokens                 : ${stats.spacing || 0} tokens`);
  console.log(`   - Elevation / Shadow Effects     : ${stats.effects || 0} tokens`);
  console.log(`   - Typography Tokens              : ${stats.typography || 0} tokens`);
  console.log(`   - Total CSS Custom Properties    : ${(stats.primitives || 0) + (stats.roles || 0) + (stats.spacing || 0) + (stats.effects || 0) + (stats.typography || 0)}`);
  console.log('\n✅ Tokens generated successfully!');
  console.log(`📁 File written to: ${outputPath}`);
  console.log('====================================================');
}

if (require.main === module) {
  run();
}

module.exports = {
  buildDesignTokensCSS,
  formatColor,
  resolveReference,
  toKebabCase
};
