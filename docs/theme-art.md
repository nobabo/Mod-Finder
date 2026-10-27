# Game default themes

The **Game default / 게임 기본** preference follows the selected game. Minecraft uses a muted mint background (`#c6ddcf`); Stardew Valley uses a muted cream background (`#e8d9b5`). Each game has five locally bundled publisher screenshots at 18% opacity. They crossfade every 20 seconds, pausing while a dialog is open or the page is hidden. Reduced motion keeps the current image still. Other games and the all-games view retain the photographic magenta theme. Color themes remain available in settings.

The new preference is saved as `modfinder-theme`. Existing non-default color choices migrate from `modfinder-accent`. The old automatically saved magenta default becomes Game default; magenta can still be explicitly selected and saved with the new key.

## Original artwork sources

Retrieved 2026-10-28. Sources include publisher artwork, Mojang's resource pack, and in-game renders/sprites distributed by the respective wikis. Wiki-hosted renders are identified below. They are bundled locally to avoid third-party requests during use. All game artwork remains owned by the respective rights holders.

| Local asset in `src/web/public/theme-art/` | Publisher source | Preparation |
| --- | --- | --- |
| `minecraft-steve.webp` | [Minecraft: What is Minecraft?](https://www.minecraft.net/en-us/about-minecraft), [original PNG](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/game-characters/MC-About_Key-Art_Gather_Resources_600x800.png) | Transparent padding trimmed; lossless WebP. © Mojang / Microsoft. |
| `minecraft-alex.webp` | [Minecraft: What is Minecraft?](https://www.minecraft.net/en-us/about-minecraft), [original PNG](https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/game-characters/MC-About_Key-Art_Build_Amazing_Things_600x800.png) | Alex cropped from the upper-left at (60, 72)–(255, 305); lossless WebP. © Mojang / Microsoft. |
| `minecraft-creeper.webp` | [Minecraft Wiki: Creeper](https://minecraft.wiki/w/Creeper), [game render](https://minecraft.wiki/images/Creeper_JE3_BE1.png) | Transparent padding trimmed; lossless WebP. Game model/textures © Mojang / Microsoft. |
| `minecraft-grass.webp` | [Minecraft Wiki: Grass Block](https://minecraft.wiki/w/Grass_Block), [game render](https://minecraft.wiki/images/Grass_Block_JE7_BE6.png) | Transparent padding trimmed; lossless WebP. Game model/textures © Mojang / Microsoft. |
| `minecraft-diamond.webp` | [Mojang Bedrock samples](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/items/diamond.png) | Original inventory sprite, transparent padding trimmed; lossless WebP. © Mojang / Microsoft. |
| `stardew-chicken.webp` | [Stardew Valley official site](https://www.stardewvalley.net/), [original PNG](https://www.stardewvalley.net/wp-content/uploads/2017/12/cropped-chickenfavicon-192x192.png) | Lossless WebP. © ConcernedApe. |
| `stardew-junimo.webp` | [Official Stardew Valley Wiki: Junimos](https://wiki.stardewvalley.net/Junimos), [original GIF](https://wiki.stardewvalley.net/mediawiki/images/5/57/Junimo.gif) | First frame, transparent padding trimmed; static lossless WebP. © ConcernedApe. |
| `stardew-cat.webp` | [Official Stardew Valley Wiki: Pet](https://wiki.stardewvalley.net/Pet), [original PNG](https://wiki.stardewvalley.net/mediawiki/images/1/1e/Cat_1.png) | Transparent padding trimmed; lossless WebP. © ConcernedApe. |
| `stardew-krobus.webp` | [Official Stardew Valley Wiki: Krobus](https://wiki.stardewvalley.net/Krobus), [original PNG](https://wiki.stardewvalley.net/mediawiki/images/7/71/Krobus.png) | Transparent padding trimmed; lossless WebP. © ConcernedApe. |
| `stardew-stardrop.webp` | [Official Stardew Valley Wiki: Stardrop](https://wiki.stardewvalley.net/Stardrop), [original PNG](https://wiki.stardewvalley.net/mediawiki/images/a/a5/Stardrop.png) | Transparent padding trimmed; lossless WebP. © ConcernedApe. |

Steve and the Junimo are the respective central representatives above the home search field. Four companions/props sit outside the ranking's side and lower corners. Compact layouts place the four below the ranking, preserving the filter button's position and keeping every label clear. The representative is clipped above the transparent search field so no artwork shows through its input. Characters are decorative, hidden from assistive technology, and ignore pointer events.

The logo has separate pastel gradient tokens; control and text accents stay darker for legibility. Panels and controls have transparent fills, with a translucent tint only for selected options. Masked gradient rims and inset highlights preserve the liquid glass border treatment. These light themes do not mount the WebGL renderer or particle effects.

## Background collection

The five sources per game, dimensions, and local paths are recorded in `src/shared/data/game-theme-backgrounds.json`; assets are in `src/web/public/theme-backgrounds/`. Minecraft scenes come from the [official introduction](https://www.minecraft.net/en-us/about-minecraft) and [store gallery](https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc): biomes, building, survival, a portal, and exploration. Stardew Valley scenes come from its [official homepage gallery](https://www.stardewvalley.net/): a summer farm, the night market, an autumn multiplayer farm, the mines, and spring scenery. The original color themes' separate screenshot catalog is unchanged.
