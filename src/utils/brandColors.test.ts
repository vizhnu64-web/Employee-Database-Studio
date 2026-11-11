import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidHex,
  hexToRgb,
  getContrastTextColor,
  shadeColor,
  resolveBrandTokens,
  tokensToCssVars,
  DEFAULT_BRAND_COLORS
} from './brandColors';

test('isValidHex validates 3, 6, and 8 digit hex colors', () => {
  assert.equal(isValidHex('#1e3a8a'), true);
  assert.equal(isValidHex('#FFF'), true);
  assert.equal(isValidHex('#1e3a8a99'), true);
  assert.equal(isValidHex('1e3a8a'), false);
  assert.equal(isValidHex('red'), false);
  assert.equal(isValidHex(''), false);
});

test('hexToRgb converts hex to RGB object', () => {
  assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRgb('#FFFFFF'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb('#1e3a8a'), { r: 30, g: 58, b: 138 });
});

test('getContrastTextColor returns readable text color based on background luminance', () => {
  assert.equal(getContrastTextColor('#FFFFFF'), '#000000'); // Light bg -> dark text
  assert.equal(getContrastTextColor('#F4F4F6'), '#000000');
  assert.equal(getContrastTextColor('#000000'), '#FFFFFF'); // Dark bg -> white text
  assert.equal(getContrastTextColor('#1e3a8a'), '#FFFFFF'); // Navy -> white text
});

test('shadeColor darkens and lightens correctly', () => {
  const darkened = shadeColor('#1e3a8a', -20);
  assert.ok(isValidHex(darkened));
  assert.notEqual(darkened, '#1e3a8a');

  const lightened = shadeColor('#1e3a8a', 20);
  assert.ok(isValidHex(lightened));
  assert.notEqual(lightened, '#1e3a8a');
});

test('resolveBrandTokens inherits primary and secondary button colors by default', () => {
  const tokens = resolveBrandTokens({
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#f59e0b'
  });

  assert.equal(tokens.brandPrimary, '#2563eb');
  assert.equal(tokens.brandSecondary, '#7c3aed');
  assert.equal(tokens.brandAccent, '#f59e0b');

  // By default, buttons inherit from brand primary and secondary
  assert.equal(tokens.buttonPrimaryBg, '#2563eb');
  assert.equal(tokens.buttonSecondaryBg, '#7c3aed');
});

test('resolveBrandTokens allows independent button and surface overrides', () => {
  const tokens = resolveBrandTokens({
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#f59e0b',
    buttons: {
      customButtonsEnabled: true,
      primaryBg: '#059669',
      primaryText: '#FFFFFF',
      secondaryBg: '#ea580c',
      dangerBg: '#991b1b'
    },
    surfaces: {
      customSurfacesEnabled: true,
      appBackground: '#111827',
      cardBackground: '#1f2937'
    }
  });

  assert.equal(tokens.brandPrimary, '#2563eb');
  assert.equal(tokens.buttonPrimaryBg, '#059669');
  assert.equal(tokens.buttonSecondaryBg, '#ea580c');
  assert.equal(tokens.buttonDangerBg, '#991b1b');
  assert.equal(tokens.appBackground, '#111827');
  assert.equal(tokens.cardBackground, '#1f2937');
});

test('tokensToCssVars produces expected CSS variable map', () => {
  const tokens = resolveBrandTokens(DEFAULT_BRAND_COLORS);
  const vars = tokensToCssVars(tokens);

  assert.equal(vars['--brand-primary'], DEFAULT_BRAND_COLORS.primary);
  assert.equal(vars['--brand-secondary'], DEFAULT_BRAND_COLORS.secondary);
  assert.equal(vars['--brand-accent'], DEFAULT_BRAND_COLORS.accent);
  assert.ok(vars['--button-primary-bg']);
  assert.ok(vars['--app-background']);
});
