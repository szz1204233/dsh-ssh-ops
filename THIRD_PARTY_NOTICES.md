# Third-party notices

Original project code is licensed under [MIT](LICENSE). The third-party material below remains subject to its own license terms. The root MIT license and the package's project-license metadata do not replace those terms.

## WindTerm terminal palettes and semantic rules

The palettes in `src/client/terminal-display/theme.js` and the rule subset in `src/client/terminal-display/rules.js` are modified adaptations of WindTerm 2.7.0, by KingToolbox and the WindTerm contributors.

Copyright (c) KingToolbox. All rights reserved.

The checked release also carries the following WindTerm attribution and disclaimer in `license.txt`:

```text
WindTerm License

THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.

Copyright (c) KingToolbox. All rights reserved.
```

### Source and license evidence

The [WindTerm 2.7.0 license statement](https://github.com/kingToolbox/WindTerm/tree/2.7.0#license) licenses released source code outside the thirdparty directory under Apache-2.0. The tagged [src/LICENSE](https://github.com/kingToolbox/WindTerm/blob/2.7.0/src/LICENSE) contains its terms; a copy is included in [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt).

The following text/configuration sources were checked directly in the official [Linux 2.7.0 release archive](https://github.com/kingToolbox/WindTerm/releases/download/2.7.0/WindTerm_2.7.0_Linux_Portable_x86_64.zip) on 2026-11-06. The archive SHA-256 matches the [published release checksum](https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0): `7797697eeb60239020512e2b549695a60c39b3fd01fe7ebb047fd50a2889103c`.

Paths below are relative to the archive's `WindTerm_2.7.0/` directory:

| Original file | SHA-256 |
| --- | --- |
| `global/themes/dige-black/scheme.theme` | `e46e7a21642a006c0602c1084fcf823da661970a47780f06baf0189c4cc6c5ab` |
| `global/themes/dige-white/scheme.theme` | `47a8b813dd19cdd8df514a27fb59b497e6c3a0316982b1b356a4813a35e7a650` |
| `terminal/schemes/linux/linux.lexer` | `e0e118c0c0deb77066ba87448cd8c48d3124ebd25987d601d31a88880a596f1c` |

These files have no separate license or copyright header. No NOTICE file was found in the checked archive. Its root `license.txt` identifies KingToolbox and separately credits libraries used by the WindTerm application; this plugin does not incorporate that application, its engine or those libraries. The source-license basis for the textual adaptations is the tagged statement above, rather than a claim that the entire WindTerm binary is Apache-2.0.

The palette files carry these provenance comments, retained here and in the adapted file headers:

- Dige Black: "Most colors take from Monokai."
- Dige White: "Most colors take from Vscode's QuiteLight Theme."

VS Code's Quiet Light extension [declares MIT](https://github.com/microsoft/vscode/blob/1.96.0/extensions/theme-quietlight/package.json); the Microsoft copyright and MIT text are included in [bundled license texts](licenses/bundled-dependencies.txt). No separate Monokai license grant is asserted here: this is preservation of the original palette attribution, and no Monokai extension, engine or complete theme file is bundled.

Modifications include a JavaScript rule subset, additional log keywords, a light palette adjusted for contrast, per-theme user overrides, and DSH-specific terminal backgrounds/foregrounds. The xterm cell matcher, decoration lifecycle and settings UI are implemented by this plugin; it does not embed WindTerm's engine or full grammar. Modified files are marked prominently in their headers.

## Bundled npm dependencies

Some development dependencies are incorporated into the shipped bundles. They are not all MIT: MongoDB-related code uses Apache-2.0, and webidl-conversions uses BSD-2-Clause. Full package license texts, including nested vendor license files, are included in [licenses/bundled-dependencies.txt](licenses/bundled-dependencies.txt). Both npm tarballs and source release archives carry this file and the Apache-2.0 text.

### Host bundles

| Package | Version | License |
| --- | --- | --- |
| `@mongodb-js/saslprep` | 1.4.13 | MIT |
| `bson` | 6.10.4 | Apache-2.0 |
| `memory-pager` | 1.5.0 | MIT |
| `mongodb` | 6.21.0 | Apache-2.0 |
| `mongodb-connection-string-url` | 3.0.2 | Apache-2.0 |
| `punycode` | 2.3.1 | MIT |
| `sparse-bitfield` | 3.0.3 | MIT |
| `tr46` | 5.1.1 | MIT |
| `webidl-conversions` | 7.0.0 | BSD-2-Clause |
| `whatwg-url` | 14.2.0 | MIT |
| `zod` | 4.4.3 | MIT |

### Client bundle (including xterm CSS)

| Package | Version | License |
| --- | --- | --- |
| `@xterm/addon-fit` | 0.10.0 | MIT |
| `@xterm/addon-search` | 0.15.0 | MIT |
| `@xterm/xterm` | 5.5.0 | MIT |
| `zod` | 4.4.3 | MIT |

The highlight worker bundles this plugin's source, including the WindTerm adaptation above, and no npm package code. External runtime dependencies such as ssh2, mysql2, pg, pg-cursor and redis are installed separately by the package manager with their own license files; retain those files when redistributing an assembled installation. React and DSH peer packages are supplied externally by the host.

The full locked-dependency inventory, optional-package checks and audit limits are documented in [dependency license audit](docs/dependency-licenses.md). This audit concerns the pinned client/driver packages, not the separately licensed MongoDB or Redis server products.
