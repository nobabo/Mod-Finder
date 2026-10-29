# Game artwork and default colors

Automatic colors uses the selected game's RGBA default in `src/shared/data/game-theme-colors.json`. Minecraft uses `#18645242`. Saved manual colors override these defaults; **기본 색상으로** restores the current game's default. Text, outlines and MF accents adapt to the color composited over the current photograph. Crimson remains optional.

## Two elements per game

Every supported game displays exactly two representative characters, creatures or items. Game title wordmarks remain in game navigation, and are not used as home decorations.

| Game | Left element | Right element |
| --- | --- | --- |
| Minecraft | Steve | Diamond |
| Stardew Valley | Junimo | Chicken |
| Skyrim | Iron Helmet | Sweetroll |
| Lethal Company | Employee | Hoarding Bug |
| RimWorld | Thrumbo | Muffalo |
| Valheim | Troll | Greydwarf |
| Terraria | Guide | Blue Slime |
| Project Zomboid | Spiffo | Baseball Bat |
| Cyberpunk 2077 | Johnny Silverhand | Jackie Welles |
| Baldur's Gate 3 | Astarion | Shadowheart |
| Fallout 4 | Vault Boy | Nuka-Cola |
| Risk of Rain 2 | Commando | Ukulele |
| Cities: Skylines | Wind Turbine | Chirper |
| Don't Starve Together | Wilson | Chester |

The representative element rests on the search field's upper-left edge, and its companion sits just below the lower-right edge. Small screens inset the companion to keep it in view. Only their image bounds accept pointer events. Dragging, keyboard movement and saved positions can overlap the search field or other controls freely; artwork stays below the search, rankings, shortcuts and navigation in the stacking order, even during a drag. Controls retain pointer priority, while empty layout gaps let exposed artwork remain draggable. Viewport bounds keep images reachable after resizing. Escape cancels a drag; Home or double-click resets an individual image. Existing custom positions are preserved. Removed characters are not restored from old saved positions. MF stays fixed at the top center with a 56px inset, without motion.

## Original image sources

Retrieved 2026-10-28; the employee render was replaced on 2026-10-29. The 24 bundled original files, source pages, image URLs and CSS view bounds are recorded in [game-art-sources.json](game-art-sources.json). Images are supplied by the publishers or game wikis and remain owned by the respective rights holders. No AI-generated substitutes or wordmark substitutes are used.

The original pixels are preserved. Transparent padding and the second Hoarding Bug reference pose are excluded by CSS view bounds recorded in `src/shared/data/game-character-art.json`. The Hoarding Bug view ends at the first pose's row 835, before the second pose starts at row 916. Lethal Company's employee uses the default-suit [Employee2 Cel render](https://lethal-company.fandom.com/wiki/File:Employee2_Cel.png), replacing the dark red waving render. Pixel-art assets use nearest-neighbor display.

Existing Minecraft and Stardew Valley sources:

- Steve: [Mojang introduction artwork](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/game-characters/MC-About_Key-Art_Gather_Resources_600x800.png), originally trimmed and stored as lossless WebP.
- Diamond: [Mojang Bedrock samples](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/items/diamond.png), originally trimmed and stored as lossless WebP.
- Junimo: [official Stardew Valley Wiki sprite](https://wiki.stardewvalley.net/mediawiki/images/5/57/Junimo.gif), originally stored as a static first-frame lossless WebP.
- Chicken: [official Stardew Valley site image](https://www.stardewvalley.net/wp-content/uploads/2017/12/cropped-chickenfavicon-192x192.png), originally stored as lossless WebP.

Development preparation is reproducible through `tooling/scripts/collect-character-art.mjs --download` and `tooling/scripts/prepare-character-art.py` (Pillow). The Cities wiki originals can be downloaded with Playwright CLI using `tooling/scripts/fetch-city-character-images.js` when its image host requires a browser. The prepare script records alpha bounds without changing image pixels.

## Scene and interaction

The photo collections remain in `src/shared/data/backgrounds.json` and `src/shared/data/game-theme-backgrounds.json`. Minecraft and Stardew Valley retain their five publisher screenshots. All game elements and photos are bundled locally.

Game and color themes share the Atmosphere WebGL renderer. Its glass surfaces keep colored outlines and sample the same photographic scene. CSS blur is the fallback. Background parallax stays bounded, and dialogs or hidden pages pause the scene. Hover and touch retain the short image hop and ripple, with the ripple clipped to the artwork bounds. Reduced motion disables these effects.
