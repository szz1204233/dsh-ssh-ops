# Third-party notices

## WindTerm terminal palettes and semantic rules

The terminal palettes in `src/client/terminal-display/theme.js` and the semantic rule subset in `src/client/terminal-display/rules.js` are adapted from [WindTerm 2.7.0](https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0), by kingToolbox and the WindTerm contributors:

- `global/themes/dige-black/scheme.theme`
- `global/themes/dige-white/scheme.theme`
- `terminal/schemes/linux/linux.lexer`

[WindTerm's license statement](https://github.com/kingToolbox/WindTerm#license) provides its released source code, except the thirdparty directory, under Apache-2.0. A copy is included in [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt).

Modifications in this plugin include a JavaScript rule subset, additional log keywords, a light palette adjusted for contrast, and per-theme user color overrides. The xterm cell matcher, decoration lifecycle and settings UI are implemented by this plugin; it does not embed the WindTerm engine or the full grammar.
